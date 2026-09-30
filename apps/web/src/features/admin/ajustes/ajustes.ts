import {
  normalizarTelefono,
  type Horario,
  type MensajesSettings,
  type Settings,
  type UpdateSettingsRequest,
} from '@blackstation/shared';

export const INTERVALOS = [10, 15, 20, 30] as const;

/** Lunes primero, como se lee una semana; `dia` sigue el enum (0 = domingo). */
export const DIAS_SEMANA = [
  { dia: 1, nombre: 'Lunes' },
  { dia: 2, nombre: 'Martes' },
  { dia: 3, nombre: 'Miércoles' },
  { dia: 4, nombre: 'Jueves' },
  { dia: 5, nombre: 'Viernes' },
  { dia: 6, nombre: 'Sábado' },
  { dia: 0, nombre: 'Domingo' },
] as const;

export const PLANTILLAS = [
  { clave: 'pedirTransferencia', titulo: 'Pedir transferencia' },
  { clave: 'confirmacion', titulo: 'Confirmación' },
  { clave: 'recordatorio', titulo: 'Recordatorio' },
] as const satisfies readonly { clave: keyof MensajesSettings; titulo: string }[];

/** Variables de plantilla (MODELO_DATOS §3.7), con el valor del pedido de ejemplo de la preview. */
export const VARIABLES = [
  'nombre',
  'numero',
  'hora',
  'total',
  'alias',
  'minutos',
  'vence',
] as const;

/** Lo que edita el formulario: los números como texto (se validan al guardar). */
export type AjustesForm = {
  pedidosHabilitados: boolean;
  horarios: Horario[];
  intervaloMin: number;
  cupoMaxDefault: string;
  anticipacionMinMin: string;
  minutosTransferencia: string;
  alias: string;
  cbu: string;
  titular: string;
  caracteristica: string;
  numero: string;
  mensajes: MensajesSettings;
  reputacion: Settings['reputacion'];
};

export type CampoError =
  | 'cupoMaxDefault'
  | 'anticipacionMinMin'
  | 'minutosTransferencia'
  | 'alias'
  | 'cbu'
  | 'titular'
  | 'telefono'
  | `horario-${number}`
  | `mensaje-${keyof MensajesSettings}`;

export type Errores = Partial<Record<CampoError, string>>;

/** Largo de la característica que se muestra al separar `telefonoLocal` (la del local: 336). */
const LARGO_CARACTERISTICA = 3;

export function aFormulario(settings: Settings): AjustesForm {
  const nacional = settings.telefonoLocal.replace(/^549/, '');
  return {
    pedidosHabilitados: settings.pedidosHabilitados,
    horarios: [...settings.horarios].sort((a, b) => a.dia - b.dia),
    intervaloMin: settings.intervaloMin,
    cupoMaxDefault: String(settings.cupoMaxDefault),
    anticipacionMinMin: String(settings.anticipacionMinMin),
    minutosTransferencia: String(settings.minutosTransferencia),
    alias: settings.alias,
    cbu: settings.cbu,
    titular: settings.titular,
    caracteristica: nacional.slice(0, LARGO_CARACTERISTICA),
    numero: nacional.slice(LARGO_CARACTERISTICA),
    mensajes: { ...settings.mensajes },
    reputacion: settings.reputacion,
  };
}

function entero(texto: string, min: number): number | null {
  if (!/^\d+$/.test(texto.trim())) return null;
  const n = Number(texto.trim());
  return Number.isSafeInteger(n) && n >= min ? n : null;
}

/** Valida el formulario. Sin errores, devuelve el `PUT /admin/settings` completo (§8.4). */
export function validar(
  form: AjustesForm,
): { ok: true; request: UpdateSettingsRequest } | { ok: false; errores: Errores } {
  const errores: Errores = {};

  for (const h of form.horarios) {
    if (h.activo && h.abre === h.cierra) {
      errores[`horario-${h.dia}`] = 'La apertura y el cierre no pueden ser la misma hora.';
    }
    if (!h.abre || !h.cierra) errores[`horario-${h.dia}`] = 'Completá las dos horas.';
  }

  const cupo = entero(form.cupoMaxDefault, 1);
  if (cupo === null) errores.cupoMaxDefault = 'Tiene que ser 1 o más.';
  const anticipacion = entero(form.anticipacionMinMin, 0);
  if (anticipacion === null) errores.anticipacionMinMin = 'Tiene que ser 0 o más minutos.';
  const minutos = entero(form.minutosTransferencia, 1);
  if (minutos === null) errores.minutosTransferencia = 'Tiene que ser 1 o más minutos.';

  if (!form.alias.trim()) errores.alias = 'Falta el alias.';
  if (!form.cbu.trim()) errores.cbu = 'Falta el CBU.';
  if (!form.titular.trim()) errores.titular = 'Falta el titular.';

  const telefono = normalizarTelefono(form.caracteristica, form.numero);
  if (!telefono.ok) {
    errores.telefono =
      telefono.error === 'caracteristica_invalida'
        ? 'La característica no es válida (ej.: 336).'
        : 'Revisá el número: característica y número suman 10 dígitos.';
  }

  for (const { clave } of PLANTILLAS) {
    if (!form.mensajes[clave].trim())
      errores[`mensaje-${clave}`] = 'El mensaje no puede quedar vacío.';
  }

  if (
    Object.keys(errores).length > 0 ||
    cupo === null ||
    anticipacion === null ||
    minutos === null ||
    !telefono.ok
  ) {
    return { ok: false, errores };
  }

  return {
    ok: true,
    request: {
      horarios: form.horarios,
      intervaloMin: form.intervaloMin,
      cupoMaxDefault: cupo,
      anticipacionMinMin: anticipacion,
      pedidosHabilitados: form.pedidosHabilitados,
      minutosTransferencia: minutos,
      alias: form.alias.trim(),
      cbu: form.cbu.trim(),
      titular: form.titular.trim(),
      telefonoLocal: telefono.telefono,
      mensajes: {
        confirmacion: form.mensajes.confirmacion.trim(),
        pedirTransferencia: form.mensajes.pedirTransferencia.trim(),
        recordatorio: form.mensajes.recordatorio.trim(),
      },
      ...(form.reputacion ? { reputacion: form.reputacion } : {}),
    },
  };
}

/** Cambios que mueven las franjas de hoy: horarios o intervalo. */
export function cambiaFranjas(antes: AjustesForm, despues: AjustesForm): boolean {
  return (
    antes.intervaloMin !== despues.intervaloMin ||
    JSON.stringify(antes.horarios) !== JSON.stringify(despues.horarios)
  );
}

/** `true` si `cierra < abre`: la jornada termina al día siguiente. */
export const cruzaMedianoche = (h: Horario) => h.cierra < h.abre;
