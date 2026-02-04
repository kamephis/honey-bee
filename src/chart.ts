import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import type { VendorScore } from './types';
import { getProject, calculateResults, getCriteriaSortedByWeight } from './state';

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const COLORS = [
  { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgb(59, 130, 246)' },
  { bg: 'rgba(249, 115, 22, 0.2)', border: 'rgb(249, 115, 22)' },
  { bg: 'rgba(16, 185, 129, 0.2)', border: 'rgb(16, 185, 129)' },
  { bg: 'rgba(139, 92, 246, 0.2)', border: 'rgb(139, 92, 246)' },
  { bg: 'rgba(236, 72, 153, 0.2)', border: 'rgb(236, 72, 153)' },
  { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgb(245, 158, 11)' },
  { bg: 'rgba(20, 184, 166, 0.2)', border: 'rgb(20, 184, 166)' },
  { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgb(239, 68, 68)' },
];

let chartInstance: Chart | null = null;

export function renderRadarChart(canvas: HTMLCanvasElement): void {
  const project = getProject();
  const results = calculateResults();
  const sortedCriteria = getCriteriaSortedByWeight();

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (sortedCriteria.length < 3 || project.vendors.length === 0) return;

  const labels = sortedCriteria.map((c) => c.name);

  const datasets = project.vendors.map((v, i) => {
    const color = COLORS[i % COLORS.length];
    const data = sortedCriteria.map((c) => {
      const r = results.find((r) => r.criterionId === c.id);
      const vs = r?.vendorScores.find((s: VendorScore) => s.vendorId === v.id);
      return vs?.weightedScore ?? 0;
    });
    return {
      label: v.name,
      data,
      backgroundColor: color.bg,
      borderColor: color.border,
      borderWidth: 2,
      pointBackgroundColor: color.border,
      pointRadius: 3,
    };
  });

  chartInstance = new Chart(canvas, {
    type: 'radar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          beginAtZero: true,
          ticks: {
            stepSize: 0.2,
          },
          pointLabels: {
            font: { size: 11 },
          },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 20 },
        },
      },
    },
  });
}
