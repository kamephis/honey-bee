import './style.css';
import {
  PRESET_INITIAL_COSTS,
  PRESET_ANNUAL_COSTS,
  PRESET_BENEFITS,
} from './tco-types';
import {
  getProject,
  subscribe,
  setProjectName,
  setYears,
  setDiscountRate,
  addOption,
  updateOptionName,
  removeOption,
  addInitialCost,
  updateInitialCost,
  removeInitialCost,
  addAnnualCost,
  updateAnnualCost,
  removeAnnualCost,
  addBenefit,
  updateBenefit,
  removeBenefit,
  calculateAllResults,
  calculateTotalAnnualBenefit,
  calculateRoi,
  exportProject,
  importProject,
} from './tco-state';
import { renderTcoComparisonChart, renderBreakEvenChart } from './tco-chart';

const app = document.getElementById('app')!;

type Tab = 'options' | 'costs' | 'benefits' | 'results';
let activeTab: Tab = 'options';

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
  app.innerHTML = '';
  app.appendChild(renderHeader());
  app.appendChild(renderTabs());
  const content = h('div', { className: 'mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 pb-16' });
  switch (activeTab) {
    case 'options':
      content.appendChild(renderOptionsSection());
      break;
    case 'costs':
      content.appendChild(renderCostsSection());
      break;
    case 'benefits':
      content.appendChild(renderBenefitsSection());
      break;
    case 'results':
      content.appendChild(renderResultsSection());
      break;
  }
  app.appendChild(content);

  if (activeTab === 'results') {
    requestAnimationFrame(() => {
      const tcoCanvas = document.getElementById('tco-chart') as HTMLCanvasElement | null;
      if (tcoCanvas) renderTcoComparisonChart(tcoCanvas);
      const beCanvas = document.getElementById('break-even-chart') as HTMLCanvasElement | null;
      if (beCanvas) renderBreakEvenChart(beCanvas);
    });
  }
}

