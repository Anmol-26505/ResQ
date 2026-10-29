const express = require('express');
const router = express.Router();
const {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  resolveAlert,
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
} = require('../controllers/alertController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// Incidents & Alerts
router.get('/', getAlerts);
router.get('/:id', getAlertById);
router.patch('/:id/acknowledge', acknowledgeAlert);
router.patch('/:id/resolve', resolveAlert);

// Alert Rules
router.get('/rules/all', getAlertRules);
router.post('/rules', createAlertRule);
router.patch('/rules/:id', updateAlertRule);
router.delete('/rules/:id', deleteAlertRule);

module.exports = router;
