const express = require('express');
const router = express.Router();
const {
  getDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  regenerateApiKey,
  deleteDevice,
} = require('../controllers/deviceController');
const { protect, optionalProtect, adminOnly } = require('../middleware/authMiddleware');

// Public read access for Home Page room/device selection
router.get('/', optionalProtect, getDevices);
router.get('/:id', optionalProtect, getDeviceById);

// Protected mutation routes
router.use(protect);

router.post('/', createDevice);
router.patch('/:id', updateDevice);
router.delete('/:id', adminOnly, deleteDevice);
router.post('/:id/regenerate-key', regenerateApiKey);

module.exports = router;
