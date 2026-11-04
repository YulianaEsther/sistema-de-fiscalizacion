const {
 AlignmentType,
 BorderStyle,
 Document,
 Footer,
 Header,
 PageNumber,
 Packer,
 Paragraph,
 ShadingType,
 Table,
 TableCell,
 TableRow,
 TextRun,
 WidthType
} = require('docx');

const azul = '17365D';
const azulClaro = 'D9EAF7';
const gris = 'D9E1F2';
const anchoPagina = 9360;

function fecha(valor) {
 if (!valor) return '';
 const partes = valor.split('-');
 return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : valor;
}

function parrafo(texto, opciones = {}) {
 return new Paragraph({
  alignment: opciones.alignment || AlignmentType.JUSTIFIED,
  spacing: { after: opciones.after === undefined ? 100 : opciones.after, line: 300 },
  keepNext: opciones.keepNext,
  indent: opciones.indent,
  shading: opciones.shading,
  border: opciones.border,
  children: [new TextRun({
   text: texto || '',
   bold: opciones.bold || false,
   italics: opciones.italics || false,
   color: opciones.color,
   size: opciones.size || 22,
   font: 'Arial'
  })]
 });
}

function encabezadoSeccion(titulo, nivel = 1) {
 return new Paragraph({
  heading: nivel === 1 ? 'Heading1' : 'Heading2',
  keepNext: true,
  spacing: { before: nivel === 1 ? 260 : 160, after: 100 },
  border: nivel === 1 ? {
   bottom: { color: azul, space: 4, style: BorderStyle.SINGLE, size: 6 }
  } : undefined,
  children: [new TextRun({
   text: titulo,
   bold: true,
   color: azul,
   size: nivel === 1 ? 24 : 22,
   font: 'Arial'
  })]
 });
}

function textoEnParrafos(valor, prefijo) {
 const lineas = (valor || '').split(/\n/).map(linea => linea.trim()).filter(Boolean);
 if (!lineas.length) return [parrafo('No consignado.', { italics: true, color: '667085' })];
 return lineas.map((linea, indice) => {
  const yaNumerado = /^\s*(?:\d+(?:\.\d+)*\.?|[IVXLCDM]+\.?)\s+/i.test(linea);
  return parrafo(prefijo && !yaNumerado ? `${prefijo(indice + 1)} ${linea}` : linea);
 });
}

function celda(texto, ancho, opciones = {}) {
 return new TableCell({
  width: { size: ancho, type: WidthType.DXA },
  margins: { top: 90, bottom: 90, left: 100, right: 100 },
  shading: opciones.fondo ? { fill: opciones.fondo, type: ShadingType.CLEAR } : undefined,
  verticalAlign: 'center',
  children: [parrafo(texto || 'No consignado.', {
   alignment: opciones.alignment || AlignmentType.LEFT,
   bold: opciones.bold,
   size: opciones.size || 18,
   color: opciones.color
  })]
 });
}

function tablaDatos(filas) {
 const bordes = {
  top: { style: BorderStyle.SINGLE, size: 1, color: gris },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: gris },
  left: { style: BorderStyle.SINGLE, size: 1, color: gris },
  right: { style: BorderStyle.SINGLE, size: 1, color: gris },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: gris },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: gris }
 };
 return new Table({
  width: { size: anchoPagina, type: WidthType.DXA },
  columnWidths: [2600, anchoPagina - 2600],
  borders: bordes,
  rows: filas.map(([etiqueta, valor]) => new TableRow({
   cantSplit: true,
   children: [
    celda(etiqueta, 2600, { bold: true, fondo: 'F1F5F9', size: 19 }),
    celda(valor, anchoPagina - 2600, { size: 19 })
   ]
  }))
 });
}

