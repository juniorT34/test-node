import dotenv from 'dotenv';
import app from './app';
import config from './config';
import logger from './utils/logger';
import sessionManager from './services/sessionManager';
// import dockerService from './services/dockerService'; // Temporarily disabled

// Load environment variables
dotenv.config();

// Graceful shutdown function
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  try {
    // Shutdown session manager
    await sessionManager.shutdown();
    
    logger.info('Graceful shutdown completed');
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: (error as Error).message,
    });
  }
  process.exit(0);
};

// Health check function
const performHealthCheck = async (): Promise<boolean> => {
  try {
    // Temporarily disable Docker health check for debugging
    // const dockerHealthy = await dockerService.healthCheck();
    const dockerHealthy = true; // Assume Docker is healthy for now
    const sessionManagerHealthy = await sessionManager.healthCheck();
    
    return dockerHealthy && sessionManagerHealthy;
  } catch (error) {
    logger.error('Health check failed', {
      error: (error as Error).message,
    });
    return false;
  }
};

// Startup function
const startServer = async (): Promise<void> => {
  try {
    // Perform initial health check
    logger.info('Performing initial health check');
    const healthy = await performHealthCheck();
    
    if (!healthy) {
      logger.error('Initial health check failed, exiting');
      process.exit(1);
    }
    
    logger.info('Initial health check passed');
    
    // Start the server
    const server = app.listen(config.port, config.host, () => {
      logger.info(`Server started successfully`, {
        port: config.port,
        host: config.host,
        environment: config.nodeEnv,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      });
      
      logger.info(`API Documentation available at: http://${config.host}:${config.port}/api-docs`);
      logger.info(`Health check available at: http://${config.host}:${config.port}/health`);
      
      if (config.monitoring.enabled) {
        logger.info(`Status monitoring available at: http://${config.host}:${config.port}/status`);
      }
    });
    
    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.syscall !== 'listen') {
        throw error;
      }
      
      switch (error.code) {
        case 'EACCES':
          logger.error(`Port ${config.port} requires elevated privileges`);
          process.exit(1);
        case 'EADDRINUSE':
          logger.error(`Port ${config.port} is already in use`);
          process.exit(1);
        default:
          throw error;
      }
    });
    
    // Setup graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
      });
      gracefulShutdown('uncaughtException');
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled promise rejection', {
        reason: reason?.message || reason,
        promise: promise.toString(),
      });
      gracefulShutdown('unhandledRejection');
    });
    
  } catch (error) {
    logger.error('Failed to start server', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    process.exit(1);
  }
};

// Start the server
startServer(); 