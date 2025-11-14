const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const app = express();

// Middleware CORS configurado para aceptar todas las solicitudes
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
mongoose.set('bufferCommands', false);

// Conectar a MongoDB con mejor configuración
const connectDB = async () => {
  try {
    console.log('🔄 Intentando conectar a MongoDB...');
    console.log('URI:', process.env.MONGO_URI ? 'Configurada ✓' : 'NO CONFIGURADA ✗');
    
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ Conectado a MongoDB exitosamente');
    console.log('📊 Base de datos:', mongoose.connection.name);
  } catch (err) {
    console.error('❌ Error conectando a MongoDB:');
    console.error('Mensaje:', err.message);
    console.error('Detalles:', err);
    process.exit(1);
  }
};

// Llamar a la función de conexión
connectDB();

// Manejar eventos de desconexión
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB desconectado');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Error de MongoDB:', err);
});

// Rutas
app.use('/api/auth', require('./routes/auth'));

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Sistema de Fincas funcionando correctamente',
    mongoStatus: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado'
  });
});

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    mongodb: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado',
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error en la aplicación:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
});