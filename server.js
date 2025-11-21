const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const app = express();

// ============================================
// 🔥 CONFIGURACIÓN CORS MEJORADA
// ============================================
app.use(cors({
  origin: function(origin, callback) {
    // ✅ Permitir peticiones sin origin (Postman, curl, etc.)
    if (!origin) return callback(null, true);
    
    // ✅ Lista de orígenes permitidos
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5500',
      'http://localhost:5501',
      'http://localhost:5502',
      'http://localhost:5503',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5500',
      'http://127.0.0.1:5501',
      'http://127.0.0.1:5502',
      'http://127.0.0.1:5503',
      'https://jc-fi.netlify.app',
      'https://jc-fi.onrender.com',
      'https://jc-frutas.onrender.com',
      'https://jc-frutas.netlify.app'
    ];
    
    // ✅ Permitir todos los subdominios de Netlify y Render
    if (origin.includes('netlify.app') || 
        origin.includes('onrender.com') || 
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // ✅ Verificar lista de permitidos
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // ⚠️ Rechazar si no está permitido
    callback(new Error('No permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['Set-Cookie'],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

// ============================================
// 🔥 HEADERS ADICIONALES PARA IFRAMES
// ============================================
app.use((req, res, next) => {
  // ✅ Permitir que esta aplicación sea embebida en iframes
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  
  // ✅ Asegurar CORS en todas las respuestas
  const origin = req.headers.origin;
  if (origin && (
    origin.includes('netlify.app') || 
    origin.includes('onrender.com') || 
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  )) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  // ✅ Manejar preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    return res.status(200).end();
  }
  
  next();
});

// ============================================
// 🔥 MIDDLEWARES
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuración de Mongoose
mongoose.set('strictQuery', false);

// ============================================
// 🔥 LOGGING DE PETICIONES (OPCIONAL)
// ============================================
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'}`);
  next();
});

// ============================================
// 🔥 CONECTAR A MONGODB
// ============================================
const connectDB = async () => {
  try {
    console.log('🔄 Intentando conectar a MongoDB...');
    console.log('MONGO_URI configurada:', process.env.MONGO_URI ? '✓ Sí' : '✗ No');
    console.log('JWT_SECRET configurado:', process.env.JWT_SECRET ? '✓ Sí' : '✗ No');
    
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ Conectado a MongoDB exitosamente');
    console.log('📊 Base de datos:', mongoose.connection.name);
  } catch (err) {
    console.error('❌ Error conectando a MongoDB:');
    console.error('Mensaje:', err.message);
    console.error('Stack:', err.stack);
  }
};

connectDB();

// Eventos de conexión
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose conectado a MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Error de conexión Mongoose:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose desconectado');
});

// ============================================
// 🔥 IMPORTAR RUTAS
// ============================================
const authRoutes = require('./routes/auth');
const gastosRoutes = require('./routes/gastos');
const inventarioRoutes = require('./routes/inventario');
const liquidacionRoutes = require('./routes/liquidacion');
const cultivosRoutes = require('./routes/cultivos');
const entradasRoutes = require('./routes/entradas');

// ============================================
// 🔥 USAR RUTAS
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/liquidacion', liquidacionRoutes);
app.use('/api/cultivos', cultivosRoutes);
app.use('/api/entradas', entradasRoutes);

// ============================================
// 🔥 RUTAS DE UTILIDAD
// ============================================

// --- RUTA RAÍZ ---
app.get('/', (req, res) => {
  res.json({ 
    message: '🎯 API Sistema de Fincas (JC-FI) funcionando correctamente',
    programa: 'JC-FI Dashboard',
    mongoStatus: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    cors: '✅ Habilitado con soporte para integración',
    features: {
      gastos: true,
      inventario: true,
      liquidacion: true,
      cultivos: true,
      integracion_frutas: true
    }
  });
});

// --- HEALTH CHECK ---
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    programa: 'JC-FI',
    mongodb: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: {
      mongoConfigured: !!process.env.MONGO_URI,
      jwtConfigured: !!process.env.JWT_SECRET
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  });
});

