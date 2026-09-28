/** Reemplaza cada `{variable}` de la plantilla. Las variables sin valor quedan vacías. */
export function renderPlantilla(
  plantilla: string,
  variables: Record<string, string | number>,
): string {
  return plantilla.replace(/\{(\w+)\}/g, (_, nombre: string) => String(variables[nombre] ?? ''));
}

const PLANTILLA_COMPROBANTE =
  'Hola! Te mando el comprobante del pedido #{numero} a nombre de {nombre} ({total}).';

/** Texto del botón "Enviar comprobante". `total` ya formateado es-AR. */
export function mensajeComprobante(datos: { numero: number; nombre: string; total: string }) {
  return renderPlantilla(PLANTILLA_COMPROBANTE, datos);
}
