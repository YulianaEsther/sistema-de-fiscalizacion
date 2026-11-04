const campos = [
 'expediente', 'empresa', 'destinatario', 'empresaSupervisora',
 'representanteLegal', 'dniRepresentante', 'cipInspector', 'cartaLinea',
 'fechaInforme', 'objetivo', 'fechaRegistro', 'registroHidrocarburos',
 'resolucion', 'fechaResolucion', 'fechaComunicacion', 'asignacion',
 'fechaAsignacion', 'supervisor', 'antecedentes', 'baseLegal', 'placa',
 'placaTracto', 'ruc', 'actividad', 'capacidad', 'compartimientos',
 'fechaConsulta', 'direccionLegal', 'distrito', 'provincia', 'departamento',
 'descripcionGeneral', 'fechaVisita', 'horaInicio', 'horaFin', 'inspector',
 'ubicacionVisita', 'acta', 'receptor', 'dniReceptor', 'cargoReceptor',
 'analisis', 'descargos', 'anexos', 'conclusiones', 'recomendaciones',
 'plazoSubsanacion', 'notaPlazo'
];

const $ = id => document.getElementById(id);
const form = $('form');
const observaciones = $('observaciones');
let editId = null;
let informeActual = null;

function crearObservacion(valor = {}) {
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
 tarjeta.appendChild(encabezado);

 [
  ['tipo', 'Clasificación / tipo', 'Ej. Otras observaciones · Tipo B'],
  ['incumplimiento', 'Incumplimiento normativo', 'Requisito aplicable'],
  ['baseLegal', 'Base legal específica', 'Norma, artículo o numeral'],
  ['descripcion', 'Descripción del hecho verificado', 'Hecho constatado'],
  ['medioProbatorio', 'Medio probatorio', 'Ej. Fotografías, acta, documento']
 ].forEach(([nombre, etiqueta, placeholder]) => {
  const grupo = document.createElement('div');
  grupo.className = 'form-group observacion-campo';
  const label = document.createElement('label');
  label.textContent = etiqueta;
  const control = nombre === 'tipo' || nombre === 'medioProbatorio'
   ? document.createElement('input')
   : document.createElement('textarea');
  control.dataset.observacion = nombre;
  control.placeholder = placeholder;
  control.value = valor[nombre] || '';
  if (control.tagName === 'TEXTAREA') control.rows = 3;
  grupo.append(label, control);
  tarjeta.appendChild(grupo);
 });
 observaciones.appendChild(tarjeta);
}

function leerDatos() {
 const informe = {};
 campos.forEach(id => {
  const campo = $(id);
  if (!campo) throw new Error(`No se encontró el campo "${id}" en el formulario.`);
  informe[id] = campo.value.trim();
 });
 informe.tieneDescargo = $('tieneDescargo').checked;
 informe.observaciones = [...observaciones.querySelectorAll('.observacion-card')]
  .map(tarjeta => {
   const fila = {};
   tarjeta.querySelectorAll('[data-observacion]').forEach(campo => {
    fila[campo.dataset.observacion] = campo.value.trim();
   });
   return fila;
  })
  .filter(fila => Object.values(fila).some(Boolean));
 return informe;
}

function nodo(tag, contenido, clase) {
 const elemento = document.createElement(tag);
 if (clase) elemento.className = clase;
 elemento.textContent = contenido;
 return elemento;
}

function agregarTexto(contenedor, valor) {
 const texto = (valor || '').trim();
 if (!texto) {
  contenedor.appendChild(nodo('p', 'No consignado.', 'texto-vacio'));
  return;
 }
 texto.split(/\n\s*\n/).forEach(parrafo => {
  const elemento = nodo('p', parrafo.trim(), 'parrafo-informe');
  contenedor.appendChild(elemento);
 });
}

function seccion(documento, numero, titulo, texto, lista = false) {
 const bloque = document.createElement('section');
 bloque.className = 'documento-seccion';
 bloque.appendChild(nodo('h3', `${numero}. ${titulo}`));
 if (!lista) agregarTexto(bloque, texto);
 else {
  const elementos = (texto || '').split('\n').map(item => item.trim()).filter(Boolean);
  if (!elementos.length) agregarTexto(bloque, '');
  else {
   const ol = document.createElement('ol');
   elementos.forEach(item => ol.appendChild(nodo('li', item)));
   bloque.appendChild(ol);
  }
 }
 documento.appendChild(bloque);
 return bloque;
}

