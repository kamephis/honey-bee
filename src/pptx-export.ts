/**
 * PowerPoint Export – generates a professional .pptx presentation
 * containing the complete analysis results (NWA, TCO, Risk, Dashboard).
 *
 * Uses pptxgenjs for client-side generation.
 */

import PptxGenJS from 'pptxgenjs';
import { load as loadStored } from './storage';
import type { StoredProject } from './storage';
import { getRiskLevel, RISK_LEVEL_LABELS } from './risk-types';
import type { RiskLevel } from './risk-types';

// --- Color palette matching the app ---
const AMBER = '6b5900';
const AMBER_BG = 'FFF8E1';
const AMBER_500 = 'F59E0B';
const BLUE = '3B82F6';
const GREEN = '10B981';
const RED = 'EF4444';
const ORANGE = 'F97316';
const GRAY_700 = '374151';
const GRAY_600 = '4B5563';
const GRAY_50 = 'F9FAFB';
const WHITE = 'FFFFFF';

const VENDOR_COLORS = [BLUE, ORANGE, GREEN, '8B5CF6', 'EC4899', AMBER_500, '14B8A6', RED];

// --- Helpers ---

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatDate(): string {
  return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

interface SlideLayoutOpts {
  title: string;
  subtitle?: string;
}

function addSlideWithLayout(pptx: PptxGenJS, opts: SlideLayoutOpts): PptxGenJS.Slide {
  const slide = pptx.addSlide();

  // Top accent bar
  slide.addShape('rect' as PptxGenJS.ShapeType, { x: 0, y: 0, w: '100%', h: 0.06, fill: { color: AMBER_500 } });

  // Title
  slide.addText(opts.title, {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 20, bold: true, color: GRAY_700,
    fontFace: 'Arial',
  });

  if (opts.subtitle) {
    slide.addText(opts.subtitle, {
      x: 0.5, y: 0.65, w: 9, h: 0.3,
      fontSize: 11, color: GRAY_600,
      fontFace: 'Arial',
    });
  }

  // Footer line
  slide.addShape('rect' as PptxGenJS.ShapeType, { x: 0.5, y: 7.0, w: 9, h: 0.01, fill: { color: 'E5E7EB' } });
  slide.addText(`honey-bee  |  ${formatDate()}`, {
    x: 0.5, y: 7.05, w: 9, h: 0.3,
    fontSize: 8, color: '9CA3AF',
    fontFace: 'Arial',
  });

  return slide;
}

// --- NWA Calculations (replicated from state.ts to avoid runtime coupling) ---

interface NwaWeights {
  absoluteWeights: Record<string, number>;
  relativeWeights: Record<string, number>;
}

function calcNwaWeights(stored: StoredProject): NwaWeights {
  const criteria = stored.nwa.criteria;
  const absoluteWeights: Record<string, number> = {};
  let totalAbsolute = 0;

  for (const c of criteria) {
    let sum = 0;
    for (const other of criteria) {
      if (c.id === other.id) continue;
      const key1 = `${c.id}:${other.id}`;
      const key2 = `${other.id}:${c.id}`;
      if (key1 in stored.nwa.pairwise) sum += 2 - stored.nwa.pairwise[key1];
      else if (key2 in stored.nwa.pairwise) sum += stored.nwa.pairwise[key2];
      else sum += 1;
    }
    absoluteWeights[c.id] = sum;
    totalAbsolute += sum;
  }

  const relativeWeights: Record<string, number> = {};
  for (const c of criteria) {
    relativeWeights[c.id] = totalAbsolute > 0 ? absoluteWeights[c.id] / totalAbsolute : 0;
  }
  return { absoluteWeights, relativeWeights };
}

interface NwaVendorTotal { vendorId: string; vendorName: string; total: number }

function calcNwaVendorTotals(stored: StoredProject): NwaVendorTotal[] {
  const { relativeWeights } = calcNwaWeights(stored);
  return stored.vendors.map((v) => {
    const scores = stored.nwa.scores[v.id] || {};
    let total = 0;
    for (const c of stored.nwa.criteria) {
      total += (scores[c.id] ?? 0) * (relativeWeights[c.id] ?? 0);
    }
    return { vendorId: v.id, vendorName: v.name, total };
  });
}

// --- TCO Calculations ---

interface TcoResult {
  optionId: string; optionName: string;
  totalInitial: number; totalAnnual: number; tco: number; npv: number;
  yearlyCosts: { year: number; total: number; cumulative: number; discounted: number; cumulativeDiscounted: number }[];
}

function calcTcoResults(stored: StoredProject): TcoResult[] {
  const rate = stored.tco.discountRate / 100;
  return stored.vendors.map((v) => {
    const costs = stored.tco.costs[v.id];
    const totalInitial = costs ? costs.initialCosts.reduce((s, c) => s + c.amount, 0) : 0;
    const totalAnnual = costs ? costs.annualCosts.reduce((s, c) => s + c.amount, 0) : 0;

    const yearlyCosts: TcoResult['yearlyCosts'] = [];
    let cumulative = 0;
    let cumulativeDiscounted = 0;
    for (let y = 0; y <= stored.tco.years; y++) {
      const initial = y === 0 ? totalInitial : 0;
      const annual = y === 0 ? 0 : totalAnnual;
      const total = initial + annual;
      cumulative += total;
      const discountFactor = Math.pow(1 + rate, y);
      const discounted = total / discountFactor;
      cumulativeDiscounted += discounted;
      yearlyCosts.push({ year: y, total, cumulative, discounted, cumulativeDiscounted });
    }
    return { optionId: v.id, optionName: v.name, totalInitial, totalAnnual, tco: cumulative, npv: cumulativeDiscounted, yearlyCosts };
  }).filter((r) => r.totalInitial > 0 || r.totalAnnual > 0);
}

interface RoiResult {
  optionName: string; tco: number; totalBenefit: number; netBenefit: number;
  roiPercent: number; breakEvenYear: number | null;
}

function calcRoi(stored: StoredProject): RoiResult[] {
  const results = calcTcoResults(stored);
  const annualBenefit = stored.tco.benefits.reduce((s, b) => s + b.annualAmount, 0);
  const totalBenefit = annualBenefit * stored.tco.years;

  return results.map((r) => {
    const netBenefit = totalBenefit - r.tco;
    const roiPercent = r.tco > 0 ? (netBenefit / r.tco) * 100 : 0;
    let breakEvenYear: number | null = null;
    for (const yc of r.yearlyCosts) {
      if (annualBenefit * yc.year >= yc.cumulative && yc.year > 0) {
        breakEvenYear = yc.year;
        break;
      }
    }
    return { optionName: r.optionName, tco: r.tco, totalBenefit, netBenefit, roiPercent, breakEvenYear };
  });
}

// --- Risk Calculations ---

interface VendorRiskSummary {
  vendorName: string;
  riskCount: number;
  avgScore: number;
  maxScore: number;
  totalScore: number;
  counts: Record<RiskLevel, number>;
  risks: { name: string; probability: number; impact: number; score: number; level: RiskLevel; mitigation: string }[];
}

function calcRiskSummaries(stored: StoredProject): VendorRiskSummary[] {
  return stored.vendors
    .filter((v) => stored.risk.vendors[v.id] && stored.risk.vendors[v.id].length > 0)
    .map((v) => {
      const items = stored.risk.vendors[v.id];
      const risks = items.map((r) => {
        const score = r.probability * r.impact;
        return { name: r.name, probability: r.probability, impact: r.impact, score, level: getRiskLevel(score), mitigation: r.mitigation };
      });
      const totalScore = risks.reduce((s, r) => s + r.score, 0);
      const counts = { low: 0, medium: 0, high: 0, critical: 0 } as Record<RiskLevel, number>;
      for (const r of risks) counts[r.level]++;
      return {
        vendorName: v.name,
        riskCount: risks.length,
        avgScore: risks.length > 0 ? totalScore / risks.length : 0,
        maxScore: risks.length > 0 ? Math.max(...risks.map((r) => r.score)) : 0,
        totalScore,
        counts,
        risks,
      };
    });
}

// --- Dashboard Composite ---

interface CompositeResult {
  name: string; compositeScore: number; compositeRank: number;
  nwaScore: number | null; nwaRank: number | null;
  tco: number | null; tcoRank: number | null;
  riskAvg: number | null; riskRank: number | null;
}

function calcComposite(stored: StoredProject, wNwa: number, wTco: number, wRisk: number): CompositeResult[] {
  const vendors = stored.vendors;
  if (vendors.length === 0) return [];

  const { relativeWeights } = calcNwaWeights(stored);
  const nwaScores: Record<string, number> = {};
  if (stored.nwa.criteria.length > 0) {
    for (const v of vendors) {
      const scores = stored.nwa.scores[v.id] || {};
      let total = 0;
      for (const c of stored.nwa.criteria) total += (scores[c.id] ?? 0) * (relativeWeights[c.id] ?? 0);
      nwaScores[v.id] = total;
    }
  }

  const tcoValues: Record<string, number> = {};
  for (const v of vendors) {
    const costs = stored.tco.costs[v.id];
    if (!costs) continue;
    const ti = (costs.initialCosts || []).reduce((s, c) => s + c.amount, 0);
    const ta = (costs.annualCosts || []).reduce((s, c) => s + c.amount, 0);
    const tco = ti + ta * stored.tco.years;
    if (tco > 0) tcoValues[v.id] = tco;
  }

  const riskAvgs: Record<string, number> = {};
  for (const v of vendors) {
    const risks = stored.risk.vendors[v.id];
    if (!risks || risks.length === 0) continue;
    riskAvgs[v.id] = risks.reduce((s, r) => s + r.probability * r.impact, 0) / risks.length;
  }

  const list = vendors.map((v) => ({
    name: v.name,
    nwaScore: v.id in nwaScores ? nwaScores[v.id] : null,
    nwaRank: null as number | null,
    tco: v.id in tcoValues ? tcoValues[v.id] : null,
    tcoRank: null as number | null,
    riskAvg: v.id in riskAvgs ? riskAvgs[v.id] : null,
    riskRank: null as number | null,
    compositeScore: 0,
    compositeRank: 0,
  }));

  const nwaRanked = list.filter((v) => v.nwaScore !== null).sort((a, b) => b.nwaScore! - a.nwaScore!);
  nwaRanked.forEach((v, i) => v.nwaRank = i + 1);
  const tcoRanked = list.filter((v) => v.tco !== null).sort((a, b) => a.tco! - b.tco!);
  tcoRanked.forEach((v, i) => v.tcoRank = i + 1);
  const riskRanked = list.filter((v) => v.riskAvg !== null).sort((a, b) => a.riskAvg! - b.riskAvg!);
  riskRanked.forEach((v, i) => v.riskRank = i + 1);

  for (const v of list) {
    let score = 0;
    let applied = 0;
    if (v.nwaRank !== null && nwaRanked.length > 0) {
      const norm = nwaRanked.length > 1 ? ((nwaRanked.length - v.nwaRank) / (nwaRanked.length - 1)) * 100 : 100;
      score += norm * wNwa; applied += wNwa;
    }
    if (v.tcoRank !== null && tcoRanked.length > 0) {
      const norm = tcoRanked.length > 1 ? ((tcoRanked.length - v.tcoRank) / (tcoRanked.length - 1)) * 100 : 100;
      score += norm * wTco; applied += wTco;
    }
    if (v.riskRank !== null && riskRanked.length > 0) {
      const norm = riskRanked.length > 1 ? ((riskRanked.length - v.riskRank) / (riskRanked.length - 1)) * 100 : 100;
      score += norm * wRisk; applied += wRisk;
    }
    v.compositeScore = applied > 0 ? score / applied : 0;
  }

  list.sort((a, b) => b.compositeScore - a.compositeScore);
  list.forEach((v, i) => v.compositeRank = i + 1);
  return list;
}

// --- Risk level color for pptx (hex without #) ---
function riskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'low': return '16A34A';
    case 'medium': return 'CA8A04';
    case 'high': return 'EA580C';
    case 'critical': return 'DC2626';
  }
}