// --- Header ---
function renderHeader(): HTMLElement {
  const project = getProject();
  const header = h('header', { className: 'bg-white border-b border-gray-200 shadow-sm' });
  const inner = h('div', { className: 'mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 py-5 flex items-center justify-between flex-wrap gap-4' });

  const left = h('div', { className: 'flex items-center gap-3' });
  const logo = h('div', { className: 'text-3xl font-bold text-amber-500' }, 'TCO');
  left.appendChild(logo);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = project.name;
  nameInput.className = 'text-xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-amber-500 focus:outline-none px-2 py-1 transition-colors';
  nameInput.addEventListener('change', () => setProjectName(nameInput.value));
  left.appendChild(nameInput);

  // Right: tools link + import/export
  const right = h('div', { className: 'flex items-center gap-3' });

  const nwaLink = document.createElement('a');
  const basePath = import.meta.env.BASE_URL ?? '/honey-bee/';
  nwaLink.href = `${basePath}`;
  nwaLink.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors';
  nwaLink.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> Nutzwertanalyse`;
  right.appendChild(nwaLink);

  const exportBtn = document.createElement('button');
  exportBtn.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors';
  exportBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> Export`;
  exportBtn.addEventListener('click', handleExport);

  const importBtn = document.createElement('button');
  importBtn.className = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors';
  importBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg> Import`;
  importBtn.addEventListener('click', handleImport);

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
    { key: 'options', label: 'Optionen', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>' },
    { key: 'costs', label: 'Kostenstruktur', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' },
    { key: 'benefits', label: 'Nutzen & Einsparungen', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>' },
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

// --- Options Section ---
function renderOptionsSection(): HTMLElement {
  const project = getProject();
  const section = h('div', { className: 'mt-8 space-y-8' });

  const info = h('div', { className: 'bg-amber-50 border border-amber-200 rounded-xl p-5 text-base text-amber-800' });
  info.innerHTML = `<strong>Schritt 1:</strong> Definieren Sie die zu vergleichenden Optionen (z.B. Anbieter, Loesungen, Make-vs-Buy) und legen Sie den Betrachtungszeitraum fest.`;
  section.appendChild(info);

  // Project settings
  const settings = h('div', { className: 'bg-white rounded-xl border border-gray-200 p-6 space-y-4' });
  settings.appendChild(h('h3', { className: 'text-lg font-semibold text-gray-700' }, 'Projekteinstellungen'));

  const settingsGrid = h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' });

  // Years
  const yearsGroup = h('div', { className: 'space-y-1' });
  yearsGroup.appendChild(h('label', { className: 'text-sm font-medium text-gray-600' }, 'Betrachtungszeitraum (Jahre)'));
  const yearsInput = document.createElement('input');
  yearsInput.type = 'number';
  yearsInput.min = '1';
  yearsInput.max = '15';
  yearsInput.value = String(project.years);
  yearsInput.className = 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-base';
  yearsInput.addEventListener('change', () => setYears(Number(yearsInput.value)));
  yearsGroup.appendChild(yearsInput);
  settingsGrid.appendChild(yearsGroup);

  // Discount rate
  const rateGroup = h('div', { className: 'space-y-1' });
  rateGroup.appendChild(h('label', { className: 'text-sm font-medium text-gray-600' }, 'Kalkulationszinssatz / Diskontrate (%)'));
  const rateInput = document.createElement('input');
  rateInput.type = 'number';
  rateInput.min = '0';
  rateInput.max = '50';
  rateInput.step = '0.5';
  rateInput.value = String(project.discountRate);
  rateInput.className = 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-base';
  rateInput.addEventListener('change', () => setDiscountRate(Number(rateInput.value)));
  rateGroup.appendChild(rateInput);
  settingsGrid.appendChild(rateGroup);

  settings.appendChild(settingsGrid);
  section.appendChild(settings);

  // Add option form
  const form = h('div', { className: 'flex gap-3' });
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Neue Option / Anbieter hinzufuegen...';
  input.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-base';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      addOption(input.value.trim());
      input.value = '';
    }
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'inline-flex items-center gap-2 px-5 py-3 text-base font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors';
  addBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Hinzufuegen`;
  addBtn.addEventListener('click', () => {
    if (input.value.trim()) {
      addOption(input.value.trim());
      input.value = '';
    }
  });
  form.appendChild(input);
  form.appendChild(addBtn);
  section.appendChild(form);

  // Options list
  if (project.options.length === 0) {
    const empty = h('div', { className: 'text-center py-16 text-gray-400' });
    empty.innerHTML = `<svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg><p class="text-base">Noch keine Optionen vorhanden. Fuegen Sie Ihre erste Option hinzu.</p>`;
    section.appendChild(empty);
  } else {
    const list = h('div', { className: 'bg-white rounded-xl border border-gray-200 divide-y divide-gray-200' });
    project.options.forEach((o, i) => {
      const row = h('div', { className: 'flex items-center gap-4 px-5 py-4' });
      row.appendChild(h('span', { className: 'text-sm font-mono text-gray-400 w-8 text-right' }, `${i + 1}.`));

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = o.name;
      nameInput.className = 'flex-1 px-3 py-2 border border-transparent rounded-lg hover:border-gray-300 focus:border-amber-500 focus:outline-none text-base transition-colors';
      nameInput.addEventListener('change', () => updateOptionName(o.id, nameInput.value));
      row.appendChild(nameInput);

      const costSummary = h('span', { className: 'text-sm text-gray-400 whitespace-nowrap' },
        `${o.initialCosts.length + o.annualCosts.length} Kostenpositionen`);
      row.appendChild(costSummary);

      const delBtn = document.createElement('button');
      delBtn.className = 'p-2 text-gray-400 hover:text-red-500 transition-colors';
      delBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;
      delBtn.addEventListener('click', () => {
        if (confirm(`Option "${o.name}" wirklich loeschen?`)) removeOption(o.id);
      });
      row.appendChild(delBtn);

      list.appendChild(row);
    });
    section.appendChild(list);
  }

  return section;
}

