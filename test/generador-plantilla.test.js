const assert = require('node:assert/strict');
const test = require('node:test');
const JSZip = require('jszip');
const { generarDocumento } = require('../generador-plantilla');

test('genera un documento Word válido con los datos básicos', async () => {
 const documento = await generarDocumento({
  expediente: 'PRUEBA-001',
  empresa: 'Empresa de prueba'
 });

 assert.ok(Buffer.isBuffer(documento));
 const zip = await JSZip.loadAsync(documento);
 const contenido = await zip.file('word/document.xml').async('string');
 assert.match(contenido, /PRUEBA-001/);
 assert.match(contenido, /Empresa de prueba/);
});
