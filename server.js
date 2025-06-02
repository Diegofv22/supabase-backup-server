const express = require('express');
const { execFile } = require('child_process'); // ¡Usa execFile mejor que exec!
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const axios = require('axios');
const PORT = process.env.PORT || 5000;
const { exec } = require('child_process'); // ¡Usa execFile mejor que exec!
const { createClient } = require('@supabase/supabase-js');




const poolerConfig = {
  user: 'postgres.gahkulygjhtbgslnznzz', // Nota el formato con prefijo
  password: 'AiiYSHmddKtHPHuS',
  host: 'aws-0-us-west-1.pooler.supabase.com', // Host del pooler
  port: '6543', // Puerto del pooler
  database: 'postgres'
};





// Habilitar CORS para todas las solicitudes
app.use(cors());
// Agrega esto después de app.use(cors());
app.options('/api/ia/recomendar-proveedores-insumos', cors());
app.options('/api/ia/recomendar-proveedores-cotizaciones', cors());
app.use(express.json({ limit: '10mb' })); // o más si las huellas son grandes

app.post('/restore', (req, res) => {
  const backupPath = path.join(__dirname, 'backup.sql');

  if (!fs.existsSync(backupPath)) {
    return res.status(400).json({ error: 'Archivo backup.sql no encontrado' });
  }

  // 🔁 Usa el pooler
  const restoreCommand = [
    'psql',
    `--username=${poolerConfig.user}`,
    `--host=${poolerConfig.host}`,
    `--port=${poolerConfig.port}`,
    `--dbname=${poolerConfig.database}`,
    '--file=' + backupPath
  ].join(' ');

  console.log('🔹 Ejecutando restore con pooler:', restoreCommand);

  const envVars = {
    ...process.env,
    PGPASSWORD: poolerConfig.password,
    PGSSLMODE: 'require'
  };

  exec(restoreCommand, { env: envVars }, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Error en restore:', stderr);
      return res.status(500).json({
        error: 'Error al restaurar backup',
        details: stderr
      });
    }

    console.log('✅ Restauración completada');
    res.json({ success: true, output: stdout });
  });
});




app.get('/backup', (req, res) => {
  const backupPath = path.join(__dirname, 'backup.sql');
  const backupPathFormatted = `"${backupPath.replace(/\\/g, '\\\\')}"`;

  const backupCommand = [
    'pg_dump',
    `--username=${poolerConfig.user}`,
    `--host=${poolerConfig.host}`,
    `--port=${poolerConfig.port}`,
    `--dbname=${poolerConfig.database}`,
    '--format=plain',
    '--no-owner',
    '--no-privileges',
    '--clean',          // 🔹 Agregado
    '--if-exists',      // 🔹 Agregado
    '--file=' + backupPathFormatted
  ].join(' ');

  console.log('🔹 Ejecutando backup con pooler:', backupCommand);

  const envVars = {
    ...process.env,
    PGPASSWORD: poolerConfig.password,
    PGSSLMODE: 'require'
  };

  exec(backupCommand, { env: envVars }, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Error en backup:', stderr);
      return res.status(500).json({ 
        error: 'Error al realizar backup',
        details: stderr 
      });
    }
    
    console.log('✅ Backup completado en:', backupPath);
    res.json({ 
      success: true,
      path: backupPath,
      size: fs.statSync(backupPath).size
    });
  });
});

// Ruta para respaldar la base de datos


module.exports = app;


// Ruta para registrar un solicitante y capturar la huella
app.post('/capturar-huella', async (req, res) => {
  try {
    const { idsolicitante } = req.body;
    
    console.log("Body recibido:", req.body);

    if (!idsolicitante || isNaN(idsolicitante)) {
      return res.status(400).send("ID de solicitante inválido.");
    }

    console.log(`Capturando huella para idsolicitante: ${idsolicitante}`);

    // Ruta al ejecutable
    const exePath = 'C:\\Users\\vilu2\\OneDrive\\Documentos\\Proyecto\\Inventario\\huella\\Enrollment.exe';

    // Ejecutar el programa con idsolicitante como argumento
    execFile(exePath, [idsolicitante.toString()], (error, stdout, stderr) => {
      if (error) {
        console.error(`Error al ejecutar el programa: ${error.message}`);
        return res.status(500).send('Error al ejecutar Enrollment.exe');
      }

      console.log(`Enrollment.exe stdout: ${stdout}`);
      res.status(200).send("Huella capturada correctamente");
    });

  } catch (err) {
    console.error('Error al capturar huella:', err.message);
    res.status(500).send('Error al capturar huella');
  }
});



