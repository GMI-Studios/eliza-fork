import {
  ChannelType,
  type Content,
  type IAgentRuntime,
  type Memory,
  type State,
  type UUID,
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { Client, type QueryTweetsResponse, SearchMode, type Tweet } from './client/index';
import { TwitterInteractionPayload } from './types';

interface TwitterUser {
  id_str: string;
  screen_name: string;
  name: string;
}

interface TwitterFollowersResponse {
  users: TwitterUser[];
}

/**
 * Extracts the answer from the given text.
 *
 * @param {string} text - The text containing the answer
 * @returns {string} The extracted answer
 */
export function extractAnswer(text: string): string {
  const startIndex = text.indexOf('Answer: ') + 8;
  const endIndex = text.indexOf('<|endoftext|>', 11);
  return text.slice(startIndex, endIndex);
}

/**
 * Represents a Twitter Profile.
 * @typedef {Object} TwitterProfile
 * @property {string} id - The unique identifier of the profile.
 * @property {string} username - The username of the profile.
 * @property {string} screenName - The screen name of the profile.
 * @property {string} bio - The biography of the profile.
 * @property {string[]} nicknames - An array of nicknames associated with the profile.
 */
type TwitterProfile = {
  id: string;
  username: string;
  screenName: string;
  bio: string;
  nicknames: string[];
};

/**
 * Class representing a request queue for handling asynchronous requests in a controlled manner.
 */

class RequestQueue {
  private queue: (() => Promise<any>)[] = [];
  private processing = false;

  /**
   * Asynchronously adds a request to the queue, then processes the queue.
   *
   * @template T
   * @param {() => Promise<T>} request - The request to be added to the queue
   * @returns {Promise<T>} - A promise that resolves with the result of the request or rejects with an error
   */
  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  /**
   * Asynchronously processes the queue of requests.
   *
   * @returns A promise that resolves when the queue has been fully processed.
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      try {
        await request();
      } catch (error) {
        console.error('Error processing request:', error);
        this.queue.unshift(request);
        await this.exponentialBackoff(this.queue.length);
      }
      await this.randomDelay();
    }

    this.processing = false;
  }

  /**
   * Implements an exponential backoff strategy for retrying a task.
   * @param {number} retryCount - The number of retries attempted so far.
   * @returns {Promise<void>} - A promise that resolves after a delay based on the retry count.
   */
  private async exponentialBackoff(retryCount: number): Promise<void> {
    const delay = 2 ** retryCount * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Asynchronous method that creates a random delay between 1500ms and 3500ms.
   *
   * @returns A Promise that resolves after the random delay has passed.
   */
  private async randomDelay(): Promise<void> {
    const delay = Math.floor(Math.random() * 2000) + 1500;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

/**
 * Class representing a base client for interacting with Twitter.
 * @extends EventEmitter
 */
export class ClientBase {
  static _twitterClients: { [accountIdentifier: string]: Client } = {};
  twitterClient: Client;
  runtime: IAgentRuntime;
  lastCheckedTweetId: bigint | null = null;
  temperature = 0.5;

  requestQueue: RequestQueue = new RequestQueue();

  profile: TwitterProfile | null;

  /**
   * Caches a tweet in the database.
   *
   * @param {Tweet} tweet - The tweet to cache.
   * @returns {Promise<void>} A promise that resolves once the tweet is cached.
   */
  async cacheTweet(tweet: Tweet): Promise<void> {
    if (!tweet) {
      console.warn('Tweet is undefined, skipping cache');
      return;
    }

    this.runtime.setCache<Tweet>(`twitter/tweets/${tweet.id}`, tweet);
  }

  /**
   * Retrieves a cached tweet by its ID.
   * @param {string} tweetId - The ID of the tweet to retrieve from the cache.
   * @returns {Promise<Tweet | undefined>} A Promise that resolves to the cached tweet, or undefined if the tweet is not found in the cache.
   */
  async getCachedTweet(tweetId: string): Promise<Tweet | undefined> {
    const cached = await this.runtime.getCache<Tweet>(`twitter/tweets/${tweetId}`);

    if (!cached) {
      return undefined;
    }

    return cached;
  }

  /**
   * Asynchronously retrieves a tweet with the specified ID.
   * If the tweet is found in the cache, it is returned from the cache.
   * If not, a request is made to the Twitter API to get the tweet, which is then cached and returned.
   * @param {string} tweetId - The ID of the tweet to retrieve.
   * @returns {Promise<Tweet>} A Promise that resolves to the retrieved tweet.
   */
  async getTweet(tweetId: string): Promise<Tweet> {
    const cachedTweet = await this.getCachedTweet(tweetId);

    if (cachedTweet) {
      return cachedTweet;
    }

    const tweet = await this.requestQueue.add(() =>
      this.makeAuthenticatedRequest(() => this.twitterClient.getTweet(tweetId))
    );

    await this.cacheTweet(tweet);
    return tweet;
  }

  callback: (self: ClientBase) => any = null;

  /**
   * This method is called when the application is ready.
   * It throws an error indicating that it is not implemented in the base class
   * and should be implemented in the subclass.
   */
  onReady() {
    throw new Error('Not implemented in base class, please call from subclass');
  }

  /**
   * Parse the raw tweet data into a standardized Tweet object.
   */
  /**
   * Parses a raw tweet object into a structured Tweet object.
   *
   * @param {any} raw - The raw tweet object to parse.
   * @param {number} [depth=0] - The current depth of parsing nested quotes/retweets.
   * @param {number} [maxDepth=3] - The maximum depth allowed for parsing nested quotes/retweets.
   * @returns {Tweet} The parsed Tweet object.
   */

  state: any;

  constructor(runtime: IAgentRuntime, state: any) {
    this.runtime = runtime;
    this.state = state;
    // Use API key as the identifier for client reuse
    logger.info('constructing base', state);
    const token = state?.REFRESH_TOKEN;
    if (token && ClientBase._twitterClients[token]) {
      this.twitterClient = ClientBase._twitterClients[token];
    } else {
      this.twitterClient = new Client();
      if (token) {
        ClientBase._twitterClients[token] = this.twitterClient;
      }
    }
  }

  /**
   * Example method showing how to use token refresh for Twitter API calls
   * @param operation The Twitter API operation to perform
   * @returns The result of the operation
   */
  /**
   * Performs an authenticated request with automatic token refresh on auth errors
   * @param operation The Twitter API operation to perform
   * @returns The result of the operation
   */
  async makeAuthenticatedRequest<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Error) {
        // Check if it's an authentication error
        if (this.isAuthenticationError(error)) {
          logger.warn('Authentication error detected in API call, attempting token refresh...');

          try {
            const refreshedTokens = await this.refreshTokensOnLoginError();
            if (refreshedTokens) {
              // Update local state with new tokens
              this.state.BEARER_TOKEN = refreshedTokens.bearerToken;
              this.state.REFRESH_TOKEN = refreshedTokens.refreshToken;

              // Re-initialize the Twitter client with new tokens if needed
              if (this.twitterClient) {
                try {
                  await this.twitterClient.login(
                    refreshedTokens.bearerToken,
                    refreshedTokens.refreshToken
                  );
                  logger.info('Twitter client re-authenticated with refreshed tokens');
                } catch (loginError) {
                  logger.warn(
                    'Failed to re-authenticate Twitter client with refreshed tokens:',
                    loginError
                  );
                  // Continue anyway, the operation might still work
                }
              }

              // Retry the original operation with refreshed authentication
              logger.info('Retrying operation after successful token refresh...');
              return await operation();
            } else {
              throw new Error(
                `Authentication failed and token refresh unsuccessful: ${error.message}`
              );
            }
          } catch (refreshError) {
            logger.error('Token refresh failed during API call:', refreshError);
            throw new Error(
              `Authentication failed and token refresh unsuccessful: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`
            );
          }
        }
      }
      throw error;
    }
  }

  async init() {
    // First ensure the agent exists in the database
    // await this.runtime.ensureAgentExists(this.runtime.character);
    let bearerToken = this.state?.BEARER_TOKEN;
    let refreshToken = this.state?.REFRESH_TOKEN;
    logger.info('BEARER_TOKEN', bearerToken);
    if (!bearerToken || !refreshToken) {
      throw new Error('BEARER_TOKEN and REFRESH_TOKEN are required');
    }

    const maxRetries = process.env.MAX_RETRIES ? parseInt(process.env.MAX_RETRIES) : 3;
    let retryCount = 0;
    let lastError: Error | null = null;
    let tokenRefreshAttempted = false;

    while (retryCount < maxRetries) {
      try {
        logger.log('Initializing Twitter API v2 client');
        await this.twitterClient.login(bearerToken, refreshToken);

        if (await this.twitterClient.isLoggedIn()) {
          logger.info('Successfully authenticated with Twitter API v2');
          break;
        } else {
          throw new Error('Failed to authenticate with Twitter API v2');
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.error(`Authentication attempt ${retryCount + 1} failed: ${lastError.message}`);

        // Check if this is an authentication error and we haven't tried token refresh yet
        const isAuthError = this.isAuthenticationError(lastError);

        if (isAuthError && !tokenRefreshAttempted) {
          logger.info('Attempting token refresh due to authentication error...');
          try {
            const refreshedTokens = await this.refreshTokensOnLoginError();
            if (refreshedTokens) {
              // Update tokens for next login attempt
              bearerToken = refreshedTokens.bearerToken;
              refreshToken = refreshedTokens.refreshToken;

              // Update state with new tokens
              this.state.BEARER_TOKEN = bearerToken;
              this.state.REFRESH_TOKEN = refreshToken;

              tokenRefreshAttempted = true;
              logger.info('Token refresh successful, retrying login...');
              continue; // Retry immediately with new tokens
            }
          } catch (refreshError) {
            logger.error('Token refresh failed:', refreshError);
            // Continue with normal retry logic
          }
        }

        retryCount++;

        if (retryCount < maxRetries) {
          const delay = 2 ** retryCount * 1000; // Exponential backoff
          logger.info(`Retrying in ${delay / 1000} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    if (retryCount >= maxRetries) {
      throw new Error(
        `Twitter authentication failed after ${maxRetries} attempts. Last error: ${lastError?.message}`
      );
    }

    // Initialize Twitter profile from the authenticated user
    const profile = await this.twitterClient.me();
    if (profile) {
      logger.log('Twitter user ID:', profile.userId);
      logger.log('Twitter loaded:', JSON.stringify(profile, null, 10));

      const agentId = this.runtime.agentId;

      const entity = await this.runtime.getEntityById(agentId);
      const entityMetadata = entity?.metadata as any;
      if (entityMetadata?.twitter?.userName !== profile.username) {
        logger.log(
          'Updating Agents known X/twitter handle',
          profile.username,
          'was',
          entityMetadata?.twitter
        );
        const names = [profile.name, profile.username];
        await this.runtime.updateEntity({
          id: agentId,
          names: [...new Set([...(entity.names || []), ...names])].filter(Boolean),
          metadata: {
            ...(entityMetadata || {}),
            twitter: {
              ...(entityMetadata?.twitter || {}),
              name: profile.name,
              userName: profile.username,
            },
          },
          agentId,
        });
      }

      // Store profile info for use in responses
      this.profile = {
        id: profile.userId,
        username: profile.username, // this is the at
        screenName: profile.name, // this is the human readable name
        bio: profile.biography || '',
        nicknames: [],
      };
    } else {
      throw new Error('Failed to load profile');
    }

    // await this.loadLatestCheckedTweetId();
    // await this.populateTimeline();
  }

  async fetchOwnPosts(count: number): Promise<Tweet[]> {
    logger.debug('fetching own posts');
    const homeTimeline = await this.twitterClient.getUserTweets(this.profile.id, count);
    // homeTimeline.tweets already contains Tweet objects from v2 API, no parsing needed
    return homeTimeline.tweets;
  }

  /**
   * Fetch timeline for twitter account, optionally only from followed accounts
   */
  async fetchHomeTimeline(count: number, following?: boolean): Promise<Tweet[]> {
    logger.debug('fetching home timeline');
    const homeTimeline = following
      ? await this.twitterClient.fetchFollowingTimeline(count, [])
      : await this.twitterClient.fetchHomeTimeline(count, []);

    // homeTimeline already contains Tweet objects from v2 API, no parsing needed
    return homeTimeline;
  }

  async fetchSearchTweets(
    query: string,
    maxTweets: number,
    searchMode: SearchMode,
    cursor?: string
  ): Promise<QueryTweetsResponse> {
    try {
      // Sometimes this fails because we are rate limited. in this case, we just need to return an empty array
      // if we dont get a response in 5 seconds, something is wrong
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve({ tweets: [] }), 15000)
      );

      try {
        const result = await this.requestQueue.add(
          async () =>
            await Promise.race([
              this.twitterClient.fetchSearchTweets(query, maxTweets, searchMode, cursor),
              timeoutPromise,
            ])
        );
        return (result ?? { tweets: [] }) as QueryTweetsResponse;
      } catch (error) {
        logger.error('Error fetching search tweets:', error);
        return { tweets: [] };
      }
    } catch (error) {
      logger.error('Error fetching search tweets:', error);
      return { tweets: [] };
    }
  }

  /**
   * Check if an error is authentication-related
   * @param error The error to check
   * @returns True if the error appears to be authentication-related
   */
  private isAuthenticationError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return (
      errorMessage.includes('401') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('authenticate') ||
      errorMessage.includes('invalid token') ||
      errorMessage.includes('expired token') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('access denied')
    );
  }

  /**
   * Validates and fixes timestamp to prevent database insertion errors
   * @param timestamp The timestamp to validate (in seconds or milliseconds)
   * @returns A valid timestamp in milliseconds
   */
  public validateAndFixTimestamp(timestamp: number): number {
    // If timestamp is 0 or invalid, use current time
    if (!timestamp || timestamp <= 0) {
      logger.warn('Invalid timestamp provided, using current time');
      return Date.now();
    }

    // If timestamp appears to be in seconds (less than year 2100), convert to milliseconds
    if (timestamp < 4000000000) {
      return timestamp * 1000;
    }

    // If timestamp is already in milliseconds but invalid (too far in future), use current time
    const now = Date.now();
    const maxFutureTime = now + 365 * 24 * 60 * 60 * 1000; // 1 year in future
    const minPastTime = new Date('2006-01-01').getTime(); // Twitter launch date

    if (timestamp > maxFutureTime || timestamp < minPastTime) {
      logger.warn(
        `Invalid timestamp ${timestamp} (${new Date(timestamp).toISOString()}), using current time`
      );
      return now;
    }

    return timestamp;
  }

  /**
   * Refresh tokens when login error occurs
   * @returns New tokens if successful, null if failed
   */
  private async refreshTokensOnLoginError(): Promise<{
    bearerToken: string;
    refreshToken: string;
  } | null> {
    try {
      logger.info('Attempting OAuth 2.0 token refresh due to login error...');

      // Get OAuth 2.0 credentials for refresh
      const refreshToken = this.state.REFRESH_TOKEN;
      const clientId =
        this.runtime.getSetting('TWITTER_CLIENT_ID') || this.runtime.getSetting('CLIENT_ID');
      const clientSecret =
        this.runtime.getSetting('TWITTER_CLIENT_SECRET') ||
        this.runtime.getSetting('CLIENT_SECRET');

      if (!refreshToken || !clientId || !clientSecret) {
        logger.error(
          'Missing required OAuth 2.0 credentials for token refresh (REFRESH_TOKEN, CLIENT_ID, CLIENT_SECRET)'
        );
        return null;
      }

      // Perform OAuth 2.0 token refresh
      const newTokens = await this.performTokenRefresh(refreshToken, clientId, clientSecret);

      if (!newTokens) {
        logger.error('Token refresh returned null');
        return null;
      }

      logger.info('newTokens', newTokens);
      // Update agent secrets with new tokens
      await this.updateAgentSecrets({
        BEARER_TOKEN: newTokens.accessToken,
        REFRESH_TOKEN: newTokens.refreshToken || refreshToken,
      });

      logger.info('Successfully refreshed tokens during login');
      return {
        bearerToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken || refreshToken,
      };
    } catch (error) {
      logger.error('Failed to refresh tokens during login:', error);
      return null;
    }
  }

  /**
   * Perform actual OAuth 2.0 token refresh with Twitter API
   * @param refreshToken Current refresh token
   * @param clientId OAuth 2.0 client ID
   * @param clientSecret OAuth 2.0 client secret
   * @returns New token set
   */
  private async performTokenRefresh(
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  } | null> {
    logger.info('Performing OAuth 2.0 token refresh with Twitter API...');

    try {
      // Twitter OAuth 2.0 token refresh endpoint
      const tokenEndpoint = 'https://api.twitter.com/2/oauth2/token';

      // Prepare the request body for OAuth 2.0 refresh
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      });

      // Create Basic Auth header for client credentials
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Token refresh HTTP error: ${response.status} - ${errorText}`);
        return null;
      }

      const tokenData = await response.json();

      // Twitter OAuth 2.0 response typically includes:
      // - access_token: The new access token
      // - refresh_token: New refresh token (optional)
      // - expires_in: Token expiration time in seconds
      // - token_type: Should be "bearer"

      if (!tokenData.access_token) {
        logger.error('Token refresh response missing access_token');
        return null;
      }

      logger.info('OAuth 2.0 token refresh successful');
      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
      };
    } catch (error) {
      logger.error('OAuth 2.0 token refresh failed:', error);
      return null;
    }
  }

  /**
   * Update agent secrets with new token values
   * @param secrets Object containing secret key-value pairs to update
   */
  private async updateAgentSecrets(secrets: Record<string, string>): Promise<void> {
    logger.info('Updating agent secrets with refreshed tokens');

    // Update each secret individually using the secret flag
    for (const [key, value] of Object.entries(secrets)) {
      this.runtime.setSetting(key, value, true); // true = store as secret
      logger.debug(`Updated secret: ${key}`);
    }

    // Immediately persist the character changes to database
    await this.saveCharacterSettings();

    logger.info(`Successfully updated and persisted ${Object.keys(secrets).length} agent secrets`);
  }

  /**
   * Save character settings immediately to the database
   * This persists any changes made via setSetting to the database
   */
  private async saveCharacterSettings(): Promise<void> {
    try {
      logger.debug('Persisting character settings to database...');

      // Get the current character data
      const character = this.runtime.character;

      // Create agent update data with timestamps
      const agentUpdate = {
        ...character,
        updatedAt: Date.now(),
      };

      // Persist to database using the runtime's updateAgent method
      const success = await this.runtime.updateAgent(this.runtime.agentId, agentUpdate);

      if (success) {
        logger.debug('Character settings successfully persisted to database');
      } else {
        logger.warn('Failed to persist character settings to database');
      }
    } catch (error) {
      logger.error('Error persisting character settings to database:', error);
      // Don't throw here - token refresh should continue even if persistence fails
    }
  }

  /**
   * Set a setting and immediately save it to the database
   * @param key Setting key
   * @param value Setting value
   * @param secret Whether this is a secret setting
   * @returns Promise that resolves when setting is saved
   */
  async setAndSaveSetting(
    key: string,
    value: string | boolean | null | any,
    secret = false
  ): Promise<void> {
    // Update the setting in memory
    this.runtime.setSetting(key, value, secret);

    // Immediately persist to database
    await this.saveCharacterSettings();

    logger.debug(`Setting '${key}' updated and persisted to database`);
  }

  private async populateTimeline() {
    logger.info('populating timeline...');

    const cachedTimeline = await this.getCachedTimeline();

    // Check if the cache file exists
    if (cachedTimeline) {
      // Read the cached search results from the file

      // Get the existing memories from the database
      const existingMemories = await this.runtime.getMemoriesByRoomIds({
        tableName: 'messages',
        roomIds: cachedTimeline.map((tweet) =>
          createUniqueUuid(this.runtime, tweet.conversationId)
        ),
      });

      //TODO: load tweets not in cache?

      // Create a Set to store the IDs of existing memories
      const existingMemoryIds = new Set(existingMemories.map((memory) => memory.id.toString()));

      // Check if any of the cached tweets exist in the existing memories
      const someCachedTweetsExist = cachedTimeline.some((tweet) =>
        existingMemoryIds.has(createUniqueUuid(this.runtime, tweet.id))
      );

      if (someCachedTweetsExist) {
        // Filter out the cached tweets that already exist in the database
        const tweetsToSave = cachedTimeline.filter(
          (tweet) =>
            tweet.userId !== this.profile.id &&
            !existingMemoryIds.has(createUniqueUuid(this.runtime, tweet.id))
        );

        // Save the missing tweets as memories
        for (const tweet of tweetsToSave) {
          logger.log('Saving Tweet', tweet.id);

          if (tweet.userId === this.profile.id) {
            continue;
          }

          // Create a world for this Twitter user if it doesn't exist
          const worldId = createUniqueUuid(this.runtime, tweet.userId) as UUID;
          await this.runtime.ensureWorldExists({
            id: worldId,
            name: `${tweet.username}'s Twitter`,
            agentId: this.runtime.agentId,
            serverId: tweet.userId,
            metadata: {
              ownership: { ownerId: tweet.userId },
              twitter: {
                username: tweet.username,
                id: tweet.userId,
              },
            },
          });

          const roomId = createUniqueUuid(this.runtime, tweet.conversationId);
          const entityId =
            tweet.userId === this.profile.id
              ? this.runtime.agentId
              : createUniqueUuid(this.runtime, tweet.userId);

          // Ensure the entity exists with proper world association
          await this.runtime.ensureConnection({
            entityId,
            roomId,
            userName: tweet.username,
            name: tweet.name,
            source: 'twitter',
            type: ChannelType.FEED,
            worldId: worldId,
          });

          // Fix timestamp validation - ensure it's in milliseconds and valid
          const validTimestamp = this.validateAndFixTimestamp(tweet.timestamp);

          const content = {
            text: tweet.text,
            url: tweet.permanentUrl,
            source: 'twitter',
            inReplyTo: tweet.inReplyToStatusId
              ? createUniqueUuid(this.runtime, tweet.inReplyToStatusId)
              : undefined,
          } as Content;

          logger.info(
            'Creating memory for tweet',
            tweet.id,
            'original timestamp:',
            tweet.timestamp,
            'validated timestamp:',
            validTimestamp,
            'content:',
            JSON.stringify(content)
          );

          await this.runtime.createMemory(
            {
              id: createUniqueUuid(this.runtime, tweet.id),
              entityId,
              content: content,
              agentId: this.runtime.agentId,
              roomId,
              createdAt: validTimestamp,
            },
            'messages'
          );

          await this.cacheTweet(tweet);
        }

        logger.log(`Populated ${tweetsToSave.length} missing tweets from the cache.`);
        return;
      }
    }

    const timeline = await this.fetchHomeTimeline(cachedTimeline ? 10 : 50);

    // Get the most recent 20 mentions and interactions
    const mentionsAndInteractions = await this.fetchSearchTweets(
      `@${this.profile.username}`,
      20,
      SearchMode.Latest
    );

    // Combine the timeline tweets and mentions/interactions
    const allTweets = [...timeline, ...mentionsAndInteractions.tweets];

    // Create a Set to store unique tweet IDs
    const tweetIdsToCheck = new Set<string>();
    const roomIds = new Set<UUID>();

    // Add tweet IDs to the Set
    for (const tweet of allTweets) {
      tweetIdsToCheck.add(tweet.id);
      roomIds.add(createUniqueUuid(this.runtime, tweet.conversationId));
    }

    // Check the existing memories in the database
    const existingMemories = await this.runtime.getMemoriesByRoomIds({
      tableName: 'messages',
      roomIds: Array.from(roomIds),
    });

    // Create a Set to store the existing memory IDs
    const existingMemoryIds = new Set<UUID>(existingMemories.map((memory) => memory.id));

    // Filter out the tweets that already exist in the database
    const tweetsToSave = allTweets.filter(
      (tweet) =>
        tweet.userId !== this.profile.id &&
        !existingMemoryIds.has(createUniqueUuid(this.runtime, tweet.id))
    );

    logger.debug({
      processingTweets: tweetsToSave.map((tweet) => tweet.id).join(','),
    });

    // Save the new tweets as memories
    for (const tweet of tweetsToSave) {
      logger.log('Saving Tweet', tweet.id);

      if (tweet.userId === this.profile.id) {
        continue;
      }

      // Create a world for this Twitter user if it doesn't exist
      const worldId = createUniqueUuid(this.runtime, tweet.userId) as UUID;
      await this.runtime.ensureWorldExists({
        id: worldId,
        name: `${tweet.username}'s Twitter`,
        agentId: this.runtime.agentId,
        serverId: tweet.userId,
        metadata: {
          ownership: { ownerId: tweet.userId },
          twitter: {
            username: tweet.username,
            id: tweet.userId,
          },
        },
      });

      const roomId = createUniqueUuid(this.runtime, tweet.conversationId);

      const entityId =
        tweet.userId === this.profile.id
          ? this.runtime.agentId
          : createUniqueUuid(this.runtime, tweet.userId);

      // Ensure the entity exists with proper world association
      await this.runtime.ensureConnection({
        entityId,
        roomId,
        userName: tweet.username,
        name: tweet.name,
        source: 'twitter',
        type: ChannelType.FEED,
        worldId: worldId,
      });

      // Fix timestamp validation - ensure it's in milliseconds and valid
      const validTimestamp = this.validateAndFixTimestamp(tweet.timestamp);

      const content = {
        text: tweet.text,
        url: tweet.permanentUrl,
        source: 'twitter',
        inReplyTo: tweet.inReplyToStatusId
          ? createUniqueUuid(this.runtime, tweet.inReplyToStatusId)
          : undefined,
      } as Content;

      logger.debug(
        'Creating memory for timeline tweet',
        tweet.id,
        'validated timestamp:',
        validTimestamp
      );

      await this.runtime.createMemory(
        {
          id: createUniqueUuid(this.runtime, tweet.id),
          entityId,
          content: content,
          agentId: this.runtime.agentId,
          roomId,
          createdAt: validTimestamp,
        },
        'messages'
      );

      await this.cacheTweet(tweet);
    }

    // Cache
    await this.cacheTimeline(timeline);
    await this.cacheMentions(mentionsAndInteractions.tweets);
  }

  async saveRequestMessage(message: Memory, state: State) {
    if (message.content.text) {
      const recentMessage = await this.runtime.getMemories({
        tableName: 'messages',
        roomId: message.roomId,
        count: 1,
        unique: false,
      });

      if (recentMessage.length > 0 && recentMessage[0].content === message.content) {
        logger.debug('Message already saved', recentMessage[0].id);
      } else {
        await this.runtime.createMemory(message, 'messages');
      }

      await this.runtime.evaluate(message, {
        ...state,
        twitterClient: this.twitterClient,
      });
    }
  }

  async loadLatestCheckedTweetId(): Promise<void> {
    const latestCheckedTweetId = await this.runtime.getCache<string>(
      `twitter/${this.profile.username}/latest_checked_tweet_id`
    );

    if (latestCheckedTweetId) {
      this.lastCheckedTweetId = BigInt(latestCheckedTweetId);
    }
  }

  async cacheLatestCheckedTweetId() {
    if (this.lastCheckedTweetId) {
      await this.runtime.setCache<string>(
        `twitter/${this.profile.username}/latest_checked_tweet_id`,
        this.lastCheckedTweetId.toString()
      );
    }
  }

  async getCachedTimeline(): Promise<Tweet[] | undefined> {
    const cached = await this.runtime.getCache<Tweet[]>(
      `twitter/${this.profile.username}/timeline`
    );

    if (!cached) {
      return undefined;
    }

    return cached;
  }

  async cacheTimeline(timeline: Tweet[]) {
    await this.runtime.setCache<Tweet[]>(`twitter/${this.profile.username}/timeline`, timeline);
  }

  async cacheMentions(mentions: Tweet[]) {
    await this.runtime.setCache<Tweet[]>(`twitter/${this.profile.username}/mentions`, mentions);
  }

  async fetchProfile(username: string): Promise<TwitterProfile> {
    try {
      const profile = await this.requestQueue.add(async () => {
        const profile = await this.twitterClient.getProfile(username);
        return {
          id: profile.userId,
          username,
          screenName: profile.name || this.runtime.character.name,
          bio:
            profile.biography || typeof this.runtime.character.bio === 'string'
              ? (this.runtime.character.bio as string)
              : this.runtime.character.bio.length > 0
                ? this.runtime.character.bio[0]
                : '',
          nicknames: this.profile?.nicknames || [],
        } satisfies TwitterProfile;
      });

      return profile;
    } catch (error) {
      console.error('Error fetching Twitter profile:', error);
      throw error;
    }
  }

  /**
   * Fetches recent interactions (likes, retweets, quotes) for the authenticated user's tweets
   */
  async fetchInteractions() {
    try {
      const username = this.profile.username;
      // Use fetchSearchTweets to get mentions instead of the non-existent get method
      const mentionsResponse = await this.requestQueue.add(() =>
        this.twitterClient.fetchSearchTweets(`@${username}`, 100, SearchMode.Latest)
      );

      // Process tweets directly into the expected interaction format
      return mentionsResponse.tweets.map((tweet) => this.formatTweetToInteraction(tweet));
    } catch (error) {
      logger.error('Error fetching Twitter interactions:', error);
      return [];
    }
  }

  formatTweetToInteraction(tweet): TwitterInteractionPayload | null {
    if (!tweet) return null;

    const isQuote = tweet.isQuoted;
    const isRetweet = !!tweet.retweetedStatus;
    const type = isQuote ? 'quote' : isRetweet ? 'retweet' : 'like';

    return {
      id: tweet.id,
      type,
      userId: tweet.userId,
      username: tweet.username,
      name: tweet.name || tweet.username,
      targetTweetId: tweet.inReplyToStatusId || tweet.quotedStatusId,
      targetTweet: tweet.quotedStatus || tweet,
      quoteTweet: isQuote ? tweet : undefined,
      retweetId: tweet.retweetedStatus?.id,
    };
  }
}
