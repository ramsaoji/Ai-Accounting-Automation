import type { MasterSummary } from './types';

// ==================== 1. REAL EXCEL-PARSED DAILY SALES REGISTER DATA ====================
export const mockSalesSummary: MasterSummary = {
  fileName: "Hotel Gaurav Daily Sales Register.xlsx",
  runTimestamp: "5/25/2026, 2:09:17 PM",
  totalTransactions: 3563,
  totalMonths: 25,
  masterTotals: {
    liquorSales: 40544890,
    foodSales: 3124375,
    creditRecovery: 4761505,
    expenses: 5859000,
    creditExtended: 5003135,
    totalInflows: 48430770,
    totalOutflows: 10862135,
    netCashflow: 37568635,
    surplusStatus: "Surplus"
  },
  benchmarks: {
    bestRevenueMonth: "MAY 2025",
    bestRevenueValue: 2604080,
    bestProfitMonth: "MAY 2025",
    bestProfitValue: 2113405,
    peakExpenseMonth: "June 2024",
    peakExpenseValue: 267385,
    liquorPercentage: "92.8",
    foodPercentage: "7.2",
    creditRecoveryRate: "95.2",
    creditOutstandingGap: 241630
  },
  months: [
    { sheetName: "MARCH 2026", liquor: 1684510, food: 149295, creditRecovery: 222680, expenses: 266660, creditExtended: 215790, inflows: 2056485, outflows: 482450, net: 1574035, status: "Surplus" },
    { sheetName: "FEB 2026", liquor: 1402940, food: 115985, creditRecovery: 141530, expenses: 226680, creditExtended: 166000, inflows: 1660455, outflows: 392680, net: 1267775, status: "Surplus" },
    { sheetName: "JAN 2026", liquor: 1363790, food: 106320, creditRecovery: 196480, expenses: 223310, creditExtended: 198530, inflows: 1666590, outflows: 421840, net: 1244750, status: "Surplus" },
    { sheetName: "DEC 2025", liquor: 1448830, food: 122960, creditRecovery: 186030, expenses: 225630, creditExtended: 195240, inflows: 1757820, outflows: 420870, net: 1336950, status: "Surplus" },
    { sheetName: "NOV 2025", liquor: 1613650, food: 128405, creditRecovery: 216620, expenses: 226310, creditExtended: 226620, inflows: 1958675, outflows: 452930, net: 1505745, status: "Surplus" },
    { sheetName: "OCT 2025", liquor: 1725680, food: 143525, creditRecovery: 223290, expenses: 254770, creditExtended: 224860, inflows: 2092495, outflows: 479630, net: 1612865, status: "Surplus" },
    { sheetName: "SEPT 2025", liquor: 1538210, food: 111695, creditRecovery: 204520, expenses: 257720, creditExtended: 228730, inflows: 1854425, outflows: 486450, net: 1367975, status: "Surplus" },
    { sheetName: "AUG 2025", liquor: 1736020, food: 111115, creditRecovery: 179030, expenses: 223770, creditExtended: 196670, inflows: 2026165, outflows: 420440, net: 1605725, status: "Surplus" },
    { sheetName: "JULY 2025", liquor: 1655490, food: 120380, creditRecovery: 173410, expenses: 248010, creditExtended: 177720, inflows: 1949280, outflows: 425730, net: 1523550, status: "Surplus" },
    { sheetName: "JUNE 2025", liquor: 2008670, food: 146220, creditRecovery: 239730, expenses: 236340, creditExtended: 220660, inflows: 2394620, outflows: 457000, net: 1937620, status: "Surplus" },
    { sheetName: "MAY 2025", liquor: 2227050, food: 156615, creditRecovery: 220415, expenses: 241330, creditExtended: 249345, inflows: 2604080, outflows: 490675, net: 2113405, status: "Surplus" },
    { sheetName: "APRIL 2025", liquor: 2074400, food: 145845, creditRecovery: 235640, expenses: 230820, creditExtended: 243620, inflows: 2455885, outflows: 474440, net: 1981445, status: "Surplus" },
    { sheetName: "MARCH 2025", liquor: 1533780, food: 117795, creditRecovery: 192800, expenses: 211680, creditExtended: 197030, inflows: 1844375, outflows: 408710, net: 1435665, status: "Surplus" },
    { sheetName: "FEB 2025", liquor: 1436720, food: 123130, creditRecovery: 154530, expenses: 208520, creditExtended: 209900, inflows: 1714380, outflows: 418420, net: 1295960, status: "Surplus" },
    { sheetName: "JAN 2025", liquor: 1404720, food: 127440, creditRecovery: 222645, expenses: 232930, creditExtended: 200230, inflows: 1754805, outflows: 433160, net: 1321645, status: "Surplus" },
    { sheetName: "DEC 2024", liquor: 1546140, food: 138535, creditRecovery: 231000, expenses: 239780, creditExtended: 234050, inflows: 1915675, outflows: 473830, net: 1441845, status: "Surplus" },
    { sheetName: "NOV 2024", liquor: 1519770, food: 129080, creditRecovery: 153370, expenses: 259975, creditExtended: 193080, inflows: 1802220, outflows: 453055, net: 1349165, status: "Surplus" },
    { sheetName: "OCT 2024", liquor: 1615730, food: 132030, creditRecovery: 208280, expenses: 254000, creditExtended: 215290, inflows: 1956040, outflows: 469290, net: 1486750, status: "Surplus" },
    { sheetName: "SEPT 2024", liquor: 1416980, food: 107565, creditRecovery: 186580, expenses: 221350, creditExtended: 205145, inflows: 1711125, outflows: 426495, net: 1284630, status: "Surplus" },
    { sheetName: "AUG 2024", liquor: 1497160, food: 105470, creditRecovery: 185920, expenses: 220020, creditExtended: 195400, inflows: 1788550, outflows: 415420, net: 1373130, status: "Surplus" },
    { sheetName: "JULY 2024", liquor: 1541490, food: 120090, creditRecovery: 178700, expenses: 251070, creditExtended: 179600, inflows: 1840280, outflows: 430670, net: 1409610, status: "Surplus" },
    { sheetName: "JUNE 2024", liquor: 1749230, food: 135320, creditRecovery: 177330, expenses: 267385, creditExtended: 185410, inflows: 2061880, outflows: 452795, net: 1609085, status: "Surplus" },
    { sheetName: "MAY 2024", liquor: 1734390, food: 108330, creditRecovery: 152265, expenses: 214390, creditExtended: 165505, inflows: 1994985, outflows: 379895, net: 1615090, status: "Surplus" }
  ],
  alerts: [],
  errors: [],
  intelligence: [
    "The high liquor sales ratio of 92.8% represents an elite cash cow model. However, high food margins represent an upselling channel. Expanding premium restaurant entrees can increase restaurant net yield.",
    "A monthly expense peak occurred in June 2024 (₹2,67,385) and September 2025 (₹2,57,720). Consolidating vendor logistics and securing monthly wholesale pricing caps on high-frequency grocery inputs will lower overall spend.",
    "Total credit collection risk exposure sits at ₹2,41,630. Tightening default thresholds on uncollected customer tabs to a maximum of ₹15,000 per party will release significant restaurant liquidity."
  ]
};

