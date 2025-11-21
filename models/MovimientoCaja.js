const mongoose = require('mongoose');

const movimientoCajaSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
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
  tipo: {
    type: String,
    enum: ['ingreso', 'retiro'],
    required: true
  },
  valor: {
    type: Number,
    required: true,
    min: 0
  },
  descripcion: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  cajaAntes: {
    type: Number,
    required: true
  },
  cajaDespues: {
    type: Number,
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now,
    index: true
  }
});

movimientoCajaSchema.index({ usuario: 1, finca: 1, fecha: -1 });

module.exports = mongoose.model('MovimientoCaja', movimientoCajaSchema);