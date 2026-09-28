export type ErrorTelefono = 'caracteristica_invalida' | 'numero_invalido' | 'largo_invalido';

export type ResultadoTelefono =
  { ok: true; telefono: string } | { ok: false; error: ErrorTelefono };

const DIGITOS_NACIONALES = 10;
const PREFIJO_MOVIL = '549';

/**
 * Normaliza un celular argentino ingresado en dos campos a `549` + característica + número
 * (13 dígitos). Quita todo lo que no sea dígito, un `0` inicial de la característica y un `15`
 * inicial del número cuando sobra. No tira excepciones.
 *
 * `normalizarTelefono('0336', '15 412-3456')` → `{ ok: true, telefono: '5493364123456' }`
 */
export function normalizarTelefono(caracteristica: string, numero: string): ResultadoTelefono {
  let car = caracteristica.replace(/\D/g, '');
  let num = numero.replace(/\D/g, '');

  if (car.startsWith('0')) car = car.slice(1);
  if (car.length < 2 || car.length > 4 || car.startsWith('0')) {
    return { ok: false, error: 'caracteristica_invalida' };
  }

  // El 15 solo se quita si es el prefijo de celular: sobran exactamente esos 2 dígitos.
  if (num.startsWith('15') && car.length + num.length === DIGITOS_NACIONALES + 2) {
    num = num.slice(2);
  }
  if (num.length === 0) return { ok: false, error: 'numero_invalido' };
  if (car.length + num.length !== DIGITOS_NACIONALES) return { ok: false, error: 'largo_invalido' };

  return { ok: true, telefono: `${PREFIJO_MOVIL}${car}${num}` };
}
