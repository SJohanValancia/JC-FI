const express = require('express');
const router = express.Router();
const Inventario = require('../models/Inventario');
const { verificarToken } = require('../middleware/auth');

// Obtener todo el inventario del usuario
router.get('/', verificarToken, async (req, res) => {
  try {
    const inventario = await Inventario.find({ usuario: req.usuario.id, finca: req.usuario.fincaActiva })
      .populate('usuario', 'nombre usuario')
      .sort({ fechaCreacion: -1 });
    
    res.json({
      success: true,
      inventario,
      total: inventario.length
    });
  } catch (error) {
    console.error('Error al obtener inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener inventario',
      error: error.message
    });
  }
});

// Obtener un producto por ID
router.get('/:id', verificarToken, async (req, res) => {
  try {
const producto = await Inventario.findOne({
  _id: req.params.id,
  usuario: req.usuario.id,
  finca: req.usuario.fincaActiva
}).populate('usuario', 'nombre usuario');
    
    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    res.json({
      success: true,
      producto
    });
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener producto',
      error: error.message
    });
  }
});

// Crear producto
router.post('/', verificarToken, async (req, res) => {
  try {
    const { nombre, precio, litros, categoria, stock } = req.body;
    
    if (!nombre || !precio || precio <= 0 || !categoria || stock === undefined || stock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos obligatorios deben ser válidos'
      });
    }
    
    const nuevoProducto = await Inventario.create({
      nombre,
      precio,
      litros: litros || null,
      categoria,
      stock,
      usuario: req.usuario.id,
      usuarioNombre: req.usuario.usuario,
      finca: req.usuario.fincaActiva
    });
    
    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      producto: nuevoProducto
    });
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear producto',
      error: error.message
    });
  }
});

// Actualizar producto
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { nombre, precio, litros, categoria, stock } = req.body;
    
const producto = await Inventario.findOne({
  _id: req.params.id,
  usuario: req.usuario.id,
  finca: req.usuario.fincaActiva
});
    
    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    if (nombre) producto.nombre = nombre;
    if (precio !== undefined) producto.precio = precio;
    if (litros !== undefined) producto.litros = litros;
    if (categoria) producto.categoria = categoria;
    if (stock !== undefined) producto.stock = stock;
    
    await producto.save();
    
    res.json({
      success: true,
      message: 'Producto actualizado exitosamente',
      producto
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar producto',
      error: error.message
    });
  }
});

// Eliminar producto
router.delete('/:id', verificarToken, async (req, res) => {
  try {
const producto = await Inventario.findOne({
  _id: req.params.id,
  usuario: req.usuario.id,
  finca: req.usuario.fincaActiva
});
    
    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    await Inventario.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Producto eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar producto',
      error: error.message
    });
  }
});

// Obtener estadísticas
router.get('/stats/resumen', verificarToken, async (req, res) => {
  try {
    const inventario = await Inventario.find({ 
  usuario: req.usuario.id,
  finca: req.usuario.fincaActiva
})
    
    const stats = {
      totalProductos: inventario.length,
      valorTotal: inventario.reduce((sum, item) => sum + (item.precio * item.stock), 0),
      porCategoria: {}
    };
    
    inventario.forEach(item => {
      if (!stats.porCategoria[item.categoria]) {
        stats.porCategoria[item.categoria] = 0;
      }
      stats.porCategoria[item.categoria]++;
    });
    
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

// Obtener alertas de stock bajo
router.get('/alertas/stock-bajo', verificarToken, async (req, res) => {
  try {
    // Limite configurable (por defecto 5 unidades)
    const limite = parseInt(req.query.limite) || 5;
    
const productosBajoStock = await Inventario.find({
  usuario: req.usuario.id,
  finca: req.usuario.fincaActiva,
  stock: { $lte: limite }
}).sort({ stock: 1 }); // Ordenar por stock ascendente
    
    const alertas = productosBajoStock.map(producto => ({
      id: producto._id,
      nombre: producto.nombre,
      stock: producto.stock,
      categoria: producto.categoria,
      precio: producto.precio
    }));
    
    res.json({
      success: true,
      alertas,
      total: alertas.length,
      limite
    });
  } catch (error) {
    console.error('Error al verificar stock bajo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar stock bajo',
      error: error.message
    });
  }
});

module.exports = router;