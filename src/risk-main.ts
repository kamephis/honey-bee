import './style.css';
import {
  PRESET_RISKS,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS,
  PROBABILITY_LABELS,
  IMPACT_LABELS,
  getRiskLevel,
} from './risk-types';
import type { RiskLevel } from './risk-types';
import {
  getProject,
  subscribe,
  setProjectName,
  addRisk,
  updateRisk,
  removeRisk,
  copyRisksToVendor,
  calculateAllVendorRisks,
} from './risk-state';
import { exportFullProject, importFullProject } from './storage';

const app = document.getElementById('app')!;

type Tab = 'risks' | 'matrix' | 'results';
let activeTab: Tab = 'risks';
let activeVendorIndex = 0;

function setTab(tab: Tab): void {
  activeTab = tab;
  render();
}

subscribe(render);

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

function render(): void {
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  app.innerHTML = '';
  app.appendChild(renderHeader());
  app.appendChild(renderTabs());
  const content = h('div', { className: 'mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 pb-16' });
  switch (activeTab) {
    case 'risks':
      content.appendChild(renderRisksSection());
      break;
    case 'matrix':
      content.appendChild(renderMatrixSection());
      break;
    case 'results':
      content.appendChild(renderResultsSection());
      break;
  }
  app.appendChild(content);

  requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
}

// --- Header ---
function renderHeader(): HTMLElement {
  const project = getProject();
  const header = h('header', { className: 'bg-white border-b border-gray-200 shadow-sm' });
  const inner = h('div', { className: 'mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 py-5 flex items-center justify-between flex-wrap gap-4' });

  const left = h('div', { className: 'flex items-center gap-3' });
  const logo = h('div', { className: 'text-3xl font-bold text-amber-500' }, 'RISK');
  left.appendChild(logo);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = project.name;
  nameInput.className = 'text-xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-amber-500 focus:outline-none px-2 py-1 transition-colors';
  nameInput.addEventListener('change', () => setProjectName(nameInput.value));
  left.appendChild(nameInput);

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

  const dashLink = document.createElement('a');
  dashLink.href = `${basePath}dashboard.html`;
  dashLink.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors';
  dashLink.textContent = 'Dashboard';

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
  right.appendChild(dashLink);
  right.appendChild(importBtn);
  right.appendChild(exportBtn);

  inner.appendChild(left);
  inner.appendChild(right);
  header.appendChild(inner);
  return header;
}

// --- Tabs ---
function renderTabs(): HTMLElement {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'risks', label: 'Risiken erfassen' },
    { key: 'matrix', label: 'Risikomatrix' },
    { key: 'results', label: 'Ergebnisse' },
  ];

  const nav = h('nav', { className: 'bg-white border-b border-gray-200' });
  const inner = h('div', { className: 'mx-auto px-6 sm:px-10 lg:px-16 xl:px-20' });
  const ul = h('div', { className: 'flex gap-0 -mb-px' });

  for (const t of tabs) {
    const btn = document.createElement('button');
    const isActive = t.key === activeTab;
    btn.className = `px-5 py-4 text-base font-medium border-b-2 transition-colors ${isActive ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`;
    btn.textContent = t.label;
    btn.addEventListener('click', () => setTab(t.key));
    ul.appendChild(btn);
  }

  inner.appendChild(ul);
  nav.appendChild(inner);
  return nav;
}

