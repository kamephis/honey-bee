import type { Project, Criterion, WeightedResult, VendorScore } from './types';
import { load as loadStored, save as saveStored, STORAGE_KEY } from './storage';

// --- Persistence helpers ---

function loadFromStorage(): Project {
  const stored = loadStored();
  const storedNotes = stored.nwa.notes || {};
  return {
    name: stored.name,
    criteria: stored.nwa.criteria.map((c) => ({ id: c.id, name: c.name, description: c.description ?? '' })),
    pairwise: { ...stored.nwa.pairwise },
    vendors: stored.vendors.map((v) => ({
      id: v.id,
      name: v.name,
      scores: { ...(stored.nwa.scores[v.id] || {}) },
      notes: { ...(storedNotes[v.id] || {}) },
    })),
  };
}

function persist(): void {
  const stored = loadStored();
  const scores: Record<string, Record<string, number>> = {};
  const notes: Record<string, Record<string, string>> = {};
  for (const v of project.vendors) {
    scores[v.id] = v.scores;
    // Only persist non-empty notes
    const vendorNotes: Record<string, string> = {};
    for (const [key, val] of Object.entries(v.notes)) {
      if (val.trim()) vendorNotes[key] = val;
    }
    if (Object.keys(vendorNotes).length > 0) notes[v.id] = vendorNotes;
  }

  // Preserve vendors that only exist in other tools (TCO or Risk)
  const nwaIds = new Set(project.vendors.map((v) => v.id));
  const tcoOnlyVendors = stored.vendors.filter((v) => !nwaIds.has(v.id) && (v.id in stored.tco.costs || v.id in stored.risk.vendors));

  saveStored({
    ...stored,
    name: project.name,
    vendors: [
      ...project.vendors.map((v) => ({ id: v.id, name: v.name })),
      ...tcoOnlyVendors,
    ],
    nwa: {
      criteria: project.criteria.map((c) => ({ id: c.id, name: c.name, description: c.description || undefined })),
      pairwise: project.pairwise,
      scores,
      notes: Object.keys(notes).length > 0 ? notes : undefined,
    },
  });
}

// --- State ---

let project: Project = loadFromStorage();
let listeners: (() => void)[] = [];

// Cross-tab sync: reload when another tab writes to storage
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) {
    project = loadFromStorage();
    listeners.forEach((fn) => fn());
  }
});

export function createEmptyProject(): Project {
  return {
    name: 'Neues Projekt',
    criteria: [],
    pairwise: {},
    vendors: [],
  };
}

export function getProject(): Project {
  return project;
}

export function setProject(p: Project): void {
  project = p;
  notify();
}

export function subscribe(fn: () => void): void {
  listeners.push(fn);
}

function notify(): void {
  persist();
  listeners.forEach((fn) => fn());
}

function genId(): string {
  return crypto.randomUUID();
}

// --- Criteria ---
export function addCriterion(name: string, description = ''): void {
  project.criteria.push({ id: genId(), name, description });
  notify();
}

export function updateCriterion(id: string, name: string): void {
  const c = project.criteria.find((c) => c.id === id);
  if (c) c.name = name;
  notify();
}

export function updateCriterionDescription(id: string, description: string): void {
  const c = project.criteria.find((c) => c.id === id);
  if (c) c.description = description;
  notify();
}

export function removeCriterion(id: string): void {
  project.criteria = project.criteria.filter((c) => c.id !== id);
  // Clean pairwise
  const newPairwise: Record<string, number> = {};
  for (const [key, val] of Object.entries(project.pairwise)) {
    if (!key.includes(id)) newPairwise[key] = val;
  }
  project.pairwise = newPairwise;
  // Clean vendor scores
  project.vendors.forEach((v) => delete v.scores[id]);
  notify();
}

// --- Pairwise ---
export function setPairwise(id1: string, id2: string, value: number): void {
  project.pairwise[`${id1}:${id2}`] = value;
  notify();
}

export function getPairwise(id1: string, id2: string): number {
  return project.pairwise[`${id1}:${id2}`] ?? 1;
}

