const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML = 'http://www.w3.org/XML/1998/namespace';
const TEMPLATE = path.join(
 __dirname,
 'templates',
 'Informe_Supervision_Modelo_Identico_Anonimizado.docx'
);

function childElements(node, namespace, name) {
 const result = [];
 for (let child = node.firstChild; child; child = child.nextSibling) {
  if (child.nodeType === 1 &&
      child.namespaceURI === namespace &&
      (!name || child.localName === name)) {
   result.push(child);
  }
 }
 return result;
}

function descendants(node, namespace, name) {
 return Array.from(node.getElementsByTagNameNS(namespace, name));
}

function paragraphText(paragraph) {
 return descendants(paragraph, W, 't')
  .map(node => node.textContent || '')
  .join('');
}

function setParagraphText(paragraph, value) {
 const textNodes = descendants(paragraph, W, 't');
 if (!textNodes.length) {
  const run = paragraph.ownerDocument.createElementNS(W, 'w:r');
  const text = paragraph.ownerDocument.createElementNS(W, 'w:t');
  text.appendChild(paragraph.ownerDocument.createTextNode(value));
  text.setAttributeNS(XML, 'xml:space', 'preserve');
  run.appendChild(text);
  const properties = childElements(paragraph, W, 'pPr')[0];
  if (properties && properties.nextSibling) {
   paragraph.insertBefore(run, properties.nextSibling);
  } else {
   paragraph.appendChild(run);
  }
  return;
 }
 textNodes[0].textContent = value;
 textNodes[0].setAttributeNS(XML, 'xml:space', 'preserve');
 for (const text of textNodes.slice(1)) {
  text.textContent = '';
 }
}

function replaceParagraphOccurrence(paragraph, search, replacement) {
 const textNodes = descendants(paragraph, W, 't');
 const values = textNodes.map(node => node.textContent || '');
 const complete = values.join('');
 const start = complete.indexOf(search);
 if (start === -1) return false;
 const end = start + search.length;
 let offset = 0;
 let first = -1;
 let last = -1;

 for (let i = 0; i < values.length; i++) {
  const next = offset + values[i].length;
  if (first === -1 && start < next) first = i;
  if (end <= next) {
   last = i;
   break;
  }
  offset = next;
 }
 if (first === -1 || last === -1) return false;

 const firstOffset = start - values.slice(0, first).join('').length;
 const lastOffset = end - values.slice(0, last).join('').length;
 if (first === last) {
  values[first] = values[first].slice(0, firstOffset) +
   replacement + values[first].slice(lastOffset);
 } else {
  values[first] = values[first].slice(0, firstOffset) + replacement;
  for (let i = first + 1; i < last; i++) values[i] = '';
  values[last] = values[last].slice(lastOffset);
 }
 textNodes.forEach((node, index) => {
  node.textContent = values[index];
  if (values[index].startsWith(' ') || values[index].endsWith(' ')) {
   node.setAttributeNS(XML, 'xml:space', 'preserve');
  }
 });
 return true;
}

function replaceEverywhere(xmlDocument, search, replacement) {
 if (!search) return;
 const paragraphs = descendants(xmlDocument, W, 'p');
 for (const paragraph of paragraphs) {
  let attempts = 0;
  while (paragraphText(paragraph).includes(search) && attempts < 100) {
   if (!replaceParagraphOccurrence(paragraph, search, replacement)) break;
   attempts++;
  }
 }
}

function normalized(value) {
 return (value || '').normalize('NFC').trim().toLocaleUpperCase('es-PE');
}

function bodyParagraphs(body) {
 return childElements(body, W, 'p');
}

function findParagraph(body, predicate) {
 return bodyParagraphs(body).find(paragraph => predicate(paragraphText(paragraph)));
}

function requiredParagraph(body, predicate, label) {
 const paragraph = findParagraph(body, predicate);
 if (!paragraph) throw new Error(`No se encontró el apartado requerido de la plantilla: ${label}`);
 return paragraph;
}

