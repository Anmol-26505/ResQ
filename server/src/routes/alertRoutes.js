const express = require('express');
const router = express.Router();
const {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  resolveAlert,
  createManualAlert,
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
} = require('../controllers/alertController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');

// Incidents & Alerts (Publicly viewable, reportable & acknowledgeable)
router.get('/', optionalProtect, getAlerts);
router.post('/', optionalProtect, createManualAlert);
router.get('/:id', optionalProtect, getAlertById);
router.patch('/:id/acknowledge', optionalProtect, acknowledgeAlert);

// Protected routes
router.use(protect);
router.patch('/:id/resolve', resolveAlert);

// Alert Rules
router.get('/rules/all', getAlertRules);
router.post('/rules', createAlertRule);
router.patch('/rules/:id', updateAlertRule);
router.delete('/rules/:id', deleteAlertRule);

module.exports = router;