// --- Costs Section ---
function renderCostsSection(): HTMLElement {
  const project = getProject();
  const section = h('div', { className: 'mt-8 space-y-8' });

  if (project.options.length === 0) {
    const warn = h('div', { className: 'bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-base text-yellow-800' });
    warn.textContent = 'Bitte definieren Sie zuerst Optionen im Tab "Optionen".';
    section.appendChild(warn);
    return section;
  }

  const info = h('div', { className: 'bg-amber-50 border border-amber-200 rounded-xl p-5 text-base text-amber-800' });
  info.innerHTML = `<strong>Schritt 2:</strong> Erfassen Sie die Kosten fuer jede Option. Unterscheiden Sie zwischen einmaligen Kosten (Investitionen) und jaehrlich wiederkehrenden Kosten.`;
  section.appendChild(info);

  for (const option of project.options) {
    const card = h('div', { className: 'bg-white rounded-xl border border-gray-200 overflow-hidden' });

    // Option header
    const cardHeader = h('div', { className: 'px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between' });
    cardHeader.appendChild(h('h3', { className: 'text-lg font-semibold text-gray-700' }, option.name));

    const totalInitial = option.initialCosts.reduce((s, c) => s + c.amount, 0);
    const totalAnnual = option.annualCosts.reduce((s, c) => s + c.amount, 0);
    cardHeader.appendChild(h('span', { className: 'text-sm text-gray-500' },
      `Einmalig: ${fmtCHF(totalInitial)} | Jaehrlich: ${fmtCHF(totalAnnual)}`));
    card.appendChild(cardHeader);

    const cardBody = h('div', { className: 'p-6 space-y-6' });

    // Initial costs
    cardBody.appendChild(renderCostBlock(
      'Einmalige Kosten',
      option.initialCosts,
      option.id,
      'initial',
      PRESET_INITIAL_COSTS,
    ));

    // Annual costs
    cardBody.appendChild(renderCostBlock(
      'Jaehrlich wiederkehrende Kosten',
      option.annualCosts,
      option.id,
      'annual',
      PRESET_ANNUAL_COSTS,
    ));

    card.appendChild(cardBody);
    section.appendChild(card);
  }

  return section;
}

