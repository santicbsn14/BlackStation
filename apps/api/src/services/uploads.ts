import type { UploadSignatureResponse } from '@blackstation/shared';
import { getEnv } from '../config/env';
import {
  carpetaFinal,
  firmarParams,
  timestampCloudinary,
  type CarpetaUpload,
} from '../lib/cloudinary';

/**
 * §8.2: firma para que el front suba directo a Cloudinary. Se firman `folder` y `timestamp`; el
 * secret nunca sale de la API.
 */
export function getUploadSignature(carpeta: CarpetaUpload): UploadSignatureResponse {
  const { CLOUDINARY_API_KEY, CLOUDINARY_CLOUD_NAME } = getEnv();
  const folder = carpetaFinal(carpeta);
  const timestamp = timestampCloudinary();
  return {
    signature: firmarParams({ folder, timestamp }),
    timestamp,
    apiKey: CLOUDINARY_API_KEY,
    cloudName: CLOUDINARY_CLOUD_NAME,
    folder,
  };
}
