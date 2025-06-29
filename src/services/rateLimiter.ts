// @ts-ignore
import RedisStore from 'rate-limit-redis';
declare module 'rate-limit-redis';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import config from '../config';
import logger from '../utils/logger';

let redisClient: Redis | null = null;

// Initialize Redis client for rate limiting
const initializeRedis = (): Redis | null => {
  if (!config.sessions.persistenceEnabled) {
    logger.info('Rate limiting using in-memory store (Redis not available)');
    return null;
  }

  try {
    const redisOptions: any = {
      db: config.redis.db,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };
    if (config.redis.password) {
      redisOptions.password = config.redis.password;
    }
    redisClient = new Redis(config.redis.url, redisOptions);

    redisClient.on('connect', () => {
      logger.info('Redis connected for rate limiting');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis rate limiting error', { error: error.message });
    });

    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis for rate limiting', {
      error: (error as Error).message,
    });
    return null;
  }
};

// Create rate limiter with Redis store if available
const createRateLimiter = () => {
  const redis = initializeRedis();
  
  const rateLimitConfig = {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '60000', 10), // 1 minute
    max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10), // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '60 seconds',
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    store: redis ? new RedisStore({
      sendCommand: (...args: [string, ...any[]]) => redis.call(...args),
      prefix: 'rate-limit:',
    }) : undefined,
    handler: (req: any, res: any) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
      });
      
      res.status(429).json({
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '60000', 10) / 1000),
      });
    },
    skip: (req: any) => {
      // Skip rate limiting for health checks and monitoring endpoints
      return req.path === '/health' || req.path === '/metrics' || req.path.startsWith('/api-docs');
    },
  };

  return rateLimit(rateLimitConfig);
};

// Specific rate limiters for different endpoints
export const createSessionRateLimiter = () => {
  const redis = initializeRedis();
  
  return rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // limit each IP to 10 session creations per 5 minutes
    message: {
      error: 'Too many session creation attempts, please try again later.',
      retryAfter: '5 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: redis ? new RedisStore({
      sendCommand: (...args: [string, ...any[]]) => redis.call(...args),
      prefix: 'session-rate-limit:',
    }) : undefined,
    handler: (req: any, res: any) => {
      logger.warn('Session rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.status(429).json({
        success: false,
        error: 'Too many session creation attempts, please try again later.',
        retryAfter: 300, // 5 minutes
      });
    },
  });
};

export const createApiRateLimiter = () => {
  const redis = initializeRedis();
  
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // limit each IP to 60 API requests per minute
    message: {
      error: 'Too many API requests, please try again later.',
      retryAfter: '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: redis ? new RedisStore({
      sendCommand: (...args: [string, ...any[]]) => redis.call(...args),
      prefix: 'api-rate-limit:',
    }) : undefined,
    handler: (req: any, res: any) => {
      logger.warn('API rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
      });
      
      res.status(429).json({
        success: false,
        error: 'Too many API requests, please try again later.',
        retryAfter: 60,
      });
    },
  });
};

export default createRateLimiter(); 