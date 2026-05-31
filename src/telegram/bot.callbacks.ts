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

    const summaryText = `📅 *${config.BUSINESS_NAME} - Daily Sales Summary*\n` +
       `📆 *Date*: *${formattedDate}*\n\n` +
       `• 🍷 *Liquor Counter*: ₹${Math.round(latestDay.liquor || 0).toLocaleString()}\n` +
       `• 🍲 *Food Counter*: ₹${Math.round(latestDay.food || 0).toLocaleString()}\n` +
       `• 📥 *Credit Recovery (Udhari Jama)*: ₹${Math.round(latestDay.creditRecovery || 0).toLocaleString()}\n` +
       `• 🛠️ *Daily Expenses*: ₹${Math.round(latestDay.expenses || 0).toLocaleString()}\n` +
       `• 📤 *Credit Extended (Udhari)*: ₹${Math.round(latestDay.creditExtended || 0).toLocaleString()}\n` +
       `━━━━━━━━━━━━━━━━━━━━━━\n` +
       `• 📥 *Total Inflow*: ₹${Math.round(inflow).toLocaleString()}\n` +
       `• 📤 *Total Outflow*: ₹${Math.round(outflow).toLocaleString()}\n` +
       `• 💵 *Net Balance*: *₹${Math.round(net).toLocaleString()}* (${statusLabel})\n\n` +
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

    const summaryText = `📅 *${config.BUSINESS_NAME} - ${mData.sheetName} Sales Summary*\n\n` +
      `• 🍷 *Liquor Sales*: ₹${Math.round(mData.liquor || 0).toLocaleString()}\n` +
      `• 🍲 *Food Sales*: ₹${Math.round(mData.food || 0).toLocaleString()}\n` +
      `• 📥 *Credit Recovery (Udhari Jama)*: ₹${Math.round(mData.creditRecovery || 0).toLocaleString()}\n` +
      `• 🛠️ *Operating Expenses*: ₹${Math.round(mData.expenses || 0).toLocaleString()}\n` +
      `• 📤 *Credit Extended (Udhari)*: ₹${Math.round(mData.creditExtended || 0).toLocaleString()}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• 📥 *Total Inflow*: ₹${Math.round(inflows || 0).toLocaleString()}\n` +
      `• 📤 *Total Outflow*: ₹${Math.round(outflows || 0).toLocaleString()}\n` +
      `• 💵 *Net Cashflow*: *₹${Math.round(net || 0).toLocaleString()}* (${statusLabel})\n\n` +
      `💬 _Tip: Tap 'Select Another Month' to compare different periods!_`;

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
    const summaryText = `📊 *${config.BUSINESS_NAME} - Daily Sales Summary*\n` +
      `📅 *Audited Months*: ${data.totalMonths ?? data.months?.length ?? 0} months (${data.totalTransactions} transactions)\n` +
      `🕒 *Last Ingested*: \`${formatTimestampToDual(data.runTimestamp || data.timestamp)}\`\n\n` +
      `*Key Financial Metrics:*\n` +
      `• 🍷 *Liquor Sales*: ₹${Math.round(data.masterTotals?.liquorSales || 0).toLocaleString()} (${data.benchmarks?.liquorPercentage || 0}% of sales)\n` +
      `• 🍲 *Food Sales*: ₹${Math.round(data.masterTotals?.foodSales || 0).toLocaleString()} (${data.benchmarks?.foodPercentage || 0}% of sales)\n` +
      `• 💵 *Net Cashflow*: ₹${Math.round(data.masterTotals?.netCashflow || 0).toLocaleString()} (${data.masterTotals?.surplusStatus || 'N/A'})\n` +
      `• 🔄 *Credit Recovery Rate*: ${data.benchmarks?.creditRecoveryRate || 0}%\n` +
      `• 🌟 *Best Month*: ${data.benchmarks?.bestRevenueMonth} (₹${Math.round(data.benchmarks?.bestRevenueValue || 0).toLocaleString()})\n\n` +
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
    const metricsText = `📊 *${config.BUSINESS_NAME} - Credit & Collection Metrics*\n` +
      `🕒 *Last Ingested*: \`${formatTimestampToDual(data.timestamp || data.runTimestamp)}\`\n\n` +
      `• 📖 *Active Credit Accounts*: ${agg.activeDebitorsCount || 0} customers\n` +
      `• 📉 *Total Credit Extended*: ₹${Math.round(agg.totalDebitSum || 0).toLocaleString()}\n` +
      `• 📈 *Total Credit Recovered*: ₹${Math.round(agg.totalCreditSum || 0).toLocaleString()}\n` +
      `• 💰 *Net Balance Outstanding*: *₹${Math.round(agg.totalPendingSum || 0).toLocaleString()}*\n` +
      `• ✅ *Collection Success Rate*: *${agg.collectionSuccessRate || 0}%*\n\n` +
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
    let text = `🔥 *${config.BUSINESS_NAME} - Top 5 Outstanding Customer Debits*\n\n`;

    if (top.length > 0) {
       top.slice(0, 5).forEach((d: { name: string; pending?: number; pendingBalance?: number }, i: number) => {
         const pendingVal = d.pending ?? d.pendingBalance ?? 0;
         const riskLevel = pendingVal > 20000 ? 'High Risk 🚨' : pendingVal > 5000 ? 'Medium Alert ⚠️' : 'Healthy ✅';
         text += `${i + 1}. *${d.name}*: *₹${Math.round(pendingVal).toLocaleString()}* (Risk: _${riskLevel}_)\n`;
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

    let text = `🚨 *${config.BUSINESS_NAME} - High Risk Customer Debits (>₹20,000)*\n\n`;

    if (highRisk.length > 0) {
       highRisk.forEach((d: { name: string; pending?: number; pendingBalance?: number }, i: number) => {
         const pendingVal = d.pending ?? d.pendingBalance ?? 0;
         text += `${i + 1}. *${d.name}*: *₹${Math.round(pendingVal).toLocaleString()}*\n`;
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