function tablaObservaciones(observaciones) {
 const anchos = [650, 1680, 2480, 2900, 1650];
 const bordes = {
  top: { style: BorderStyle.SINGLE, size: 1, color: gris },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: gris },
  left: { style: BorderStyle.SINGLE, size: 1, color: gris },
  right: { style: BorderStyle.SINGLE, size: 1, color: gris },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: gris },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: gris }
 };
 const titulos = ['N.º', 'CLASIFICACIÓN', 'INCUMPLIMIENTO NORMATIVO / BASE LEGAL', 'DESCRIPCIÓN DEL HECHO VERIFICADO', 'MEDIO PROBATORIO'];
 const filas = [new TableRow({
  tableHeader: true,
  cantSplit: true,
  children: titulos.map((titulo, indice) => celda(titulo, anchos[indice], {
   bold: true, fondo: azul, color: 'FFFFFF', size: 15, alignment: AlignmentType.CENTER
  }))
 })];
 const datos = observaciones.length ? observaciones : [{}];
 datos.forEach((observacion, indice) => {
  const norma = [observacion.incumplimiento, observacion.baseLegal && `Base legal: ${observacion.baseLegal}`].filter(Boolean).join('\n');
  const valores = [
   String(indice + 1),
   observacion.tipo || 'No consignado',
   norma || 'No consignado',
   observacion.descripcion || 'No consignado',
   observacion.medioProbatorio || 'No consignado'
  ];
  filas.push(new TableRow({
   cantSplit: true,
   children: valores.map((valor, celdaIndice) => celda(valor, anchos[celdaIndice], {
    size: 16,
    alignment: celdaIndice === 0 ? AlignmentType.CENTER : AlignmentType.LEFT
   }))
  }));
 });
 return new Table({
  width: { size: anchoPagina, type: WidthType.DXA },
  columnWidths: anchos,
  borders: bordes,
  rows: filas
 });
}

function celdaFirma(nombre, identificacion, cargo, empresa) {
 const linea = new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 600, after: 100 },
  border: { top: { color: '667085', space: 4, style: BorderStyle.SINGLE, size: 6 } },
  children: [new TextRun({ text: nombre || ' ', font: 'Arial', size: 19 })]
 });
 const detalles = [identificacion, cargo, empresa].filter(Boolean).map(texto =>
  parrafo(texto, { alignment: AlignmentType.CENTER, size: 17, after: 40 })
 );
 return new TableCell({
  width: { size: anchoPagina / 2, type: WidthType.DXA },
  margins: { top: 100, bottom: 100, left: 220, right: 220 },
  verticalAlign: 'center',
  children: [linea, ...detalles]
 });
}

function tablaFirmas(informe, empresaSupervisora) {
 const bordes = {
  top: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' }
 };
 return new Table({
  width: { size: anchoPagina, type: WidthType.DXA },
  columnWidths: [anchoPagina / 2, anchoPagina / 2],
  borders: bordes,
  rows: [new TableRow({
   cantSplit: true,
   children: [
    celdaFirma(
     informe.representanteLegal || '',
     informe.dniRepresentante ? 'DNI N.? ' + informe.dniRepresentante : '',
     'Representante legal',
     empresaSupervisora
    ),
    celdaFirma(
     informe.inspector || informe.supervisor || '',
     informe.cipInspector ? 'CIP N.? ' + informe.cipInspector : '',
     'Fiscalizador',
     empresaSupervisora
    )
   ]
  })]
 });
}

