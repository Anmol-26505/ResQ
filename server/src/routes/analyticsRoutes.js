const express = require('express');
const router = express.Router();
const {
  getOverviewStats,
  getHistoricalReadings,
  getIncidentStats,
  getDeviceHealth,
  exportCsv,
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/overview', getOverviewStats);
router.get('/readings', getHistoricalReadings);
router.get('/incidents', getIncidentStats);
router.get('/device-health', getDeviceHealth);
router.get('/export-csv', exportCsv);

module.exports = router;
