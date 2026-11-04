const campos = [
 'expediente', 'empresa', 'cartaLinea', 'fechaInforme', 'objetivo',
 'fechaRegistro', 'registroHidrocarburos', 'resolucion', 'fechaResolucion',
 'fechaComunicacion', 'asignacion', 'fechaAsignacion', 'supervisor',
 'antecedentes', 'baseLegal', 'placa', 'placaTracto', 'ruc', 'actividad',
 'capacidad', 'compartimientos', 'fechaConsulta', 'direccionLegal', 'distrito',
 'provincia', 'departamento', 'descripcionGeneral', 'fechaVisita', 'horaInicio',
 'horaFin', 'inspector', 'ubicacionVisita', 'acta', 'receptor', 'dniReceptor',
 'cargoReceptor', 'analisis', 'descargos', 'anexos', 'conclusiones',
 'recomendaciones', 'plazoSubsanacion', 'notaPlazo'
];

let editId = null;
let informeActual = null;

const $ = id => document.getElementById(id);
const form = $('form');
const zonaDescargo = $('zonaDescargo');
const contenedorObservaciones = $('observaciones');

function crearCampoObservacion(observacion = {}) {
 const tarjeta = document.createElement('section');
 tarjeta.className = 'observacion-card';

 const encabezado = document.createElement('div');
 encabezado.className = 'observacion-encabezado';
 const titulo = document.createElement('h4');
 titulo.textContent = 'Observación';
 const quitar = document.createElement('button');
 quitar.type = 'button';
 quitar.className = 'btn-quitar';
 quitar.textContent = 'Quitar';
 quitar.addEventListener('click', () => tarjeta.remove());
 encabezado.append(titulo, quitar);

 const camposObservacion = [
  ['tipo', 'Clasificación / tipo', 'Ej. Otras observaciones · Tipo B'],
  ['incumplimiento', 'Incumplimiento normativo', 'Describa el requisito aplicable'],
  ['baseLegal', 'Base legal específica', 'Norma, artículo o numeral'],
  ['descripcion', 'Descripción del hecho verificado', 'Detalle lo constatado durante la visita'],
  ['medioProbatorio', 'Medio probatorio', 'Ej. Fotografías, acta, documento']
 ];

 tarjeta.appendChild(encabezado);
 camposObservacion.forEach(([nombre, etiqueta, placeholder]) => {
  const grupo = document.createElement('div');
  grupo.className = 'form-group observacion-campo';
  const label = document.createElement('label');
  label.textContent = etiqueta;
  const control = nombre === 'tipo' || nombre === 'medioProbatorio'
   ? document.createElement('input')
   : document.createElement('textarea');
  control.dataset.observacion = nombre;
  control.value = observacion[nombre] || '';
  control.placeholder = placeholder;
  if (control.tagName === 'TEXTAREA') control.rows = nombre === 'descripcion' ? 3 : 2;
  grupo.append(label, control);
  tarjeta.appendChild(grupo);
 });
 contenedorObservaciones.appendChild(tarjeta);
}

function leerObservaciones() {
 return [...contenedorObservaciones.querySelectorAll('.observacion-card')]
  .map(tarjeta => {
   const observacion = {};
   tarjeta.querySelectorAll('[data-observacion]').forEach(campo => {
    observacion[campo.dataset.observacion] = campo.value.trim();
   });
   return observacion;
  })
  .filter(observacion => Object.values(observacion).some(Boolean));
}

function datos() {
 const informe = {};
 campos.forEach(id => {
  const campo = $(id);
  if (!campo) throw new Error(`No se encontró el campo "${id}" en el formulario.`);
  informe[id] = campo.value.trim();
 });
 informe.tieneDescargo = $('tieneDescargo').checked;
 informe.observaciones = leerObservaciones();
 return informe;
}

function textoEn(tag, texto, clase) {
 const elemento = document.createElement(tag);
 if (clase) elemento.className = clase;
 elemento.textContent = texto;
 return elemento;
}

