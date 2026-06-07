import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';
import { telegramClient } from './telegram.client.js';
import { getMainMenuKeyboard } from './bot.keyboards.js';
import { loadReport, getMonthYearDate, formatTimestampToDual } from './bot.utils.js';

interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export async function handleCallbackData(data: string, chatId: string, messageId?: number): Promise<void> {
  logger.info({ data, chatId, messageId }, '[Telegram Bot] Routing callback query');

  if (data === 'sales_today') {
    await sendTodaySales(chatId);
  } else if (data === 'sales_month_menu') {
    await sendMonthSelectionMenu(chatId, messageId);
  } else if (data === 'sales_master') {
    await sendSalesSummary(chatId, messageId);
  } else if (data === 'sales_back') {
    await sendSalesSummaryOptions(chatId, messageId);
  } else if (data.startsWith('month_')) {
    const targetMonth = data.replace('month_', '');
    await sendSpecificMonthSales(chatId, targetMonth, messageId);
  } else if (data.startsWith('year_')) {
    const targetYear = parseInt(data.replace('year_', ''), 10);
    await sendMonthsForYearMenu(chatId, targetYear, messageId);
  } else if (data === 'debitors_menu') {
    await sendDebitorsSummary(chatId, messageId);
  } else if (data === 'debitors_summary_metrics') {
    await sendDebitorsMetrics(chatId, messageId);
  } else if (data === 'debitors_top_5') {
    await sendDebitorsTop5(chatId, messageId);
  } else if (data === 'debitors_high_risk') {
    await sendDebitorsHighRisk(chatId, messageId);
  } else if (data === 'godown_stock_menu') {
    await sendGodownStockSummary(chatId, messageId);
  } else if (data === 'godown_stock_metrics') {
    await sendGodownStockMetrics(chatId, messageId);
  } else if (data === 'godown_stock_categories') {
    await sendGodownStockCategories(chatId, messageId);
  } else if (data === 'godown_stock_alerts') {
    await sendGodownStockAlerts(chatId, messageId);
  } else if (data === 'godown_stock_top_movers') {
    await sendGodownStockTopMovers(chatId, messageId);
  } else if (data === 'godown_stock_inflows') {
    await sendGodownStockInflows(chatId, messageId);
  } else if (data === 'counter_stock_menu') {
    await sendCounterStockSummary(chatId, messageId);
  } else if (data === 'counter_stock_metrics') {
    await sendCounterStockMetrics(chatId, messageId);
  } else if (data === 'counter_stock_categories') {
    await sendCounterStockCategories(chatId, messageId);
  } else if (data === 'counter_stock_alerts') {
    await sendCounterStockAlerts(chatId, messageId);
  } else if (data === 'counter_stock_top_movers') {
    await sendCounterStockTopMovers(chatId, messageId);
  } else if (data === 'counter_stock_inflows') {
    await sendCounterStockInflows(chatId, messageId);
  } else if (data === 'sales_chart') {
    await sendSalesChart(chatId);
  } else if (data === 'debitors_chart') {
    await sendDebitorsChart(chatId);
  } else if (data === 'godown_stock_chart') {
    await sendStockChart(chatId, 'godown_stock');
  } else if (data === 'counter_stock_chart') {
    await sendStockChart(chatId, 'counter_stock');
  }
}

export async function sendSalesSummaryOptions(chatId: string, editMessageId?: number): Promise<void> {
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "📅 Today's Sales Summary", callback_data: "sales_today" }
      ],
      [
        { text: "📅 View Specific Month", callback_data: "sales_month_menu" }
      ],
      [
        { text: "📊 Master Cumulative Summary", callback_data: "sales_master" }
      ],
      [
        { text: "📈 View Cashflow Trend Chart", callback_data: "sales_chart" }
      ],
      [
        { text: "📂 View Google Drive Folder", url: `https://drive.google.com/drive/folders/${config.GOOGLE_DRIVE_FOLDER_ID}` }
      ]
    ]
  };

  await telegramClient.sendMessage(
    `📊 *${config.BUSINESS_NAME} - Sales Performance Portal*\n\nPlease select the timeframe you wish to view below:`,
    'Markdown',
    inlineKeyboard,
    chatId,
    editMessageId
  );
}

export async function sendTodaySales(chatId: string): Promise<void> {
  const dailyData = await loadReport('daily-sales');
  if (!dailyData || !Array.isArray(dailyData) || dailyData.length === 0) {
    await telegramClient.sendMessage(
      `⚠️ *No Sales Ledger Available*\n\nPlease trigger a sync first using /sync to ingest spreadsheets.`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId
    );
    return;
  }

  try {
    const latestDay = dailyData[0];
    
    const rawDate = new Date(latestDay.date);
    const formattedDate = rawDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const inflow = (latestDay.liquor || 0) + (latestDay.food || 0) + (latestDay.creditRecovery || 0);
    const outflow = (latestDay.expenses || 0) + (latestDay.creditExtended || 0);
    const net = inflow - outflow;
    const statusLabel = net >= 0 ? 'Surplus 🟢' : 'Deficit 🔴';

    const summaryText = `📅 *${config.BUSINESS_NAME} — Daily Sales Report*\n` +
       `📆 *Reconciled Date*: \`${formattedDate}\`\n\n` +
       `🔹 *Revenue Registers*\n` +
       `• 🍷 Liquor Counter:      \`₹${Math.round(latestDay.liquor || 0).toLocaleString('en-IN')}\`\n` +
       `• 🍲 Food Counter:        \`₹${Math.round(latestDay.food || 0).toLocaleString('en-IN')}\`\n` +
       `• 📥 Credit Recovery:     \`₹${Math.round(latestDay.creditRecovery || 0).toLocaleString('en-IN')}\`\n\n` +
       `🔹 *Expense & Credit*\n` +
       `• 🛠️ Daily Expenses:      \`₹${Math.round(latestDay.expenses || 0).toLocaleString('en-IN')}\`\n` +
       `• 📤 Credit Extended:     \`₹${Math.round(latestDay.creditExtended || 0).toLocaleString('en-IN')}\`\n` +
       `━━━━━━━━━━━━━━━━━━━━━━\n` +
       `• 📥 *Total Inflow*:       \`₹${Math.round(inflow).toLocaleString('en-IN')}\`\n` +
       `• 📤 *Total Outflow*:      \`₹${Math.round(outflow).toLocaleString('en-IN')}\`\n` +
       `• 💵 *Net Cash Balance*:   *\`₹${Math.round(net).toLocaleString('en-IN')}\`* (${statusLabel})\n` +
       `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
       `💡 _Note: This represents the latest fully reconciled business day on record._`;

    await telegramClient.sendMessage(summaryText, 'Markdown', getMainMenuKeyboard(), chatId);
  } catch (err: any) {
    logger.error({ err }, 'Failed to read daily sales data');
    await telegramClient.sendMessage(
      `❌ *Failed to read daily sales:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId
    );
  }
}

