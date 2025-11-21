const express = require('express');
const router = express.Router();
const Liquidacion = require('../models/Liquidacion');
const Gasto = require('../models/Gasto');
const Inventario = require('../models/Inventario');
const { verificarToken } = require('../middleware/auth');
const axios = require('axios');
const User = require('../models/User');
const mongoose = require('mongoose');
const Entrada = require('../models/Entrada'); // ← AGREGAR ESTA LÍNEA


entradaSchema.index({ usuario: 1, finca: 1, fechaEntrada: -1 });
const Entrada = mongoose.model('Entrada', entradaSchema);

router.get('/entradas-pendientes', verificarToken, async (req, res) => {
  try {
    const User = require('../models/User');
    const Entrada = require('../models/Entrada');
    
    // Obtener la finca activa del usuario
    const usuarioData = await User.findById(req.usuario.id);
    if (!usuarioData || !usuarioData.fincaActiva) {
      return res.json({ 
        success: true, 
        entradas: [],
        message: 'No hay finca activa seleccionada'
      });
    }
    
    const fincaActiva = usuarioData.fincaActiva;
    
    // Obtener entradas no liquidadas de la finca activa
    const entradas = await Entrada.find({
      usuario: req.usuario.id,
      finca: fincaActiva,
      liquidada: false
    }).sort({ fechaEntrada: -1 });
    
    res.json({ 
      success: true, 
      entradas,
      fincaActiva: fincaActiva
    });
  } catch (error) {
    console.error('Error al obtener entradas pendientes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener entradas pendientes',
      error: error.message 
    });
  }
});

// 🔥 OBTENER GASTOS SIN LIQUIDAR
router.get('/gastos-pendientes', verificarToken, async (req, res) => {
  try {
    const User = require('../models/User');
    
    // Obtener la finca activa del usuario
    const usuarioData = await User.findById(req.usuario.id);
    if (!usuarioData || !usuarioData.fincaActiva) {
      return res.json({ 
        success: true, 
        gastos: [],
        message: 'No hay finca activa seleccionada'
      });
    }
    
    const fincaActiva = usuarioData.fincaActiva;
    
    // 🔥 FILTRAR GASTOS POR USUARIO Y FINCA ACTIVA
    const gastos = await Gasto.find({ 
      usuario: req.usuario.id,
      finca: fincaActiva, // 🔥 FILTRO CRÍTICO
      reciboDia: false 
    })
    .populate('usuario', 'nombre usuario')
    .sort({ fechaCreacion: -1 });
    
    // Calcular inventario usado en cada gasto
    const gastosConInventario = gastos.map(gasto => {
      const inventarioTotal = gasto.productosInventario.reduce((sum, prod) => {
        return sum + (prod.cantidadUsada * (prod.precio || 0));
      }, 0);
      
      return {
        ...gasto.toObject(),
        valorInventario: inventarioTotal,
        valorTotal: gasto.valor + inventarioTotal
      };
    });
    
    res.json({ 
      success: true, 
      gastos: gastosConInventario,
      fincaActiva: fincaActiva
    });
  } catch (error) {
    console.error('Error al obtener gastos pendientes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener gastos pendientes',
      error: error.message 
    });
  }
});