// --- Vendors ---
export function addVendor(name: string): void {
  project.vendors.push({ id: genId(), name, scores: {}, notes: {} });
  notify();
}

export function setVendorNote(vendorId: string, criterionId: string, note: string): void {
  const v = project.vendors.find((v) => v.id === vendorId);
  if (v) {
    if (note.trim()) {
      v.notes[criterionId] = note;
    } else {
      delete v.notes[criterionId];
    }
  }
  notify();
}

export function updateVendorName(id: string, name: string): void {
  const v = project.vendors.find((v) => v.id === id);
  if (v) v.name = name;
  notify();
}

export function removeVendor(id: string): void {
  project.vendors = project.vendors.filter((v) => v.id !== id);
  notify();
}

export function setVendorScore(vendorId: string, criterionId: string, score: number): void {
  const v = project.vendors.find((v) => v.id === vendorId);
  if (v) v.scores[criterionId] = score;
  notify();
}

// --- Calculation ---
export function calculateWeights(): { absoluteWeights: Record<string, number>; relativeWeights: Record<string, number>; totalAbsolute: number } {
  const criteria = project.criteria;
  const absoluteWeights: Record<string, number> = {};
  let totalAbsolute = 0;

  for (const c of criteria) {
    let sum = 0;
    for (const other of criteria) {
      if (c.id === other.id) continue;
      const key1 = `${c.id}:${other.id}`;
      const key2 = `${other.id}:${c.id}`;
      if (key1 in project.pairwise) {
        sum += 2 - project.pairwise[key1];
      } else if (key2 in project.pairwise) {
        sum += project.pairwise[key2];
      } else {
        sum += 1; // default: equal
      }
    }
    absoluteWeights[c.id] = sum;
    totalAbsolute += sum;
  }

  const relativeWeights: Record<string, number> = {};
  for (const c of criteria) {
    relativeWeights[c.id] = totalAbsolute > 0 ? absoluteWeights[c.id] / totalAbsolute : 0;
  }

  return { absoluteWeights, relativeWeights, totalAbsolute };
}

export function calculateResults(): WeightedResult[] {
  const { relativeWeights } = calculateWeights();
  const criteria = project.criteria;
  const vendors = project.vendors;

  return criteria.map((c) => ({
    criterionId: c.id,
    criterionName: c.name,
    absoluteWeight: calculateWeights().absoluteWeights[c.id],
    relativeWeight: relativeWeights[c.id],
    vendorScores: vendors.map((v) => {
      const raw = v.scores[c.id] ?? 0;
      return {
        vendorId: v.id,
        vendorName: v.name,
        rawScore: raw,
        weightedScore: raw * relativeWeights[c.id],
      };
    }),
  }));
}

export function getVendorTotals(): { vendorId: string; vendorName: string; totalWeighted: number }[] {
  const results = calculateResults();
  const vendors = project.vendors;

  return vendors.map((v) => {
    const total = results.reduce((sum, r) => {
      const vs = r.vendorScores.find((s: VendorScore) => s.vendorId === v.id);
      return sum + (vs?.weightedScore ?? 0);
    }, 0);
    return { vendorId: v.id, vendorName: v.name, totalWeighted: total };
  });
}

// --- Import / Export ---
export function exportProject(): string {
  return JSON.stringify(project, null, 2);
}

export function importProject(json: string): void {
  const p = JSON.parse(json) as Project;
  if (!p.name || !Array.isArray(p.criteria) || !Array.isArray(p.vendors)) {
    throw new Error('Ungültiges Projektformat');
  }
  project = p;
  notify();
}

export function setProjectName(name: string): void {
  project.name = name;
  notify();
}

// --- Sorted criteria by weight ---
export function getCriteriaSortedByWeight(): Criterion[] {
  const { absoluteWeights } = calculateWeights();
  return [...project.criteria].sort((a, b) => (absoluteWeights[b.id] ?? 0) - (absoluteWeights[a.id] ?? 0));
}
