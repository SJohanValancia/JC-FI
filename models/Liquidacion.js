const mongoose = require('mongoose');

const liquidacionSchema = new mongoose.Schema({
  fecha: { 
    type: Date, 
    default: Date.now,
    required: true 
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
  
  // Caja
  cajaInicial: { 
    type: Number, 
    required: true,
    default: 0 
  },
  cajaFinal: { 
    type: Number, 
    required: true 
  },
  
  // Ingresos
  totalIngresos: { 
    type: Number, 
    required: true,
    default: 0 
  },
  ingresoRecogidas: { 
    type: Number, 
    default: 0 
  },
  ingresosAdicionales: [{
    descripcion: String,
    valor: Number,
    fecha: { type: Date, default: Date.now }
  }],
  totalIngresosAdicionales: {
    type: Number,
    default: 0
  },
  
  // Egresos
  totalEgresos: { 
    type: Number, 
    required: true,
    default: 0 
  },
  
  // Referencias (IDs guardados como strings porque vienen de otra BD)
  recogidasLiquidadas: [{
    recogidaId: String,
    finca: String,
    fecha: String,
    kilos: Number,
    valor: Number
  }],
  
  gastosLiquidados: [{
    gastoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gasto' },
    descripcion: String,
    valor: Number
  }],
  
  inventarioUsado: [{
    productoNombre: String,
    cantidad: Number,
    valorUnitario: Number,
    valorTotal: Number
  }],
  
  // Metadatos
  estado: {
    type: String,
    enum: ['completada', 'cancelada'],
    default: 'completada'
  },
  notas: String,
  
  fechaCreacion: { 
    type: Date, 
    default: Date.now 
  }
});

// Método para calcular totales
liquidacionSchema.methods.calcularTotales = function() {
  this.totalIngresos = this.ingresoRecogidas + this.totalIngresosAdicionales;
  this.cajaFinal = this.cajaInicial + this.totalIngresos - this.totalEgresos;
};

module.exports = mongoose.model('Liquidacion', liquidacionSchema);