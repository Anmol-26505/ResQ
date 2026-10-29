import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSocket } from '../services/socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [latestReading, setLatestReading] = useState(null);
  const [deviceReadings, setDeviceReadings] = useState({});
  const [deviceStatuses, setDeviceStatuses] = useState({});
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [simulationState, setSimulationState] = useState({ isRunning: false, scenario: 'nominal' });

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

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('sensor:reading', handleSensorReading);
    socket.on('device:status', handleDeviceStatus);
    socket.on('alert:new', handleNewAlert);
    socket.on('alert:updated', handleAlertUpdated);
    socket.on('simulation:status', handleSimulationStatus);

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
    };
  }, []);

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
