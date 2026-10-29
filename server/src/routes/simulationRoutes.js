const express = require('express');
const router = express.Router();
const {
  toggleSimulation,
  setSimulationScenario,
  getSimulationStatus,
} = require('../controllers/simulationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/status', getSimulationStatus);
router.post('/toggle', toggleSimulation);
router.post('/scenario', setSimulationScenario);

module.exports = router;