function crearContenido(informe) {
 const contenido = [];
 const fechaInforme = fecha(informe.fechaInforme);
 const nombreRemitente = informe.supervisor || informe.inspector || 'No consignado';
 const empresaSupervisora = informe.empresaSupervisora || '';

 contenido.push(parrafo('INFORME DE SUPERVISIÓN', {
  alignment: AlignmentType.CENTER, bold: true, color: azul, size: 30, after: 80
 }));
 contenido.push(parrafo(`Huánuco${fechaInforme ? `, ${fechaInforme}` : ''}`, {
  alignment: AlignmentType.RIGHT, after: 40
 }));
 contenido.push(parrafo(`Expediente: ${informe.expediente || 'No consignado'}`, {
  alignment: AlignmentType.RIGHT, bold: true
 }));
 contenido.push(parrafo(`A: ${informe.destinatario || 'Oficina Regional'}`, { after: 40 }));
 contenido.push(parrafo(`De: ${nombreRemitente}${empresaSupervisora ? `\n${empresaSupervisora}` : ''}`, { after: 40 }));
 contenido.push(parrafo(`Asunto: Fiscalización de seguridad del medio de transporte de combustibles líquidos y OPDH operado por ${informe.empresa || 'No consignado'}.`, { after: 40 }));
 contenido.push(parrafo(`Referencia: Registro de Hidrocarburos N.º ${informe.registroHidrocarburos || 'No consignado'}${informe.cartaLinea ? ` · Carta Línea N.º ${informe.cartaLinea}` : ''}.`, { after: 200 }));

 contenido.push(encabezadoSeccion('1. OBJETIVO'));
 contenido.push(...textoEnParrafos(informe.objetivo));

 contenido.push(encabezadoSeccion('2. ANTECEDENTES'));
 contenido.push(...textoEnParrafos(informe.antecedentes, numero => `2.${numero}.`));

 contenido.push(encabezadoSeccion('3. BASE LEGAL'));
 contenido.push(...textoEnParrafos(informe.baseLegal, numero => `3.${numero}.`));

 contenido.push(encabezadoSeccion('4. DESCRIPCIÓN GENERAL'));
 contenido.push(parrafo(`El medio de transporte terrestre de combustibles líquidos y OPDH, operado por ${informe.empresa || 'No consignado'}, cuenta con la siguiente información:`));
 contenido.push(encabezadoSeccion('4.1. Datos del Registro de Hidrocarburos', 2));
 contenido.push(tablaDatos([
  ['Agente fiscalizado', informe.empresa],
  ['R.U.C.', informe.ruc],
  ['Registro de Hidrocarburos N.º', informe.registroHidrocarburos],
  ['Placa principal', informe.placa],
  ['Placa del tracto', informe.placaTracto],
  ['Actividad autorizada', informe.actividad],
  ['Capacidad autorizada', informe.capacidad],
  ['Compartimientos', informe.compartimientos],
  ['Fecha de consulta registral', fecha(informe.fechaConsulta)],
  ['Dirección legal', [informe.direccionLegal, informe.distrito, informe.provincia, informe.departamento].filter(Boolean).join(', ')]
 ]));
 if (informe.descripcionGeneral) contenido.push(...textoEnParrafos(informe.descripcionGeneral));

 contenido.push(encabezadoSeccion('4.2. Dirección', 2));
 contenido.push(parrafo(informe.ubicacionVisita || 'No consignado.'));
 contenido.push(encabezadoSeccion('4.3. De la visita de fiscalización', 2));
 const inicio = informe.horaInicio ? `, siendo las ${informe.horaInicio} horas` : '';
 const fechaVisita = fecha(informe.fechaVisita);
 contenido.push(parrafo(`Con fecha ${fechaVisita || 'no consignada'}${inicio}, se inició la fiscalización a la unidad vehicular de placa principal ${informe.placa || 'no consignada'}, operada por ${informe.empresa || 'no consignado'}, con Registro de Hidrocarburos N.º ${informe.registroHidrocarburos || 'no consignado'}. Se constataron los hechos descritos en la tabla siguiente:`));
 contenido.push(parrafo('TABLA N.º 01. HECHOS CONSTATADOS EN EL ACTA DE FISCALIZACIÓN', { bold: true, alignment: AlignmentType.CENTER, color: azul, size: 20, after: 100 }));
 contenido.push(tablaObservaciones(informe.observaciones || []));
 contenido.push(parrafo(`Fuente: Acta de Fiscalización${informe.acta ? ` N.º ${informe.acta}` : ''}${informe.expediente ? ` correspondiente al Expediente N.º ${informe.expediente}` : ''}.`, { italics: true, size: 18, after: 140 }));
 if (informe.analisis) {
  contenido.push(encabezadoSeccion('4.3.1. Análisis de los hechos', 2));
  contenido.push(...textoEnParrafos(informe.analisis));
 }
 if (informe.tieneDescargo) {
  contenido.push(encabezadoSeccion('4.3.2. Evaluación de descargos', 2));
  contenido.push(...textoEnParrafos(informe.descargos));
 }
 const recepcion = [
  informe.receptor,
  informe.dniReceptor && `DNI N.º ${informe.dniReceptor}`,
  informe.cargoReceptor && `en calidad de ${informe.cargoReceptor}`
 ].filter(Boolean).join(', ');
 contenido.push(parrafo(`Culminada la fiscalización${informe.horaFin ? ` a las ${informe.horaFin} horas` : ''}, se suscribió el Acta de Fiscalización${informe.acta ? ` N.º ${informe.acta}` : ''}${informe.expediente ? ` correspondiente al Expediente N.º ${informe.expediente}` : ''}${recepcion ? `, recibida por ${recepcion}` : ''}.`));

 contenido.push(encabezadoSeccion('5. ANEXOS'));
 contenido.push(parrafo('De la visita realizada a la unidad vehicular se recabó la documentación siguiente:'));
 contenido.push(...textoEnParrafos(informe.anexos, numero => `${numero}.`));

 contenido.push(encabezadoSeccion('6. CONCLUSIONES'));
 contenido.push(parrafo('De la visita de fiscalización se concluye lo siguiente:'));
 contenido.push(...textoEnParrafos(informe.conclusiones, numero => `6.${numero}.`));

 contenido.push(encabezadoSeccion('7. RECOMENDACIONES'));
 contenido.push(parrafo('Por lo expuesto en el presente informe, se recomienda:'));
 contenido.push(...textoEnParrafos(informe.recomendaciones, numero => `7.${numero}.`));
 if (informe.plazoSubsanacion) {
  contenido.push(parrafo(`Se recomienda otorgar un plazo de ${informe.plazoSubsanacion} para la subsanación, de corresponder y conforme a la normativa aplicable.`));
 }
 if (informe.notaPlazo) {
  contenido.push(parrafo(`Nota: ${informe.notaPlazo}`, { size: 18 }));
 }
 contenido.push(parrafo('Atentamente,', { alignment: AlignmentType.LEFT, before: 300 }));
 contenido.push(new Paragraph({ children: [] }));

 contenido.push(tablaFirmas(informe, empresaSupervisora));
 return contenido;
}

