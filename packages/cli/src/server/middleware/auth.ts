import { Response, NextFunction } from 'express';
import { logger } from '@elizaos/core';

export async function secretKeyAuthMiddleware(
  req: any,
  res: Response,
  next: NextFunction
): Promise<any> {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    logger.warn('API request without X-API-Key header', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(401).json({ error: 'X-API-Key header required' });
  }

  try {
    if (apiKey !== process.env.API_SECRET_KEY) {
      logger.warn('Invalid API key', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      return res.status(403).json({ error: 'Invalid API key' });
    }
    next();
  } catch (error) {
    logger.error('API key verification failed', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      error: error.message,
    });
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
