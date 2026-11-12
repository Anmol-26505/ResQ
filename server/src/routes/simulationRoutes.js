const express = require('express');
const router = express.Router();
const {
  toggleSimulation,
  setSimulationScenario,
  getSimulationStatus,
} = require('../controllers/simulationController');

// Publicly accessible for interactive demo on the Home page
router.get('/status', getSimulationStatus);
router.post('/toggle', toggleSimulation);
router.post('/scenario', setSimulationScenario);

module.exports = router;
