import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { AiProviderFactory } from '../ai/ai.factory.js';
import { logger } from '../logger/logger.js';

async function startInteractiveChat() {
  const outputDir = path.resolve(process.cwd(), 'data', 'output');
  
  if (!fs.existsSync(outputDir)) {
    console.error('❌ Error: Output directory does not exist. Please run your pipeline first (npm run build && npm run test).');
    process.exit(1);
  }

  // Scan output files to find the latest summary JSON file
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('_summary.json'));
  
  if (files.length === 0) {
    console.error('❌ Error: No processed accounting summary JSON data found. Please run the pipeline first to generate your register summary.');
    process.exit(1);
  }

  // Use the most recently modified summary file
  const latestFile = files
    .map(f => ({ name: f, time: fs.statSync(path.join(outputDir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time)[0].name;

  const summaryPath = path.join(outputDir, latestFile);
  const rawSummaryData = fs.readFileSync(summaryPath, 'utf-8');
  const summaryJson = JSON.parse(rawSummaryData);

  console.clear();
  console.log('========================================================================');
  console.log(`💬 HOTEL GAURAV FINANCIAL CHAT ADVISOR`);
  console.log(`Loaded Book: "${summaryJson.fileName}" (${summaryJson.totalMonths} Months Audited)`);
  console.log('========================================================================');
  console.log(`✨ Ask me anything! E.g.:`);
  console.log(` * "What was my highest profit month and what were its liquor sales?"`);
  console.log(` * "What is my credit collections success rate and unrecovered balance?"`);
  console.log(` * "Compare my sales in June 2024 vs June 2025."`);
  console.log(` * "Is there any warning or late-night logging anomaly I should know?"`);
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

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

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
        const prompt = `
You are a friendly, encouraging, and experienced local bar-and-restaurant financial consultant.
You are helping the owner of "Hotel Gaurav" understand their finances.
Use ONLY the following pre-calculated Master Ledger Summary data to answer their question:

=== HOTEL GAURAV LEDGER SUMMARY DATA ===
${rawSummaryData}

=== OWNER'S QUESTION ===
"${question}"

=== INSTRUCTIONS ===
1. Answer the question in a warm, direct, and supportive tone.
2. Rely strictly on the numbers and percentages in the provided data.
3. Keep the answer brief and easy to read (maximum 2-3 sentences).
4. Do NOT use any dry corporate jargon (no: CFO, leverage, compliance, governance, board, executive, ingestion, pipeline).
5. Address them directly as "Hotel Gaurav" or "your restaurant".
`;

        const response = await provider.generateText(prompt, {
          temperature: 0.15,
          maxTokens: 150,
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