function numberedLines(value, prefix) {
 const lines = (value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
 if (!lines.length) return ['No consignado.'];
 return lines.map((line, index) => {
  if (!prefix || /^\d+(?:\.\d+)*\.?\s/.test(line)) return line;
  return `${prefix(index + 1)} ${line}`;
 });
}

function replaceSection(body, startText, endText, values, options = {}) {
 const children = childElements(body, W);
 const start = children.findIndex(node =>
  node.localName === 'p' && normalized(paragraphText(node)) === normalized(startText)
 );
 const end = children.findIndex((node, index) =>
  index > start && node.localName === 'p' &&
  normalized(paragraphText(node)) === normalized(endText)
 );
 if (start === -1 || end === -1) {
  throw new Error(`No se pudo ubicar el intervalo ${startText} - ${endText} en la plantilla.`);
 }

 let entries = children.slice(start + 1, end)
  .filter(node => node.localName === 'p' && paragraphText(node).trim());
 const content = values.length ? values : ['No consignado.'];

 if (!entries.length) {
  throw new Error(`El apartado ${startText} no tiene un párrafo de plantilla para rellenar.`);
 }

 if (content.length > entries.length) {
  const prototype = entries[entries.length - 1];
  const nextNode = prototype.nextSibling;
  for (let i = entries.length; i < content.length; i++) {
   const copy = prototype.cloneNode(true);
   body.insertBefore(copy, nextNode);
   entries.push(copy);
  }
 }

 for (let i = 0; i < entries.length; i++) {
  if (i < content.length) {
   setParagraphText(entries[i], content[i]);
  } else if (options.preserve && options.preserve(entries[i])) {
   setParagraphText(entries[i], '');
  } else {
   body.removeChild(entries[i]);
  }
 }
}

function replaceCellParagraphs(cell, values) {
 const paragraphs = childElements(cell, W, 'p');
 const lines = values.slice();
 if (!paragraphs.length) return;
 if (lines.length > paragraphs.length) {
  const prototype = paragraphs[paragraphs.length - 1];
  const nextNode = prototype.nextSibling;
  for (let i = paragraphs.length; i < lines.length; i++) {
   const copy = prototype.cloneNode(true);
   cell.insertBefore(copy, nextNode);
   paragraphs.push(copy);
  }
 }
 for (let i = 0; i < paragraphs.length; i++) {
  setParagraphText(paragraphs[i], lines[i] || '');
 }
}

function directTables(body) {
 return childElements(body, W, 'tbl');
}

function getObservationTable(body) {
 return directTables(body).find(table =>
  paragraphText(table).toLocaleUpperCase('es-PE').includes('INCUMPLIMIENTO NORMATIVO')
 );
}

function fillObservations(body, observations) {
 const table = getObservationTable(body);
 if (!table) throw new Error('No se encontró la tabla de hechos constatados en la plantilla.');
 const rows = childElements(table, W, 'tr');
 if (rows.length < 2) throw new Error('La tabla de observaciones no contiene filas de datos.');

 const prototypes = rows.slice(1).map(row => row.cloneNode(true));
 rows.slice(1).forEach(row => table.removeChild(row));
 const items = observations.length ? observations : [{}];

 items.forEach((observation, index) => {
  const prototype = prototypes[Math.min(index, prototypes.length - 1)];
  const row = prototype.cloneNode(true);
  const cells = childElements(row, W, 'tc');
  if (cells.length !== 4) {
   throw new Error('La tabla de observaciones de la plantilla no tiene cuatro columnas.');
  }

  replaceCellParagraphs(cells[0], [observation.tipo || 'OTRAS OBSERVACIONES']);
  const baseLegal = observation.baseLegal
   ? `Base legal: ${observation.baseLegal}`
   : '';
  replaceCellParagraphs(cells[1], [
   observation.incumplimiento || 'No consignado.',
   '',
   baseLegal
  ]);
  replaceCellParagraphs(cells[2], [observation.descripcion || 'No consignado.']);
  replaceCellParagraphs(cells[3], [observation.medioProbatorio || 'No consignado.']);
  table.appendChild(row);
 });
}

function removeSampleSignatureImages(signatureTable) {
 const rows = childElements(signatureTable, W, 'tr');
 if (!rows.length) return;
 const signatureRow = rows[0];
 for (const name of ['drawing', 'pict']) {
  for (const image of descendants(signatureRow, W, name)) {
   let run = image.parentNode;
   while (run && run.parentNode !== signatureRow && run.localName !== 'r') {
    run = run.parentNode;
   }
   if (run && run.parentNode) run.parentNode.removeChild(run);
  }
 }
 const properties = childElements(signatureRow, W, 'trPr')[0];
 const existingHeight = properties && childElements(properties, W, 'trHeight')[0];
 if (!existingHeight) {
  const rowProperties = properties || signatureTable.ownerDocument.createElementNS(W, 'w:trPr');
  const height = signatureTable.ownerDocument.createElementNS(W, 'w:trHeight');
  height.setAttributeNS(W, 'w:val', '1200');
  height.setAttributeNS(W, 'w:hRule', 'atLeast');
  rowProperties.appendChild(height);
  if (!properties) signatureRow.insertBefore(rowProperties, signatureRow.firstChild);
 }
}

function fillSignatures(body, informe) {
 const tables = directTables(body);
 const table = tables.find(candidate => {
  const text = normalized(paragraphText(candidate));
  return text.includes('REPRESENTANTE LEGAL') && text.includes('FISCALIZADOR');
 });
 if (!table) throw new Error('No se encontró el bloque de firmas de la plantilla.');
 const rows = childElements(table, W, 'tr');
 const cells = rows.length > 1 ? childElements(rows[rows.length - 1], W, 'tc') : [];
 if (cells.length !== 2) throw new Error('El bloque de firmas de la plantilla no tiene dos columnas.');

 replaceCellParagraphs(cells[0], [
  informe.representanteLegal || '',
  informe.dniRepresentante ? `DNI N.º ${informe.dniRepresentante}` : '',
  'Representante Legal',
  informe.empresaSupervisora || ''
 ]);
 replaceCellParagraphs(cells[1], [
  informe.inspector || informe.supervisor || '',
  informe.cipInspector ? `CIP N.º ${informe.cipInspector}` : '',
  'Fiscalizador',
  informe.empresaSupervisora || ''
 ]);
 removeSampleSignatureImages(table);
}

function formatLongDate(value) {
 if (!value) return 'fecha no consignada';
 const [year, month, day] = value.split('-').map(Number);
 const date = new Date(Date.UTC(year, month - 1, day));
 return new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC'
 }).format(date);
}

