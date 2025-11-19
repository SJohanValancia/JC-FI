const mongoose = require('mongoose');

const inventarioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del producto es obligatorio'],
    trim: true
  },
  precio: {
    type: Number,
    default: 0,  // Cambiado: ahora tiene valor por defecto
    min: [0, 'El precio debe ser positivo']
    // Eliminado required
  },
  litros: {
    type: Number,
    default: null,
    min: [0, 'Los litros deben ser positivos']
  },
  categoria: {
    type: String,
    required: [true, 'La categoría es obligatoria'],
    trim: true
  },
  stock: {
    type: Number,
    required: [true, 'El stock es obligatorio'],
    min: [0, 'El stock debe ser positivo'],
    default: 0
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usuarioNombre: {
    type: String,
    required: true
  },
  finca: {
    type: String,
    required: true,
    index: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  actualizado: {
    type: Date,
    default: Date.now
  }
});

inventarioSchema.pre('save', function(next) {
  this.actualizado = Date.now();
  next();
});

module.exports = mongoose.model('Inventario', inventarioSchema);