function agregarBloque(contenedor, contenido, vacio = 'No consignado.') {
 const valor = (contenido || '').trim();
 if (!valor) {
  contenedor.appendChild(textoEn('p', vacio, 'texto-vacio'));
  return;
 }
 valor.split(/\n\s*\n/).forEach(parrafo => {
  const p = textoEn('p', parrafo.trim());
  p.className = 'parrafo-informe';
  contenedor.appendChild(p);
 });
}

function agregarListaNumerada(contenedor, contenido) {
 const lista = document.createElement('ol');
 const elementos = (contenido || '').split('\n').map(x => x.trim()).filter(Boolean);
 if (elementos.length === 0) {
  agregarBloque(contenedor, '');
  return;
 }
 elementos.forEach(item => lista.appendChild(textoEn('li', item)));
 contenedor.appendChild(lista);
}

function valorFecha(fecha) {
 if (!fecha) return '';
 const partes = fecha.split('-');
 return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha;
}

function agregarSeccion(documento, numero, titulo, contenido, tipo = 'texto') {
 const seccion = document.createElement('section');
 seccion.className = 'documento-seccion';
 seccion.appendChild(textoEn('h3', `${numero}. ${titulo}`));
 if (tipo === 'lista') agregarListaNumerada(seccion, contenido);
 else agregarBloque(seccion, contenido);
 documento.appendChild(seccion);
 return seccion;
}

function agregarDatosGenerales(documento, informe) {
 const seccion = document.createElement('section');
 seccion.className = 'documento-seccion';
 seccion.appendChild(textoEn('h3', '4. Descripción general'));
 const datosUnidad = [
  ['Agente fiscalizado', informe.empresa],
  ['R.U.C.', informe.ruc],
  ['Registro de Hidrocarburos', informe.registroHidrocarburos],
  ['Placa principal', informe.placa],
  ['Placa del tracto', informe.placaTracto],
  ['Actividad', informe.actividad],
  ['Capacidad autorizada', informe.capacidad],
  ['Compartimientos', informe.compartimientos],
  ['Dirección legal', [informe.direccionLegal, informe.distrito, informe.provincia, informe.departamento].filter(Boolean).join(', ')],
  ['Consulta registral', valorFecha(informe.fechaConsulta)]
 ].filter(([, valor]) => valor);

 if (datosUnidad.length) {
  const tabla = document.createElement('table');
  tabla.className = 'tabla-datos';
  const cuerpo = document.createElement('tbody');
  datosUnidad.forEach(([etiqueta, valor]) => {
   const fila = document.createElement('tr');
   fila.append(textoEn('th', etiqueta), textoEn('td', valor));
   cuerpo.appendChild(fila);
  });
  tabla.appendChild(cuerpo);
  seccion.appendChild(tabla);
 } else {
  agregarBloque(seccion, '');
 }
 agregarBloque(seccion, informe.descripcionGeneral);
 documento.appendChild(seccion);
}