function riskLevelBg(level: RiskLevel): string {
  switch (level) {
    case 'low': return 'DCFCE7';
    case 'medium': return 'FEF9C3';
    case 'high': return 'FFEDD5';
    case 'critical': return 'FEE2E2';
  }
}

// ========================================================
// SLIDE BUILDERS
// ========================================================

function addTitleSlide(pptx: PptxGenJS, stored: StoredProject): void {
  const slide = pptx.addSlide();

  // Full amber background
  slide.addShape('rect' as PptxGenJS.ShapeType, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: AMBER_500 } });

  // White overlay box
  slide.addShape('rect' as PptxGenJS.ShapeType, {
    x: 0.8, y: 1.5, w: 8.4, h: 4.5,
    fill: { color: WHITE },
    rectRadius: 0.15,
    shadow: { type: 'outer', blur: 10, opacity: 0.2, offset: 4, angle: 270, color: '000000' },
  });

  slide.addText('honey-bee', {
    x: 1.2, y: 1.8, w: 7.6, h: 0.6,
    fontSize: 16, color: AMBER_500, fontFace: 'Arial', bold: true,
    charSpacing: 3,
  });

  slide.addText(stored.name, {
    x: 1.2, y: 2.5, w: 7.6, h: 1.0,
    fontSize: 32, color: GRAY_700, fontFace: 'Arial', bold: true,
  });

  slide.addText('Analyseergebnisse', {
    x: 1.2, y: 3.4, w: 7.6, h: 0.5,
    fontSize: 18, color: GRAY_600, fontFace: 'Arial',
  });

  slide.addShape('rect' as PptxGenJS.ShapeType, { x: 1.2, y: 4.2, w: 2, h: 0.04, fill: { color: AMBER_500 } });

  slide.addText(formatDate(), {
    x: 1.2, y: 4.5, w: 7.6, h: 0.4,
    fontSize: 12, color: GRAY_600, fontFace: 'Arial',
  });

  // Vendor count info
  const vendorCount = stored.vendors.length;
  const criteriaCount = stored.nwa.criteria.length;
  slide.addText(`${vendorCount} Anbieter  ·  ${criteriaCount} Kriterien`, {
    x: 1.2, y: 5.0, w: 7.6, h: 0.4,
    fontSize: 11, color: '9CA3AF', fontFace: 'Arial',
  });
}

