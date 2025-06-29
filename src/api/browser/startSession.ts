import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import sessionManager from '../../services/sessionManager';
import { logSessionAction } from '../../utils/logger';
import logger from '../../utils/logger';
import { ApiResponse, SessionResponse } from '../../types';
import config from '../../config';

// Validation rules
export const validateStartSession = [
  body('durationMs')
    .optional()
    .isInt({ min: 60000, max: 3600000 }) // 1 minute to 1 hour
    .withMessage('Duration must be between 60000 and 3600000 milliseconds'),
  body('userId')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('User ID must be a string between 1 and 100 characters'),
];

export const startSession = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const duration = Date.now() - startTime;
      logger.warn('Start session validation failed', {
        errors: errors.array(),
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const response: ApiResponse = {
        success: false,
        error: 'Validation failed',
        data: { errors: errors.array() },
      };
      
      res.status(400).json(response);
      return;
    }

    const { durationMs, userId } = req.body;

    // Create session
    const session = await sessionManager.createSession(durationMs, userId);

    // Log the session start action
    logSessionAction('start-session', {
      containerId: session.containerId,
      hostPort: session.hostPort,
      durationMs: durationMs || 300000,
      userId,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    const duration = Date.now() - startTime;
    logger.info('Session started successfully', {
      containerId: session.containerId,
      hostPort: session.hostPort,
      duration: `${duration}ms`,
      userId,
    });

    // Explicitly add hostPort, browserUrl, and publicBrowserUrl to the response
    const publicBrowserUrl = `${config.publicBaseUrl}/browser-session/${session.containerId}/`;
    const response: ApiResponse<SessionResponse & { hostPort: number; browserUrl: string; publicBrowserUrl: string }> = {
      success: true,
      message: 'Session started successfully',
      data: {
        ...session,
        hostPort: session.hostPort,
        browserUrl: session.browserUrl,
        publicBrowserUrl,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = (error as Error).message;

    logger.error('Failed to start session', {
      error: errorMessage,
      duration: `${duration}ms`,
      userId: req.body.userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    const response: ApiResponse = {
      success: false,
      error: errorMessage,
    };

    // Determine appropriate status code based on error type
    let statusCode = 500;
    if (errorMessage.includes('Maximum number of sessions')) {
      statusCode = 429; // Too Many Requests
    } else if (errorMessage.includes('Docker')) {
      statusCode = 503; // Service Unavailable
    }

    res.status(statusCode).json(response);
  }
}; 