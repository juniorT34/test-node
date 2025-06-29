import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import sessionManager from '../../services/sessionManager';
import { logSessionAction } from '../../utils/logger';
import logger from '../../utils/logger';
import { ApiResponse } from '../../types';

// Validation rules
export const validateStopSession = [
  body('containerId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Container ID must be a string between 1 and 100 characters'),
];

export const stopSession = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const duration = Date.now() - startTime;
      logger.warn('Stop session validation failed', {
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

    const { containerId } = req.body;

    // Check if session exists and is active
    if (!sessionManager.isSessionActive(containerId)) {
      const duration = Date.now() - startTime;
      logger.info('Session already stopped or does not exist', {
        containerId,
        duration: `${duration}ms`,
        ip: req.ip,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Session already stopped or does not exist',
        data: { containerId, stopped: true },
      };
      res.status(200).json(response);
      return;
    }

    // Stop session
    const success = await sessionManager.stopSession(containerId);

    if (success) {
      // Log the session stop action
      logSessionAction('stop-session', {
        containerId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const duration = Date.now() - startTime;
      logger.info('Session stopped successfully', {
        containerId,
        duration: `${duration}ms`,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Session stopped successfully',
        data: { containerId, stopped: true },
      };

      res.status(200).json(response);
    } else {
      // If stopping failed, treat as already stopped (idempotent)
      const duration = Date.now() - startTime;
      logger.info('Session already stopped or does not exist', {
        containerId,
        duration: `${duration}ms`,
        ip: req.ip,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Session already stopped or does not exist',
        data: { containerId, stopped: true },
      };
      res.status(200).json(response);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = (error as Error).message;

    logger.error('Error stopping session', {
      error: errorMessage,
      duration: `${duration}ms`,
      containerId: req.body.containerId,
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