function agregarTablaObservaciones(documento, observaciones) {
 const seccion = document.createElement('section');
 seccion.className = 'documento-seccion';
 seccion.appendChild(textoEn('h3', '5. Visita de fiscalización'));

 const datosVisita = [
  ['Fecha', valorFecha(observaciones.fechaVisita)],
  ['Hora de inicio', observaciones.horaInicio],
  ['Hora de término', observaciones.horaFin],
  ['Inspector', observaciones.inspector],
  ['Lugar', observaciones.ubicacionVisita],
  ['Acta', observaciones.acta],
  ['Recibida por', [observaciones.receptor, observaciones.dniReceptor && `DNI ${observaciones.dniReceptor}`, observaciones.cargoReceptor].filter(Boolean).join(' · ')]
 ].filter(([, valor]) => valor);

 if (datosVisita.length) {
  const dl = document.createElement('dl');
  dl.className = 'datos-visita';
  datosVisita.forEach(([etiqueta, valor]) => {
   dl.append(textoEn('dt', etiqueta), textoEn('dd', valor));
  });
  seccion.appendChild(dl);
 }

 seccion.appendChild(textoEn('h4', 'Hechos constatados'));
 const filas = observaciones.observaciones || [];
 if (!filas.length) {
  agregarBloque(seccion, '');
 } else {
  const tabla = document.createElement('table');
  tabla.className = 'tabla-observaciones';
  const thead = document.createElement('thead');
  const filaTitulo = document.createElement('tr');
  ['N.º', 'Clasificación', 'Incumplimiento normativo / base legal', 'Descripción del hecho verificado', 'Medio probatorio']
   .forEach(titulo => filaTitulo.appendChild(textoEn('th', titulo)));
  thead.appendChild(filaTitulo);
  const tbody = document.createElement('tbody');
  filas.forEach((observacion, indice) => {
   const fila = document.createElement('tr');
   [
    String(indice + 1),
    observacion.tipo || 'No consignado',
    [observacion.incumplimiento, observacion.baseLegal && `Base legal: ${observacion.baseLegal}`].filter(Boolean).join('\n\n') || 'No consignado',
    observacion.descripcion || 'No consignado',
    observacion.medioProbatorio || 'No consignado'
   ].forEach(valor => fila.appendChild(textoEn('td', valor)));
   tbody.appendChild(fila);
  });
  tabla.append(thead, tbody);
  const contenedorTabla = document.createElement('div');
  contenedorTabla.className = 'tabla-scroll';
  contenedorTabla.appendChild(tabla);
  seccion.appendChild(contenedorTabla);
 }

 agregarBloque(seccion, observaciones.analisis);
 if (observaciones.tieneDescargo) {
  seccion.appendChild(textoEn('h4', 'Evaluación de descargos'));
  agregarBloque(seccion, observaciones.descargos);
 }
 documento.appendChild(seccion);
}

function vista(informe) {
 informeActual = informe;
 const documento = $('vista');
 documento.replaceChildren();

 const cabecera = document.createElement('div');
 cabecera.className = 'documento-cabecera';
 cabecera.appendChild(textoEn('p', 'SISTEMA DE INFORMES DE FISCALIZACIÓN', 'documento-marca'));
 cabecera.appendChild(textoEn('h2', 'INFORME DE FISCALIZACIÓN'));
 cabecera.appendChild(textoEn('p', `Expediente N.º ${informe.expediente || 'No consignado'}`, 'documento-expediente'));
 if (informe.cartaLinea) cabecera.appendChild(textoEn('p', `Carta Línea N.º ${informe.cartaLinea}`));
 if (informe.fechaInforme) cabecera.appendChild(textoEn('p', `Fecha: ${valorFecha(informe.fechaInforme)}`));
 documento.appendChild(cabecera);

 agregarSeccion(documento, 1, 'Objetivo', informe.objetivo);
 agregarSeccion(documento, 2, 'Antecedentes', informe.antecedentes);
 agregarSeccion(documento, 3, 'Base legal', informe.baseLegal, 'lista');
 agregarDatosGenerales(documento, informe);
 agregarTablaObservaciones(documento, informe);
 agregarSeccion(documento, 6, 'Anexos', informe.anexos, 'lista');
 agregarSeccion(documento, 7, 'Conclusiones', informe.conclusiones, 'lista');
 const recomendaciones = agregarSeccion(documento, 8, 'Recomendaciones', informe.recomendaciones, 'lista');
 if (informe.plazoSubsanacion) {
  recomendaciones.appendChild(textoEn('p', `Plazo de subsanación: ${informe.plazoSubsanacion}`, 'plazo-informe'));
 }
 if (informe.notaPlazo) {
  recomendaciones.appendChild(textoEn('p', `Nota sobre el cómputo: ${informe.notaPlazo}`, 'nota-informe'));
 }
 $('imprimir').disabled = false;
}

function cargar(informe) {
 campos.forEach(id => {
  $(id).value = informe[id] || '';
 });
 $('tieneDescargo').checked = !!informe.tieneDescargo;
 zonaDescargo.hidden = !informe.tieneDescargo;
 contenedorObservaciones.replaceChildren();
 (informe.observaciones || []).forEach(crearCampoObservacion);
 editId = informe.id;
 $('tituloFormulario').textContent = 'Editar informe';
 $('guardarInforme').textContent = 'Actualizar informe';
 vista(informe);
 $('registro').scrollIntoView({ behavior: 'smooth' });
}

