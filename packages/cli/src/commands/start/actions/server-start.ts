import { getElizaCharacter } from '@/src/characters/eliza';
import { AgentServer, jsonToCharacter, loadCharacterTryPath } from '@elizaos/server';
import { configureDatabaseSettings, findNextAvailablePort, resolvePgliteDir } from '@/src/utils';
import { logger, type Character, type ProjectAgent } from '@elizaos/core';
import { startAgent, stopAgent } from './agent-start';
import type { Request, Response } from 'express';

/**
 * Server start options
 */
export interface ServerStartOptions {
  configure?: boolean;
  port?: number;
  characters?: Character[];
  projectAgents?: ProjectAgent[];
}

/**
 * Start the agents and server
 *
 * Initializes the database, creates the server instance, configures port settings, and starts the specified agents or default Eliza character.
 */
export async function startAgents(options: ServerStartOptions): Promise<void> {
  const postgresUrl = await configureDatabaseSettings(options.configure);
  if (postgresUrl) process.env.POSTGRES_URL = postgresUrl;

  const pgliteDataDir = postgresUrl ? undefined : await resolvePgliteDir();

  const server = new AgentServer();
  await server.initialize({ dataDir: pgliteDataDir, postgresUrl: postgresUrl || undefined });

  server.startAgent = (character) => startAgent(character, server);
  server.stopAgent = (runtime) => stopAgent(runtime, server);
  server.loadCharacterTryPath = loadCharacterTryPath;
  server.jsonToCharacter = jsonToCharacter;

  const desiredPort = options.port || Number.parseInt(process.env.SERVER_PORT || '3000');
  const serverPort = await findNextAvailablePort(desiredPort);
  if (serverPort !== desiredPort) {
    logger.warn(`Port ${desiredPort} is in use, using port ${serverPort} instead`);
  }
  process.env.SERVER_PORT = serverPort.toString();
  
  server.start(serverPort);
  
  // 🔍 Enhanced Environment Variables Debug - Check Railway deployment
  console.log('\n' + '='.repeat(60));
  console.log('🔍 COMPREHENSIVE ENVIRONMENT DEBUG');
  console.log('='.repeat(60));

  // Check if we're running on Railway
  const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
  console.log(`🚂 Railway Environment: ${isRailway ? 'YES' : 'NO'}`);
  if (isRailway) {
    console.log(`📍 Railway Project: ${process.env.RAILWAY_PROJECT_ID || 'Unknown'}`);
    console.log(`🌍 Railway Environment: ${process.env.RAILWAY_ENVIRONMENT || 'Unknown'}`);
  }

  // Check Node.js environment
  console.log(`🟢 Node Environment: ${process.env.NODE_ENV || 'Not set'}`);

  // Log the specific variable we're looking for
  console.log('\n📋 TARGET VARIABLE:');
  console.log(`🐦 TWITTER_CLIENT_ID: ${process.env.TWITTER_CLIENT_ID || 'NOT_SET'}`);
  console.log(`🐦 Type: ${typeof process.env.TWITTER_CLIENT_ID}`);
  console.log(`🐦 Length: ${process.env.TWITTER_CLIENT_ID?.length || 0}`);

  // Check related Twitter variables
  console.log('\n🐦 ALL TWITTER VARIABLES:');
  const twitterVars = Object.keys(process.env).filter(key => key.includes('TWITTER'));
  if (twitterVars.length > 0) {
    twitterVars.forEach(key => {
      const value = process.env[key];
      console.log(`   ${key}: ${value ? `[SET - ${value.length} chars]` : 'NOT_SET'}`);
    });
  } else {
    console.log('   ❌ No TWITTER_* environment variables found');
  }

  // Check if there are any environment variables at all
  console.log(`\n📊 Total Environment Variables: ${Object.keys(process.env).length}`);

  // Show first few characters of common variables to verify env loading
  console.log('\n🔍 SAMPLE ENVIRONMENT VARIABLES:');
  const sampleVars = ['PORT', 'HOST', 'DATABASE_URL', 'OPENAI_API_KEY'];
  sampleVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`   ${varName}: ${value.substring(0, 10)}... [${value.length} chars]`);
    } else {
      console.log(`   ${varName}: NOT_SET`);
    }
  });

  // Log all variables that start with specific prefixes (be careful with secrets)
  console.log('\n🔧 DEPLOYMENT VARIABLES:');
  const deploymentPrefixes = ['RAILWAY_', 'VERCEL_', 'HEROKU_', 'AWS_', 'PORT', 'HOST'];
  deploymentPrefixes.forEach(prefix => {
    const vars = Object.keys(process.env).filter(key => key.startsWith(prefix));
    if (vars.length > 0) {
      console.log(`   ${prefix}* variables: ${vars.length} found`);
      vars.forEach(key => {
        const value = process.env[key];
        // Only show non-sensitive deployment vars
        if (!key.includes('SECRET') && !key.includes('TOKEN') && !key.includes('KEY')) {
          console.log(`     ${key}: ${value}`);
        } else {
          console.log(`     ${key}: [HIDDEN - ${value?.length || 0} chars]`);
        }
      });
    }
  });

  console.log('='.repeat(60) + '\n');

  // Original logs with enhanced formatting
  logger.info(`🐦 TWITTER_CLIENT_ID: ${process.env.TWITTER_CLIENT_ID || 'Not set'}`);
  console.log(`\x1b[36m🔍 Environment Check - TWITTER_CLIENT_ID: ${process.env.TWITTER_CLIENT_ID || 'NOT_SET'}\x1b[0m`);

  // 🔧 Add temporary debug endpoint for Railway troubleshooting
  if (process.env.RAILWAY_ENVIRONMENT) {
    // Add a simple debug route to check env vars via HTTP
    const express = require('express');
    const debugApp = express();
    
    debugApp.get('/debug/env', (req: Request, res: Response) => {
      const debugInfo = {
        timestamp: new Date().toISOString(),
        isRailway: !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID),
        railwayProject: process.env.RAILWAY_PROJECT_ID,
        railwayEnvironment: process.env.RAILWAY_ENVIRONMENT,
        nodeEnv: process.env.NODE_ENV,
        twitterClientId: process.env.TWITTER_CLIENT_ID || 'NOT_SET',
        twitterClientIdType: typeof process.env.TWITTER_CLIENT_ID,
        twitterClientIdLength: process.env.TWITTER_CLIENT_ID?.length || 0,
        totalEnvVars: Object.keys(process.env).length,
        twitterVars: Object.keys(process.env)
          .filter(key => key.includes('TWITTER'))
          .map(key => ({
            key,
            hasValue: !!process.env[key],
            valueLength: process.env[key]?.length || 0
          })),
        allEnvKeys: Object.keys(process.env).sort()
      };
      
      res.json(debugInfo);
    });
    
    const debugPort = (serverPort || 3000) + 1;
    debugApp.listen(debugPort, () => {
      console.log(`🔧 Debug endpoint available at: http://localhost:${debugPort}/debug/env`);
      console.log(`🌐 On Railway: https://your-app.railway.app:${debugPort}/debug/env`);
    });
  }

  // If we have project agents, start them with their init functions
  if (options.projectAgents && options.projectAgents.length > 0) {
    for (const projectAgent of options.projectAgents) {
      await startAgent(
        projectAgent.character,
        server,
        projectAgent.init,
        projectAgent.plugins || []
      );
    }
  }
  // If we have standalone characters, start them
  else if (options.characters && options.characters.length > 0) {
    for (const character of options.characters) {
      await startAgent(character, server);
    }
  }
  // Default fallback to Eliza character
  else {
    const elizaCharacter = getElizaCharacter();
    await startAgent(elizaCharacter, server);
  }
}
