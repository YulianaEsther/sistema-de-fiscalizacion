const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML = 'http://www.w3.org/XML/1998/namespace';
const TEMPLATE = path.join(__dirname, 'templates', 'Informe_Supervision_Modelo_Identico_Anonimizado.docx');

function elements(node, name) {
 const result = [];
 for (let child = node.firstChild; child; child = child.nextSibling) {
  if (child.nodeType === 1 && child.namespaceURI === W && (!name || child.localName === name)) {
   result.push(child);
  }
 }
 return result;
}

function all(node, name) {
 return Array.from(node.getElementsByTagNameNS(W, name));
}

function textOf(node) {
 return all(node, 't').map(text => text.textContent || '').join('');
}

function setText(paragraph, value) {
 const texts = all(paragraph, 't');
 if (!texts.length) {
  const run = paragraph.ownerDocument.createElementNS(W, 'w:r');
  const text = paragraph.ownerDocument.createElementNS(W, 'w:t');
  text.appendChild(paragraph.ownerDocument.createTextNode(value));
  text.setAttributeNS(XML, 'xml:space', 'preserve');
  run.appendChild(text);
  const properties = elements(paragraph, 'pPr')[0];
  paragraph.insertBefore(run, properties ? properties.nextSibling : paragraph.firstChild);
  return;
 }
 texts[0].textContent = value;
 texts[0].setAttributeNS(XML, 'xml:space', 'preserve');
 texts.slice(1).forEach(text => { text.textContent = ''; });
}

function replaceText(paragraph, search, replacement) {
 const texts = all(paragraph, 't');
 const values = texts.map(text => text.textContent || '');
 const original = values.join('');
 const start = original.indexOf(search);
 if (start < 0) return false;
 const end = start + search.length;
 let offset = 0;
 let first = -1;
 let last = -1;
 for (let i = 0; i < values.length; i++) {
  const next = offset + values[i].length;
  if (first < 0 && start < next) first = i;
  if (end <= next) {
   last = i;
   break;
  }
  offset = next;
 }
 if (first < 0 || last < 0) return false;
 const firstOffset = start - values.slice(0, first).join('').length;
 const lastOffset = end - values.slice(0, last).join('').length;
 if (first === last) {
  values[first] = values[first].slice(0, firstOffset) + replacement + values[first].slice(lastOffset);
 } else {
  values[first] = values[first].slice(0, firstOffset) + replacement;
  for (let i = first + 1; i < last; i++) values[i] = '';
  values[last] = values[last].slice(lastOffset);
 }
 texts.forEach((text, index) => {
  text.textContent = values[index];
  if (values[index].startsWith(' ') || values[index].endsWith(' ')) {
   text.setAttributeNS(XML, 'xml:space', 'preserve');
  }
 });
 return true;
}

function replaceEverywhere(xml, search, replacement) {
 if (!search) return;
 for (const paragraph of all(xml, 'p')) {
  let count = 0;
  while (textOf(paragraph).includes(search) && count++ < 100) {
   if (!replaceText(paragraph, search, replacement)) break;
  }
 }
}

function normalize(value) {
 return (value || '').normalize('NFC').trim().toLocaleUpperCase('es-PE');
}

function findParagraph(body, predicate, label) {
 const paragraph = all(body, 'p').find(node => predicate(textOf(node)));
 if (!paragraph) throw new Error(`No se encontró el apartado de plantilla: ${label}`);
 return paragraph;
}

