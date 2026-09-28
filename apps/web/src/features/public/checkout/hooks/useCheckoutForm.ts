import {
  normalizarTelefono,
  type CreateOrderRequest,
  type ErrorTelefono,
  type MetodoPago,
} from '@blackstation/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useToast } from '../../../../components/Toast';
import { ApiError } from '../../../../services';
import { useCart, useCartView } from '../../carrito/hooks/useCart';
import { useSlots } from '../../hooks/useSlots';
import { guardarCliente, guardarPedidoActivo, leerCliente } from '../../storage';
import { useCreateOrder } from './useCreateOrder';

/** Ids de los controles y secciones, para enfocar o scrollear hasta un error. */
export const CHECKOUT_IDS = {
  nombre: 'checkout-nombre',
  caracteristica: 'checkout-caracteristica',
  numero: 'checkout-numero',
  horario: 'checkout-horario',
  pago: 'checkout-pago',
  aclaracion: 'checkout-aclaracion',
  bloqueado: 'checkout-bloqueado',
} as const;

type CampoConError = 'nombre' | 'telefono' | 'hora' | 'aclaracion';
export type ErroresCheckout = Partial<Record<CampoConError, string>>;

const DESTINO_ERROR: Record<CampoConError, string> = {
  nombre: CHECKOUT_IDS.nombre,
  telefono: CHECKOUT_IDS.numero,
  hora: CHECKOUT_IDS.horario,
  aclaracion: CHECKOUT_IDS.aclaracion,
};

const MENSAJE_TELEFONO: Record<ErrorTelefono, string> = {
  caracteristica_invalida: 'Revisá la característica (por ejemplo, 336).',
  numero_invalido: 'Ingresá tu número de celular.',
  largo_invalido: 'El número no tiene la cantidad de dígitos correcta.',
};

const CODES_FRANJA = ['SLOT_FULL', 'SLOT_CLOSED', 'SLOT_TOO_SOON', 'INVALID_SLOT'];
const CODES_CATALOGO = [
  'PRODUCT_UNAVAILABLE',
  'EXTRA_UNAVAILABLE',
  'INVALID_REMOVED',
  'INVALID_EXTRA_QUANTITY',
];
const CODES_CERRADO = ['ORDERS_DISABLED', 'CLOSED'];

function llevarA(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}

