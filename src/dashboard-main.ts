import './style.css';
import { load as loadStored, STORAGE_KEY, exportFullProject, importFullProject } from './storage';
import type { StoredProject } from './storage';

const app = document.getElementById('app')!;

// Weights (configurable by user)
let weightNwa = 40;
let weightTco = 40;
let weightRisk = 20;

function h(tag: string, attrs: Record<string, string> = {}, ...children: (string | HTMLElement)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') el.className = v;
    else el.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else el.appendChild(child);
  }
  return el;
}

// Cross-tab sync
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) render();
});

function render(): void {
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  app.innerHTML = '';
  app.appendChild(renderHeader());
  const content = h('div', { className: 'mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 pb-16' });
  content.appendChild(renderWeightsSection());
  content.appendChild(renderRankingSection());
  content.appendChild(renderDetailSection());
  app.appendChild(content);

  requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
}

// --- Data calculations ---

interface VendorComposite {
  id: string;
  name: string;
  nwaScore: number | null;     // 0–10 scale weighted total
  nwaRank: number | null;
  tco: number | null;          // total cost of ownership
  tcoRank: number | null;
  riskAvg: number | null;      // average risk score (lower = better)
  riskRank: number | null;
  compositeScore: number;
  compositeRank: number;
}

function calculateComposite(stored: StoredProject): VendorComposite[] {
  const vendors = stored.vendors;
  if (vendors.length === 0) return [];

  // --- NWA scores ---
  const nwaScores: Record<string, number> = {};
  const criteria = stored.nwa.criteria;
  if (criteria.length > 0) {
    // Calculate relative weights
    const absoluteWeights: Record<string, number> = {};
    let totalAbsolute = 0;
    for (const c of criteria) {
      let sum = 0;
      for (const other of criteria) {
        if (c.id === other.id) continue;
        const key1 = `${c.id}:${other.id}`;
        const key2 = `${other.id}:${c.id}`;
        if (key1 in stored.nwa.pairwise) sum += stored.nwa.pairwise[key1];
        else if (key2 in stored.nwa.pairwise) sum += 2 - stored.nwa.pairwise[key2];
        else sum += 1;
      }
      absoluteWeights[c.id] = sum;
      totalAbsolute += sum;
    }
    const relativeWeights: Record<string, number> = {};
    for (const c of criteria) {
      relativeWeights[c.id] = totalAbsolute > 0 ? absoluteWeights[c.id] / totalAbsolute : 0;
    }

    for (const v of vendors) {
      const scores = stored.nwa.scores[v.id] || {};
      let total = 0;
      for (const c of criteria) {
        total += (scores[c.id] ?? 0) * relativeWeights[c.id];
      }
      nwaScores[v.id] = total;
    }
  }

  // --- TCO values ---
  const tcoValues: Record<string, number> = {};
  for (const v of vendors) {
    const costs = stored.tco.costs[v.id];
    if (!costs) continue;
    const totalInitial = (costs.initialCosts || []).reduce((s, c) => s + c.amount, 0);
    const totalAnnual = (costs.annualCosts || []).reduce((s, c) => s + c.amount, 0);
    const tco = totalInitial + totalAnnual * stored.tco.years;
    if (tco > 0) tcoValues[v.id] = tco;
  }

  // --- Risk averages ---
  const riskAvgs: Record<string, number> = {};
  for (const v of vendors) {
    const risks = stored.risk.vendors[v.id];
    if (!risks || risks.length === 0) continue;
    const totalScore = risks.reduce((s, r) => s + r.probability * r.impact, 0);
    riskAvgs[v.id] = totalScore / risks.length;
  }

  // Build vendor list
  const composites: VendorComposite[] = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    nwaScore: v.id in nwaScores ? nwaScores[v.id] : null,
    nwaRank: null,
    tco: v.id in tcoValues ? tcoValues[v.id] : null,
    tcoRank: null,
    riskAvg: v.id in riskAvgs ? riskAvgs[v.id] : null,
    riskRank: null,
    compositeScore: 0,
    compositeRank: 0,
  }));

  // Assign ranks — NWA: higher is better
  const nwaRanked = composites.filter((v) => v.nwaScore !== null).sort((a, b) => b.nwaScore! - a.nwaScore!);
  nwaRanked.forEach((v, i) => v.nwaRank = i + 1);

  // TCO: lower is better
  const tcoRanked = composites.filter((v) => v.tco !== null).sort((a, b) => a.tco! - b.tco!);
  tcoRanked.forEach((v, i) => v.tcoRank = i + 1);

  // Risk: lower avg is better
  const riskRanked = composites.filter((v) => v.riskAvg !== null).sort((a, b) => a.riskAvg! - b.riskAvg!);
  riskRanked.forEach((v, i) => v.riskRank = i + 1);

  // Composite score: normalize each dimension to 0–100, then weight
  for (const v of composites) {
    let score = 0;
    let appliedWeight = 0;

    // NWA: rank 1 = 100, rank n = 0 (or 100 if only 1)
    if (v.nwaRank !== null && nwaRanked.length > 0) {
      const normalized = nwaRanked.length > 1 ? ((nwaRanked.length - v.nwaRank) / (nwaRanked.length - 1)) * 100 : 100;
      score += normalized * weightNwa;
      appliedWeight += weightNwa;
    }

    // TCO: rank 1 (cheapest) = 100
    if (v.tcoRank !== null && tcoRanked.length > 0) {
      const normalized = tcoRanked.length > 1 ? ((tcoRanked.length - v.tcoRank) / (tcoRanked.length - 1)) * 100 : 100;
      score += normalized * weightTco;
      appliedWeight += weightTco;
    }

    // Risk: rank 1 (lowest risk) = 100
    if (v.riskRank !== null && riskRanked.length > 0) {
      const normalized = riskRanked.length > 1 ? ((riskRanked.length - v.riskRank) / (riskRanked.length - 1)) * 100 : 100;
      score += normalized * weightRisk;
      appliedWeight += weightRisk;
    }

    v.compositeScore = appliedWeight > 0 ? score / appliedWeight : 0;
  }

  // Composite rank
  composites.sort((a, b) => b.compositeScore - a.compositeScore);
  composites.forEach((v, i) => v.compositeRank = i + 1);

  return composites;
}

