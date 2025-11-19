const jwt = require('jsonwebtoken');
const User = require('../models/User'); // 🔥 AGREGAR ESTO

const verificarToken = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Acceso denegado. No hay token proporcionado.' 
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 🔥 OBTENER FINCA ACTIVA DEL USUARIO
    const usuario = await User.findById(decoded.id).select('fincaActiva');
    
    req.usuario = {
      id: decoded.id,
      usuario: decoded.usuario,
      rol: decoded.rol,
      fincaActiva: usuario.fincaActiva // 🔥 AGREGAR ESTO
    };
    
    next();
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      message: 'Token inválido.' 
    });
  }
};

module.exports = { verificarToken };