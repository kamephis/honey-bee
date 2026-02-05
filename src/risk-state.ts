import type { RiskItem, RiskProject, VendorRiskResult } from './risk-types';
import { getRiskLevel } from './risk-types';
import { load as loadStored, save as saveStored, STORAGE_KEY } from './storage';

// --- Persistence helpers ---

function loadFromStorage(): RiskProject {
  const stored = loadStored();
  return {
    name: stored.name,
    vendors: stored.vendors.map((v) => ({
      id: v.id,
      name: v.name,
      risks: stored.risk.vendors[v.id]?.map((r) => ({ ...r })) || [],
    })),
  };
}

function persist(): void {
  const stored = loadStored();
  const riskVendors: Record<string, RiskItem[]> = {};
  for (const v of project.vendors) {
    if (v.risks.length > 0) {
      riskVendors[v.id] = v.risks;
    }
  }

  saveStored({
    ...stored,
    name: project.name,
    risk: { vendors: riskVendors },
  });
}

// --- State ---

let project: RiskProject = loadFromStorage();
let listeners: (() => void)[] = [];

window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) {
    project = loadFromStorage();
    listeners.forEach((fn) => fn());
  }
});

export function getProject(): RiskProject {
  return project;
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

export function setProjectName(name: string): void {
  project.name = name;
  notify();
}

// --- Risk items ---

export function addRisk(vendorId: string, name: string): void {
  const v = project.vendors.find((v) => v.id === vendorId);
  if (v) {
    v.risks.push({ id: genId(), name, probability: 3, impact: 3, mitigation: '' });
    notify();
  }
}

export function updateRisk(vendorId: string, riskId: string, updates: Partial<RiskItem>): void {
  const v = project.vendors.find((v) => v.id === vendorId);
  if (!v) return;
  const r = v.risks.find((r) => r.id === riskId);
  if (r) {
    if (updates.name !== undefined) r.name = updates.name;
    if (updates.probability !== undefined) r.probability = Math.max(1, Math.min(5, updates.probability));
    if (updates.impact !== undefined) r.impact = Math.max(1, Math.min(5, updates.impact));
    if (updates.mitigation !== undefined) r.mitigation = updates.mitigation;
    notify();
  }
}

export function removeRisk(vendorId: string, riskId: string): void {
  const v = project.vendors.find((v) => v.id === vendorId);
  if (v) {
    v.risks = v.risks.filter((r) => r.id !== riskId);
    notify();
  }
}

export function copyRisksToVendor(sourceVendorId: string, targetVendorId: string): void {
  const source = project.vendors.find((v) => v.id === sourceVendorId);
  const target = project.vendors.find((v) => v.id === targetVendorId);
  if (!source || !target) return;
  const existingNames = new Set(target.risks.map((r) => r.name));
  for (const r of source.risks) {
    if (!existingNames.has(r.name)) {
      target.risks.push({ id: genId(), name: r.name, probability: 3, impact: 3, mitigation: '' });
    }
  }
  notify();
}

// --- Calculations ---

export function calculateVendorRisk(vendorId: string): VendorRiskResult {
  const v = project.vendors.find((v) => v.id === vendorId);
  if (!v) return { vendorId, vendorName: '', risks: [], totalScore: 0, avgScore: 0, maxScore: 0, riskCounts: { low: 0, medium: 0, high: 0, critical: 0 } };

  const risks = v.risks.map((r) => {
    const score = r.probability * r.impact;
    return { id: r.id, name: r.name, probability: r.probability, impact: r.impact, score, level: getRiskLevel(score), mitigation: r.mitigation };
  });

  const totalScore = risks.reduce((s, r) => s + r.score, 0);
  const avgScore = risks.length > 0 ? totalScore / risks.length : 0;
  const maxScore = risks.length > 0 ? Math.max(...risks.map((r) => r.score)) : 0;

  const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 } as Record<string, number>;
  for (const r of risks) riskCounts[r.level]++;

  return { vendorId, vendorName: v.name, risks, totalScore, avgScore, maxScore, riskCounts: riskCounts as Record<'low' | 'medium' | 'high' | 'critical', number> };
}

export function calculateAllVendorRisks(): VendorRiskResult[] {
  return project.vendors.map((v) => calculateVendorRisk(v.id));
}