export async function sendMonthSelectionMenu(chatId: string, editMessageId?: number): Promise<void> {
  const data = await loadReport('sales');
  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No Sales Ledger Available*\n\nPlease trigger a sync first using /sync to ingest spreadsheets.`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const months = data.months || [];

    if (months.length === 0) {
      await telegramClient.sendMessage(
        `⚠️ *No monthly sheets found in register.*`,
        'Markdown',
        getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
      return;
    }

    const yearsSet = new Set<number>();
    let hasOther = false;
    for (const m of months) {
      const dVal = getMonthYearDate(m.sheetName);
      if (dVal.getTime() > 0 && dVal.getFullYear() > 1970) {
        yearsSet.add(dVal.getFullYear());
      } else {
        hasOther = true;
      }
    }

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    const buttons: InlineKeyboardButton[][] = [];
    for (let i = 0; i < sortedYears.length; i += 2) {
      const row: InlineKeyboardButton[] = [];
      row.push({ text: `📅 Year ${sortedYears[i]}`, callback_data: `year_${sortedYears[i]}` });
      if (i + 1 < sortedYears.length) {
        row.push({ text: `📅 Year ${sortedYears[i + 1]}`, callback_data: `year_${sortedYears[i + 1]}` });
      }
      buttons.push(row);
    }

    if (hasOther) {
      buttons.push([{ text: '📁 Other Sheets', callback_data: 'year_0' }]);
    }

    buttons.push([{ text: '◀️ Back to Options', callback_data: 'sales_back' }]);

    await telegramClient.sendMessage(
      `📅 *${config.BUSINESS_NAME} - Select Year*\n\nPlease select a year to view its monthly performance summaries:`,
      'Markdown',
      { inline_keyboard: buttons },
      chatId,
      editMessageId
    );
  } catch (err: any) {
    logger.error({ err }, 'Failed to generate year selection menu');
    await telegramClient.sendMessage(
      `❌ *Error generating year menu:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

export async function sendMonthsForYearMenu(chatId: string, year: number, editMessageId?: number): Promise<void> {
  const data = await loadReport('sales');
  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No Sales Ledger Available*`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const months = data.months || [];
    
    const filtered = months.filter((m: any) => {
      const dVal = getMonthYearDate(m.sheetName);
      const y = dVal.getTime() > 0 ? dVal.getFullYear() : 0;
      if (year === 0) {
        return y <= 1970;
      }
      return y === year;
    });

    if (filtered.length === 0) {
      await telegramClient.sendMessage(
        `⚠️ *No monthly sheets found for Year ${year === 0 ? 'Other' : year}.*`,
        'Markdown',
        getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
      return;
    }

    const sortedYearMonths = filtered.sort((a: any, b: any) => getMonthYearDate(b.sheetName).getTime() - getMonthYearDate(a.sheetName).getTime());
    
    const buttons: InlineKeyboardButton[][] = [];
    for (let i = 0; i < sortedYearMonths.length; i += 3) {
      const row: InlineKeyboardButton[] = [];
      row.push({ text: sortedYearMonths[i].sheetName, callback_data: `month_${sortedYearMonths[i].sheetName.replace(/\s/g, '_')}` });
      
      if (i + 1 < sortedYearMonths.length) {
        row.push({ text: sortedYearMonths[i + 1].sheetName, callback_data: `month_${sortedYearMonths[i + 1].sheetName.replace(/\s/g, '_')}` });
      }
      
      if (i + 2 < sortedYearMonths.length) {
        row.push({ text: sortedYearMonths[i + 2].sheetName, callback_data: `month_${sortedYearMonths[i + 2].sheetName.replace(/\s/g, '_')}` });
      }
      buttons.push(row);
    }

    buttons.push([
      { text: '◀️ Back to Years', callback_data: 'sales_month_menu' },
      { text: '📊 Back to Options', callback_data: 'sales_back' }
    ]);

    await telegramClient.sendMessage(
      `📅 *${config.BUSINESS_NAME} - ${year === 0 ? 'Other Sheets' : `Year ${year}`}* \n\nPlease select a month to view its performance summary:`,
      'Markdown',
      { inline_keyboard: buttons },
      chatId,
      editMessageId
    );
  } catch (err: any) {
    logger.error({ err, year }, 'Failed to generate months selection menu for year');
    await telegramClient.sendMessage(
      `❌ *Error generating months menu for year:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

export async function sendSpecificMonthSales(chatId: string, targetMonth: string, editMessageId?: number): Promise<void> {
  const data = await loadReport('sales');
  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No Sales Ledger Available*`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const months = data.months || [];

    const cleanTarget = targetMonth.toLowerCase().replace(/_/g, '').trim();
    const mData = months.find((m: { sheetName: string }) => m.sheetName.toLowerCase().replace(/\s/g, '') === cleanTarget.replace(/\s/g, ''));

    if (!mData) {
      await telegramClient.sendMessage(
        `⚠️ *Month not found in ledger database: "${targetMonth.replace(/_/g, ' ')}"*`,
        'Markdown',
        getMainMenuKeyboard(),
        chatId,
        editMessageId
      );
      return;
    }

    const inflows = (mData.liquor || 0) + (mData.food || 0) + (mData.creditRecovery || 0);
    const outflows = (mData.expenses || 0) + (mData.creditExtended || 0);
    const net = inflows - outflows;
    const statusLabel = net >= 0 ? 'Surplus 🟢' : 'Deficit 🔴';

    const summaryText = `📅 *${config.BUSINESS_NAME} — ${mData.sheetName} Sales Summary*\n\n` +
      `🔹 *Revenue Registers*\n` +
      `• 🍷 Liquor Sales:        \`₹${Math.round(mData.liquor || 0).toLocaleString('en-IN')}\`\n` +
      `• 🍲 Food Sales:          \`₹${Math.round(mData.food || 0).toLocaleString('en-IN')}\`\n` +
      `• 📥 Credit Recovery:     \`₹${Math.round(mData.creditRecovery || 0).toLocaleString('en-IN')}\`\n\n` +
      `🔹 *Expense & Credit*\n` +
      `• 🛠️ Operating Expenses:  \`₹${Math.round(mData.expenses || 0).toLocaleString('en-IN')}\`\n` +
      `• 📤 Credit Extended:     \`₹${Math.round(mData.creditExtended || 0).toLocaleString('en-IN')}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• 📥 *Total Inflow*:       \`₹${Math.round(inflows || 0).toLocaleString('en-IN')}\`\n` +
      `• 📤 *Total Outflow*:      \`₹${Math.round(outflows || 0).toLocaleString('en-IN')}\`\n` +
      `• 💵 *Net Cashflow*:       *\`₹${Math.round(net || 0).toLocaleString('en-IN')}\`* (${statusLabel})\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💬 _Tip: Select another month below to compare periods!_`;

    const match = mData.sheetName.match(/\b(20\d{2})\b/);
    const year = match ? parseInt(match[1], 10) : 0;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          ...(year ? [{ text: `◀️ Back to ${year}`, callback_data: `year_${year}` }] : []),
          { text: '📅 Select Month', callback_data: 'sales_month_menu' }
        ],
        [
          { text: '📊 Back to Options', callback_data: 'sales_back' }
        ]
      ]
    };

    await telegramClient.sendMessage(summaryText, 'Markdown', inlineKeyboard, chatId, editMessageId);
  } catch (err: any) {
    logger.error({ err }, 'Failed to read specific month sales');
    await telegramClient.sendMessage(
      `❌ *Error loading month sales:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

export async function sendSalesSummary(chatId: string, editMessageId?: number): Promise<void> {
  const data = await loadReport('sales');
  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No Sales Summary Found*\n\nPlease trigger a sync first using /sync to ingest spreadsheets and generate summaries.`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const summaryText = `📊 *${config.BUSINESS_NAME} — Master Sales Performance*\n` +
      `📅 *Audited Scope*: \`${data.totalMonths ?? data.months?.length ?? 0} months\` (${data.totalTransactions.toLocaleString()} transactions)\n` +
      `🕒 *Last Ingested*: \`${formatTimestampToDual(data.runTimestamp || data.timestamp)}\`\n\n` +
      `🔹 *Financial Metrics*\n` +
      `• 🍷 Liquor Total:     \`₹${Math.round(data.masterTotals?.liquorSales || 0).toLocaleString('en-IN')}\` (${data.benchmarks?.liquorPercentage || 0}% share)\n` +
      `• 🍲 Food Total:       \`₹${Math.round(data.masterTotals?.foodSales || 0).toLocaleString('en-IN')}\` (${data.benchmarks?.foodPercentage || 0}% share)\n` +
      `• 💵 Net Cashflow:      \`₹${Math.round(data.masterTotals?.netCashflow || 0).toLocaleString('en-IN')}\` (${data.masterTotals?.surplusStatus || 'N/A'})\n` +
      `• 🔄 Recovery Rate:     \`${data.benchmarks?.creditRecoveryRate || 0}%\` collection\n` +
      `• 🌟 Peak Performance:  \`${data.benchmarks?.bestRevenueMonth}\` (\`₹${Math.round(data.benchmarks?.bestRevenueValue || 0).toLocaleString('en-IN')}\`)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💬 _Tip: Ask me 'Compare sales across months' or 'Explain cashflow surplus' for an AI breakdown!_`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '◀️ Back to Options', callback_data: 'sales_back' }
        ]
      ]
    };

    await telegramClient.sendMessage(summaryText, 'Markdown', inlineKeyboard, chatId, editMessageId);
  } catch (err: any) {
    await telegramClient.sendMessage(
      `❌ *Failed to Read Sales Summary:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

export async function sendDebitorsSummary(chatId: string, editMessageId?: number): Promise<void> {
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "📊 Credit & Collection Summary", callback_data: "debitors_summary_metrics" }
      ],
      [
        { text: "🔥 Top Outstanding Debits", callback_data: "debitors_top_5" }
      ],
      [
        { text: "🚨 High Risk Accounts (>₹20k)", callback_data: "debitors_high_risk" }
      ],
      [
        { text: "📈 View Debits Bar Chart", callback_data: "debitors_chart" }
      ],
      [
        { text: "📂 View Google Drive Folder", url: `https://drive.google.com/drive/folders/${config.GOOGLE_DRIVE_FOLDER_ID}` }
      ]
    ]
  };

  await telegramClient.sendMessage(
    `👥 *${config.BUSINESS_NAME} - Debitors & Credit Directory*\n\nSelect an option below to view customer debts and credit tracking details:`,
    'Markdown',
    inlineKeyboard,
    chatId,
    editMessageId
  );
}

