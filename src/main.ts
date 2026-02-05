import './style.css';
import type { VendorScore } from './types';
import {
  getProject,
  subscribe,
  addCriterion,
  updateCriterion,
  removeCriterion,
  setPairwise,
  getPairwise,
  addVendor,
  updateVendorName,
  removeVendor,
  setVendorScore,
  calculateWeights,
  calculateResults,
  getVendorTotals,
  exportProject,
  importProject,
  setProjectName,
  getCriteriaSortedByWeight,
} from './state';
import { renderRadarChart } from './chart';
import { SCORE_LABELS } from './types';

const app = document.getElementById('app')!;

// --- Tab state ---
type Tab = 'criteria' | 'pairwise' | 'vendors' | 'results';
let activeTab: Tab = 'criteria';

function setTab(tab: Tab): void {
  activeTab = tab;
  render();
}

// --- Render ---
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
  app.innerHTML = '';
  app.appendChild(renderHeader());
  app.appendChild(renderTabs());
  const content = h('div', { className: 'mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 pb-16' });
  switch (activeTab) {
    case 'criteria':
      content.appendChild(renderCriteriaSection());
      break;
    case 'pairwise':
      content.appendChild(renderPairwiseSection());
      break;
    case 'vendors':
      content.appendChild(renderVendorsSection());
      break;
    case 'results':
      content.appendChild(renderResultsSection());
      break;
  }
  app.appendChild(content);

  // Render chart if on results tab
  if (activeTab === 'results') {
    const canvas = document.getElementById('radar-chart') as HTMLCanvasElement | null;
    if (canvas) {
      requestAnimationFrame(() => renderRadarChart(canvas));
    }
  }
}

