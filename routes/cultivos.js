const express = require('express');
const router = express.Router();
const Cultivo = require('../models/Cultivo');
const { verificarToken } = require('../middleware/auth');

// Obtener todos los cultivos del usuario en la finca activa
router.get('/', verificarToken, async (req, res) => {
  try {
    const cultivos = await Cultivo.find({ 
      usuario: req.usuario.id,
      finca: req.usuario.fincaActiva
    })
    .populate('usuario', 'nombre usuario')
    .sort({ fechaCreacion: -1 });
    
    res.json({
      success: true,
      cultivos
    });
  } catch (error) {
    console.error('Error al obtener cultivos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cultivos',
      error: error.message
    });
  }
});

// Obtener un cultivo por ID
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const cultivo = await Cultivo.findById(req.params.id)
      .populate('usuario', 'nombre usuario');
    
    if (!cultivo) {
      return res.status(404).json({
        success: false,
        message: 'Cultivo no encontrado'
      });
    }
    
    res.json({
      success: true,
      cultivo
    });
  } catch (error) {
    console.error('Error al obtener cultivo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cultivo',
      error: error.message
    });
  }
});

// Crear cultivo
router.post('/', verificarToken, async (req, res) => {
  try {
    const { nombre, variedad, cantidad } = req.body;
    
    if (!nombre || !cantidad || cantidad <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y cantidad válida son requeridos'
      });
    }

    const nuevoCultivo = await Cultivo.create({
      nombre: nombre.trim(),
      variedad: variedad ? variedad.trim() : '',
      cantidadInicial: cantidad,
      cantidadActual: cantidad,
      usuario: req.usuario.id,
      finca: req.usuario.fincaActiva
    });
    
    res.status(201).json({
      success: true,
      message: 'Cultivo registrado exitosamente',
      cultivo: nuevoCultivo
    });
  } catch (error) {
    console.error('Error al crear cultivo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear cultivo',
      error: error.message
    });
  }
});

// Actualizar cultivo
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { nombre, variedad, cantidad } = req.body;
    
    const cultivo = await Cultivo.findById(req.params.id);
    
    if (!cultivo) {
      return res.status(404).json({
        success: false,
        message: 'Cultivo no encontrado'
      });
    }
    
    if (req.usuario.rol !== 'admin' && cultivo.usuario.toString() !== req.usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para editar este cultivo'
      });
    }
    
    if (nombre) cultivo.nombre = nombre.trim();
    if (variedad !== undefined) cultivo.variedad = variedad.trim();
    if (cantidad !== undefined && cantidad >= 0) {
      cultivo.cantidadActual = cantidad;
    }
    
    await cultivo.save();
    
    res.json({
      success: true,
      message: 'Cultivo actualizado exitosamente',
      cultivo
    });
  } catch (error) {
    console.error('Error al actualizar cultivo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar cultivo',
      error: error.message
    });
  }
});

// Dar de baja cultivos
router.post('/:id/dar-baja', verificarToken, async (req, res) => {
  try {
    const { cantidad, motivo } = req.body;
    
    if (!cantidad || cantidad <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Cantidad inválida'
      });
    }

    const cultivo = await Cultivo.findById(req.params.id);
    
    if (!cultivo) {
      return res.status(404).json({
        success: false,
        message: 'Cultivo no encontrado'
      });
    }
    
    if (cantidad > cultivo.cantidadActual) {
      return res.status(400).json({
        success: false,
        message: `No puedes dar de baja ${cantidad} cultivos. Solo hay ${cultivo.cantidadActual} disponibles`
      });
    }

    cultivo.cantidadActual -= cantidad;
    cultivo.bajas.push({
      cantidad,
      motivo: motivo || 'Sin motivo especificado',
      fecha: new Date()
    });
    
    await cultivo.save();
    
    res.json({
      success: true,
      message: `Se dieron de baja ${cantidad} cultivo(s)`,
      cultivo
    });
  } catch (error) {
    console.error('Error al dar de baja cultivos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al dar de baja cultivos',
      error: error.message
    });
  }
});

// Eliminar cultivo
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const cultivo = await Cultivo.findById(req.params.id);
    
    if (!cultivo) {
      return res.status(404).json({
        success: false,
        message: 'Cultivo no encontrado'
      });
    }
    
    if (req.usuario.rol !== 'admin' && cultivo.usuario.toString() !== req.usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este cultivo'
      });
    }
    
    await Cultivo.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Cultivo eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar cultivo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar cultivo',
      error: error.message
    });
  }
});

// Obtener estadísticas
router.get('/stats/resumen', verificarToken, async (req, res) => {
  try {
    const cultivos = await Cultivo.find({ 
      usuario: req.usuario.id,
      finca: req.usuario.fincaActiva 
    });
    
    const totalCultivos = cultivos.reduce((sum, c) => sum + c.cantidadActual, 0);
    
    // Agrupar por nombre
    const porNombre = {};
    cultivos.forEach(c => {
      if (!porNombre[c.nombre]) {
        porNombre[c.nombre] = 0;
      }
      porNombre[c.nombre] += c.cantidadActual;
    });
    
    // Agrupar por variedad
    const porVariedad = {};
    cultivos.forEach(c => {
      if (c.variedad) {
        if (!porVariedad[c.variedad]) {
          porVariedad[c.variedad] = 0;
        }
        porVariedad[c.variedad] += c.cantidadActual;
      }
    });
    
    const stats = {
      totalCultivos,
      totalRegistros: cultivos.length,
      porNombre,
      porVariedad,
      totalBajas: cultivos.reduce((sum, c) => {
        return sum + c.bajas.reduce((bajasSum, b) => bajasSum + b.cantidad, 0);
      }, 0)
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

module.exports = router;