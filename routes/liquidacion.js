const express = require('express');
const router = express.Router();
const Liquidacion = require('../models/Liquidacion');
const Gasto = require('../models/Gasto');
const Inventario = require('../models/Inventario');
const { verificarToken } = require('../middleware/auth');
const axios = require('axios'); // Necesario para llamar a la otra API

// 🔥 OBTENER RECOGIDAS SIN LIQUIDAR DE JC-FRUTAS
// 🔥 OBTENER RECOGIDAS SIN LIQUIDAR DE JC-FRUTAS
router.get('/recogidas-pendientes', verificarToken, async (req, res) => {
  try {
    const usuario = req.usuario.usuario;
    const User = require('../models/User'); // Asegúrate de importar el modelo
    
    // Obtener la finca activa del usuario
    const usuarioData = await User.findById(req.usuario.id);
    if (!usuarioData || !usuarioData.fincaActiva) {
      return res.json({ 
        success: true, 
        recogidas: [],
        message: 'No hay finca activa seleccionada'
      });
    }
    
    const fincaActiva = usuarioData.fincaActiva;
    
    // Llamar a la API de JC-Frutas
    const response = await axios.get(
      `https://jc-frutas.onrender.com/recogidas/sin-liquidar/${usuario}`
    );
    
    if (!response.data) {
      return res.json({ success: true, recogidas: [] });
    }
    
    // 🔥 FILTRAR SOLO LAS RECOGIDAS DE LA FINCA ACTIVA
    const recogidasFiltradas = response.data.filter(r => 
      r.finca === fincaActiva
    );
    
    res.json({ 
      success: true, 
      recogidas: recogidasFiltradas,
      fincaActiva: fincaActiva
    });
  } catch (error) {
    console.error('Error al obtener recogidas pendientes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener recogidas pendientes',
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
// 🔥 PROCESAR LIQUIDACIÓN COMPLETA
router.post('/procesar', verificarToken, async (req, res) => {
  try {
    const { 
      cajaInicial,
      recogidasPagadas,
      ingresosAdicionales,
      gastosIds,
      notas
    } = req.body;
    
    const User = require('../models/User');
    
    // Obtener la finca activa del usuario
    const usuarioData = await User.findById(req.usuario.id);
    if (!usuarioData || !usuarioData.fincaActiva) {
      return res.status(400).json({
        success: false,
        message: 'No hay finca activa seleccionada'
      });
    }
    
    const fincaActiva = usuarioData.fincaActiva;
    
    if (!Array.isArray(recogidasPagadas) || !Array.isArray(gastosIds)) {
      return res.status(400).json({
        success: false,
        message: 'Datos de liquidación inválidos'
      });
    }
    
    // ... resto del código igual hasta crear la liquidación ...
    
    // 2️⃣ Obtener información de gastos - FILTRADO POR FINCA
    const gastos = await Gasto.find({ 
      _id: { $in: gastosIds },
      usuario: req.usuario.id,
      finca: fincaActiva // 🔥 VERIFICACIÓN ADICIONAL
    });
    
    // ... resto del código igual ...
    
    res.json({ 
      success: true, 
      message: 'Liquidación procesada exitosamente',
      liquidacion,
      fincaActiva: fincaActiva
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