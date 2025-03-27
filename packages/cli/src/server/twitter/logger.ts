import chalk from 'chalk';
import ora, { Ora } from 'ora';
import Table from 'cli-table3';
import { format } from 'date-fns';
import { CollectionStats, CollectionProgress, CollectionStatus } from './types';

class Logger {
  private static spinner: Ora | null = null;
  private static progressBar: any = null;
  private static lastUpdate: number = Date.now();
  private static collectionStats: CollectionStats = {
    oldestTweet: null,
    newestTweet: null,
    rateLimitHits: 0,
    resets: 0,
    batchesWithNewTweets: 0,
    totalBatches: 0,
    startTime: Date.now(),
    tweetsPerMinute: 0,
    currentDelay: 0,
    lastResetTime: null,
  };

  // Determine if debug logs should be shown based on an environment variable
  private static isDebugEnabled: boolean = true;
  // static isDebugEnabled = process.env.DEBUG === 'true';

  static startSpinner(text: string): void {
    this.spinner = ora(text).start();
  }

  static stopSpinner(success: boolean = true): void {
    if (this.spinner) {
      success ? this.spinner.succeed() : this.spinner.fail();
      this.spinner = null;
    }
  }

  static info(msg: string): void {
    console.log(chalk.blue(`ℹ️  ${msg}`));
  }

  static success(msg: string): void {
    console.log(chalk.green(`✅ ${msg}`));
  }

  static warn(msg: string): void {
    console.log(chalk.yellow(`⚠️  ${msg}`));
  }

  static error(msg: string): void {
    console.log(chalk.red(`❌ ${msg}`));
  }

  // Add the debug method
  static debug(msg: string): void {
    if (this.isDebugEnabled) {
      console.log(chalk.gray(`🔍 Debug: ${msg}`));
    }
  }

  static updateCollectionProgress(progress: CollectionProgress): void {
    const now = Date.now();

    this.collectionStats.totalBatches++;
    if (progress.newInBatch > 0) this.collectionStats.batchesWithNewTweets++;
    if (progress.isReset) this.collectionStats.resets++;
    this.collectionStats.currentDelay = progress.currentDelay || 0;

    if (progress.oldestTweetDate) {
      this.collectionStats.oldestTweet = !this.collectionStats.oldestTweet
        ? progress.oldestTweetDate
        : Math.min(this.collectionStats.oldestTweet, progress.oldestTweetDate);
    }
    if (progress.newestTweetDate) {
      this.collectionStats.newestTweet = !this.collectionStats.newestTweet
        ? progress.newestTweetDate
        : Math.max(this.collectionStats.newestTweet, progress.newestTweetDate);
    }

    const runningTime = (now - this.collectionStats.startTime) / 1000 / 60;
    this.collectionStats.tweetsPerMinute = (progress.totalCollected / runningTime).toFixed(1);

    if (now - this.lastUpdate > 1000) {
      this.displayCollectionStatus({
        totalCollected: progress.totalCollected,
        newInBatch: progress.newInBatch || 0,
        batchSize: progress.batchSize || 0,
        isReset: progress.isReset || false,
      });
      this.lastUpdate = now;
    }
  }

  static displayCollectionStatus(status: CollectionStatus): void {
    console.clear();

    console.log(chalk.bold.blue('\n🐦 Twitter Collection Status\n'));

    if (status.isReset) {
      console.log(chalk.yellow('↩️  Resetting collection position...\n'));
    }

    const table = new Table({
      head: [chalk.white('Metric'), chalk.white('Value')],
      colWidths: [25, 50],
    });

    table.push(
      ['Total Tweets Collected', chalk.green(status.totalCollected.toLocaleString())],
      ['Collection Rate', `${chalk.cyan(this.collectionStats.tweetsPerMinute)} tweets/minute`],
      ['Current Delay', `${chalk.yellow(this.collectionStats.currentDelay)}ms`],
      [
        'Batch Efficiency',
        `${chalk.cyan(((this.collectionStats.batchesWithNewTweets / this.collectionStats.totalBatches) * 100).toFixed(1))}%`,
      ],
      ['Position Resets', chalk.yellow(this.collectionStats.resets)],
      ['Rate Limit Hits', chalk.red(this.collectionStats.rateLimitHits)]
    );

    if (this.collectionStats.oldestTweet) {
      const dateRange = `${format(this.collectionStats.oldestTweet, 'yyyy-MM-dd')} to ${format(
        this.collectionStats.newestTweet!,
        'yyyy-MM-dd'
      )}`;
      table.push(['Date Range', chalk.cyan(dateRange)]);
    }

    table.push([
      'Latest Batch',
      `${chalk.green(status.newInBatch)} new / ${chalk.blue(status.batchSize)} total`,
    ]);

    console.log(table.toString());

    const runningTime = Math.floor((Date.now() - this.collectionStats.startTime) / 1000);
    console.log(chalk.dim(`\nRunning for ${Math.floor(runningTime / 60)}m ${runningTime % 60}s`));
  }

  static recordRateLimit(): void {
    this.collectionStats.rateLimitHits++;
    this.collectionStats.lastResetTime = Date.now();
  }

  static stats(title: string, data: Record<string, any>): void {
    console.log(chalk.cyan(`\n📊 ${title}:`));
    const table = new Table({
      head: [chalk.white('Parameter'), chalk.white('Value')],
      colWidths: [25, 60],
    });
    Object.entries(data).forEach(([key, value]) => {
      table.push([chalk.white(key), value]);
    });
    console.log(table.toString());
  }

  static reset(): void {
    this.collectionStats = {
      oldestTweet: null,
      newestTweet: null,
      rateLimitHits: 0,
      resets: 0,
      batchesWithNewTweets: 0,
      totalBatches: 0,
      startTime: Date.now(),
      tweetsPerMinute: 0,
      currentDelay: 0,
      lastResetTime: null,
    };
    this.lastUpdate = Date.now();
  }
}

export default Logger;
