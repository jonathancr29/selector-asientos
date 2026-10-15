// Texto retenido, en unidades UTF-16 de dos bytes: no equivale al heap del motor.
const HISTORIAL_ESTADOS_MAXIMOS = 51;
const HISTORIAL_BYTES_MAXIMOS = 16 * 1024 * 1024;
const bytesDeEstadoHistorial = (estado) => 2 * ((estado.plano?.length || 0) + estado.firma.length);

// Conserva el actual y la firma guardada. Si juntos no caben, el exceso es deliberado:
// descartarlos para cumplir el presupuesto impediria restaurar o reconocer el guardado.
function crearHistorial(inicial, maximo = HISTORIAL_ESTADOS_MAXIMOS, maxBytes = HISTORIAL_BYTES_MAXIMOS) {
  const estados = [inicial];
  const pesos = [bytesDeEstadoHistorial(inicial)];
  let bytesEstados = pesos[0];
  let indice = 0;
  let guardado = inicial.firma;
  const bytes = () => bytesEstados + 2 * guardado.length;
  const recortar = () => {
    while (estados.length > 1 && (estados.length > maximo || bytes() > maxBytes)) {
      // Primero las versiones mas antiguas; si el actual es el primero, el redo mas lejano.
      if (indice > 0) {
        bytesEstados -= pesos.shift(); estados.shift(); indice--;
      } else {
        bytesEstados -= pesos.pop(); estados.pop();
      }
    }
  };
  return {
    registrar(estado) {
      if (estado.firma === estados[indice].firma) return false;
      estados.splice(indice + 1);
      for (const peso of pesos.splice(indice + 1)) bytesEstados -= peso;
      estados.push(estado);
      const peso = bytesDeEstadoHistorial(estado);
      pesos.push(peso); bytesEstados += peso;
      indice = estados.length - 1;
      recortar();
      return true;
    },
    deshacer() { return indice ? estados[--indice] : null; },
    rehacer() { return indice < estados.length - 1 ? estados[++indice] : null; },
    puedeDeshacer() { return indice > 0; },
    puedeRehacer() { return indice < estados.length - 1; },
    actualizarActual(estado) {
      bytesEstados -= pesos[indice];
      estados[indice] = estado; pesos[indice] = bytesDeEstadoHistorial(estado);
      bytesEstados += pesos[indice]; recortar();
    },
    marcarGuardado() { guardado = estados[indice].firma; recortar(); },
    tieneCambios() { return estados[indice].firma !== guardado; },
    medidas() { return { estados: estados.length, bytes: bytes(), maximo, maxBytes, excedido: bytes() > maxBytes }; },
  };
}
