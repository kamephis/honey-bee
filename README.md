# honey-bee — Utility Analysis & TCO Calculator

A professional web application for vendor evaluation combining utility analysis (Nutzwertanalyse) with Total Cost of Ownership (TCO) calculation, ROI analysis, and break-even projections. Built with TypeScript, TailwindCSS, and Chart.js — deployed as a static site via GitHub Pages.

Both tools share a unified data model with persistent localStorage storage and seamless cross-navigation.

## Features

### Utility Analysis (Nutzwertanalyse)

#### Criteria Management

Define and manage the evaluation criteria for your analysis. The app ships with 14 preset criteria (e.g. technical competence, cost structure, UX/UI design competence) that can be added with a single click. Criteria can be freely added, renamed, and removed at any time.

#### Pairwise Comparison

Establish criterion weights through a structured pairwise comparison matrix. For each pair of criteria, choose whether the row criterion is more important (0), both are equally important (1), or the column criterion is more important (2). Weights are calculated automatically and displayed as both absolute values and relative percentages alongside a visual ranking.

#### Vendor Scoring

Add vendors and score them against every criterion on a defined scale:

| Score | Label              |
|-------|--------------------|
| 10    | Excellent          |
| 6     | Good               |
| 4     | Adequate           |
| 1     | Insufficient       |
| 0     | Not available      |

Weighted scores are computed in real time by multiplying each raw score with the criterion's relative weight. A summary row shows the total weighted score per vendor.

#### Results & Recommendation

A dedicated results view provides:

- **Ranking cards** for each vendor with total scores and a recommendation badge for the highest-scoring vendor (only shown when scores are above zero)
- **Radar chart** for visual comparison across all criteria (requires at least 3 criteria; supports up to 8 vendors)
- **Detailed comparison table** listing raw and weighted scores per criterion
- **Summary text** highlighting the recommended vendor and the score differential to the runner-up

### TCO Calculator

#### Options & Cost Management

Define vendor options and assign cost items to each. The tool provides preset cost categories for quick setup:

**Initial costs** — one-time expenses at project start (e.g. license fees, implementation, data migration, hardware, training, consulting, integration, customizing).

**Annual costs** — recurring expenses over the projection period (e.g. annual licenses, maintenance & support, hosting, personnel, updates, ongoing training, external services).

Costs are managed per option with configurable projection period (1–15 years) and discount rate (0–50%).

#### Benefits Tracking

Define annual benefits shared across all options (e.g. revenue increase, process cost savings, productivity gains, error rate reduction, FTE time savings, legacy system cost reduction). Benefits are used for ROI and break-even calculations.

#### Results & Analysis

The TCO results view includes:

- **TCO overview cards** for each option showing total initial costs, annual costs, TCO, and NPV — the cheapest option is highlighted
- **Stacked bar chart** comparing initial vs. annual costs across all options
- **Yearly cost development table** with cumulative and discounted values for each year
- **ROI analysis** with net benefit, ROI percentage, and break-even year for each option
- **Break-even line chart** visualizing cumulative costs vs. cumulative benefits over time

### Shared Features

#### Persistent Storage

All project data is stored in the browser's localStorage. Data survives page reloads, and changes in one tab are automatically synchronized to other open tabs via the `storage` event. Both tools share the same vendor list and project name.

#### Unified Import & Export

- **JSON project files** — export includes the full project state (both NWA and TCO data) in a single file. Import auto-detects three formats: unified (v1), legacy NWA-only, and legacy TCO-only
- **Confluence Markdown (NWA)** — copy or download a Markdown-formatted NWA summary for Confluence
- **Confluence Markdown (TCO)** — copy or download a Markdown-formatted TCO report including cost comparison, cost details per option, ROI & break-even table, and yearly cost development
- **Chart PNG export** — download the radar chart (NWA) as a PNG image

#### Cross-Navigation

Both tools link to each other via header buttons, allowing seamless switching between utility analysis and cost analysis while sharing the same underlying project data.

## Tech Stack

| Tool        | Version |
|-------------|---------|
| Vite        | 7.x     |
| TypeScript  | 5.x     |
| TailwindCSS | 4.x     |
| Chart.js    | 4.x     |
| Node.js     | 20      |

No component library is used. All UI is built from scratch with TailwindCSS utility classes and vanilla DOM manipulation.

## Getting Started

```bash
npm install
npm run dev
```