function addNwaOverviewSlide(pptx: PptxGenJS, stored: StoredProject): void {
  const totals = calcNwaVendorTotals(stored);
  if (totals.length === 0) return;

  const sorted = [...totals].sort((a, b) => b.total - a.total);
  const slide = addSlideWithLayout(pptx, {
    title: 'Nutzwertanalyse – Ranking',
    subtitle: `${stored.nwa.criteria.length} Kriterien  ·  ${sorted.length} Anbieter bewertet`,
  });

  // Recommendation box
  if (sorted[0].total > 0) {
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x: 0.5, y: 1.1, w: 9, h: 0.6,
      fill: { color: AMBER_BG },
      rectRadius: 0.08,
    });
    slide.addText(`Empfehlung: ${sorted[0].vendorName} mit ${sorted[0].total.toFixed(2)} Punkten`, {
      x: 0.7, y: 1.1, w: 8.6, h: 0.6,
      fontSize: 13, color: AMBER, fontFace: 'Arial', bold: true,
      valign: 'middle',
    });
  }

  // Ranking bars
  const maxScore = Math.max(...sorted.map((v) => v.total), 1);
  const barStartY = 2.0;
  const barHeight = 0.45;
  const barGap = 0.15;
  const maxBars = Math.min(sorted.length, 8);

  for (let i = 0; i < maxBars; i++) {
    const v = sorted[i];
    const y = barStartY + i * (barHeight + barGap);
    const barWidth = Math.max((v.total / maxScore) * 6.5, 0.1);

    // Rank number
    slide.addText(`#${i + 1}`, {
      x: 0.5, y, w: 0.5, h: barHeight,
      fontSize: 12, bold: true, color: i === 0 ? AMBER_500 : GRAY_600, fontFace: 'Arial',
      valign: 'middle',
    });

    // Vendor name
    slide.addText(v.vendorName, {
      x: 1.0, y, w: 2.0, h: barHeight,
      fontSize: 11, color: GRAY_700, fontFace: 'Arial',
      valign: 'middle',
    });

    // Bar
    const color = VENDOR_COLORS[i % VENDOR_COLORS.length];
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x: 3.0, y: y + 0.08, w: barWidth, h: barHeight - 0.16,
      fill: { color },
      rectRadius: 0.04,
    });

    // Score label
    slide.addText(v.total.toFixed(2), {
      x: 3.0 + barWidth + 0.15, y, w: 1.0, h: barHeight,
      fontSize: 11, bold: true, color: GRAY_700, fontFace: 'Arial',
      valign: 'middle',
    });
  }
}

function addNwaDetailSlide(pptx: PptxGenJS, stored: StoredProject): void {
  const { relativeWeights } = calcNwaWeights(stored);
  const criteria = stored.nwa.criteria;
  const vendors = stored.vendors;
  if (criteria.length === 0 || vendors.length === 0) return;

  // Sort criteria by weight
  const sortedCriteria = [...criteria].sort((a, b) => (relativeWeights[b.id] ?? 0) - (relativeWeights[a.id] ?? 0));

  const slide = addSlideWithLayout(pptx, {
    title: 'Nutzwertanalyse – Detailvergleich',
    subtitle: 'Gewichtete Bewertung aller Kriterien pro Anbieter',
  });

  // Build table
  type CellDef = { text: string; options?: Record<string, unknown> };
  const headerRow: CellDef[] = [
    { text: 'Kriterium', options: { bold: true, fill: { color: GRAY_50 }, color: GRAY_700, fontSize: 8, fontFace: 'Arial', align: 'left' } },
    { text: 'Gewicht', options: { bold: true, fill: { color: GRAY_50 }, color: GRAY_700, fontSize: 8, fontFace: 'Arial', align: 'center' } },
  ];
  for (const v of vendors) {
    headerRow.push({ text: v.name, options: { bold: true, fill: { color: GRAY_50 }, color: GRAY_700, fontSize: 8, fontFace: 'Arial', align: 'center' } });
  }

  const rows: CellDef[][] = [headerRow];
  const cellOpts = { fontSize: 8, fontFace: 'Arial', color: GRAY_600 };

  for (const c of sortedCriteria) {
    const row: CellDef[] = [
      { text: c.name, options: { ...cellOpts, align: 'left' } },
      { text: pct(relativeWeights[c.id] ?? 0), options: { ...cellOpts, align: 'center', bold: true } },
    ];
    for (const v of vendors) {
      const scores = stored.nwa.scores[v.id] || {};
      const raw = scores[c.id] ?? 0;
      const weighted = raw * (relativeWeights[c.id] ?? 0);
      row.push({ text: `${raw} (${weighted.toFixed(2)})`, options: { ...cellOpts, align: 'center' } });
    }
    rows.push(row);
  }

  // Total row
  const totals = calcNwaVendorTotals(stored);
  const totalRow: CellDef[] = [
    { text: 'Gesamt', options: { bold: true, fill: { color: AMBER_BG }, color: AMBER, fontSize: 8, fontFace: 'Arial', align: 'left' } },
    { text: '100%', options: { bold: true, fill: { color: AMBER_BG }, color: AMBER, fontSize: 8, fontFace: 'Arial', align: 'center' } },
  ];
  for (const v of vendors) {
    const t = totals.find((t) => t.vendorId === v.id);
    totalRow.push({ text: (t?.total ?? 0).toFixed(2), options: { bold: true, fill: { color: AMBER_BG }, color: AMBER, fontSize: 8, fontFace: 'Arial', align: 'center' } });
  }
  rows.push(totalRow);

  const colW = [2.2, 0.8, ...vendors.map(() => Math.min(1.5, 6.0 / vendors.length))];

  slide.addTable(rows as PptxGenJS.TableRow[], {
    x: 0.5, y: 1.1, w: 9,
    colW,
    border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
    rowH: 0.35,
    autoPage: true,
    autoPageRepeatHeader: true,
  });
}

