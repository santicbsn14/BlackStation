import type { Request } from 'express';

/**
 * Diagnóstico de `TRUST_PROXY`: deja en el log `req.ip` y el `X-Forwarded-For` crudo, para comparar
 * en Render con la IP real del cliente. Nunca loguea datos del body (usuario, password, teléfono).
 */
export function logIp(evento: string, req: Request): void {
  const xff = req.get('X-Forwarded-For') ?? '(sin header)';
  console.warn(`[ip] ${evento}: req.ip=${req.ip ?? '(sin ip)'} x-forwarded-for=${xff}`);
}
