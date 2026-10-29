const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Device = require('../src/models/Device');
const AlertRule = require('../src/models/AlertRule');
const Alert = require('../src/models/Alert');
const SensorReading = require('../src/models/SensorReading');

describe('ResQ Backend API Suite', () => {
  let authToken = '';
  let testDeviceId = 'RESQ-TEST-01';
  let testApiKey = 'resq_dev_test_secret_123';

  before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    await User.deleteMany({});
    await Device.deleteMany({});
    await AlertRule.deleteMany({});
    await Alert.deleteMany({});
    await SensorReading.deleteMany({});
  });

  after(async () => {
    await disconnectDB();
  });

  test('1. Health check returns healthy status', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
    assert.equal(res.body.version, '1.0.0');
  });

  test('2. User registration generates valid JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Lead Safety Engineer',
        email: 'engineer@resq.internal',
        password: 'securePassword123!',
        role: 'admin',
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'engineer@resq.internal');
    assert.equal(res.body.user.role, 'admin');
    authToken = res.body.token;
  });

  test('3. Login verifies password and issues token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'engineer@resq.internal',
        password: 'securePassword123!',
      });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'engineer@resq.internal');
  });

  test('4. Login rejects invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'engineer@resq.internal',
        password: 'wrongPassword',
      });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('5. GET /api/auth/me returns authenticated user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'engineer@resq.internal');
  });

  test('6. Register a new IoT device via API', async () => {
    const res = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        deviceId: testDeviceId,
        name: 'Test Environmental Node',
        location: 'Lab Room 3B',
        deviceType: 'NodeMCU ESP8266',
        supportedSensors: ['temperature', 'humidity', 'gas', 'flame'],
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.device.deviceId, testDeviceId);
    assert.ok(res.body.device.apiKey);
    testApiKey = res.body.device.apiKey;
  });

  test('7. IoT Telemetry rejected without API Key', async () => {
    const res = await request(app)
      .post('/api/iot/readings')
      .send({
        deviceId: testDeviceId,
        temperature: 25.0,
      });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('8. IoT Telemetry rejected with incorrect API Key', async () => {
    const res = await request(app)
      .post('/api/iot/readings')
      .set('x-api-key', 'invalid_random_key')
      .send({
        deviceId: testDeviceId,
        temperature: 25.0,
      });

    assert.equal(res.status, 401);
  });

  test('9. Ingest valid IoT sensor telemetry from device', async () => {
    const res = await request(app)
      .post('/api/iot/readings')
      .set('x-api-key', testApiKey)
      .send({
        deviceId: testDeviceId,
        temperature: 24.8,
        humidity: 50.2,
        gas: 82,
        flame: false,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.readingId);
  });

  test('10. Threshold breach triggers automated alert', async () => {
    // Create an alert rule for high temperature (> 45 C)
    await AlertRule.create({
      name: 'Test High Heat Rule',
      deviceId: 'ALL',
      sensorType: 'temperature',
      operator: '>',
      thresholdValue: 45,
      severity: 'critical',
      cooldownMinutes: 1,
    });

    // Send a critical reading of 55 C
    const res = await request(app)
      .post('/api/iot/readings')
      .set('x-api-key', testApiKey)
      .send({
        deviceId: testDeviceId,
        temperature: 55.4,
        humidity: 30.0,
        gas: 90,
        flame: false,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.alertsTriggered, 1);

    // Verify alert exists in database
    const alert = await Alert.findOne({ deviceId: testDeviceId, status: 'active' });
    assert.ok(alert);
    assert.equal(alert.severity, 'critical');
    assert.equal(alert.readingValue, 55.4);
  });

  test('11. Operator acknowledges alert incident', async () => {
    const alert = await Alert.findOne({ deviceId: testDeviceId, status: 'active' });
    assert.ok(alert);

    const res = await request(app)
      .patch(`/api/alerts/${alert._id}/acknowledge`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ note: 'Field technician inspecting overheating server.' });

    assert.equal(res.status, 200);
    assert.equal(res.body.alert.status, 'acknowledged');
    assert.equal(res.body.alert.acknowledgeNotes, 'Field technician inspecting overheating server.');
  });
});
