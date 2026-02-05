export interface RiskItem {
  id: string;
  name: string;
  probability: number; // 1–5
  impact: number;      // 1–5
  mitigation: string;
}

export interface RiskProject {
  name: string;
  vendors: { id: string; name: string; risks: RiskItem[] }[];
}

// --- Computed ---

export interface VendorRiskResult {
  vendorId: string;
  vendorName: string;
  risks: { id: string; name: string; probability: number; impact: number; score: number; level: RiskLevel; mitigation: string }[];
  totalScore: number;
  avgScore: number;
  maxScore: number;
  riskCounts: Record<RiskLevel, number>;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 4) return 'low';
  if (score <= 9) return 'medium';
  if (score <= 15) return 'high';
  return 'critical';
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: 'Gering',
  medium: 'Mittel',
  high: 'Hoch',
  critical: 'Kritisch',
};

export const RISK_LEVEL_COLORS: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

export const PROBABILITY_LABELS: Record<number, string> = {
  1: 'Sehr unwahrscheinlich',
  2: 'Unwahrscheinlich',
  3: 'Moeglich',
  4: 'Wahrscheinlich',
  5: 'Sehr wahrscheinlich',
};

export const IMPACT_LABELS: Record<number, string> = {
  1: 'Vernachlaessigbar',
  2: 'Gering',
  3: 'Mittel',
  4: 'Hoch',
  5: 'Sehr hoch',
};

export const PRESET_RISKS = [
  'Vendor Lock-in',
  'Technologische Veralterung',
  'Datenverlust / Datenschutz',
  'Implementierungsverzoegerung',
  'Kostenueberschreitung',
  'Mangelnde Integration',
  'Unzureichender Support',
  'Fachkraeftemangel',
  'Abhaengigkeit von Schluesselressourcen',
  'Aenderung der Lizenzpolitik',
  'Skalierungsprobleme',
  'Compliance-Risiken',
];
