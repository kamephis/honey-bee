import type { TcoProject, TcoOption, CostItem, BenefitItem, OptionResult, YearlyCost, RoiResult } from './tco-types';

let project: TcoProject = createEmptyProject();
let listeners: (() => void)[] = [];

export function createEmptyProject(): TcoProject {
  return {
    name: 'Neues TCO-Projekt',
    years: 5,
    discountRate: 5,
    options: [],
    benefits: [],
  };
}

export function getProject(): TcoProject {
  return project;
}

export function setProject(p: TcoProject): void {
  project = p;
  notify();
}

export function subscribe(fn: () => void): void {
  listeners.push(fn);
}

function notify(): void {
  listeners.forEach((fn) => fn());
}

function genId(): string {
  return crypto.randomUUID();
}

// --- Project settings ---
export function setProjectName(name: string): void {
  project.name = name;
  notify();
}

export function setYears(years: number): void {
  project.years = Math.max(1, Math.min(15, years));
  notify();
}

export function setDiscountRate(rate: number): void {
  project.discountRate = Math.max(0, Math.min(50, rate));
  notify();
}

// --- Options ---
export function addOption(name: string): void {
  project.options.push({ id: genId(), name, initialCosts: [], annualCosts: [] });
  notify();
}

export function updateOptionName(id: string, name: string): void {
  const o = project.options.find((o) => o.id === id);
  if (o) o.name = name;
  notify();
}

export function removeOption(id: string): void {
  project.options = project.options.filter((o) => o.id !== id);
  notify();
}

// --- Cost items ---
export function addInitialCost(optionId: string, name: string): void {
  const o = project.options.find((o) => o.id === optionId);
  if (o) o.initialCosts.push({ id: genId(), name, amount: 0 });
  notify();
}

export function updateInitialCost(optionId: string, costId: string, updates: Partial<CostItem>): void {
  const o = project.options.find((o) => o.id === optionId);
  if (!o) return;
  const c = o.initialCosts.find((c) => c.id === costId);
  if (c) {
    if (updates.name !== undefined) c.name = updates.name;
    if (updates.amount !== undefined) c.amount = updates.amount;
  }
  notify();
}

export function removeInitialCost(optionId: string, costId: string): void {
  const o = project.options.find((o) => o.id === optionId);
  if (o) o.initialCosts = o.initialCosts.filter((c) => c.id !== costId);
  notify();
}

export function addAnnualCost(optionId: string, name: string): void {
  const o = project.options.find((o) => o.id === optionId);
  if (o) o.annualCosts.push({ id: genId(), name, amount: 0 });
  notify();
}

export function updateAnnualCost(optionId: string, costId: string, updates: Partial<CostItem>): void {
  const o = project.options.find((o) => o.id === optionId);
  if (!o) return;
  const c = o.annualCosts.find((c) => c.id === costId);
  if (c) {
    if (updates.name !== undefined) c.name = updates.name;
    if (updates.amount !== undefined) c.amount = updates.amount;
  }
  notify();
}

export function removeAnnualCost(optionId: string, costId: string): void {
  const o = project.options.find((o) => o.id === optionId);
  if (o) o.annualCosts = o.annualCosts.filter((c) => c.id !== costId);
  notify();
}

// --- Benefits ---
export function addBenefit(name: string): void {
  project.benefits.push({ id: genId(), name, annualAmount: 0 });
  notify();
}

export function updateBenefit(id: string, updates: Partial<BenefitItem>): void {
  const b = project.benefits.find((b) => b.id === id);
  if (b) {
    if (updates.name !== undefined) b.name = updates.name;
    if (updates.annualAmount !== undefined) b.annualAmount = updates.annualAmount;
  }
  notify();
}

export function removeBenefit(id: string): void {
  project.benefits = project.benefits.filter((b) => b.id !== id);
  notify();
}

// --- Calculations ---
export function calculateOptionResult(option: TcoOption): OptionResult {
  const totalInitial = option.initialCosts.reduce((s, c) => s + c.amount, 0);
  const totalAnnual = option.annualCosts.reduce((s, c) => s + c.amount, 0);
  const rate = project.discountRate / 100;

  const yearlyCosts: YearlyCost[] = [];
  let cumulative = 0;
  let cumulativeDiscounted = 0;

  for (let y = 0; y <= project.years; y++) {
    const initial = y === 0 ? totalInitial : 0;
    const annual = y === 0 ? 0 : totalAnnual;
    const total = initial + annual;
    cumulative += total;
    const discountFactor = Math.pow(1 + rate, y);
    const discounted = total / discountFactor;
    cumulativeDiscounted += discounted;

    yearlyCosts.push({
      year: y,
      initial,
      annual,
      total,
      cumulative,
      discounted,
      cumulativeDiscounted,
    });
  }

  return {
    optionId: option.id,
    optionName: option.name,
    totalInitial,
    totalAnnual,
    tco: cumulative,
    npv: cumulativeDiscounted,
    yearlyCosts,
  };
}

export function calculateAllResults(): OptionResult[] {
  return project.options.map(calculateOptionResult);
}

export function calculateTotalAnnualBenefit(): number {
  return project.benefits.reduce((s, b) => s + b.annualAmount, 0);
}

export function calculateRoi(): RoiResult[] {
  const results = calculateAllResults();
  const annualBenefit = calculateTotalAnnualBenefit();
  const totalBenefit = annualBenefit * project.years;

  return results.map((r) => {
    const netBenefit = totalBenefit - r.tco;
    const roiPercent = r.tco > 0 ? (netBenefit / r.tco) * 100 : 0;

    // Break-even: find first year where cumulative benefit >= cumulative cost
    let breakEvenYear: number | null = null;
    for (const yc of r.yearlyCosts) {
      const cumulativeBenefit = annualBenefit * yc.year;
      if (cumulativeBenefit >= yc.cumulative && yc.year > 0) {
        breakEvenYear = yc.year;
        break;
      }
    }

    return {
      optionId: r.optionId,
      optionName: r.optionName,
      tco: r.tco,
      totalBenefit,
      netBenefit,
      roiPercent,
      breakEvenYear,
    };
  });
}

// --- Import / Export ---
export function exportProject(): string {
  return JSON.stringify(project, null, 2);
}

export function importProject(json: string): void {
  const p = JSON.parse(json) as TcoProject;
  if (!p.name || !Array.isArray(p.options) || !Array.isArray(p.benefits)) {
    throw new Error('Ungueltiges TCO-Projektformat');
  }
  project = p;
  notify();
}
