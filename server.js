const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const app = express();

// Middleware CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de Mongoose
mongoose.set('strictQuery', false);

// Conectar a MongoDB
const connectDB = async () => {
  try {
    console.log('🔄 Intentando conectar a MongoDB...');
    console.log('MONGO_URI configurada:', process.env.MONGO_URI ? '✓ Sí' : '✗ No');
    console.log('JWT_SECRET configurado:', process.env.JWT_SECRET ? '✓ Sí' : '✗ No');
    
    await mongoose.connect(process.env.MONGO_URI);
    
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

// 🔥 IMPORTAR RUTAS (CORREGIDO)
const authRoutes = require('./routes/auth');
const gastosRoutes = require('./routes/gastos');
const inventarioRoutes = require('./routes/inventario');
const liquidacionRoutes = require('./routes/liquidacion'); // 🔥 AGREGADO

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/liquidacion', liquidacionRoutes); // 🔥 CORREGIDO

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Sistema de Fincas funcionando correctamente',
    mongoStatus: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    mongodb: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado',
    env: {
      mongoConfigured: !!process.env.MONGO_URI,
      jwtConfigured: !!process.env.JWT_SECRET
    }
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Error interno del servidor' 
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 URL: https://jc-fi.onrender.com`);
});