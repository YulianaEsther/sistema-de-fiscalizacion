const express = require('express');
const fs = require('fs');
const path = require('path');
const { generarDocumento } = require('./generador-plantilla');

const app = express();
const PORT = 3000;
const file = path.join(__dirname, 'informes.json');

app.use(express.json());
app.use('/vendor/docx-preview', express.static(path.join(__dirname, 'node_modules', 'docx-preview', 'dist')));
app.use('/vendor/jszip', express.static(path.join(__dirname, 'node_modules', 'jszip', 'dist')));
app.get('/', (req, res) => {
 res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use(express.static(path.join(__dirname, 'public')));

function read() {
 if (!fs.existsSync(file)) {
  fs.writeFileSync(file, '[]', 'utf8');
  return [];
 }
 const contenido = fs.readFileSync(file, 'utf8').trim();
 if (!contenido) return [];
 const informes = JSON.parse(contenido);
 if (!Array.isArray(informes)) {
  throw new Error('informes.json debe contener un arreglo');
 }
 return informes;
}

function save(informes) {
 fs.writeFileSync(file, JSON.stringify(informes, null, 2), 'utf8');
}

function validar(informe) {
 if (!informe || typeof informe !== 'object' || Array.isArray(informe)) {
  return 'No se recibieron datos válidos';
 }
 if (typeof informe.expediente !== 'string' || !informe.expediente.trim()) {
  return 'Debe ingresar el número de expediente';
 }
 if (typeof informe.empresa !== 'string' || !informe.empresa.trim()) {
  return 'Debe ingresar el nombre de la empresa';
 }
 return null;
}

app.get('/api/informes', (req, res) => {
 res.json(read());
});

app.post('/api/informes/preview', async (req, res, next) => {
 try {
  const error = validar(req.body);
  if (error) return res.status(400).json({ error });
  const documento = await generarDocumento(req.body);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', 'inline; filename="Vista_Previa.docx"');
  res.send(documento);
 } catch (error) {
  next(error);
 }
});

app.get('/api/informes/:id/docx', async (req, res, next) => {
 try {
  const informe = read().find(item => item.id === req.params.id);
  if (!informe) {
   return res.status(404).json({ error: 'Informe no encontrado' });
  }
  const documento = await generarDocumento(informe);
  const expediente = String(informe.expediente || 'informe')
   .replace(/[^\w.-]+/g, '_');
  res.setHeader(
   'Content-Type',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  res.setHeader(
   'Content-Disposition',
   `attachment; filename="Informe_Supervision_${expediente}.docx"`
  );
  res.send(documento);
 } catch (error) {
  next(error);
 }
});

app.get('/api/informes/:id', (req, res) => {
 const informe = read().find(item => item.id === req.params.id);
 if (!informe) {
  return res.status(404).json({ error: 'Informe no encontrado' });
 }
 res.json(informe);
});

app.post('/api/informes', (req, res) => {
 const error = validar(req.body);
 if (error) return res.status(400).json({ error });
 const informes = read();
 const nuevo = {
  ...req.body,
  expediente: req.body.expediente.trim(),
  empresa: req.body.empresa.trim(),
  id: String(Date.now())
 };
 informes.push(nuevo);
 save(informes);
 res.status(201).json(nuevo);
});

app.put('/api/informes/:id', (req, res) => {
 const error = validar(req.body);
 if (error) return res.status(400).json({ error });
 const informes = read();
 const indice = informes.findIndex(item => item.id === req.params.id);
 if (indice === -1) {
  return res.status(404).json({ error: 'Informe no encontrado' });
 }
 informes[indice] = {
  ...req.body,
  expediente: req.body.expediente.trim(),
  empresa: req.body.empresa.trim(),
  id: req.params.id
 };
 save(informes);
 res.json(informes[indice]);
});

app.delete('/api/informes/:id', (req, res) => {
 const informes = read();
 const restantes = informes.filter(item => item.id !== req.params.id);
 if (restantes.length === informes.length) {
  return res.status(404).json({ error: 'Informe no encontrado' });
 }
 save(restantes);
 res.status(204).end();
});

app.use((error, req, res, next) => {
 console.error('Error del servidor:', error);
 if (res.headersSent) return next(error);
 res.status(error.status || 500).json({
  error: error.status === 400
   ? 'El JSON enviado no es válido'
   : 'Error interno del servidor'
 });
});

app.listen(PORT, () => {
 console.log('================================');
 console.log(' SISFIS_DARWIN INICIADO');
 console.log(` http://localhost:${PORT}`);
 console.log('================================');
});