async function generarDocumento(informe) {
 const header = new Header({
  children: [new Paragraph({
   alignment: AlignmentType.RIGHT,
   border: { bottom: { color: azul, space: 5, style: BorderStyle.SINGLE, size: 8 } },
   children: [new TextRun({ text: 'SISFIS · INFORME DE FISCALIZACIÓN', bold: true, color: azul, size: 16, font: 'Arial' })]
  })]
 });
 const footer = new Footer({
  children: [new Paragraph({
   alignment: AlignmentType.CENTER,
   children: [
    new TextRun({ text: 'Documento generado por SISFIS · Página ', size: 16, color: '667085', font: 'Arial' }),
    new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '667085', font: 'Arial' })
   ]
  })]
 });
 const documento = new Document({
  creator: 'SISFIS',
  title: `Informe de Supervisión - ${informe.expediente || 'sin expediente'}`,
  subject: 'Informe de fiscalización',
  description: 'Informe elaborado a partir de los datos registrados en SISFIS.',
  styles: {
   default: {
    document: {
     run: { font: 'Arial', size: 22, color: '202124' },
     paragraph: { spacing: { after: 100, line: 300 } }
    }
   }
  },
  sections: [{
   properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
   headers: { default: header },
   footers: { default: footer },
   children: crearContenido(informe)
  }]
 });
 return Packer.toBuffer(documento);
}

module.exports = { generarDocumento };
