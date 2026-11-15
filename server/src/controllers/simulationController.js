const simulationService = require('../services/simulationService');

// @desc    Toggle simulation state
// @route   POST /api/simulation/toggle
// @access  Private
const toggleSimulation = async (req, res, next) => {
  try {
    const { action, interval = 3000, scenario = 'nominal' } = req.body;
    const currentStatus = simulationService.getStatus();

    if (action === 'start' || (!action && !currentStatus.isRunning)) {
      simulationService.setScenario(scenario);
      simulationService.startSimulation(interval);
    } else {
      simulationService.stopSimulation();
    }

    res.json({
      success: true,
      simulation: simulationService.getStatus(),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Trigger a specific emergency simulation scenario
// @route   POST /api/simulation/scenario
// @access  Private
const setSimulationScenario = async (req, res, next) => {
  try {
    const { scenario } = req.body;
    const validScenarios = [
      'nominal',
      'fire_hazard',
      'fire',
      'smoke_leak',
      'smoke',
      'gas_leak',
      'earthquake',
      'tilt',
      'water_leak',
      'water',
      'crowded_room',
      'person_count',
      'high_heat',
      'all_hazards',
    ];
    if (!validScenarios.includes(scenario)) {
      return res.status(400).json({
        success: false,
        message: `Invalid scenario. Allowed: ${validScenarios.join(', ')}`,
      });
    }

    const currentStatus = simulationService.getStatus();
    if (!currentStatus.isRunning) {
      simulationService.startSimulation(3000);
    }

    simulationService.setScenario(scenario);

    // If clearing simulation to nominal, auto-resolve all simulated alerts and stop simulation loop
    if (scenario === 'nominal') {
      const Alert = require('../models/Alert');
      await Alert.updateMany(
        { isSimulated: true, status: 'active' },
        { status: 'resolved', resolvedAt: new Date(), resolutionNotes: 'Simulation scenario reset to nominal/safe' }
      );
      simulationService.stopSimulation();
    }

    // Trigger an immediate tick with this scenario
    await simulationService.runSimulationTick();

    res.json({
      success: true,
      message: `Triggered simulation scenario: ${scenario}`,
      simulation: simulationService.getStatus(),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current simulation status
// @route   GET /api/simulation/status
// @access  Private
const getSimulationStatus = async (req, res, next) => {
  try {
    res.json({
      success: true,
      simulation: simulationService.getStatus(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  toggleSimulation,
  setSimulationScenario,
  getSimulationStatus,
};
