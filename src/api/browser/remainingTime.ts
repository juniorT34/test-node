import { Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import sessionManager from '../../services/sessionManager';
import logger from '../../utils/logger';
import { ApiResponse } from '../../types';

// Validation rules
export const validateRemainingTime = [
  query('containerId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Container ID must be a string between 1 and 100 characters'),
];

export const getRemainingTime = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const duration = Date.now() - startTime;
      logger.warn('Get remaining time validation failed', {
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

    const { containerId } = req.query as { containerId: string };

    // Check if session exists and is active
    if (!sessionManager.isSessionActive(containerId)) {
      const duration = Date.now() - startTime;
      logger.warn('Attempted to get remaining time for non-existent or inactive session', {
        containerId,
        duration: `${duration}ms`,
        ip: req.ip,
      });

      const response: ApiResponse = {
        success: false,
        error: 'Session not found or already expired',
        data: { containerId, remainingTimeMs: 0 },
      };
      
      res.status(404).json(response);
      return;
    }

    // Get remaining time
    const remainingTimeMs = sessionManager.getRemainingTime(containerId);

    const duration = Date.now() - startTime;
    logger.info('Remaining time retrieved successfully', {
      containerId,
      remainingTimeMs,
      duration: `${duration}ms`,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Remaining time retrieved successfully',
      data: { containerId, remainingTimeMs },
    };

    res.status(200).json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = (error as Error).message;

    logger.error('Error getting remaining time', {
      error: errorMessage,
      duration: `${duration}ms`,
      containerId: (req.query as any).containerId,
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