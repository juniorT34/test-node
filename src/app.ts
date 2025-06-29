import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import statusMonitor from 'express-status-monitor';

import config from './config';
import logger, { logRequest } from './utils/logger';
import rateLimiter from './services/rateLimiter';
import browserRoutes from './api/browser';
import { ApiResponse } from './types';

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Disposable Suite API',
      version: '1.0.0',
      description: 'A production-ready backend for disposable services using Docker',
      contact: {
        name: 'API Support',
        email: 'support@disposable-suite.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Nginx reverse proxy (recommended)',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
    },
  },
  apis: ['./dist/api/**/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Compression middleware
app.use(compression());

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => {
      logger.info(message.trim());
    },
  },
}));

// Custom request logging middleware
app.use(logRequest);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// Status monitoring (if enabled)
if (config.monitoring.enabled) {
  app.use(statusMonitor({
    title: 'Disposable Suite Status',
    path: '/status',
    spans: [{
      interval: 1,
      retention: 60,
    }, {
      interval: 5,
      retention: 60,
    }, {
      interval: 15,
      retention: 60,
    }],
    chartVisibility: {
      cpu: true,
      mem: true,
      load: true,
      responseTime: true,
      rps: true,
      statusCodes: true,
    },
    healthChecks: [
      {
        protocol: 'http',
        host: 'localhost',
        path: '/health',
        port: config.port,
      },
    ],
  }));
}

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Disposable Suite API Documentation',
}));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: process.env['npm_package_version'] || '1.0.0',
  };

  res.status(200).json(healthCheck);
});

// API routes
app.use('/api/browser', browserRoutes);

// Add Swagger JSDoc comments for browser endpoints
/**
 * @swagger
 * /api/browser/start-session:
 *   post:
 *     summary: Start a new browser session
 *     tags: [Session Management]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               durationMs:
 *                 type: integer
 *                 description: Duration in milliseconds (min 60000, max 3600000)
 *                 example: 300000
 *               userId:
 *                 type: string
 *                 description: Optional user ID
 *                 example: test-user
 *     responses:
 *       201:
 *         description: Session started successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionResponse'
 *       400:
 *         description: Validation failed
 *       429:
 *         description: Too many sessions
 *       503:
 *         description: Docker unavailable
 *
 * /api/browser/stop-session:
 *   post:
 *     summary: Stop an active browser session
 *     tags: [Session Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - containerId
 *             properties:
 *               containerId:
 *                 type: string
 *                 description: The session/container ID
 *                 example: abc123
 *     responses:
 *       200:
 *         description: Session stopped successfully
 *       400:
 *         description: Validation failed
 *       404:
 *         description: Session not found or already stopped
 *
 * /api/browser/remaining-time:
 *   get:
 *     summary: Get remaining time for a session
 *     tags: [Session Management]
 *     parameters:
 *       - in: query
 *         name: containerId
 *         schema:
 *           type: string
 *         required: true
 *         description: The session/container ID
 *     responses:
 *       200:
 *         description: Remaining time retrieved successfully
 *       400:
 *         description: Validation failed
 *       404:
 *         description: Session not found or already expired
 *
 * /api/browser/extend-session:
 *   post:
 *     summary: Extend an active browser session
 *     tags: [Session Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - containerId
 *               - extendByMs
 *             properties:
 *               containerId:
 *                 type: string
 *                 description: The session/container ID
 *                 example: abc123
 *               extendByMs:
 *                 type: integer
 *                 description: Milliseconds to extend (min 60000, max 3600000)
 *                 example: 60000
 *     responses:
 *       200:
 *         description: Session extended successfully
 *       400:
 *         description: Validation failed
 *       404:
 *         description: Session not found or already expired
 *
 * components:
 *   schemas:
 *     SessionResponse:
 *       type: object
 *       properties:
 *         containerId:
 *           type: string
 *         hostPort:
 *           type: integer
 *         proxyUrl:
 *           type: string
 *         browserUrl:
 *           type: string
 *         expiresAt:
 *           type: integer
 *         remainingTimeMs:
 *           type: integer
 */

// 404 handler
app.use('*', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: 'Endpoint not found',
    data: { path: req.originalUrl },
  };
  
  res.status(404).json(response);
});

// Global error handler
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  const response: ApiResponse = {
    success: false,
    error: config.nodeEnv === 'production' ? 'Internal server error' : error.message,
  };

  res.status(500).json(response);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app; 