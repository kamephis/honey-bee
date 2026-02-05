export interface CostItem {
  id: string;
  name: string;
  amount: number;
}

export interface BenefitItem {
  id: string;
  name: string;
  annualAmount: number;
}

export interface TcoOption {
  id: string;
  name: string;
  initialCosts: CostItem[];
  annualCosts: CostItem[];
}

export interface TcoProject {
  name: string;
  years: number;
  discountRate: number; // percentage, e.g. 5 for 5%
  options: TcoOption[];
  benefits: BenefitItem[];
}

// --- Computed results ---

export interface YearlyCost {
  year: number;
  initial: number;
  annual: number;
  total: number;
  cumulative: number;
  discounted: number;
  cumulativeDiscounted: number;
}

export interface OptionResult {
  optionId: string;
  optionName: string;
  totalInitial: number;
  totalAnnual: number;
  tco: number;
  npv: number;
  yearlyCosts: YearlyCost[];
}

export interface BenefitResult {
  totalAnnualBenefit: number;
  yearlyCumulative: number[]; // cumulative benefit per year
}

export interface RoiResult {
  optionId: string;
  optionName: string;
  tco: number;
  totalBenefit: number;
  netBenefit: number;
  roiPercent: number;
  breakEvenYear: number | null; // null = never breaks even within projection
}

export const PRESET_INITIAL_COSTS = [
  'Lizenzkosten (einmalig)',
  'Implementierung & Setup',
  'Datenmigration',
  'Hardware / Infrastruktur',
  'Schulung & Onboarding',
  'Beratung & Konzeption',
  'Integration / Schnittstellen',
  'Anpassungen / Customizing',
];

export const PRESET_ANNUAL_COSTS = [
  'Lizenzkosten (jaehrlich)',
  'Wartung & Support',
  'Hosting / Cloud-Kosten',
  'Personalkosten (Betrieb)',
  'Updates & Upgrades',
  'Schulung (laufend)',
  'Externe Dienstleister',
];

export const PRESET_BENEFITS = [
  'Umsatzsteigerung',
  'Kosteneinsparung (Prozesse)',
  'Produktivitaetsgewinn',
  'Reduktion Fehlerquote',
  'Zeiteinsparung (FTE)',
  'Reduktion Lizenzkosten (Alt-System)',
  'Reduktion Wartungskosten (Alt-System)',
];
