import {
  Chart,
  BarController,
  LineController,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { OptionResult } from './tco-types';
import { getProject, calculateAllResults, calculateTotalAnnualBenefit } from './tco-state';

Chart.register(BarController, LineController, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);

const COLORS = [
  { bg: 'rgba(59, 130, 246, 0.6)', border: 'rgb(59, 130, 246)', light: 'rgba(59, 130, 246, 0.15)' },
  { bg: 'rgba(249, 115, 22, 0.6)', border: 'rgb(249, 115, 22)', light: 'rgba(249, 115, 22, 0.15)' },
  { bg: 'rgba(16, 185, 129, 0.6)', border: 'rgb(16, 185, 129)', light: 'rgba(16, 185, 129, 0.15)' },
  { bg: 'rgba(139, 92, 246, 0.6)', border: 'rgb(139, 92, 246)', light: 'rgba(139, 92, 246, 0.15)' },
  { bg: 'rgba(236, 72, 153, 0.6)', border: 'rgb(236, 72, 153)', light: 'rgba(236, 72, 153, 0.15)' },
  { bg: 'rgba(245, 158, 11, 0.6)', border: 'rgb(245, 158, 11)', light: 'rgba(245, 158, 11, 0.15)' },
];

let tcoChartInstance: Chart | null = null;
let breakEvenChartInstance: Chart | null = null;

export function renderTcoComparisonChart(canvas: HTMLCanvasElement): void {
  if (tcoChartInstance) {
    tcoChartInstance.destroy();
    tcoChartInstance = null;
  }

  const results = calculateAllResults();
  if (results.length === 0) return;

  const labels = results.map((r) => r.optionName);

  tcoChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Einmalige Kosten',
          data: results.map((r) => r.totalInitial),
          backgroundColor: 'rgba(245, 158, 11, 0.7)',
          borderColor: 'rgb(245, 158, 11)',
          borderWidth: 1,
        },
        {
          label: 'Laufende Kosten (gesamt)',
          data: results.map((r) => r.totalAnnual * getProject().years),
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 20, font: { size: 13 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          stacked: true,
          ticks: {
            callback: (val) => formatCurrency(val as number),
          },
        },
      },
    },
  });
}

export function renderBreakEvenChart(canvas: HTMLCanvasElement): void {
  if (breakEvenChartInstance) {
    breakEvenChartInstance.destroy();
    breakEvenChartInstance = null;
  }

  const project = getProject();
  const results = calculateAllResults();
  const annualBenefit = calculateTotalAnnualBenefit();

  if (results.length === 0) return;

  const labels = Array.from({ length: project.years + 1 }, (_, i) => `Jahr ${i}`);

  const datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    borderWidth: number;
    tension: number;
    fill: boolean;
    pointRadius: number;
    borderDash?: number[];
  }[] = [];

  // Cost lines per option
  results.forEach((r: OptionResult, i: number) => {
    const color = COLORS[i % COLORS.length];
    datasets.push({
      label: `${r.optionName} (Kosten)`,
      data: r.yearlyCosts.map((yc) => yc.cumulative),
      borderColor: color.border,
      backgroundColor: color.light,
      borderWidth: 2,
      tension: 0.3,
      fill: false,
      pointRadius: 4,
    });
  });

  // Benefit line
  if (annualBenefit > 0) {
    datasets.push({
      label: 'Kumulierter Nutzen',
      data: Array.from({ length: project.years + 1 }, (_, i) => annualBenefit * i),
      borderColor: 'rgb(16, 185, 129)',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderWidth: 3,
      tension: 0.3,
      fill: true,
      pointRadius: 4,
      borderDash: [6, 3],
    });
  }

  breakEvenChartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 20, font: { size: 13 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
          },
        },
      },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.05)' } },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => formatCurrency(val as number),
          },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
      },
    },
  });
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} Mio.`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} Tsd.`;
  return value.toLocaleString('de-CH');
}
