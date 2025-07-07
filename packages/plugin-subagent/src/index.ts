import {
  ChannelType,
  type Entity,
  EventType,
  type IAgentRuntime,
  type Plugin,
  Role,
  type Room,
  Service,
  type UUID,
  type World,
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { ClientBase } from './base';
import { TWITTER_SERVICE_NAME } from './constants';
import type { TwitterConfig } from './environment';
import { TwitterInteractionClient } from './interactions';
import { TwitterPostClient } from './post';
import { TwitterTimelineClient } from './timeline';
import { ClientBaseTestSuite } from './tests';
import { type ITwitterClient, TwitterEventTypes } from './types';

logger.debug(`Subagent plugin module loaded - Service name: ${TWITTER_SERVICE_NAME}`);

/**
 * OAuth 2.0 Token Refresh Usage Guide:
 *
 * The subagent plugin now handles token refresh automatically in the base client.
 *
 * 1. Ensure your .env file contains OAuth 2.0 credentials:
 *    TWITTER_CLIENT_ID=your_client_id
 *    TWITTER_CLIENT_SECRET=your_client_secret
 *    BEARER_TOKEN=your_initial_access_token
 *    REFRESH_TOKEN=your_refresh_token
 *
 * 2. Token refresh happens automatically:
 *    - During initial login (in ClientBase.init())
 *    - During any API call that fails with auth errors (using makeAuthenticatedRequest)
 *    - Example usage:
 *      const client = new ClientBase(runtime, state);
 *      const tweetResult = await client.postTweetWithRetry("Hello World!");
 *      const searchResult = await client.makeAuthenticatedRequest(
 *        () => client.fetchSearchTweets("query", 10, SearchMode.Latest)
 *      );
 *
 * 3. The system automatically:
 *    - Detects authentication errors (401, unauthorized, expired token, etc.)
 *    - Attempts OAuth 2.0 token refresh using the Twitter API v2 endpoint
 *    - Updates agent secrets with new tokens via runtime.setSetting(key, value, true)
 *    - **Immediately persists changes to database via runtime.updateAgent()**
 *    - Retries the original operation with refreshed authentication
 *    - Logs all refresh attempts and outcomes for debugging
 *
 * 4. For manual setting updates with immediate persistence:
 *    const client = new ClientBase(runtime, state);
 *    await client.setAndSaveSetting('BEARER_TOKEN', newToken, true);
 *
 * No manual token management required - just use the client methods normally!
 */

/**
 * A manager that orchestrates all specialized Twitter logic:
 * - client: base operations (login, timeline caching, etc.)
 * - post: autonomous posting logic
 * - search: searching tweets / replying logic
 * - interaction: handling mentions, replies
 * - space: launching and managing Twitter Spaces (optional)
 */
/**
 * TwitterClientInstance class that implements ITwitterClient interface.
 *
 * @class
 * @implements {ITwitterClient}
 */

export class TwitterClientInstance implements ITwitterClient {
  client: ClientBase;
  post: TwitterPostClient;
  interaction: TwitterInteractionClient;
  timeline?: TwitterTimelineClient;
  service: TwitterService;

  constructor(runtime: IAgentRuntime, state: any) {
    // Pass twitterConfig to the base client
    logger.debug('TwitterClientInstance constructor - initializing client components');
    this.client = new ClientBase(runtime, state);

    // Posting logic - use TWITTER_POST_ENABLE instead
    const postEnableSetting = runtime.getSetting('TWITTER_POST_ENABLE');
    logger.info(`TWITTER_POST_ENABLE raw value: "${postEnableSetting}"`);
    logger.info(`TWITTER_POST_ENABLE type: ${typeof postEnableSetting}`);

    // Handle both boolean and string values
    const postEnabled =
      postEnableSetting === true ||
      postEnableSetting === 'true' ||
      (typeof postEnableSetting === 'string' && postEnableSetting.toLowerCase() === 'true');

    if (postEnabled) {
      logger.info('Twitter posting is ENABLED - creating post client');
      this.post = new TwitterPostClient(this.client, runtime, state);
    } else {
      logger.info(
        'Twitter posting is DISABLED - set TWITTER_POST_ENABLE=true to enable automatic posting'
      );
    }

    // Mentions and interactions - check for TWITTER_SEARCH_ENABLE
    const searchEnabledSetting = runtime.getSetting('TWITTER_SEARCH_ENABLE');
    logger.info(`TWITTER_SEARCH_ENABLE raw value: "${searchEnabledSetting}"`);

    // Handle both boolean and string values
    const searchEnabled = searchEnabledSetting !== false && searchEnabledSetting !== 'false';
    if (searchEnabled) {
      logger.info('Twitter search/interactions are ENABLED');
      this.interaction = new TwitterInteractionClient(this.client, runtime, state);
    } else {
      logger.info('Twitter search/interactions are DISABLED');
    }

    // handle timeline - check if TWITTER_ENABLE_ACTION_PROCESSING is enabled
    const actionProcessingEnabled =
      runtime.getSetting('TWITTER_ENABLE_ACTION_PROCESSING') === 'true';
    if (actionProcessingEnabled) {
      logger.info('Twitter action processing is ENABLED');
      this.timeline = new TwitterTimelineClient(this.client, runtime, state);
    } else {
      logger.info('Twitter action processing is DISABLED');
    }

    this.service = TwitterService.getInstance();
  }
}

export class TwitterService extends Service {
  static serviceType: string = TWITTER_SERVICE_NAME;
  capabilityDescription = 'The agent is able to send and receive messages on twitter';
  private static instance: TwitterService;
  private clients: Map<string, TwitterClientInstance> = new Map();

  static getInstance(): TwitterService {
    if (!TwitterService.instance) {
      TwitterService.instance = new TwitterService();
    }
    return TwitterService.instance;
  }

  async createClient(
    runtime: IAgentRuntime,
    clientId: string,
    state: any
  ): Promise<TwitterClientInstance> {
    try {
      // Check if client already exists
      const existingClient = this.getClient(clientId, runtime.agentId);
      if (existingClient) {
        logger.info(`Twitter client already exists for ${clientId}`);
        return existingClient;
      }

      // Create new client instance
      const client = new TwitterClientInstance(runtime, state);

      // Initialize the client
      await client.client.init();

      if (client.post) {
        client.post.start();
      }

      if (client.interaction) {
        client.interaction.start();
      }

      if (client.timeline) {
        client.timeline.start();
      }

      // Store the client instance
      this.clients.set(this.getClientKey(clientId, runtime.agentId), client);

      // Emit standardized WORLD_JOINED event once we have client profile
      await this.emitServerJoinedEvent(runtime, client);

      logger.info(`Created Twitter client for ${clientId}`);
      return client;
    } catch (error) {
      logger.error(`Failed to create Twitter client for ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Emits a standardized WORLD_JOINED event for Twitter
   * @param runtime The agent runtime
   * @param client The Twitter client instance
   */
  private async emitServerJoinedEvent(
    runtime: IAgentRuntime,
    client: TwitterClientInstance
  ): Promise<void> {
    try {
      if (!client.client.profile) {
        logger.warn("Twitter profile not available yet, can't emit WORLD_JOINED event");
        return;
      }

      const profile = client.client.profile;
      const twitterId = profile.id;
      const username = profile.username;

      // Create the world ID based on the twitter user ID
      const worldId = createUniqueUuid(runtime, twitterId) as UUID;

      // For Twitter, we create a single world representing the user's Twitter account
      const world: World = {
        id: worldId,
        name: `${username}'s Twitter`,
        agentId: runtime.agentId,
        serverId: twitterId,
        metadata: {
          ownership: { ownerId: twitterId },
          roles: {
            [twitterId]: Role.OWNER,
          },
          twitter: {
            username: username,
            id: twitterId,
          },
        },
      };

      // We'll create a "home timeline" room
      const homeTimelineRoomId = createUniqueUuid(runtime, `${twitterId}-home`) as UUID;
      const homeTimelineRoom: Room = {
        id: homeTimelineRoomId,
        name: `${username}'s Timeline`,
        source: 'twitter',
        type: ChannelType.FEED,
        channelId: `${twitterId}-home`,
        serverId: twitterId,
        worldId: worldId,
      };

      // Create a "mentions" room
      const mentionsRoomId = createUniqueUuid(runtime, `${twitterId}-mentions`) as UUID;
      const mentionsRoom: Room = {
        id: mentionsRoomId,
        name: `${username}'s Mentions`,
        source: 'twitter',
        type: ChannelType.GROUP,
        channelId: `${twitterId}-mentions`,
        serverId: twitterId,
        worldId: worldId,
      };

      // Create an entity for the Twitter user
      const twitterUserId = createUniqueUuid(runtime, twitterId) as UUID;
      const twitterUser: Entity = {
        id: twitterUserId,
        names: [profile.screenName || username],
        agentId: runtime.agentId,
        metadata: {
          twitter: {
            id: twitterId,
            username: username,
            screenName: profile.screenName || username,
            name: profile.screenName || username,
          },
        },
      };

      // Emit the WORLD_JOINED event
      runtime.emitEvent([TwitterEventTypes.WORLD_JOINED, EventType.WORLD_JOINED], {
        runtime: runtime,
        world: world,
        rooms: [homeTimelineRoom, mentionsRoom],
        entities: [twitterUser],
        source: 'twitter',
      });

      logger.info(`Emitted WORLD_JOINED event for Twitter account ${username}`);
    } catch (error) {
      logger.error('Failed to emit WORLD_JOINED event for Twitter:', error);
    }
  }

  getClient(clientId: string, agentId: UUID): TwitterClientInstance | undefined {
    return this.clients.get(this.getClientKey(clientId, agentId));
  }

  async stopClient(clientId: string, agentId: UUID): Promise<void> {
    const key = this.getClientKey(clientId, agentId);
    const client = this.clients.get(key);
    if (client) {
      try {
        await client.service.stop();
        this.clients.delete(key);
        logger.info(`Stopped Twitter client for ${clientId}`);
      } catch (error) {
        logger.error(`Error stopping Twitter client for ${clientId}:`, error);
      }
    }
  }

  static async start(runtime: IAgentRuntime) {
    const twitterClientManager = TwitterService.getInstance();

    // Check for character-level Twitter credentials
    const twitterConfig: Partial<TwitterConfig> = {
      BEARER_TOKEN:
        String(runtime.getSetting('BEARER_TOKEN') || '') ||
        String(runtime.character.settings?.BEARER_TOKEN || '') ||
        String(runtime.character.secrets?.BEARER_TOKEN || ''),
      REFRESH_TOKEN:
        String(runtime.getSetting('REFRESH_TOKEN') || '') ||
        String(runtime.character.settings?.REFRESH_TOKEN || '') ||
        String(runtime.character.secrets?.REFRESH_TOKEN || ''),
    };

    // Filter out undefined values
    const config = Object.fromEntries(
      Object.entries(twitterConfig).filter(([_, v]) => v !== undefined && v !== '')
    ) as TwitterConfig;

    // If we have enough settings to create a client, do so
    try {
      if (config.BEARER_TOKEN && config.REFRESH_TOKEN) {
        logger.info('Creating default Twitter client from character settings');
        await twitterClientManager.createClient(runtime, runtime.agentId, config);
      }
    } catch (error) {
      logger.error('Failed to create default Twitter client:', error);
      throw error;
    }

    return twitterClientManager;
  }

  async stop(): Promise<void> {
    await this.stopAllClients();
  }

  async stopAllClients(): Promise<void> {
    for (const [key, client] of this.clients.entries()) {
      try {
        await client.service.stop();
        this.clients.delete(key);
      } catch (error) {
        logger.error(`Error stopping Twitter client ${key}:`, error);
      }
    }
  }

  private getClientKey(clientId: string, agentId: UUID): string {
    return `${clientId}-${agentId}`;
  }

  /**
   * Refresh authentication for a specific client
   * This now delegates to the client's built-in token refresh functionality
   * @param clientId The client ID to refresh
   * @param runtime The agent runtime
   */
  async refreshClientAuth(clientId: string, runtime: IAgentRuntime): Promise<void> {
    const key = this.getClientKey(clientId, runtime.agentId);
    const client = this.clients.get(key);

    if (!client) {
      logger.warn(`No client found for ${clientId} to refresh auth`);
      return;
    }

    try {
      logger.info(`Delegating token refresh to client ${clientId}`);

      // The client now handles its own token refresh during API calls and login
      // We just need to re-initialize the client to pick up any new tokens
      await client.client.init();

      logger.info(`Successfully refreshed authentication for client ${clientId}`);
    } catch (error) {
      logger.error(`Failed to refresh authentication for client ${clientId}:`, error);

      // If refresh fails, remove the client
      this.clients.delete(key);
      logger.info(`Removed failed client ${clientId} from service`);

      throw error;
    }
  }
}

const twitterPlugin: Plugin = {
  name: TWITTER_SERVICE_NAME,
  description: 'Twitter client with per-server instance management',
  services: [TwitterService],
  actions: [],
  tests: [new ClientBaseTestSuite()],
  async init(config: Record<string, string>, runtime: IAgentRuntime): Promise<void> {
    logger.info(`*** Initializing ${TWITTER_SERVICE_NAME} plugin ***`);
    logger.info(`Plugin description: Twitter client with per-server instance management`);

    // Log available OAuth 2.0 configuration
    const oauth2Keys = [
      'TWITTER_CLIENT_ID',
      'CLIENT_ID',
      'TWITTER_CLIENT_SECRET',
      'CLIENT_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'BEARER_TOKEN',
      'TWITTER_REFRESH_TOKEN',
      'REFRESH_TOKEN',
      'TWITTER_POST_ENABLE',
      'TWITTER_SEARCH_ENABLE',
      'TWITTER_ENABLE_ACTION_PROCESSING',
    ];

    const availableConfig = oauth2Keys.filter(
      (key) =>
        runtime.getSetting(key) ||
        runtime.character.settings?.[key] ||
        runtime.character.secrets?.[key]
    );

    logger.info(`Available Twitter OAuth 2.0 configuration: ${availableConfig.join(', ')}`);

    // Log OAuth 2.0 setup status
    const hasClientId = !!(
      runtime.getSetting('TWITTER_CLIENT_ID') || runtime.getSetting('CLIENT_ID')
    );
    const hasClientSecret = !!(
      runtime.getSetting('TWITTER_CLIENT_SECRET') || runtime.getSetting('CLIENT_SECRET')
    );

    logger.info(
      `OAuth 2.0 credentials status: ClientID=${hasClientId}, ClientSecret=${hasClientSecret}`
    );

    // Log feature enablement status
    const postEnabled =
      runtime.getSetting('TWITTER_POST_ENABLE') === 'true' ||
      runtime.getSetting('TWITTER_POST_ENABLE') === true;
    const searchEnabled =
      runtime.getSetting('TWITTER_SEARCH_ENABLE') !== 'false' &&
      runtime.getSetting('TWITTER_SEARCH_ENABLE') !== false;
    const actionProcessingEnabled =
      runtime.getSetting('TWITTER_ENABLE_ACTION_PROCESSING') === 'true';

    logger.info(
      `Twitter features - Post: ${postEnabled ? 'ENABLED' : 'DISABLED'}, Search: ${searchEnabled ? 'ENABLED' : 'DISABLED'}, Action Processing: ${actionProcessingEnabled ? 'ENABLED' : 'DISABLED'}`
    );

    logger.info(`*** ${TWITTER_SERVICE_NAME} plugin initialization completed ***`);
  },
};

export default twitterPlugin;
