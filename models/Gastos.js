const mongoose = require('mongoose');

const gastoSchema = new mongoose.Schema({
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
  inventario: {
    type: String,
    default: null
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

// Actualizar fecha de modificación antes de guardar
gastoSchema.pre('save', function(next) {
  this.actualizado = Date.now();
  next();
});

module.exports = mongoose.model('Gasto', gastoSchema);