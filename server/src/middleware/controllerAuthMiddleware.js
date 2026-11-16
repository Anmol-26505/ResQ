const jwt = require('jsonwebtoken');

/**
 * Controller Authentication Middleware
 * Protects remote hazard controller mutation endpoints.
 * Validates the JWT Bearer token and checks for controller role.
 */
const verifyControllerToken = (req, res, next) => {
  let token = null;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers['x-controller-token']) {
    token = req.headers['x-controller-token'];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Controller authentication token required',
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'resq_emergency_iot_jwt_super_secret_key_2026';
    const decoded = jwt.verify(token, jwtSecret);

    if (decoded.role !== 'controller' && !decoded.isController) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient privileges. Controller access required.',
      });
    }

    req.controller = {
      username: decoded.username || 'Anmol',
      role: 'controller',
      isController: true,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired controller token',
    });
  }
};

module.exports = { verifyControllerToken };
