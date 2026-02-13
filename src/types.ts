export interface Criterion {
  id: string;
  name: string;
  description: string;
}

export interface Vendor {
  id: string;
  name: string;
  scores: Record<string, number>; // criterionId -> score (0, 1, 4, 6, 10)
  notes: Record<string, string>; // criterionId -> note text
}

export interface Project {
  name: string;
  criteria: Criterion[];
  pairwise: Record<string, number>; // "id1:id2" -> 0|1|2
  vendors: Vendor[];
}

export interface VendorScore {
  vendorId: string;
  vendorName: string;
  rawScore: number;
  weightedScore: number;
}

export interface WeightedResult {
  criterionId: string;
  criterionName: string;
  absoluteWeight: number;
  relativeWeight: number;
  vendorScores: VendorScore[];
}

export const SCORE_LABELS: Record<number, string> = {
  10: 'Exzellent',
  6: 'Gut',
  4: 'Ausreichend',
  1: 'Unzureichend',
  0: 'Nicht vorhanden',
};

export const PAIRWISE_LABELS: Record<number, string> = {
  0: 'Zeile wichtiger',
  1: 'Gleich wichtig',
  2: 'Spalte wichtiger',
};
