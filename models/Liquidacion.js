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
  finca: {
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
    required: true,
    default: 0  // 🔥 Agregado default
  },
  
  // Ingresos - AHORA DESDE ENTRADAS
  totalIngresos: { 
    type: Number, 
    required: true,
    default: 0 
  },
  
  entradasLiquidadas: [{
    entradaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entrada' },
    descripcion: String,
    valor: Number,
    fechaEntrada: Date
  }],
  
  // Egresos
  totalEgresos: { 
    type: Number, 
    required: true,
    default: 0 
  },
  
  gastosLiquidados: [{
    gastoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gasto' },
    descripcion: String,
    valor: Number,
    finca: String
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

// 🔥 MÉTODO PARA CALCULAR TOTALES CORRECTAMENTE
liquidacionSchema.methods.calcularTotales = function() {
  // Caja Final = Caja Inicial + Total Ingresos - Total Egresos
  this.cajaFinal = this.cajaInicial + this.totalIngresos - this.totalEgresos;
  
  // Log para debugging
  console.log(`💼 Cálculo de caja:`);
  console.log(`   Caja Inicial: $${this.cajaInicial}`);
  console.log(`   + Ingresos: $${this.totalIngresos}`);
  console.log(`   - Egresos: $${this.totalEgresos}`);
  console.log(`   = Caja Final: $${this.cajaFinal}`);
};

module.exports = mongoose.model('Liquidacion', liquidacionSchema);