const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { verificarToken } = require('../middleware/auth');
const fetch = require('node-fetch');

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
    
    // Crear nuevo usuario en programa principal
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
    
    // 🔥 SINCRONIZACIÓN AUTOMÁTICA CON PROGRAMA DE FRUTAS
    try {
      console.log('🔄 Iniciando sincronización con programa de frutas...');
      
      // 1️⃣ Crear usuario en programa de frutas (SIEMPRE COMO ADMIN - TIPO 1)
      const responseFrutasUser = await fetch('https://jc-frutas.onrender.com/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: nuevoUsuario.usuario,
          password: password, // Contraseña sin encriptar
          tipo: 1, // 🔥 SIEMPRE TIPO 1 (ADMIN)
          alias: nuevoUsuario.usuario, // 🔥 USAR USUARIO COMO ALIAS
          aliasAdmin: nuevoUsuario.usuario // 🔥 ALIASADMIN = USUARIO
        })
      });

      if (responseFrutasUser.ok) {
        const dataFrutasUser = await responseFrutasUser.json();
        console.log('✅ Usuario creado en programa de frutas como ADMIN (tipo 1)');

        // 2️⃣ Crear finca si se proporcionó
        if (finca && finca.trim() !== '') {
          const responseFinca = await fetch('https://jc-frutas.onrender.com/fincas/agregar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombre: finca.trim(),
              propietario: nuevoUsuario.nombre,
              usuario: nuevoUsuario.usuario,
              adminAlias: nuevoUsuario.usuario // 🔥 USAR USUARIO COMO ADMINALIAS
            })
          });

          if (responseFinca.ok) {
            const dataFinca = await responseFinca.json();
            console.log('✅ Finca creada en programa de frutas:', dataFinca);
          } else {
            const errorFinca = await responseFinca.text();
            console.warn('⚠️ Error al crear finca:', errorFinca);
          }
        }
      } else {
        const errorUsuario = await responseFrutasUser.text();
        console.warn('⚠️ Error al crear usuario en frutas:', errorUsuario);
      }
    } catch (errorSync) {
      console.error('❌ Error de sincronización:', errorSync.message);
      // NO FALLAR el registro principal
    }
    
    // Respuesta exitosa del registro principal
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
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        message: messages.join(', ')
      });
    }
    
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