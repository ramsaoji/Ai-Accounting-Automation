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
  htmlErrors: string;
  allErrorsLength: number;
  htmlAlertsList: string;
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
    htmlErrors,
    allErrorsLength,
    htmlAlertsList
  } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hotel Gaurav — SaaS Debitors & Udhari Control Center</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
    
    :root {
      --bg-main: #09090e;
      --bg-sidebar: #0f101a;
      --bg-card: rgba(22, 24, 38, 0.95);
      --bg-card-hover: rgba(30, 32, 51, 0.98);
      --border-color: rgba(55, 60, 94, 0.6);
      --border-glow: rgba(99, 102, 241, 0.25);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --brand-indigo: #6366f1;
      --brand-indigo-glow: rgba(99, 102, 241, 0.08);
      --brand-amber: #f59e0b;
      --green-accent: #10b981;
      --green-accent-glow: rgba(16, 185, 129, 0.06);
      --red-accent: #f43f5e;
      --red-accent-glow: rgba(244, 63, 94, 0.06);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    html {
      scroll-behavior: smooth;
      scroll-padding-top: 100px;
    }

    body {
      font-family: 'Inter', sans-serif;
      background-color: var(--bg-main);
      color: var(--text-main);
      -webkit-font-smoothing: antialiased;
      display: flex;
      min-height: 100vh;
      line-height: 1.6;
      overflow-x: hidden;
      transition: background-color 0.3s ease;
    }

    /* Branded Application Wrapper Grid */
    .app-wrapper {
      display: flex;
      width: 100%;
      position: relative;
    }

    /* Elegant Collapsible Navigation Sidebar (Left Column) */
    .sidebar {
      width: 280px;
      background-color: var(--bg-sidebar);
      border-right: 1px solid var(--border-color);
      padding: 40px 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: fixed;
      height: 100vh;
      left: 0;
      top: 0;
      z-index: 999;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Collapse button floating badge */
    .sidebar-collapse-btn {
      position: absolute;
      top: 47px; right: -12px;
      width: 24px; height: 24px;
      background-color: var(--bg-sidebar);
      border: 1px solid var(--border-color);
      border-radius: 50%;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      z-index: 1000;
      transition: all 0.25s ease;
    }

    .sidebar-collapse-btn:hover {
      background-color: var(--brand-indigo);
      color: #fff;
      border-color: var(--brand-indigo);
    }

    /* Collapsed Sidebar overrides */
    .sidebar-collapsed .sidebar {
      width: 80px;
      padding: 40px 14px;
    }

    .sidebar-collapsed .sidebar .logo-text,
    .sidebar-collapsed .sidebar .sidebar-footer,
    .sidebar-collapsed .sidebar .nav-text {
      opacity: 0;
      visibility: hidden;
      display: none;
    }

    .sidebar-collapsed .sidebar .logo-container {
      justify-content: center;
      margin-bottom: 35px;
    }

    .sidebar-collapsed .sidebar .nav-item a {
      justify-content: center;
      padding: 12px 0;
    }

    .sidebar-collapsed .sidebar-collapse-btn svg {
      transform: rotate(180deg);
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 45px;
      transition: all 0.3s;
      cursor: pointer;
      user-select: none;
    }

    .logo-container:hover .logo-badge {
      box-shadow: 0 0 22px rgba(99, 102, 241, 0.5);
      transform: scale(1.05);
    }

    .logo-badge {
      width: 38px;
      height: 38px;
      background: linear-gradient(135deg, var(--brand-indigo) 0%, #4f46e5 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.2rem;
      color: #fff;
      font-family: 'Outfit', sans-serif;
      box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
      flex-shrink: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .logo-text {
      transition: opacity 0.2s ease;
    }

    .logo-text h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.02em;
    }

    .logo-text p {
      font-size: 0.72rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .nav-menu {
      display: flex;
      flex-direction: column;
      gap: 8px;
      list-style-type: none;
    }

    .nav-item a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 12px;
      color: var(--text-muted);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.92rem;
      transition: all 0.2s ease;
      border: 1px solid transparent;
    }

    .nav-icon {
      width: 20px;
      height: 20px;
      stroke: var(--text-muted);
      flex-shrink: 0;
      transition: stroke 0.2s ease;
    }

    .nav-item.active .nav-icon, .nav-item a:hover .nav-icon {
      stroke: var(--brand-indigo);
    }

    .nav-text {
      transition: opacity 0.2s ease;
      white-space: nowrap;
    }

    .nav-item.active a, .nav-item a:hover {
      background-color: rgba(255, 255, 255, 0.03);
      color: #fff;
      border-color: rgba(255, 255, 255, 0.05);
    }

    .nav-item.active a {
      border-left: 3px solid var(--brand-indigo);
    }

    .sidebar-footer {
      font-size: 0.75rem;
      color: var(--text-muted);
      border-top: 1px solid rgba(255,255,255,0.05);
      padding-top: 20px;
      transition: opacity 0.2s ease;
    }

    /* Main Console Workspace panel (Right Column) */
    .main-workspace {
      flex: 1;
      margin-left: 280px;
      padding: 40px 50px;
      max-width: 1360px;
      width: calc(100% - 280px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .sidebar-collapsed .main-workspace {
      margin-left: 80px;
      width: calc(100% - 80px);
    }

    /* Mobile Top Sticky Navigation Header */
    .mobile-header {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 70px;
      background: var(--bg-sidebar);
      border-bottom: 1px solid var(--border-color);
      z-index: 998;
      padding: 0 24px;
      align-items: center;
      justify-content: space-between;
      backdrop-filter: blur(12px);
    }

    .mobile-menu-toggle {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mobile-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      z-index: 997;
    }

    /* Top Action Bar & Branded Header */
    .top-action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 35px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding-bottom: 24px;
    }

    .workspace-title h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.2rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      background: linear-gradient(to right, #ffffff, #c7d2fe);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 6px;
    }

    .workspace-title p {
      font-size: 0.95rem;
      color: var(--text-muted);
    }

    .live-status-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(99, 102, 241, 0.06);
      border: 1px solid rgba(99, 102, 241, 0.20);
      border-radius: 9999px;
      padding: 6px 14px;
      font-size: 0.8rem;
      color: #a5b4fc;
      font-weight: 600;
    }

    .pulsing-dot {
      width: 8px;
      height: 8px;
      background-color: var(--brand-indigo);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--brand-indigo);
      animation: pulse-ring 2.2s infinite;
    }

    @keyframes pulse-ring {
      0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.6); }
      70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
      100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
    }

    /* Executive highlights block */
    .highlights-panel {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(0,0,0,0) 100%);
      border: 1px solid rgba(99, 102, 241, 0.12);
      border-radius: 16px;
      padding: 24px 30px;
      margin-bottom: 35px;
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
    }

    .highlights-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      color: #a5b4fc;
      font-family: 'Outfit', sans-serif;
      font-size: 1.15rem;
      font-weight: 600;
    }

    .highlights-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }

    .highlights-columns ul {
      list-style-type: none;
    }

    .highlights-columns li {
      font-size: 0.92rem;
      margin-bottom: 12px;
      padding-left: 28px;
      position: relative;
      color: var(--text-main);
      line-height: 1.5;
    }

    .highlights-columns li .highlight-icon {
      position: absolute;
      left: 0;
      top: 1px;
      font-size: 1.15rem;
      display: inline-block;
    }

    /* Quick KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 35px;
    }

    .kpi-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 24px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }

    .kpi-card:hover {
      transform: translateY(-4px);
      border-color: var(--border-glow);
      box-shadow: 0 12px 30px rgba(99, 102, 241, 0.12);
      background-color: var(--bg-card-hover);
    }

    .kpi-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .kpi-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .kpi-icon {
      width: 22px;
      height: 22px;
      stroke: var(--brand-indigo);
    }

    .kpi-card.green .kpi-icon { stroke: var(--green-accent); }
    .kpi-card.red .kpi-icon { stroke: var(--red-accent); }
    .kpi-card.amber .kpi-icon { stroke: var(--brand-amber); }

    .kpi-value {
      font-family: 'Outfit', sans-serif;
      font-size: 1.8rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 6px;
      letter-spacing: -0.02em;
    }

    .kpi-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    /* Branded Card Panels */
    .card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      margin-bottom: 35px;
    }

    .card-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.3rem;
      font-weight: 600;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 14px;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Dynamic SVG Chart Container styling */
    .chart-container {
      padding: 10px 0;
      width: 100%;
    }

    .neon-trend-chart {
      width: 100%;
      height: auto;
      overflow: visible;
    }

    .chart-bar-rect {
      transition: fill-opacity 0.2s ease, transform 0.2s ease;
      cursor: pointer;
    }

    .chart-bar-rect:hover {
      fill-opacity: 0.95;
    }

    /* Dynamic Lower Grid (Spreading checklist and projections under full table) */
    .lower-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 30px;
      margin-bottom: 35px;
      align-items: stretch;
    }

    /* Fully Responsive Tables with customized elegant scrollbars */
    .table-responsive {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 12px;
      border: 1px solid var(--border-color);
    }

    /* Elegant Custom Scrollbars for Windows browsers to avoid ugly scrollbars */
    .table-responsive::-webkit-scrollbar {
      height: 8px;
    }
    .table-responsive::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 9999px;
    }
    .table-responsive::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 9999px;
    }
    .table-responsive::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92rem;
      white-space: nowrap;
    }

    th {
      background-color: rgba(255,255,255,0.02);
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      padding: 16px 20px;
      border-bottom: 2px solid var(--border-color);
      text-align: left;
    }

    td {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      color: var(--text-main);
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background-color: rgba(255,255,255,0.02);
    }

    .debtor-name {
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      color: #ffffff;
    }

    .numeric {
      font-family: 'Outfit', sans-serif;
      letter-spacing: -0.01em;
    }

    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-green { color: var(--green-accent); }
    .text-red { color: var(--red-accent); }
    .text-indigo { color: #a5b4fc; }
    .text-orange { color: #fb923c; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }

    /* Visual outstanding strength bar indicator */
    .trend-bar-wrapper {
      width: 100px;
      height: 6px;
      background-color: rgba(255, 255, 255, 0.06);
      border-radius: 9999px;
      display: inline-block;
      vertical-align: middle;
      overflow: hidden;
    }

    .trend-bar-fill {
      height: 100%;
      border-radius: 9999px;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge-indigo {
      background-color: var(--brand-indigo-glow);
      color: #a5b4fc;
      border: 1px solid rgba(99, 102, 241, 0.2);
    }

    .badge-green {
      background-color: var(--green-accent-glow);
      color: var(--green-accent);
      border: 1px solid rgba(16, 185, 129, 0.2);
    }

    .badge-red {
      background-color: var(--red-accent-glow);
      color: var(--red-accent);
      border: 1px solid rgba(244, 63, 94, 0.2);
    }

    .badge-amber {
      background-color: rgba(245, 158, 11, 0.05);
      color: var(--brand-amber);
      border: 1px solid rgba(245, 158, 11, 0.2);
    }

    /* Custom Checkbox touch friendly checklist */
    .checkbox-container {
      display: flex;
      align-items: flex-start;
      position: relative;
      padding-left: 38px;
      margin-bottom: 22px;
      cursor: pointer;
      font-size: 0.95rem;
      user-select: none;
      transition: all 0.2s;
    }

    .checkbox-container input {
      position: absolute;
      opacity: 0;
      cursor: pointer;
      height: 0; width: 0;
    }

    .checkmark {
      position: absolute;
      top: 3px; left: 0;
      height: 24px; width: 24px;
      background-color: rgba(255,255,255,0.04);
      border: 1.5px solid var(--border-color);
      border-radius: 8px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .checkbox-container:hover input ~ .checkmark {
      background-color: rgba(255,255,255,0.08);
      border-color: var(--brand-indigo);
    }

    .checkbox-container input:checked ~ .checkmark {
      background-color: var(--brand-indigo);
      border-color: var(--brand-indigo);
      box-shadow: 0 0 14px rgba(99, 102, 241, 0.25);
    }

    .checkmark:after {
      content: "";
      position: absolute;
      display: none;
    }

    .checkbox-container input:checked ~ .checkmark:after {
      display: block;
    }

    .checkbox-container .checkmark:after {
      left: 8px; top: 4px;
      width: 5px; height: 10px;
      border: solid #060913;
      border-width: 0 2.5px 2.5px 0;
      transform: rotate(45deg);
    }

    /* Checked completion effect */
    .checkbox-text {
      color: var(--text-main);
      transition: all 0.3s ease;
      line-height: 1.5;
    }

    .checkbox-container input:checked ~ .checkbox-text {
      text-decoration: line-through;
      color: var(--text-muted);
      opacity: 0.55;
    }

    /* AI Projections Lists */
    ol.projections-list {
      padding-left: 20px;
      color: var(--text-main);
    }

    ol.projections-list li {
      font-size: 0.95rem;
      margin-bottom: 18px;
      line-height: 1.6;
    }

    /* System Detected Exceptions */
    .alert-box {
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 24px;
      font-size: 0.9rem;
    }

    .alert-box.warning {
      background: rgba(244, 63, 94, 0.02);
      border: 1px solid rgba(244, 63, 94, 0.15);
    }

    .alert-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .alert-icon {
      width: 20px;
      height: 20px;
      color: var(--red-accent);
    }

    .alert-box h4 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.05rem;
      color: var(--red-accent);
      font-weight: 600;
    }

    .alert-box ul {
      padding-left: 24px;
      margin-bottom: 14px;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .alert-box li {
      line-height: 1.5;
    }

    .alert-suggestion {
      padding-top: 10px;
      border-top: 1px solid rgba(244, 63, 94, 0.1);
      font-size: 0.88rem;
    }

    /* =========================================================================
       📱 PROFESSIONAL MEDIA QUERIES BREAKPOINTS (ELITE TYPOGRAPHY & PADDING SCALING)
       ========================================================================= */
    @media (max-width: 1024px) {
      body {
        padding-top: 70px;
      }
      .mobile-header {
        display: flex;
      }
      .sidebar {
        position: fixed;
        left: -280px;
        top: 70px;
        height: calc(100vh - 70px);
        width: 280px;
        box-shadow: 15px 0 30px rgba(0,0,0,0.5);
      }
      .sidebar.mobile-open {
        left: 0;
      }
      .main-workspace {
        margin-left: 0;
        width: 100%;
        padding: 30px 20px;
      }
      .top-action-bar {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 24px;
      }
      .sidebar-collapse-btn {
        display: none;
      }
    }

    @media (max-width: 768px) {
      .main-workspace {
        padding: 20px 16px;
      }
      .workspace-title h1 {
        font-size: 1.6rem;
        line-height: 1.25;
      }
      .workspace-title p {
        font-size: 0.88rem;
      }
      .card {
        padding: 22px 18px;
        border-radius: 16px;
        margin-bottom: 24px;
      }
      .card-title {
        font-size: 1.15rem;
        margin-bottom: 18px;
      }
      .highlights-panel {
        padding: 20px 18px;
        margin-bottom: 24px;
      }
      .highlights-header {
        font-size: 1.05rem;
        margin-bottom: 14px;
      }
      .highlights-columns {
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .highlights-columns li {
        font-size: 0.85rem;
        line-height: 1.45;
        padding-left: 24px;
        margin-bottom: 8px;
      }
      .highlights-columns li .highlight-icon {
        font-size: 1.05rem;
        top: 0px;
      }
      .kpi-grid {
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 24px;
      }
      .kpi-card {
        padding: 18px;
        border-radius: 14px;
      }
      .kpi-value {
        font-size: 1.45rem;
      }
      .kpi-desc {
        font-size: 0.75rem;
      }
      .lower-grid {
        grid-template-columns: 1fr;
        gap: 24px;
      }
      ol.projections-list li {
        font-size: 0.88rem;
        margin-bottom: 12px;
      }
      .checkbox-container {
        padding-left: 32px;
        font-size: 0.88rem;
        margin-bottom: 16px;
      }
      .checkmark {
        width: 20px;
        height: 20px;
        top: 1px;
      }
      .checkbox-container .checkmark:after {
        left: 6px;
        top: 2px;
        width: 4px;
        height: 9px;
      }
    }

    @media (max-width: 480px) {
      .workspace-title h1 {
        font-size: 1.45rem;
      }
      .kpi-grid {
        grid-template-columns: 1fr;
      }
      .card {
        padding: 18px 14px;
      }
    }

    /* Print rules */
    @media print {
      body { background-image: none !important; background-color: #ffffff !important; color: #000000 !important; padding: 0 !important; }
      .sidebar { display: none !important; }
      .main-workspace { margin-left: 0 !important; width: 100% !important; padding: 0 !important; }
      .header-card, .card, .kpi-card, .highlights-panel {
        background: #ffffff !important;
        border: 1px solid #cccccc !important;
        color: #000000 !important;
        box-shadow: none !important;
        page-break-inside: avoid;
      }
      .workspace-title h1 {
        -webkit-text-fill-color: #000000 !important;
        color: #000000 !important;
      }
      .checkmark { border-color: #000000 !important; }
      td, th { border-bottom: 1px solid #dddddd !important; color: #000000 !important; }
      .kpi-icon { stroke: #000000 !important; }
      .trend-bar-wrapper, .neon-trend-chart { display: none !important; }
    }
  </style>
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

      <!-- Dynamic Lower Grid (Checklist & Projections) -->
      <div class="lower-grid">
        
        <!-- Left Side: Ingestion Checks & Action Checklist -->
        <div style="display:flex; flex-direction:column; gap:30px;">
          <!-- Weekly Action Checklist -->
          <div class="card" id="actions" style="margin-bottom: 0;">
            <h2 class="card-title">
              <svg style="width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
              Weekly Dues Recovery Checklist
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
          <h2 class="card-title">
            <svg style="width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            Dynamic Recovery & Collection Outlook
          </h2>
          <ol class="projections-list" style="flex: 1; display: flex; flex-direction: column; justify-content: space-around; gap: 20px;">
            ${htmlProjectionsPoints}
          </ol>
        </div>

      </div>

      <!-- Alerts Card (Full Width Bottom) -->
      <div class="card" id="alerts" style="margin-bottom: 0;">
        <h2 class="card-title">
          <svg style="width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          System Detected Anomalies & Compliance Alerts
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