// --- Header ---
function renderHeader(): HTMLElement {
  const project = getProject();

  const header = h('header', { className: 'bg-white border-b border-gray-200 shadow-sm' });
  const inner = h('div', { className: 'mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 py-5 flex items-center justify-between flex-wrap gap-4' });

  // Left: Logo + project name
  const left = h('div', { className: 'flex items-center gap-3' });
  const logo = h('div', { className: 'text-3xl font-bold text-amber-500' }, 'NWA');
  left.appendChild(logo);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = project.name;
  nameInput.className = 'text-xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-amber-500 focus:outline-none px-2 py-1 transition-colors';
  nameInput.addEventListener('change', () => setProjectName(nameInput.value));
  left.appendChild(nameInput);

  // Right: Import/Export
  const right = h('div', { className: 'flex items-center gap-2' });

  const exportBtn = document.createElement('button');
  exportBtn.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors';
  exportBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> Export`;
  exportBtn.addEventListener('click', handleExport);

  const importBtn = document.createElement('button');
  importBtn.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors';
  importBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg> Import`;
  importBtn.addEventListener('click', handleImport);

  const tcoLink = document.createElement('a');
  const basePath = import.meta.env.BASE_URL ?? '/honey-bee/';
  tcoLink.href = `${basePath}tco.html`;
  tcoLink.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors';
  tcoLink.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> TCO-Rechner`;

  right.appendChild(tcoLink);
  right.appendChild(importBtn);
  right.appendChild(exportBtn);

  inner.appendChild(left);
  inner.appendChild(right);
  header.appendChild(inner);
  return header;
}

// --- Tabs ---
function renderTabs(): HTMLElement {
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'criteria', label: 'Kriterien', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>' },
    { key: 'pairwise', label: 'Paarvergleich', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>' },
    { key: 'vendors', label: 'Anbieter & Bewertung', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' },
    { key: 'results', label: 'Ergebnisse', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
  ];

  const nav = h('nav', { className: 'bg-white border-b border-gray-200' });
  const inner = h('div', { className: 'mx-auto px-6 sm:px-10 lg:px-16 xl:px-20' });
  const ul = h('div', { className: 'flex gap-0 -mb-px' });

  for (const tab of tabs) {
    const btn = document.createElement('button');
    const isActive = activeTab === tab.key;
    btn.className = `inline-flex items-center gap-2 px-5 py-4 text-base font-medium border-b-2 transition-colors ${isActive ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`;
    btn.innerHTML = tab.icon.replace('w-4 h-4', 'w-5 h-5') + ` ${tab.label}`;
    btn.addEventListener('click', () => setTab(tab.key));
    ul.appendChild(btn);
  }

  inner.appendChild(ul);
  nav.appendChild(inner);
  return nav;
}

// --- Criteria Section ---
function renderCriteriaSection(): HTMLElement {
  const project = getProject();
  const section = h('div', { className: 'mt-8 space-y-8' });

  // Info box
  const info = h('div', { className: 'bg-amber-50 border border-amber-200 rounded-xl p-5 text-base text-amber-800' });
  info.innerHTML = `<strong>Schritt 1:</strong> Definieren Sie die Bewertungskriterien, die fuer den Anbietervergleich relevant sind. Diese Kriterien bilden die Basis fuer die Gewichtung und Bewertung.`;
  section.appendChild(info);

  // Add criterion form
  const form = h('div', { className: 'flex gap-3' });
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Neues Kriterium eingeben...';
  input.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-base';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      addCriterion(input.value.trim());
      input.value = '';
    }
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'inline-flex items-center gap-2 px-5 py-3 text-base font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors';
  addBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Hinzufuegen`;
  addBtn.addEventListener('click', () => {
    if (input.value.trim()) {
      addCriterion(input.value.trim());
      input.value = '';
    }
  });
  form.appendChild(input);
  form.appendChild(addBtn);
  section.appendChild(form);

  // Criteria list
  if (project.criteria.length === 0) {
    const empty = h('div', { className: 'text-center py-16 text-gray-400' });
    empty.innerHTML = `<svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p class="text-base">Noch keine Kriterien vorhanden. Fuegen Sie Ihr erstes Kriterium hinzu.</p>`;
    section.appendChild(empty);
  } else {
    const list = h('div', { className: 'bg-white rounded-xl border border-gray-200 divide-y divide-gray-200' });
    project.criteria.forEach((c, i) => {
      const row = h('div', { className: 'flex items-center gap-4 px-5 py-4' });
      const num = h('span', { className: 'text-sm font-mono text-gray-400 w-8 text-right' }, `${i + 1}.`);

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = c.name;
      nameInput.className = 'flex-1 px-3 py-2 border border-transparent rounded-lg hover:border-gray-300 focus:border-amber-500 focus:outline-none text-base transition-colors';
      nameInput.addEventListener('change', () => updateCriterion(c.id, nameInput.value));

      const delBtn = document.createElement('button');
      delBtn.className = 'p-2 text-gray-400 hover:text-red-500 transition-colors';
      delBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;
      delBtn.addEventListener('click', () => {
        if (confirm(`Kriterium "${c.name}" wirklich loeschen?`)) removeCriterion(c.id);
      });

      row.appendChild(num);
      row.appendChild(nameInput);
      row.appendChild(delBtn);
      list.appendChild(row);
    });
    section.appendChild(list);
  }

  // Quick add presets
  const presets = h('div', { className: 'space-y-3' });
  const presetLabel = h('p', { className: 'text-sm font-medium text-gray-500 uppercase tracking-wider' }, 'Schnellauswahl: Typische Kriterien');
  const presetGrid = h('div', { className: 'flex flex-wrap gap-2' });
  const presetNames = [
    'Referenzen & Branchenerfahrung',
    'Technische Kompetenz',
    'Verstaendnis der Produktionsprozesse',
    'Verstaendnis der Customer Journey',
    'Qualitaet des PoC',
    'Integrationsfaehigkeit in bestehende Systeme',
    'Architektur und Skalierbarkeit der Loesung',
    'UX- und UI-Design-Kompetenz',
    'Projektmanagement & Kommunikation',
    'Teamzusammensetzung & Verfuegbarkeit',
    'Swiss-Team',
    'Kostenstruktur & Wirtschaftlichkeit',
    'Datenhandling',
    'Innovationsfaehigkeit und Weiterentwicklungspotential',
  ];
  const existingNames = new Set(project.criteria.map((c) => c.name));
  for (const name of presetNames) {
    if (existingNames.has(name)) continue;
    const chip = document.createElement('button');
    chip.className = 'px-4 py-2 text-sm rounded-full border border-gray-300 text-gray-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors';
    chip.textContent = name;
    chip.addEventListener('click', () => addCriterion(name));
    presetGrid.appendChild(chip);
  }
  presets.appendChild(presetLabel);
  presets.appendChild(presetGrid);
  if (presetGrid.children.length > 0) section.appendChild(presets);

  return section;
}

// --- Pairwise Section ---
function renderPairwiseSection(): HTMLElement {
  const project = getProject();
  const criteria = project.criteria;
  const section = h('div', { className: 'mt-8 space-y-8' });

  if (criteria.length < 2) {
    const warn = h('div', { className: 'bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-base text-yellow-800' });
    warn.textContent = 'Bitte definieren Sie mindestens 2 Kriterien, um den Paarvergleich durchzufuehren.';
    section.appendChild(warn);
    return section;
  }

  // Info
  const info = h('div', { className: 'bg-amber-50 border border-amber-200 rounded-xl p-5 text-base text-amber-800' });
  info.innerHTML = `<strong>Schritt 2:</strong> Vergleichen Sie jedes Kriterienpaar. <span class="font-mono bg-amber-100 px-1.5 rounded">0</span> = Zeile wichtiger, <span class="font-mono bg-amber-100 px-1.5 rounded">1</span> = Gleich wichtig, <span class="font-mono bg-amber-100 px-1.5 rounded">2</span> = Spalte wichtiger`;
  section.appendChild(info);

  // Matrix
  const tableWrap = h('div', { className: 'overflow-x-auto bg-white rounded-xl border border-gray-200' });
  const table = document.createElement('table');
  table.className = 'min-w-full text-sm';

  // Header row
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.appendChild(h('th', { className: 'sticky left-0 bg-gray-50 px-4 py-3 text-left font-medium text-gray-600 border-b border-r border-gray-200 z-10' }, ''));
  for (const c of criteria) {
    const th = h('th', { className: 'px-3 py-3 text-center font-medium text-gray-600 border-b border-gray-200 min-w-[100px]' });
    th.innerHTML = `<div class="writing-mode-vertical text-xs max-w-[100%] truncate" title="${c.name}">${truncate(c.name, 22)}</div>`;
    headerRow.appendChild(th);
  }
  // Weight columns
  headerRow.appendChild(h('th', { className: 'px-4 py-3 text-center font-semibold text-gray-700 border-b border-l border-gray-200 bg-amber-50' }, 'Absolut'));
  headerRow.appendChild(h('th', { className: 'px-4 py-3 text-center font-semibold text-gray-700 border-b border-gray-200 bg-amber-50' }, 'Relativ %'));
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const { absoluteWeights, relativeWeights, totalAbsolute } = calculateWeights();
  const tbody = document.createElement('tbody');

  for (let i = 0; i < criteria.length; i++) {
    const row = document.createElement('tr');
    row.className = i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';

    const labelCell = h('td', { className: 'sticky left-0 bg-inherit px-4 py-3 font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap text-sm z-10' }, criteria[i].name);
    row.appendChild(labelCell);

    for (let j = 0; j < criteria.length; j++) {
      const td = document.createElement('td');
      td.className = 'px-2 py-2 text-center border-gray-100';

      if (i === j) {
        td.className += ' bg-gray-200';
        td.innerHTML = '';
      } else if (i < j) {
        // Editable cell
        const val = getPairwise(criteria[i].id, criteria[j].id);
        const select = document.createElement('select');
        select.className = 'w-full text-center text-sm py-1.5 px-1 border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer';
        for (const v of [0, 1, 2]) {
          const opt = document.createElement('option');
          opt.value = String(v);
          opt.textContent = String(v);
          if (v === val) opt.selected = true;
          select.appendChild(opt);
        }
        const ci = criteria[i].id;
        const cj = criteria[j].id;
        select.addEventListener('change', () => setPairwise(ci, cj, Number(select.value)));
        td.appendChild(select);
      } else {
        // Mirror cell (read-only)
        const val = getPairwise(criteria[j].id, criteria[i].id);
        const mirror = 2 - val;
        td.className += ' text-gray-400 text-sm';
        td.textContent = String(mirror);
      }

      row.appendChild(td);
    }

    // Weight cells
    const absCell = h('td', { className: 'px-4 py-3 text-center font-semibold text-gray-700 border-l border-gray-200 bg-amber-50/50 text-sm' }, String(absoluteWeights[criteria[i].id] ?? 0));
    const relCell = h('td', { className: 'px-4 py-3 text-center font-semibold text-amber-600 bg-amber-50/50 text-sm' }, `${((relativeWeights[criteria[i].id] ?? 0) * 100).toFixed(1)}%`);
    row.appendChild(absCell);
    row.appendChild(relCell);

    tbody.appendChild(row);
  }

  // Total row
  const totalRow = document.createElement('tr');
  totalRow.className = 'bg-gray-100 font-semibold';
  const totalLabel = document.createElement('td');
  totalLabel.className = 'sticky left-0 bg-gray-100 px-4 py-3 text-gray-700 border-r border-t border-gray-200 z-10 text-sm';
  totalLabel.textContent = 'Summe';
  totalLabel.colSpan = criteria.length + 1;
  totalRow.appendChild(totalLabel);
  totalRow.appendChild(h('td', { className: 'px-4 py-3 text-center border-t border-gray-200 bg-amber-100 text-sm' }, String(totalAbsolute)));
  totalRow.appendChild(h('td', { className: 'px-4 py-3 text-center border-t border-gray-200 bg-amber-100 text-amber-700 text-sm' }, '100%'));
  tbody.appendChild(totalRow);

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  section.appendChild(tableWrap);

  // Weight ranking
  const sorted = getCriteriaSortedByWeight();
  const ranking = h('div', { className: 'bg-white rounded-xl border border-gray-200 p-6 space-y-3' });
  ranking.appendChild(h('h3', { className: 'text-base font-semibold text-gray-700 mb-4' }, 'Gewichtung nach Prioritaet'));
  sorted.forEach((c, i) => {
    const pct = (relativeWeights[c.id] ?? 0) * 100;
    const bar = h('div', { className: 'flex items-center gap-4' });
    bar.appendChild(h('span', { className: 'text-sm font-mono text-gray-400 w-7 text-right' }, `${i + 1}.`));
    bar.appendChild(h('span', { className: 'text-sm text-gray-700 w-72 truncate' }, c.name));
    const barBg = h('div', { className: 'flex-1 bg-gray-100 rounded-full h-5 overflow-hidden' });
    const barFill = h('div', { className: 'bg-amber-400 h-full rounded-full transition-all' });
    barFill.style.width = `${pct}%`;
    barBg.appendChild(barFill);
    bar.appendChild(barBg);
    bar.appendChild(h('span', { className: 'text-sm font-semibold text-gray-600 w-16 text-right' }, `${pct.toFixed(1)}%`));
    ranking.appendChild(bar);
  });
  section.appendChild(ranking);

  return section;
}

// --- Vendors Section ---
function renderVendorsSection(): HTMLElement {
  const project = getProject();
  const section = h('div', { className: 'mt-8 space-y-8' });

  if (project.criteria.length === 0) {
    const warn = h('div', { className: 'bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-base text-yellow-800' });
    warn.textContent = 'Bitte definieren Sie zuerst Kriterien, bevor Sie Anbieter bewerten.';
    section.appendChild(warn);
    return section;
  }

  // Info
  const info = h('div', { className: 'bg-amber-50 border border-amber-200 rounded-xl p-5 text-base text-amber-800' });
  info.innerHTML = `<strong>Schritt 3:</strong> Fuegen Sie Anbieter hinzu und bewerten Sie diese. Skala: <span class="font-mono bg-amber-100 px-1.5 rounded">10</span>=Exzellent, <span class="font-mono bg-amber-100 px-1.5 rounded">6</span>=Gut, <span class="font-mono bg-amber-100 px-1.5 rounded">4</span>=Ausreichend, <span class="font-mono bg-amber-100 px-1.5 rounded">1</span>=Unzureichend, <span class="font-mono bg-amber-100 px-1.5 rounded">0</span>=Nicht vorhanden`;
  section.appendChild(info);

  // Add vendor form
  const form = h('div', { className: 'flex gap-3' });
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Neuen Anbieter hinzufuegen...';
  input.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-base';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      addVendor(input.value.trim());
      input.value = '';
    }
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'inline-flex items-center gap-2 px-5 py-3 text-base font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors';
  addBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Anbieter`;
  addBtn.addEventListener('click', () => {
    if (input.value.trim()) {
      addVendor(input.value.trim());
      input.value = '';
    }
  });
  form.appendChild(input);
  form.appendChild(addBtn);
  section.appendChild(form);

  if (project.vendors.length === 0) {
    const empty = h('div', { className: 'text-center py-16 text-gray-400' });
    empty.innerHTML = `<svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg><p class="text-base">Noch keine Anbieter vorhanden.</p>`;
    section.appendChild(empty);
    return section;
  }

  // Scoring table
  const { relativeWeights } = calculateWeights();
  const sorted = getCriteriaSortedByWeight();
  const tableWrap = h('div', { className: 'overflow-x-auto bg-white rounded-xl border border-gray-200' });
  const table = document.createElement('table');
  table.className = 'min-w-full text-base';

  // Header
  const thead = document.createElement('thead');
  const headerRow1 = document.createElement('tr');
  headerRow1.appendChild(h('th', { className: 'sticky left-0 bg-gray-50 px-5 py-3 text-left font-medium text-gray-600 border-b border-r border-gray-200 z-10', rowspan: '2' }, 'Kriterium'));
  headerRow1.appendChild(h('th', { className: 'px-4 py-3 text-center font-medium text-gray-600 border-b border-r border-gray-200 bg-gray-50', rowspan: '2' }, 'Gewicht'));

  for (const v of project.vendors) {
    const th = document.createElement('th');
    th.colSpan = 2;
    th.className = 'px-4 py-2 text-center border-b border-gray-200 bg-gray-50';

    const vendorHeader = h('div', { className: 'flex items-center justify-center gap-2' });
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = v.name;
    nameInput.className = 'text-center font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-amber-500 focus:outline-none px-2 text-base';
    nameInput.addEventListener('change', () => updateVendorName(v.id, nameInput.value));

    const delBtn = document.createElement('button');
    delBtn.className = 'p-1 text-gray-400 hover:text-red-500 transition-colors';
    delBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
    delBtn.addEventListener('click', () => {
      if (confirm(`Anbieter "${v.name}" wirklich entfernen?`)) removeVendor(v.id);
    });

    vendorHeader.appendChild(nameInput);
    vendorHeader.appendChild(delBtn);
    th.appendChild(vendorHeader);
    headerRow1.appendChild(th);
  }
  thead.appendChild(headerRow1);

  const headerRow2 = document.createElement('tr');
  for (const _v of project.vendors) {
    headerRow2.appendChild(h('th', { className: 'px-3 py-2 text-center text-sm font-medium text-gray-500 border-b border-gray-200 bg-gray-50' }, 'Bewertung'));
    headerRow2.appendChild(h('th', { className: 'px-3 py-2 text-center text-sm font-medium text-gray-500 border-b border-gray-200 bg-gray-50' }, 'Gewichtet'));
  }
  thead.appendChild(headerRow2);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  const results = calculateResults();

  for (const c of sorted) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50/50';

    const labelCell = h('td', { className: 'sticky left-0 bg-white px-5 py-3 font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap text-sm z-10' }, c.name);
    row.appendChild(labelCell);

    const weightCell = h('td', { className: 'px-4 py-3 text-center text-sm text-gray-500 border-r border-gray-200' }, `${((relativeWeights[c.id] ?? 0) * 100).toFixed(1)}%`);
    row.appendChild(weightCell);

    const r = results.find((r) => r.criterionId === c.id);

    for (const v of project.vendors) {
      // Score select
      const scoreCell = document.createElement('td');
      scoreCell.className = 'px-2 py-2 text-center';
      const select = document.createElement('select');
      select.className = 'w-full text-center text-sm py-2 px-1 border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer';
      const currentScore = v.scores[c.id] ?? 0;
      for (const [scoreVal, label] of Object.entries(SCORE_LABELS)) {
        const opt = document.createElement('option');
        opt.value = scoreVal;
        opt.textContent = `${scoreVal} - ${label}`;
        if (Number(scoreVal) === currentScore) opt.selected = true;
        select.appendChild(opt);
      }
      const vid = v.id;
      const cid = c.id;
      select.addEventListener('change', () => setVendorScore(vid, cid, Number(select.value)));
      scoreCell.appendChild(select);
      row.appendChild(scoreCell);

      // Weighted score
      const vs = r?.vendorScores.find((s: VendorScore) => s.vendorId === v.id);
      const ws = vs?.weightedScore ?? 0;
      const weightedCell = h('td', { className: 'px-3 py-3 text-center text-sm font-mono text-gray-600 bg-gray-50/50' }, ws.toFixed(3));
      row.appendChild(weightedCell);
    }

    tbody.appendChild(row);
  }

  // Total row
  const totals = getVendorTotals();
  const totalRow = document.createElement('tr');
  totalRow.className = 'bg-amber-50 font-semibold border-t-2 border-amber-300';
  totalRow.appendChild(h('td', { className: 'sticky left-0 bg-amber-50 px-5 py-4 font-bold text-gray-800 border-r border-gray-200 z-10 text-base' }, 'Gesamtscore'));
  totalRow.appendChild(h('td', { className: 'px-4 py-4 text-center text-sm text-gray-600 border-r border-gray-200' }, '100%'));
  for (const v of project.vendors) {
    const total = totals.find((t) => t.vendorId === v.id);
    totalRow.appendChild(h('td', { className: 'px-3 py-4 text-center text-amber-700' }));
    totalRow.appendChild(h('td', { className: 'px-3 py-4 text-center text-xl font-bold text-amber-700' }, (total?.totalWeighted ?? 0).toFixed(3)));
  }
  tbody.appendChild(totalRow);

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  section.appendChild(tableWrap);

  return section;
}

// --- Results Section ---
function renderResultsSection(): HTMLElement {
  const project = getProject();
  const section = h('div', { className: 'mt-8 space-y-8' });

  if (project.criteria.length === 0 || project.vendors.length === 0) {
    const warn = h('div', { className: 'bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-base text-yellow-800' });
    warn.textContent = 'Bitte definieren Sie Kriterien und Anbieter, um Ergebnisse anzuzeigen.';
    section.appendChild(warn);
    return section;
  }

  // Info
  const info = h('div', { className: 'bg-amber-50 border border-amber-200 rounded-xl p-5 text-base text-amber-800' });
  info.innerHTML = `<strong>Ergebnisse:</strong> Uebersicht der gewichteten Bewertungen, Ranking und Empfehlung.`;
  section.appendChild(info);

  // Export buttons
  const exportBar = h('div', { className: 'flex flex-wrap gap-3' });

  const copyMdBtn = document.createElement('button');
  copyMdBtn.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors';
  copyMdBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg> Markdown kopieren`;
  copyMdBtn.addEventListener('click', handleCopyMarkdown);

  const dlMdBtn = document.createElement('button');
  dlMdBtn.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors';
  dlMdBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> Markdown herunterladen`;
  dlMdBtn.addEventListener('click', handleDownloadMarkdown);

  const chartPngBtn = document.createElement('button');
  chartPngBtn.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors';
  chartPngBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> Diagramm als PNG`;
  chartPngBtn.addEventListener('click', handleExportChartPng);

  exportBar.appendChild(copyMdBtn);
  exportBar.appendChild(dlMdBtn);
  exportBar.appendChild(chartPngBtn);
  section.appendChild(exportBar);

  // Ranking cards
  const totals = getVendorTotals().sort((a, b) => b.totalWeighted - a.totalWeighted);
  const maxScore = totals[0]?.totalWeighted ?? 0;

  const grid = h('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' });
  totals.forEach((t, i) => {
    const isWinner = i === 0 && maxScore > 0;
    const card = h('div', { className: `relative bg-white rounded-xl border-2 p-7 transition-shadow hover:shadow-lg ${isWinner ? 'border-amber-400 shadow-lg' : 'border-gray-200'}` });

    if (isWinner) {
      const badge = h('div', { className: 'absolute -top-3.5 left-5 bg-amber-500 text-white text-sm font-bold px-4 py-1.5 rounded-full' }, 'EMPFEHLUNG');
      card.appendChild(badge);
    }

    const rank = h('div', { className: `text-4xl font-bold ${isWinner ? 'text-amber-500' : 'text-gray-300'}` }, `#${i + 1}`);
    const name = h('div', { className: 'text-xl font-semibold text-gray-800 mt-2' }, t.vendorName);
    const score = h('div', { className: `text-3xl font-bold mt-3 ${isWinner ? 'text-amber-600' : 'text-gray-600'}` }, t.totalWeighted.toFixed(3));
    const scoreLabel = h('div', { className: 'text-sm text-gray-500 mt-1' }, 'Gesamtscore (gewichtet)');

    // Score bar
    const barBg = h('div', { className: 'mt-4 bg-gray-100 rounded-full h-3 overflow-hidden' });
    const barFill = h('div', { className: `h-full rounded-full ${isWinner ? 'bg-amber-400' : 'bg-gray-400'}` });
    barFill.style.width = maxScore > 0 ? `${(t.totalWeighted / 10) * 100}%` : '0%';
    barBg.appendChild(barFill);

    card.appendChild(rank);
    card.appendChild(name);
    card.appendChild(score);
    card.appendChild(scoreLabel);
    card.appendChild(barBg);
    grid.appendChild(card);
  });
  section.appendChild(grid);

  // Radar chart
  if (project.criteria.length >= 3) {
    const chartSection = h('div', { className: 'bg-white rounded-xl border border-gray-200 p-8' });
    chartSection.appendChild(h('h3', { className: 'text-lg font-semibold text-gray-700 mb-6' }, 'Netzdiagramm'));
    const canvasWrap = h('div', { className: 'max-w-4xl mx-auto' });
    const canvas = document.createElement('canvas');
    canvas.id = 'radar-chart';
    canvas.width = 600;
    canvas.height = 600;
    canvasWrap.appendChild(canvas);
    chartSection.appendChild(canvasWrap);
    section.appendChild(chartSection);
  }

  // Detailed comparison table
  const detailSection = h('div', { className: 'bg-white rounded-xl border border-gray-200 overflow-hidden' });
  detailSection.appendChild(h('div', { className: 'px-6 py-4 bg-gray-50 border-b border-gray-200' }, h('h3', { className: 'text-lg font-semibold text-gray-700' }, 'Detailvergleich')));

  const tableWrap = h('div', { className: 'overflow-x-auto' });
  const table = document.createElement('table');
  table.className = 'min-w-full text-base';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.appendChild(h('th', { className: 'sticky left-0 bg-gray-50 px-5 py-3 text-left font-medium text-gray-600 border-b border-r border-gray-200 z-10' }, 'Kriterium'));
  headerRow.appendChild(h('th', { className: 'px-4 py-3 text-center font-medium text-gray-600 border-b border-gray-200 bg-gray-50' }, 'Gewicht'));
  for (const t of totals) {
    headerRow.appendChild(h('th', { className: 'px-4 py-3 text-center font-medium text-gray-600 border-b border-gray-200 bg-gray-50' }, `${t.vendorName} (Bew.)`));
    headerRow.appendChild(h('th', { className: 'px-4 py-3 text-center font-medium text-gray-600 border-b border-gray-200 bg-gray-50' }, `${t.vendorName} (Gew.)`));
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const { relativeWeights } = calculateWeights();
  const results = calculateResults();
  const sorted = getCriteriaSortedByWeight();
  const tbody = document.createElement('tbody');

  for (const c of sorted) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50/50';
    row.appendChild(h('td', { className: 'sticky left-0 bg-white px-5 py-3 text-sm font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap z-10' }, c.name));
    row.appendChild(h('td', { className: 'px-4 py-3 text-center text-sm text-gray-500' }, `${((relativeWeights[c.id] ?? 0) * 100).toFixed(1)}%`));

    const r = results.find((r) => r.criterionId === c.id);
    // Find best score for this criterion
    const vendorWeightedScores = totals.map((t) => {
      const vs = r?.vendorScores.find((s: VendorScore) => s.vendorId === t.vendorId);
      return { vendorId: t.vendorId, weighted: vs?.weightedScore ?? 0, raw: vs?.rawScore ?? 0 };
    });
    const maxWeighted = Math.max(...vendorWeightedScores.map((s) => s.weighted));

    for (const t of totals) {
      const vs = r?.vendorScores.find((s: VendorScore) => s.vendorId === t.vendorId);
      const isBest = (vs?.weightedScore ?? 0) === maxWeighted && maxWeighted > 0;
      row.appendChild(h('td', { className: `px-4 py-3 text-center text-sm ${isBest ? 'font-semibold text-amber-700' : 'text-gray-600'}` }, String(vs?.rawScore ?? 0)));
      row.appendChild(h('td', { className: `px-4 py-3 text-center text-sm font-mono ${isBest ? 'font-semibold text-amber-700 bg-amber-50/50' : 'text-gray-500'}` }, (vs?.weightedScore ?? 0).toFixed(3)));
    }
    tbody.appendChild(row);
  }

  // Total row
  const totalRow = document.createElement('tr');
  totalRow.className = 'bg-amber-50 font-semibold border-t-2 border-amber-300';
  totalRow.appendChild(h('td', { className: 'sticky left-0 bg-amber-50 px-5 py-4 font-bold text-gray-800 border-r border-gray-200 z-10 text-base' }, 'Gesamtscore'));
  totalRow.appendChild(h('td', { className: 'px-4 py-4 text-center text-sm text-gray-600' }, ''));
  for (const t of totals) {
    totalRow.appendChild(h('td', { className: 'px-4 py-4' }));
    totalRow.appendChild(h('td', { className: 'px-4 py-4 text-center text-lg font-bold text-amber-700' }, t.totalWeighted.toFixed(3)));
  }
  tbody.appendChild(totalRow);

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  detailSection.appendChild(tableWrap);
  section.appendChild(detailSection);

  // Shortlist summary
  const summary = h('div', { className: 'bg-white rounded-xl border border-gray-200 p-7 space-y-4' });
  summary.appendChild(h('h3', { className: 'text-lg font-semibold text-gray-700' }, 'Zusammenfassung & Empfehlung'));

  if (totals.length > 0 && maxScore > 0) {
    const winner = totals[0];
    const recText = h('p', { className: 'text-base text-gray-700 leading-relaxed' });
    recText.innerHTML = `Basierend auf der Nutzwertanalyse mit ${project.criteria.length} gewichteten Kriterien und ${project.vendors.length} bewerteten Anbietern ist <strong class="text-amber-600">${winner.vendorName}</strong> mit einem Gesamtscore von <strong class="text-amber-600">${winner.totalWeighted.toFixed(3)}</strong> der empfohlene Anbieter.`;
    summary.appendChild(recText);

    if (totals.length > 1) {
      const diff = totals[0].totalWeighted - totals[1].totalWeighted;
      const diffText = h('p', { className: 'text-sm text-gray-500' });
      diffText.textContent = `Differenz zum zweitplatzierten Anbieter (${totals[1].vendorName}): ${diff.toFixed(3)} Punkte`;
      summary.appendChild(diffText);
    }
  } else if (totals.length > 0) {
    const noScoreText = h('p', { className: 'text-base text-gray-500' });
    noScoreText.textContent = 'Noch keine Bewertungen vorhanden. Bitte bewerten Sie die Anbieter im Tab "Anbieter & Bewertung".';
    summary.appendChild(noScoreText);

    // Shortlist
    const shortlistTitle = h('h4', { className: 'text-sm font-semibold text-gray-500 uppercase tracking-wider mt-6' }, 'Shortlist');
    summary.appendChild(shortlistTitle);
    const shortlist = h('div', { className: 'space-y-2' });
    totals.forEach((t, i) => {
      const item = h('div', { className: 'flex items-center gap-3 text-base' });
      const medal = i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : 'text-amber-700';
      item.appendChild(h('span', { className: `font-bold ${medal}` }, `${i + 1}.`));
      item.appendChild(h('span', { className: 'text-gray-700' }, t.vendorName));
      item.appendChild(h('span', { className: 'text-gray-400 font-mono text-sm' }, `(${t.totalWeighted.toFixed(3)})`));
      shortlist.appendChild(item);
    });
    summary.appendChild(shortlist);
  }

  section.appendChild(summary);

  return section;
}

