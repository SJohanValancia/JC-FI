const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');
const mongoose = require('mongoose');

// Modelo de Entrada
const entradaSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  usuarioNombre: {
    type: String,
    required: true
  },
  finca: {
    type: String,
    required: true,
    index: true
  },
  fechaEntrada: {
    type: Date,
    required: true,
    index: true
  },
  descripcion: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  valor: {
    type: Number,
    required: true,
    min: 0
  },
  fechaCreacion: {
    type: Date,
    default: Date.now,
    index: true
  },
  ultimaModificacion: {
    type: Date,
    default: Date.now
  }
});

// Índice compuesto para búsquedas eficientes
entradaSchema.index({ usuario: 1, finca: 1, fechaEntrada: -1 });

const Entrada = mongoose.model('Entrada', entradaSchema);

// 📌 CREAR ENTRADA
router.post('/', verificarToken, async (req, res) => {
  try {
    const { fechaEntrada, descripcion, valor } = req.body;
    
    if (!fechaEntrada || !descripcion || !valor) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios'
      });
    }

    if (valor <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El valor debe ser mayor a 0'
      });
    }

    // Validar que la fecha no sea futura
    const fechaEntradaObj = new Date(fechaEntrada);
    if (fechaEntradaObj > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'La fecha de entrada no puede ser mayor a hoy'
      });
    }

    const nuevaEntrada = new Entrada({
      usuario: req.usuario.id,
      usuarioNombre: req.usuario.nombre || req.usuario.usuario,
      finca: req.usuario.fincaActiva || req.usuario.finca,
      fechaEntrada: fechaEntradaObj,
      descripcion: descripcion.trim(),
      valor: parseFloat(valor)
    });

    await nuevaEntrada.save();

    res.status(201).json({
      success: true,
      message: 'Entrada registrada exitosamente',
      entrada: nuevaEntrada
    });

  } catch (error) {
    console.error('Error al crear entrada:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear entrada',
      error: error.message
    });
  }
});

// 📌 OBTENER ENTRADAS (con filtros mejorados)
router.get('/', verificarToken, async (req, res) => {
  try {
    const { fechaInicio, fechaFin, descripcion, montoMin, montoMax, limite } = req.query;
    
    const filtro = {
      usuario: req.usuario.id,
      finca: req.usuario.fincaActiva || req.usuario.finca
    };

    // Filtrar por fecha
    if (fechaInicio || fechaFin) {
      filtro.fechaEntrada = {};
      if (fechaInicio) {
        filtro.fechaEntrada.$gte = new Date(fechaInicio + 'T00:00:00');
      }
      if (fechaFin) {
        filtro.fechaEntrada.$lte = new Date(fechaFin + 'T23:59:59');
      }
    }

    // Filtrar por descripción (búsqueda insensible a mayúsculas)
    if (descripcion) {
      filtro.descripcion = { $regex: descripcion, $options: 'i' };
    }

    // Filtrar por monto
    if (montoMin || montoMax) {
      filtro.valor = {};
      if (montoMin) filtro.valor.$gte = parseFloat(montoMin);
      if (montoMax) filtro.valor.$lte = parseFloat(montoMax);
    }

    let query = Entrada.find(filtro).sort({ fechaEntrada: -1, fechaCreacion: -1 });
    
    // Limitar resultados si se especifica
    if (limite) {
      query = query.limit(parseInt(limite));
    }

    const entradas = await query;

    const total = entradas.reduce((sum, e) => sum + e.valor, 0);
    const promedio = entradas.length > 0 ? total / entradas.length : 0;

    res.json({
      success: true,
      entradas,
      estadisticas: {
        total: entradas.length,
        totalValor: total,
        promedio: promedio
      }
    });

  } catch (error) {
    console.error('Error al obtener entradas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener entradas',
      error: error.message
    });
  }
});

// 📌 OBTENER UNA ENTRADA POR ID
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const entrada = await Entrada.findOne({
      _id: req.params.id,
      usuario: req.usuario.id
    });

    if (!entrada) {
      return res.status(404).json({
        success: false,
        message: 'Entrada no encontrada'
      });
    }

    res.json({
      success: true,
      entrada
    });

  } catch (error) {
    console.error('Error al obtener entrada:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener entrada'
    });
  }
});

// 📌 ACTUALIZAR ENTRADA
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { fechaEntrada, descripcion, valor } = req.body;

    if (!fechaEntrada || !descripcion || !valor) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios'
      });
    }

    if (valor <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El valor debe ser mayor a 0'
      });
    }

    // Validar que la fecha no sea futura
    const fechaEntradaObj = new Date(fechaEntrada);
    if (fechaEntradaObj > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'La fecha de entrada no puede ser mayor a hoy'
      });
    }

    const entrada = await Entrada.findOneAndUpdate(
      { _id: req.params.id, usuario: req.usuario.id },
      {
        fechaEntrada: fechaEntradaObj,
        descripcion: descripcion.trim(),
        valor: parseFloat(valor),
        ultimaModificacion: Date.now()
      },
      { new: true }
    );

    if (!entrada) {
      return res.status(404).json({
        success: false,
        message: 'Entrada no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Entrada actualizada exitosamente',
      entrada
    });

  } catch (error) {
    console.error('Error al actualizar entrada:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar entrada',
      error: error.message
    });
  }
});

// 📌 ELIMINAR ENTRADA
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const entrada = await Entrada.findOneAndDelete({
      _id: req.params.id,
      usuario: req.usuario.id
    });

    if (!entrada) {
      return res.status(404).json({
        success: false,
        message: 'Entrada no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Entrada eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar entrada:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar entrada'
    });
  }
});

// 📌 ESTADÍSTICAS RESUMEN (MEJORADO)
router.get('/stats/resumen', verificarToken, async (req, res) => {
  try {
    const filtro = {
      usuario: req.usuario.id,
      finca: req.usuario.fincaActiva || req.usuario.finca
    };

    const entradas = await Entrada.find(filtro);
    
    const totalEntradas = entradas.length;
    const totalValor = entradas.reduce((sum, e) => sum + e.valor, 0);
    const promedio = totalEntradas > 0 ? totalValor / totalEntradas : 0;

    // Entrada más alta
    const entradaMasAlta = entradas.length > 0 
      ? Math.max(...entradas.map(e => e.valor))
      : 0;

    // Entradas del mes actual
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    inicioMes.setHours(0, 0, 0, 0);

    const entradasMes = entradas.filter(e => 
      new Date(e.fechaEntrada) >= inicioMes
    );
    const totalMes = entradasMes.reduce((sum, e) => sum + e.valor, 0);

    // Entradas de la semana actual
    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() - ahora.getDay());
    inicioSemana.setHours(0, 0, 0, 0);

    const entradasSemana = entradas.filter(e =>
      new Date(e.fechaEntrada) >= inicioSemana
    );
    const totalSemana = entradasSemana.reduce((sum, e) => sum + e.valor, 0);

    res.json({
      success: true,
      stats: {
        totalEntradas,
        totalValor,
        promedio,
        entradaMasAlta,
        entradasMes: entradasMes.length,
        totalMes,
        entradasSemana: entradasSemana.length,
        totalSemana
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

module.exports = router;