## Build & Deployment

```bash
npm run build
```

The production build is output to `dist/` and deployed automatically to GitHub Pages on every push to `main` (see `.github/workflows/deploy.yml`).

## Project Structure

```
src/
├── main.ts        # NWA UI rendering, event handling, all views
├── state.ts       # NWA state management (observable pattern)
├── types.ts       # NWA TypeScript interfaces and constants
├── chart.ts       # Chart.js radar chart configuration
├── tco-main.ts    # TCO UI rendering, event handling, all views
├── tco-state.ts   # TCO state management and calculations
├── tco-types.ts   # TCO TypeScript interfaces, presets
├── tco-chart.ts   # Chart.js bar & line chart configuration
├── storage.ts     # Unified localStorage persistence layer
├── style.css      # TailwindCSS entry point
└── vite-env.d.ts  # Vite type declarations

index.html         # NWA entry point
tco.html           # TCO entry point
vite.config.ts     # Multi-page Vite build configuration
```

## Design Guidelines

### Color Palette

| Role                | Tailwind Token     | Hex       | Usage                                         |
|---------------------|--------------------|-----------|-----------------------------------------------|
| Primary             | `amber-500`        | `#f59e0b` | Buttons, active tabs, badges, accent elements |
| Primary hover       | `amber-600`        | `#d97706` | Button hover states                           |
| Primary light       | `amber-400`        | `#fbbf24` | Winner card border, progress bars             |
| Primary background  | `amber-50`         | `#fffbeb` | Info boxes, table highlight rows              |
| Primary border      | `amber-200`        | `#fde68a` | Info box borders                              |
| Primary text        | `amber-800`        | `#92400e` | Info box text                                 |
| Surface             | `white`            | `#ffffff` | Cards, table backgrounds, inputs              |
| Background          | `gray-50`          | `#f9fafb` | Page background, table headers                |
| Background alt      | `gray-100`         | `#f3f4f6` | Score bar backgrounds                         |
| Border              | `gray-200`         | `#e5e7eb` | Card borders, table cell borders              |
| Border strong       | `gray-300`         | `#d1d5db` | Input borders, secondary button borders       |
| Text primary        | `gray-900`         | `#111827` | Body text, headings                           |
| Text secondary      | `gray-700`         | `#374151` | Table column headers                          |
| Text muted          | `gray-600`         | `#4b5563` | Table cell text                               |
| Text subtle         | `gray-500`         | `#6b7280` | Labels, inactive tab text                     |
| Text disabled       | `gray-400`         | `#9ca3af` | Empty state text, delete icon default         |
| Danger              | `red-500`          | `#ef4444` | Delete icon hover                             |
| Warning background  | `yellow-50`        | `#fefce8` | Warning boxes                                 |
| Warning border      | `yellow-200`       | `#fef08a` | Warning box borders                           |
| Warning text        | `yellow-800`       | `#854d0e` | Warning box text                              |

### Chart Colors

**NWA Radar chart** — datasets cycle through these colors (up to 8 vendors):

| Index | Color   | Fill RGBA              | Border RGB            |
|-------|---------|------------------------|-----------------------|
| 0     | Blue    | `rgba(59, 130, 246, 0.2)`  | `rgb(59, 130, 246)`  |
| 1     | Orange  | `rgba(249, 115, 22, 0.2)`  | `rgb(249, 115, 22)`  |
| 2     | Green   | `rgba(16, 185, 129, 0.2)`  | `rgb(16, 185, 129)`  |
| 3     | Purple  | `rgba(139, 92, 246, 0.2)`  | `rgb(139, 92, 246)`  |
| 4     | Pink    | `rgba(236, 72, 153, 0.2)`  | `rgb(236, 72, 153)`  |
| 5     | Amber   | `rgba(245, 158, 11, 0.2)`  | `rgb(245, 158, 11)`  |
| 6     | Teal    | `rgba(20, 184, 166, 0.2)`  | `rgb(20, 184, 166)`  |
| 7     | Red     | `rgba(239, 68, 68, 0.2)`   | `rgb(239, 68, 68)`   |

**TCO Stacked bar chart** — fixed colors for cost categories:

| Category         | Background RGBA            | Border RGB            |
|------------------|----------------------------|-----------------------|
| Initial costs    | `rgba(245, 158, 11, 0.7)` | `rgb(245, 158, 11)`  |
| Annual costs     | `rgba(59, 130, 246, 0.7)`  | `rgb(59, 130, 246)`  |

