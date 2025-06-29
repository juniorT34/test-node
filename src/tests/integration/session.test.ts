import request from 'supertest';
import app from '../../app';
import sessionManager from '../../services/sessionManager';
// import dockerService from '../../services/dockerService';

describe('Session Management API', () => {
  beforeEach(async () => {
    // Clean up any existing sessions
    const sessions = sessionManager.getAllSessions();
    for (const session of sessions) {
      await sessionManager.stopSession(session.containerId);
    }
  });

  afterAll(async () => {
    // Clean up after all tests
    await sessionManager.shutdown();
  });

  describe('POST /api/browser/start-session', () => {
    it('should create a new session successfully', async () => {
      const response = await request(app)
        .post('/api/browser/start-session')
        .send({
          durationMs: 300000, // 5 minutes
          userId: 'test-user',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('containerId');
      expect(response.body.data).toHaveProperty('hostPort');
      expect(response.body.data).toHaveProperty('proxyUrl');
      expect(response.body.data).toHaveProperty('expiresAt');
      expect(response.body.data).toHaveProperty('remainingTimeMs');
    });

    it('should validate duration limits', async () => {
      const response = await request(app)
        .post('/api/browser/start-session')
        .send({
          durationMs: 1000, // Too short
          userId: 'test-user',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle missing optional parameters', async () => {
      const response = await request(app)
        .post('/api/browser/start-session')
        .send({})
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('containerId');
    });
  });

  describe('POST /api/browser/stop-session', () => {
    it('should stop an active session', async () => {
      // First create a session
      const createResponse = await request(app)
        .post('/api/browser/start-session')
        .send({ durationMs: 300000 });

      const containerId = createResponse.body.data.containerId;

      // Then stop it
      const response = await request(app)
        .post('/api/browser/stop-session')
        .send({ containerId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stopped).toBe(true);
    });

    it('should handle non-existent session', async () => {
      const response = await request(app)
        .post('/api/browser/stop-session')
        .send({ containerId: 'non-existent-id' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stopped).toBe(true);
      expect(response.body.message).toMatch(/already stopped|does not exist/i);
    });

    it('should validate container ID', async () => {
      const response = await request(app)
        .post('/api/browser/stop-session')
        .send({ containerId: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/browser/remaining-time', () => {
    it('should get remaining time for active session', async () => {
      // First create a session
      const createResponse = await request(app)
        .post('/api/browser/start-session')
        .send({ durationMs: 300000 });

      const containerId = createResponse.body.data.containerId;

      // Then get remaining time
      const response = await request(app)
        .get('/api/browser/remaining-time')
        .query({ containerId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('remainingTimeMs');
      expect(response.body.data.remainingTimeMs).toBeGreaterThan(0);
    });

    it('should handle non-existent session', async () => {
      const response = await request(app)
        .get('/api/browser/remaining-time')
        .query({ containerId: 'non-existent-id' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session not found or already expired');
    });
  });

  describe('POST /api/browser/extend-session', () => {
    it('should extend an active session', async () => {
      // First create a session
      const createResponse = await request(app)
        .post('/api/browser/start-session')
        .send({ durationMs: 300000 });

      const containerId = createResponse.body.data.containerId;

      // Then extend it
      const response = await request(app)
        .post('/api/browser/extend-session')
        .send({
          containerId,
          extendByMs: 60000, // 1 minute
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.extended).toBe(true);
      expect(response.body.data.extendByMs).toBe(60000);
    });

    it('should handle non-existent session', async () => {
      const response = await request(app)
        .post('/api/browser/extend-session')
        .send({
          containerId: 'non-existent-id',
          extendByMs: 60000,
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session not found or already expired');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version');
    });
  });
}); 