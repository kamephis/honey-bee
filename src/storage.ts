/**
 * Unified localStorage persistence for both NWA and TCO tools.
 * Both tools share the same vendor list and project name.
 */

const STORAGE_KEY = 'honeyBee_project';

export interface SharedVendor {
  id: string;
  name: string;
}

export interface StoredProject {
  version: 1;
  name: string;
  vendors: SharedVendor[];
  nwa: {
    criteria: { id: string; name: string }[];
    pairwise: Record<string, number>;
    scores: Record<string, Record<string, number>>; // vendorId -> { criterionId: score }
  };
  tco: {
    years: number;
    discountRate: number;
    costs: Record<string, {
      initialCosts: { id: string; name: string; amount: number }[];
      annualCosts: { id: string; name: string; amount: number }[];
    }>;
    benefits: { id: string; name: string; annualAmount: number }[];
  };
}

export function createDefault(): StoredProject {
  return {
    version: 1,
    name: 'Neues Projekt',
    vendors: [],
    nwa: { criteria: [], pairwise: {}, scores: {} },
    tco: { years: 5, discountRate: 5, costs: {}, benefits: [] },
  };
}

export function load(): StoredProject {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefault();
    const data = JSON.parse(raw);
    if (data && data.version === 1) return data as StoredProject;
    return createDefault();
  } catch {
    return createDefault();
  }
}

export function save(project: StoredProject): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // localStorage unavailable or full — app continues without persistence
  }
}

// --- Unified project export/import ---

export function exportFullProject(): string {
  return JSON.stringify(load(), null, 2);
}

export function importFullProject(json: string): StoredProject {
  const data = JSON.parse(json);

  // Full unified format (version 1)
  if (data && data.version === 1 && data.vendors && data.nwa && data.tco) {
    save(data as StoredProject);
    return data as StoredProject;
  }

  // Legacy NWA-only format: { name, criteria, pairwise, vendors: [{id, name, scores}] }
  if (data && data.criteria && data.vendors && !data.version) {
    const stored = load();
    const scores: Record<string, Record<string, number>> = {};
    const vendors = (data.vendors as { id: string; name: string; scores: Record<string, number> }[]);
    for (const v of vendors) {
      scores[v.id] = v.scores || {};
    }
    const merged: StoredProject = {
      ...stored,
      name: data.name || stored.name,
      vendors: vendors.map((v) => ({ id: v.id, name: v.name })),
      nwa: {
        criteria: data.criteria,
        pairwise: data.pairwise || {},
        scores,
      },
    };
    save(merged);
    return merged;
  }

  // Legacy TCO-only format: { name, years, discountRate, options, benefits }
  if (data && data.options && data.benefits && !data.version) {
    const stored = load();
    const costs: Record<string, { initialCosts: { id: string; name: string; amount: number }[]; annualCosts: { id: string; name: string; amount: number }[] }> = {};
    const options = (data.options as { id: string; name: string; initialCosts: { id: string; name: string; amount: number }[]; annualCosts: { id: string; name: string; amount: number }[] }[]);
    for (const o of options) {
      costs[o.id] = { initialCosts: o.initialCosts, annualCosts: o.annualCosts };
    }
    const merged: StoredProject = {
      ...stored,
      name: data.name || stored.name,
      vendors: options.map((o) => ({ id: o.id, name: o.name })),
      tco: {
        years: data.years ?? 5,
        discountRate: data.discountRate ?? 5,
        costs,
        benefits: data.benefits,
      },
    };
    save(merged);
    return merged;
  }

  throw new Error('Unbekanntes Projektformat');
}

export { STORAGE_KEY };
