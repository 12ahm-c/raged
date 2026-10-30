const request = require('supertest');
const { createApp } = require('../dist/app');
const { config } = require('../dist/config');

describe('Smoke Tests', () => {
  let app;
  let server;

  beforeAll((done) => {
    app = createApp();
    server = app.listen(0, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('Health Endpoint', () => {
    it('GET /health returns 200 with status ok', async () => {
      const res = await request(server).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('status', 'ok');
      expect(res.body.data).toHaveProperty('timestamp');
      expect(new Date(res.body.data.timestamp)).toBeInstanceOf(Date);
    });

    it('health endpoint has x-request-id header', async () => {
      const res = await request(server).get('/health');
      expect(res.headers).toHaveProperty('x-request-id');
    });
  });

  describe('App Startup', () => {
    it('express app creates without errors', () => {
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });

    it('config loads without errors', () => {
      expect(config).toHaveProperty('nodeEnv');
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('mongodbUri');
      expect(config).toHaveProperty('jwtSecret');
      expect(config).toHaveProperty('jwtRefreshSecret');
      expect(config).toHaveProperty('frontendUrl');
      expect(config).toHaveProperty('hfApiKey');
      expect(config).toHaveProperty('firebaseServiceAccountJson');
      expect(config).toHaveProperty('storagePublicBaseUrl');
      expect(config).toHaveProperty('mapsApiKey');
      expect(config).toHaveProperty('redisUrl');
    });
  });

  describe('API Versioning', () => {
    it('all routes are under /v1 prefix', async () => {
      const res = await request(server).get('/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('non-v1 routes return 404', async () => {
      const res = await request(server).get('/auth/me');
      expect(res.status).toBe(404);
    });
  });

  describe('Security Headers', () => {
    it('helmet sets security headers', async () => {
      const res = await request(server).get('/health');
      expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(res.headers).toHaveProperty('x-frame-options', 'SAMEORIGIN');
      expect(res.headers).toHaveProperty('x-xss-protection', '0');
    });

    it('cors allows configured origin', async () => {
      const res = await request(server)
        .options('/health')
        .set('Origin', config.frontendUrl)
        .set('Access-Control-Request-Method', 'GET');
      expect(res.status).toBe(204);
    });
  });

  describe('Rate Limiting', () => {
    it('global rate limiter is active', async () => {
      const res = await request(server).get('/health');
      expect(res.headers).toHaveProperty('ratelimit-limit');
    });

    it('auth endpoints have stricter rate limits', async () => {
      const res = await request(server).post('/v1/auth/login').send({});
      expect(res.headers).toHaveProperty('ratelimit-limit');
    });
  });

  describe('Request ID', () => {
    it('each request gets unique x-request-id', async () => {
      const res1 = await request(server).get('/health');
      const res2 = await request(server).get('/health');
      expect(res1.headers['x-request-id']).toBeDefined();
      expect(res2.headers['x-request-id']).toBeDefined();
      expect(res1.headers['x-request-id']).not.toBe(res2.headers['x-request-id']);
    });

    it('custom x-request-id is preserved', async () => {
      const customId = 'custom-request-id-123';
      const res = await request(server)
        .get('/health')
        .set('x-request-id', customId);
      expect(res.headers['x-request-id']).toBe(customId);
    });
  });
});