// --- Risks Section ---
function renderRisksSection(): HTMLElement {
  const project = getProject();
  const vendors = project.vendors;
  const section = h('div', { className: 'mt-8 space-y-8' });

  if (vendors.length === 0) {
    const warn = h('div', { className: 'bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-base text-yellow-800' });
    warn.textContent = 'Bitte erfassen Sie zuerst Anbieter in der Nutzwertanalyse oder im TCO-Rechner.';
    section.appendChild(warn);
    return section;
  }

  // Info
  const info = h('div', { className: 'bg-amber-50 border border-amber-200 rounded-xl p-5 text-base text-amber-800' });
  info.innerHTML = `<strong>Risiken erfassen:</strong> Waehlen Sie einen Anbieter und bewerten Sie die Risiken nach Eintrittswahrscheinlichkeit (1–5) und Auswirkung (1–5). Der Risikoscore ergibt sich aus dem Produkt beider Werte.`;
  section.appendChild(info);

  // Vendor tabs
  if (activeVendorIndex >= vendors.length) activeVendorIndex = 0;
  const vendorNav = h('div', { className: 'flex gap-2 flex-wrap' });
  for (let i = 0; i < vendors.length; i++) {
    const btn = document.createElement('button');
    const isActive = i === activeVendorIndex;
    btn.className = `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isActive ? 'bg-amber-500 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`;
    btn.textContent = vendors[i].name;
    btn.addEventListener('click', () => { activeVendorIndex = i; render(); });
    vendorNav.appendChild(btn);
  }
  section.appendChild(vendorNav);

  const vendor = vendors[activeVendorIndex];

  // Copy risks from another vendor
  if (vendors.length > 1) {
    const copyRow = h('div', { className: 'flex items-center gap-3' });
    const copyLabel = h('span', { className: 'text-sm text-gray-500' }, 'Risiken uebernehmen von:');
    copyRow.appendChild(copyLabel);
    for (const v of vendors) {
      if (v.id === vendor.id) continue;
      const copyBtn = document.createElement('button');
      copyBtn.className = 'px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors';
      copyBtn.textContent = v.name;
      copyBtn.addEventListener('click', () => copyRisksToVendor(v.id, vendor.id));
      copyRow.appendChild(copyBtn);
    }
    section.appendChild(copyRow);
  }

  // Preset chips
  const presetRow = h('div', { className: 'flex flex-wrap gap-2' });
  const existingNames = new Set(vendor.risks.map((r) => r.name));
  for (const name of PRESET_RISKS) {
    if (existingNames.has(name)) continue;
    const chip = document.createElement('button');
    chip.className = 'px-4 py-2 text-sm rounded-full border border-gray-300 text-gray-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors';
    chip.textContent = `+ ${name}`;
    chip.addEventListener('click', () => addRisk(vendor.id, name));
    presetRow.appendChild(chip);
  }
  section.appendChild(presetRow);

  // Custom add
  const addRow = h('div', { className: 'flex gap-3' });
  const addInput = document.createElement('input');
  addInput.type = 'text';
  addInput.placeholder = 'Neues Risiko hinzufuegen...';
  addInput.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none';
  const addBtn = document.createElement('button');
  addBtn.className = 'px-5 py-3 text-base font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors';
  addBtn.textContent = 'Hinzufuegen';
  addBtn.addEventListener('click', () => {
    if (addInput.value.trim()) { addRisk(vendor.id, addInput.value.trim()); addInput.value = ''; }
  });
  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && addInput.value.trim()) { addRisk(vendor.id, addInput.value.trim()); addInput.value = ''; }
  });
  addRow.appendChild(addInput);
  addRow.appendChild(addBtn);
  section.appendChild(addRow);

  // Risk list
  if (vendor.risks.length === 0) {
    const empty = h('div', { className: 'text-center py-12 text-gray-400' }, 'Keine Risiken erfasst. Fuegen Sie Risiken ueber die Presets oder das Eingabefeld hinzu.');
    section.appendChild(empty);
    return section;
  }

  const riskList = h('div', { className: 'space-y-4' });
  for (const risk of vendor.risks) {
    const score = risk.probability * risk.impact;
    const level = getRiskLevel(score);
    const colors = RISK_LEVEL_COLORS[level];

    const card = h('div', { className: `bg-white rounded-xl border border-gray-200 p-5 space-y-3` });

    // Header row: name + score badge + delete
    const headerRow = h('div', { className: 'flex items-center justify-between gap-3' });
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = risk.name;
    nameInput.className = 'flex-1 text-base font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-amber-500 focus:outline-none px-1 py-0.5';
    nameInput.addEventListener('change', () => updateRisk(vendor.id, risk.id, { name: nameInput.value }));

    const scoreBadge = h('span', { className: `inline-flex items-center gap-1.5 px-3 py-1 text-sm font-bold rounded-full ${colors.bg} ${colors.text} ${colors.border} border` });
    scoreBadge.textContent = `${score} – ${RISK_LEVEL_LABELS[level]}`;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'p-2 text-gray-400 hover:text-red-500 transition-colors';
    deleteBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;
    deleteBtn.addEventListener('click', () => removeRisk(vendor.id, risk.id));

    headerRow.appendChild(nameInput);
    headerRow.appendChild(scoreBadge);
    headerRow.appendChild(deleteBtn);
    card.appendChild(headerRow);

    // Probability + Impact selectors
    const selectRow = h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' });

    // Probability
    const probGroup = h('div', { className: 'space-y-1' });
    probGroup.appendChild(h('label', { className: 'text-sm text-gray-500' }, 'Eintrittswahrscheinlichkeit'));
    const probSelect = document.createElement('select');
    probSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none';
    for (let v = 1; v <= 5; v++) {
      const opt = document.createElement('option');
      opt.value = String(v);
      opt.textContent = `${v} – ${PROBABILITY_LABELS[v]}`;
      if (v === risk.probability) opt.selected = true;
      probSelect.appendChild(opt);
    }
    probSelect.addEventListener('change', () => updateRisk(vendor.id, risk.id, { probability: Number(probSelect.value) }));
    probGroup.appendChild(probSelect);
    selectRow.appendChild(probGroup);

    // Impact
    const impGroup = h('div', { className: 'space-y-1' });
    impGroup.appendChild(h('label', { className: 'text-sm text-gray-500' }, 'Auswirkung'));
    const impSelect = document.createElement('select');
    impSelect.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none';
    for (let v = 1; v <= 5; v++) {
      const opt = document.createElement('option');
      opt.value = String(v);
      opt.textContent = `${v} – ${IMPACT_LABELS[v]}`;
      if (v === risk.impact) opt.selected = true;
      impSelect.appendChild(opt);
    }
    impSelect.addEventListener('change', () => updateRisk(vendor.id, risk.id, { impact: Number(impSelect.value) }));
    impGroup.appendChild(impSelect);
    selectRow.appendChild(impGroup);

    card.appendChild(selectRow);

    // Mitigation
    const mitGroup = h('div', { className: 'space-y-1' });
    mitGroup.appendChild(h('label', { className: 'text-sm text-gray-500' }, 'Massnahme / Mitigation'));
    const mitInput = document.createElement('input');
    mitInput.type = 'text';
    mitInput.value = risk.mitigation;
    mitInput.placeholder = 'Gegenmassnahme beschreiben...';
    mitInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none';
    mitInput.addEventListener('change', () => updateRisk(vendor.id, risk.id, { mitigation: mitInput.value }));
    mitGroup.appendChild(mitInput);
    card.appendChild(mitGroup);

    riskList.appendChild(card);
  }
  section.appendChild(riskList);
  return section;
}

