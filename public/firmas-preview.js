const vistaFirmas = document.getElementById('vista');
let solicitudFirmas = 0;

function crearFirma(titulo, nombre, identificacion, empresa) {
 const bloque = document.createElement('div');
 bloque.className = 'firma-bloque';
 const linea = document.createElement('div');
 linea.className = 'firma-linea';
 bloque.appendChild(linea);
 if (nombre) {
  const persona = document.createElement('p');
  persona.className = 'firma-nombre';
  persona.textContent = nombre;
  bloque.appendChild(persona);
 }
 if (identificacion) {
  const documento = document.createElement('p');
  documento.textContent = identificacion;
  bloque.appendChild(documento);
 }
 const cargo = document.createElement('p');
 cargo.className = 'firma-cargo';
 cargo.textContent = titulo;
 bloque.appendChild(cargo);
 if (empresa) {
  const organizacion = document.createElement('p');
  organizacion.textContent = empresa;
  bloque.appendChild(organizacion);
 }
 return bloque;
}

async function agregarFirmas() {
 if (vistaFirmas.querySelector('.firmas-documento')) return;
 const expediente = vistaFirmas.querySelector('.documento-expediente')
  ?.textContent.replace(/^Expediente N.º\s*/, '').trim();
 if (!expediente) return;
 const solicitud = ++solicitudFirmas;

 try {
  const respuesta = await fetch('/api/informes');
  if (!respuesta.ok) throw new Error('No se pudieron cargar los datos de las firmas.');
  const informes = await respuesta.json();
  if (solicitud !== solicitudFirmas || vistaFirmas.querySelector('.firmas-documento')) return;
  const informe = informes.find(item => item.expediente === expediente);
  if (!informe) return;

  const seccion = document.createElement('section');
  seccion.className = 'firmas-documento';
  const despedida = document.createElement('p');
  despedida.textContent = 'Atentamente,';
  seccion.appendChild(despedida);
  const bloques = document.createElement('div');
  bloques.className = 'firmas-bloques';
  bloques.append(
   crearFirma(
    'Representante legal',
    informe.representanteLegal,
    informe.dniRepresentante ? `DNI N.º ${informe.dniRepresentante}` : '',
    informe.empresaSupervisora
   ),
   crearFirma(
    'Fiscalizador',
    informe.inspector || informe.supervisor,
    informe.cipInspector ? `CIP N.º ${informe.cipInspector}` : '',
    informe.empresaSupervisora
   )
  );
  seccion.appendChild(bloques);
  vistaFirmas.appendChild(seccion);
 } catch (error) {
  console.error('Error al mostrar las firmas del informe:', error);
 }
}

new MutationObserver(agregarFirmas).observe(vistaFirmas, { childList: true });