// 🔥 PROCESAR LIQUIDACIÓN COMPLETA
// 🔥 PROCESAR LIQUIDACIÓN - VERSIÓN CON ENTRADAS
router.post('/procesar', verificarToken, async (req, res) => {
  try {
    const { 
      cajaInicial,
      entradasSeleccionadas, // Array de IDs de entradas
      gastosIds,
      notas
    } = req.body;
    
    const User = require('../models/User');
    const Entrada = require('../models/Entrada');
    
    // 🔥 OBTENER LA FINCA ACTIVA DEL USUARIO
    const usuarioData = await User.findById(req.usuario.id);
    if (!usuarioData || !usuarioData.fincaActiva) {
      return res.status(400).json({
        success: false,
        message: 'No hay finca activa seleccionada'
      });
    }
    
    const fincaActiva = usuarioData.fincaActiva;
    console.log('🏡 Procesando liquidación para finca:', fincaActiva);
    
    if (!Array.isArray(entradasSeleccionadas) || !Array.isArray(gastosIds)) {
      return res.status(400).json({
        success: false,
        message: 'Datos de liquidación inválidos'
      });
    }
    
    // 1️⃣ Obtener información de entradas
    const entradas = await Entrada.find({
      _id: { $in: entradasSeleccionadas },
      usuario: req.usuario.id,
      finca: fincaActiva,
      liquidada: false
    });
    
    if (entradas.length !== entradasSeleccionadas.length) {
      console.warn(`⚠️ Se encontraron ${entradas.length} de ${entradasSeleccionadas.length} entradas solicitadas`);
    }
    
    const entradasDetalle = entradas.map(e => ({
      entradaId: e._id,
      descripcion: e.descripcion,
      valor: e.valor,
      fechaEntrada: e.fechaEntrada
    }));
    
    const totalEntradas = entradas.reduce((sum, e) => sum + e.valor, 0);
    console.log(`💰 Total entradas de ${fincaActiva}: $${totalEntradas}`);
    
    // 2️⃣ Obtener información de gastos
    const gastos = await Gasto.find({ 
      _id: { $in: gastosIds },
      usuario: req.usuario.id,
      finca: fincaActiva
    });
    
    if (gastos.length !== gastosIds.length) {
      console.warn(`⚠️ Se encontraron ${gastos.length} de ${gastosIds.length} gastos solicitados`);
    }
    
    let totalGastos = 0;
    let gastosDetalle = [];
    let inventarioDetalle = [];
    
    for (let gasto of gastos) {
      totalGastos += gasto.valor;
      
      gastosDetalle.push({
        gastoId: gasto._id,
        descripcion: gasto.descripcion,
        valor: gasto.valor,
        finca: gasto.finca
      });
      
      // Calcular inventario usado
      if (gasto.productosInventario && gasto.productosInventario.length > 0) {
        for (let prod of gasto.productosInventario) {
          const producto = await Inventario.findById(prod.inventarioId);
          if (producto) {
            const valorTotal = prod.cantidadUsada * producto.precio;
            totalGastos += valorTotal;
            
            inventarioDetalle.push({
              productoNombre: prod.nombre,
              cantidad: prod.cantidadUsada,
              valorUnitario: producto.precio,
              valorTotal: valorTotal
            });
          }
        }
      }
    }
    
    console.log(`💸 Total egresos de ${fincaActiva}: $${totalGastos}`);
    
    // 3️⃣ Crear liquidación
    const liquidacion = new Liquidacion({
      usuario: req.usuario.id,
      usuarioNombre: req.usuario.usuario,
      finca: fincaActiva,
      cajaInicial: cajaInicial || 0,
      totalIngresos: totalEntradas,
      entradasLiquidadas: entradasDetalle,
      totalEgresos: totalGastos,
      gastosLiquidados: gastosDetalle,
      inventarioUsado: inventarioDetalle,
      notas: notas || ''
    });
    
    liquidacion.calcularTotales();
    await liquidacion.save();
    
    console.log(`✅ Liquidación creada para finca ${fincaActiva}: ID ${liquidacion._id}`);
    
    // 4️⃣ Marcar gastos como liquidados
    await Gasto.updateMany(
      { 
        _id: { $in: gastosIds },
        finca: fincaActiva
      },
      { 
        $set: { 
          reciboDia: true,
          fechaLiquidacion: new Date(),
          liquidacionId: liquidacion._id
        } 
      }
    );
    
    // 5️⃣ Marcar entradas como liquidadas
    await Entrada.updateMany(
      {
        _id: { $in: entradasSeleccionadas },
        finca: fincaActiva
      },
      {
        $set: {
          liquidada: true,
          fechaLiquidacion: new Date(),
          liquidacionId: liquidacion._id
        }
      }
    );
    
    console.log(`✅ ${entradas.length} entradas marcadas como liquidadas`);
    
    res.json({ 
      success: true, 
      message: `Liquidación procesada exitosamente para ${fincaActiva}`,
      liquidacion,
      fincaActiva: fincaActiva,
      resumen: {
        totalEntradas: entradas.length,
        totalGastos: gastos.length,
        valorEntradas: totalEntradas,
        valorGastos: totalGastos,
        cajaFinal: liquidacion.cajaFinal
      }
    });
    
  } catch (error) {
    console.error('Error al procesar liquidación:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al procesar liquidación',
      error: error.message 
    });
  }
});

// 🔥 OBTENER HISTORIAL DE LIQUIDACIONES
router.get('/historial', verificarToken, async (req, res) => {
  try {
    const { fechaInicio, fechaFin, limite = 50 } = req.query;
    
    let filtros = { usuario: req.usuario.id };
    
    if (fechaInicio && fechaFin) {
      filtros.fecha = {
        $gte: new Date(fechaInicio),
        $lte: new Date(fechaFin)
      };
    }
    
    const liquidaciones = await Liquidacion.find(filtros)
      .sort({ fecha: -1 })
      .limit(parseInt(limite));
    
    res.json({ 
      success: true, 
      liquidaciones,
      total: liquidaciones.length 
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener historial',
      error: error.message 
    });
  }
});

// 🔥 OBTENER UNA LIQUIDACIÓN ESPECÍFICA
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const liquidacion = await Liquidacion.findOne({
      _id: req.params.id,
      usuario: req.usuario.id
    });
    
    if (!liquidacion) {
      return res.status(404).json({
        success: false,
        message: 'Liquidación no encontrada'
      });
    }
    
    res.json({ success: true, liquidacion });
  } catch (error) {
    console.error('Error al obtener liquidación:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener liquidación',
      error: error.message 
    });
  }
});

// 🔥 OBTENER ESTADÍSTICAS DE LIQUIDACIONES
router.get('/stats/resumen', verificarToken, async (req, res) => {
  try {
    const liquidaciones = await Liquidacion.find({ usuario: req.usuario.id });
    
    const stats = {
      totalLiquidaciones: liquidaciones.length,
      totalIngresos: liquidaciones.reduce((sum, l) => sum + l.totalIngresos, 0),
      totalEgresos: liquidaciones.reduce((sum, l) => sum + l.totalEgresos, 0),
      promedioIngreso: 0,
      promedioEgreso: 0
    };
    
    if (stats.totalLiquidaciones > 0) {
      stats.promedioIngreso = stats.totalIngresos / stats.totalLiquidaciones;
      stats.promedioEgreso = stats.totalEgresos / stats.totalLiquidaciones;
    }
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener estadísticas',
      error: error.message 
    });
  }
});

module.exports = router;