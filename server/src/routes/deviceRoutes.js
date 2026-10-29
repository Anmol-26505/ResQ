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
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .get(getDevices)
  .post(createDevice);

router.route('/:id')
  .get(getDeviceById)
  .patch(updateDevice)
  .delete(adminOnly, deleteDevice);

router.post('/:id/regenerate-key', regenerateApiKey);

module.exports = router;
