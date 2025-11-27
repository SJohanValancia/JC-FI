const express = require('express');
const router = express.Router();
const Liquidacion = require('../models/Liquidacion');
const Gasto = require('../models/Gasto');
const Inventario = require('../models/Inventario');
const { verificarToken } = require('../middleware/auth');
const axios = require('axios');
const User = require('../models/User');
const mongoose = require('mongoose');
const Entrada = require('../models/Entrada');
// Al inicio del archivo, agregar:
const MovimientoCaja = require('../models/MovimientoCaja');

// Agregar estas rutas ANTES de module.exports:

// 🔥 OBTENER CAJA ACTUAL (última liquidación)
router.get('/caja-actual', verificarToken, async (req, res) => {
  try {
    const usuarioData = await User.findById(req.usuario.id);
    if (!usuarioData || !usuarioData.fincaActiva) {
      return res.json({ 
        success: true, 
        cajaActual: 0,
        message: 'No hay finca activa seleccionada'
      });
    }
    
    const fincaActiva = usuarioData.fincaActiva;
    
    // Buscar la última liquidación de esta finca
    const ultimaLiquidacion = await Liquidacion.findOne({
      usuario: req.usuario.id,
      finca: fincaActiva
    }).sort({ fecha: -1 });
    
    let cajaActual = 0;
    
    if (ultimaLiquidacion) {
      cajaActual = ultimaLiquidacion.cajaFinal;
    }
    
    // Sumar/restar movimientos posteriores a la última liquidación
    const fechaUltimaLiquidacion = ultimaLiquidacion ? ultimaLiquidacion.fecha : new Date(0);
    
    const movimientos = await MovimientoCaja.find({
      usuario: req.usuario.id,
      finca: fincaActiva,
      fecha: { $gt: fechaUltimaLiquidacion }
    });
    
    movimientos.forEach(mov => {
      if (mov.tipo === 'ingreso') {
        cajaActual += mov.valor;
      } else {
        cajaActual -= mov.valor;
      }
    });
    
    res.json({ 
      success: true, 
      cajaActual: cajaActual,
      ultimaLiquidacion: ultimaLiquidacion ? {
        fecha: ultimaLiquidacion.fecha,
        cajaFinal: ultimaLiquidacion.cajaFinal
      } : null
    });
    
  } catch (error) {
    console.error('Error al obtener caja actual:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener caja actual',
      error: error.message 
    });
  }
});

// 🔥 REGISTRAR MOVIMIENTO DE CAJA
router.post('/movimiento-caja', verificarToken, async (req, res) => {
  try {
    const { tipo, valor, descripcion } = req.body;
    
    if (!tipo || !valor || !descripcion) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios'
      });
    }
    
    if (!['ingreso', 'retiro'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de movimiento inválido'
      });
    }
    
    if (valor <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El valor debe ser mayor a 0'
      });
    }
    
    const usuarioData = await User.findById(req.usuario.id);
    if (!usuarioData || !usuarioData.fincaActiva) {
      return res.status(400).json({
        success: false,
        message: 'No hay finca activa seleccionada'
      });
    }
    
    const fincaActiva = usuarioData.fincaActiva;
    
    // Obtener caja actual
    const ultimaLiquidacion = await Liquidacion.findOne({
      usuario: req.usuario.id,
      finca: fincaActiva
    }).sort({ fecha: -1 });
    
    let cajaAntes = ultimaLiquidacion ? ultimaLiquidacion.cajaFinal : 0;
    
    // Considerar movimientos posteriores
    const fechaUltimaLiquidacion = ultimaLiquidacion ? ultimaLiquidacion.fecha : new Date(0);
    const movimientosAnteriores = await MovimientoCaja.find({
      usuario: req.usuario.id,
      finca: fincaActiva,
      fecha: { $gt: fechaUltimaLiquidacion }
    });
    
    movimientosAnteriores.forEach(mov => {
      if (mov.tipo === 'ingreso') {
        cajaAntes += mov.valor;
      } else {
        cajaAntes -= mov.valor;
      }
    });
    
    // Calcular caja después del movimiento
    let cajaDespues = cajaAntes;
    if (tipo === 'ingreso') {
      cajaDespues += valor;
    } else {
      cajaDespues -= valor;
      
      if (cajaDespues < 0) {
        return res.status(400).json({
          success: false,
          message: 'No hay suficiente dinero en caja para este retiro'
        });
      }
    }
    
    // Crear movimiento
    const movimiento = new MovimientoCaja({
      usuario: req.usuario.id,
      usuarioNombre: usuarioData.nombre || usuarioData.usuario,
      finca: fincaActiva,
      tipo: tipo,
      valor: parseFloat(valor),
      descripcion: descripcion.trim(),
      cajaAntes: cajaAntes,
      cajaDespues: cajaDespues
    });
    
    await movimiento.save();
    
    res.json({
      success: true,
      message: `${tipo === 'ingreso' ? 'Ingreso' : 'Retiro'} registrado exitosamente`,
      movimiento: movimiento,
      cajaActual: cajaDespues
    });
    
  } catch (error) {
    console.error('Error al registrar movimiento:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al registrar movimiento',
      error: error.message 
    });
  }
});

// 🔥 OBTENER HISTORIAL DE MOVIMIENTOS DE CAJA
router.get('/movimientos-caja', verificarToken, async (req, res) => {
  try {
    const { limite = 50 } = req.query;
    
    const usuarioData = await User.findById(req.usuario.id);
    if (!usuarioData || !usuarioData.fincaActiva) {
      return res.json({ 
        success: true, 
        movimientos: [],
        message: 'No hay finca activa seleccionada'
      });
    }
    
    const fincaActiva = usuarioData.fincaActiva;
    
    const movimientos = await MovimientoCaja.find({
      usuario: req.usuario.id,
      finca: fincaActiva
    })
    .sort({ fecha: -1 })
    .limit(parseInt(limite));
    
    res.json({ 
      success: true, 
      movimientos: movimientos
    });
    
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener movimientos',
      error: error.message 
    });
  }
});