async function listar() {
 try {
  const respuesta = await fetch('/api/informes');
  if (!respuesta.ok) throw new Error('No se pudo obtener la lista de informes.');
  const informes = await respuesta.json();
  const lista = $('lista');
  lista.replaceChildren();
  if (informes.length === 0) {
   lista.appendChild(textoEn('p', 'Aún no hay informes registrados.', 'lista-vacia'));
   return;
  }
  const tabla = document.createElement('table');
  tabla.className = 'tabla-listado';
  const thead = document.createElement('thead');
  const encabezado = document.createElement('tr');
  ['Expediente', 'Agente fiscalizado', 'Placa', 'Acciones'].forEach(t => encabezado.appendChild(textoEn('th', t)));
  thead.appendChild(encabezado);
  const tbody = document.createElement('tbody');
  informes.forEach(informe => {
   const fila = document.createElement('tr');
   fila.append(
    textoEn('td', informe.expediente || '—'),
    textoEn('td', informe.empresa || '—'),
    textoEn('td', informe.placa || '—')
   );
   const acciones = document.createElement('td');
   acciones.className = 'acciones-listado';
   const ver = document.createElement('button');
   ver.type = 'button';
   ver.textContent = 'Ver / editar';
   ver.className = 'btn-editar';
   ver.addEventListener('click', () => cargar(informe));
   const eliminar = document.createElement('button');
   eliminar.type = 'button';
   eliminar.textContent = 'Eliminar';
   eliminar.className = 'btn-eliminar';
   eliminar.addEventListener('click', async () => {
    if (!confirm(`¿Desea eliminar el informe ${informe.expediente || ''}?`)) return;
    try {
     const resultado = await fetch(`/api/informes/${encodeURIComponent(informe.id)}`, { method: 'DELETE' });
     if (!resultado.ok) throw new Error('No se pudo eliminar el informe.');
     if (editId === informe.id) limpiarFormulario();
     await listar();
    } catch (error) {
     console.error('Error al eliminar:', error);
     alert(`Error: ${error.message}`);
    }
   });
   acciones.append(ver, eliminar);
   fila.appendChild(acciones);
   tbody.appendChild(fila);
  });
  tabla.append(thead, tbody);
  const contenedorTabla = document.createElement('div');
  contenedorTabla.className = 'tabla-scroll';
  contenedorTabla.appendChild(tabla);
  lista.appendChild(contenedorTabla);
 } catch (error) {
  console.error('Error al listar informes:', error);
  $('lista').textContent = `Error al cargar los informes: ${error.message}`;
 }
}

function limpiarFormulario() {
 form.reset();
 contenedorObservaciones.replaceChildren();
 zonaDescargo.hidden = true;
 editId = null;
 $('tituloFormulario').textContent = 'Nuevo informe';
 $('guardarInforme').textContent = 'Guardar informe';
}

$('agregarObservacion').addEventListener('click', () => crearCampoObservacion());
$('tieneDescargo').addEventListener('change', () => {
 zonaDescargo.hidden = !$('tieneDescargo').checked;
});
form.addEventListener('reset', () => {
 window.setTimeout(() => {
  contenedorObservaciones.replaceChildren();
  zonaDescargo.hidden = true;
  editId = null;
  $('tituloFormulario').textContent = 'Nuevo informe';
  $('guardarInforme').textContent = 'Guardar informe';
 }, 0);
});

form.addEventListener('submit', async evento => {
 evento.preventDefault();
 try {
  const informe = datos();
  const url = editId ? `/api/informes/${encodeURIComponent(editId)}` : '/api/informes';
  const respuesta = await fetch(url, {
   method: editId ? 'PUT' : 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify(informe)
  });
  const resultado = await respuesta.json();
  if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo guardar el informe.');
  vista(resultado);
  limpiarFormulario();
  await listar();
  alert('Informe guardado correctamente.');
 } catch (error) {
  console.error('Error al guardar:', error);
  alert(`Error al guardar: ${error.message}`);
 }
});

$('imprimir').addEventListener('click', () => {
 if (!informeActual) return;
 document.body.classList.add('modo-impresion');
 window.print();
});
window.addEventListener('afterprint', () => document.body.classList.remove('modo-impresion'));

crearCampoObservacion();
listar();