function addTcoOverviewSlide(pptx: PptxGenJS, stored: StoredProject): void {
  const results = calcTcoResults(stored);
  if (results.length === 0) return;

  const sorted = [...results].sort((a, b) => a.tco - b.tco);
  const slide = addSlideWithLayout(pptx, {
    title: 'TCO-Analyse – Kostenvergleich',
    subtitle: `Betrachtungszeitraum: ${stored.tco.years} Jahre  ·  Diskontierungssatz: ${stored.tco.discountRate}%`,
  });

  // Recommendation
  slide.addShape('rect' as PptxGenJS.ShapeType, {
    x: 0.5, y: 1.1, w: 9, h: 0.6,
    fill: { color: AMBER_BG }, rectRadius: 0.08,
  });
  slide.addText(`Kostenguenstigste Option: ${sorted[0].optionName} mit TCO ${formatCurrency(sorted[0].tco)}`, {
    x: 0.7, y: 1.1, w: 8.6, h: 0.6,
    fontSize: 13, color: AMBER, fontFace: 'Arial', bold: true, valign: 'middle',
  });

  // Table
  type CellDef = { text: string; options?: Record<string, unknown> };
  const hOpts = { bold: true, fill: { color: GRAY_50 }, color: GRAY_700, fontSize: 9, fontFace: 'Arial', align: 'center' as const };
  const cOpts = { fontSize: 9, fontFace: 'Arial', color: GRAY_600, align: 'center' as const };

  const headerRow: CellDef[] = [
    { text: 'Rang', options: hOpts },
    { text: 'Option', options: { ...hOpts, align: 'left' } },
    { text: 'Einmalig', options: hOpts },
    { text: 'Jaehrlich', options: hOpts },
    { text: 'TCO', options: hOpts },
    { text: 'NPV', options: hOpts },
  ];

  const rows: CellDef[][] = [headerRow];
  sorted.forEach((r, i) => {
    const isBest = i === 0;
    const rowOpts = isBest ? { ...cOpts, bold: true, fill: { color: AMBER_BG }, color: AMBER } : cOpts;
    rows.push([
      { text: `#${i + 1}`, options: rowOpts },
      { text: r.optionName, options: { ...rowOpts, align: 'left' } },
      { text: formatCurrency(r.totalInitial), options: rowOpts },
      { text: formatCurrency(r.totalAnnual), options: rowOpts },
      { text: formatCurrency(r.tco), options: { ...rowOpts, bold: true } },
      { text: formatCurrency(r.npv), options: rowOpts },
    ]);
  });

  slide.addTable(rows as PptxGenJS.TableRow[], {
    x: 0.5, y: 2.0, w: 9,
    colW: [0.6, 2.4, 1.5, 1.5, 1.5, 1.5],
    border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
    rowH: 0.4,
  });

  // Cost bars visual comparison
  const maxTco = Math.max(...sorted.map((r) => r.tco), 1);
  const barsY = 2.0 + (sorted.length + 1) * 0.4 + 0.5;
  if (barsY < 6.0) {
    slide.addText('Kostenvergleich', {
      x: 0.5, y: barsY, w: 9, h: 0.35,
      fontSize: 11, bold: true, color: GRAY_700, fontFace: 'Arial',
    });

    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const y = barsY + 0.4 + i * 0.55;
      if (y > 6.5) break;

      const initW = (r.totalInitial / maxTco) * 6.0;
      const annualW = ((r.totalAnnual * stored.tco.years) / maxTco) * 6.0;

      slide.addText(r.optionName, {
        x: 0.5, y, w: 2.5, h: 0.4,
        fontSize: 9, color: GRAY_700, fontFace: 'Arial', valign: 'middle',
      });

      if (initW > 0.01) {
        slide.addShape('rect' as PptxGenJS.ShapeType, {
          x: 3.0, y: y + 0.08, w: Math.max(initW, 0.05), h: 0.24,
          fill: { color: AMBER_500 }, rectRadius: 0.03,
        });
      }
      if (annualW > 0.01) {
        slide.addShape('rect' as PptxGenJS.ShapeType, {
          x: 3.0 + initW, y: y + 0.08, w: Math.max(annualW, 0.05), h: 0.24,
          fill: { color: BLUE }, rectRadius: 0.03,
        });
      }
    }
  }
}