function renderCostBlock(
  title: string,
  items: { id: string; name: string; amount: number }[],
  optionId: string,
  type: 'initial' | 'annual',
  presets: string[],
): HTMLElement {
  const block = h('div', { className: 'space-y-3' });
  block.appendChild(h('h4', { className: 'text-base font-semibold text-gray-600' }, title));

  // Items
  for (const item of items) {
    const row = h('div', { className: 'flex items-center gap-3' });

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = item.name;
    nameInput.className = 'flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm transition-colors';
    nameInput.addEventListener('change', () => {
      if (type === 'initial') updateInitialCost(optionId, item.id, { name: nameInput.value });
      else updateAnnualCost(optionId, item.id, { name: nameInput.value });
    });
    row.appendChild(nameInput);

    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.min = '0';
    amountInput.step = '100';
    amountInput.value = String(item.amount);
    amountInput.className = 'w-40 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm text-right font-mono transition-colors';
    amountInput.addEventListener('change', () => {
      if (type === 'initial') updateInitialCost(optionId, item.id, { amount: Number(amountInput.value) });
      else updateAnnualCost(optionId, item.id, { amount: Number(amountInput.value) });
    });
    row.appendChild(amountInput);
    row.appendChild(h('span', { className: 'text-sm text-gray-400' }, 'CHF'));

    const delBtn = document.createElement('button');
    delBtn.className = 'p-1.5 text-gray-400 hover:text-red-500 transition-colors';
    delBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
    delBtn.addEventListener('click', () => {
      if (type === 'initial') removeInitialCost(optionId, item.id);
      else removeAnnualCost(optionId, item.id);
    });
    row.appendChild(delBtn);

    block.appendChild(row);
  }

  // Total
  const sum = items.reduce((s, c) => s + c.amount, 0);
  if (items.length > 0) {
    const totalRow = h('div', { className: 'flex items-center justify-end gap-3 pt-2 border-t border-gray-100' });
    totalRow.appendChild(h('span', { className: 'text-sm font-semibold text-gray-600' }, 'Summe:'));
    totalRow.appendChild(h('span', { className: 'text-sm font-bold font-mono text-amber-600 w-40 text-right' }, fmtCHF(sum)));
    totalRow.appendChild(h('span', { className: 'text-sm text-transparent' }, 'CHF'));
    totalRow.appendChild(h('span', { className: 'w-7' }));
    block.appendChild(totalRow);
  }

  // Add new / presets
  const addRow = h('div', { className: 'flex gap-2 flex-wrap' });

  const addBtn = document.createElement('button');
  addBtn.className = 'inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors';
  addBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Neue Position`;
  addBtn.addEventListener('click', () => {
    if (type === 'initial') addInitialCost(optionId, 'Neue Position');
    else addAnnualCost(optionId, 'Neue Position');
  });
  addRow.appendChild(addBtn);

  // Preset chips
  const existingNames = new Set(items.map((i) => i.name));
  for (const name of presets) {
    if (existingNames.has(name)) continue;
    const chip = document.createElement('button');
    chip.className = 'px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-500 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors';
    chip.textContent = name;
    chip.addEventListener('click', () => {
      if (type === 'initial') addInitialCost(optionId, name);
      else addAnnualCost(optionId, name);
    });
    addRow.appendChild(chip);
  }

  block.appendChild(addRow);
  return block;
}

// --- Benefits Section ---
function renderBenefitsSection(): HTMLElement {
  const project = getProject();
  const section = h('div', { className: 'mt-8 space-y-8' });

  const info = h('div', { className: 'bg-amber-50 border border-amber-200 rounded-xl p-5 text-base text-amber-800' });
  info.innerHTML = `<strong>Schritt 3:</strong> Erfassen Sie den erwarteten jaehrlichen Nutzen und die Einsparungen, die durch die Investition entstehen. Diese Werte werden fuer die ROI- und Break-Even-Berechnung verwendet.`;
  section.appendChild(info);

  const card = h('div', { className: 'bg-white rounded-xl border border-gray-200 p-6 space-y-4' });
  card.appendChild(h('h3', { className: 'text-lg font-semibold text-gray-700' }, 'Erwarteter jaehrlicher Nutzen'));

  for (const benefit of project.benefits) {
    const row = h('div', { className: 'flex items-center gap-3' });

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = benefit.name;
    nameInput.className = 'flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm transition-colors';
    nameInput.addEventListener('change', () => updateBenefit(benefit.id, { name: nameInput.value }));
    row.appendChild(nameInput);

    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.min = '0';
    amountInput.step = '100';
    amountInput.value = String(benefit.annualAmount);
    amountInput.className = 'w-40 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm text-right font-mono transition-colors';
    amountInput.addEventListener('change', () => updateBenefit(benefit.id, { annualAmount: Number(amountInput.value) }));
    row.appendChild(amountInput);
    row.appendChild(h('span', { className: 'text-sm text-gray-400' }, 'CHF/Jahr'));

    const delBtn = document.createElement('button');
    delBtn.className = 'p-1.5 text-gray-400 hover:text-red-500 transition-colors';
    delBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
    delBtn.addEventListener('click', () => removeBenefit(benefit.id));
    row.appendChild(delBtn);

    card.appendChild(row);
  }

  // Total
  const totalBenefit = calculateTotalAnnualBenefit();
  if (project.benefits.length > 0) {
    const totalRow = h('div', { className: 'flex items-center justify-end gap-3 pt-3 border-t border-gray-100' });
    totalRow.appendChild(h('span', { className: 'text-sm font-semibold text-gray-600' }, 'Jaehrlicher Gesamtnutzen:'));
    totalRow.appendChild(h('span', { className: 'text-base font-bold font-mono text-green-600 w-40 text-right' }, fmtCHF(totalBenefit)));
    totalRow.appendChild(h('span', { className: 'text-sm text-gray-400' }, 'CHF/Jahr'));
    totalRow.appendChild(h('span', { className: 'w-7' }));
    card.appendChild(totalRow);

    const projectedRow = h('div', { className: 'flex items-center justify-end gap-3' });
    projectedRow.appendChild(h('span', { className: 'text-sm text-gray-500' }, `Ueber ${project.years} Jahre:`));
    projectedRow.appendChild(h('span', { className: 'text-sm font-semibold font-mono text-green-600 w-40 text-right' }, fmtCHF(totalBenefit * project.years)));
    projectedRow.appendChild(h('span', { className: 'text-sm text-transparent' }, 'CHF/Jahr'));
    projectedRow.appendChild(h('span', { className: 'w-7' }));
    card.appendChild(projectedRow);
  }

  // Add / presets
  const addRow = h('div', { className: 'flex gap-2 flex-wrap pt-2' });
  const addBtn = document.createElement('button');
  addBtn.className = 'inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors';
  addBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Neue Position`;
  addBtn.addEventListener('click', () => addBenefit('Neuer Nutzen'));
  addRow.appendChild(addBtn);

  const existingNames = new Set(project.benefits.map((b) => b.name));
  for (const name of PRESET_BENEFITS) {
    if (existingNames.has(name)) continue;
    const chip = document.createElement('button');
    chip.className = 'px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-500 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors';
    chip.textContent = name;
    chip.addEventListener('click', () => addBenefit(name));
    addRow.appendChild(chip);
  }

  card.appendChild(addRow);
  section.appendChild(card);

  return section;
}

