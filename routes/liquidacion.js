const express = require('express');
const router = express.Router();
const Liquidacion = require('../models/Liquidacion');
const Gasto = require('../models/Gasto');
const Inventario = require('../models/Inventario');
const { verificarToken } = require('../middleware/auth');
const axios = require('axios'); // Necesario para llamar a la otra API
    const User = require('../models/User'); // Asegúrate de importar el modelo


// 🔥 OBTENER RECOGIDAS SIN LIQUIDAR DE JC-FRUTAS
// 🔥 OBTENER RECOGIDAS SIN LIQUIDAR DE JC-FRUTAS
router.get('/recogidas-pendientes', verificarToken, async (req, res) => {
  try {
    const usuario = req.usuario.usuario;
    
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
router.post('/procesar', verificarToken, async (req, res) => {
  try {
    const { 
      cajaInicial,
      recogidasPagadas, // Array de IDs de recogidas que se pagaron
      ingresosAdicionales,
      gastosIds,
      notas
    } = req.body;
    
    const User = require('../models/User');
    
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
    
    if (!Array.isArray(recogidasPagadas) || !Array.isArray(gastosIds)) {
      return res.status(400).json({
        success: false,
        message: 'Datos de liquidación inválidos'
      });
    }
    
    // 1️⃣ Obtener información detallada de recogidas desde JC-Frutas
    let recogidasDetalle = [];
    let totalRecogidas = 0;
    
    if (recogidasPagadas.length > 0) {
      try {
        const responseRecogidas = await axios.post(
          'https://jc-frutas.onrender.com/recogidas/obtener-multiples',
          { ids: recogidasPagadas }
        );
        
        // 🔥 FILTRAR SOLO RECOGIDAS DE LA FINCA ACTIVA
        const recogidasFiltradas = responseRecogidas.data.filter(r => 
          r.finca === fincaActiva
        );
        
        if (recogidasFiltradas.length !== responseRecogidas.data.length) {
          console.warn(`⚠️ Se filtraron ${responseRecogidas.data.length - recogidasFiltradas.length} recogidas de otras fincas`);
        }
        
        recogidasDetalle = recogidasFiltradas.map(r => ({
          recogidaId: r._id,
          finca: r.finca,
          fecha: r.fecha,
          kilos: r.totalKilos,
          valor: r.valorPagar
        }));
        
        totalRecogidas = recogidasDetalle.reduce((sum, r) => sum + r.valor, 0);
        console.log(`✅ Total recogidas de ${fincaActiva}: $${totalRecogidas}`);
      } catch (error) {
        console.error('Error al obtener recogidas:', error);
      }
    }
    
    // 2️⃣ Obtener información de gastos - 🔥 FILTRADO POR FINCA ACTIVA
    const gastos = await Gasto.find({ 
      _id: { $in: gastosIds },
      usuario: req.usuario.id,
      finca: fincaActiva // 🔥 FILTRO CRÍTICO
    });
    
    // 🔥 VERIFICAR QUE TODOS LOS GASTOS PERTENEZCAN A LA FINCA ACTIVA
    if (gastos.length !== gastosIds.length) {
      console.warn(`⚠️ Se encontraron ${gastos.length} de ${gastosIds.length} gastos solicitados para la finca ${fincaActiva}`);
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
        finca: gasto.finca // 🔥 INCLUIR FINCA EN DETALLE
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
    
    // 3️⃣ Calcular ingresos adicionales
    const totalIngresosAdicionales = (ingresosAdicionales || []).reduce(
      (sum, ing) => sum + (ing.valor || 0), 
      0
    );
    
    // 4️⃣ Crear liquidación - 🔥 INCLUIR FINCA
    const liquidacion = new Liquidacion({
      usuario: req.usuario.id,
      usuarioNombre: req.usuario.usuario,
      finca: fincaActiva, // 🔥 AGREGAR CAMPO FINCA
      cajaInicial: cajaInicial || 0,
      ingresoRecogidas: totalRecogidas,
      ingresosAdicionales: ingresosAdicionales || [],
      totalIngresosAdicionales: totalIngresosAdicionales,
      totalEgresos: totalGastos,
      recogidasLiquidadas: recogidasDetalle,
      gastosLiquidados: gastosDetalle,
      inventarioUsado: inventarioDetalle,
      notas: notas || ''
    });
    
    liquidacion.calcularTotales();
    await liquidacion.save();
    
    console.log(`✅ Liquidación creada para finca ${fincaActiva}: ID ${liquidacion._id}`);
    
    // 5️⃣ Marcar gastos como liquidados
    const resultGastos = await Gasto.updateMany(
      { 
        _id: { $in: gastosIds },
        finca: fincaActiva // 🔥 VERIFICACIÓN ADICIONAL
      },
      { 
        $set: { 
          reciboDia: true,
          fechaLiquidacion: new Date(),
          liquidacionId: liquidacion._id
        } 
      }
    );
    
    console.log(`✅ ${resultGastos.modifiedCount} gastos marcados como liquidados`);
    
    // 6️⃣ Marcar recogidas como liquidadas en JC-Frutas
    if (recogidasPagadas.length > 0) {
      try {
        await axios.post(
          'https://jc-frutas.onrender.com/recogidas/marcar-liquidadas',
          { 
            ids: recogidasPagadas,
            liquidacionId: liquidacion._id.toString(),
            finca: fincaActiva // 🔥 ENVIAR FINCA PARA VERIFICACIÓN
          }
        );
        console.log(`✅ ${recogidasPagadas.length} recogidas marcadas como liquidadas en JC-Frutas`);
      } catch (error) {
        console.error('Error al marcar recogidas como liquidadas:', error);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Liquidación procesada exitosamente para ${fincaActiva}`,
      liquidacion,
      fincaActiva: fincaActiva,
      resumen: {
        totalRecogidas: recogidasDetalle.length,
        totalGastos: gastos.length,
        valorRecogidas: totalRecogidas,
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