export async function sendDebitorsMetrics(chatId: string, editMessageId?: number): Promise<void> {
  const data = await loadReport('debitors');
  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No Debitors Summary Found*\n\nPlease trigger a sync first using /sync to ingest spreadsheets and generate summaries.`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const agg = data.aggregates || {};
    const metricsText = `📊 *${config.BUSINESS_NAME} — Credit & Collection Metrics*\n` +
      `🕒 *Last Ingested*: \`${formatTimestampToDual(data.timestamp || data.runTimestamp)}\`\n\n` +
      `🔹 *A/R Ledger Summaries*\n` +
      `• 📖 Active Debtors:      \`${agg.activeDebitorsCount || 0} accounts\`\n` +
      `• 📈 Total Debits Issued:  \`₹${Math.round(agg.totalDebitSum || 0).toLocaleString('en-IN')}\`\n` +
      `• 📥 Total Recovered:     \`₹${Math.round(agg.totalCreditSum || 0).toLocaleString('en-IN')}\`\n` +
      `• 💰 Outstanding Balance:  *\`₹${Math.round(agg.totalPendingSum || 0).toLocaleString('en-IN')}\`*\n` +
      `• ✅ Collection Success:   *\`${agg.collectionSuccessRate || 0}%\`*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💡 _Collection rate measures the percentage of total credit extended that has been successfully recovered._`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '◀️ Back to Debitors Menu', callback_data: 'debitors_menu' }
        ]
      ]
    };

    await telegramClient.sendMessage(metricsText, 'Markdown', inlineKeyboard, chatId, editMessageId);
  } catch (err: any) {
    await telegramClient.sendMessage(
      `❌ *Failed to Read Debitors Metrics:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

export async function sendDebitorsTop5(chatId: string, editMessageId?: number): Promise<void> {
  const data = await loadReport('debitors');
  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No Debitors Summary Found*`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const top = data.topDebitors || [];
    let text = `🔥 *${config.BUSINESS_NAME} — Top Outstanding Customer Debits*\n\n`;

    if (top.length > 0) {
       top.slice(0, 10).forEach((d: { name: string; pending?: number; pendingBalance?: number }, i: number) => {
         const pendingVal = d.pending ?? d.pendingBalance ?? 0;
         const riskLevel = pendingVal > 20000 ? '🚨 High' : pendingVal > 5000 ? '⚠️ Medium' : '✅ Low';
         text += `\`${i + 1}.\` *${d.name}*\n` +
                 `   • Balance: \`₹${Math.round(pendingVal).toLocaleString('en-IN')}\` • Risk: _${riskLevel}_\n`;
       });
    } else {
      text += `_No pending debtor accounts found!_\n`;
    }

    text += `\n💬 _Tip: Ask me 'Suggest a recovery plan for ${top[0]?.name || 'debtors'}' for AI strategic advice!_`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '◀️ Back to Debitors Menu', callback_data: 'debitors_menu' }
        ]
      ]
    };

    await telegramClient.sendMessage(text, 'Markdown', inlineKeyboard, chatId, editMessageId);
  } catch (err: any) {
    await telegramClient.sendMessage(
      `❌ *Failed to Read Top Debitors:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

export async function sendDebitorsHighRisk(chatId: string, editMessageId?: number): Promise<void> {
  const data = await loadReport('debitors');
  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No Debitors Summary Found*`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const top = data.allDebitors || data.topDebitors || [];
    const highRisk = top.filter((d: any) => {
      const pendingVal = d.pending ?? d.pendingBalance ?? 0;
      return pendingVal > 20000;
    });

    let text = `🚨 *${config.BUSINESS_NAME} — High Risk Customer Debits (>₹20,000)*\n\n`;

    if (highRisk.length > 0) {
       highRisk.forEach((d: { name: string; pending?: number; pendingBalance?: number }, i: number) => {
         const pendingVal = d.pending ?? d.pendingBalance ?? 0;
         text += `\`${i + 1}.\` *${d.name}* — \`₹${Math.round(pendingVal).toLocaleString('en-IN')}\`\n`;
       });
    } else {
      text += `_No high risk debtor accounts found with outstanding balances exceeding ₹20,000!_\n`;
    }

    text += `\n💬 _Tip: Direct collection effort immediately to these accounts to recover cashflow._`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '◀️ Back to Debitors Menu', callback_data: 'debitors_menu' }
        ]
      ]
    };

    await telegramClient.sendMessage(text, 'Markdown', inlineKeyboard, chatId, editMessageId);
  } catch (err: any) {
    await telegramClient.sendMessage(
      `❌ *Failed to Read High Risk Debitors:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

export async function sendStockSummary(chatId: string, reportType: 'godown_stock' | 'counter_stock', editMessageId?: number): Promise<void> {
  const data = await loadReport(reportType);
  const isCounter = reportType === 'counter_stock';
  const titleLabel = isCounter ? 'Counter Stock' : 'Godown Stock';
  const emoji = isCounter ? '🏪' : '🏭';
  const locKey = isCounter ? 'counter' : 'godown';

  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No ${titleLabel} Summary Available*\n\nPlease trigger a sync first using /sync to ingest spreadsheets and generate summaries.`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const agg = data.aggregates || {};
    const catAggs = data.categoryAggregates || [];
    
    let stockSummary = '';
    catAggs.forEach((c: any) => {
      let catEmoji = '📦';
      const catLower = (c.category || '').toLowerCase();
      if (catLower.includes('liquor')) catEmoji = '🍷';
      else if (catLower.includes('strong beer')) catEmoji = '🍺';
      else if (catLower.includes('mild beer')) catEmoji = '🍻';
      else if (catLower.includes('wine')) catEmoji = '🥂';

      const closing = `\`₹${Math.round(c.closingValue || 0).toLocaleString('en-IN')}\``;
      const count = `\`${c.itemsCount || 0} items\``;
      
      stockSummary += `• ${catEmoji} *${c.category || 'General'}*: ${closing} • ${count}\n`;
    });

    const summaryText = `${emoji} *${config.BUSINESS_NAME} — ${titleLabel} Summary*\n\n` +
      `*Inventory Valuation (Total):*\n` +
      `• Valuation (Cost):   \`₹${Math.round(agg.totalClosingValue || 0).toLocaleString('en-IN')}\`\n` +
      `• Valuation (Retail): \`₹${Math.round(agg.totalSellingValue || 0).toLocaleString('en-IN')}\`\n\n` +
      `*Category Valuations (Cost):*\n` +
      stockSummary + `\n` +
      `📊 *${titleLabel} Interactive Panel*\n` +
      `Select an option below to view deeper stock insights, top-moving items, inflow logs, and active alerts:`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "📊 Valuation", callback_data: `${reportType}_metrics` },
          { text: "🗂️ Categories", callback_data: `${reportType}_categories` }
        ],
        [
          { text: "🚨 Stock & Audit Alerts", callback_data: `${reportType}_alerts` }
        ],
        [
          { text: "🔥 Top Moving Items", callback_data: `${reportType}_top_movers` },
          { text: "📥 Recent Inflows", callback_data: `${reportType}_inflows` }
        ],
        [
          { text: "📈 View Valuation Pie Chart", callback_data: `${reportType}_chart` }
        ],
        [
          { text: "📂 View Google Drive Folder", url: `https://drive.google.com/drive/folders/${config.GOOGLE_DRIVE_FOLDER_ID}` }
        ]
      ]
    };

    await telegramClient.sendMessage(
      summaryText,
      'Markdown',
      inlineKeyboard,
      chatId,
      editMessageId
    );
  } catch (err: any) {
    logger.error({ err, reportType }, `Failed to send ${reportType} summary`);
    await telegramClient.sendMessage(
      `❌ *Failed to load ${titleLabel} summary:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

export async function sendStockMetrics(chatId: string, reportType: 'godown_stock' | 'counter_stock', editMessageId?: number): Promise<void> {
  const data = await loadReport(reportType);
  const isCounter = reportType === 'counter_stock';
  const titleLabel = isCounter ? 'Counter Stock' : 'Godown Stock';
  const emoji = isCounter ? '🏪' : '🏢';
  const locKey = isCounter ? 'counter' : 'godown';

  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No ${titleLabel} Metrics Available*`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const agg = data.aggregates || {};
    const stock = agg[locKey] || {};

    const metricsText = `📊 *${config.BUSINESS_NAME} — ${titleLabel} Valuation Metrics*\n` +
      `🕒 *Last Reconciled*: \`${formatTimestampToDual(data.runTimestamp || data.timestamp)}\`\n\n` +
      `${emoji} *${titleLabel} Stock Details*\n` +
      `• Active Products:        \`${stock.totalItemsCount || 0} lines\`\n` +
      `• Valuation (Cost):       \`₹${Math.round(stock.totalClosingValue || 0).toLocaleString('en-IN')}\`\n` +
      `• Valuation (Retail):     \`₹${Math.round(stock.totalSellingValue || 0).toLocaleString('en-IN')}\`\n` +
      `• Volume in Stock:        \`${Math.round(stock.totalVolumeLiters || 0).toLocaleString('en-IN')} Liters\`\n` +
      `• Total Stock-Out:        \`${stock.stockOutCount || 0} units\`\n` +
      `• Total Stock-In:         \`${stock.stockInCount || 0} units\`\n\n` +
      `💡 _Valuation at Cost is computed using purchase prices. Valuation at Retail is computed using selling/menu prices._`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: `◀️ Back to ${titleLabel} Menu`, callback_data: `${reportType}_menu` }
        ]
      ]
    };

    await telegramClient.sendMessage(metricsText, 'Markdown', inlineKeyboard, chatId, editMessageId);
  } catch (err: any) {
    await telegramClient.sendMessage(
      `❌ *Failed to Read ${titleLabel} Metrics:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

export async function sendStockCategories(chatId: string, reportType: 'godown_stock' | 'counter_stock', editMessageId?: number): Promise<void> {
  const data = await loadReport(reportType);
  const isCounter = reportType === 'counter_stock';
  const titleLabel = isCounter ? 'Counter Stock' : 'Godown Stock';

  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No ${titleLabel} Categories Available*`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const catAggs = data.categoryAggregates || [];
    let text = `🗂️ *${config.BUSINESS_NAME} — ${titleLabel} Categories*\n\n`;

    if (catAggs.length > 0) {
      catAggs.forEach((c: any) => {
        text += `• *${c.category || 'General'}*\n` +
          `  - Products:   \`${c.itemsCount || 0} items\`\n` +
          `  - Cost Value: \`₹${Math.round(c.closingValue || 0).toLocaleString('en-IN')}\`\n` +
          `  - Menu Value: \`₹${Math.round(c.sellingValue || 0).toLocaleString('en-IN')}\`\n` +
          `  - Liters Vol: \`${Math.round(c.totalVolumeLiters || 0).toLocaleString('en-IN')} L\`\n\n`;
      });
    } else {
      text += `_No category metrics found!_\n`;
    }

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: `◀️ Back to ${titleLabel} Menu`, callback_data: `${reportType}_menu` }
        ]
      ]
    };

    await telegramClient.sendMessage(text, 'Markdown', inlineKeyboard, chatId, editMessageId);
  } catch (err: any) {
    await telegramClient.sendMessage(
      `❌ *Failed to Read ${titleLabel} Categories:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

export async function sendStockAlerts(chatId: string, reportType: 'godown_stock' | 'counter_stock', editMessageId?: number): Promise<void> {
  const data = await loadReport(reportType);
  const isCounter = reportType === 'counter_stock';
  const titleLabel = isCounter ? 'Counter Stock' : 'Godown Stock';

  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No ${titleLabel} Alerts Available*`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const alerts = data.alerts || [];
    let text = `🚨 *${config.BUSINESS_NAME} — ${titleLabel} Compliance Alerts*\n\n`;

    if (alerts.length > 0) {
      alerts.slice(0, 10).forEach((a: any, i: number) => {
        const severityLabel = a.severity === 'high' || a.severity === 'critical' ? '🔴' : '⚠️';
        text += `\`${i + 1}.\` ${severityLabel} *${a.ruleName || 'Audit Issue'}*\n` +
          `   _${a.message || 'Discrepancy detected'}_ \n\n`;
      });
      if (alerts.length > 10) {
        text += `_...and ${alerts.length - 10} more alerts. Check the auditor console for full details._\n`;
      }
    } else {
      text += `✅ _No stock alerts or audit discrepancies found! All inventory is reconciled._\n`;
    }

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: `◀️ Back to ${titleLabel} Menu`, callback_data: `${reportType}_menu` }
        ]
      ]
    };

    await telegramClient.sendMessage(text, 'Markdown', inlineKeyboard, chatId, editMessageId);
  } catch (err: any) {
    await telegramClient.sendMessage(
      `❌ *Failed to Read ${titleLabel} Alerts:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

export async function sendStockTopMovers(chatId: string, reportType: 'godown_stock' | 'counter_stock', editMessageId?: number): Promise<void> {
  const data = await loadReport(reportType);
  const isCounter = reportType === 'counter_stock';
  const titleLabel = isCounter ? 'Counter Stock' : 'Godown Stock';

  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No ${titleLabel} Top Movers Available*`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const items = data.items || [];
    const topMovers = [...items]
      .filter((item: any) => Number(item.stockOut || 0) > 0)
      .sort((a: any, b: any) => Number(b.stockOut || 0) - Number(a.stockOut || 0))
      .slice(0, 10);

    let text = `🔥 *${config.BUSINESS_NAME} — ${titleLabel} Top Movers (Stock-Out)*\n\n`;

    if (topMovers.length > 0) {
      topMovers.forEach((item: any, i: number) => {
        const qty = item.stockOut;
        const retailValue = qty * (item.sellingPrice || 0);
        const isLoose = item.bottleSizeMl === 0;
        const sizeLabel = isLoose ? 'Loose' : `${item.bottleSizeMl}ml`;
        const unitLabel = isLoose ? 'ml' : 'units';
        const pkgText = isLoose ? '' : ` (${item.packaging || 'bottle'})`;
        text += `\`${i + 1}.\` *${item.itemName}* (${sizeLabel})\n` +
          `   • Outflow: \`${qty} ${unitLabel}\`${pkgText}\n` +
          `   • Retail:  \`₹${Math.round(retailValue).toLocaleString('en-IN')}\`\n` +
          `   • Closing: \`${item.closingStock} ${unitLabel} left\`\n\n`;
      });
    } else {
      text += `_No items have been registered as stock-out in the current ledger._\n`;
    }

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: `◀️ Back to ${titleLabel} Menu`, callback_data: `${reportType}_menu` }
        ]
      ]
    };

    await telegramClient.sendMessage(text, 'Markdown', inlineKeyboard, chatId, editMessageId);
  } catch (err: any) {
    await telegramClient.sendMessage(
      `❌ *Failed to Read ${titleLabel} Top Movers:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

export async function sendStockInflows(chatId: string, reportType: 'godown_stock' | 'counter_stock', editMessageId?: number): Promise<void> {
  const data = await loadReport(reportType);
  const isCounter = reportType === 'counter_stock';
  const titleLabel = isCounter ? 'Counter Stock' : 'Godown Stock';

  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No ${titleLabel} Inflow Records Available*`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const items = data.items || [];
    const topInflows = [...items]
      .filter((item: any) => Number(item.stockIn || 0) > 0)
      .sort((a: any, b: any) => Number(b.stockIn || 0) - Number(a.stockIn || 0))
      .slice(0, 10);

    let text = `📥 *${config.BUSINESS_NAME} — ${titleLabel} Top Inflows (Restocked)*\n\n`;

    if (topInflows.length > 0) {
      topInflows.forEach((item: any, i: number) => {
        const qty = item.stockIn;
        const costValue = qty * (item.costPrice || 0);
        const isLoose = item.bottleSizeMl === 0;
        const sizeLabel = isLoose ? 'Loose' : `${item.bottleSizeMl}ml`;
        const unitLabel = isLoose ? 'ml' : 'units';
        const pkgText = isLoose ? '' : ` (${item.packaging || 'bottle'})`;
        text += `\`${i + 1}.\` *${item.itemName}* (${sizeLabel})\n` +
          `   • Restocked: \`${qty} ${unitLabel}\`${pkgText}\n` +
          `   • Cost:      \`₹${Math.round(costValue).toLocaleString('en-IN')}\`\n` +
          `   • Closing:   \`${item.closingStock} ${unitLabel} total\`\n\n`;
      });
    } else {
      text += `_No items have been registered as stock-in in the current ledger._\n`;
    }

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: `◀️ Back to ${titleLabel} Menu`, callback_data: `${reportType}_menu` }
        ]
      ]
    };

    await telegramClient.sendMessage(text, 'Markdown', inlineKeyboard, chatId, editMessageId);
  } catch (err: any) {
    await telegramClient.sendMessage(
      `❌ *Failed to Read ${titleLabel} Inflows:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

function stringifyChartConfig(config: any): string {
  const json = JSON.stringify(config);
  // Remove quotes around stringified function representations so QuickChart evaluates them as raw JS functions
  return json.replace(/"(function\b(?:[^"\\]|\\.)*)"/gs, (match, p1) => {
    try {
      return JSON.parse('"' + p1 + '"');
    } catch {
      return p1
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    }
  });
}

export async function sendSalesChart(chatId: string, editMessageId?: number): Promise<void> {
  const data = await loadReport('sales');
  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No Sales Summary Available*\n\nPlease trigger a sync first using /sync.`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const months = [...(data.months || [])].sort((a, b) => getMonthYearDate(a.sheetName).getTime() - getMonthYearDate(b.sheetName).getTime());
    
    if (months.length === 0) {
      throw new Error("No monthly data available for cashflow visualization.");
    }

    // Build Chart.js v2 configuration
    const chartConfig = {
      type: 'bar',
      data: {
        labels: months.map(m => m.sheetName),
        datasets: [
          {
            label: 'Inflows (₹)',
            backgroundColor: 'rgba(16, 185, 129, 0.55)', // emerald-500
            borderColor: 'rgb(16, 185, 129)',
            borderWidth: 1.5,
            data: months.map(m => Math.round((m.liquor || 0) + (m.food || 0) + (m.creditRecovery || 0))),
          },
          {
            label: 'Net Cashflow (₹)',
            type: 'line',
            borderColor: 'rgb(99, 102, 241)', // indigo-500
            backgroundColor: 'transparent',
            borderWidth: 3,
            fill: false,
            data: months.map(m => Math.round((m.liquor || 0) + (m.food || 0) + (m.creditRecovery || 0) - ((m.expenses || 0) + (m.creditExtended || 0)))),
          }
        ]
      },
      options: {
        layout: {
          padding: {
            left: 20,
            right: 20,
            top: 20,
            bottom: 20
          }
        },
        title: {
          display: true,
          text: 'Monthly Inflows vs Net Surplus',
          fontColor: '#ffffff',
          fontSize: 16
        },
        legend: {
          labels: { fontColor: '#ffffff' }
        },
        scales: {
          yAxes: [{
            ticks: { fontColor: '#ffffff', callback: `function(value) { return '₹' + Number(value).toLocaleString('en-IN'); }` },
            gridLines: { color: 'rgba(255, 255, 255, 0.08)' }
          }],
          xAxes: [{
            ticks: { fontColor: '#ffffff' },
            gridLines: { color: 'rgba(255, 255, 255, 0.08)' }
          }]
        }
      }
    };

    const configStr = encodeURIComponent(stringifyChartConfig(chartConfig));
    const quickchartUrl = `https://quickchart.io/chart?c=${configStr}&bkg=%230c0c0e&w=800&h=450`;

    const caption = `📊 *${config.BUSINESS_NAME} — Cashflow Trend Chart*\n\n` +
      `• Blue Line represents the *Net Cashflow (Surplus/Deficit)*.\n` +
      `• Green Bars represent the *Total Monthly Inflows* (Revenue + Recoveries).\n\n` +
      `🕒 _Generated from latest spreadsheet sync._`;

    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: '◀️ Back to Options', callback_data: 'sales_back' }]
      ]
    };

    await telegramClient.sendPhoto(quickchartUrl, caption, 'Markdown', inlineKeyboard, chatId);
  } catch (err: any) {
    logger.error({ err }, 'Failed to send sales chart');
    await telegramClient.sendMessage(
      `❌ *Failed to generate Cashflow Chart:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

export async function sendDebitorsChart(chatId: string, editMessageId?: number): Promise<void> {
  const data = await loadReport('debitors');
  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No Debitors Summary Available*\n\nPlease trigger a sync first using /sync.`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const top = [...(data.topDebitors || [])].slice(0, 5);
    if (top.length === 0) {
      throw new Error("No pending debtor balances available for visualization.");
    }

    const chartConfig = {
      type: 'horizontalBar',
      data: {
        labels: top.map(d => d.name),
        datasets: [
          {
            label: 'Outstanding Dues (₹)',
            backgroundColor: top.map(d => d.pending > 20000 ? 'rgba(239, 68, 68, 0.65)' : 'rgba(245, 158, 11, 0.65)'), // rose vs amber
            borderColor: top.map(d => d.pending > 20000 ? 'rgb(239, 68, 68)' : 'rgb(245, 158, 11)'),
            borderWidth: 1.5,
            data: top.map(d => Math.round(d.pending || 0)),
          }
        ]
      },
      options: {
        layout: {
          padding: {
            left: 20,
            right: 20,
            top: 20,
            bottom: 20
          }
        },
        title: {
          display: true,
          text: 'Top Outstanding Customer Balances',
          fontColor: '#ffffff',
          fontSize: 16
        },
        legend: { display: false },
        scales: {
          yAxes: [{
            ticks: { fontColor: '#ffffff' },
            gridLines: { color: 'rgba(255, 255, 255, 0.08)' }
          }],
          xAxes: [{
            ticks: { fontColor: '#ffffff', callback: `function(value) { return '₹' + Number(value).toLocaleString('en-IN'); }` },
            gridLines: { color: 'rgba(255, 255, 255, 0.08)' }
          }]
        }
      }
    };

    const configStr = encodeURIComponent(stringifyChartConfig(chartConfig));
    const quickchartUrl = `https://quickchart.io/chart?c=${configStr}&bkg=%230c0c0e&w=800&h=450`;

    const caption = `👥 *${config.BUSINESS_NAME} — A/R Outstanding Chart*\n\n` +
      `• Red Bars represent *High Risk Accounts* (>₹20,000).\n` +
      `• Orange Bars represent *Medium Risk Accounts*.\n\n` +
      `💬 _Tip: Direct collection effort immediately to these accounts to recover cashflow._`;

    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: '◀️ Back to Debitors Menu', callback_data: 'debitors_menu' }]
      ]
    };

    await telegramClient.sendPhoto(quickchartUrl, caption, 'Markdown', inlineKeyboard, chatId);
  } catch (err: any) {
    logger.error({ err }, 'Failed to send debitors chart');
    await telegramClient.sendMessage(
      `❌ *Failed to generate A/R Chart:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

export async function sendStockChart(chatId: string, reportType: 'godown_stock' | 'counter_stock', editMessageId?: number): Promise<void> {
  const data = await loadReport(reportType);
  const isCounter = reportType === 'counter_stock';
  const titleLabel = isCounter ? 'Counter Stock' : 'Godown Stock';

  if (!data) {
    await telegramClient.sendMessage(
      `⚠️ *No ${titleLabel} Summary Available*\n\nPlease trigger a sync first using /sync.`,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
    return;
  }

  try {
    const catAggs = data.categoryAggregates || [];
    if (catAggs.length === 0) {
      throw new Error(`No category aggregates available for ${titleLabel} visualization.`);
    }

    const chartConfig = {
      type: 'doughnut',
      data: {
        labels: catAggs.map((c: any) => c.category || 'General'),
        datasets: [{
          data: catAggs.map((c: any) => Math.round(c.closingValue || 0)),
          backgroundColor: [
            'rgba(99, 102, 241, 0.7)', // Indigo
            'rgba(16, 185, 129, 0.7)', // Emerald
            'rgba(245, 158, 11, 0.7)', // Amber
            'rgba(239, 68, 68, 0.7)',  // Rose
            'rgba(6, 182, 212, 0.7)',  // Cyan
            'rgba(168, 85, 247, 0.7)'  // Purple
          ],
          borderColor: [
            'rgb(99, 102, 241)',
            'rgb(16, 185, 129)',
            'rgb(245, 158, 11)',
            'rgb(239, 68, 68)',
            'rgb(6, 182, 212)',
            'rgb(168, 85, 247)'
          ],
          borderWidth: 1.5
        }]
      },
      options: {
        layout: {
          padding: {
            left: 20,
            right: 40,
            top: 20,
            bottom: 20
          }
        },
        title: {
          display: true,
          text: `${titleLabel} Valuation by Category (Cost)`,
          fontColor: '#ffffff',
          fontSize: 16
        },
        legend: {
          position: 'right',
          labels: { fontColor: '#ffffff', fontSize: 11 }
        },
        plugins: {
          datalabels: {
            display: `function(ctx) {
              var value = ctx.dataset.data[ctx.dataIndex];
              var sum = 0;
              var dataArr = ctx.dataset.data;
              for (var i = 0; i < dataArr.length; i++) {
                sum += dataArr[i];
              }
              if (sum === 0) return false;
              var percentage = (value * 100) / sum;
              return percentage >= 5;
            }`,
            color: '#ffffff',
            borderRadius: 4,
            backgroundColor: 'rgba(12, 12, 14, 0.75)',
            padding: 5,
            font: {
              weight: 'bold',
              size: 11
            },
            formatter: `function(value, ctx) {
              var sum = 0;
              var dataArr = ctx.chart.data.datasets[0].data;
              for (var i = 0; i < dataArr.length; i++) {
                sum += dataArr[i];
              }
              if (sum === 0) return '';
              var percentage = (value * 100) / sum;
              return percentage >= 5 ? percentage.toFixed(0) + '%' : '';
            }`
          }
        }
      }
    };

    const configStr = encodeURIComponent(stringifyChartConfig(chartConfig));
    const quickchartUrl = `https://quickchart.io/chart?c=${configStr}&bkg=%230c0c0e&w=800&h=450`;

    const caption = `🏭 *${config.BUSINESS_NAME} — ${titleLabel} Category Chart*\n\n` +
      `• Segments represent the total stock value calculated at purchase cost.\n\n` +
      `🕒 _Generated from latest spreadsheet sync._`;

    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: `◀️ Back to ${titleLabel} Menu`, callback_data: `${reportType}_menu` }]
      ]
    };

    await telegramClient.sendPhoto(quickchartUrl, caption, 'Markdown', inlineKeyboard, chatId);
  } catch (err: any) {
    logger.error({ err, reportType }, `Failed to send ${reportType} chart`);
    await telegramClient.sendMessage(
      `❌ *Failed to generate ${titleLabel} Chart:*\n\n\`${err.message}\``,
      'Markdown',
      getMainMenuKeyboard(),
      chatId,
      editMessageId
    );
  }
}