// ==================== 2. REAL EXCEL-PARSED DEBITORS OUTSTANDING LEDGER DATA ====================
export const mockDebitorsSummary: MasterSummary = {
  fileName: "DEBITORS LIST.xlsx",
  runTimestamp: "5/25/2026, 2:09:21 PM",
  isDebitorsList: true,
  totalTransactions: 137,
  aggregates: {
    totalDebitSum: 5375545,
    totalCreditSum: 5200175,
    totalPendingSum: 175370,
    collectionSuccessRate: "96.7",
    averageOutstandingDues: 1280,
    activeDebitorsCount: 137,
    topDebtorName: "DILIP SAGADE",
    topDebtorValue: 20690
  },
  topDebitors: [
    { name: "DILIP SAGADE", debit: 138750, credit: 118060, pending: 20690 },
    { name: "SURAJ KHARCHE", debit: 490510, credit: 474860, pending: 15650 },
    { name: "RAILY SAHEB (TIKET)", debit: 316470, credit: 307870, pending: 8600 },
    { name: "GAWALE SAHEB (AKOLA JANTA)", debit: 406960, credit: 398420, pending: 8540 },
    { name: "THAKUR SAHEB (SBI)", debit: 252050, credit: 244950, pending: 7100 },
    { name: "MALI WAYARMAN", debit: 21390, credit: 15770, pending: 5620 },
    { name: "KALIM PATEL", debit: 44070, credit: 38790, pending: 5280 },
    { name: "JOSHI SAHEB RAILWAY", debit: 122600, credit: 117570, pending: 5030 },
    { name: "MUNNA PANSARE (SHRAVAN)", debit: 168880, credit: 163860, pending: 5020 },
    { name: "UJJWAL TARKASE", debit: 65930, credit: 60910, pending: 5020 },
    { name: "SABLE SAHEB (POST)", debit: 66980, credit: 62000, pending: 4980 },
    { name: "DANDNAIK (PAPA)", debit: 42350, credit: 37400, pending: 4950 },
    { name: "CHAVHAN (POLICE)", debit: 62890, credit: 58000, pending: 4890 },
    { name: "DESHMUKH (R.T.O.)", debit: 84600, credit: 80000, pending: 4600 },
    { name: "KIRTIDHAR MORE", debit: 22690, credit: 18100, pending: 4590 }
  ],
  alerts: [],
  errors: [],
  intelligence: [
    "Dues concentration alert: DILIP SAGADE holds ₹20,690 (11.8% of the total uncollected restaurant accounts). Restricting further credit lines will lower bad-debt exposures.",
    "The restaurant shows an extraordinary credit collection success rate of 96.7%, recovering ₹52.0 Lakhs out of ₹53.7 Lakhs extended. Outstanding balances are highly distributed and disciplined.",
    "Average dues are extremely safe and low at ₹1,280 across 137 active customers, indicating a highly decentralized credit pool with negligible individual default impacts."
  ]
};