function addTcoRoiSlide(pptx: PptxGenJS, stored: StoredProject): void {
  const roiResults = calcRoi(stored);
  const totalBenefit = stored.tco.benefits.reduce((s, b) => s + b.annualAmount, 0);
  if (roiResults.length === 0 || totalBenefit === 0) return;

  const slide = addSlideWithLayout(pptx, {
    title: 'TCO-Analyse – ROI & Break-Even',
    subtitle: `Jaehrlicher Nutzen: ${formatCurrency(totalBenefit)}  ·  Gesamtnutzen (${stored.tco.years} Jahre): ${formatCurrency(totalBenefit * stored.tco.years)}`,
  });

  type CellDef = { text: string; options?: Record<string, unknown> };
  const hOpts = { bold: true, fill: { color: GRAY_50 }, color: GRAY_700, fontSize: 9, fontFace: 'Arial', align: 'center' as const };
  const cOpts = { fontSize: 9, fontFace: 'Arial', color: GRAY_600, align: 'center' as const };

  const headerRow: CellDef[] = [
    { text: 'Option', options: { ...hOpts, align: 'left' } },
    { text: 'TCO', options: hOpts },
    { text: 'Nutzen', options: hOpts },
    { text: 'Netto', options: hOpts },
    { text: 'ROI', options: hOpts },
    { text: 'Break-Even', options: hOpts },
  ];

  const rows: CellDef[][] = [headerRow];
  for (const r of roiResults) {
    const isPositive = r.netBenefit >= 0;
    const netColor = isPositive ? '16A34A' : 'DC2626';
    rows.push([
      { text: r.optionName, options: { ...cOpts, align: 'left', bold: true } },
      { text: formatCurrency(r.tco), options: cOpts },
      { text: formatCurrency(r.totalBenefit), options: cOpts },
      { text: formatCurrency(r.netBenefit), options: { ...cOpts, color: netColor, bold: true } },
      { text: `${r.roiPercent.toFixed(1)}%`, options: { ...cOpts, color: netColor, bold: true } },
      { text: r.breakEvenYear !== null ? `Jahr ${r.breakEvenYear}` : 'Nicht erreicht', options: cOpts },
    ]);
  }

  slide.addTable(rows as PptxGenJS.TableRow[], {
    x: 0.5, y: 1.1, w: 9,
    colW: [2.0, 1.4, 1.4, 1.4, 1.0, 1.8],
    border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
    rowH: 0.4,
  });

  // Benefits breakdown if present
  if (stored.tco.benefits.length > 0) {
    const benefitY = 1.1 + (roiResults.length + 1) * 0.4 + 0.6;
    if (benefitY < 5.5) {
      slide.addText('Nutzen-Positionen', {
        x: 0.5, y: benefitY, w: 9, h: 0.35,
        fontSize: 11, bold: true, color: GRAY_700, fontFace: 'Arial',
      });

      const bRows: CellDef[][] = [
        [
          { text: 'Position', options: { ...hOpts, align: 'left' } },
          { text: 'Jaehrlich', options: hOpts },
        ],
      ];
      for (const b of stored.tco.benefits) {
        bRows.push([
          { text: b.name, options: { ...cOpts, align: 'left' } },
          { text: formatCurrency(b.annualAmount), options: cOpts },
        ]);
      }
      bRows.push([
        { text: 'Gesamt', options: { bold: true, fill: { color: AMBER_BG }, color: AMBER, fontSize: 9, fontFace: 'Arial', align: 'left' } },
        { text: formatCurrency(totalBenefit), options: { bold: true, fill: { color: AMBER_BG }, color: AMBER, fontSize: 9, fontFace: 'Arial', align: 'center' } },
      ]);

      slide.addTable(bRows as PptxGenJS.TableRow[], {
        x: 0.5, y: benefitY + 0.4, w: 5,
        colW: [3.2, 1.8],
        border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
        rowH: 0.35,
      });
    }
  }
}

function addTcoCostDetailSlide(pptx: PptxGenJS, stored: StoredProject): void {
  const results = calcTcoResults(stored);
  if (results.length === 0) return;

  // One slide per option with cost breakdown
  for (const r of results) {
    const costs = stored.tco.costs[r.optionId];
    if (!costs) continue;

    const hasInitial = costs.initialCosts.length > 0;
    const hasAnnual = costs.annualCosts.length > 0;
    if (!hasInitial && !hasAnnual) continue;

    const slide = addSlideWithLayout(pptx, {
      title: `Kostendetails – ${r.optionName}`,
      subtitle: `TCO: ${formatCurrency(r.tco)}  ·  NPV: ${formatCurrency(r.npv)}`,
    });

    type CellDef = { text: string; options?: Record<string, unknown> };
    const hOpts = { bold: true, fill: { color: GRAY_50 }, color: GRAY_700, fontSize: 9, fontFace: 'Arial' };
    const cOpts = { fontSize: 9, fontFace: 'Arial', color: GRAY_600 };

    let currentY = 1.1;

    if (hasInitial) {
      slide.addText('Einmalige Kosten', {
        x: 0.5, y: currentY, w: 4, h: 0.35,
        fontSize: 11, bold: true, color: GRAY_700, fontFace: 'Arial',
      });
      currentY += 0.4;

      const initRows: CellDef[][] = [
        [{ text: 'Position', options: { ...hOpts, align: 'left' } }, { text: 'Betrag', options: { ...hOpts, align: 'center' } }],
      ];
      for (const c of costs.initialCosts) {
        initRows.push([
          { text: c.name, options: { ...cOpts, align: 'left' } },
          { text: formatCurrency(c.amount), options: { ...cOpts, align: 'center' } },
        ]);
      }
      initRows.push([
        { text: 'Gesamt', options: { bold: true, fill: { color: AMBER_BG }, color: AMBER, fontSize: 9, fontFace: 'Arial', align: 'left' } },
        { text: formatCurrency(r.totalInitial), options: { bold: true, fill: { color: AMBER_BG }, color: AMBER, fontSize: 9, fontFace: 'Arial', align: 'center' } },
      ]);

      slide.addTable(initRows as PptxGenJS.TableRow[], {
        x: 0.5, y: currentY, w: 4.2,
        colW: [2.8, 1.4],
        border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
        rowH: 0.32,
      });
      currentY += (initRows.length) * 0.32 + 0.4;
    }

    if (hasAnnual && currentY < 5.5) {
      slide.addText('Laufende Kosten (jaehrlich)', {
        x: 0.5, y: currentY, w: 4, h: 0.35,
        fontSize: 11, bold: true, color: GRAY_700, fontFace: 'Arial',
      });
      currentY += 0.4;

      const annRows: CellDef[][] = [
        [{ text: 'Position', options: { ...hOpts, align: 'left' } }, { text: 'Betrag', options: { ...hOpts, align: 'center' } }],
      ];
      for (const c of costs.annualCosts) {
        annRows.push([
          { text: c.name, options: { ...cOpts, align: 'left' } },
          { text: formatCurrency(c.amount), options: { ...cOpts, align: 'center' } },
        ]);
      }
      annRows.push([
        { text: 'Gesamt', options: { bold: true, fill: { color: AMBER_BG }, color: AMBER, fontSize: 9, fontFace: 'Arial', align: 'left' } },
        { text: formatCurrency(r.totalAnnual), options: { bold: true, fill: { color: AMBER_BG }, color: AMBER, fontSize: 9, fontFace: 'Arial', align: 'center' } },
      ]);

      slide.addTable(annRows as PptxGenJS.TableRow[], {
        x: 0.5, y: currentY, w: 4.2,
        colW: [2.8, 1.4],
        border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
        rowH: 0.32,
      });
    }

    // Yearly development on the right side
    slide.addText('Jahresentwicklung', {
      x: 5.2, y: 1.1, w: 4, h: 0.35,
      fontSize: 11, bold: true, color: GRAY_700, fontFace: 'Arial',
    });

    const yearRows: CellDef[][] = [
      [
        { text: 'Jahr', options: { ...hOpts, align: 'center' } },
        { text: 'Kosten', options: { ...hOpts, align: 'center' } },
        { text: 'Kumuliert', options: { ...hOpts, align: 'center' } },
      ],
    ];
    for (const yc of r.yearlyCosts) {
      yearRows.push([
        { text: `${yc.year}`, options: { ...cOpts, align: 'center' } },
        { text: formatCurrency(yc.total), options: { ...cOpts, align: 'center' } },
        { text: formatCurrency(yc.cumulative), options: { ...cOpts, align: 'center' } },
      ]);
    }

    slide.addTable(yearRows as PptxGenJS.TableRow[], {
      x: 5.2, y: 1.5, w: 4.3,
      colW: [0.8, 1.5, 1.5],
      border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
      rowH: 0.3,
      autoPage: true,
    });
  }
}

