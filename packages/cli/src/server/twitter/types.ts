import { Profile } from 'agent-twitter-client';

export interface Tweet {
  id: string;
  text: string;
  username: string;
  timestamp: number;
  timeParsed?: Date;
  createdAt: string;
  isReply: boolean;
  isRetweet: boolean;
  quotedTweet?: boolean;
  likes: number;
  retweets: number;
  retweetCount: number;
  replies: number;
  photos: string[];
  videos: string[];
  urls: string[];
  permanentUrl: string;
  quotedStatusId?: string;
  inReplyToStatusId?: string;
  hashtags: string[];
  mentions?: Array<{
    username: string;
    name?: string;
  }>;
  thread?: boolean;
}

export interface FilterOptions {
  tweetTypes: string[];
  contentTypes: string[];
  filterByEngagement: boolean;
  filterByDate: boolean;
  excludeKeywords: boolean;
  minLikes?: number;
  minRetweets?: number;
  startDate?: string;
  endDate?: string;
  keywordsToExclude?: string[];
}

export interface TwitterConfig {
  twitter: {
    maxTweets: number;
    maxRetries: number;
    retryDelay: number;
    minDelayBetweenRequests: number;
    maxDelayBetweenRequests: number;
    rateLimitThreshold: number;
  };
  fallback: {
    enabled: boolean;
    sessionDuration: number;
    viewport: {
      width: number;
      height: number;
      deviceScaleFactor: number;
      hasTouch: boolean;
      isLandscape: boolean;
    };
  };
}

export interface PipelineStats {
  requestCount: number;
  rateLimitHits: number;
  retriesCount: number;
  uniqueTweets: number;
  fallbackCount: number;
  startTime: number;
  oldestTweetDate: Date | null;
  newestTweetDate: Date | null;
  fallbackUsed: boolean;
}

export interface CollectionResult {
  profile: Profile;
  tweets: Tweet[];
}

export interface CharacterResponse {
  name: string;
  bio: string[];
  style: {
    all: string[];
    chat: string[];
    post: string[];
  };
  lore: string[];
  messageExamples: Array<
    [
      {
        user: string;
        content: {
          text: string;
        };
      },
      {
        user: string;
        content: {
          text: string;
        };
      },
    ]
  >;
  postExamples: string[];
  topics: string[];
  adjectives: string[];
  system: string;
}

export interface ColorMap {
  [key: string]: (text: string) => string;
}

export interface Analytics {
  totalTweets: number;
  directTweets: number;
  replies: number;
  retweets: number;
  engagement: {
    totalLikes: number;
    totalRetweetCount: number;
    totalReplies: number;
    averageLikes: string;
    topTweets: Array<{
      id: string;
      text: string;
      likes: number;
      retweetCount: number;
      url: string;
    }>;
  };
  timeRange: {
    start: string;
    end: string;
  };
  contentTypes: {
    withImages: number;
    withVideos: number;
    withLinks: number;
    textOnly: number;
  };
}

export interface CollectionStats {
  oldestTweet: number | null;
  newestTweet: number | null;
  rateLimitHits: number;
  resets: number;
  batchesWithNewTweets: number;
  totalBatches: number;
  startTime: number;
  tweetsPerMinute: string | number;
  currentDelay: number;
  lastResetTime: number | null;
}

export interface CollectionProgress {
  totalCollected: number;
  newInBatch?: number;
  batchSize?: number;
  oldestTweetDate?: number | null;
  newestTweetDate?: number | null;
  currentDelay?: number;
  isReset?: boolean;
}

export interface CollectionStatus {
  totalCollected: number;
  newInBatch: number;
  batchSize: number;
  isReset: boolean;
}
