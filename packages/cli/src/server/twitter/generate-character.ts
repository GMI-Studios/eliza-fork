import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import TwitterPipeline from './pipeline.js';
import chalk from 'chalk';
import ora from 'ora';
import Logger from './logger.js';
import { CharacterResponse, ColorMap } from './types';

// Handle __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const formatJSON = (json: Partial<CharacterResponse>): string => {
  const colorize: ColorMap = {
    name: chalk.green,
    handler: chalk.blue,
    bio: chalk.yellow,
    description: chalk.magenta,
    forum_start_system_prompt: chalk.cyan,
    forum_end_system_prompt: chalk.cyan,
    twitter_start_system_prompt: chalk.cyan,
    twitter_end_system_prompt: chalk.cyan,
  };

  return Object.entries(json)
    .map(([key, value]) => {
      const colorFn = colorize[key] || chalk.white;
      return `${chalk.white(key)}: ${colorFn(String(value))}`;
    })
    .join('\n');
};

export async function generateCharacter(
  username: string,
  tweets: string[],
  profile: any
): Promise<CharacterResponse | undefined> {
  console.log(`Generating character for ${username}`);

  const prompt = `You are tasked with creating a detailed character card based on a user's Twitter profile and tweets. This character card will be used to generate AI responses that mimic the user's personality and writing style. Your goal is to create a comprehensive and accurate representation of the user as a fictional character.
The output should be a JSON object with the following structure:
{
    "name": string,
    "bio": [string],
    "style": {
        "all": [string],
        "chat": [string],
        "post": [string]
    },
    "lore": [string],
    "messageExamples": [
        [
            {
                "user": "{{user1}}",
                "content": {
                    "text": string
                }
            },
            {
                "user": "string",
                "content": {
                    "text": string
                }
            }
        ]
    ],
    "postExamples": [string]
    "topics": [string],
    "adjectives": [string],
    "system": string
}
Here is the user information you'll be working with:
Handler: ${username}
Name: ${profile.name}
User Profile:
<profile>
${profile}
</profile>
Recent Tweets:
<recent_tweets>
${tweets}
</recent_tweets>
To create the character card, follow these steps:
1. Name: Use the user's display name from their profile or create a name that fits their personality based on their tweets.
2. Bio: Create a concise, engaging biography (1-2 sentences) that captures the essence of the user's online persona. Include their main interests, goals, or unique characteristics.
3. Style: Define the user's communication style based on their tweets. Include general style guidelines, chat-specific styles, and post-specific styles.
4. Lore: Include interesting facts or stories about the user that are evident from their tweets or public persona.
5. Message Examples: Provide examples of how the user might respond in a chat setting, using their typical language and style.
6. Topics: List the main topics the user frequently discusses or is knowledgeable about.
7. Adjectives: List adjectives that describe the user's personality or style.
8. System: Describe the role the user is playing, such as interacting with users on a specific platform.
When writing the character card, pay close attention to:
- The user's writing style, including vocabulary, sentence structure, and use of slang or jargon.
- Recurring themes or topics in their tweets.
- Their interactions with others (if visible in the provided tweets).
- Any strong opinions or beliefs expressed.
- The overall tone and attitude of their online presence.
Ensure that the character description and prompts are detailed enough to capture the user's unique personality while allowing for creative expansion in AI-generated responses.
Format your response as a valid JSON object, with each field containing the appropriate content as described above. Do not include any additional commentary or explanations outside of the JSON structure.`;

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const spinner = ora('Generating character...').start();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const responseJson = JSON.parse(response.choices[0].message.content) as CharacterResponse;
    const formattedJson = formatJSON(responseJson);
    spinner.succeed('Character generated successfully!');
    console.log('\n' + chalk.cyan('Character Details:'));
    console.log(formattedJson);
    return responseJson;
  } catch (error) {
    spinner.fail('Failed to generate character');
    if (error instanceof Error) {
      console.error(chalk.red('Error:'), error.message);
    }
    return undefined;
  }
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const username = args[0] || 'degenspartan';
  const date = args[1] || new Date().toISOString().split('T')[0];
  console.log(`Generating character for ${username} on ${date}`);

  const pipeline = new TwitterPipeline(username);

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
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
