import axios from 'axios';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';

async function checkModels() {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('your_gemini')) {
    logger.error('No valid GEMINI_API_KEY found in .env');
    return;
  }

  logger.info('Querying Gemini API to list available models...');
  try {
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    const models = response.data?.models || [];
    logger.info(`Gemini API returned ${models.length} available models:`);
    
    for (const m of models) {
      console.log(`- ID: ${m.name} (DisplayName: ${m.displayName})`);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        {
          status: error.response?.status,
          data: JSON.stringify(error.response?.data),
        },
        'Gemini models query failed'
      );
    } else {
      logger.error({ error }, 'Failed to query models');
    }
  }
}

checkModels();
