import Redis from 'ioredis';
import { Session } from '../types';
import config from '../config';
import logger from '../utils/logger';

class SessionStore {
  private sessions: Map<string, Session> = new Map();
  private redis: Redis | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeRedis();
    this.startCleanupInterval();
  }

  private async initializeRedis(): Promise<void> {
    if (!config.sessions.persistenceEnabled) {
      logger.info('Session persistence disabled, using in-memory storage only');
      return;
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
      this.redis = new Redis(config.redis.url, redisOptions);

      this.redis.on('connect', () => {
        logger.info('Connected to Redis for session persistence');
      });

      this.redis.on('error', (error) => {
        logger.error('Redis connection error', { error: error.message });
      });

      await this.redis.connect();
      await this.loadSessionsFromRedis();
    } catch (error) {
      logger.error('Failed to initialize Redis', { error: (error as Error).message });
      this.redis = null;
    }
  }

  private async loadSessionsFromRedis(): Promise<void> {
    if (!this.redis) return;

    try {
      const sessionKeys = await this.redis.keys('session:*');
      for (const key of sessionKeys) {
        const sessionData = await this.redis.get(key);
        if (sessionData) {
          const session: Session = JSON.parse(sessionData);
          // Only load sessions that haven't expired
          if (session.expiresAt > Date.now()) {
            this.sessions.set(session.containerId, session);
          } else {
            await this.redis.del(key);
          }
        }
      }
      logger.info(`Loaded ${this.sessions.size} sessions from Redis`);
    } catch (error) {
      logger.error('Failed to load sessions from Redis', { error: (error as Error).message });
    }
  }

  private async persistSession(session: Session): Promise<void> {
    if (!this.redis) return;

    try {
      const key = `session:${session.containerId}`;
      await this.redis.setex(key, Math.ceil((session.expiresAt - Date.now()) / 1000), JSON.stringify(session));
    } catch (error) {
      logger.error('Failed to persist session', { 
        containerId: session.containerId, 
        error: (error as Error).message 
      });
    }
  }

  private async removeSessionFromRedis(containerId: string): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.del(`session:${containerId}`);
    } catch (error) {
      logger.error('Failed to remove session from Redis', { 
        containerId, 
        error: (error as Error).message 
      });
    }
  }

  public createSession(containerId: string, hostPort: number, durationMs: number, userId?: string): Session {
    const expiresAt = Date.now() + durationMs;
    const session: Session = {
      containerId,
      hostPort,
      expiresAt,
      timer: setTimeout(() => {
        this.removeSession(containerId);
      }, durationMs),
      ...(userId ? { userId } : {}),
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: userId || 'anonymous',
      },
    };
    this.sessions.set(containerId, session);
    this.persistSession(session);
    logger.info('Session created', {
      containerId,
      hostPort,
      durationMs,
      userId,
      expiresAt: new Date(expiresAt).toISOString(),
    });
    return session;
  }

  public getSession(containerId: string): Session | undefined {
    return this.sessions.get(containerId);
  }

  public getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  public getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  public async removeSession(containerId: string): Promise<boolean> {
    const session = this.sessions.get(containerId);
    if (!session) return false;

    clearTimeout(session.timer);
    this.sessions.delete(containerId);
    await this.removeSessionFromRedis(containerId);

    logger.info('Session removed', { containerId, userId: session.userId });
    return true;
  }

  public updateSessionExpiry(containerId: string, newExpiresAt: number): boolean {
    const session = this.sessions.get(containerId);
    if (!session) return false;

    clearTimeout(session.timer);
    session.expiresAt = newExpiresAt;
    session.timer = setTimeout(() => {
      this.removeSession(containerId);
    }, newExpiresAt - Date.now());

    this.persistSession(session);

    logger.info('Session expiry updated', {
      containerId,
      newExpiresAt: new Date(newExpiresAt).toISOString(),
    });

    return true;
  }

  public getRemainingTime(containerId: string): number {
    const session = this.sessions.get(containerId);
    if (!session) return 0;
    return Math.max(0, session.expiresAt - Date.now());
  }

  public getSessionHostPort(containerId: string): number | null {
    const session = this.sessions.get(containerId);
    return session?.hostPort || null;
  }

  public isSessionActive(containerId: string): boolean {
    const session = this.sessions.get(containerId);
    return session ? session.expiresAt > Date.now() : false;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, config.sessions.cleanupIntervalMs);
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const expiredSessions = Array.from(this.sessions.values()).filter(
      session => session.expiresAt <= now
    );

    for (const session of expiredSessions) {
      await this.removeSession(session.containerId);
    }

    if (expiredSessions.length > 0) {
      logger.info('Cleaned up expired sessions', { count: expiredSessions.length });
    }
  }

  public async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.redis) {
      await this.redis.quit();
    }

    // Clear all timers
    for (const session of this.sessions.values()) {
      clearTimeout(session.timer);
    }

    this.sessions.clear();
    logger.info('Session store shutdown complete');
  }

  public getStats(): Record<string, any> {
    return {
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(s => s.expiresAt > Date.now()).length,
      redisConnected: this.redis?.status === 'ready',
      persistenceEnabled: config.sessions.persistenceEnabled,
    };
  }
}

export default new SessionStore(); 