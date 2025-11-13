const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { verificarToken } = require('../middleware/auth');

// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password, rol, finca } = req.body;
    
    // Verificar si el usuario ya existe
    const usuarioExistente = await User.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ 
        success: false, 
        message: 'El email ya está registrado' 
      });
    }
    
    // Crear nuevo usuario
    const nuevoUsuario = new User({
      nombre,
      email,
      password,
      rol: rol || 'trabajador',
      finca: finca || ''
    });
    
    await nuevoUsuario.save();
    
    // Generar token
    const token = jwt.sign(
      { 
        id: nuevoUsuario._id, 
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      usuario: {
        id: nuevoUsuario._id,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol,
        finca: nuevoUsuario.finca
      }
    });
    
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al registrar usuario',
      error: error.message 
    });
  }
});

// Login de usuario
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Verificar si el usuario existe
    const usuario = await User.findOne({ email });
    if (!usuario) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email o contraseña incorrectos' 
      });
    }
    
    // Verificar si el usuario está activo
    if (!usuario.activo) {
      return res.status(403).json({ 
        success: false, 
        message: 'Usuario inactivo. Contacte al administrador' 
      });
    }
    
    // Verificar contraseña
    const passwordValido = await usuario.compararPassword(password);
    if (!passwordValido) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email o contraseña incorrectos' 
      });
    }
    
    // Generar token
    const token = jwt.sign(
      { 
        id: usuario._id, 
        email: usuario.email,
        rol: usuario.rol 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        finca: usuario.finca
      }
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al iniciar sesión',
      error: error.message 
    });
  }
});

// Verificar token (ruta protegida de ejemplo)
router.get('/verificar', verificarToken, async (req, res) => {
  try {
    const usuario = await User.findById(req.usuario.id).select('-password');
    res.json({
      success: true,
      usuario
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error al verificar token' 
    });
  }
});

module.exports = router;