app.get('/verificar-huella', (req, res) => {
  try {
    console.log("🟡 Ejecutando Verification.exe sin argumentos...");

    const exePath = 'C:\\Users\\vilu2\\OneDrive\\Documentos\\Proyecto\\Inventario\\huella\\Enrollment.exe';

    execFile(exePath, [], (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error al ejecutar Verification.exe: ${error.message}`);
        return res.status(500).send('Error al ejecutar Verification.exe');
      }

      console.log(`✅ Verification.exe stdout: ${stdout}`);
      res.status(200).send("Verificación de huella iniciada");
    });

  } catch (err) {
    console.error('❌ Error al verificar huella:', err.message);
    res.status(500).send('Error al verificar huella');
  }
});




// Guardar huellas como archivos .fpt desde base64
app.post('/guardar-huellas', (req, res) => {
  try {
    const huellas = req.body.huellas;

    huellas.forEach(({ idsolicitante, valorhuella }) => {
      const buffer = Buffer.from(valorhuella, 'base64'); // ← reconstruir desde base64
      const rutaDestino = `C:/Temp/huellasupabase/${idsolicitante}.fpt`;

      fs.writeFileSync(rutaDestino, buffer);
      console.log(`✅ Huella guardada en: ${rutaDestino}`);
    });

    res.send('Huellas guardadas correctamente.');
  } catch (err) {
    console.error("❌ Error al guardar huellas:", err.message);
    res.status(500).send("Error al guardar huellas");
  }
});


// Añade esta nueva ruta en server.js, junto con las demás rutas
// Añade esto en server.js, preferiblemente cerca de las otras rutas de IA
// Añade esto ANTES del app.listen()
app.get('/api/ia/anomalias', async (req, res) => {
    console.log('Accediendo a endpoint de anomalías'); // Para debug
    try {
        const response = await axios.get('http://localhost:8000/anomalias/insumos');
        
        if (response.data.error) {
            return res.status(500).json(response.data);
        }
        
        res.json({
            anomalias: response.data.anomalias,
            fecha_analisis: response.data.fecha_analisis,
            total_insumos: response.data.total_insumos,
            total_anomalias: response.data.total_anomalias
        });
    } catch (error) {
        console.error("Error en proxy de anomalías:", error);
        res.status(500).json({ 
            error: "Error al detectar anomalías",
            detalle: error.message 
        });
    }
});



// Ruta proxy para IA
// Ruta proxy para IA (mejorada)
app.get('/api/ia/predecir/:idInsumo', async (req, res) => {
    try {
        const { idInsumo } = req.params;
        
        // Verificar que el idInsumo sea válido
        if (!idInsumo || isNaN(idInsumo)) {
            return res.status(400).json({ error: "ID de insumo inválido" });
        }

        const response = await axios.get(
            `http://localhost:8000/predecir/${idInsumo}`
        );
        
        // Validar la respuesta de la IA
        if (response.data.error) {
            return res.status(500).json(response.data);
        }
        
        res.json({
            prediccion: response.data.cantidad_a_comprar,
            modelo: response.data.modelo,
            fecha: response.data.fecha,
            stock_actual: response.data.stock_actual,
            demanda_predicha: response.data.prediccion
        });
        
    } catch (error) {
        console.error("Error en el servidor de IA:", error.message);
        res.status(500).json({ 
            error: "Error al obtener la predicción",
            detalle: error.message 
        });
    }
});


// Eliminar las rutas anteriores de recomendación y agregar estas:

// Ruta para mejores proveedores por insumos
app.get('/api/ia/mejores-proveedores-insumos', async (req, res) => {
  try {
    const response = await axios.get(
      'http://localhost:8000/mejores-proveedores-insumos'
    );
    
    res.json({
      proveedores: response.data.proveedores,
      fecha_analisis: response.data.fecha_analisis
    });
    
  } catch (error) {
    console.error("Error al obtener mejores proveedores (insumos):", error);
    res.status(500).json({ 
      error: "Error al obtener recomendación",
      detalle: error.message 
    });
  }
});

// Ruta para mejores proveedores por cotizaciones
app.get('/api/ia/mejores-proveedores-cotizaciones', async (req, res) => {
  try {
    const response = await axios.get(
      'http://localhost:8000/mejores-proveedores-cotizaciones'
    );
    
    res.json({
      proveedores: response.data.proveedores,
      fecha_analisis: response.data.fecha_analisis
    });
    
  } catch (error) {
    console.error("Error al obtener mejores proveedores (cotizaciones):", error);
    res.status(500).json({ 
      error: "Error al obtener recomendación",
      detalle: error.message 
    });
  }
});



app.get('/descargar-backup', (req, res) => {
  const backupPath = path.join(__dirname, 'backup.sql');
  
  if (fs.existsSync(backupPath)) {
    res.download(backupPath);
  } else {
    res.status(404).send('Archivo de backup no encontrado');
  }
});

app.get('/verificar-psql', (req, res) => {
  exec('psql --version', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Error verificando psql:', stderr);
      return res.status(500).send('psql no disponible');
    }
    res.send(`✅ psql disponible: ${stdout}`);
  });
});









app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});  

