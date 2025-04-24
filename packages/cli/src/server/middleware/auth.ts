import { Response, NextFunction } from 'express';
import { verifyToken } from '../../utils/auth';
import { logger } from '@elizaos/core';

export async function jwtAuthMiddleware(req: any, res: Response, next: NextFunction): Promise<any> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn('API request without authorization header', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.split(' ')[1]; // Bearer <token>
  if (!token) {
    logger.warn('API request with invalid authorization header format', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(401).json({ error: 'Invalid authorization header format' });
  }

  try {
    const user = await verifyToken(token);
    const wallet = user.abstractWalletAddress;
    if (wallet.toLocaleLowerCase() !== process.env.ADMIN_WALLET?.toLocaleLowerCase()) {
      logger.warn('Unauthorized wallet access attempt', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        wallet,
      });
      return res.status(403).json({ error: 'Unauthorized wallet' });
    }
    req.user = user; // Attach user to request
    next();
  } catch (error) {
    logger.error('JWT verification failed', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      error: error.message,
    });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
