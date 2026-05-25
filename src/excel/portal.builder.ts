import fs from 'fs';
import path from 'path';
import { logger } from '../logger/logger.js';

export function rebuildMasterPortal(outputDir: string) {
  logger.info({ outputDir }, 'Regenerating dynamic SaaS Master Dashboard Landing Hub...');

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const subdirs = fs.readdirSync(outputDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    const reportCards: string[] = [];

    for (const folder of subdirs) {
      const jsonPath = path.resolve(outputDir, folder, 'summary.json');
      const htmlPath = path.resolve(outputDir, folder, 'summary.html');

      if (!fs.existsSync(jsonPath) || !fs.existsSync(htmlPath)) {
        continue;
      }

      try {
        const rawJson = fs.readFileSync(jsonPath, 'utf8');
        const summary = JSON.parse(rawJson);

        const isDebitors = summary.isDebitorsList === true;
        const cardClass = isDebitors ? 'portal-card' : 'portal-card sales';
        const typeLabel = isDebitors ? 'Debitors Outstanding Ledger' : 'Sales Cash Register';
        
        let statsHtml = '';
        if (isDebitors) {
          const outstanding = summary.aggregates?.totalPendingSum || 0;
          const recoveryRate = summary.aggregates?.collectionSuccessRate || '0%';
          const recoveryStr = typeof recoveryRate === 'number' ? `${recoveryRate.toFixed(1)}%` : String(recoveryRate).endsWith('%') ? recoveryRate : `${recoveryRate}%`;
          statsHtml = `
            <div class="portal-card-stats-grid">
              <div class="portal-stat-item">
                <span class="portal-stat-label">Outstanding Dues</span>
                <span class="portal-stat-value text-red">₹${outstanding.toLocaleString('en-IN')}</span>
              </div>
              <div class="portal-stat-item">
                <span class="portal-stat-label">Recovery Success</span>
                <span class="portal-stat-value text-green">${recoveryStr}</span>
              </div>
            </div>
          `;
        } else {
          const netProfit = summary.masterTotals?.netCashflow || 0;
          const transactionsCount = summary.totalTransactions || summary.months?.reduce((acc: number, m: any) => acc + (m.totalTransactions || 0), 0) || 0;
          statsHtml = `
            <div class="portal-card-stats-grid">
              <div class="portal-stat-item">
                <span class="portal-stat-label">Consolidated Net Flow</span>
                <span class="portal-stat-value ${netProfit >= 0 ? 'text-green' : 'text-red'}">₹${netProfit.toLocaleString('en-IN')}</span>
              </div>
              <div class="portal-stat-item">
                <span class="portal-stat-label">Valid Transactions</span>
                <span class="portal-stat-value font-medium">${transactionsCount.toLocaleString()}</span>
              </div>
            </div>
          `;
        }

        const alertsCount = summary.alerts?.length || 0;
        const runTimestamp = summary.timestamp || summary.runTimestamp || new Date().toLocaleString();

        reportCards.push(`
          <a href="./${encodeURIComponent(folder)}/summary.html" class="${cardClass}">
            <div style="width: 100%;">
              <div class="portal-card-header">
                <span class="portal-card-type">${typeLabel}</span>
                <span class="live-status-pill">
                  <span class="pulsing-dot"></span>
                  Live
                </span>
              </div>
              <h3 class="portal-card-title">${folder}</h3>
              ${statsHtml}
            </div>
            
            <div style="width: 100%;">
              <div class="portal-card-footer">
                <span class="portal-card-alerts ${alertsCount > 0 ? 'active' : ''}">
                  ⚠️ ${alertsCount} Alert${alertsCount !== 1 ? 's' : ''}
                </span>
                <span class="portal-card-date">Updated: ${runTimestamp}</span>
              </div>
              
              <div class="portal-card-action">
                <span>Open Dashboard</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </div>
            </div>
          </a>
        `);
      } catch (err) {
        logger.error({ folder, err }, 'Failed to parse summary.json for master hub compile');
      }
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SaaS Master Financial Control Center</title>
  <link rel="stylesheet" href="./theme.css">
</head>
<body class="sidebar-collapsed">
  <div class="app-wrapper">
    <!-- Left Navigation Column -->
    <aside class="sidebar">
      <div>
        <div class="logo-container">
          <div class="logo-badge">MH</div>
          <div class="logo-text">
            <h2>Master Hub</h2>
            <p>Control Center</p>
          </div>
        </div>
        <ul class="nav-menu">
          <li class="nav-item active">
            <a href="#">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="9"></rect>
                <rect x="14" y="3" width="7" height="5"></rect>
                <rect x="14" y="12" width="7" height="9"></rect>
                <rect x="3" y="16" width="7" height="5"></rect>
              </svg>
              <span class="nav-text">All Ledgers</span>
            </a>
          </li>
        </ul>
      </div>
      <div class="sidebar-footer">
        <p>SaaS Control Hub v1.0</p>
        <p style="font-size: 0.65rem; color: var(--text-muted); margin-top: 4px;">Dynamic compilation</p>
      </div>
    </aside>

    <!-- Right Workspace Console -->
    <main class="main-workspace">
      <header class="top-action-bar">
        <div class="workspace-title">
          <h1>SaaS Master Financial Command Center</h1>
          <p>Consolidated view of all active Excel ledgers and customer udhari summaries</p>
        </div>
        <div class="live-status-pill">
          <span class="pulsing-dot"></span>
          System Live
        </div>
      </header>

      <section class="card" style="border: 1px solid rgba(251, 191, 36, 0.15); box-shadow: 0 8px 32px rgba(251, 191, 36, 0.03);">
        <div class="card-title" style="border-bottom: none; margin-bottom: 0; padding-bottom: 0;">
          📊 Consolidated Ledgers Directory
        </div>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 8px;">
          Automatically scanned and compiled. Click any card below to launch the dedicated high-fidelity interactive dashboard.
        </p>

        <div class="portal-grid">
          ${reportCards.length > 0 ? reportCards.join('\n') : `
            <div style="grid-column: 1 / -1; padding: 60px 0; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 12px;">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px; color: var(--text-muted);">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="9"></line>
                <line x1="9" y1="13" x2="15" y2="13"></line>
                <line x1="9" y1="17" x2="15" y2="17"></line>
              </svg>
              <p>No active financial dashboard summaries found.</p>
              <p style="font-size: 0.8rem; margin-top: 6px;">Run an audit script using <code>npm run audit</code> to populate summaries!</p>
            </div>
          `}
        </div>
      </section>
    </main>
  </div>
</body>
</html>`;

    fs.writeFileSync(path.resolve(outputDir, 'index.html'), htmlContent);
    logger.info('SaaS Master Dashboard Landing Hub successfully compiled at data/output/index.html');
  } catch (error) {
    logger.error({ error }, 'Failed to generate SaaS master dashboard landing hub');
  }
}
