export interface Session {
  containerId: string;
  hostPort: number;
  expiresAt: number;
  timer: NodeJS.Timeout;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ContainerInfo {
  id: string;
  hostPort: number;
  status: 'running' | 'stopped' | 'removed';
}

export interface SessionRequest {
  containerId: string;
  extendByMs?: number;
  userId?: string;
}

export interface SessionResponse {
  containerId: string;
  hostPort: number;
  proxyUrl: string;
  browserUrl: string;
  expiresAt: number;
  remainingTimeMs: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  meta?: Record<string, any>;
}

export interface SessionAction {
  action: 'start' | 'stop' | 'extend' | 'cleanup';
  containerId: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  metadata?: Record<string, any>;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

export interface DockerConfig {
  image: string;
  memoryLimit: string;
  cpuLimit: number;
  shmSize: number;
  environment: string[];
  portBindings: Record<string, any>;
}

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  cors: {
    allowedOrigins: string[];
  };
  security: {
    jwtSecret: string;
    jwtExpiresIn: string;
    bcryptRounds: number;
  };
  docker: DockerConfig;
  redis: {
    url: string;
    password?: string | undefined;
    db: number;
  };
  logging: {
    level: string;
    filePath: string;
  };
  monitoring: {
    enabled: boolean;
    port: number;
  };
  sessions: {
    defaultDurationMs: number;
    maxSessions: number;
    cleanupIntervalMs: number;
    persistenceEnabled: boolean;
  };
} 