// --- Header ---
function renderHeader(): HTMLElement {
  const stored = loadStored();
  const header = h('header', { className: 'bg-white border-b border-gray-200 shadow-sm' });
  const inner = h('div', { className: 'mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 py-5 flex items-center justify-between flex-wrap gap-4' });

  const left = h('div', { className: 'flex items-center gap-3' });
  const logo = h('div', { className: 'text-3xl font-bold text-amber-500' }, 'Dashboard');
  left.appendChild(logo);
  left.appendChild(h('span', { className: 'text-xl font-semibold text-gray-700' }, stored.name));

  const right = h('div', { className: 'flex items-center gap-2 flex-wrap' });
  const basePath = import.meta.env.BASE_URL ?? '/honey-bee/';

  const nwaLink = document.createElement('a');
  nwaLink.href = `${basePath}`;
  nwaLink.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors';
  nwaLink.textContent = 'Nutzwertanalyse';

  const tcoLink = document.createElement('a');
  tcoLink.href = `${basePath}tco.html`;
  tcoLink.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors';
  tcoLink.textContent = 'TCO-Rechner';

  const riskLink = document.createElement('a');
  riskLink.href = `${basePath}risk.html`;
  riskLink.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors';
  riskLink.textContent = 'Risikoanalyse';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors';
  exportBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> Export`;
  exportBtn.addEventListener('click', handleExport);

  const importBtn = document.createElement('button');
  importBtn.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors';
  importBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg> Import`;
  importBtn.addEventListener('click', handleImport);

  right.appendChild(nwaLink);
  right.appendChild(tcoLink);
  right.appendChild(riskLink);
  right.appendChild(importBtn);
  right.appendChild(exportBtn);

  inner.appendChild(left);
  inner.appendChild(right);
  header.appendChild(inner);
  return header;
}

