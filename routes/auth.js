const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { verificarToken } = require('../middleware/auth');

// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { nombre, usuario, password, rol, finca } = req.body;
    
    // Verificar si el usuario ya existe
    const usuarioExistente = await User.findOne({ usuario });
    if (usuarioExistente) {
      return res.status(400).json({ 
        success: false, 
        message: 'El usuario ya está registrado' 
      });
    }
    
    // Crear nuevo usuario
    const nuevoUsuario = new User({
      nombre,
      usuario,
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
    
    // Verificar si el usuario existe
    const usuarioEncontrado = await User.findOne({ usuario });
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