function fecha(valor) {
 if (!valor) return '';
 const partes = valor.split('-');
 return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : valor;
}

function previsualizar(informe) {
 informeActual = informe;
 const vista = $('vista');
 vista.replaceChildren();
 const cabecera = document.createElement('div');
 cabecera.className = 'documento-cabecera';
 cabecera.append(
  nodo('p', 'SISTEMA DE INFORMES DE FISCALIZACIÓN', 'documento-marca'),
  nodo('h2', 'INFORME DE SUPERVISIÓN'),
  nodo('p', `Expediente N.º ${informe.expediente || 'No consignado'}`, 'documento-expediente')
 );
 if (informe.fechaInforme) cabecera.appendChild(nodo('p', `Huánuco, ${fecha(informe.fechaInforme)}`));
 vista.appendChild(cabecera);

 const datosCabecera = document.createElement('section');
 datosCabecera.className = 'documento-seccion';
 [
  ['A', informe.destinatario || 'Oficina Regional'],
  ['De', [informe.supervisor || informe.inspector, informe.empresaSupervisora].filter(Boolean).join(' · ')],
  ['Asunto', `Fiscalización de seguridad del medio de transporte operado por ${informe.empresa || 'No consignado'}`],
  ['Referencia', `Registro de Hidrocarburos N.º ${informe.registroHidrocarburos || 'No consignado'}${informe.cartaLinea ? ` · Carta Línea N.º ${informe.cartaLinea}` : ''}`]
 ].forEach(([etiqueta, valor]) => {
  const p = document.createElement('p');
  p.append(nodo('strong', `${etiqueta}: `), document.createTextNode(valor || 'No consignado'));
  datosCabecera.appendChild(p);
 });
 vista.appendChild(datosCabecera);

 seccion(vista, 1, 'Objetivo', informe.objetivo);
 seccion(vista, 2, 'Antecedentes', informe.antecedentes);
 seccion(vista, 3, 'Base legal', informe.baseLegal, true);

 const general = document.createElement('section');
 general.className = 'documento-seccion';
 general.appendChild(nodo('h3', '4. Descripción general'));
 general.appendChild(nodo('h4', '4.1. Datos del Registro de Hidrocarburos'));
 const tablaDatos = document.createElement('table');
 tablaDatos.className = 'tabla-datos';
 [
  ['Agente fiscalizado', informe.empresa], ['R.U.C.', informe.ruc],
  ['Registro de Hidrocarburos', informe.registroHidrocarburos],
  ['Placa principal', informe.placa], ['Placa del tracto', informe.placaTracto],
  ['Actividad', informe.actividad], ['Capacidad autorizada', informe.capacidad],
  ['Compartimientos', informe.compartimientos],
  ['Dirección legal', [informe.direccionLegal, informe.distrito, informe.provincia, informe.departamento].filter(Boolean).join(', ')],
  ['Consulta registral', fecha(informe.fechaConsulta)]
 ].filter(([, valor]) => valor).forEach(([etiqueta, valor]) => {
  const fila = document.createElement('tr');
  fila.append(nodo('th', etiqueta), nodo('td', valor));
  tablaDatos.appendChild(fila);
 });
 general.appendChild(tablaDatos);
 if (informe.descripcionGeneral) agregarTexto(general, informe.descripcionGeneral);
 general.appendChild(nodo('h4', '4.2. Dirección'));
 agregarTexto(general, informe.ubicacionVisita);
 vista.appendChild(general);

 const visita = document.createElement('section');
 visita.className = 'documento-seccion';
 visita.appendChild(nodo('h3', '4.3. De la visita de fiscalización'));
 const detalle = [
  ['Fecha', fecha(informe.fechaVisita)], ['Hora de inicio', informe.horaInicio],
  ['Hora de término', informe.horaFin], ['Inspector', informe.inspector],
  ['Acta', informe.acta],
  ['Recibida por', [informe.receptor, informe.dniReceptor && `DNI ${informe.dniReceptor}`, informe.cargoReceptor].filter(Boolean).join(' · ')]
 ].filter(([, valor]) => valor);
 if (detalle.length) {
  const dl = document.createElement('dl');
  dl.className = 'datos-visita';
  detalle.forEach(([etiqueta, valor]) => dl.append(nodo('dt', etiqueta), nodo('dd', valor)));
  visita.appendChild(dl);
 }
 visita.appendChild(nodo('h4', 'Tabla N.º 01. Hechos constatados en el acta de fiscalización'));
 const tabla = document.createElement('table');
 tabla.className = 'tabla-observaciones';
 const encabezado = document.createElement('thead');
 const encabezadoFila = document.createElement('tr');
 ['N.º', 'Clasificación', 'Incumplimiento normativo / base legal', 'Descripción del hecho verificado', 'Medio probatorio']
  .forEach(titulo => encabezadoFila.appendChild(nodo('th', titulo)));
 encabezado.appendChild(encabezadoFila);
 const cuerpo = document.createElement('tbody');
 (informe.observaciones || []).forEach((item, indice) => {
  const fila = document.createElement('tr');
  [
   String(indice + 1), item.tipo || 'No consignado',
   [item.incumplimiento, item.baseLegal && `Base legal: ${item.baseLegal}`].filter(Boolean).join('\n') || 'No consignado',
   item.descripcion || 'No consignado', item.medioProbatorio || 'No consignado'
  ].forEach(valor => fila.appendChild(nodo('td', valor)));
  cuerpo.appendChild(fila);
 });
 if (!cuerpo.children.length) {
  const fila = document.createElement('tr');
  for (const valor of ['—', 'No consignado', 'No consignado', 'No consignado', 'No consignado']) fila.appendChild(nodo('td', valor));
  cuerpo.appendChild(fila);
 }
 tabla.append(encabezado, cuerpo);
 const tablaScroll = document.createElement('div');
 tablaScroll.className = 'tabla-scroll';
 tablaScroll.appendChild(tabla);
 visita.appendChild(tablaScroll);
 if (informe.analisis) {
  visita.appendChild(nodo('h4', 'Análisis de los hechos'));
  agregarTexto(visita, informe.analisis);
 }
 if (informe.tieneDescargo) {
  visita.appendChild(nodo('h4', 'Evaluación de descargos'));
  agregarTexto(visita, informe.descargos);
 }
 vista.appendChild(visita);

 seccion(vista, 5, 'Anexos', informe.anexos, true);
 seccion(vista, 6, 'Conclusiones', informe.conclusiones, true);
 const recomendaciones = seccion(vista, 7, 'Recomendaciones', informe.recomendaciones, true);
 if (informe.plazoSubsanacion) agregarTexto(recomendaciones, `Plazo de subsanación: ${informe.plazoSubsanacion}`);
 if (informe.notaPlazo) agregarTexto(recomendaciones, `Nota sobre el cómputo: ${informe.notaPlazo}`);
 $('imprimir').disabled = false;
 $('descargarWord').disabled = !informe.id;
}