// --- TEST CORS ---
app.get('/api/test-cors', (req, res) => {
  res.json({
    message: '✅ CORS funcionando correctamente',
    origin: req.headers.origin || 'Sin Origin',
    timestamp: new Date().toISOString(),
    programa: 'JC-FI',
    corsEnabled: true,
    headers: {
      'access-control-allow-origin': res.getHeader('access-control-allow-origin'),
      'access-control-allow-credentials': res.getHeader('access-control-allow-credentials')
    }
  });
});

// --- TEST IFRAME ---
app.get('/api/test-iframe', (req, res) => {
  res.json({
    message: '✅ Iframe support activo',
    canBeEmbedded: true,
    xFrameOptions: res.getHeader('x-frame-options') || 'Not set (permitido)',
    csp: res.getHeader('content-security-policy') || 'Not set',
    timestamp: new Date().toISOString()
  });
});

// --- INFO DEL SERVIDOR ---
app.get('/api/info', (req, res) => {
  res.json({
    servidor: 'JC-FI Dashboard API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    mongodb: {
      estado: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado',
      database: mongoose.connection.name
    },
    rutas_disponibles: [
      '/api/auth/*',
      '/api/gastos/*',
      '/api/inventario/*',
      '/api/liquidacion/*',
      '/api/cultivos/*'
    ],
    integracion: {
      jc_frutas: true,
      cors_habilitado: true,
      iframe_support: true
    }
  });
});

// ============================================
// 🔥 MANEJO DE ERRORES
// ============================================
app.use((err, req, res, next) => {
  console.error('🚨 Error capturado:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
  
  // ✅ Asegurar CORS incluso en errores
  const origin = req.headers.origin;
  if (origin && (
    origin.includes('netlify.app') || 
    origin.includes('onrender.com') || 
    origin.includes('localhost')
  )) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  res.status(err.status || 500).json({ 
    success: false, 
    message: process.env.NODE_ENV === 'production' 
      ? 'Error interno del servidor' 
      : err.message,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// 🔥 MANEJO 404
// ============================================
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Ruta no encontrada',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableRoutes: [
      '/api/auth/*',
      '/api/gastos/*',
      '/api/inventario/*',
      '/api/liquidacion/*',
      '/api/cultivos/*',
      '/api/test-cors',
      '/api/test-iframe',
      '/api/info',
      '/health'
    ]
  });
});

// ============================================
// 🔥 INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║   🎯 JC-FI DASHBOARD - SERVIDOR INICIADO         ║
╠═══════════════════════════════════════════════════╣
║ 🚀 Puerto: ${PORT.toString().padEnd(35)} ║
║ 🌐 CORS: ✅ Configurado para integración         ║
║ 📊 MongoDB: ${mongoose.connection.readyState === 1 ? 'Conectado'.padEnd(29) : 'Desconectado'.padEnd(29)} ║
║ ⏰ Hora: ${new Date().toLocaleTimeString('es-CO').padEnd(36)} ║
║ 🔧 Modo: ${process.env.NODE_ENV === 'production' ? 'Producción'.padEnd(33) : 'Desarrollo'.padEnd(33)} ║
╠═══════════════════════════════════════════════════╣
║ ✅ CARACTERÍSTICAS ACTIVAS:                       ║
║    • API REST completa                           ║
║    • Integración con JC-FRUTAS                   ║
║    • CORS multi-origen                           ║
║    • Soporte para iframes                        ║
╚═══════════════════════════════════════════════════╝

✅ Servidor listo para recibir peticiones
🔗 URL: https://jc-fi.onrender.com
🧪 Test CORS: https://jc-fi.onrender.com/api/test-cors
🖼️  Test Iframe: https://jc-fi.onrender.com/api/test-iframe
📋 Info: https://jc-fi.onrender.com/api/info
  `);
});

// ============================================
// 🔥 MANEJO GRACEFUL DE CIERRE
// ============================================
const gracefulShutdown = (signal) => {
  console.log(`\n⚠️ ${signal} recibido, iniciando cierre graceful...`);
  
  server.close(() => {
    console.log('✅ Servidor HTTP cerrado');
    
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB desconectado');
      console.log('👋 Proceso terminado exitosamente');
      process.exit(0);
    });
  });
  
  setTimeout(() => {
    console.error('⚠️ Forzando cierre después de timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('💥 Excepción no capturada:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promesa rechazada no manejada:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = app;