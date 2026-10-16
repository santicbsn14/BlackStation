import { createHash } from 'node:crypto';
import { getEnv } from '../config/env';
import { now } from './clock';

// Cloudinary sin SDK (§8.2): firma de params y `image/destroy` con `fetch` nativo.

/** Carpetas que acepta la firma de subida. Todas cuelgan de `blackstation/`. */
export const CARPETAS_UPLOAD = ['products'] as const;
export type CarpetaUpload = (typeof CARPETAS_UPLOAD)[number];

export const carpetaFinal = (carpeta: CarpetaUpload): string => `blackstation/${carpeta}`;

/** Segundos Unix de `now()`, como los pide Cloudinary. */
export const timestampCloudinary = (): number => Math.floor(now().getTime() / 1000);

/**
 * Firma de Cloudinary: params ordenados alfabéticamente, `k=v` unidos con `&`, concatenado con el
 * api secret, sha1 en hex.
 */
export function firmarParams(
  params: Record<string, string | number>,
  secret = getEnv().CLOUDINARY_API_SECRET,
): string {
  const base = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1')
    .update(base + secret)
    .digest('hex');
}

/**
 * Foto de un producto: `publicId` en `blackstation/products/` y URL de nuestra cuenta. Evita que un
 * producto apunte a otra cuenta o haga borrar fotos ajenas.
 */
export function esFotoPropia(fotoUrl: string, fotoPublicId: string): boolean {
  return (
    fotoPublicId.startsWith(`${carpetaFinal('products')}/`) &&
    fotoUrl.startsWith(`https://res.cloudinary.com/${getEnv().CLOUDINARY_CLOUD_NAME}/`)
  );
}

/**
 * Borra una imagen (`POST image/destroy`). Tira si Cloudinary no responde 2xx. Devuelve el
 * `result` de Cloudinary (`ok`, `not found`).
 */
export async function destroyImage(publicId: string): Promise<string> {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY } = getEnv();
  const timestamp = timestampCloudinary();
  const form = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: CLOUDINARY_API_KEY,
    signature: firmarParams({ public_id: publicId, timestamp }),
  });

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
    { method: 'POST', body: form },
  );
  if (!res.ok) {
    throw new Error(`Cloudinary destroy de "${publicId}" respondió ${res.status}.`);
  }
  const data: unknown = await res.json().catch(() => null);
  return typeof data === 'object' && data !== null && 'result' in data
    ? String(data.result)
    : 'desconocido';
}
