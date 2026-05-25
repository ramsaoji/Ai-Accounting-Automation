export interface HtmlTemplateData {
  fileName: string;
  runTimestamp: string;
  sortedSheets: any[];
  bestRevenueMonth: string;
  bestRevenueValue: number;
  bestProfitMonth: string;
  bestProfitValue: number;
  peakExpenseMonth: string;
  peakExpenseValue: number;
  liquorPercentage: string;
  foodPercentage: string;
  creditRecoveryRate: string;
  creditOutstandingGap: number;
  masterLiquor: number;
  masterFood: number;
  masterIncome: number;
  masterOutflow: number;
  masterNet: number;
  generatedSvgChart: string;
  htmlTrendRows: string[];
  htmlChecklistPoints: string;
  htmlProjectionsPoints: string;
  htmlIntelligencePoints: string;
  allTransactionsLength: number;
  allErrorsLength: number;
  htmlErrors: string;
  htmlAlertsList: string;
  aiGenerated: boolean;
}

export function generateHtmlReport(data: HtmlTemplateData): string {
  const {
    fileName,
    runTimestamp,
    sortedSheets,
    bestRevenueMonth,
    bestRevenueValue,
    bestProfitMonth,
    bestProfitValue,
    peakExpenseMonth,
    peakExpenseValue,
    liquorPercentage,
    foodPercentage,
    creditRecoveryRate,
    creditOutstandingGap,
    masterLiquor,
    masterFood,
    masterIncome,
    masterOutflow,
    masterNet,
    generatedSvgChart,
    htmlTrendRows,
    htmlChecklistPoints,
    htmlProjectionsPoints,
    htmlIntelligencePoints,
    allTransactionsLength,
    allErrorsLength,
    htmlErrors,
    htmlAlertsList,
    aiGenerated
  } = data;

  const aiTag = aiGenerated
  ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;font-weight:600;padding:2px 8px;border-radius:999px;background:rgba(139,92,246,0.15);color:#a78bfa;border:1px solid rgba(139,92,246,0.3);vertical-align:middle;margin-left:8px;white-space:nowrap;flex-shrink:0;">&#10022; AI Generated</span>`
  : `<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;font-weight:600;padding:2px 8px;border-radius:999px;background:rgba(99,102,241,0.1);color:#818cf8;border:1px solid rgba(99,102,241,0.25);vertical-align:middle;margin-left:8px;white-space:nowrap;flex-shrink:0;">&#9881; Data Computed</span>`;

  const intelSidebarLabel = aiGenerated ? 'Strategic Intel' : 'Strategic Intel';
  const intelSidebarTag = aiGenerated 
    ? `<span style="font-size: 0.65rem; font-weight: 700; color: #a78bfa; background: rgba(139,92,246,0.15); padding: 1px 6px; border-radius: 4px; margin-left: 6px;">AI</span>`
    : `<span style="font-size: 0.65rem; font-weight: 700; color: #818cf8; background: rgba(99,102,241,0.15); padding: 1px 6px; border-radius: 4px; margin-left: 6px;">DATA</span>`;

  const intelPanelTitle = aiGenerated ? 'AI Strategic Intelligence Panel' : 'Deterministic Strategic Intelligence';
  const intelPanelStyle = aiGenerated
    ? `background: linear-gradient(135deg, rgba(139,92,246,0.04) 0%, rgba(99,102,241,0.02) 100%); border: 1px solid rgba(139,92,246,0.25);`
    : `background: linear-gradient(135deg, rgba(99,102,241,0.03) 0%, rgba(20,184,166,0.01) 100%); border: 1px solid rgba(99,102,241,0.2);`;
  const intelIconStroke = aiGenerated ? '#a78bfa' : '#818cf8';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hotel Gaurav — Financial Command Center</title>
  <link rel="stylesheet" href="../theme.css">
</head>
<body>
  
  <!-- MOBILE sticky top-bar -->
  <header class="mobile-header">
    <div class="mobile-logo-trigger" style="display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none;">
      <div class="logo-badge" style="width:32px; height:32px; font-size:1rem;">G</div>
      <h2 style="font-family:'Outfit', sans-serif; font-size:1.1rem; font-weight:700;">Hotel Gaurav</h2>
    </div>
    <button class="mobile-menu-toggle" aria-label="Toggle Menu">
      <svg style="width:28px; height:28px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"></path></svg>
    </button>
  </header>

  <!-- MOBILE overlay backdrop -->
  <div class="mobile-overlay"></div>

  <div class="app-wrapper">
    
    <!-- LEFT SIDEBAR: Application Controller Navigation -->
    <aside class="sidebar">
      <!-- Collapse toggle button -->
      <button class="sidebar-collapse-btn" aria-label="Collapse Menu">
        <svg style="width:14px; height:14px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"></path></svg>
      </button>

      <div>
        <div class="logo-container">
          <div class="logo-badge">G</div>
          <div class="logo-text">
            <h2>Hotel Gaurav</h2>
            <p>Finance Console</p>
          </div>
        </div>
        <ul class="nav-menu">
          <li class="nav-item active">
            <a href="#home">
              <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
              <span class="nav-text">Dashboard Home</span>
            </a>
          </li>
          <li class="nav-item">
            <a href="#trends">
              <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2"></path></svg>
              <span class="nav-text">Monthly Trends</span>
            </a>
          </li>
          <li class="nav-item">
            <a href="#intel">
              <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
              <span class="nav-text">Strategic Intel ${intelSidebarTag}</span>
            </a>
          </li>
          <li class="nav-item">
            <a href="#actions">
              <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
              <span class="nav-text">Action Plan</span>
            </a>
          </li>
          <li class="nav-item">
            <a href="#integrity">
              <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
              <span class="nav-text">Integrity Logs</span>
            </a>
          </li>
          <li class="nav-item">
            <a href="#alerts">
              <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
              <span class="nav-text">Compliance Alerts</span>
            </a>
          </li>
        </ul>
      </div>
      <div class="sidebar-footer">
        <p>System Version 1.2.0</p>
        <p style="color: var(--text-muted); margin-top: 4px;">© Hotel Gaurav Operations</p>
      </div>
    </aside>

    <!-- RIGHT WORKSPACE PANEL: Live Audited Content Dashboard -->
    <main class="main-workspace">
      
      <!-- Top Action Bar & Pulsing Status -->
      <div class="top-action-bar">
        <div class="workspace-title">
          <h1>Master Performance Summary</h1>
          <p>Real-time analytics and strategic suggestions compiled from daily register databases.</p>
        </div>
        <div class="live-status-pill">
          <div class="pulsing-dot"></div>
          Live Ingestion Active
        </div>
      </div>

      <!-- Highlights & Milestones Panel -->
      <div class="highlights-panel" id="home">
        <div class="highlights-header">
          <svg style="width:22px; height:22px; fill:var(--brand-gold);" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
          🏆 Executive Highlights & Milestones
        </div>
        <div class="highlights-columns">
          <ul>
            <li>
              <span class="highlight-icon">🥇</span>
              <strong>Best Revenue Month:</strong><br>${bestRevenueMonth} (₹${Math.round(bestRevenueValue).toLocaleString()})
            </li>
            <li>
              <span class="highlight-icon">💰</span>
              <strong>Best Profit Month:</strong><br>${bestProfitMonth} (₹${Math.round(bestProfitValue).toLocaleString()})
            </li>
            <li>
              <span class="highlight-icon">🛠️</span>
              <strong>Peak Expense Month:</strong><br>${peakExpenseMonth} (₹${Math.round(peakExpenseValue).toLocaleString()})
            </li>
          </ul>
          <ul>
            <li>
              <span class="highlight-icon">🍺</span>
              <strong>Menu Ratio:</strong><br>${liquorPercentage}% Liquor vs. ${foodPercentage}% Food
            </li>
            <li>
              <span class="highlight-icon">💳</span>
              <strong>Recovery:</strong><br>${creditRecoveryRate}% of customer credit collected
            </li>
            <li>
              <span class="highlight-icon">🚨</span>
              <strong>Credit Gap:</strong><br>₹${Math.round(creditOutstandingGap).toLocaleString()} outstanding
            </li>
          </ul>
        </div>
      </div>

      <!-- Master KPI Cards Grid -->
      <div class="kpi-grid">
        <!-- Liquor Sales -->
        <div class="kpi-card gold">
          <div class="kpi-header">
            <span class="kpi-title">Liquor Sales</span>
            <svg class="kpi-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
          </div>
          <div class="kpi-value numeric">₹${Math.round(masterLiquor).toLocaleString()}</div>
          <div class="kpi-desc">Total cumulative bar counter receipts.</div>
        </div>
        
        <!-- Food Sales -->
        <div class="kpi-card gold">
          <div class="kpi-header">
            <span class="kpi-title">Food Sales</span>
            <svg class="kpi-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707M12 5a7 7 0 00-7 7 7 7 0 007 7 7 7 0 007-7 7 7 0 00-7-7z"></path></svg>
          </div>
          <div class="kpi-value numeric">₹${Math.round(masterFood).toLocaleString()}</div>
          <div class="kpi-desc">Total cumulative restaurant dining receipts.</div>
        </div>

        <!-- Total Inflow -->
        <div class="kpi-card green">
          <div class="kpi-header">
            <span class="kpi-title">Total Inflows</span>
            <svg class="kpi-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
          </div>
          <div class="kpi-value numeric">₹${Math.round(masterIncome).toLocaleString()}</div>
          <div class="kpi-desc">Liquor, Food, and Credit Recovered.</div>
        </div>

        <!-- Total Outflow -->
        <div class="kpi-card red">
          <div class="kpi-header">
            <span class="kpi-title">Total Outflows</span>
            <svg class="kpi-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"></path></svg>
          </div>
          <div class="kpi-value numeric">₹${Math.round(masterOutflow).toLocaleString()}</div>
          <div class="kpi-desc">Expenses and credit extended combined.</div>
        </div>

        <!-- Net Surplus -->
        <div class="kpi-card green">
          <div class="kpi-header">
            <span class="kpi-title">Net Surplus</span>
            <svg class="kpi-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          </div>
          <div class="kpi-value numeric">₹${Math.round(masterNet).toLocaleString()}</div>
          <div class="kpi-desc">Cumulative net cashflow status.</div>
        </div>
      </div>

      <!-- DYNAMIC DUAL TREND VISUALIZATION CHART (Sales vs Expenses Line graph) -->
      <div class="card" id="trends">
        <h2 class="card-title">
          <svg style="width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
          Historical Performance Trends
        </h2>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 24px;">
          Live visual trend overlay: <span style="color: var(--green-accent); font-weight:600;">● Total Inflows</span> (Liquor, Food & Recovery) vs. <span style="color: var(--red-accent); font-weight:600;">-- Total Outflows</span> (Operational Expenses & Udhari Extended).
        </p>
        <div class="chart-container">
          ${generatedSvgChart}
        </div>
      </div>

      <!-- Month-by-Month Trend Analysis Table (Full width layout for horizontal breathing room) -->
      <div class="card" id="trends-table">
        <h2 class="card-title">
          <svg style="width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          Month-by-Month Trend Analysis
        </h2>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Month / Year</th>
                <th class="text-right">🍸 Liquor Sales</th>
                <th class="text-right">🍽️ Food Sales</th>
                <th class="text-right text-orange">📤 Udhari Given</th>
                <th class="text-right">🛠️ Expenses</th>
                <th class="text-right">⚖️ Net cashflow</th>
                <th class="text-center">Cashflow Strength</th>
                <th class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${htmlTrendRows.join('\n')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- AI Strategic Intelligence Panel (Full Width) -->
      <div class="card" id="intel" style="${intelPanelStyle}">
        <h2 class="card-title" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <span style="display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <svg style="width:20px; height:20px; fill:none; stroke:${intelIconStroke}; stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
            ${intelPanelTitle}
            ${aiTag}
          </span>
        </h2>
        <p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:20px;">Deep data-driven pattern intelligence uncovering hidden operational leaks and revenue ratio optimization avenues:</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          ${htmlIntelligencePoints}
        </div>
      </div>

      <!-- Dynamic Lower Grid (Balanced side-by-side spacing for checklist and projections) -->
      <div class="lower-grid">
        
        <!-- Left Side: Checklist and Ingestion Checks stacked -->
        <div style="display:flex; flex-direction:column; gap:30px;">
          <!-- Weekly Action Checklist -->
          <div class="card" id="actions" style="margin-bottom: 0;">
            <h2 class="card-title" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
              <span style="display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <svg style="width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                Weekly Action Checklist
                ${aiTag}
              </span>
            </h2>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:20px;">Tap suggestions below to cross them off as they are addressed during staff cycles:</p>
            <div style="margin-top:15px;">
              ${htmlChecklistPoints}
            </div>
          </div>

          <!-- Ingestion Checks Card -->
          <div class="card" id="integrity" style="margin-bottom: 0;">
            <h2 class="card-title">
              <svg style="width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Ingestion Integrity Check
            </h2>
            <ul style="list-style-type:none; font-size:0.88rem; color:var(--text-main); display:flex; flex-direction:column; gap:8px;">
              <li>📁 <strong>Source File:</strong> ${fileName}</li>
              <li>✅ <strong>Total Audited Sheets:</strong> ${sortedSheets.length} tabs</li>
              <li>📊 <strong>Audited Transactions:</strong> ${allTransactionsLength} entries</li>
              <li>⚠️ <strong>Skipped Rows / Formatting Errors:</strong> ${allErrorsLength} errors</li>
            </ul>
            ${allErrorsLength > 0 ? `<ul style="margin-top:10px; font-size:0.8rem; color:var(--red-accent); padding-left:15px; display:flex; flex-direction:column; gap:4px;">${htmlErrors}</ul>` : ''}
          </div>
        </div>

        <!-- Right Side: AI Projections Card taking equal height -->
        <div class="card" id="projections" style="margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between;">
          <h2 class="card-title" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <span style="display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <svg style="width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Dynamic 3-Month AI Projections
              ${aiTag}
            </span>
          </h2>
          <ol class="projections-list" style="flex: 1; display: flex; flex-direction: column; justify-content: space-around; gap: 20px;">
            ${htmlProjectionsPoints}
          </ol>
        </div>

      </div>

      <!-- Alerts Card (Full Width Bottom) -->
      <div class="card" id="alerts" style="margin-bottom: 0;">
        <h2 class="card-title" style="justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <span style="display: inline-flex; align-items: center; gap: 8px;">
            <svg style="width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            System Detected Anomalies &amp; Compliance Alerts
          </span>
          <span style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;font-weight:600;padding:2px 8px;border-radius:999px;background:rgba(251,146,60,0.1);color:#fb923c;border:1px solid rgba(251,146,60,0.25);white-space:nowrap;flex-shrink:0;">&#9660; Rules Engine</span>
        </h2>
        ${htmlAlertsList || '<p style="color:var(--green-accent); font-size: 0.95rem; font-weight: 500;">&#10003; All business compliance rules satisfied! 100% clean record auditing.</p>'}
      </div>

    </main>

  </div>

  <!-- Vanilla JS Controller for Navigation, sidebar collapse and scrollSpy -->
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const toggleBtn = document.querySelector('.mobile-menu-toggle');
      const sidebar = document.querySelector('.sidebar');
      const overlay = document.querySelector('.mobile-overlay');
      const navLinks = document.querySelectorAll('.nav-item a');
      const navItems = document.querySelectorAll('.nav-item');
      const collapseToggle = document.querySelector('.sidebar-collapse-btn');
      
      // Control flags for smooth-scrolling synchronization
      let isScrolling = false;
      let scrollTimeout;

      // Select sections to track for scrollSpy
      const sections = [
        document.getElementById('home'),
        document.getElementById('trends'),
        document.getElementById('trends-table'),
        document.getElementById('actions'),
        document.getElementById('integrity'),
        document.getElementById('alerts')
      ].filter(el => el !== null);

      // Recursive function to get absolute offset top from document body root
      function getAbsoluteOffsetTop(element) {
        let offsetTop = 0;
        let el = element;
        while (el) {
          offsetTop += el.offsetTop;
          el = el.offsetParent;
        }
        return offsetTop;
      }

      // Desktop sidebar collapsible action
      if (collapseToggle) {
        collapseToggle.addEventListener('click', () => {
          document.body.classList.toggle('sidebar-collapsed');
        });
      }

      // Open/Close Mobile Menu drawer
      if (toggleBtn && sidebar && overlay) {
        const toggleMenu = () => {
          sidebar.classList.toggle('mobile-open');
          overlay.style.display = sidebar.classList.contains('mobile-open') ? 'block' : 'none';
        };

        toggleBtn.addEventListener('click', toggleMenu);
        overlay.addEventListener('click', toggleMenu);
        
        // Auto-close menu drawer when selecting a navigation option
        navLinks.forEach(link => {
          link.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            overlay.style.display = 'none';
          });
        });
      }

      // Smooth scroll target links highlight with event synchronizer
      navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          const targetId = link.getAttribute('href').substring(1);
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            e.preventDefault();
            
            // Set flag to prevent ScrollSpy from overriding the target active tab
            isScrolling = true;

            // Handle active class visually instantly
            navItems.forEach(item => item.classList.remove('active'));
            link.parentElement.classList.add('active');
            
            // Perform scroll offset calculation for mobile sticky headers
            const headerOffset = window.innerWidth <= 1024 ? 90 : 40;
            const elementPosition = getAbsoluteOffsetTop(targetEl);
            const offsetPosition = elementPosition - headerOffset;

            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });

            // Re-enable ScrollSpy only after the smooth scroll animation completes
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
              isScrolling = false;
            }, 800);
          }
        });
      });

      // Desktop Sidebar Logo scroll-to-top synchronizer
      const logoContainer = document.querySelector('.logo-container');
      if (logoContainer) {
        logoContainer.addEventListener('click', () => {
          isScrolling = true;
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });

          // Instantly set the first nav link (Dashboard Home) as active
          navItems.forEach(item => item.classList.remove('active'));
          if (navItems.length > 0) {
            navItems[0].classList.add('active');
          }

          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            isScrolling = false;
          }, 800);
        });
      }

      // Mobile Header Logo scroll-to-top synchronizer
      const mobileLogoTrigger = document.querySelector('.mobile-logo-trigger');
      if (mobileLogoTrigger) {
        mobileLogoTrigger.addEventListener('click', () => {
          isScrolling = true;
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });

          // Instantly set the first nav link (Dashboard Home) as active
          navItems.forEach(item => item.classList.remove('active'));
          if (navItems.length > 0) {
            navItems[0].classList.add('active');
          }

          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            isScrolling = false;
          }, 800);
        });
      }

      // Custom ScrollSpy algorithm to dynamically update sidebar menu as you scroll
      window.addEventListener('scroll', () => {
        // Skip updating active states if a manual click smooth scroll animation is currently active
        if (isScrolling) return;

        let activeId = 'home';
        const scrollPosition = window.pageYOffset + (window.innerWidth <= 1024 ? 120 : 80);

        // Check if user has scrolled completely to the bottom of the page
        if ((window.innerHeight + window.pageYOffset) >= document.documentElement.scrollHeight - 12) {
          if (sections.length > 0) {
            activeId = sections[sections.length - 1].getAttribute('id');
          }
        } else {
          sections.forEach(sec => {
            const top = getAbsoluteOffsetTop(sec) - 20;
            const height = sec.offsetHeight;
            if (scrollPosition >= top && scrollPosition < (top + height)) {
              activeId = sec.getAttribute('id');
            }
          });
        }

        navLinks.forEach(link => {
          const item = link.parentElement;
          item.classList.remove('active');
          
          // Map both chart and table sections to the 'trends' sidebar tab
          const targetId = activeId === 'trends-table' ? 'trends' : activeId;
          
          if (link.getAttribute('href') === '#' + targetId) {
            item.classList.add('active');
          }
        });
      });
    });
  </script>
</body>
</html>
`;
}