function lines(value, prefix) {
 const items = (value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
 const values = items.length ? items : ['No consignado.'];
 return values.map((item, index) => {
  if (!prefix || /^\d+(?:\.\d+)*\.?\s/.test(item)) return item;
  return `${prefix(index + 1)} ${item}`;
 });
}

function replaceSection(body, startTitle, endTitle, values, options = {}) {
 const children = elements(body);
 const start = children.findIndex(node => node.localName === 'p' &&
  normalize(textOf(node)) === normalize(startTitle));
 const end = children.findIndex((node, index) => index > start &&
  node.localName === 'p' && normalize(textOf(node)) === normalize(endTitle));
 if (start < 0 || end < 0) {
  throw new Error(`No se encontró el tramo ${startTitle} - ${endTitle} en la plantilla.`);
 }
 let entries = children.slice(start + 1, end)
  .filter(node => node.localName === 'p' && textOf(node).trim());
 if (!entries.length) throw new Error(`El apartado ${startTitle} no tiene texto de plantilla.`);
 const content = values.length ? values : ['No consignado.'];
 if (content.length > entries.length) {
  const prototype = entries[entries.length - 1];
  const anchor = prototype.nextSibling;
  for (let i = entries.length; i < content.length; i++) {
   const copy = prototype.cloneNode(true);
   body.insertBefore(copy, anchor);
   entries.push(copy);
  }
 }
 entries.forEach((entry, index) => {
  if (index < content.length) setText(entry, content[index]);
  else if (options.preserve && options.preserve(entry)) setText(entry, '');
  else body.removeChild(entry);
 });
}

function setCell(cell, values) {
 const paragraphs = elements(cell, 'p');
 if (!paragraphs.length) return;
 const content = values.slice();
 if (content.length > paragraphs.length) {
  const prototype = paragraphs[paragraphs.length - 1];
  const anchor = prototype.nextSibling;
  for (let i = paragraphs.length; i < content.length; i++) {
   const copy = prototype.cloneNode(true);
   cell.insertBefore(copy, anchor);
   paragraphs.push(copy);
  }
 }
 paragraphs.forEach((paragraph, index) => setText(paragraph, content[index] || ''));
}

function longDate(value) {
 if (!value) return 'fecha no consignada';
 const [year, month, day] = value.split('-').map(Number);
 return new Intl.DateTimeFormat('es-PE', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
 }).format(new Date(Date.UTC(year, month - 1, day)));
}

function antecedentes(informe) {
 if (informe.antecedentes && informe.antecedentes.trim()) {
  return lines(informe.antecedentes, index => `2.${index}.`);
 }
 const items = [];
 if (informe.registroHidrocarburos || informe.fechaRegistro) {
  items.push(`Con fecha ${longDate(informe.fechaRegistro)}, ${informe.empresa || 'el Agente Fiscalizado'} obtuvo el Registro de Hidrocarburos N.º ${informe.registroHidrocarburos || 'no consignado'}, para operar la unidad vehicular de placa principal N.º ${informe.placa || 'no consignada'}${informe.placaTracto ? ` y tracto ${informe.placaTracto}` : ''}${informe.actividad ? `, en la actividad de ${informe.actividad}` : ''}${informe.capacidad ? `, con capacidad autorizada de ${informe.capacidad}` : ''}${informe.compartimientos ? ` y ${informe.compartimientos} compartimientos` : ''}${informe.direccionLegal ? `, con dirección legal en ${informe.direccionLegal}` : ''}.`);
 }
 if (informe.resolucion || informe.fechaResolucion) {
  items.push(`Mediante ${informe.resolucion || 'la resolución o mandato correspondiente'}, de fecha ${longDate(informe.fechaResolucion)}, se dispuso la presentación de la unidad vehicular de placa principal N.º ${informe.placa || 'no consignada'}.`);
 }
 if (informe.fechaComunicacion) {
  items.push(`Con fecha ${longDate(informe.fechaComunicacion)}, ${informe.empresa || 'el Agente Fiscalizado'} comunicó el lugar propuesto para la fiscalización: ${informe.ubicacionVisita || 'no consignado'}.`);
 }
 if (informe.asignacion || informe.fechaAsignacion) {
  items.push(`Con fecha ${longDate(informe.fechaAsignacion)}, mediante ${informe.asignacion || 'la asignación correspondiente'}, se asignó la Carta Línea N.º ${informe.cartaLinea || 'no consignada'} a ${informe.empresaSupervisora || 'la empresa supervisora'}, a fin de efectuar la fiscalización.`);
 }
 if (informe.fechaVisita) {
  items.push(`Con fecha ${longDate(informe.fechaVisita)}, ${informe.inspector || informe.supervisor || 'el fiscalizador'} realizó la visita y suscribió el Acta de Fiscalización N.º ${informe.acta || 'no consignada'}, correspondiente al Expediente N.º ${informe.expediente || 'no consignado'}.`);
 }
 items.push(`Con fecha ${longDate(informe.fechaInforme)}, se elabora el presente informe de fiscalización${informe.cartaLinea ? `, correspondiente a la Carta Línea N.º ${informe.cartaLinea}` : ''} y al Expediente N.º ${informe.expediente || 'no consignado'}, para su evaluación.`);
 return lines(items.join('\n'), index => `2.${index}.`);
}

