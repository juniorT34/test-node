import dotenv from 'dotenv';
import { AppConfig } from '../types';

dotenv.config();

const config: AppConfig = {
  port: parseInt(process.env['PORT'] || '4000', 10),
  host: process.env['HOST'] || '0.0.0.0',
  nodeEnv: process.env['NODE_ENV'] || 'development',
  
  cors: {
    allowedOrigins: process.env['ALLOWED_ORIGINS']?.split(',') || ['http://localhost:3000'],
  },
  
  security: {
    jwtSecret: process.env['JWT_SECRET'] || 'your-super-secret-jwt-key-change-in-production',
    jwtExpiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
    bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] || '12', 10),
  },
  
  docker: {
    image: process.env['BROWSER_IMAGE'] || 'linuxserver/firefox:latest',
    memoryLimit: process.env['CONTAINER_MEMORY_LIMIT'] || '2g',
    cpuLimit: parseFloat(process.env['CONTAINER_CPU_LIMIT'] || '1.0'),
    shmSize: 1073741824, // 1GB
    environment: [
      'PUID=1000',
      'PGID=1000',
      'TZ=Etc/UTC',
    ],
    portBindings: {
      '3000/tcp': [{}],
      '3001/tcp': [{}],
    },
  },
  
  redis: {
    url: process.env['REDIS_URL'] || 'redis://localhost:6379',
    password: process.env['REDIS_PASSWORD'] || undefined,
    db: parseInt(process.env['REDIS_DB'] || '0', 10),
  },
  
  logging: {
    level: process.env['LOG_LEVEL'] || 'info',
    filePath: process.env['LOG_FILE_PATH'] || 'logs/app.log',
  },
  
  monitoring: {
    enabled: process.env['ENABLE_MONITORING'] === 'true',
    port: parseInt(process.env['MONITORING_PORT'] || '4001', 10),
  },
  
  sessions: {
    defaultDurationMs: parseInt(process.env['DEFAULT_SESSION_MS'] || '300000', 10),
    maxSessions: parseInt(process.env['MAX_SESSIONS'] || '10', 10),
    cleanupIntervalMs: parseInt(process.env['SESSION_CLEANUP_INTERVAL_MS'] || '300000', 10),
    persistenceEnabled: process.env['SESSION_PERSISTENCE_ENABLED'] === 'true',
  },
};

export default config; 