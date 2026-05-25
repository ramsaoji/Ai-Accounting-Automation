import cron from 'node-cron';
import { orchestratorService } from '../services/orchestrator.service.js';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';

export class SchedulerJob {
  private isRunning = false;
  private cronTask: cron.ScheduledTask | null = null;

  /**
   * Initializes and starts the background chron job.
   */
  start(): void {
    const schedule = config.CRON_SCHEDULE;
    logger.info({ schedule }, 'Scheduling background accounting automation worker');

    if (!cron.validate(schedule)) {
      logger.error({ schedule }, '❌ Invalid cron schedule syntax. Background worker cannot be started.');
      throw new Error(`Invalid cron format: ${schedule}`);
    }

    this.cronTask = cron.schedule(schedule, async () => {
      // Concurrency guard to prevent overlapping execution runs
      if (this.isRunning) {
        logger.warn('⏳ Previous pipeline run is still active. Skipping current execution cycle to avoid overlap.');
        return;
      }

      this.isRunning = true;
      logger.info('Scheduler triggered: Starting cron job run...');

      try {
        await orchestratorService.runPipeline();
        logger.info('Scheduler: Cron job run finished successfully.');
      } catch (error) {
        logger.error({ error }, '⏰ Scheduler: Cron job execution failed.');
      } finally {
        this.isRunning = false;
      }
    });

    logger.info('Background scheduler active and running.');
  }

  /**
   * Stops the background cron job (useful for graceful service shutdowns).
   */
  stop(): void {
    if (this.cronTask) {
      this.cronTask.stop();
      logger.info('Background scheduler has been stopped.');
    }
  }
}

export const schedulerJob = new SchedulerJob();