function limpiarFormulario() {
 form.reset();
 observaciones.replaceChildren();
 $('zonaDescargo').hidden = true;
 editId = null;
 $('tituloFormulario').textContent = 'Nuevo informe';
 $('guardarInforme').textContent = 'Guardar informe';
}

async function descargarWord(id) {
 const respuesta = await fetch(`/api/informes/${encodeURIComponent(id)}/docx`);
 if (!respuesta.ok) {
  const error = await respuesta.json().catch(() => ({}));
  throw new Error(error.error || 'No se pudo generar el documento Word.');
 }
 const archivo = await respuesta.blob();
 const url = URL.createObjectURL(archivo);
 const enlace = document.createElement('a');
 enlace.href = url;
 enlace.download = `Informe_Supervision_${(informeActual.expediente || id).replace(/[^\w.-]+/g, '_')}.docx`;
 document.body.appendChild(enlace);
 enlace.click();
 enlace.remove();
 URL.revokeObjectURL(url);
}

function cargar(informe) {
 campos.forEach(id => { $(id).value = informe[id] || ''; });
 $('tieneDescargo').checked = !!informe.tieneDescargo;
 $('zonaDescargo').hidden = !informe.tieneDescargo;
 observaciones.replaceChildren();
 (informe.observaciones || []).forEach(crearObservacion);
 editId = informe.id;
 $('tituloFormulario').textContent = 'Editar informe';
 $('guardarInforme').textContent = 'Actualizar informe';
 previsualizar(informe);
 $('registro').scrollIntoView({ behavior: 'smooth' });
}