function addRiskOverviewSlide(pptx: PptxGenJS, stored: StoredProject): void {
  const summaries = calcRiskSummaries(stored);
  if (summaries.length === 0) return;

  const slide = addSlideWithLayout(pptx, {
    title: 'Risikoanalyse – Uebersicht',
    subtitle: `${summaries.length} Anbieter mit insgesamt ${summaries.reduce((s, v) => s + v.riskCount, 0)} identifizierten Risiken`,
  });

  type CellDef = { text: string; options?: Record<string, unknown> };
  const hOpts = { bold: true, fill: { color: GRAY_50 }, color: GRAY_700, fontSize: 9, fontFace: 'Arial', align: 'center' as const };
  const cOpts = { fontSize: 9, fontFace: 'Arial', color: GRAY_600, align: 'center' as const };

  const headerRow: CellDef[] = [
    { text: 'Anbieter', options: { ...hOpts, align: 'left' } },
    { text: 'Risiken', options: hOpts },
    { text: 'Ø Score', options: hOpts },
    { text: 'Max', options: hOpts },
    { text: 'Gering', options: hOpts },
    { text: 'Mittel', options: hOpts },
    { text: 'Hoch', options: hOpts },
    { text: 'Kritisch', options: hOpts },
  ];

  const sorted = [...summaries].sort((a, b) => a.avgScore - b.avgScore);
  const rows: CellDef[][] = [headerRow];
  for (const v of sorted) {
    rows.push([
      { text: v.vendorName, options: { ...cOpts, align: 'left', bold: true } },
      { text: `${v.riskCount}`, options: cOpts },
      { text: v.avgScore.toFixed(1), options: cOpts },
      { text: `${v.maxScore}`, options: cOpts },
      { text: `${v.counts.low}`, options: { ...cOpts, color: '16A34A' } },
      { text: `${v.counts.medium}`, options: { ...cOpts, color: 'CA8A04' } },
      { text: `${v.counts.high}`, options: { ...cOpts, color: 'EA580C' } },
      { text: `${v.counts.critical}`, options: { ...cOpts, color: 'DC2626' } },
    ]);
  }

  slide.addTable(rows as PptxGenJS.TableRow[], {
    x: 0.5, y: 1.1, w: 9,
    colW: [2.0, 0.8, 0.9, 0.7, 0.9, 0.9, 0.9, 0.9],
    border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
    rowH: 0.4,
  });

  // Risk bars
  const barsY = 1.1 + (sorted.length + 1) * 0.4 + 0.6;
  if (barsY < 5.5) {
    slide.addText('Durchschnittliches Risiko pro Anbieter', {
      x: 0.5, y: barsY, w: 9, h: 0.35,
      fontSize: 11, bold: true, color: GRAY_700, fontFace: 'Arial',
    });

    for (let i = 0; i < sorted.length; i++) {
      const v = sorted[i];
      const y = barsY + 0.45 + i * 0.5;
      if (y > 6.5) break;
      const barW = (v.avgScore / 25) * 6.5; // max possible risk score is 25
      const level = getRiskLevel(v.avgScore);

      slide.addText(v.vendorName, {
        x: 0.5, y, w: 2.5, h: 0.35,
        fontSize: 9, color: GRAY_700, fontFace: 'Arial', valign: 'middle',
      });
      slide.addShape('rect' as PptxGenJS.ShapeType, {
        x: 3.0, y: y + 0.06, w: Math.max(barW, 0.05), h: 0.22,
        fill: { color: riskLevelColor(level) }, rectRadius: 0.03,
      });
      slide.addText(`Ø ${v.avgScore.toFixed(1)}`, {
        x: 3.0 + barW + 0.15, y, w: 1, h: 0.35,
        fontSize: 9, color: GRAY_600, fontFace: 'Arial', valign: 'middle',
      });
    }
  }
}

function addRiskDetailSlides(pptx: PptxGenJS, stored: StoredProject): void {
  const summaries = calcRiskSummaries(stored);
  if (summaries.length === 0) return;

  for (const vendor of summaries) {
    if (vendor.risks.length === 0) continue;

    const slide = addSlideWithLayout(pptx, {
      title: `Risikodetails – ${vendor.vendorName}`,
      subtitle: `${vendor.riskCount} Risiken  ·  Ø Score: ${vendor.avgScore.toFixed(1)}  ·  Max: ${vendor.maxScore}`,
    });

    type CellDef = { text: string; options?: Record<string, unknown> };
    const hOpts = { bold: true, fill: { color: GRAY_50 }, color: GRAY_700, fontSize: 8, fontFace: 'Arial' };
    const cOpts = { fontSize: 8, fontFace: 'Arial', color: GRAY_600 };

    const headerRow: CellDef[] = [
      { text: 'Risiko', options: { ...hOpts, align: 'left' } },
      { text: 'W', options: { ...hOpts, align: 'center' } },
      { text: 'A', options: { ...hOpts, align: 'center' } },
      { text: 'Score', options: { ...hOpts, align: 'center' } },
      { text: 'Stufe', options: { ...hOpts, align: 'center' } },
      { text: 'Massnahme', options: { ...hOpts, align: 'left' } },
    ];

    const sortedRisks = [...vendor.risks].sort((a, b) => b.score - a.score);
    const rows: CellDef[][] = [headerRow];
    for (const r of sortedRisks) {
      const levelColor = riskLevelColor(r.level);
      const levelBg = riskLevelBg(r.level);
      rows.push([
        { text: r.name, options: { ...cOpts, align: 'left' } },
        { text: `${r.probability}`, options: { ...cOpts, align: 'center' } },
        { text: `${r.impact}`, options: { ...cOpts, align: 'center' } },
        { text: `${r.score}`, options: { ...cOpts, align: 'center', bold: true, color: levelColor } },
        { text: RISK_LEVEL_LABELS[r.level], options: { ...cOpts, align: 'center', fill: { color: levelBg }, color: levelColor, bold: true } },
        { text: r.mitigation || '–', options: { ...cOpts, align: 'left' } },
      ]);
    }

    slide.addTable(rows as PptxGenJS.TableRow[], {
      x: 0.5, y: 1.1, w: 9,
      colW: [2.0, 0.5, 0.5, 0.6, 0.9, 4.5],
      border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
      rowH: 0.35,
      autoPage: true,
      autoPageRepeatHeader: true,
    });
  }
}

