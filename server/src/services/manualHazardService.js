const ManualHazard = require('../models/ManualHazard');
const Alert = require('../models/Alert');

const HAZARD_DEFINITIONS = {
  fire: {
    title: 'CRITICAL FIRE DETECTED',
    message: 'Fire detected! Immediate evacuation recommended.',
    sensorType: 'flame',
    readingValue: true,
    thresholdValue: false,
    severity: 'critical',
  },
  water: {
    title: 'WATER LEAKAGE DETECTED',
    message: 'Water accumulation / flood detected on facility floor.',
    sensorType: 'water',
    readingValue: true,
    thresholdValue: false,
    severity: 'critical',
  },
  tilt: {
    title: 'STRUCTURAL TILT DETECTED',
    message: 'Structural building tilt detected! Structural integrity breach possible.',
    sensorType: 'tilt',
    readingValue: true,
    thresholdValue: false,
    severity: 'critical',
  },
  earthquake: {
    title: 'EARTHQUAKE DETECTED',
    message: 'Seismic earthquake vibration detected! Drop, cover, and hold on.',
    sensorType: 'earthquake',
    readingValue: true,
    thresholdValue: false,
    severity: 'critical',
  },
  gas: {
    title: 'HAZARDOUS GAS DETECTED',
    message: 'Hazardous gas leakage detected! High concentration in facility.',
    sensorType: 'gas',
    readingValue: 450,
    thresholdValue: 200,
    severity: 'critical',
  },
};

// In-memory cache for ultra-fast synchronization
let cachedState = {
  fire: { active: false, activatedAt: null, lastUpdatedAt: null, activatedBy: 'Anmol' },
  water: { active: false, activatedAt: null, lastUpdatedAt: null, activatedBy: 'Anmol' },
  tilt: { active: false, activatedAt: null, lastUpdatedAt: null, activatedBy: 'Anmol' },
  earthquake: { active: false, activatedAt: null, lastUpdatedAt: null, activatedBy: 'Anmol' },
  gas: { active: false, activatedAt: null, lastUpdatedAt: null, activatedBy: 'Anmol' },
};

let isInitialized = false;

// Socket broadcaster reference (injected or dynamically fetched to prevent circular dependency)
let socketBroadcaster = null;

const setSocketBroadcaster = (fn) => {
  socketBroadcaster = fn;
};

const notifySockets = () => {
  if (typeof socketBroadcaster === 'function') {
    try {
      socketBroadcaster(getPublicHazardState());
    } catch (err) {
      console.warn('Could not broadcast manual hazard update:', err.message);
    }
  }
};

/**
 * Initialize manual hazard state from MongoDB on startup
 */
const initManualHazards = async () => {
  try {
    const records = await ManualHazard.find({});
    const recordMap = new Map();
    records.forEach((r) => recordMap.set(r.hazard, r));

    for (const key of Object.keys(HAZARD_DEFINITIONS)) {
      if (recordMap.has(key)) {
        const doc = recordMap.get(key);
        cachedState[key] = {
          active: Boolean(doc.isActive),
          activatedAt: doc.activatedAt,
          lastUpdatedAt: doc.lastUpdatedAt || doc.updatedAt,
          activatedBy: doc.activatedBy || 'Anmol',
        };
      } else {
        // Initialize default document in MongoDB if missing
        try {
          const newDoc = await ManualHazard.create({
            hazard: key,
            isActive: false,
            title: HAZARD_DEFINITIONS[key].title,
            message: HAZARD_DEFINITIONS[key].message,
            severity: HAZARD_DEFINITIONS[key].severity,
          });
          cachedState[key] = {
            active: false,
            activatedAt: null,
            lastUpdatedAt: newDoc.createdAt,
            activatedBy: 'Anmol',
          };
        } catch (e) {
          // May conflict if concurrent init, safe to ignore
        }
      }
    }
    isInitialized = true;
  } catch (err) {
    console.error('Error initializing manual hazard state:', err.message);
  }
};

/**
 * Get the standardized public state of all 5 hazards
 */
const getPublicHazardState = () => {
  const hazards = {};
  let activeCount = 0;

  for (const [key, def] of Object.entries(HAZARD_DEFINITIONS)) {
    const item = cachedState[key] || { active: false, activatedAt: null, lastUpdatedAt: null, activatedBy: 'Anmol' };
    const isActive = Boolean(item.active);
    if (isActive) activeCount++;

    hazards[key] = {
      hazard: key,
      isActive,
      title: def.title,
      message: def.message,
      sensorType: def.sensorType,
      severity: def.severity,
      activatedAt: item.activatedAt,
      lastUpdatedAt: item.lastUpdatedAt || item.activatedAt || new Date(),
      activatedBy: item.activatedBy || 'Anmol',
      source: 'Manual Controller',
    };
  }

  return {
    hazards,
    activeCount,
    lastUpdated: new Date().toISOString(),
  };
};

/**
 * Activate a manual hazard
 */
