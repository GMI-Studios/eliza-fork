import type { IAgentRuntime, UUID } from '@elizaos/core';
import { logger } from '@elizaos/core';
import express from 'express';
import TwitterPipeline from '../twitter/pipeline.js';
import { generateCharacter } from '../twitter/generate-character.js';

/**
 * Creates a router for character generation endpoints.
 * @param agents - Map of agent runtimes
 * @returns Express router for generation endpoints
 */
export function generateRouter(agents: Map<UUID, IAgentRuntime>): express.Router {
  const router = express.Router();

  router.get('/character/:username', async (req: any, res: any) => {
    try {
      const { username } = req.params;
      const date = req.query.date || new Date().toISOString().split('T')[0];

      logger.info(`Generating character for ${username} on ${date}`);

      const pipeline = new TwitterPipeline(username);

      // Get profile and tweets
      const profile = await pipeline.getProfile();
      const tweets = await pipeline.collectTweets(pipeline.scraper);

      if (!profile || !tweets) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Could not fetch Twitter data',
            code: 'TWITTER_DATA_NOT_FOUND',
          },
        });
      }

      const tweetsArray = tweets.tweets.map((tweet) => tweet.text);
      // Generate character
      const character = await generateCharacter(username, tweetsArray, tweets.profile);

      res.json({
        success: true,
        data: character,
      });
    } catch (error) {
      logger.error('Error generating character:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Failed to generate character',
          code: 'GENERATION_ERROR',
        },
      });
    }
  });

  return router;
}
