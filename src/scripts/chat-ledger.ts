import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { AiProviderFactory } from '../ai/ai.factory.js';
import { logger } from '../logger/logger.js';

interface Book {
  folderName: string;
  summaryPath: string;
  fileName: string;
  summaryJson: any;
  rawData: string;
}

async function startInteractiveChat() {
  const outputDir = path.resolve(process.cwd(), 'data', 'output');
  
  if (!fs.existsSync(outputDir)) {
    console.error('❌ Error: Output directory does not exist. Please run your pipeline first (npx tsx src/scripts/test-flow.ts).');
    process.exit(1);
  }

  // Scan output directories to find all processed summary.json files
  const books: Book[] = [];
  
  try {
    const subdirs = fs.readdirSync(outputDir).filter(f => {
      const fullPath = path.join(outputDir, f);
      return fs.statSync(fullPath).isDirectory();
    });

    for (const dir of subdirs) {
      const summaryPath = path.join(outputDir, dir, 'summary.json');
      if (fs.existsSync(summaryPath)) {
        try {
          const rawData = fs.readFileSync(summaryPath, 'utf-8');
          const summaryJson = JSON.parse(rawData);
          books.push({
            folderName: dir,
            summaryPath,
            fileName: summaryJson.fileName || dir,
            summaryJson,
            rawData
          });
        } catch (err) {
          // Skip corrupted or un-parseable JSON files
        }
      }
    }
  } catch (err) {
    console.error('❌ Error: Failed to read output directory.', err);
    process.exit(1);
  }

  if (books.length === 0) {
    console.error('❌ Error: No processed accounting summary JSON data found. Please run the pipeline first to generate your register summaries.');
    console.error('Run: npx tsx src/scripts/test-flow.ts');
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let chosenBook: Book;

  // Let the user choose if multiple books exist
  if (books.length === 1) {
    chosenBook = books[0];
  } else {
    console.clear();
    console.log('========================================================================');
    console.log('💬 HOTEL GAURAV FINANCIAL CHAT ADVISOR');
    console.log('========================================================================');
    console.log('Multiple processed ledger books detected. Please select one to load:\n');

    books.forEach((book, index) => {
      const details = book.summaryJson.isDebitorsList
        ? `(${book.summaryJson.aggregates?.activeDebitorsCount || 0} active customer dues ledger)`
        : `(${book.summaryJson.totalMonths || 0} months of sales, expenses & ratio trends)`;
      console.log(`  ${index + 1}) ${book.fileName} ${details}`);
    });
    console.log('\n------------------------------------------------------------------------');

    const askSelection = (): Promise<number> => {
      return new Promise((resolve) => {
        const ask = () => {
          rl.question(`Enter selection [1-${books.length}]: `, (ans) => {
            const num = parseInt(ans.trim(), 10);
            if (!isNaN(num) && num >= 1 && num <= books.length) {
              resolve(num - 1);
            } else {
              console.log(`❌ Invalid choice. Enter a number between 1 and ${books.length}.`);
              ask();
            }
          });
        };
        ask();
      });
    };

    const chosenIdx = await askSelection();
    chosenBook = books[chosenIdx];
  }

  const { summaryJson, rawData: rawSummaryData } = chosenBook;

  console.clear();
  console.log('========================================================================');
  console.log(`💬 HOTEL GAURAV FINANCIAL CHAT ADVISOR`);
  console.log(`Loaded Book: "${chosenBook.fileName}"`);
  if (summaryJson.isDebitorsList) {
    console.log(`Audited: ${summaryJson.aggregates?.activeDebitorsCount} Accounts | collection success: ${summaryJson.aggregates?.collectionSuccessRate}%`);
  } else {
    console.log(`Audited: ${summaryJson.totalMonths} Months | ${summaryJson.totalTransactions} Checked Entries`);
  }
  console.log('========================================================================');
  console.log(`✨ Ask me anything! E.g.:`);
  if (summaryJson.isDebitorsList) {
    console.log(` * "Who is our top outstanding debtor and how much is pending?"`);
    console.log(` * "What is our average outstanding dues and collections success rate?"`);
    console.log(` * "Suggest three ways to recover collections from customer ${summaryJson.aggregates?.topDebtorName || 'DILIP SAGADE'}."`);
  } else {
    console.log(` * "What was my highest profit month and what were its liquor sales?"`);
    console.log(` * "What is my credit collections success rate and outstanding gap?"`);
    console.log(` * "Give me a summary of how restaurant sales did in June vs August."`);
  }
  console.log('========================================================================');
  console.log('Type "exit" or "quit" to end the session.\n');

  // Initialize the swappable AI provider (Groq/Llama-3.3 by default)
  let provider;
  try {
    provider = AiProviderFactory.createProvider();
  } catch (err) {
    console.error('❌ Error: Failed to initialize AI Provider. Check API key settings in your .env file.');
    process.exit(1);
  }

  const askQuestion = () => {
    if ((rl as any).closed) return;

    rl.question('👤 Owner: ', async (input) => {
      const question = input.trim();

      if (question.toLowerCase() === 'exit' || question.toLowerCase() === 'quit') {
        console.log('\n👋 Thank you for using Hotel Gaurav Chat Advisor. Have a great business day!');
        rl.close();
        process.exit(0);
      }

      if (question.length === 0) {
        askQuestion();
        return;
      }

      console.log('\n🤖 Advisor (Analyzing...) ⏳');

      try {
        let domainContext = '';
        if (summaryJson.isDebitorsList) {
          domainContext = `
You are helping the owner understand their customer credits, outstanding dues (Udhari), credit recoveries, and collection risk profiles.
Key metrics available:
- Total outstanding credit accounts: ${summaryJson.aggregates?.activeDebitorsCount} customers on books
- Total credit extended (debit sum): ₹${Math.round(summaryJson.aggregates?.totalDebitSum).toLocaleString()}
- Total credit recovered (credit sum): ₹${Math.round(summaryJson.aggregates?.totalCreditSum).toLocaleString()}
- Net outstanding balance dues: ₹${Math.round(summaryJson.aggregates?.totalPendingSum).toLocaleString()}
- Collections success rate: ${summaryJson.aggregates?.collectionSuccessRate}%
- Top outstanding debtor: ${summaryJson.aggregates?.topDebtorName} (₹${Math.round(summaryJson.aggregates?.topDebtorValue).toLocaleString()} pending)
`;
        } else {
          domainContext = `
You are helping the owner understand their restaurant's revenues, expenses, liquor/food splits, trends, and seasonal cashflows.
Key metrics available:
- Total operational months parsed: ${summaryJson.totalMonths} months
- Total audited transactions: ${summaryJson.totalTransactions} items
- Liquor Sales: ₹${Math.round(summaryJson.masterTotals?.liquorSales).toLocaleString()} (${summaryJson.benchmarks?.liquorPercentage}% of sales)
- Food Sales: ₹${Math.round(summaryJson.masterTotals?.foodSales).toLocaleString()} (${summaryJson.benchmarks?.foodPercentage}% of sales)
- Net cashflow position: ₹${Math.round(summaryJson.masterTotals?.netCashflow).toLocaleString()} (${summaryJson.masterTotals?.surplusStatus})
- Credit outstanding gap: ₹${Math.round(summaryJson.benchmarks?.creditOutstandingGap).toLocaleString()} (Recovery rate: ${summaryJson.benchmarks?.creditRecoveryRate}%)
- Best revenue month: ${summaryJson.benchmarks?.bestRevenueMonth} (₹${Math.round(summaryJson.benchmarks?.bestRevenueValue).toLocaleString()})
`;
        }

        const prompt = `
You are a friendly, encouraging, and experienced local bar-and-restaurant financial consultant.
You are helping the owner of "Hotel Gaurav" understand their finances.
Use ONLY the following pre-calculated Master Ledger Summary data to answer their question:

=== HIGH-LEVEL CONTEXT ===
${domainContext}

=== FULL LEDGER DATA ===
${rawSummaryData}

=== OWNER'S QUESTION ===
"${question}"

=== INSTRUCTIONS ===
1. Answer the question in a warm, direct, and supportive tone.
2. Rely strictly on the numbers and percentages in the provided data.
3. Keep the answer brief, easy to read, and concise (maximum 3-4 sentences or short list).
4. Do NOT use any dry corporate jargon (no: CFO, leverage, compliance, governance, board, executive, ingestion, pipeline).
5. Address them directly as "Hotel Gaurav" or "your restaurant".
`;

        const response = await provider.generateText(prompt, {
          temperature: 0.15,
          maxTokens: 250,
        });

        console.log(`\n🤖 Advisor:\n${response.trim()}\n`);
      } catch (err) {
        console.log(`\n🤖 Advisor:\n⚠️ I had trouble connecting to my brain. Please check your internet connection or API credits and try again!\n`);
      }

      console.log('------------------------------------------------------------------------');
      askQuestion();
    });
  };

  askQuestion();
}

startInteractiveChat();