**TCO Break-even line chart** — cost lines cycle through 6 colors, benefit line uses green with dashed stroke:

| Index | Color   | Border RGB            | Fill RGBA                  |
|-------|---------|----------------------|----------------------------|
| 0     | Blue    | `rgb(59, 130, 246)`  | `rgba(59, 130, 246, 0.15)` |
| 1     | Orange  | `rgb(249, 115, 22)`  | `rgba(249, 115, 22, 0.15)` |
| 2     | Green   | `rgb(16, 185, 129)`  | `rgba(16, 185, 129, 0.15)` |
| 3     | Purple  | `rgb(139, 92, 246)`  | `rgba(139, 92, 246, 0.15)` |
| 4     | Pink    | `rgb(236, 72, 153)`  | `rgba(236, 72, 153, 0.15)` |
| 5     | Amber   | `rgb(245, 158, 11)`  | `rgba(245, 158, 11, 0.15)` |
| —     | Benefit | `rgb(16, 185, 129)`  | `rgba(16, 185, 129, 0.1)` (dashed, filled) |

### Typography

| Element            | Classes                                      |
|--------------------|----------------------------------------------|
| Logo               | `text-3xl font-bold text-amber-500`          |
| Page heading       | `text-3xl font-bold`                         |
| Section heading    | `text-lg font-semibold text-gray-700`        |
| Label / caption    | `text-sm text-gray-500 uppercase tracking-wider` |
| Body text          | `text-base`                                  |
| Score value        | `text-3xl font-bold` / `text-xl font-bold`   |
| Monospace values   | `font-mono`                                  |

### Component Patterns

**Buttons**

```
Primary:    px-5 py-3 text-base font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600
Secondary:  px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50
Chip:       px-4 py-2 text-sm rounded-full border border-gray-300 text-gray-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700
Danger:     p-2 text-gray-400 hover:text-red-500
```

**Input Fields**

```
Standard:   px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500
Inline:     px-3 py-2 border border-transparent rounded-lg hover:border-gray-300 focus:border-amber-500
Select:     text-center text-sm py-2 px-1 border border-gray-200 rounded-md focus:ring-1 focus:ring-amber-500
```

**Cards**

```
Default:    bg-white rounded-xl border border-gray-200
Result:     bg-white rounded-xl border-2 p-7 hover:shadow-lg
Winner:     border-amber-400 shadow-lg (added to result card)
```

**Info & Warning Boxes**

```
Info:       bg-amber-50 border border-amber-200 rounded-xl p-5 text-base text-amber-800
Warning:    bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-base text-yellow-800
```

**Tabs**

```
Active:     px-5 py-4 text-base font-medium border-b-2 border-amber-500 text-amber-600
Inactive:   px-5 py-4 text-base font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300
```

**Tables**

```
Wrapper:       overflow-x-auto bg-white rounded-xl border border-gray-200
Header cell:   sticky left-0 bg-gray-50 px-4 py-3 text-left font-medium text-gray-600 border-b border-r border-gray-200
Highlight row: bg-amber-50 font-semibold border-t-2 border-amber-300
```

**Special Elements**

```
Badge:         bg-amber-500 text-white text-sm font-bold px-4 py-1.5 rounded-full
Progress bar:  bg-gray-100 rounded-full h-3 (track) / bg-amber-400 h-full rounded-full (fill)
Toast:         bg-gray-800 text-white px-6 py-3 rounded-lg shadow-xl text-sm font-medium
```

### Spacing

| Context            | Values                                |
|--------------------|---------------------------------------|
| Page padding       | `px-6 sm:px-10 lg:px-16 xl:px-20`    |
| Section spacing    | `space-y-8`                           |
| Item spacing       | `space-y-3`                           |
| Card padding       | `p-5` / `p-6` / `p-7` / `p-8`       |
| Grid gaps          | `gap-2` / `gap-3` / `gap-4` / `gap-6`|

### Responsive Breakpoints

| Breakpoint | Width  | Usage                          |
|------------|--------|--------------------------------|
| `sm`       | 640px  | Padding adjustments            |
| `md`       | 768px  | Grid column changes            |
| `lg`       | 1024px | Spacing increases              |
| `xl`       | 1280px | Maximum horizontal padding     |

Result cards use a responsive grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
