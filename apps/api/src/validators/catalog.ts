import type {
  CreateCategoryRequest,
  CreateExtraRequest,
  CreateProductRequest,
  UpdateCategoryRequest,
  UpdateDisponibleRequest,
  UpdateExtraRequest,
  UpdateProductRequest,
  UploadSignatureRequest,
} from '@blackstation/shared';
import { z } from 'zod';
import { AppError } from '../lib/AppError';
import { CARPETAS_UPLOAD, esFotoPropia, type CarpetaUpload } from '../lib/cloudinary';
import {
  cuerpo,
  esBooleano,
  esEntero,
  esObjectId,
  esTextoNoVacio,
  regla,
  textoRequerido,
} from './common';

// §8.2. Mismas reglas y mensajes que la sección Catálogo de los mocks del front
// (`texto`, `orden`, `precio`, `booleano`, `camposProducto`, `camposExtra`).

/** `:id` de la ruta. Mal formado → 404 con el mismo mensaje que uno inexistente. */
export function idParams(message: string) {
  return z.object({
    id: z.string().transform((id) => {
      if (!esObjectId(id)) throw new AppError('NOT_FOUND', message);
      return id;
    }),
  });
}

export const categoryIdParams = idParams('No encontramos esa categoría.');
export const productIdParams = idParams('No encontramos ese producto.');
export const extraIdParams = idParams('No encontramos ese extra.');

// Campos

const nombre = textoRequerido('Falta el nombre.');
const orden = regla(esEntero(0), 'El orden tiene que ser un entero mayor o igual a 0.');
const precio = regla(esEntero(0), 'El precio tiene que ser un entero mayor o igual a 0.');
const booleano = (campo: string) => regla(esBooleano, `\`${campo}\` tiene que ser true o false.`);

const descripcion = regla(
  (valor): valor is string => typeof valor === 'string',
  'La descripción no es válida.',
).transform((s) => s.trim());

// Un id mal formado da el mismo mensaje que uno inexistente; la existencia la valida el service.
const categoriaId = regla(esObjectId, 'La categoría no existe.');

const ingredientesQuitables = regla(
  (valor): valor is string[] => Array.isArray(valor) && valor.every(esTextoNoVacio),
  'Los ingredientes quitables tienen que ser textos no vacíos.',
).transform((lista) => [...new Set(lista.map((i) => i.trim()))]);

const extrasIds = regla(
  (valor): valor is string[] => Array.isArray(valor) && valor.every(esObjectId),
  'Uno de los extras no existe.',
).transform((lista) => [...new Set(lista)]);

const FOTO_INVALIDA = 'Foto inválida.';
const fotoCampo = regla(
  (valor): valor is string | null => valor === null || typeof valor === 'string',
  FOTO_INVALIDA,
);

/** `fotoUrl` y `fotoPublicId` van juntos: los dos `null` o los dos string de nuestra cuenta. */
function fotoValida({
  fotoUrl,
  fotoPublicId,
}: {
  fotoUrl?: string | null;
  fotoPublicId?: string | null;
}) {
  if (fotoUrl === undefined && fotoPublicId === undefined) return true;
  if (fotoUrl === null && fotoPublicId === null) return true;
  if (typeof fotoUrl === 'string' && typeof fotoPublicId === 'string') {
    return esFotoPropia(fotoUrl, fotoPublicId);
  }
  return false;
}

// Categorías

export const createCategoryBodySchema = cuerpo(z.object({ nombre, orden: orden.optional() }), [
  ['nombre', 'Falta el nombre.'],
]) satisfies z.ZodType<CreateCategoryRequest>;

export const updateCategoryBodySchema = cuerpo(
  z.object({
    nombre: nombre.optional(),
    orden: orden.optional(),
    activa: booleano('activa').optional(),
  }),
) satisfies z.ZodType<UpdateCategoryRequest>;

// Productos

const camposProducto = {
  nombre: nombre.optional(),
  descripcion: descripcion.optional(),
  categoriaId: categoriaId.optional(),
  precio: precio.optional(),
  fotoUrl: fotoCampo.optional(),
  fotoPublicId: fotoCampo.optional(),
  orden: orden.optional(),
  ingredientesQuitables: ingredientesQuitables.optional(),
  extrasIds: extrasIds.optional(),
};

export const createProductBodySchema = cuerpo(
  z
    .object({ ...camposProducto, nombre, categoriaId, precio })
    .refine(fotoValida, { error: FOTO_INVALIDA }),
  [
    ['nombre', 'Falta el nombre.'],
    ['categoriaId', 'Falta la categoría.'],
    ['precio', 'Falta el precio.'],
  ],
) satisfies z.ZodType<CreateProductRequest>;

export const updateProductBodySchema = cuerpo(
  z
    .object({ ...camposProducto, activo: booleano('activo').optional() })
    .refine(fotoValida, { error: FOTO_INVALIDA }),
) satisfies z.ZodType<UpdateProductRequest>;

// Extras

const camposExtra = {
  nombre: nombre.optional(),
  precio: precio.optional(),
  cantidadMax: regla(esEntero(1), 'La cantidad máxima tiene que ser 1 o más.').optional(),
};

export const createExtraBodySchema = cuerpo(z.object({ ...camposExtra, nombre, precio }), [
  ['nombre', 'Falta el nombre.'],
  ['precio', 'Falta el precio.'],
]) satisfies z.ZodType<CreateExtraRequest>;

export const updateExtraBodySchema = cuerpo(
  z.object({ ...camposExtra, activo: booleano('activo').optional() }),
) satisfies z.ZodType<UpdateExtraRequest>;

// Disponible (productos y extras)

export const disponibleBodySchema = cuerpo(
  z.object({ disponible: booleano('disponible') }),
) satisfies z.ZodType<UpdateDisponibleRequest>;

// Firma de subida

const esCarpeta = (valor: unknown): valor is CarpetaUpload =>
  typeof valor === 'string' && (CARPETAS_UPLOAD as readonly string[]).includes(valor);

export const uploadSignatureBodySchema = cuerpo(
  z.object({ folder: regla(esCarpeta, 'Carpeta inválida.').default('products') }),
) satisfies z.ZodType<UploadSignatureRequest>;

export type CreateCategoryInput = z.output<typeof createCategoryBodySchema>;
export type UpdateCategoryInput = z.output<typeof updateCategoryBodySchema>;
export type CreateProductInput = z.output<typeof createProductBodySchema>;
export type UpdateProductInput = z.output<typeof updateProductBodySchema>;
export type CreateExtraInput = z.output<typeof createExtraBodySchema>;
export type UpdateExtraInput = z.output<typeof updateExtraBodySchema>;
