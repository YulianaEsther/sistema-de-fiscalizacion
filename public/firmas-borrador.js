const observadorFirmasPendientes = new MutationObserver(() => {
 queueMicrotask(() => {
  const vista = document.getElementById('vista');
  if (!informeActual || vista.querySelector('.firmas-documento')) return;
  if (!vista.querySelector('.documento-cabecera')) return;

  const seccion = document.createElement('section');
  seccion.className = 'firmas-documento';
  const despedida = document.createElement('p');
  despedida.textContent = 'Atentamente,';
  seccion.appendChild(despedida);

  const firmas = document.createElement('div');
  firmas.className = 'firmas-bloques';
  [
   {
    cargo: 'Representante legal',
    nombre: informeActual.representanteLegal,
    identificacion: informeActual.dniRepresentante
     ? `DNI N.º ${informeActual.dniRepresentante}`
     : ''
   },
   {
    cargo: 'Fiscalizador',
    nombre: informeActual.inspector || informeActual.supervisor,
    identificacion: informeActual.cipInspector
     ? `CIP N.º ${informeActual.cipInspector}`
     : ''
   }
  ].forEach(firma => {
   const bloque = document.createElement('div');
   bloque.className = 'firma-bloque';
   const linea = document.createElement('div');
   linea.className = 'firma-linea';
   bloque.appendChild(linea);
   if (firma.nombre) {
    const nombre = document.createElement('p');
    nombre.className = 'firma-nombre';
    nombre.textContent = firma.nombre;
    bloque.appendChild(nombre);
   }
   if (firma.identificacion) {
    const identificacion = document.createElement('p');
    identificacion.textContent = firma.identificacion;
    bloque.appendChild(identificacion);
   }
   const cargo = document.createElement('p');
   cargo.className = 'firma-cargo';
   cargo.textContent = firma.cargo;
   bloque.appendChild(cargo);
   if (informeActual.empresaSupervisora) {
    const empresa = document.createElement('p');
    empresa.textContent = informeActual.empresaSupervisora;
    bloque.appendChild(empresa);
   }
   firmas.appendChild(bloque);
  });

  seccion.appendChild(firmas);
  vista.appendChild(seccion);
 });
});

observadorFirmasPendientes.observe(document.getElementById('vista'), {
 childList: true
});
