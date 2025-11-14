const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { verificarToken } = require('../middleware/auth');

// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { nombre, usuario, password, rol, finca } = req.body;
    
    // Validar campos requeridos
    if (!nombre || !usuario || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Todos los campos obligatorios deben ser completados' 
      });
    }
    
    // Verificar si el usuario ya existe
    const usuarioExistente = await User.findOne({ usuario: usuario.toLowerCase().trim() });
    if (usuarioExistente) {
      return res.status(400).json({ 
        success: false, 
        message: 'El usuario ya está registrado' 
      });
    }
    
    // Crear nuevo usuario
    const nuevoUsuario = new User({
      nombre: nombre.trim(),
      usuario: usuario.toLowerCase().trim(),
      password,
      rol: rol || 'trabajador',
      finca: finca || ''
    });
    
    await nuevoUsuario.save();
    
    // Generar token
    const token = jwt.sign(
      { 
        id: nuevoUsuario._id, 
        usuario: nuevoUsuario.usuario,
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
        usuario: nuevoUsuario.usuario,
        rol: nuevoUsuario.rol,
        finca: nuevoUsuario.finca
      }
    });
    
  } catch (error) {
    console.error('Error en registro:', error);
    
    // Manejar errores de validación de Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        message: messages.join(', ')
      });
    }
    
    // Manejar error de duplicado
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'El usuario ya existe' 
      });
    }
    
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
    const { usuario, password } = req.body;
    
    // Validar campos
    if (!usuario || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Usuario y contraseña son requeridos' 
      });
    }
    
    // Verificar si el usuario existe
    const usuarioEncontrado = await User.findOne({ usuario: usuario.toLowerCase().trim() });
    if (!usuarioEncontrado) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario o contraseña incorrectos' 
      });
    }
    
    // Verificar si el usuario está activo
    if (!usuarioEncontrado.activo) {
      return res.status(403).json({ 
        success: false, 
        message: 'Usuario inactivo. Contacte al administrador' 
      });
    }
    
    // Verificar contraseña
    const passwordValido = await usuarioEncontrado.compararPassword(password);
    if (!passwordValido) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario o contraseña incorrectos' 
      });
    }
    
    // Generar token
    const token = jwt.sign(
      { 
        id: usuarioEncontrado._id, 
        usuario: usuarioEncontrado.usuario,
        rol: usuarioEncontrado.rol 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: usuarioEncontrado._id,
        nombre: usuarioEncontrado.nombre,
        usuario: usuarioEncontrado.usuario,
        rol: usuarioEncontrado.rol,
        finca: usuarioEncontrado.finca
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

// Verificar token
router.get('/verificar', verificarToken, async (req, res) => {
  try {
    const usuario = await User.findById(req.usuario.id).select('-password');
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    res.json({
      success: true,
      usuario
    });
  } catch (error) {
    console.error('Error al verificar token:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al verificar token' 
    });
  }
});

module.exports = router;