// --- Matrix Section (5x5 heatmap) ---
function renderMatrixSection(): HTMLElement {
  const project = getProject();
  const vendors = project.vendors;
  const section = h('div', { className: 'mt-8 space-y-8' });

  if (vendors.length === 0) {
    const warn = h('div', { className: 'bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-base text-yellow-800' });
    warn.textContent = 'Keine Anbieter vorhanden.';
    section.appendChild(warn);
    return section;
  }

  const info = h('div', { className: 'bg-amber-50 border border-amber-200 rounded-xl p-5 text-base text-amber-800' });
  info.innerHTML = `<strong>Risikomatrix:</strong> Visualisierung der Risiken im 5×5-Raster. Die Position ergibt sich aus Eintrittswahrscheinlichkeit (X) und Auswirkung (Y).`;
  section.appendChild(info);

  // Vendor selector
  if (activeVendorIndex >= vendors.length) activeVendorIndex = 0;
  const vendorNav = h('div', { className: 'flex gap-2 flex-wrap' });
  // Add "Alle" button
  const allBtn = document.createElement('button');
  const isAll = activeVendorIndex === -1;
  allBtn.className = `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isAll ? 'bg-amber-500 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`;
  allBtn.textContent = 'Alle Anbieter';
  allBtn.addEventListener('click', () => { activeVendorIndex = -1; render(); });
  vendorNav.appendChild(allBtn);

  for (let i = 0; i < vendors.length; i++) {
    const btn = document.createElement('button');
    const isActive = i === activeVendorIndex;
    btn.className = `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isActive ? 'bg-amber-500 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`;
    btn.textContent = vendors[i].name;
    btn.addEventListener('click', () => { activeVendorIndex = i; render(); });
    vendorNav.appendChild(btn);
  }
  section.appendChild(vendorNav);

  // Collect risks to display
  const risksToShow: { name: string; probability: number; impact: number; vendorName: string }[] = [];
  if (activeVendorIndex === -1) {
    for (const v of vendors) {
      for (const r of v.risks) {
        risksToShow.push({ name: r.name, probability: r.probability, impact: r.impact, vendorName: v.name });
      }
    }
  } else {
    const v = vendors[activeVendorIndex];
    for (const r of v.risks) {
      risksToShow.push({ name: r.name, probability: r.probability, impact: r.impact, vendorName: v.name });
    }
  }

  // 5x5 grid
  const matrixWrap = h('div', { className: 'bg-white rounded-xl border border-gray-200 p-6' });
  const matrixGrid = h('div', { className: 'relative' });

  // Build grid cells
  const table = document.createElement('table');
  table.className = 'w-full border-collapse';

  // Header row with probability labels
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.appendChild(h('th', { className: 'w-32 p-2 text-right text-xs text-gray-500' }));
  for (let p = 1; p <= 5; p++) {
    headerRow.appendChild(h('th', { className: 'p-2 text-center text-xs text-gray-500 font-medium' }, `${p}`));
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  // Rows from impact 5 (top) to 1 (bottom)
  for (let imp = 5; imp >= 1; imp--) {
    const row = document.createElement('tr');
    row.appendChild(h('td', { className: 'p-2 text-right text-xs text-gray-500 font-medium whitespace-nowrap' }, `${imp} – ${IMPACT_LABELS[imp]}`));

    for (let prob = 1; prob <= 5; prob++) {
      const score = prob * imp;
      const level = getRiskLevel(score);
      const bgColor = matrixCellColor(level);
      const cell = document.createElement('td');
      cell.className = `p-1 border border-gray-200 ${bgColor} align-top`;
      cell.style.minWidth = '80px';
      cell.style.height = '60px';

      // Find risks in this cell
      const cellRisks = risksToShow.filter((r) => r.probability === prob && r.impact === imp);
      for (const cr of cellRisks) {
        const tag = h('div', { className: 'text-[10px] leading-tight px-1 py-0.5 rounded bg-white/80 mb-0.5 truncate', title: `${cr.vendorName}: ${cr.name}` });
        tag.textContent = activeVendorIndex === -1 ? `${cr.vendorName.substring(0, 3)}: ${cr.name}` : cr.name;
        cell.appendChild(tag);
      }

      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  // Axis labels
  const xLabel = h('div', { className: 'text-center text-sm text-gray-600 font-medium mt-2' }, 'Eintrittswahrscheinlichkeit →');
  const yLabel = h('div', { className: 'text-sm text-gray-600 font-medium mb-2' }, '↑ Auswirkung');

  matrixGrid.appendChild(yLabel);
  matrixGrid.appendChild(table);
  matrixGrid.appendChild(xLabel);
  matrixWrap.appendChild(matrixGrid);

  // Legend
  const legend = h('div', { className: 'flex items-center gap-4 mt-4 flex-wrap' });
  for (const lvl of ['low', 'medium', 'high', 'critical'] as RiskLevel[]) {
    const colors = RISK_LEVEL_COLORS[lvl];
    const item = h('div', { className: 'flex items-center gap-2' });
    item.appendChild(h('div', { className: `w-4 h-4 rounded ${colors.bg} ${colors.border} border` }));
    item.appendChild(h('span', { className: `text-sm ${colors.text}` }, `${RISK_LEVEL_LABELS[lvl]} (${levelRange(lvl)})`));
    legend.appendChild(item);
  }
  matrixWrap.appendChild(legend);

  section.appendChild(matrixWrap);
  return section;
}

function matrixCellColor(level: RiskLevel): string {
  switch (level) {
    case 'low': return 'bg-green-100';
    case 'medium': return 'bg-yellow-100';
    case 'high': return 'bg-orange-100';
    case 'critical': return 'bg-red-100';
  }
}

function levelRange(level: RiskLevel): string {
  switch (level) {
    case 'low': return '1–4';
    case 'medium': return '5–9';
    case 'high': return '10–15';
    case 'critical': return '16–25';
  }
}

// --- Results Section ---
function renderResultsSection(): HTMLElement {
  const results = calculateAllVendorRisks();
  const section = h('div', { className: 'mt-8 space-y-8' });

  if (results.length === 0) {
    const warn = h('div', { className: 'bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-base text-yellow-800' });
    warn.textContent = 'Keine Anbieter vorhanden.';
    section.appendChild(warn);
    return section;
  }

  // Summary cards
  const sortedByAvg = [...results].filter((r) => r.risks.length > 0).sort((a, b) => a.avgScore - b.avgScore);
  const bestVendorId = sortedByAvg.length > 0 ? sortedByAvg[0].vendorId : null;

  const cardGrid = h('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' });
  for (const r of results) {
    const isBest = r.vendorId === bestVendorId && r.risks.length > 0;
    const avgLevel = getRiskLevel(r.avgScore);
    const avgColors = RISK_LEVEL_COLORS[avgLevel];

    const card = h('div', { className: `bg-white rounded-xl p-6 border-2 ${isBest ? 'border-green-400 shadow-lg' : 'border-gray-200'} hover:shadow-lg transition-shadow` });

    if (isBest) {
      const badge = h('div', { className: 'inline-block bg-green-500 text-white text-sm font-bold px-4 py-1.5 rounded-full mb-3' }, 'Geringstes Risiko');
      card.appendChild(badge);
    }

    card.appendChild(h('h3', { className: 'text-xl font-bold mb-3' }, r.vendorName));

    if (r.risks.length === 0) {
      card.appendChild(h('div', { className: 'text-gray-400 text-sm' }, 'Keine Risiken erfasst'));
      cardGrid.appendChild(card);
      continue;
    }

    // Score
    const scoreRow = h('div', { className: 'flex items-baseline gap-2 mb-3' });
    scoreRow.appendChild(h('span', { className: 'text-3xl font-bold' }, r.avgScore.toFixed(1)));
    const avgBadge = h('span', { className: `text-sm font-medium px-2 py-0.5 rounded-full ${avgColors.bg} ${avgColors.text}` }, RISK_LEVEL_LABELS[avgLevel]);
    scoreRow.appendChild(avgBadge);
    card.appendChild(scoreRow);

    // Stats
    const stats = h('div', { className: 'text-sm text-gray-600 space-y-1' });
    stats.appendChild(h('div', {}, `Risiken: ${r.risks.length}`));
    stats.appendChild(h('div', {}, `Gesamtscore: ${r.totalScore}`));
    stats.appendChild(h('div', {}, `Max. Einzelrisiko: ${r.maxScore}`));
    card.appendChild(stats);

    // Risk level distribution
    const distRow = h('div', { className: 'flex gap-1 mt-3' });
    for (const lvl of ['critical', 'high', 'medium', 'low'] as RiskLevel[]) {
      const count = r.riskCounts[lvl];
      if (count === 0) continue;
      const colors = RISK_LEVEL_COLORS[lvl];
      const pill = h('span', { className: `text-xs font-medium px-2 py-1 rounded-full ${colors.bg} ${colors.text} ${colors.border} border` }, `${count}× ${RISK_LEVEL_LABELS[lvl]}`);
      distRow.appendChild(pill);
    }
    card.appendChild(distRow);

    cardGrid.appendChild(card);
  }
  section.appendChild(cardGrid);

  // Comparison table
  const hasRisks = results.some((r) => r.risks.length > 0);
  if (!hasRisks) return section;

  section.appendChild(h('h3', { className: 'text-lg font-semibold text-gray-700' }, 'Detailvergleich'));

  const tableWrap = h('div', { className: 'overflow-x-auto bg-white rounded-xl border border-gray-200' });
  const table = document.createElement('table');
  table.className = 'min-w-full text-sm';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.appendChild(h('th', { className: 'sticky left-0 bg-gray-50 px-4 py-3 text-left font-medium text-gray-600 border-b border-r border-gray-200 z-10' }, 'Kennzahl'));
  for (const r of results) {
    headerRow.appendChild(h('th', { className: 'px-4 py-3 text-center font-medium text-gray-600 border-b border-gray-200 min-w-[140px]' }, r.vendorName));
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  const rows: { label: string; values: (r: typeof results[0]) => string; highlight?: boolean }[] = [
    { label: 'Anzahl Risiken', values: (r) => String(r.risks.length) },
    { label: 'Durchschn. Score', values: (r) => r.risks.length > 0 ? r.avgScore.toFixed(1) : '–', highlight: true },
    { label: 'Gesamtscore', values: (r) => r.risks.length > 0 ? String(r.totalScore) : '–' },
    { label: 'Max. Einzelrisiko', values: (r) => r.risks.length > 0 ? String(r.maxScore) : '–' },
    { label: 'Kritische Risiken', values: (r) => String(r.riskCounts.critical) },
    { label: 'Hohe Risiken', values: (r) => String(r.riskCounts.high) },
    { label: 'Mittlere Risiken', values: (r) => String(r.riskCounts.medium) },
    { label: 'Geringe Risiken', values: (r) => String(r.riskCounts.low) },
  ];

  for (let i = 0; i < rows.length; i++) {
    const row = document.createElement('tr');
    row.className = rows[i].highlight ? 'bg-amber-50 font-semibold' : (i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50');
    row.appendChild(h('td', { className: 'sticky left-0 bg-inherit px-4 py-3 font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap text-sm z-10' }, rows[i].label));
    for (const r of results) {
      row.appendChild(h('td', { className: 'px-4 py-3 text-center text-gray-600' }, rows[i].values(r)));
    }
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  section.appendChild(tableWrap);

  // Markdown export buttons
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
function generateRiskMarkdown(): string {
  const project = getProject();
  const results = calculateAllVendorRisks();
  let md = `# Risikoanalyse – ${project.name}\n\n`;

  // Summary table
  md += `## Uebersicht\n\n`;
  md += `| Anbieter | Risiken | Ø Score | Gesamt | Max. | Kritisch | Hoch | Mittel | Gering |\n`;
  md += `|----------|---------|---------|--------|------|----------|------|--------|--------|\n`;
  for (const r of results) {
    md += `| ${r.vendorName} | ${r.risks.length} | ${r.avgScore.toFixed(1)} | ${r.totalScore} | ${r.maxScore} | ${r.riskCounts.critical} | ${r.riskCounts.high} | ${r.riskCounts.medium} | ${r.riskCounts.low} |\n`;
  }

  // Detail per vendor
  for (const r of results) {
    if (r.risks.length === 0) continue;
    md += `\n## ${r.vendorName}\n\n`;
    md += `| Risiko | Wahrscheinlichkeit | Auswirkung | Score | Stufe | Massnahme |\n`;
    md += `|--------|-------------------|-----------|-------|-------|----------|\n`;
    for (const risk of r.risks) {
      md += `| ${risk.name} | ${risk.probability} | ${risk.impact} | ${risk.score} | ${RISK_LEVEL_LABELS[risk.level]} | ${risk.mitigation || '–'} |\n`;
    }
  }

  return md;
}

function handleCopyMarkdown(): void {
  const md = generateRiskMarkdown();
  navigator.clipboard.writeText(md).then(() => showToast('Markdown kopiert!')).catch(() => showToast('Fehler beim Kopieren'));
}

function handleDownloadMarkdown(): void {
  const md = generateRiskMarkdown();
  const project = getProject();
  downloadText(`risikoanalyse-${project.name.toLowerCase().replace(/\s+/g, '-')}.md`, md);
}

// --- Import/Export ---
function handleExport(): void {
  const json = exportFullProject();
  const project = getProject();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.toLowerCase().replace(/\s+/g, '-')}.json`;
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