function setBodyParagraph(body, predicate, value, label) {
 setText(findParagraph(body, predicate, label), value);
}

function fillObservations(body, observations) {
 const table = elements(body, 'tbl').find(node =>
  normalize(textOf(node)).includes('INCUMPLIMIENTO NORMATIVO'));
 if (!table) throw new Error('No se encontró la tabla de hechos constatados.');
 const rows = elements(table, 'tr');
 if (rows.length < 2) throw new Error('La tabla de observaciones no contiene filas de datos.');
 const templates = rows.slice(1).map(row => row.cloneNode(true));
 rows.slice(1).forEach(row => table.removeChild(row));
 (observations.length ? observations : [{}]).forEach((item, index) => {
  const row = templates[Math.min(index, templates.length - 1)].cloneNode(true);
  const cells = elements(row, 'tc');
  if (cells.length !== 4) throw new Error('La tabla de observaciones debe tener cuatro columnas.');
  setCell(cells[0], [item.tipo || 'OTRAS OBSERVACIONES']);
  setCell(cells[1], [item.incumplimiento || 'No consignado.', '', item.baseLegal ? `Base legal: ${item.baseLegal}` : '']);
  setCell(cells[2], [item.descripcion || 'No consignado.']);
  setCell(cells[3], [item.medioProbatorio || 'No consignado.']);
  table.appendChild(row);
 });
}

function clearExampleSignatureImages(table) {
 const row = elements(table, 'tr')[0];
 if (!row) return;
 for (const name of ['drawing', 'pict']) {
  for (const image of all(row, name)) {
   let run = image.parentNode;
   while (run && run.localName !== 'r') run = run.parentNode;
   if (run && run.parentNode) run.parentNode.removeChild(run);
  }
 }
 let properties = elements(row, 'trPr')[0];
 if (!properties) {
  properties = table.ownerDocument.createElementNS(W, 'w:trPr');
  row.insertBefore(properties, row.firstChild);
 }
 if (!elements(properties, 'trHeight').length) {
  const height = table.ownerDocument.createElementNS(W, 'w:trHeight');
  height.setAttributeNS(W, 'w:val', '1200');
  height.setAttributeNS(W, 'w:hRule', 'atLeast');
  properties.appendChild(height);
 }
}

function fillSignatures(body, informe) {
 const table = elements(body, 'tbl').find(node => {
  const text = normalize(textOf(node));
  return text.includes('REPRESENTANTE LEGAL') && text.includes('FISCALIZADOR');
 });
 if (!table) throw new Error('No se encontró el bloque de firmas.');
 const rows = elements(table, 'tr');
 const cells = elements(rows[rows.length - 1], 'tc');
 if (cells.length !== 2) throw new Error('El bloque de firmas debe tener dos columnas.');
 setCell(cells[0], [
  informe.representanteLegal || '',
  informe.dniRepresentante ? `DNI N.º ${informe.dniRepresentante}` : '',
  'Representante Legal',
  informe.empresaSupervisora || ''
 ]);
 setCell(cells[1], [
  informe.inspector || informe.supervisor || '',
  informe.cipInspector ? `CIP N.º ${informe.cipInspector}` : '',
  'Fiscalizador',
  informe.empresaSupervisora || ''
 ]);
 clearExampleSignatureImages(table);
}

