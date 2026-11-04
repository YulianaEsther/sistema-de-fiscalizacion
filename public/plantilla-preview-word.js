(function () {
 const estado = document.getElementById('estadoVistaPrevia');
 const vista = document.getElementById('vista');
 let version = 0;
 const previsualizarOriginal = window.previsualizar;
 const formulario = document.getElementById('form');
 formulario.addEventListener('reset', () => { version++; });

 async function renderizar(informe, actual) {
  const numero = actual;
  estado.textContent = 'Generando la vista previa con la plantilla Word…';
  vista.replaceChildren();
  vista.classList.add('docx-rendered');
  const guardado = Boolean(informe.id);
  const respuesta = await fetch(
   guardado
    ? `/api/informes/${encodeURIComponent(informe.id)}/docx`
    : '/api/informes/preview',
   guardado
    ? { method: 'GET' }
    : {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(informe)
    }
  );
  if (!respuesta.ok) {
   const error = await respuesta.json().catch(() => ({}));
   throw new Error(error.error || 'No se pudo generar la vista previa Word.');
  }
  const documento = await respuesta.arrayBuffer();
  if (numero !== version || actual !== version) return;
  await window.docx.renderAsync(documento, vista, vista, {
   className: 'docx',
   breakPages: true,
   ignoreLastRenderedPageBreak: false,
   useBase64URL: true,
   renderHeaders: true,
   renderFooters: true,
   renderFootnotes: true,
   renderEndnotes: true
  });
  if (numero === version) {
   estado.textContent = guardado
    ? 'Vista previa del documento Word. Los cambios no guardados no se incluirán.'
    : 'Vista previa del documento Word sin guardar. Elija guardar un borrador o confirmar la descarga.';
  }
 }

 if (typeof previsualizarOriginal !== 'function') {
  throw new Error('No se encontró la función de vista previa del formulario.');
 }

 window.previsualizar = function (informe) {
  previsualizarOriginal(informe);
  const actual = ++version;
  renderizar(informe, actual).catch(error => {
   if (actual !== version) return;
   console.error('Error al renderizar la plantilla Word:', error);
   estado.textContent = `No se pudo generar la vista previa Word: ${error.message}`;
   alert(`No se pudo generar la vista previa Word: ${error.message}`);
  });
 };
})();
