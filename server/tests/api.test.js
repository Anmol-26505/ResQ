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

  test('1. Health check returns healthy status on /api/health and /health', async () => {
    const resApi = await request(app).get('/api/health');
    assert.equal(resApi.status, 200);
    assert.equal(resApi.body.status, 'healthy');
    assert.equal(resApi.body.version, '1.0.0');

    const resRoot = await request(app).get('/health');
    assert.equal(resRoot.status, 200);
    assert.equal(resRoot.body.status, 'healthy');
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

  test('12. Ingest NodeMCU payload with MPU6050, Ultrasonic, and MQ2', async () => {
    const res = await request(app)
      .post('/api/iot/readings')
      .set('x-api-key', testApiKey)
      .send({
        deviceId: testDeviceId,
        temperature: 26.2,
        humidity: 48.0,
        mq2: 145,
        flame: false,
        ax: 0.05,
        ay: 0.12,
        az: 0.98,
        gx: 1.2,
        gy: 0.8,
        gz: -0.4,
        tiltAngle: 4.5,
        distance: 75.3,
        water: false,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.readingId);

    // Verify reading stored MPU6050 and distance
    const saved = await SensorReading.findById(res.body.readingId);
    assert.ok(saved);
    assert.equal(saved.gas, 145);
    assert.equal(saved.distance, 75.3);
    assert.equal(saved.tiltAngle, 4.5);
    assert.equal(saved.mpu6050.az, 0.98);
  });

  test('13. GET /api/iot/latest retrieves latest sensor readings', async () => {
    const res = await request(app)
      .get(`/api/iot/latest?deviceId=${testDeviceId}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.deviceId, testDeviceId);
    assert.ok(res.body.reading);
    assert.equal(res.body.reading.distance, 75.3);
  });

  test('14. GET /api/iot/hazard-status retrieves consolidated hazard status', async () => {
    const res = await request(app).get('/api/iot/hazard-status');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.hazards);
    assert.ok(res.body.hazards.fire);
    assert.ok(res.body.hazards.smokeAndGas);
    assert.ok(res.body.hazards.earthquake);
    assert.ok(res.body.hazards.tilt);
    assert.ok(res.body.hazards.waterLeakage);
    assert.equal(res.body.hazards.occupancy, undefined);
  });

  test('15. POST /api/alerts receives and processes manual/edge alert', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .send({
        deviceId: testDeviceId,
        title: 'Emergency Earthquake Detection',
        message: 'High amplitude seismic shock registered by accelerometer',
        severity: 'critical',
        sensorType: 'earthquake',
        readingValue: 2.8,
        thresholdValue: 1.2,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.alert.severity, 'critical');
    assert.equal(res.body.alert.sensorType, 'earthquake');
  });

  test('16. POST /api/sensors/update receives NodeMCU 5-sensor live payload', async () => {
    const res = await request(app)
      .post('/api/sensors/update')
      .set('x-api-key', testApiKey)
      .send({
        deviceId: testDeviceId,
        gas: 155,
        smoke: 155,
        flame: false,
        distance: 42.6,
        tiltAngle: 2.8,
        vibration: 0.08,
        tilt: false,
        earthquake: false,
        water: false,
        ax: 0.02,
        ay: 0.05,
        az: 0.99,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.readingId);

    const saved = await SensorReading.findById(res.body.readingId);
    assert.ok(saved);
    assert.equal(saved.distance, 42.6);
    assert.equal(saved.gas, 155);
    assert.equal(saved.tiltAngle, 2.8);
  });

  test('17. GET /api/sensors/latest returns current live telemetry', async () => {
    const res = await request(app).get('/api/sensors/latest');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.latestReading);
    assert.equal(res.body.latestReading.distance, 42.6);
  });

  test('18. POST /api/alerts/test-telegram requires authorization and returns configuration status', async () => {
    // Rejected without token
    const unauthRes = await request(app).post('/api/alerts/test-telegram');
    assert.equal(unauthRes.status, 401);

    // Authorized call
    const authRes = await request(app)
      .post('/api/alerts/test-telegram')
      .set('Authorization', `Bearer ${authToken}`);

    // Since TELEGRAM_BOT_TOKEN is not in local test env, it gracefully reports 400 not configured
    // or 200 if credentials were set
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      assert.equal(authRes.status, 400);
      assert.equal(authRes.body.success, false);
      assert.match(authRes.body.message, /Telegram is not configured/);
    } else {
      assert.ok([200, 502].includes(authRes.status));
    }
  });

  test('19. Stationary MPU6050 accelerometer readings reject resting baseline noise', async () => {
    // Stationary sensor reading: ax=0.03, ay=0.05, az=0.98 (|a|=0.982g, dev=0.018g)
    const res = await request(app)
      .post('/api/sensors/update')
      .set('x-api-key', testApiKey)
      .send({
        deviceId: testDeviceId,
        ax: 0.03,
        ay: 0.05,
        az: 0.98,
        tiltAngle: 2.1,
      });

    assert.equal(res.status, 201);
    const reading = await SensorReading.findById(res.body.readingId);
    assert.ok(reading);
    // Dynamic noise floor filtering keeps vibration clamped to nominal 0.04g resting baseline
    assert.equal(reading.vibration, 0.04);
    assert.equal(reading.earthquake, false);
    assert.equal(reading.tilt, false);
  });

  test('20. Transient tilt angle spike is rejected by persistence filter', async () => {
    // Single transient spike (e.g. 18.5 degrees) should NOT trigger tilt on first reading
    const spikeRes = await request(app)
      .post('/api/sensors/update')
      .set('x-api-key', testApiKey)
      .send({
        deviceId: testDeviceId,
        tiltAngle: 18.5,
      });

    assert.equal(spikeRes.status, 201);
    const spikeReading = await SensorReading.findById(spikeRes.body.readingId);
    assert.ok(spikeReading);
    assert.equal(spikeReading.tilt, false, 'Single transient spike must not trigger confirmed tilt');

    // Second consecutive reading confirming tilt DOES trigger confirmed tilt
    const sustainedRes = await request(app)
      .post('/api/sensors/update')
      .set('x-api-key', testApiKey)
      .send({
        deviceId: testDeviceId,
        tiltAngle: 19.2,
      });

    assert.equal(sustainedRes.status, 201);
    const sustainedReading = await SensorReading.findById(sustainedRes.body.readingId);
    assert.ok(sustainedReading);
    assert.equal(sustainedReading.tilt, true, 'Sustained tilt persisting across consecutive readings confirms tilt');
  });

  test('21. End-to-end Fire Hazard: flame=true is saved and retrieved via GET /api/sensors/latest', async () => {
    await AlertRule.create({
      name: 'Critical Fire Detection Rule',
      deviceId: 'ALL',
      sensorType: 'flame',
      operator: '==',
      thresholdValue: true,
      severity: 'critical',
      isEnabled: true,
    });

    const res = await request(app)
      .post('/api/sensors/update')
      .set('x-api-key', testApiKey)
      .send({
        deviceId: testDeviceId,
        flame: true,
        gas: 110,
        tilt: false,
        earthquake: false,
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.alertsTriggered >= 1, 'Fire must trigger critical alert');

    const latestRes = await request(app)
      .get(`/api/sensors/latest?deviceId=${testDeviceId}`)
      .set('x-api-key', testApiKey);

    assert.equal(latestRes.status, 200);
    const reading = latestRes.body.latestReading || latestRes.body.reading;
    assert.ok(reading);
    assert.equal(reading.flame, true, 'flame must be true in latest reading');
  });

  test('22. End-to-end Gas Hazard: gas=450 triggers alert and is retrieved via GET /api/sensors/latest', async () => {
    await AlertRule.create({
      name: 'Toxic Gas Detection Rule',
      deviceId: 'ALL',
      sensorType: 'gas',
      operator: '>',
      thresholdValue: 200,
      severity: 'critical',
      isEnabled: true,
    });

    const res = await request(app)
      .post('/api/sensors/update')
      .set('x-api-key', testApiKey)
      .send({
        deviceId: testDeviceId,
        flame: false,
        gas: 450,
        smoke: 450,
        tilt: false,
        earthquake: false,
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.alertsTriggered >= 1, 'Gas > 200 must trigger gas alert');

    const latestRes = await request(app)
      .get(`/api/sensors/latest?deviceId=${testDeviceId}`);

    assert.equal(latestRes.status, 200);
    const reading = latestRes.body.latestReading || latestRes.body.reading;
    assert.ok(reading);
    assert.equal(reading.gas, 450, 'gas must be 450 in latest reading');
  });

  test('23. End-to-end Tilt Hazard: tilt=true triggers alert and is retrieved via GET /api/sensors/latest', async () => {
    await AlertRule.create({
      name: 'Structural Tilt Rule',
      deviceId: 'ALL',
      sensorType: 'tilt',
      operator: '==',
      thresholdValue: true,
      severity: 'critical',
      isEnabled: true,
    });

    const res = await request(app)
      .post('/api/sensors/update')
      .set('x-api-key', testApiKey)
      .send({
        deviceId: testDeviceId,
        flame: false,
        gas: 100,
        tilt: true,
        tiltAngle: 24.5,
        earthquake: false,
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.alertsTriggered >= 1, 'Tilt must trigger tilt alert');

    const latestRes = await request(app)
      .get(`/api/sensors/latest?deviceId=${testDeviceId}`);

    assert.equal(latestRes.status, 200);
    const reading = latestRes.body.latestReading || latestRes.body.reading;
    assert.ok(reading);
    assert.equal(reading.tilt, true, 'tilt must be true in latest reading');
    assert.equal(reading.tiltAngle, 24.5, 'tiltAngle must be 24.5 in latest reading');
  });

  test('24. End-to-end Earthquake Hazard: earthquake=true triggers alert and is retrieved via GET /api/sensors/latest', async () => {
    await Alert.deleteMany({ deviceId: testDeviceId, sensorType: 'earthquake' });
    await AlertRule.create({
      name: 'Earthquake Seismic Rule',
      deviceId: 'ALL',
      sensorType: 'earthquake',
      operator: '==',
      thresholdValue: true,
      severity: 'critical',
      cooldownMinutes: 0,
      isEnabled: true,
    });

    const res = await request(app)
      .post('/api/sensors/update')
      .set('x-api-key', testApiKey)
      .send({
        deviceId: testDeviceId,
        flame: false,
        gas: 100,
        tilt: false,
        earthquake: true,
        vibration: 1.85,
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.alertsTriggered >= 1, 'Earthquake must trigger earthquake alert');

    const latestRes = await request(app)
      .get(`/api/sensors/latest?deviceId=${testDeviceId}`);

    assert.equal(latestRes.status, 200);
    const reading = latestRes.body.latestReading || latestRes.body.reading;
    assert.ok(reading);
    assert.equal(reading.earthquake, true, 'earthquake must be true in latest reading');
    assert.equal(reading.vibration, 1.85, 'vibration must be 1.85 in latest reading');
  });

  test('25. Idempotent retry: Resending same sequence number returns databaseSaved: true without duplicate insertion', async () => {
    const testSeq = 999;
    // Initial post
    const res1 = await request(app)
      .post('/api/sensors/update')
      .set('x-api-key', testApiKey)
      .send({
        deviceId: testDeviceId,
        seq: testSeq,
        gas: 120,
      });

    assert.equal(res1.status, 201);
    assert.equal(res1.body.success, true);
    assert.equal(res1.body.databaseSaved, true);
    assert.equal(res1.body.saved, true);
    assert.equal(res1.body.sequenceNumber, testSeq);

    const countBefore = await SensorReading.countDocuments({ deviceId: testDeviceId, seq: testSeq });
    assert.equal(countBefore, 1);

    // Retried post with identical sequence number
    const res2 = await request(app)
      .post('/api/sensors/update')
      .set('x-api-key', testApiKey)
      .send({
        deviceId: testDeviceId,
        seq: testSeq,
        gas: 120,
      });

    assert.equal(res2.status, 200);
    assert.equal(res2.body.success, true);
    assert.equal(res2.body.databaseSaved, true);
    assert.equal(res2.body.saved, true);
    assert.equal(res2.body.isDuplicate, true);
    assert.equal(res2.body.sequenceNumber, testSeq);

    const countAfter = await SensorReading.countDocuments({ deviceId: testDeviceId, seq: testSeq });
    assert.equal(countAfter, 1, 'Duplicate record must not be created on retry');
  });

  test('26. GET /api/sensors/latest returns databaseSaved: true and consistent sequence numbers', async () => {
    const res = await request(app).get(`/api/sensors/latest?deviceId=${testDeviceId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.databaseSaved, true);
    assert.ok(res.body.sequenceNumber >= 999);
    assert.ok(res.body.latestReading);
    assert.ok(res.body.lastSavedAt);
    // Live status must be a computed field, not stale DB value
    assert.ok(['online', 'offline', 'unknown'].includes(res.body.deviceStatus), 'deviceStatus must be online/offline/unknown');
    assert.ok(res.body.secondsSinceLastSeen !== undefined, 'secondsSinceLastSeen must be present');
    assert.ok(typeof res.body.isOnline === 'boolean', 'isOnline must be boolean');
    // Device just posted data, so it should be online
    assert.equal(res.body.isOnline, true, 'Device should be online after recent POST');
    assert.equal(res.body.deviceStatus, 'online', 'deviceStatus should be online after recent POST');
  });

  test('27. GET /api/devices/:id/status returns live device heartbeat status', async () => {
    const res = await request(app)
      .get(`/api/devices/${testDeviceId}/status`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.deviceId, testDeviceId);
    assert.ok(['online', 'offline', 'unknown'].includes(res.body.status), 'status must be online/offline/unknown');
    assert.ok(typeof res.body.isOnline === 'boolean', 'isOnline must be boolean');
    assert.ok(res.body.secondsSinceLastSeen !== undefined, 'secondsSinceLastSeen must be present');
    // Device just posted data in test 25, so it should be online (lastSeenAt < 30s ago)
    assert.equal(res.body.isOnline, true, 'Device should be online after recent sensor POST');
    assert.equal(res.body.status, 'online', 'status should be online after recent POST');
  });

  // -------------------------------------------------------------
  // Remote Manual Hazard Controller Tests
  // -------------------------------------------------------------
  let controllerToken = '';

  test('28. Controller Login: rejects invalid credentials', async () => {
    const res = await request(app)
      .post('/api/controller/login')
      .send({
        username: 'WrongUser',
        password: 'WrongPassword',
      });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('29. Controller Login: authenticates Anmol / Anmol26 and returns JWT', async () => {
    const res = await request(app)
      .post('/api/controller/login')
      .send({
        username: 'Anmol',
        password: 'Anmol26',
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    assert.equal(res.body.user.username, 'Anmol');
    assert.equal(res.body.user.role, 'controller');
    // Ensure no password or hash is exposed
    assert.equal(res.body.password, undefined);
    assert.equal(res.body.passwordHash, undefined);
    controllerToken = res.body.token;
  });

  test('30. Controller Status API: returns standardized state for all 5 hazards', async () => {
    const res = await request(app).get('/api/controller/status');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.hazards);
    assert.ok(res.body.hazards.fire !== undefined);
    assert.ok(res.body.hazards.water !== undefined);
    assert.ok(res.body.hazards.tilt !== undefined);
    assert.ok(res.body.hazards.earthquake !== undefined);
    assert.ok(res.body.hazards.gas !== undefined);
  });

  test('31. Controller Hazard Activation: rejected without auth token', async () => {
    const res = await request(app)
      .post('/api/controller/hazard/activate')
      .send({ hazard: 'fire' });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('32. Controller Hazard Activation: activates FIRE hazard and creates active Alert', async () => {
    const res = await request(app)
      .post('/api/controller/hazard/activate')
      .set('Authorization', `Bearer ${controllerToken}`)
      .send({ hazard: 'fire' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.state.hazards.fire.isActive, true);

    // Verify consolidated hazard status endpoint now includes manual fire
    const statusRes = await request(app).get('/api/sensors/hazards');
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.body.hazards.fire.detected, true);
  });

  test('33. Multiple Simultaneous Hazards: activating GAS while FIRE is active keeps both active', async () => {
    const res = await request(app)
      .post('/api/controller/hazard/activate')
      .set('Authorization', `Bearer ${controllerToken}`)
      .send({ hazard: 'gas' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.state.hazards.gas.isActive, true);
    assert.equal(res.body.state.hazards.fire.isActive, true, 'FIRE must remain active when GAS is activated');
    assert.ok(res.body.state.activeCount >= 2);
  });

  test('34. Activate all 5 hazards simultaneously', async () => {
    await request(app)
      .post('/api/controller/hazard/activate')
      .set('Authorization', `Bearer ${controllerToken}`)
      .send({ hazard: 'water' });

    await request(app)
      .post('/api/controller/hazard/activate')
      .set('Authorization', `Bearer ${controllerToken}`)
      .send({ hazard: 'tilt' });

    const res = await request(app)
      .post('/api/controller/hazard/activate')
      .set('Authorization', `Bearer ${controllerToken}`)
      .send({ hazard: 'earthquake' });

    assert.equal(res.status, 200);
    assert.equal(res.body.state.hazards.fire.isActive, true);
    assert.equal(res.body.state.hazards.water.isActive, true);
    assert.equal(res.body.state.hazards.tilt.isActive, true);
    assert.equal(res.body.state.hazards.earthquake.isActive, true);
    assert.equal(res.body.state.hazards.gas.isActive, true);
    assert.equal(res.body.state.activeCount, 5);
  });

  test('35. Deactivate FIRE only: other 4 hazards remain active', async () => {
    const res = await request(app)
      .post('/api/controller/hazard/deactivate')
      .set('Authorization', `Bearer ${controllerToken}`)
      .send({ hazard: 'fire' });

    assert.equal(res.status, 200);
    assert.equal(res.body.state.hazards.fire.isActive, false);
    assert.equal(res.body.state.hazards.water.isActive, true);
    assert.equal(res.body.state.hazards.tilt.isActive, true);
    assert.equal(res.body.state.hazards.earthquake.isActive, true);
    assert.equal(res.body.state.hazards.gas.isActive, true);
    assert.equal(res.body.state.activeCount, 4);
  });

  test('36. Clear All Manual Hazards: deactivates all manual alerts without clearing physical sensors', async () => {
    const res = await request(app)
      .post('/api/controller/hazard/clear-all')
      .set('Authorization', `Bearer ${controllerToken}`)
      .send();

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.state.activeCount, 0);
    assert.equal(res.body.state.hazards.fire.isActive, false);
    assert.equal(res.body.state.hazards.water.isActive, false);
    assert.equal(res.body.state.hazards.tilt.isActive, false);
    assert.equal(res.body.state.hazards.earthquake.isActive, false);
    assert.equal(res.body.state.hazards.gas.isActive, false);
  });
});