// --- Results Section ---
function renderResultsSection(): HTMLElement {
  const project = getProject();
  const section = h('div', { className: 'mt-8 space-y-8' });

  if (project.options.length === 0) {
    const warn = h('div', { className: 'bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-base text-yellow-800' });
    warn.textContent = 'Bitte definieren Sie Optionen und Kosten, um Ergebnisse anzuzeigen.';
    section.appendChild(warn);
    return section;
  }

  const info = h('div', { className: 'bg-amber-50 border border-amber-200 rounded-xl p-5 text-base text-amber-800' });
  info.innerHTML = `<strong>Ergebnisse:</strong> TCO-Vergleich, ROI und Break-Even-Analyse ueber ${project.years} Jahre mit ${project.discountRate}% Diskontrate.`;
  section.appendChild(info);

  const results = calculateAllResults();
  const roiResults = calculateRoi();
  const annualBenefit = calculateTotalAnnualBenefit();

  // --- TCO Overview Cards ---
  const sortedResults = [...results].sort((a, b) => a.tco - b.tco);
  const grid = h('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' });

  sortedResults.forEach((r, i) => {
    const isBest = i === 0 && results.length > 1;
    const card = h('div', { className: `relative bg-white rounded-xl border-2 p-7 transition-shadow hover:shadow-lg ${isBest ? 'border-amber-400 shadow-lg' : 'border-gray-200'}` });

    if (isBest) {
      card.appendChild(h('div', { className: 'absolute -top-3.5 left-5 bg-amber-500 text-white text-sm font-bold px-4 py-1.5 rounded-full' }, 'GUENSTIGSTE'));
    }

    card.appendChild(h('div', { className: `text-4xl font-bold ${isBest ? 'text-amber-500' : 'text-gray-300'}` }, `#${i + 1}`));
    card.appendChild(h('div', { className: 'text-xl font-semibold text-gray-800 mt-2' }, r.optionName));
    card.appendChild(h('div', { className: `text-3xl font-bold mt-3 ${isBest ? 'text-amber-600' : 'text-gray-600'}` }, fmtCHF(r.tco)));
    card.appendChild(h('div', { className: 'text-sm text-gray-500 mt-1' }, `TCO ueber ${project.years} Jahre`));

    const details = h('div', { className: 'mt-4 space-y-1 text-sm' });
    details.appendChild(renderKV('Einmalig', fmtCHF(r.totalInitial)));
    details.appendChild(renderKV('Jaehrlich', fmtCHF(r.totalAnnual)));
    details.appendChild(renderKV('NPV', fmtCHF(r.npv)));
    card.appendChild(details);

    grid.appendChild(card);
  });
  section.appendChild(grid);

  // --- TCO Comparison Chart ---
  const tcoChartSection = h('div', { className: 'bg-white rounded-xl border border-gray-200 p-8' });
  tcoChartSection.appendChild(h('h3', { className: 'text-lg font-semibold text-gray-700 mb-6' }, 'TCO-Vergleich'));
  const tcoCanvasWrap = h('div', { className: 'max-w-4xl mx-auto' });
  const tcoCanvas = document.createElement('canvas');
  tcoCanvas.id = 'tco-chart';
  tcoCanvas.width = 700;
  tcoCanvas.height = 400;
  tcoCanvasWrap.appendChild(tcoCanvas);
  tcoChartSection.appendChild(tcoCanvasWrap);
  section.appendChild(tcoChartSection);

  // --- ROI Cards ---
  if (annualBenefit > 0) {
    section.appendChild(h('h3', { className: 'text-lg font-semibold text-gray-700' }, 'ROI & Break-Even'));

    const roiGrid = h('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' });
    for (const roi of roiResults) {
      const card = h('div', { className: 'bg-white rounded-xl border border-gray-200 p-6 space-y-3' });
      card.appendChild(h('div', { className: 'text-lg font-semibold text-gray-700' }, roi.optionName));

      const roiColor = roi.roiPercent > 0 ? 'text-green-600' : roi.roiPercent < 0 ? 'text-red-500' : 'text-gray-600';
      card.appendChild(h('div', { className: `text-3xl font-bold ${roiColor}` }, `${roi.roiPercent.toFixed(1)}%`));
      card.appendChild(h('div', { className: 'text-sm text-gray-500' }, 'Return on Investment'));

      const details = h('div', { className: 'space-y-1 text-sm pt-2 border-t border-gray-100' });
      details.appendChild(renderKV('TCO', fmtCHF(roi.tco)));
      details.appendChild(renderKV('Gesamtnutzen', fmtCHF(roi.totalBenefit)));
      const netColor = roi.netBenefit >= 0 ? 'text-green-600' : 'text-red-500';
      const netRow = h('div', { className: 'flex justify-between' });
      netRow.appendChild(h('span', { className: 'text-gray-500' }, 'Nettonutzen'));
      netRow.appendChild(h('span', { className: `font-mono font-semibold ${netColor}` }, fmtCHF(roi.netBenefit)));
      details.appendChild(netRow);

      const beRow = h('div', { className: 'flex justify-between' });
      beRow.appendChild(h('span', { className: 'text-gray-500' }, 'Break-Even'));
      beRow.appendChild(h('span', { className: 'font-mono font-semibold text-gray-700' },
        roi.breakEvenYear !== null ? `Jahr ${roi.breakEvenYear}` : `> ${project.years} Jahre`));
      details.appendChild(beRow);

      card.appendChild(details);
      roiGrid.appendChild(card);
    }
    section.appendChild(roiGrid);

    // --- Break-Even Chart ---
    const beChartSection = h('div', { className: 'bg-white rounded-xl border border-gray-200 p-8' });
    beChartSection.appendChild(h('h3', { className: 'text-lg font-semibold text-gray-700 mb-6' }, 'Break-Even-Analyse'));
    const beCanvasWrap = h('div', { className: 'max-w-4xl mx-auto' });
    const beCanvas = document.createElement('canvas');
    beCanvas.id = 'break-even-chart';
    beCanvas.width = 700;
    beCanvas.height = 400;
    beCanvasWrap.appendChild(beCanvas);
    beChartSection.appendChild(beCanvasWrap);
    section.appendChild(beChartSection);
  }

  // --- Detailed yearly table ---
  section.appendChild(renderYearlyTable(results));

  return section;
}

