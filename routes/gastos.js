const express = require('express');
const router = express.Router();
const Gasto = require('../models/Gasto');
const Inventario = require('../models/Inventario');
const { verificarToken } = require('../middleware/auth');

// Obtener todos los gastos del usuario
router.get('/', verificarToken, async (req, res) => {
  try {
const gastos = await Gasto.find({ 
  usuario: req.usuario.id,
  finca: req.usuario.fincaActiva  // 🔥 AGREGAR
})      .populate('usuario', 'nombre usuario')
      .sort({ fechaCreacion: -1 });
    
    res.json({
      success: true,
      gastos
    });
  } catch (error) {
    console.error('Error al obtener gastos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener gastos',
      error: error.message
    });
  }
});

// Obtener un gasto por ID
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const gasto = await Gasto.findById(req.params.id)
      .populate('usuario', 'nombre usuario');
    
    if (!gasto) {
      return res.status(404).json({
        success: false,
        message: 'Gasto no encontrado'
      });
    }
    
    res.json({
      success: true,
      gasto
    });
  } catch (error) {
    console.error('Error al obtener gasto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener gasto',
      error: error.message
    });
  }
});

// Crear gasto (único) con descuento de inventario
router.post('/', verificarToken, async (req, res) => {
  try {
    const { fechaGasto, descripcion, valor, productosInventario } = req.body;
    
    if (!descripcion || !valor || valor <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar descripción y valor válido'
      });
    }

    // Validar productos del inventario
    if (productosInventario && productosInventario.length > 0) {
      for (let prod of productosInventario) {
        const producto = await Inventario.findById(prod.inventarioId);
        if (!producto) {
          return res.status(404).json({
            success: false,
            message: `El producto ${prod.nombre} no existe`
          });
        }
        
        if (producto.stock < prod.cantidadUsada) {
          return res.status(400).json({
            success: false,
            message: `Stock insuficiente de ${prod.nombre}. Disponible: ${producto.stock}`
          });
        }
      }
    }
    
    // 🔥 CREAR FECHA CORRECTAMENTE - Parseando como fecha local en Colombia
    let fechaGastoFinal;
    if (fechaGasto) {
      // Extraer año, mes, día del string "2024-01-15"
      const [year, month, day] = fechaGasto.split('-').map(Number);
      // Crear fecha en hora local de Colombia (UTC-5)
      fechaGastoFinal = new Date(year, month - 1, day, 12, 0, 0);
    } else {
      fechaGastoFinal = new Date();
    }
    
    console.log('📅 Fecha recibida:', fechaGasto);
    console.log('📅 Fecha procesada:', fechaGastoFinal);
    
    // Crear el gasto
    const nuevoGasto = await Gasto.create({
      fechaGasto: fechaGastoFinal,
      descripcion,
      valor,
      productosInventario: productosInventario || [],
      usuario: req.usuario.id,
      usuarioNombre: req.usuario.usuario,
      finca: req.usuario.fincaActiva
    });
    
    // Descontar del inventario
    if (productosInventario && productosInventario.length > 0) {
      for (let prod of productosInventario) {
        await Inventario.findByIdAndUpdate(
          prod.inventarioId,
          { $inc: { stock: -prod.cantidadUsada } }
        );
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Gasto registrado exitosamente',
      gasto: nuevoGasto
    });
  } catch (error) {
    console.error('Error al crear gasto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear gasto',
      error: error.message
    });
  }
});

// Obtener estadísticas
router.get('/stats/resumen', verificarToken, async (req, res) => {
  try {
    const gastos = await Gasto.find({ 
  usuario: req.usuario.id,
  finca: req.usuario.fincaActiva 
});
    
    const stats = {
      totalGastos: gastos.length,
      totalValor: gastos.reduce((sum, gasto) => sum + gasto.valor, 0)
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
});

// Actualizar un gasto
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { descripcion, valor, inventario } = req.body;
    
    const gasto = await Gasto.findById(req.params.id);
    
    if (!gasto) {
      return res.status(404).json({
        success: false,
        message: 'Gasto no encontrado'
      });
    }
    
    if (req.usuario.rol !== 'admin' && gasto.usuario.toString() !== req.usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para editar este gasto'
      });
    }
    
    if (descripcion) gasto.descripcion = descripcion;
    if (valor) gasto.valor = valor;
    if (inventario !== undefined) gasto.inventario = inventario;
    
    await gasto.save();
    
    res.json({
      success: true,
      message: 'Gasto actualizado exitosamente',
      gasto
    });
  } catch (error) {
    console.error('Error al actualizar gasto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar gasto',
      error: error.message
    });
  }
});

// Eliminar un gasto
// Eliminar un gasto
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const gasto = await Gasto.findById(req.params.id);
    
    if (!gasto) {
      return res.status(404).json({
        success: false,
        message: 'Gasto no encontrado'
      });
    }
    
    if (req.usuario.rol !== 'admin' && gasto.usuario.toString() !== req.usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este gasto'
      });
    }
    
    // 🔥 NUEVO: Devolver productos al inventario ANTES de eliminar
    if (gasto.productosInventario && gasto.productosInventario.length > 0) {
      for (let prod of gasto.productosInventario) {
        await Inventario.findByIdAndUpdate(
          prod.inventarioId,
          { $inc: { stock: prod.cantidadUsada } } // Sumar de vuelta al stock
        );
      }
    }
    
    await Gasto.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Gasto eliminado exitosamente',
      productosDevueltos: gasto.productosInventario.length // Info adicional
    });
  } catch (error) {
    console.error('Error al eliminar gasto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar gasto',
      error: error.message
    });
  }
});

module.exports = router;