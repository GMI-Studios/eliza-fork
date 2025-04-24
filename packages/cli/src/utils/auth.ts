import jwt from 'jsonwebtoken';
import { logger } from '@elizaos/core';

/**
 * Verifies a JWT token and returns the decoded data
 * @param token The JWT token to verify
 * @returns The decoded data or null if verification fails
 */
export async function verifyToken(token: string) {
  try {
    // Get JWT secret from environment
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error('JWT_SECRET environment variable is not set');
      return null;
    }

    // Verify and decode the token
    const decoded = await jwt.verify(token, secret);
    return decoded;
  } catch (error) {
    logger.error('Token verification failed:', error);
    return null;
  }
}
