import dotenv from 'dotenv';
dotenv.config();

import TwitterPipeline from './pipeline.js';
import Logger from './logger.js';

// Error handling for unhandled rejections
process.on('unhandledRejection', (error: Error | any) => {
  Logger.error(`❌ Unhandled promise rejection: ${error?.message || 'Unknown error'}`);
  process.exit(1);
});

// Error handling for uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  Logger.error(`❌ Uncaught exception: ${error.message}`);
  process.exit(1);
});

// Parse command line arguments
const args: string[] = process.argv.slice(2);
const username: string = args[0] || 'degenspartan';

// Initialize pipeline
const pipeline = new TwitterPipeline(username);

/**
 * Cleanup function to handle graceful shutdown
 */
const cleanup = async (): Promise<void> => {
  Logger.warn('\n🛑 Received termination signal. Cleaning up...');
  try {
    if (pipeline.scraper) {
      await pipeline.scraper.logout();
      Logger.success('🔒 Logged out successfully.');
    }
  } catch (error) {
    if (error instanceof Error) {
      Logger.error(`❌ Error during cleanup: ${error.message}`);
    } else {
      Logger.error('❌ Unknown error during cleanup');
    }
  }
  process.exit(0);
};

// Register cleanup handlers
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start pipeline
pipeline.run().catch(() => process.exit(1));
