import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSocket } from '../services/socket';
import api from '../services/api';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [latestReading, setLatestReading] = useState(null);
  const [deviceReadings, setDeviceReadings] = useState({});
  const [deviceStatuses, setDeviceStatuses] = useState({});
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [simulationState, setSimulationState] = useState({ isRunning: false, scenario: 'nominal' });

  // Remote Manual Hazard Controller Real-Time States
  const [manualHazards, setManualHazards] = useState({
    fire: false,
    water: false,
    tilt: false,
    earthquake: false,
    gas: false,
  });
  const [manualHazardDetails, setManualHazardDetails] = useState({});
  const [manualActiveCount, setManualActiveCount] = useState(0);
  const [manualLastUpdated, setManualLastUpdated] = useState(null);
  const [controllerDeviceOnline, setControllerDeviceOnline] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const handleSensorReading = (reading) => {
      setLatestReading(reading);
      if (reading.deviceId) {
        setDeviceReadings((prev) => ({
          ...prev,
          [reading.deviceId]: reading,
        }));
      }
    };

    const handleDeviceStatus = (statusData) => {
      if (statusData.deviceId) {
        setDeviceStatuses((prev) => ({
          ...prev,
          [statusData.deviceId]: statusData,
        }));
        if (statusData.deviceId === 'RESQ-NODE-01' || !statusData.deviceId) {
          setControllerDeviceOnline(statusData.status === 'online' || statusData.isOnline === true);
        }
      }
    };

    const handleNewAlert = (alert) => {
      setRecentAlerts((prev) => [alert, ...prev.slice(0, 19)]);
    };

    const handleAlertUpdated = (updatedAlert) => {
      setRecentAlerts((prev) =>
        prev.map((a) => (a._id === updatedAlert._id ? updatedAlert : a))
      );
    };

    const handleSimulationStatus = (status) => {
      setSimulationState(status);
    };

    const handleManualHazardUpdate = (data) => {
      if (!data || !data.hazards) return;
      const h = data.hazards;
      setManualHazards({
        fire: Boolean(h.fire?.isActive),
        water: Boolean(h.water?.isActive),
        tilt: Boolean(h.tilt?.isActive),
        earthquake: Boolean(h.earthquake?.isActive),
        gas: Boolean(h.gas?.isActive),
      });
      setManualHazardDetails(h);
      setManualActiveCount(data.activeCount || 0);
      setManualLastUpdated(data.lastUpdated || new Date().toISOString());
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('sensor:reading', handleSensorReading);
    socket.on('device:status', handleDeviceStatus);
    socket.on('alert:new', handleNewAlert);
    socket.on('alert:updated', handleAlertUpdated);
    socket.on('simulation:status', handleSimulationStatus);
    socket.on('hazard:manual_update', handleManualHazardUpdate);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('sensor:reading', handleSensorReading);
      socket.off('device:status', handleDeviceStatus);
      socket.off('alert:new', handleNewAlert);
      socket.off('alert:updated', handleAlertUpdated);
      socket.off('simulation:status', handleSimulationStatus);
      socket.off('hazard:manual_update', handleManualHazardUpdate);
    };
  }, []);

  // Fetch initial manual hazard states on component mount so page has immediate data
  const refreshManualHazards = useCallback(async () => {
    try {
      const res = await api.get('/controller/status');
      if (res.data?.success && res.data.hazards) {
        const h = res.data.hazards;
        setManualHazards({
          fire: Boolean(h.fire?.isActive),
          water: Boolean(h.water?.isActive),
          tilt: Boolean(h.tilt?.isActive),
          earthquake: Boolean(h.earthquake?.isActive),
          gas: Boolean(h.gas?.isActive),
        });
        setManualHazardDetails(h);
        setManualActiveCount(res.data.activeCount || 0);
        setManualLastUpdated(res.data.lastUpdated || new Date().toISOString());
      }
    } catch (e) {
      // Non-fatal fallback
    }
  }, []);

  // Fetch initial controller device connection status
  const refreshControllerDeviceStatus = useCallback(async () => {
    try {
      const res = await api.get('/controller/device-status');
      if (res.data?.success) {
        setControllerDeviceOnline(Boolean(res.data.isOnline));
      }
    } catch (e) {
      // Non-fatal fallback
    }
  }, []);

  useEffect(() => {
    refreshManualHazards();
    refreshControllerDeviceStatus();
  }, [refreshManualHazards, refreshControllerDeviceStatus]);

  const subscribeDevice = (deviceId) => {
    const socket = getSocket();
    if (socket && deviceId) {
      socket.emit('join:device', deviceId);
    }
  };

  const unsubscribeDevice = (deviceId) => {
    const socket = getSocket();
    if (socket && deviceId) {
      socket.emit('leave:device', deviceId);
    }
  };

  const value = {
    isConnected,
    latestReading,
    deviceReadings,
    deviceStatuses,
    recentAlerts,
    simulationState,
    manualHazards,
    manualHazardDetails,
    manualActiveCount,
    manualLastUpdated,
    controllerDeviceOnline,
    setControllerDeviceOnline,
    refreshManualHazards,
    refreshControllerDeviceStatus,
    subscribeDevice,
    unsubscribeDevice,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
