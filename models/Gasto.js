const mongoose = require('mongoose');

const gastoSchema = new mongoose.Schema({
  fechaGasto: {
    type: Date,
    default: Date.now,
    required: true
  },
  descripcion: {
    type: String,
    required: [true, 'La descripción es obligatoria'],
    trim: true
  },
  valor: {
    type: Number,
    required: [true, 'El valor es obligatorio'],
    min: [0, 'El valor debe ser positivo']
  },
  productosInventario: [{
    inventarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventario',
    },
    nombre: String,
    cantidadUsada: {
      type: Number,
      min: [0, 'La cantidad debe ser positiva']
    }
  }],
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
    default: ''
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

gastoSchema.pre('save', function(next) {
  this.actualizado = Date.now();
  next();
});

module.exports = mongoose.model('Gasto', gastoSchema);