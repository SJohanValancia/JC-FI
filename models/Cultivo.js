const mongoose = require('mongoose');

const cultivoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del cultivo es obligatorio'],
    trim: true
  },
  variedad: {
    type: String,
    trim: true,
    default: ''
  },
  cantidadInicial: {
    type: Number,
    required: [true, 'La cantidad inicial es obligatoria'],
    min: [0, 'La cantidad no puede ser negativa']
  },
  cantidadActual: {
    type: Number,
    required: true,
    min: [0, 'La cantidad no puede ser negativa']
  },
  bajas: [{
    cantidad: Number,
    fecha: { type: Date, default: Date.now },
    motivo: String
  }],
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  finca: {
    type: String,
    required: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaActualizacion: {
    type: Date,
    default: Date.now
  }
});

// Middleware para actualizar fecha de modificación
cultivoSchema.pre('save', function(next) {
  this.fechaActualizacion = new Date();
  next();
});

module.exports = mongoose.model('Cultivo', cultivoSchema);