async function listar() {
 const lista = $('lista');
 try {
  const respuesta = await fetch('/api/informes');
  if (!respuesta.ok) throw new Error('No se pudo obtener la lista de informes.');
  const informes = await respuesta.json();
  lista.replaceChildren();
  if (!informes.length) {
   lista.appendChild(nodo('p', 'Aún no hay informes registrados.', 'lista-vacia'));
   return;
  }
  const tabla = document.createElement('table');
  tabla.className = 'tabla-listado';
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  ['Expediente', 'Agente fiscalizado', 'Placa', 'Acciones'].forEach(texto => tr.appendChild(nodo('th', texto)));
  thead.appendChild(tr);
  const tbody = document.createElement('tbody');
  informes.forEach(informe => {
   const fila = document.createElement('tr');
   fila.append(nodo('td', informe.expediente || '—'), nodo('td', informe.empresa || '—'), nodo('td', informe.placa || '—'));
   const acciones = document.createElement('td');
   acciones.className = 'acciones-listado';
   const editar = nodo('button', 'Ver / editar');
   editar.type = 'button';
   editar.className = 'btn-editar';
   editar.addEventListener('click', () => cargar(informe));
   const eliminar = nodo('button', 'Eliminar');
   eliminar.type = 'button';
   eliminar.className = 'btn-eliminar';
   eliminar.addEventListener('click', async () => {
    if (!confirm(`¿Desea eliminar el informe ${informe.expediente || ''}?`)) return;
    try {
     const resultado = await fetch(`/api/informes/${encodeURIComponent(informe.id)}`, { method: 'DELETE' });
     if (!resultado.ok) throw new Error('No se pudo eliminar el informe.');
     if (editId === informe.id) limpiarFormulario();
     await listar();
    } catch (error) {
     console.error(error);
     alert(`Error: ${error.message}`);
    }
   });
   acciones.append(editar, eliminar);
   fila.appendChild(acciones);
   tbody.appendChild(fila);
  });
  tabla.append(thead, tbody);
  const scroll = document.createElement('div');
  scroll.className = 'tabla-scroll';
  scroll.appendChild(tabla);
  lista.appendChild(scroll);
 } catch (error) {
  console.error('Error al listar informes:', error);
  lista.textContent = `Error al cargar los informes: ${error.message}`;
 }
}

$('agregarObservacion').addEventListener('click', () => crearObservacion());
$('tieneDescargo').addEventListener('change', () => {
 $('zonaDescargo').hidden = !$('tieneDescargo').checked;
});
form.addEventListener('reset', () => {
 window.setTimeout(() => {
  observaciones.replaceChildren();
  $('zonaDescargo').hidden = true;
  editId = null;
  $('tituloFormulario').textContent = 'Nuevo informe';
  $('guardarInforme').textContent = 'Guardar informe';
 }, 0);
});
form.addEventListener('submit', async evento => {
 evento.preventDefault();
 try {
  const informe = leerDatos();
  const respuesta = await fetch(editId ? `/api/informes/${encodeURIComponent(editId)}` : '/api/informes', {
   method: editId ? 'PUT' : 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify(informe)
  });
  const resultado = await respuesta.json();
  if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo guardar el informe.');
  previsualizar(resultado);
  limpiarFormulario();
  await listar();
  await descargarWord(resultado.id);
  alert('Informe guardado y documento Word descargado correctamente.');
 } catch (error) {
  console.error('Error al guardar o generar el documento:', error);
  alert(`Error: ${error.message}`);
 }
});
$('descargarWord').addEventListener('click', async () => {
 if (!informeActual || !informeActual.id) return;
 try {
  await descargarWord(informeActual.id);
 } catch (error) {
  console.error('Error al descargar el documento Word:', error);
  alert(`No se pudo descargar el documento Word: ${error.message}`);
 }
});
$('imprimir').addEventListener('click', () => {
 if (!informeActual) return;
 document.body.classList.add('modo-impresion');
 window.print();
});
window.addEventListener('afterprint', () => document.body.classList.remove('modo-impresion'));

crearObservacion();
listar();