function fillDocument(document, informe) {
 const body = document.getElementsByTagNameNS(W, 'body')[0];
 if (!body) throw new Error('El documento Word no contiene el cuerpo esperado.');

 const substitutions = [
  ['TRANSPORTES MODELO DEMOSTRATIVO S.A.C.', informe.empresa || 'Agente Fiscalizado'],
  ['SUPERVISIÓN TÉCNICA DEMOSTRATIVA E.I.R.L.', informe.empresaSupervisora || ''],
  ['Carlos Ejemplo Rivera', informe.inspector || informe.supervisor || ''],
  ['Elena Referencia Torres', informe.representanteLegal || ''],
  ['PEDRO MODELO GARCIA', informe.receptor || ''],
  ['20000000001', informe.ruc || 'No consignado'],
  ['00000-060-000000', informe.registroHidrocarburos || 'No consignado'],
  ['202600000000', informe.expediente || 'No consignado'],
  ['0000000-0', informe.cartaLinea || 'No consignada'],
  ['ABC-000', informe.placa || 'No consignada'],
  ['XYZ-000', informe.placaTracto || 'No consignada'],
  ['«osinumero»', informe.numeroInforme || informe.expediente || 'PENDIENTE'],
  ['Oficina Regional Huánuco', informe.destinatario || 'Oficina Regional'],
  ['DIRECCIÓN FICTICIA PARA CAPACITACIÓN', informe.direccionLegal || informe.ubicacionVisita || 'DIRECCIÓN NO CONSIGNADA'],
  ['provincia y departamento de HUÁNUCO', `provincia de ${(informe.provincia || 'PROVINCIA NO CONSIGNADA').toLocaleUpperCase('es-PE')} y departamento de ${(informe.departamento || 'DEPARTAMENTO NO CONSIGNADO').toLocaleUpperCase('es-PE')}`],
  ['CHURUBAMBA', (informe.distrito || 'DISTRITO NO CONSIGNADO').toLocaleUpperCase('es-PE')],
  ['HUÁNUCO', (informe.departamento || 'DEPARTAMENTO NO CONSIGNADO').toLocaleUpperCase('es-PE')],
  ['29 de agosto de 2024', longDate(informe.fechaRegistro)],
  ['10 de septiembre de 2026', longDate(informe.fechaResolucion)],
  ['11 de septiembre de 2026', longDate(informe.fechaComunicacion)],
  ['18 de septiembre de 2026', longDate(informe.fechaAsignacion)],
  ['24 de septiembre de 2026', longDate(informe.fechaVisita)],
  ['25 de octubre de 2026', longDate(informe.fechaInforme)],
  ['10:16', informe.horaInicio || 'hora no consignada'],
  ['15:20', informe.horaFin || 'hora no consignada'],
  ['30 días calendario', informe.plazoSubsanacion || '30 días calendario']
 ];
 substitutions.forEach(([search, replacement]) => replaceEverywhere(document, search, replacement));

 replaceSection(body, 'OBJETIVO:', 'ANTECEDENTES:', lines(informe.objetivo));
 replaceSection(body, 'ANTECEDENTES:', 'BASE LEGAL:', antecedentes(informe));
 replaceSection(body, 'BASE LEGAL:', 'DESCRIPCION GENERAL:', lines(informe.baseLegal, i => `3.${i}.`));
 replaceSection(body, 'ANEXO:', 'CONCLUSIONES:', lines(informe.anexos, i => `ANEXO ${i}.`));
 replaceSection(body, 'CONCLUSIONES:', 'RECOMENDACIONES:', lines(informe.conclusiones, i => `6.${i}.`));
 replaceSection(
  body, 'RECOMENDACIONES:', 'Atentamente.',
  lines(informe.recomendaciones, i => `7.${i}.`),
  { preserve: paragraph => all(paragraph, 'footnoteReference').length > 0 }
 );

 setBodyParagraph(body, text => text.startsWith('El medio de transporte terrestre'),
  `El medio de transporte terrestre de combustibles líquidos y OPDH, operado por ${informe.empresa || 'el Agente Fiscalizado'}, cuenta con la siguiente información:`,
  'descripción general');
 setBodyParagraph(body, text => text.startsWith('Consulta del Registro de Hidrocarburos'),
  `Consulta del Registro de Hidrocarburos de fecha ${longDate(informe.fechaConsulta)}: Registro N.º ${informe.registroHidrocarburos || 'no consignado'}, titular ${informe.empresa || 'no consignado'}, placa principal ${informe.placa || 'no consignada'}${informe.placaTracto ? `, tracto ${informe.placaTracto}` : ''}, capacidad de ${informe.capacidad || 'no consignada'}${informe.compartimientos ? ` y ${informe.compartimientos} compartimientos` : ''}.`,
  'descripción de consulta registral');
 setBodyParagraph(body, text => text.startsWith('La fiscalización realizada al medio de transporte'),
  `La fiscalización realizada al medio de transporte terrestre de combustibles líquidos y OPDH, de placa principal ${informe.placa || 'no consignada'}, se llevó a cabo en ${informe.ubicacionVisita || 'lugar no consignado'}.`,
  'dirección');
 setBodyParagraph(body, text => text.includes('conforme al siguiente cuadro'),
  `Con fecha ${longDate(informe.fechaVisita)}, siendo las ${informe.horaInicio || 'hora no consignada'}, se inició la fiscalización a la unidad vehicular de placa principal ${informe.placa || 'no consignada'}, operada por ${informe.empresa || 'el Agente Fiscalizado'}, con Registro de Hidrocarburos N.º ${informe.registroHidrocarburos || 'no consignado'}. Se constataron las observaciones consignadas en el apartado II «Otros» del acta, conforme al cuadro siguiente:`,
  'inicio de visita');
 fillObservations(body, informe.observaciones || []);
 setBodyParagraph(body, text => text.startsWith('Fuente: Acta de Fiscalización'),
  `Fuente: Acta de Fiscalización de Seguridad de Medios de Transporte de Combustibles Líquidos y OPDH N.º ${informe.acta || informe.expediente || 'no consignado'}.`,
  'fuente del acta');
 setBodyParagraph(body, text => text.startsWith('Culminada la fiscalización'),
  `Culminada la fiscalización, se suscribió el Acta de Fiscalización de Seguridad de Medios de Transporte de Combustibles Líquidos y OPDH correspondiente al Expediente N.º ${informe.expediente || 'no consignado'}${informe.receptor ? `, recibida por ${informe.receptor}` : ''}${informe.dniReceptor ? `, identificado con DNI N.º ${informe.dniReceptor}` : ''}${informe.cargoReceptor ? `, en calidad de ${informe.cargoReceptor}` : ''}. La diligencia concluyó a las ${informe.horaFin || 'hora no consignada'}.`,
  'cierre de visita');
 fillSignatures(body, informe);
}

async function generarDocumento(informe) {
 if (!fs.existsSync(TEMPLATE)) throw new Error(`No se encontró la plantilla Word: ${TEMPLATE}`);
 const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE));
 const file = zip.file('word/document.xml');
 if (!file) throw new Error('La plantilla Word no contiene word/document.xml.');
 const document = new DOMParser().parseFromString(await file.async('string'), 'application/xml');
 fillDocument(document, informe);
 zip.file('word/document.xml', new XMLSerializer().serializeToString(document));
 const headerFile = zip.file('word/header1.xml');
 if (headerFile) {
  const header = new DOMParser().parseFromString(await headerFile.async('string'), 'application/xml');
  replaceEverywhere(header, 'SUPERVISIÓN TÉCNICA DEMOSTRATIVA E.I.R.L.', informe.empresaSupervisora || '');
  zip.file('word/header1.xml', new XMLSerializer().serializeToString(header));
 }
 return zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 6 }
 });
}

module.exports = { generarDocumento };