function renderYearlyTable(results: ReturnType<typeof calculateAllResults>): HTMLElement {
  const project = getProject();
  const wrapper = h('div', { className: 'bg-white rounded-xl border border-gray-200 overflow-hidden' });
  wrapper.appendChild(h('div', { className: 'px-6 py-4 bg-gray-50 border-b border-gray-200' },
    h('h3', { className: 'text-lg font-semibold text-gray-700' }, 'Jaehrliche Kostenentwicklung')));

  const tableWrap = h('div', { className: 'overflow-x-auto' });
  const table = document.createElement('table');
  table.className = 'min-w-full text-sm';

  // Header
  const thead = document.createElement('thead');
  const hRow = document.createElement('tr');
  hRow.appendChild(h('th', { className: 'sticky left-0 bg-gray-50 px-4 py-3 text-left font-medium text-gray-600 border-b border-r border-gray-200 z-10' }, 'Jahr'));

  for (const r of results) {
    hRow.appendChild(h('th', { className: 'px-4 py-3 text-center font-medium text-gray-600 border-b border-gray-200 bg-gray-50' }, `${r.optionName} (Jahr)`));
    hRow.appendChild(h('th', { className: 'px-4 py-3 text-center font-medium text-gray-600 border-b border-gray-200 bg-gray-50' }, `${r.optionName} (Kum.)`));
  }
  thead.appendChild(hRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  for (let y = 0; y <= project.years; y++) {
    const row = document.createElement('tr');
    row.className = y % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';

    row.appendChild(h('td', { className: 'sticky left-0 bg-inherit px-4 py-3 font-medium text-gray-700 border-r border-gray-200 z-10' }, `Jahr ${y}`));

    for (const r of results) {
      const yc = r.yearlyCosts[y];
      row.appendChild(h('td', { className: 'px-4 py-3 text-center font-mono text-gray-600' }, fmtCHF(yc.total)));
      row.appendChild(h('td', { className: 'px-4 py-3 text-center font-mono font-semibold text-gray-700' }, fmtCHF(yc.cumulative)));
    }

    tbody.appendChild(row);
  }

  // NPV row
  const npvRow = document.createElement('tr');
  npvRow.className = 'bg-amber-50 font-semibold border-t-2 border-amber-300';
  npvRow.appendChild(h('td', { className: 'sticky left-0 bg-amber-50 px-4 py-3 font-bold text-gray-800 border-r border-gray-200 z-10' }, 'NPV'));
  for (const r of results) {
    npvRow.appendChild(h('td', { className: 'px-4 py-3' }));
    npvRow.appendChild(h('td', { className: 'px-4 py-3 text-center font-mono font-bold text-amber-700' }, fmtCHF(r.npv)));
  }
  tbody.appendChild(npvRow);

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  wrapper.appendChild(tableWrap);
  return wrapper;
}

// --- Import / Export ---
function handleExport(): void {
  const json = exportProject();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getProject().name.replace(/\s+/g, '_')}_TCO.json`;
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

// --- Utils ---
function fmtCHF(value: number): string {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function renderKV(key: string, value: string): HTMLElement {
  const row = h('div', { className: 'flex justify-between' });
  row.appendChild(h('span', { className: 'text-gray-500' }, key));
  row.appendChild(h('span', { className: 'font-mono font-semibold text-gray-700' }, value));
  return row;
}

// --- Init ---
render();