// --- Weights Section ---
function renderWeightsSection(): HTMLElement {
  const section = h('div', { className: 'mt-8 space-y-4' });

  const info = h('div', { className: 'bg-amber-50 border border-amber-200 rounded-xl p-5 text-base text-amber-800' });
  info.innerHTML = `<strong>Gewichtung anpassen:</strong> Bestimmen Sie, wie stark Qualitaet (NWA), Kosten (TCO) und Risiko in die Gesamtbewertung einfliessen. Die Gewichte werden automatisch normalisiert.`;
  section.appendChild(info);

  const grid = h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' });

  grid.appendChild(createWeightSlider('Qualitaet (NWA)', weightNwa, (v) => { weightNwa = v; render(); }, 'bg-blue-500'));
  grid.appendChild(createWeightSlider('Kosten (TCO)', weightTco, (v) => { weightTco = v; render(); }, 'bg-amber-500'));
  grid.appendChild(createWeightSlider('Risiko', weightRisk, (v) => { weightRisk = v; render(); }, 'bg-red-500'));

  section.appendChild(grid);

  // Show effective weights
  const total = weightNwa + weightTco + weightRisk;
  const pctNwa = total > 0 ? ((weightNwa / total) * 100).toFixed(0) : '0';
  const pctTco = total > 0 ? ((weightTco / total) * 100).toFixed(0) : '0';
  const pctRisk = total > 0 ? ((weightRisk / total) * 100).toFixed(0) : '0';

  const effectiveRow = h('div', { className: 'flex items-center gap-4 text-sm text-gray-500' });
  effectiveRow.appendChild(h('span', {}, `Effektive Gewichtung: Qualitaet ${pctNwa}% · Kosten ${pctTco}% · Risiko ${pctRisk}%`));
  section.appendChild(effectiveRow);

  return section;
}

function createWeightSlider(label: string, value: number, onChange: (v: number) => void, colorClass: string): HTMLElement {
  const card = h('div', { className: 'bg-white rounded-xl border border-gray-200 p-5 space-y-3' });
  card.appendChild(h('div', { className: 'flex justify-between items-center' },
    h('span', { className: 'text-sm font-medium text-gray-700' }, label),
    h('span', { className: 'text-lg font-bold text-gray-900' }, `${value}%`),
  ));

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = String(value);
  slider.className = 'w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500';
  slider.addEventListener('input', () => onChange(Number(slider.value)));
  card.appendChild(slider);

  // Bar visual
  const total = weightNwa + weightTco + weightRisk;
  const pct = total > 0 ? (value / total) * 100 : 0;
  const barOuter = h('div', { className: 'bg-gray-100 rounded-full h-2' });
  const barInner = document.createElement('div');
  barInner.className = `${colorClass} h-full rounded-full transition-all`;
  barInner.style.width = `${pct}%`;
  barOuter.appendChild(barInner);
  card.appendChild(barOuter);

  return card;
}

// --- Ranking Section ---
function renderRankingSection(): HTMLElement {
  const stored = loadStored();
  const composites = calculateComposite(stored);
  const section = h('div', { className: 'mt-8 space-y-6' });

  section.appendChild(h('h2', { className: 'text-lg font-semibold text-gray-700' }, 'Gesamtranking'));

  if (composites.length === 0) {
    const warn = h('div', { className: 'bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-base text-yellow-800' });
    warn.textContent = 'Keine Anbieter vorhanden. Bitte erfassen Sie Anbieter in der Nutzwertanalyse oder im TCO-Rechner.';
    section.appendChild(warn);
    return section;
  }

  const cardGrid = h('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' });
  for (const v of composites) {
    const isBest = v.compositeRank === 1;
    const card = h('div', { className: `bg-white rounded-xl p-6 border-2 ${isBest ? 'border-amber-400 shadow-lg' : 'border-gray-200'} hover:shadow-lg transition-shadow` });

    // Rank badge
    const rankBadge = h('div', { className: `inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold mb-3 ${isBest ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'}` }, `#${v.compositeRank}`);
    card.appendChild(rankBadge);

    if (isBest) {
      const badge = h('span', { className: 'ml-2 bg-amber-500 text-white text-sm font-bold px-4 py-1.5 rounded-full' }, 'Empfehlung');
      card.appendChild(badge);
    }

    card.appendChild(h('h3', { className: 'text-xl font-bold mt-2 mb-4' }, v.name));

    // Composite score
    const scoreRow = h('div', { className: 'flex items-baseline gap-2 mb-4' });
    scoreRow.appendChild(h('span', { className: 'text-3xl font-bold' }, v.compositeScore.toFixed(1)));
    scoreRow.appendChild(h('span', { className: 'text-sm text-gray-500' }, 'von 100'));
    card.appendChild(scoreRow);

    // Dimension bars
    const dims = h('div', { className: 'space-y-2' });

    // NWA
    dims.appendChild(createDimensionBar('Qualitaet (NWA)', v.nwaScore !== null ? `${v.nwaScore.toFixed(2)} Pkt. (Rang ${v.nwaRank})` : 'Keine Daten', v.nwaRank, composites.filter((c) => c.nwaRank !== null).length, 'bg-blue-500'));
    // TCO
    dims.appendChild(createDimensionBar('Kosten (TCO)', v.tco !== null ? `${formatCurrency(v.tco)} (Rang ${v.tcoRank})` : 'Keine Daten', v.tcoRank, composites.filter((c) => c.tcoRank !== null).length, 'bg-amber-500'));
    // Risk
    dims.appendChild(createDimensionBar('Risiko', v.riskAvg !== null ? `Ø ${v.riskAvg.toFixed(1)} (Rang ${v.riskRank})` : 'Keine Daten', v.riskRank, composites.filter((c) => c.riskRank !== null).length, 'bg-red-500'));

    card.appendChild(dims);
    cardGrid.appendChild(card);
  }
  section.appendChild(cardGrid);
  return section;
}

