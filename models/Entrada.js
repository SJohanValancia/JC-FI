const mongoose = require('mongoose');

const entradaSchema = new mongoose.Schema({
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
  fechaEntrada: {
    type: Date,
    required: true,
    index: true
  },
  descripcion: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  valor: {
    type: Number,
    required: true,
    min: 0
  },
  fechaCreacion: {
    type: Date,
    default: Date.now,
    index: true
  },
  ultimaModificacion: {
    type: Date,
    default: Date.now
  },
  liquidada: {
    type: Boolean,
    default: false
  },
  fechaLiquidacion: {
    type: Date
  },
  liquidacionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Liquidacion'
  }
});

entradaSchema.index({ usuario: 1, finca: 1, fechaEntrada: -1 });

module.exports = mongoose.model('Entrada', entradaSchema);