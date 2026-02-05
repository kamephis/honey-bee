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

export { STORAGE_KEY };