function addRiskMatrixSlide(pptx: PptxGenJS, stored: StoredProject): void {
  const summaries = calcRiskSummaries(stored);
  if (summaries.length === 0) return;

  const slide = addSlideWithLayout(pptx, {
    title: 'Risikoanalyse – Wahrscheinlichkeit / Auswirkung',
    subtitle: 'Risikomatrix aller Anbieter',
  });

  const matrixX = 1.5;
  const matrixY = 1.3;
  const cellSize = 0.9;

  // Matrix grid 5x5
  const matrixColors: string[][] = [
    ['DCFCE7', 'DCFCE7', 'FEF9C3', 'FEF9C3', 'FFEDD5'],
    ['DCFCE7', 'FEF9C3', 'FEF9C3', 'FFEDD5', 'FFEDD5'],
    ['FEF9C3', 'FEF9C3', 'FFEDD5', 'FFEDD5', 'FEE2E2'],
    ['FEF9C3', 'FFEDD5', 'FFEDD5', 'FEE2E2', 'FEE2E2'],
    ['FFEDD5', 'FFEDD5', 'FEE2E2', 'FEE2E2', 'FEE2E2'],
  ];

  // Draw cells (probability on Y-axis top=5, impact on X-axis)
  for (let py = 0; py < 5; py++) {
    for (let ix = 0; ix < 5; ix++) {
      slide.addShape('rect' as PptxGenJS.ShapeType, {
        x: matrixX + ix * cellSize,
        y: matrixY + py * cellSize,
        w: cellSize,
        h: cellSize,
        fill: { color: matrixColors[py][ix] },
        line: { color: 'D1D5DB', width: 0.5 },
      });
    }
  }

  // Axis labels
  slide.addText('Auswirkung', {
    x: matrixX, y: matrixY + 5 * cellSize + 0.05, w: 5 * cellSize, h: 0.3,
    fontSize: 9, bold: true, color: GRAY_700, fontFace: 'Arial', align: 'center',
  });
  slide.addText('Wahrscheinlichkeit', {
    x: 0.1, y: matrixY + 1.5, w: 1.2, h: 0.3,
    fontSize: 9, bold: true, color: GRAY_700, fontFace: 'Arial', align: 'center',
    rotate: 270,
  });

  // Impact labels (bottom)
  for (let i = 0; i < 5; i++) {
    slide.addText(`${i + 1}`, {
      x: matrixX + i * cellSize, y: matrixY + 5 * cellSize + 0.3, w: cellSize, h: 0.25,
      fontSize: 8, color: GRAY_600, fontFace: 'Arial', align: 'center',
    });
  }
  // Probability labels (left)
  for (let p = 0; p < 5; p++) {
    slide.addText(`${5 - p}`, {
      x: matrixX - 0.35, y: matrixY + p * cellSize, w: 0.3, h: cellSize,
      fontSize: 8, color: GRAY_600, fontFace: 'Arial', align: 'center', valign: 'middle',
    });
  }

  // Plot risks as small dots with vendor color
  const plotted: Record<string, number> = {};
  summaries.forEach((vendor, vi) => {
    for (const r of vendor.risks) {
      const cx = matrixX + (r.impact - 1) * cellSize + cellSize / 2;
      const cy = matrixY + (5 - r.probability) * cellSize + cellSize / 2;
      const key = `${r.probability}:${r.impact}`;
      const offset = (plotted[key] || 0) * 0.12;
      plotted[key] = (plotted[key] || 0) + 1;

      slide.addShape('ellipse' as PptxGenJS.ShapeType, {
        x: cx - 0.1 + offset, y: cy - 0.1,
        w: 0.2, h: 0.2,
        fill: { color: VENDOR_COLORS[vi % VENDOR_COLORS.length] },
        line: { color: WHITE, width: 1 },
      });
    }
  });

  // Legend
  const legendY = matrixY + 0.2;
  const legendX = matrixX + 5 * cellSize + 0.5;
  slide.addText('Legende', {
    x: legendX, y: legendY, w: 2, h: 0.3,
    fontSize: 10, bold: true, color: GRAY_700, fontFace: 'Arial',
  });
  summaries.forEach((vendor, i) => {
    const y = legendY + 0.35 + i * 0.3;
    if (y > 6.5) return;
    slide.addShape('ellipse' as PptxGenJS.ShapeType, {
      x: legendX, y: y + 0.05, w: 0.15, h: 0.15,
      fill: { color: VENDOR_COLORS[i % VENDOR_COLORS.length] },
    });
    slide.addText(vendor.vendorName, {
      x: legendX + 0.25, y, w: 2, h: 0.25,
      fontSize: 8, color: GRAY_600, fontFace: 'Arial', valign: 'middle',
    });
  });

  // Risk level legend
  const rlY = legendY + 0.35 + summaries.length * 0.3 + 0.3;
  if (rlY < 6.0) {
    slide.addText('Risikostufen', {
      x: legendX, y: rlY, w: 2, h: 0.3,
      fontSize: 10, bold: true, color: GRAY_700, fontFace: 'Arial',
    });
    const levels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    levels.forEach((level, i) => {
      const y = rlY + 0.35 + i * 0.28;
      slide.addShape('rect' as PptxGenJS.ShapeType, {
        x: legendX, y: y + 0.04, w: 0.15, h: 0.15,
        fill: { color: riskLevelBg(level) },
        line: { color: riskLevelColor(level), width: 1 },
      });
      slide.addText(RISK_LEVEL_LABELS[level], {
        x: legendX + 0.25, y, w: 2, h: 0.22,
        fontSize: 8, color: riskLevelColor(level), fontFace: 'Arial', valign: 'middle',
      });
    });
  }
}

