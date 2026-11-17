const express = require('express');
const router = express.Router();
const {
  controllerLogin,
  controllerLogout,
  getControllerStatus,
  activateHazard,
  deactivateHazard,
  clearAllHazards,
  getControllerDeviceStatus,
  toggleDeviceStatus,
} = require('../controllers/controllerController');
const { verifyControllerToken } = require('../middleware/controllerAuthMiddleware');

// Public controller routes
router.post('/login', controllerLogin);
router.post('/logout', controllerLogout);
router.get('/status', getControllerStatus);
router.get('/device-status', getControllerDeviceStatus);

// Protected controller mutations
router.post('/hazard/activate', verifyControllerToken, activateHazard);
router.post('/hazard/deactivate', verifyControllerToken, deactivateHazard);
router.post('/hazard/clear-all', verifyControllerToken, clearAllHazards);
router.post('/device/toggle-status', verifyControllerToken, toggleDeviceStatus);
router.post('/device/status', verifyControllerToken, toggleDeviceStatus);

module.exports = router;
