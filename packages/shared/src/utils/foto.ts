/** URL de Cloudinary hasta `/upload/` inclusive (sin query ni fragmento antes). */
const CLOUDINARY_UPLOAD = /^https:\/\/res\.cloudinary\.com\/[^?#]*?\/upload\//;

/**
 * URL optimizada de una foto de Cloudinary (MODELO_DATOS §8.2): formato y calidad automáticos y
 * ancho máximo `ancho`. Cualquier otra URL (por ejemplo, las data URL de los mocks) vuelve igual.
 */
export function fotoCloudinary(url: string, ancho: number): string {
  const base = CLOUDINARY_UPLOAD.exec(url)?.[0];
  if (!base) return url;
  return `${base}f_auto,q_auto,w_${ancho},c_limit/${url.slice(base.length)}`;
}