// ==========================================
// Thin backward-compatible wrappers
// ==========================================

export async function sendGodownStockSummary(chatId: string, editMessageId?: number): Promise<void> {
  return sendStockSummary(chatId, 'godown_stock', editMessageId);
}

export async function sendGodownStockMetrics(chatId: string, editMessageId?: number): Promise<void> {
  return sendStockMetrics(chatId, 'godown_stock', editMessageId);
}

export async function sendGodownStockCategories(chatId: string, editMessageId?: number): Promise<void> {
  return sendStockCategories(chatId, 'godown_stock', editMessageId);
}

export async function sendGodownStockAlerts(chatId: string, editMessageId?: number): Promise<void> {
  return sendStockAlerts(chatId, 'godown_stock', editMessageId);
}

export async function sendGodownStockTopMovers(chatId: string, editMessageId?: number): Promise<void> {
  return sendStockTopMovers(chatId, 'godown_stock', editMessageId);
}

export async function sendGodownStockInflows(chatId: string, editMessageId?: number): Promise<void> {
  return sendStockInflows(chatId, 'godown_stock', editMessageId);
}

export async function sendCounterStockSummary(chatId: string, editMessageId?: number): Promise<void> {
  return sendStockSummary(chatId, 'counter_stock', editMessageId);
}

export async function sendCounterStockMetrics(chatId: string, editMessageId?: number): Promise<void> {
  return sendStockMetrics(chatId, 'counter_stock', editMessageId);
}

export async function sendCounterStockCategories(chatId: string, editMessageId?: number): Promise<void> {
  return sendStockCategories(chatId, 'counter_stock', editMessageId);
}

export async function sendCounterStockAlerts(chatId: string, editMessageId?: number): Promise<void> {
  return sendStockAlerts(chatId, 'counter_stock', editMessageId);
}

export async function sendCounterStockTopMovers(chatId: string, editMessageId?: number): Promise<void> {
  return sendStockTopMovers(chatId, 'counter_stock', editMessageId);
}

export async function sendCounterStockInflows(chatId: string, editMessageId?: number): Promise<void> {
  return sendStockInflows(chatId, 'counter_stock', editMessageId);
}
