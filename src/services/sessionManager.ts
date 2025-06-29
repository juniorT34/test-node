import { SessionResponse } from '../types';
import dockerService from './dockerService';
import sessionStore from '../models/sessionStore';
import config from '../config';
import logger from '../utils/logger';

class SessionManager {
  public async createSession(durationMs?: number, userId?: string): Promise<SessionResponse> {
    const startTime = Date.now();
    const sessionDuration = durationMs || config.sessions.defaultDurationMs;

    try {
      logger.info('Creating new session', { durationMs: sessionDuration, userId });

      // Check session limits
      const activeSessions = sessionStore.getActiveSessionsCount();
      if (activeSessions >= config.sessions.maxSessions) {
        throw new Error(`Maximum number of sessions (${config.sessions.maxSessions}) reached`);
      }

      // Start Docker container
      const containerInfo = await dockerService.startContainer();
      
      // Create session in store
      const session = sessionStore.createSession(
        containerInfo.id,
        containerInfo.hostPort,
        sessionDuration,
        userId
      );

      const duration = Date.now() - startTime;
      logger.info('Session created successfully', {
        containerId: containerInfo.id,
        hostPort: containerInfo.hostPort,
        duration: `${duration}ms`,
        userId,
      });

      return {
        containerId: containerInfo.id,
        hostPort: containerInfo.hostPort,
        proxyUrl: `/browser-session/${containerInfo.id}/`,
        browserUrl: `http://localhost:${containerInfo.hostPort}/`,
        expiresAt: session.expiresAt,
        remainingTimeMs: sessionDuration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to create session', {
        error: (error as Error).message,
        duration: `${duration}ms`,
        userId,
      });
      throw error;
    }
  }

  public async stopSession(containerId: string): Promise<boolean> {
    const startTime = Date.now();

    try {
      logger.info('Stopping session', { containerId });

      // Stop Docker container
      const containerStopped = await dockerService.stopContainer(containerId);
      
      // Remove from session store
      const sessionRemoved = await sessionStore.removeSession(containerId);

      const duration = Date.now() - startTime;
      logger.info('Session stopped', {
        containerId,
        containerStopped,
        sessionRemoved,
        duration: `${duration}ms`,
      });

      return containerStopped && sessionRemoved;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to stop session', {
        containerId,
        error: (error as Error).message,
        duration: `${duration}ms`,
      });
      return false;
    }
  }

  public getRemainingTime(containerId: string): number {
    return sessionStore.getRemainingTime(containerId);
  }

  public extendSession(containerId: string, extraMs: number): boolean {
    const startTime = Date.now();

    try {
      logger.info('Extending session', { containerId, extraMs });

      const session = sessionStore.getSession(containerId);
      if (!session) {
        throw new Error('Session not found');
      }

      const newExpiresAt = session.expiresAt + extraMs;
      const success = sessionStore.updateSessionExpiry(containerId, newExpiresAt);

      const duration = Date.now() - startTime;
      logger.info('Session extended', {
        containerId,
        extraMs,
        newExpiresAt: new Date(newExpiresAt).toISOString(),
        success,
        duration: `${duration}ms`,
      });

      return success;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to extend session', {
        containerId,
        extraMs,
        error: (error as Error).message,
        duration: `${duration}ms`,
      });
      return false;
    }
  }

  public getSessionInfo(containerId: string): SessionResponse | null {
    try {
      const session = sessionStore.getSession(containerId);
      if (!session) {
        return null;
      }

      const remainingTime = sessionStore.getRemainingTime(containerId);
      
      return {
        containerId: session.containerId,
        hostPort: session.hostPort,
        proxyUrl: `/browser-session/${session.containerId}/`,
        browserUrl: `http://localhost:${session.hostPort}/`,
        expiresAt: session.expiresAt,
        remainingTimeMs: remainingTime,
      };
    } catch (error) {
      logger.error('Failed to get session info', {
        containerId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  public getAllSessions(): SessionResponse[] {
    try {
      const sessions = sessionStore.getAllSessions();
      return sessions.map(session => ({
        containerId: session.containerId,
        hostPort: session.hostPort,
        proxyUrl: `/browser-session/${session.containerId}/`,
        browserUrl: `http://localhost:${session.hostPort}/`,
        expiresAt: session.expiresAt,
        remainingTimeMs: sessionStore.getRemainingTime(session.containerId),
      }));
    } catch (error) {
      logger.error('Failed to get all sessions', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  public getSessionHostPort(containerId: string): number | null {
    return sessionStore.getSessionHostPort(containerId);
  }

  public isSessionActive(containerId: string): boolean {
    return sessionStore.isSessionActive(containerId);
  }

  public async cleanupExpiredSessions(): Promise<number> {
    const startTime = Date.now();

    try {
      logger.info('Starting expired sessions cleanup');

      // Cleanup orphaned Docker containers
      const orphanedContainers = await dockerService.cleanupOrphanedContainers();
      
      // Session store cleanup is handled automatically by the store
      const sessionStats = sessionStore.getStats();

      const duration = Date.now() - startTime;
      logger.info('Cleanup completed', {
        orphanedContainers,
        activeSessions: sessionStats['activeSessions'],
        duration: `${duration}ms`,
      });

      return orphanedContainers;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to cleanup expired sessions', {
        error: (error as Error).message,
        duration: `${duration}ms`,
      });
      return 0;
    }
  }

  public getStats(): Record<string, any> {
    try {
      const sessionStats = sessionStore.getStats();
      
      return {
        ...sessionStats,
        maxSessions: config.sessions.maxSessions,
        defaultSessionDuration: config.sessions.defaultDurationMs,
        cleanupInterval: config.sessions.cleanupIntervalMs,
      };
    } catch (error) {
      logger.error('Failed to get session manager stats', {
        error: (error as Error).message,
      });
      return {};
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const dockerHealthy = await dockerService.healthCheck();
      const sessionStats = sessionStore.getStats();
      
      return dockerHealthy && sessionStats['redisConnected'] !== false;
    } catch (error) {
      logger.error('Session manager health check failed', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  public async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down session manager');
      
      // Stop all active sessions
      const sessions = sessionStore.getAllSessions();
      for (const session of sessions) {
        await this.stopSession(session.containerId);
      }
      
      // Shutdown session store
      await sessionStore.shutdown();
      
      logger.info('Session manager shutdown complete');
    } catch (error) {
      logger.error('Error during session manager shutdown', {
        error: (error as Error).message,
      });
    }
  }
}

export default new SessionManager(); 