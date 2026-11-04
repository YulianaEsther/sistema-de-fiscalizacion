const formularioDecision = document.getElementById('form');
const botonBorradorDecision = document.getElementById('guardarBorrador');
const botonWordDecision = document.getElementById('descargarWord');
const estadoDecision = document.getElementById('estadoVistaPrevia');

formularioDecision.addEventListener('submit', evento => {
 evento.preventDefault();
 evento.stopImmediatePropagation();

 try {
  const informe = leerDatos();
  if (editId) {
   informe.id = editId;
   informe.estado = informeActual.estado || 'borrador';
  }
  previsualizar(informe);
  botonBorradorDecision.disabled = false;
  botonWordDecision.disabled = false;
  estadoDecision.textContent = 'Vista previa sin guardar. Elija guardar un borrador o confirmar la descarga.';
  document.getElementById('vista-previa').scrollIntoView({ behavior: 'smooth' });
 } catch (error) {
  console.error('Error al generar la vista previa:', error);
  alert(`Error al generar la vista previa: ${error.message}`);
 }
}, true);

async function guardarInformeDecision(estado) {
 if (!informeActual) throw new Error('Primero genere la vista previa del informe.');

 const informe = { ...informeActual, estado };
 const editar = Boolean(editId);
 const respuesta = await fetch(
  editar ? `/api/informes/${encodeURIComponent(editId)}` : '/api/informes',
  {
   method: editar ? 'PUT' : 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify(informe)
  }
 );
 const resultado = await respuesta.json();
 if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo guardar el informe.');

 editId = resultado.id;
 previsualizar(resultado);
 await listar();
 return resultado;
}

botonBorradorDecision.addEventListener('click', async evento => {
 evento.preventDefault();
 evento.stopImmediatePropagation();
 botonBorradorDecision.disabled = true;

 try {
  const guardado = await guardarInformeDecision('borrador');
  estadoDecision.textContent = `Borrador guardado para el expediente ${guardado.expediente}. Puede volver a editarlo desde la lista.`;
  alert('Borrador guardado correctamente.');
 } catch (error) {
  console.error('Error al guardar el borrador:', error);
  alert(`No se pudo guardar el borrador: ${error.message}`);
 } finally {
  botonBorradorDecision.disabled = false;
 }
}, true);

botonWordDecision.addEventListener('click', async evento => {
 evento.preventDefault();
 evento.stopImmediatePropagation();
 botonWordDecision.disabled = true;
 botonBorradorDecision.disabled = true;

 try {
  const guardado = await guardarInformeDecision('finalizado');
  estadoDecision.textContent = 'Informe confirmado. Generando el documento Word…';
  await descargarWord(guardado.id);
  estadoDecision.textContent = 'Documento Word descargado correctamente.';
 } catch (error) {
  console.error('Error al confirmar o descargar el documento Word:', error);
  estadoDecision.textContent = `No se completó la descarga: ${error.message}`;
  alert(`No se pudo completar la descarga: ${error.message}`);
 } finally {
  botonWordDecision.disabled = false;
  botonBorradorDecision.disabled = false;
 }
}, true);

formularioDecision.addEventListener('reset', () => {
 window.setTimeout(() => {
  estadoDecision.textContent = 'Complete el formulario para generar la vista previa.';
  botonBorradorDecision.disabled = true;
  botonWordDecision.disabled = true;
 }, 0);
}, true);
