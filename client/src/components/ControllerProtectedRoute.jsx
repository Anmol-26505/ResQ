import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Route protection wrapper for the Controller Dashboard.
 * Ensures only authorized operators with a valid controller token can access the control panel.
 */
const ControllerProtectedRoute = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem('resq_controller_token');

  if (!token) {
    return <Navigate to="/controller/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ControllerProtectedRoute;