// --- Import / Export ---
function handleExport(): void {
  const json = exportProject();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getProject().name.replace(/\s+/g, '_')}.json`;
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
        importProject(reader.result as string);
      } catch (e) {
        alert(`Import fehlgeschlagen: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`);
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// --- Confluence / Markdown Export ---
function generateResultsMarkdown(): string {
  const project = getProject();
  const totals = getVendorTotals().sort((a, b) => b.totalWeighted - a.totalWeighted);
  const { relativeWeights } = calculateWeights();
  const results = calculateResults();
  const sorted = getCriteriaSortedByWeight();

  const lines: string[] = [];

  // Title
  lines.push(`# Nutzwertanalyse: ${project.name}`);
  lines.push('');

  // Recommendation
  const mdMaxScore = totals[0]?.totalWeighted ?? 0;
  if (totals.length > 0 && mdMaxScore > 0) {
    const winner = totals[0];
    lines.push('## Empfehlung');
    lines.push('');
    lines.push(`Basierend auf der Nutzwertanalyse mit ${project.criteria.length} gewichteten Kriterien und ${project.vendors.length} bewerteten Anbietern ist **${winner.vendorName}** mit einem Gesamtscore von **${winner.totalWeighted.toFixed(3)}** der empfohlene Anbieter.`);
    lines.push('');

    if (totals.length > 1) {
      const diff = totals[0].totalWeighted - totals[1].totalWeighted;
      lines.push(`Differenz zum zweitplatzierten Anbieter (${totals[1].vendorName}): ${diff.toFixed(3)} Punkte`);
      lines.push('');
    }
  }

  // Shortlist / Ranking
  lines.push('## Ranking');
  lines.push('');
  lines.push('| Rang | Anbieter | Gesamtscore |');
  lines.push('|------|----------|-------------|');
  totals.forEach((t, i) => {
    const marker = i === 0 && mdMaxScore > 0 ? ' **(Empfehlung)**' : '';
    lines.push(`| ${i + 1} | ${t.vendorName}${marker} | ${t.totalWeighted.toFixed(3)} |`);
  });
  lines.push('');

  // Detail table
  lines.push('## Detailvergleich');
  lines.push('');

  // Header
  const headerCols = ['Kriterium', 'Gewicht'];
  for (const t of totals) {
    headerCols.push(`${t.vendorName} (Bew.)`);
    headerCols.push(`${t.vendorName} (Gew.)`);
  }
  lines.push('| ' + headerCols.join(' | ') + ' |');
  lines.push('|' + headerCols.map(() => '---').join('|') + '|');

  // Rows
  for (const c of sorted) {
    const cols: string[] = [c.name, `${((relativeWeights[c.id] ?? 0) * 100).toFixed(1)}%`];
    const r = results.find((r) => r.criterionId === c.id);
    for (const t of totals) {
      const vs = r?.vendorScores.find((s: VendorScore) => s.vendorId === t.vendorId);
      cols.push(String(vs?.rawScore ?? 0));
      cols.push((vs?.weightedScore ?? 0).toFixed(3));
    }
    lines.push('| ' + cols.join(' | ') + ' |');
  }

  // Total row
  const totalCols: string[] = ['**Gesamtscore**', ''];
  for (const t of totals) {
    totalCols.push('');
    totalCols.push(`**${t.totalWeighted.toFixed(3)}**`);
  }
  lines.push('| ' + totalCols.join(' | ') + ' |');
  lines.push('');

  return lines.join('\n');
}

function handleCopyMarkdown(): void {
  const md = generateResultsMarkdown();
  navigator.clipboard.writeText(md).then(() => {
    showToast('Markdown in Zwischenablage kopiert');
  }).catch(() => {
    // Fallback: download as file
    downloadText(md, `${getProject().name.replace(/\s+/g, '_')}_Ergebnisse.md`, 'text/markdown');
  });
}

function handleDownloadMarkdown(): void {
  const md = generateResultsMarkdown();
  downloadText(md, `${getProject().name.replace(/\s+/g, '_')}_Ergebnisse.md`, 'text/markdown');
}

function handleExportChartPng(): void {
  const canvas = document.getElementById('radar-chart') as HTMLCanvasElement | null;
  if (!canvas) {
    alert('Kein Diagramm vorhanden. Bitte mindestens 3 Kriterien definieren.');
    return;
  }
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getProject().name.replace(/\s+/g, '_')}_Netzdiagramm.png`;
  a.click();
}

function downloadText(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function showToast(message: string): void {
  const toast = h('div', { className: 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-xl text-sm font-medium z-50 transition-opacity' }, message);
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// --- Utils ---
function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str;
}

// --- Init ---
render();