export function useCheckoutForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { vaciar, abrirDrawer } = useCart();
  const { lineas } = useCartView();
  const slots = useSlots();
  const createOrder = useCreateOrder();

  const [guardado] = useState(leerCliente);
  const [nombre, setNombre] = useState(guardado?.nombre ?? '');
  const [caracteristica, setCaracteristica] = useState(guardado?.caracteristica ?? '336');
  const [numero, setNumero] = useState(guardado?.numero ?? '');
  const [hora, setHora] = useState<string | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('transferencia');
  const [aclaracion, setAclaracion] = useState('');
  const [errores, setErrores] = useState<ErroresCheckout>({});
  /** 403 `TRANSFER_REQUIRED` para este teléfono. */
  const [soloTransferencia, setSoloTransferencia] = useState(false);
  /** 403 `CUSTOMER_BLOCKED` para este teléfono. */
  const [bloqueado, setBloqueado] = useState(false);
  /** 423: el local cerró mientras se completaba el formulario. */
  const [cerrado, setCerrado] = useState(false);

  // Si la franja elegida desaparece del listado (se llenó o pasó), deja de contar como elegida.
  const franjas = slots.data?.slots ?? [];
  const horaElegida = hora !== null && franjas.some((f) => f.hora === hora) ? hora : null;
  const franjaPerdida = hora !== null && slots.data && horaElegida === null ? hora : null;

  function setError(campo: CampoConError, mensaje: string | undefined) {
    setErrores((actuales) => {
      const nuevos = { ...actuales };
      if (mensaje) nuevos[campo] = mensaje;
      else delete nuevos[campo];
      return nuevos;
    });
  }

  function limpiarError(campo: CampoConError) {
    setError(campo, undefined);
  }

  function validarTelefono(): string | undefined {
    const resultado = normalizarTelefono(caracteristica, numero);
    return resultado.ok ? undefined : MENSAJE_TELEFONO[resultado.error];
  }

  /** Validación al salir del campo. */
  function blurTelefono(campo: 'caracteristica' | 'numero') {
    if (campo === 'caracteristica' && !numero.trim()) return;
    setError('telefono', validarTelefono());
  }

  function blurNombre() {
    if (!nombre.trim()) setError('nombre', 'Ingresá tu nombre.');
  }

  // Cambiar el teléfono invalida lo que la API dijo del número anterior.
  function cambiarTelefono(campo: 'caracteristica' | 'numero', valor: string) {
    if (campo === 'caracteristica') setCaracteristica(valor);
    else setNumero(valor);
    setSoloTransferencia(false);
    setBloqueado(false);
    limpiarError('telefono');
  }

  function elegirHora(valor: string) {
    setHora(valor);
    limpiarError('hora');
  }

  function manejarError(error: Error) {
    const code = error instanceof ApiError ? error.code : '';

    if (CODES_FRANJA.includes(code)) {
      setHora(null);
      setError('hora', error.message);
      llevarA(CHECKOUT_IDS.horario);
    } else if (CODES_CATALOGO.includes(code)) {
      abrirDrawer();
      void navigate('/');
    } else if (
      code === 'INVALID_NOMBRE' ||
      code === 'INVALID_TELEFONO' ||
      code === 'INVALID_ACLARACION'
    ) {
      const campo = (
        {
          INVALID_NOMBRE: 'nombre',
          INVALID_TELEFONO: 'telefono',
          INVALID_ACLARACION: 'aclaracion',
        } as const
      )[code];
      setError(campo, error.message);
      llevarA(DESTINO_ERROR[campo]);
    } else if (code === 'TRANSFER_REQUIRED') {
      setMetodoPago('transferencia');
      setSoloTransferencia(true);
      llevarA(CHECKOUT_IDS.pago);
    } else if (code === 'CUSTOMER_BLOCKED') {
      setBloqueado(true);
      // Espera al render del aviso.
      requestAnimationFrame(() => llevarA(CHECKOUT_IDS.bloqueado));
    } else if (CODES_CERRADO.includes(code)) {
      setCerrado(true);
    } else {
      toast('No pudimos enviar tu pedido. Probá de nuevo.');
    }
  }

  function confirmar() {
    if (createOrder.isPending) return;

    const nuevos: ErroresCheckout = {};
    if (!nombre.trim()) nuevos.nombre = 'Ingresá tu nombre.';
    const telefono = normalizarTelefono(caracteristica, numero);
    if (!telefono.ok) nuevos.telefono = MENSAJE_TELEFONO[telefono.error];
    if (!horaElegida) nuevos.hora = 'Elegí un horario de retiro.';
    setErrores(nuevos);

    const primero = (['nombre', 'telefono', 'hora'] as const).find((campo) => nuevos[campo]);
    if (primero) {
      llevarA(DESTINO_ERROR[primero]);
      return;
    }
    if (!telefono.ok || !horaElegida) return;

    guardarCliente({ nombre: nombre.trim(), caracteristica, numero });
    const request: CreateOrderRequest = {
      cliente: { nombre: nombre.trim(), telefono: telefono.telefono },
      items: lineas.map((l) => l.linea),
      aclaracion: aclaracion.trim() || undefined,
      hora: horaElegida,
      metodoPago,
    };
    createOrder.mutate(request, {
      onSuccess: ({ codigo }) => {
        vaciar();
        guardarPedidoActivo(codigo);
        void navigate(`/pedido/${codigo}`, { replace: true });
      },
      onError: manejarError,
    });
  }

  return {
    nombre,
    setNombre: (valor: string) => {
      setNombre(valor);
      limpiarError('nombre');
    },
    blurNombre,
    caracteristica,
    numero,
    cambiarTelefono,
    blurTelefono,
    hora: horaElegida,
    franjaPerdida,
    elegirHora,
    metodoPago,
    setMetodoPago,
    soloTransferencia,
    aclaracion,
    setAclaracion,
    errores,
    bloqueado,
    cerrado,
    enviando: createOrder.isPending,
    confirmar,
  };
}
