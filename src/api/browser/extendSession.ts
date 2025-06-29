import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import sessionManager from '../../services/sessionManager';
import { logSessionAction } from '../../utils/logger';
import logger from '../../utils/logger';
import { ApiResponse } from '../../types';

// Validation rules
export const validateExtendSession = [
  body('containerId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Container ID must be a string between 1 and 100 characters'),
  body('extendByMs')
    .isInt({ min: 60000, max: 3600000 }) // 1 minute to 1 hour
    .withMessage('Extension time must be between 60000 and 3600000 milliseconds'),
];

export const extendSession = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const duration = Date.now() - startTime;
      logger.warn('Extend session validation failed', {
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

    const { containerId, extendByMs } = req.body;

    // Check if session exists and is active
    if (!sessionManager.isSessionActive(containerId)) {
      const duration = Date.now() - startTime;
      logger.warn('Attempted to extend non-existent or inactive session', {
        containerId,
        extendByMs,
        duration: `${duration}ms`,
        ip: req.ip,
      });

      const response: ApiResponse = {
        success: false,
        error: 'Session not found or already expired',
        data: { containerId, extended: false },
      };
      
      res.status(404).json(response);
      return;
    }

    // Extend session
    const success = sessionManager.extendSession(containerId, extendByMs);

    if (success) {
      // Log the session extension action
      logSessionAction('extend-session', {
        containerId,
        extendByMs,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const duration = Date.now() - startTime;
      logger.info('Session extended successfully', {
        containerId,
        extendByMs,
        duration: `${duration}ms`,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Session extended successfully',
        data: { containerId, extended: true, extendByMs },
      };

      res.status(200).json(response);
    } else {
      const duration = Date.now() - startTime;
      logger.error('Failed to extend session', {
        containerId,
        extendByMs,
        duration: `${duration}ms`,
        ip: req.ip,
      });

      const response: ApiResponse = {
        success: false,
        error: 'Failed to extend session',
        data: { containerId, extended: false },
      };

      res.status(500).json(response);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = (error as Error).message;

    logger.error('Error extending session', {
      error: errorMessage,
      duration: `${duration}ms`,
      containerId: req.body.containerId,
      extendByMs: req.body.extendByMs,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    const response: ApiResponse = {
      success: false,
      error: errorMessage,
    };

    res.status(500).json(response);
  }
}; 