router.get('/entradas-pendientes', verificarToken, async (req, res) => {
  try {
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
      finca: fincaActiva,
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

// 🔥 PROCESAR LIQUIDACIÓN - VERSIÓN CON ENTRADAS
// 🔥 PROCESAR LIQUIDACIÓN - VERSIÓN CORREGIDA CON CAJA INICIAL AUTOMÁTICA
router.post('/procesar', verificarToken, async (req, res) => {
  try {
    const { 
      entradasSeleccionadas,
      gastosIds,
      notas
    } = req.body;
    
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
    
    // 🔥 CALCULAR CAJA INICIAL (caja final de la liquidación anterior)
    const ultimaLiquidacion = await Liquidacion.findOne({
      usuario: req.usuario.id,
      finca: fincaActiva
    }).sort({ fecha: -1 });
    
    let cajaInicial = 0;
    
    if (ultimaLiquidacion) {
      cajaInicial = ultimaLiquidacion.cajaFinal;
      console.log(`💼 Caja inicial desde última liquidación: $${cajaInicial}`);
    }
    
    // Sumar movimientos de caja posteriores a la última liquidación
    const fechaUltimaLiquidacion = ultimaLiquidacion ? ultimaLiquidacion.fecha : new Date(0);
    const movimientos = await MovimientoCaja.find({
      usuario: req.usuario.id,
      finca: fincaActiva,
      fecha: { $gt: fechaUltimaLiquidacion }
    });
    
    movimientos.forEach(mov => {
      if (mov.tipo === 'ingreso') {
        cajaInicial += mov.valor;
      } else {
        cajaInicial -= mov.valor;
      }
    });
    
    console.log(`💰 Caja inicial con movimientos: $${cajaInicial}`);
    
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
      cajaInicial: cajaInicial, // 🔥 USAR CAJA INICIAL CALCULADA
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
    console.log(`💼 Caja Final: $${liquidacion.cajaFinal}`);
    
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
        cajaInicial: cajaInicial,
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
// 🔥 OBTENER HISTORIAL DE LIQUIDACIONES - FILTRADO POR FINCA
router.get('/historial', verificarToken, async (req, res) => {
  try {
    const { fechaInicio, fechaFin, limite = 50 } = req.query;
    
    // 🔥 OBTENER LA FINCA ACTIVA DEL USUARIO
    const usuarioData = await User.findById(req.usuario.id);
    if (!usuarioData || !usuarioData.fincaActiva) {
      return res.json({ 
        success: true, 
        liquidaciones: [],
        message: 'No hay finca activa seleccionada'
      });
    }
    
    const fincaActiva = usuarioData.fincaActiva;
    console.log('🔍 Cargando historial de finca:', fincaActiva);
    
    // 🔥 FILTRAR POR USUARIO Y FINCA ACTIVA
    let filtros = { 
      usuario: req.usuario.id,
      finca: fincaActiva // 🔥 AGREGAR FILTRO POR FINCA
    };
    
    if (fechaInicio && fechaFin) {
      filtros.fecha = {
        $gte: new Date(fechaInicio),
        $lte: new Date(fechaFin)
      };
    }
    
    const liquidaciones = await Liquidacion.find(filtros)
      .sort({ fecha: -1 })
      .limit(parseInt(limite));
    
    console.log(`✅ Se encontraron ${liquidaciones.length} liquidaciones de ${fincaActiva}`);
    
    res.json({ 
      success: true, 
      liquidaciones,
      fincaActiva: fincaActiva,
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
// 🔥 OBTENER ESTADÍSTICAS DE LIQUIDACIONES - FILTRADO POR FINCA
router.get('/stats/resumen', verificarToken, async (req, res) => {
  try {
    // 🔥 OBTENER LA FINCA ACTIVA DEL USUARIO
    const usuarioData = await User.findById(req.usuario.id);
    if (!usuarioData || !usuarioData.fincaActiva) {
      return res.json({ 
        success: true, 
        stats: {
          totalLiquidaciones: 0,
          totalIngresos: 0,
          totalEgresos: 0,
          promedioIngreso: 0,
          promedioEgreso: 0
        },
        message: 'No hay finca activa seleccionada'
      });
    }
    
    const fincaActiva = usuarioData.fincaActiva;
    console.log('📊 Calculando estadísticas para finca:', fincaActiva);
    
    // 🔥 FILTRAR POR USUARIO Y FINCA ACTIVA
    const liquidaciones = await Liquidacion.find({ 
      usuario: req.usuario.id,
      finca: fincaActiva // 🔥 AGREGAR FILTRO POR FINCA
    });
    
    const stats = {
      totalLiquidaciones: liquidaciones.length,
      totalIngresos: liquidaciones.reduce((sum, l) => sum + l.totalIngresos, 0),
      totalEgresos: liquidaciones.reduce((sum, l) => sum + l.totalEgresos, 0),
      promedioIngreso: 0,
      promedioEgreso: 0,
      fincaActiva: fincaActiva // 🔥 INCLUIR FINCA EN LA RESPUESTA
    };
    
    if (stats.totalLiquidaciones > 0) {
      stats.promedioIngreso = stats.totalIngresos / stats.totalLiquidaciones;
      stats.promedioEgreso = stats.totalEgresos / stats.totalLiquidaciones;
    }
    
    console.log(`✅ Estadísticas de ${fincaActiva}:`, stats);
    
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