function buildAntecedents(informe) {
 if (informe.antecedentes && informe.antecedentes.trim()) {
  return numberedLines(informe.antecedentes, index => `2.${index}.`);
 }
 const entries = [];
 if (informe.registroHidrocarburos || informe.fechaRegistro) {
  entries.push(`Con fecha ${formatLongDate(informe.fechaRegistro)}, ${informe.empresa || 'el Agente Fiscalizado'} obtuvo el Registro de Hidrocarburos N.º ${informe.registroHidrocarburos || 'no consignado'}, para operar la unidad vehicular de placa principal N.º ${informe.placa || 'no consignada'}${informe.placaTracto ? ` y tracto ${informe.placaTracto}` : ''}${informe.actividad ? `, en la actividad de ${informe.actividad}` : ''}${informe.capacidad ? `, con capacidad autorizada de ${informe.capacidad}` : ''}${informe.compartimientos ? ` y ${informe.compartimientos} compartimientos` : ''}${informe.direccionLegal ? `, con dirección legal en ${informe.direccionLegal}` : ''}.`);
 }
 if (informe.resolucion || informe.fechaResolucion) {
  entries.push(`Mediante ${informe.resolucion || 'la resolución o mandato correspondiente'}, de fecha ${formatLongDate(informe.fechaResolucion)}, se dispuso la presentación de la unidad vehicular de placa principal N.º ${informe.placa || 'no consignada'}.`);
 }
 if (informe.fechaComunicacion) {
  entries.push(`Con fecha ${formatLongDate(informe.fechaComunicacion)}, ${informe.empresa || 'el Agente Fiscalizado'} comunicó el lugar propuesto para la fiscalización: ${informe.ubicacionVisita || 'no consignado'}.`);
 }
 if (informe.asignacion || informe.fechaAsignacion) {
  entries.push(`Con fecha ${formatLongDate(informe.fechaAsignacion)}, mediante ${informe.asignacion || 'la asignación correspondiente'}, se asignó la Carta Línea N.º ${informe.cartaLinea || 'no consignada'} a ${informe.empresaSupervisora || 'la empresa supervisora'}, a fin de efectuar la fiscalización.`);
 }
 if (informe.fechaVisita) {
  entries.push(`Con fecha ${formatLongDate(informe.fechaVisita)}, ${informe.inspector || informe.supervisor || 'el fiscalizador'} realizó la visita y suscribió el Acta de Fiscalización N.º ${informe.acta || 'no consignada'}, correspondiente al Expediente N.º ${informe.expediente || 'no consignado'}.`);
 }
 entries.push(`Con fecha ${formatLongDate(informe.fechaInforme)}, se elabora el presente informe de fiscalización${informe.cartaLinea ? `, correspondiente a la Carta Línea N.º ${informe.cartaLinea}` : ''} y al Expediente N.º ${informe.expediente || 'no consignado'}, para su evaluación.`);
 return numberedLines(entries.join('\n'), index => `2.${index}.`);
}

function setBodyParagraph(body, predicate, value, label) {
 const paragraph = requiredParagraph(body, predicate, label);
 setParagraphText(paragraph, value);
}