function createDimensionBar(label: string, detail: string, rank: number | null, total: number, colorClass: string): HTMLElement {
  const row = h('div', { className: 'space-y-1' });
  const labelRow = h('div', { className: 'flex justify-between text-xs' });
  labelRow.appendChild(h('span', { className: 'text-gray-500 font-medium' }, label));
  labelRow.appendChild(h('span', { className: 'text-gray-600' }, detail));
  row.appendChild(labelRow);

  const pct = rank !== null && total > 1 ? ((total - rank) / (total - 1)) * 100 : (rank !== null ? 100 : 0);
  const barOuter = h('div', { className: 'bg-gray-100 rounded-full h-2' });
  const barInner = document.createElement('div');
  barInner.className = `${colorClass} h-full rounded-full transition-all`;
  barInner.style.width = `${pct}%`;
  barOuter.appendChild(barInner);
  row.appendChild(barOuter);

  return row;
}

// --- Detail Section ---
function renderDetailSection(): HTMLElement {
  const stored = loadStored();
  const composites = calculateComposite(stored);
  const section = h('div', { className: 'mt-8 space-y-6' });

  if (composites.length === 0) return section;

  section.appendChild(h('h2', { className: 'text-lg font-semibold text-gray-700' }, 'Detailvergleich'));

  const tableWrap = h('div', { className: 'overflow-x-auto bg-white rounded-xl border border-gray-200' });
  const table = document.createElement('table');
  table.className = 'min-w-full text-sm';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.appendChild(h('th', { className: 'sticky left-0 bg-gray-50 px-4 py-3 text-left font-medium text-gray-600 border-b border-r border-gray-200 z-10' }, 'Dimension'));
  for (const v of composites) {
    headerRow.appendChild(h('th', { className: 'px-4 py-3 text-center font-medium text-gray-600 border-b border-gray-200 min-w-[150px]' }, v.name));
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  const rows: { label: string; getValue: (v: VendorComposite) => string; highlight?: boolean }[] = [
    { label: 'NWA Score', getValue: (v) => v.nwaScore !== null ? v.nwaScore.toFixed(2) : '–' },
    { label: 'NWA Rang', getValue: (v) => v.nwaRank !== null ? `#${v.nwaRank}` : '–' },
    { label: 'TCO (gesamt)', getValue: (v) => v.tco !== null ? formatCurrency(v.tco) : '–' },
    { label: 'TCO Rang', getValue: (v) => v.tcoRank !== null ? `#${v.tcoRank}` : '–' },
    { label: 'Risiko (Ø Score)', getValue: (v) => v.riskAvg !== null ? v.riskAvg.toFixed(1) : '–' },
    { label: 'Risiko Rang', getValue: (v) => v.riskRank !== null ? `#${v.riskRank}` : '–' },
    { label: 'Gesamtscore', getValue: (v) => v.compositeScore.toFixed(1), highlight: true },
    { label: 'Gesamtrang', getValue: (v) => `#${v.compositeRank}`, highlight: true },
  ];

  for (let i = 0; i < rows.length; i++) {
    const row = document.createElement('tr');
    row.className = rows[i].highlight ? 'bg-amber-50 font-semibold' : (i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50');
    row.appendChild(h('td', { className: 'sticky left-0 bg-inherit px-4 py-3 font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap text-sm z-10' }, rows[i].label));
    for (const v of composites) {
      row.appendChild(h('td', { className: 'px-4 py-3 text-center text-gray-600' }, rows[i].getValue(v)));
    }
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  section.appendChild(tableWrap);

  // Markdown export
  const mdRow = h('div', { className: 'flex gap-3' });
  const copyMdBtn = document.createElement('button');
  copyMdBtn.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors';
  copyMdBtn.textContent = 'Markdown kopieren';
  copyMdBtn.addEventListener('click', handleCopyMarkdown);

  const dlMdBtn = document.createElement('button');
  dlMdBtn.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors';
  dlMdBtn.textContent = 'Markdown herunterladen';
  dlMdBtn.addEventListener('click', handleDownloadMarkdown);

  mdRow.appendChild(copyMdBtn);
  mdRow.appendChild(dlMdBtn);
  section.appendChild(mdRow);

  return section;
}

// --- Markdown ---
function generateDashboardMarkdown(): string {
  const stored = loadStored();
  const composites = calculateComposite(stored);
  const total = weightNwa + weightTco + weightRisk;
  const pNwa = total > 0 ? ((weightNwa / total) * 100).toFixed(0) : '0';
  const pTco = total > 0 ? ((weightTco / total) * 100).toFixed(0) : '0';
  const pRisk = total > 0 ? ((weightRisk / total) * 100).toFixed(0) : '0';

  let md = `# Gesamtbewertung – ${stored.name}\n\n`;
  md += `Gewichtung: Qualitaet ${pNwa}% · Kosten ${pTco}% · Risiko ${pRisk}%\n\n`;

  md += `## Ranking\n\n`;
  md += `| Rang | Anbieter | NWA Score | NWA Rang | TCO | TCO Rang | Risiko Ø | Risiko Rang | Gesamt |\n`;
  md += `|------|----------|-----------|----------|-----|----------|----------|-------------|--------|\n`;
  for (const v of composites) {
    md += `| #${v.compositeRank} | ${v.name} | ${v.nwaScore !== null ? v.nwaScore.toFixed(2) : '–'} | ${v.nwaRank !== null ? '#' + v.nwaRank : '–'} | ${v.tco !== null ? formatCurrency(v.tco) : '–'} | ${v.tcoRank !== null ? '#' + v.tcoRank : '–'} | ${v.riskAvg !== null ? v.riskAvg.toFixed(1) : '–'} | ${v.riskRank !== null ? '#' + v.riskRank : '–'} | ${v.compositeScore.toFixed(1)} |\n`;
  }

  if (composites.length > 0 && composites[0].compositeScore > 0) {
    md += `\n**Empfehlung:** ${composites[0].name} (Score ${composites[0].compositeScore.toFixed(1)}/100)\n`;
  }

  return md;
}

function handleCopyMarkdown(): void {
  const md = generateDashboardMarkdown();
  navigator.clipboard.writeText(md).then(() => showToast('Markdown kopiert!')).catch(() => showToast('Fehler beim Kopieren'));
}

function handleDownloadMarkdown(): void {
  const md = generateDashboardMarkdown();
  const stored = loadStored();
  downloadText(`dashboard-${stored.name.toLowerCase().replace(/\s+/g, '-')}.md`, md);
}

// --- Import/Export ---
function handleExport(): void {
  const json = exportFullProject();
  const stored = loadStored();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${stored.name.toLowerCase().replace(/\s+/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleImport(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importFullProject(reader.result as string);
        location.reload();
      } catch (e) {
        alert(`Import fehlgeschlagen: ${(e as Error).message}`);
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// --- Helpers ---
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function showToast(msg: string): void {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-xl text-sm font-medium z-50 transition-opacity';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Init ---
render();