function addDashboardSlide(pptx: PptxGenJS, stored: StoredProject, wNwa: number, wTco: number, wRisk: number): void {
  const composites = calcComposite(stored, wNwa, wTco, wRisk);
  if (composites.length === 0) return;

  const total = wNwa + wTco + wRisk;
  const pNwa = total > 0 ? ((wNwa / total) * 100).toFixed(0) : '0';
  const pTco = total > 0 ? ((wTco / total) * 100).toFixed(0) : '0';
  const pRisk = total > 0 ? ((wRisk / total) * 100).toFixed(0) : '0';

  const slide = addSlideWithLayout(pptx, {
    title: 'Gesamtbewertung – Dashboard',
    subtitle: `Gewichtung: Qualitaet ${pNwa}%  ·  Kosten ${pTco}%  ·  Risiko ${pRisk}%`,
  });

  // Recommendation
  if (composites[0].compositeScore > 0) {
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x: 0.5, y: 1.1, w: 9, h: 0.6,
      fill: { color: AMBER_BG }, rectRadius: 0.08,
    });
    slide.addText(`Empfehlung: ${composites[0].name} (Score ${composites[0].compositeScore.toFixed(1)}/100)`, {
      x: 0.7, y: 1.1, w: 8.6, h: 0.6,
      fontSize: 13, color: AMBER, fontFace: 'Arial', bold: true, valign: 'middle',
    });
  }

  // Detail table
  type CellDef = { text: string; options?: Record<string, unknown> };
  const hOpts = { bold: true, fill: { color: GRAY_50 }, color: GRAY_700, fontSize: 9, fontFace: 'Arial', align: 'center' as const };
  const cOpts = { fontSize: 9, fontFace: 'Arial', color: GRAY_600, align: 'center' as const };

  const headerRow: CellDef[] = [
    { text: 'Rang', options: hOpts },
    { text: 'Anbieter', options: { ...hOpts, align: 'left' } },
    { text: 'NWA Score', options: hOpts },
    { text: 'NWA Rang', options: hOpts },
    { text: 'TCO', options: hOpts },
    { text: 'TCO Rang', options: hOpts },
    { text: 'Risiko Ø', options: hOpts },
    { text: 'Risiko Rang', options: hOpts },
    { text: 'Gesamt', options: hOpts },
  ];

  const rows: CellDef[][] = [headerRow];
  for (const v of composites) {
    const isBest = v.compositeRank === 1;
    const rowOpts = isBest ? { ...cOpts, bold: true, fill: { color: AMBER_BG }, color: AMBER } : cOpts;
    rows.push([
      { text: `#${v.compositeRank}`, options: rowOpts },
      { text: v.name, options: { ...rowOpts, align: 'left' } },
      { text: v.nwaScore !== null ? v.nwaScore.toFixed(2) : '–', options: rowOpts },
      { text: v.nwaRank !== null ? `#${v.nwaRank}` : '–', options: rowOpts },
      { text: v.tco !== null ? formatCurrency(v.tco) : '–', options: rowOpts },
      { text: v.tcoRank !== null ? `#${v.tcoRank}` : '–', options: rowOpts },
      { text: v.riskAvg !== null ? v.riskAvg.toFixed(1) : '–', options: rowOpts },
      { text: v.riskRank !== null ? `#${v.riskRank}` : '–', options: rowOpts },
      { text: v.compositeScore.toFixed(1), options: { ...rowOpts, bold: true } },
    ]);
  }

  slide.addTable(rows as PptxGenJS.TableRow[], {
    x: 0.5, y: 2.0, w: 9,
    colW: [0.55, 1.6, 0.9, 0.75, 1.2, 0.75, 0.9, 0.85, 0.7],
    border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
    rowH: 0.4,
  });

  // Composite score bars
  const barsY = 2.0 + (composites.length + 1) * 0.4 + 0.5;
  if (barsY < 5.5) {
    slide.addText('Composite Score', {
      x: 0.5, y: barsY, w: 9, h: 0.35,
      fontSize: 11, bold: true, color: GRAY_700, fontFace: 'Arial',
    });

    for (let i = 0; i < composites.length; i++) {
      const v = composites[i];
      const y = barsY + 0.4 + i * 0.5;
      if (y > 6.5) break;

      const barW = (v.compositeScore / 100) * 5.5;

      slide.addText(`#${v.compositeRank} ${v.name}`, {
        x: 0.5, y, w: 3.0, h: 0.4,
        fontSize: 9, color: GRAY_700, fontFace: 'Arial', valign: 'middle',
      });
      slide.addShape('rect' as PptxGenJS.ShapeType, {
        x: 3.5, y: y + 0.08, w: Math.max(barW, 0.05), h: 0.24,
        fill: { color: i === 0 ? AMBER_500 : VENDOR_COLORS[i % VENDOR_COLORS.length] },
        rectRadius: 0.04,
      });
      slide.addText(v.compositeScore.toFixed(1), {
        x: 3.5 + barW + 0.15, y, w: 0.8, h: 0.4,
        fontSize: 9, bold: true, color: GRAY_700, fontFace: 'Arial', valign: 'middle',
      });
    }
  }
}

// ========================================================
// PUBLIC API
// ========================================================

export interface PptxExportOptions {
  weightNwa?: number;
  weightTco?: number;
  weightRisk?: number;
}

export async function exportToPptx(opts: PptxExportOptions = {}): Promise<void> {
  const stored = loadStored();
  const wNwa = opts.weightNwa ?? 40;
  const wTco = opts.weightTco ?? 40;
  const wRisk = opts.weightRisk ?? 20;

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'honey-bee';
  pptx.title = `${stored.name} – Analyseergebnisse`;
  pptx.subject = 'Anbietervergleich';

  // 1. Title slide
  addTitleSlide(pptx, stored);

  // 2. NWA slides
  if (stored.nwa.criteria.length > 0 && stored.vendors.length > 0) {
    addNwaOverviewSlide(pptx, stored);
    addNwaDetailSlide(pptx, stored);
  }

  // 3. TCO slides
  const tcoResults = calcTcoResults(stored);
  if (tcoResults.length > 0) {
    addTcoOverviewSlide(pptx, stored);
    addTcoCostDetailSlide(pptx, stored);
    addTcoRoiSlide(pptx, stored);
  }

  // 4. Risk slides
  const riskSummaries = calcRiskSummaries(stored);
  if (riskSummaries.length > 0) {
    addRiskOverviewSlide(pptx, stored);
    addRiskMatrixSlide(pptx, stored);
    addRiskDetailSlides(pptx, stored);
  }

  // 5. Dashboard slide
  if (stored.vendors.length > 0) {
    addDashboardSlide(pptx, stored, wNwa, wTco, wRisk);
  }

  // Generate and download
  const filename = `${stored.name.toLowerCase().replace(/\s+/g, '-')}-analyse.pptx`;
  await pptx.writeFile({ fileName: filename });
}
