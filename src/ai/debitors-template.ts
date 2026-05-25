export interface DebitorTemplateData {
  fileName: string;
  runTimestamp: string;
  totalDebitorsCount: number;
  totalTransactionsCount: number;
  totalDebitSum: number;
  totalCreditSum: number;
  totalPendingSum: number;
  collectionSuccessRate: string;
  averageOutstandingDues: number;
  topDebtorName: string;
  topDebtorValue: number;
  debitorsLimit: number;
  sortedDebitorsList: any[];
  generatedSvgChart: string;
  htmlDebitorRows: string[];
  htmlChecklistPoints: string;
  htmlProjectionsPoints: string;
  htmlIntelligencePoints: string;
  htmlErrors: string;
  allErrorsLength: number;
  htmlAlertsList: string;
  aiGenerated: boolean;
}

export function generateDebitorsHtmlReport(data: DebitorTemplateData): string {
  const {
    fileName,
    runTimestamp,
    totalDebitorsCount,
    totalTransactionsCount,
    totalDebitSum,
    totalCreditSum,
    totalPendingSum,
    collectionSuccessRate,
    averageOutstandingDues,
    topDebtorName,
    topDebtorValue,
    debitorsLimit,
    sortedDebitorsList,
    generatedSvgChart,
    htmlDebitorRows,
    htmlChecklistPoints,
    htmlProjectionsPoints,
    htmlIntelligencePoints,
    htmlErrors,
    allErrorsLength,
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
  <title>Hotel Gaurav — SaaS Debitors & Udhari Control Center</title>
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
    
    <!-- LEFT SIDEBAR: SaaS Application Controller Navigation -->
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
            <p>Udhari Console</p>
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
            <a href="#debtors">
              <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              <span class="nav-text">Top Debitors</span>
            </a>
          </li>
          <li class="nav-item">
            <a href="#chart-section">
              <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2"></path></svg>
              <span class="nav-text">Dues Visualization</span>
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
              <span class="nav-text">Recovery Plan</span>
            </a>
          </li>
          <li class="nav-item">
            <a href="#integrity">
              <svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
              <span class="nav-text">Audit Integrity</span>
            </a>
          </li>
        </ul>
      </div>
      <div class="sidebar-footer">
        <p>Udhari Module 1.1.0</p>
        <p style="color: var(--text-muted); margin-top: 4px;">© Hotel Gaurav Operations</p>
      </div>
    </aside>

    <!-- RIGHT WORKSPACE PANEL: Live Audited Content Dashboard -->
    <main class="main-workspace">
      
      <!-- Top Action Bar & Pulsing Status -->
      <div class="top-action-bar">
        <div class="workspace-title">
          <h1>Udhari & Collections Command Center</h1>
          <p>Real-time debtor breakups and recovery analytics aggregated from the entry logs.</p>
        </div>
        <div class="live-status-pill">
          <div class="pulsing-dot"></div>
          Debitor Audit Sync Active
        </div>
      </div>

      <!-- Highlights & Milestones Panel -->
      <div class="highlights-panel" id="home">
        <div class="highlights-header">
          <svg style="width:22px; height:22px; fill:var(--brand-indigo);" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
          📊 Cumulative Debitors Highlights & Dues Milestones
        </div>
        <div class="highlights-columns">
          <ul>
            <li>
              <span class="highlight-icon">💼</span>
              <strong>Active Debitor Accounts:</strong><br>${totalDebitorsCount} customers currently on credit books.
            </li>
            <li>
              <span class="highlight-icon">📈</span>
              <strong>Total Credit Recovery Rate:</strong><br>${collectionSuccessRate}% of total udhari successfully collected.
            </li>
            <li>
              <span class="highlight-icon">⚖️</span>
              <strong>Average Outstanding Dues:</strong><br>₹${Math.round(averageOutstandingDues).toLocaleString()} per account.
            </li>
          </ul>
          <ul>
            <li>
              <span class="highlight-icon">👑</span>
              <strong>Top Single Debitor:</strong><br>${topDebtorName} (₹${Math.round(topDebtorValue).toLocaleString()} pending)
            </li>
            <li>
              <span class="highlight-icon">💳</span>
              <strong>Outstanding Dues:</strong><br>₹${Math.round(totalPendingSum).toLocaleString()} total unrecovered cash.
            </li>
            <li>
              <span class="highlight-icon">📊</span>
              <strong>Leaderboard Limit:</strong><br>Configured top ${debitorsLimit} accounts showing high-to-low outstanding.
            </li>
          </ul>
        </div>
      </div>

      <!-- Master KPI Cards Grid -->
      <div class="kpi-grid">
        <!-- Total Debit -->
        <div class="kpi-card green">
          <div class="kpi-header">
            <span class="kpi-title">Total Credit Extended</span>
            <svg class="kpi-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
          </div>
          <div class="kpi-value numeric">₹${Math.round(totalDebitSum).toLocaleString()}</div>
          <div class="kpi-desc">Total cumulative customer credit purchases.</div>
        </div>
        
        <!-- Total Credit -->
        <div class="kpi-card green">
          <div class="kpi-header">
            <span class="kpi-title">Total Credit Collected</span>
            <svg class="kpi-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          </div>
          <div class="kpi-value numeric">₹${Math.round(totalCreditSum).toLocaleString()}</div>
          <div class="kpi-desc">Total cumulative repayments recovered from debitors.</div>
        </div>

        <!-- Net Pending -->
        <div class="kpi-card red">
          <div class="kpi-header">
            <span class="kpi-title">Net Outstanding Dues</span>
            <svg class="kpi-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <div class="kpi-value numeric">₹${Math.round(totalPendingSum).toLocaleString()}</div>
          <div class="kpi-desc">Outstanding unrecovered customer debt (Net Gap).</div>
        </div>

        <!-- Collection rate -->
        <div class="kpi-card green">
          <div class="kpi-header">
            <span class="kpi-title">Collection Rate</span>
            <svg class="kpi-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2"></path></svg>
          </div>
          <div class="kpi-value numeric">${collectionSuccessRate}%</div>
          <div class="kpi-desc">Dues collection success health factor.</div>
        </div>
      </div>

      <!-- Top Debitors Outstanding Leaders Table -->
      <div class="card" id="debtors">
        <h2 class="card-title">
          <svg style="width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          Top ${debitorsLimit} Customer Debitors Leaderboard (Sorted High-to-Low Dues)
        </h2>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Debitor Name</th>
                <th class="text-right">📤 Total Debit (Purchased)</th>
                <th class="text-right">📥 Total Credit (Repayed)</th>
                <th class="text-right text-red">⚖️ Net Outstanding Dues</th>
                <th class="text-center" style="width: 140px;">Pending Contribution</th>
                <th class="text-center">Account Health Status</th>
              </tr>
            </thead>
            <tbody>
              ${htmlDebitorRows.join('\n')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- DYNAMIC HORIZONTAL SVG BAR CHART (Top Debitors outstanding visualization) -->
      <div class="card" id="chart-section">
        <h2 class="card-title">
          <svg style="width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2"></path></svg>
          Debitor Outstanding Visual Analysis
        </h2>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 24px;">
          Dynamic graphical mapping showing pending debt volumes (₹) side-by-side. Highlighted in <span style="color: var(--brand-indigo); font-weight:600;">● Indigo Accent Dues</span>.
        </p>
        <div class="chart-container">
          ${generatedSvgChart}
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
        <p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:20px;">Deep data-driven pattern intelligence uncovering dues risk clusters, recovery velocity, and accounting delays:</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          ${htmlIntelligencePoints}
        </div>
      </div>

      <!-- Dynamic Lower Grid (Checklist & Projections) -->
      <div class="lower-grid">
        
        <!-- Left Side: Ingestion Checks & Action Checklist -->
        <div style="display:flex; flex-direction:column; gap:30px;">
          <!-- Weekly Action Checklist -->
          <div class="card" id="actions" style="margin-bottom: 0;">
            <h2 class="card-title" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
              <span style="display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <svg style="width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                Weekly Dues Recovery Checklist
                ${aiTag}
              </span>
            </h2>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:20px;">Tap collection procedures below to cross them off during accounting cycles:</p>
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
              <li>✅ <strong>Total Audited Sheets:</strong> 3 Sheets (Summary, EntryList, Breakup)</li>
              <li>📊 <strong>Audited Dues Records:</strong> ${totalTransactionsCount} line entries</li>
              <li>⚠️ <strong>Format Failures / Skipped Dues:</strong> ${allErrorsLength} warnings</li>
            </ul>
            ${allErrorsLength > 0 ? `<ul style="margin-top:10px; font-size:0.8rem; color:var(--red-accent); padding-left:15px; display:flex; flex-direction:column; gap:4px;">${htmlErrors}</ul>` : ''}
          </div>
        </div>

        <!-- Right Side: AI Projections Card taking equal height -->
        <div class="card" id="projections" style="margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between;">
          <h2 class="card-title" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <span style="display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <svg style="width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Dynamic Recovery &amp; Collection Outlook
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
            System Detected Anomalies & Compliance Alerts
          </span>
          <span style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;font-weight:600;padding:2px 8px;border-radius:999px;background:rgba(251,146,60,0.1);color:#fb923c;border:1px solid rgba(251,146,60,0.25);white-space:nowrap;flex-shrink:0;">&#9660; Rules Engine</span>
        </h2>
        ${htmlAlertsList || '<p style="color:var(--green-accent); font-size: 0.95rem; font-weight: 500;">✅ All debitor records within perfect operational bounds! No anomalies detected.</p>'}
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
        document.getElementById('debtors'),
        document.getElementById('chart-section'),
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
          
          if (link.getAttribute('href') === '#' + activeId) {
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