function fillDocument(xmlDocument, informe) {
 const body = xmlDocument.getElementsByTagNameNS(W, 'body')[0];
 if (!body) throw new Error('El documento Word no contiene el cuerpo esperado.');

 const substitutions = [
  ['TRANSPORTES MODELO DEMOSTRATIVO S.A.C.', informe.empresa || 'Agente Fiscalizado'],
  ['SUPERVISIÓN TÉCNICA DEMOSTRATIVA E.I.R.L.', informe.empresaSupervisora || ''],
  ['Carlos Ejemplo Rivera', informe.inspector || informe.supervisor || ''],
  ['Elena Referencia Torres', informe.representanteLegal || ''],
  ['PEDRO MODELO GARCIA', informe.receptor || ''],
  ['20000000001', informe.ruc || ''],
  ['00000-060-000000', informe.registroHidrocarburos || ''],
  ['202600000000', informe.expediente || ''],
  ['0000000-0', informe.cartaLinea || ''],
  ['ABC-000', informe.placa || ''],
  ['XYZ-000', informe.placaTracto || ''],
  ['DIRECCIÓN FICTICIA PARA CAPACITACIÓN', informe.direccionLegal || informe.ubicacionVisita || ''],
  ['CHURUBAMBA', (informe.distrito || '').toLocaleUpperCase('es-PE')],
  ['HUÁNUCO', (informe.departamento || '').toLocaleUpperCase('es-PE')],
  ['29 de agosto de 2024', formatLongDate(informe.fechaRegistro)],
  ['10 de septiembre de 2026', formatLongDate(informe.fechaResolucion)],
  ['11 de septiembre de 2026', formatLongDate(informe.fechaComunicacion)],
  ['18 de septiembre de 2026', formatLongDate(informe.fechaAsignacion)],
  ['24 de septiembre de 2026', formatLongDate(informe.fechaVisita)],
  ['25 de octubre de 2026', formatLongDate(informe.fechaInforme)],
  ['10:16', informe.horaInicio || 'hora no consignada'],
  ['15:20', informe.horaFin || 'hora no consignada'],
  ['30 días calendario', informe.plazoSubsanacion || '30 días calendario']
 ];
 substitutions.forEach(([search, replacement]) =>
  replaceEverywhere(xmlDocument, search, replacement)
 );

 const heading = requiredParagraph(body, text => normalized(text).includes('INFORME DE SUPERVISIÓN'), 'título');
 const title = paragraphText(heading);
 if (title.includes('202600000000')) {
  replaceParagraphOccurrence(heading, '202600000000', informe.expediente || '');
 }

 setBodyParagraph(body, text => text.startsWith('Huánuco,'),
  `Huánuco, ${formatLongDate(informe.fechaInforme)}\tExpediente: ${informe.expediente || 'No consignado'}`,
  'fecha y expediente');
 setBodyParagraph(body, text => text.trim().startsWith('A:'),
  `A:\t${informe.destinatario || 'Oficina Regional'}`,
  'destinatario');
 setBodyParagraph(body, text => text.trim().startsWith('De:'),
  `De:\t${informe.inspector || informe.supervisor || 'No consignado'}`,
  'remitente');
 setBodyParagraph(body, text => text.trim().startsWith('Supervisor ES'),
  `Supervisor ES ${informe.empresaSupervisora || ''}`.trim(),
  'empresa supervisora');
 setBodyParagraph(body, text => text.trim().startsWith('Asunto'),
  `Asunto   :   Fiscalización de SEGURIDAD DE MEDIOS DE TRANSPORTE DE COMBUSTIBLE LÍQUIDOS Y OPDH, operado por ${informe.empresa || 'No consignado'}.`,
  'asunto');
 setBodyParagraph(body, text => text.trim().startsWith('Referencia:'),
  `Referencia:   Registro de Hidrocarburos de OSINERGMIN N.º ${informe.registroHidrocarburos || 'No consignado'}`,
  'referencia');

 replaceSection(
  body, 'OBJETIVO:', 'ANTECEDENTES:',
  numberedLines(informe.objetivo, null)
 );
 replaceSection(
  body, 'ANTECEDENTES:', 'BASE LEGAL:',
  buildAntecedents(informe)
 );
 replaceSection(
  body, 'BASE LEGAL:', 'DESCRIPCION GENERAL:',
  numberedLines(informe.baseLegal, index => `3.${index}.`)
 );
 replaceSection(
  body, 'ANEXO:', 'CONCLUSIONES:',
  numberedLines(informe.anexos, index => `ANEXO ${index}.`)
 );
 replaceSection(
  body, 'CONCLUSIONES:', 'RECOMENDACIONES:',
  numberedLines(informe.conclusiones, index => `6.${index}.`)
 );
 replaceSection(
  body, 'RECOMENDACIONES:', 'Atentamente.',
  numberedLines(informe.recomendaciones, index => `7.${index}.`),
  { preserve: paragraph => descendants(paragraph, W, 'footnoteReference').length > 0 }
 );

 const capacidad = informe.capacidad || 'capacidad no consignada';
 setBodyParagraph(body, text => text.startsWith('El medio de transporte terrestre'),
  `El medio de transporte terrestre de combustibles líquidos y OPDH, operado por ${informe.empresa || 'el Agente Fiscalizado'}, cuenta con la siguiente información:`,
  'descripción general');
 setBodyParagraph(body, text => text.startsWith('Consulta del Registro de Hidrocarburos'),
  `Consulta del Registro de Hidrocarburos de fecha ${formatLongDate(informe.fechaConsulta)}: Registro N.º ${informe.registroHidrocarburos || 'no consignado'}, titular ${informe.empresa || 'no consignado'}, placa principal ${informe.placa || 'no consignada'}${informe.placaTracto ? `, tracto ${informe.placaTracto}` : ''}, capacidad de ${capacidad}${informe.compartimientos ? ` y ${informe.compartimientos} compartimientos` : ''}.`,
  'descripción de consulta registral');
 setBodyParagraph(body, text => text.startsWith('La fiscalización realizada al medio de transporte'),
  `La fiscalización realizada al medio de transporte terrestre de combustibles líquidos y OPDH, de placa principal ${informe.placa || 'no consignada'}, se llevó a cabo en ${informe.ubicacionVisita || 'lugar no consignado'}.`,
  'dirección');
 setBodyParagraph(body, text => text.startsWith('Con fecha 24 de septiembre de 2026, siendo'),
  `Con fecha ${formatLongDate(informe.fechaVisita)}, siendo las ${informe.horaInicio || 'hora no consignada'}, se inició la fiscalización a la unidad vehicular de placa principal ${informe.placa || 'no consignada'}, operada por ${informe.empresa || 'el Agente Fiscalizado'}, con Registro de Hidrocarburos N.º ${informe.registroHidrocarburos || 'no consignado'}. Se constataron las observaciones consignadas en el apartado II «Otros» del acta, conforme al cuadro siguiente:`,
  'inicio de visita');
 fillObservations(body, informe.observaciones || []);
 setBodyParagraph(body, text => text.startsWith('Fuente: Acta de Fiscalización'),
  `Fuente: Acta de Fiscalización de Seguridad de Medios de Transporte de Combustibles Líquidos y OPDH N.º ${informe.acta || informe.expediente || 'no consignado'}.`,
  'fuente del acta');
 setBodyParagraph(body, text => text.startsWith('Culminada la fiscalización'),
  `Culminada la fiscalización, se suscribió el Acta de Fiscalización de Seguridad de Medios de Transporte de Combustibles Líquidos y OPDH correspondiente al Expediente N.º ${informe.expediente || 'no consignado'}${informe.receptor ? `, recibida por ${informe.receptor}` : ''}${informe.dniReceptor ? `, identificado con DNI N.º ${informe.dniReceptor}` : ''}${informe.cargoReceptor ? `, en calidad de ${informe.cargoReceptor}` : ''}. La diligencia concluyó a las ${informe.horaFin || 'hora no consignada'}.`,
  'cierre de visita');

 fillSignatures(body, informe);
 return body;
}

async function generarDocumento(informe) {
 if (!fs.existsSync(TEMPLATE)) {
  throw new Error(`No se encontró la plantilla Word: ${TEMPLATE}`);
 }
 const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE));
 const serializer = new XMLSerializer();
 const mainFile = zip.file('word/document.xml');
 if (!mainFile) throw new Error('La plantilla Word no contiene word/document.xml.');
 const xml = await mainFile.async('string');
 const document = new DOMParser().parseFromString(xml, 'application/xml');
 fillDocument(document, informe);
 zip.file('word/document.xml', serializer.serializeToString(document));

 const headerFile = zip.file('word/header1.xml');
 if (headerFile) {
  const header = new DOMParser().parseFromString(
   await headerFile.async('string'),
   'application/xml'
  );
  replaceEverywhere(
   header,
   'SUPERVISIÓN TÉCNICA DEMOSTRATIVA E.I.R.L.',
   informe.empresaSupervisora || ''
  );
  zip.file('word/header1.xml', serializer.serializeToString(header));
 }

 return zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 6 }
 });
}

module.exports = { generarDocumento };
