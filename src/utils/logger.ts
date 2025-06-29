import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import config from '../config';

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.filePath);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'disposable-suite' },
  transports: [
    // Always add console transport for debugging
    new winston.transports.Console({
      format: consoleFormat,
    }),
    
    // File transport with rotation
    new DailyRotateFile({
      filename: config.logging.filePath,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
    }),
    
    // Error log file
    new DailyRotateFile({
      filename: path.join(logsDir, 'error.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: logFormat,
    }),
  ],
});

// Session action logging
export const logSessionAction = (action: string, details: Record<string, any>): void => {
  logger.info('Session action', {
    action,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

// Error logging with context
export const logError = (error: Error, context?: Record<string, any>): void => {
  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    ...context,
  });
};

// Request logging
export const logRequest = (req: any, res: any, next: any): void => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  });
  
  next();
};

// Performance logging
export const logPerformance = (operation: string, duration: number, metadata?: Record<string, any>): void => {
  logger.info('Performance metric', {
    operation,
    duration: `${duration}ms`,
    ...metadata,
  });
};

export default logger; 