const activateHazard = async (hazardName, activatedBy = 'Anmol') => {
  const key = String(hazardName).toLowerCase().trim();
  if (!HAZARD_DEFINITIONS[key]) {
    throw new Error(`Invalid hazard name: ${hazardName}. Allowed: fire, water, tilt, earthquake, gas`);
  }

  const def = HAZARD_DEFINITIONS[key];
  const now = new Date();

  // 1. Update in-memory state immediately
  cachedState[key] = {
    active: true,
    activatedAt: now,
    lastUpdatedAt: now,
    activatedBy,
  };

  // 2. Persist to MongoDB ManualHazard
  try {
    await ManualHazard.findOneAndUpdate(
      { hazard: key },
      {
        isActive: true,
        activatedAt: now,
        activatedBy,
        lastUpdatedAt: now,
        title: def.title,
        message: def.message,
        severity: def.severity,
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error(`MongoDB error saving manual hazard ${key}:`, err.message);
  }

  // 3. Create active Alert in MongoDB so it integrates with Alerts dashboard & logs
  try {
    // Resolve any older active manual alert for this hazard to keep clean
    await Alert.updateMany(
      {
        deviceId: 'MANUAL-CONTROLLER',
        sensorType: def.sensorType,
        status: 'active',
      },
      {
        status: 'resolved',
        resolvedAt: now,
        resolutionNotes: 'Superceded by new manual hazard activation',
      }
    );

    await Alert.create({
      title: `${def.title} (Manual Controller)`,
      message: `${def.message} [Triggered by Controller: ${activatedBy}]`,
      severity: def.severity,
      status: 'active',
      deviceId: 'MANUAL-CONTROLLER',
      sensorType: def.sensorType,
      readingValue: def.readingValue,
      thresholdValue: def.thresholdValue,
      isSimulated: false,
      timestamp: now,
    });
  } catch (err) {
    console.error(`Error logging Alert for manual hazard ${key}:`, err.message);
  }

  // 4. Notify all connected clients via Socket.IO
  notifySockets();

  return getPublicHazardState();
};

/**
 * Deactivate a manual hazard
 */
const deactivateHazard = async (hazardName, deactivatedBy = 'Anmol') => {
  const key = String(hazardName).toLowerCase().trim();
  if (!HAZARD_DEFINITIONS[key]) {
    throw new Error(`Invalid hazard name: ${hazardName}. Allowed: fire, water, tilt, earthquake, gas`);
  }

  const def = HAZARD_DEFINITIONS[key];
  const now = new Date();

  // 1. Update in-memory state
  cachedState[key] = {
    active: false,
    activatedAt: cachedState[key]?.activatedAt || null,
    lastUpdatedAt: now,
    activatedBy: deactivatedBy,
  };

  // 2. Persist to MongoDB
  try {
    await ManualHazard.findOneAndUpdate(
      { hazard: key },
      {
        isActive: false,
        deactivatedAt: now,
        lastUpdatedAt: now,
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error(`MongoDB error deactivating manual hazard ${key}:`, err.message);
  }

  // 3. Mark manual alerts in Alert collection as resolved
  try {
    await Alert.updateMany(
      {
        deviceId: 'MANUAL-CONTROLLER',
        sensorType: def.sensorType,
        status: 'active',
      },
      {
        status: 'resolved',
        resolvedAt: now,
        resolutionNotes: `Deactivated by controller ${deactivatedBy}`,
      }
    );
  } catch (err) {
    console.error(`Error resolving alerts for manual hazard ${key}:`, err.message);
  }

  // 4. Broadcast updated state
  notifySockets();

  return getPublicHazardState();
};

/**
 * Clear all manually triggered hazards
 * NOTE: Never touches genuine physical sensor alerts or readings!
 */
const clearAllManualHazards = async (clearedBy = 'Anmol') => {
  const now = new Date();

  // 1. Reset in-memory states
  for (const key of Object.keys(HAZARD_DEFINITIONS)) {
    cachedState[key] = {
      active: false,
      activatedAt: null,
      lastUpdatedAt: now,
      activatedBy: clearedBy,
    };
  }

  // 2. Update MongoDB ManualHazard collection
  try {
    await ManualHazard.updateMany(
      {},
      {
        isActive: false,
        deactivatedAt: now,
        lastUpdatedAt: now,
      }
    );
  } catch (err) {
    console.error('MongoDB error clearing manual hazards:', err.message);
  }

  // 3. Resolve all active MANUAL-CONTROLLER alerts
  try {
    await Alert.updateMany(
      {
        deviceId: 'MANUAL-CONTROLLER',
        status: 'active',
      },
      {
        status: 'resolved',
        resolvedAt: now,
        resolutionNotes: `All manual hazards cleared by controller ${clearedBy}`,
      }
    );
  } catch (err) {
    console.error('Error resolving manual alerts in Alert collection:', err.message);
  }

  // 4. Broadcast updated state
  notifySockets();

  return getPublicHazardState();
};

module.exports = {
  HAZARD_DEFINITIONS,
  initManualHazards,
  getPublicHazardState,
  activateHazard,
  deactivateHazard,
  clearAllManualHazards,
  setSocketBroadcaster,
};
