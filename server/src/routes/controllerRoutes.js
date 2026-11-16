const express = require('express');
const router = express.Router();
const {
  controllerLogin,
  controllerLogout,
  getControllerStatus,
  activateHazard,
  deactivateHazard,
  clearAllHazards,
} = require('../controllers/controllerController');
const { verifyControllerToken } = require('../middleware/controllerAuthMiddleware');

// Public controller routes
router.post('/login', controllerLogin);
router.post('/logout', controllerLogout);
router.get('/status', getControllerStatus);

// Protected controller mutations
router.post('/hazard/activate', verifyControllerToken, activateHazard);
router.post('/hazard/deactivate', verifyControllerToken, deactivateHazard);
router.post('/hazard/clear-all', verifyControllerToken, clearAllHazards);

module.exports = router;
