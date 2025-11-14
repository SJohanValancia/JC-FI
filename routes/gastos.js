const express = require('express');
const router = express.Router();
const Gasto = require('../models/Gasto');
const { verificarToken } = require('../middleware/auth');

// Obtener todos los gastos
router.get('/', verificarToken, async (req, res) => {
  try {
    const gastos = await Gasto.find()
      .populate('usuario', 'nombre usuario')
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

// Crear gastos (uno o varios)
router.post('/', verificarToken, async (req, res) => {
  try {
    const { gastos } = req.body;
    
    if (!gastos || !Array.isArray(gastos) || gastos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un gasto'
      });
    }
    
    // Validar cada gasto
    for (let gasto of gastos) {
      if (!gasto.descripcion || !gasto.valor || gasto.valor <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Todos los gastos deben tener descripción y valor válido'
        });
      }
    }
    
    // Crear gastos con información del usuario
    const gastosCreados = await Promise.all(
      gastos.map(gasto => {
        return Gasto.create({
          ...gasto,
          usuario: req.usuario.id,
          usuarioNombre: req.usuario.usuario
        });
      })
    );
    
    res.status(201).json({
      success: true,
      message: `${gastosCreados.length} gasto(s) creado(s) exitosamente`,
      gastos: gastosCreados
    });
  } catch (error) {
    console.error('Error al crear gastos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear gastos',
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
    
    // Verificar permisos (solo admin o el creador pueden editar)
    if (req.usuario.rol !== 'admin' && gasto.usuario.toString() !== req.usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para editar este gasto'
      });
    }
    
    // Actualizar campos
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
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const gasto = await Gasto.findById(req.params.id);
    
    if (!gasto) {
      return res.status(404).json({
        success: false,
        message: 'Gasto no encontrado'
      });
    }
    
    // Verificar permisos (solo admin o el creador pueden eliminar)
    if (req.usuario.rol !== 'admin' && gasto.usuario.toString() !== req.usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este gasto'
      });
    }
    
    await Gasto.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Gasto eliminado exitosamente'
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