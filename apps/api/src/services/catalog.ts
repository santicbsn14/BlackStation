import type {
  AdminCategoriesResponse,
  AdminExtrasResponse,
  AdminProductsResponse,
  CatalogResponse,
  Category,
  Extra,
  OkResponse,
  Product,
} from '@blackstation/shared';
import { AppError } from '../lib/AppError';
import { destroyImage } from '../lib/cloudinary';
import { now } from '../lib/clock';
import {
  toCatalog,
  toCategory,
  toExtra,
  toProduct,
  type CategoryLean,
  type ExtraLean,
  type ProductLean,
} from '../mappers/catalog';
import { CategoryModel, ExtraModel, ProductModel } from '../models';
import type {
  CreateCategoryInput,
  CreateExtraInput,
  CreateProductInput,
  UpdateCategoryInput,
  UpdateExtraInput,
  UpdateProductInput,
} from '../validators/catalog';

// §6 y §8.2. Los `:id` llegan con formato válido (lo chequea el validator).

const NO_CATEGORIA = 'No encontramos esa categoría.';
const NO_PRODUCTO = 'No encontramos ese producto.';
const NO_EXTRA = 'No encontramos ese extra.';

const POR_ORDEN = { orden: 1, _id: 1 } as const;
const POR_CREACION = { createdAt: 1, _id: 1 } as const;

/** `createdAt`/`updatedAt` de `now()` (los timestamps de Mongoose usan `new Date()`). */
function fechasDeCreacion() {
  const ahora = now();
  return { createdAt: ahora, updatedAt: ahora };
}

/** Guarda un documento nuevo sin los timestamps automáticos y lo devuelve plano. */
async function guardar<T>(doc: {
  save(options: { timestamps: false }): Promise<unknown>;
  toObject(): unknown;
}): Promise<T> {
  await doc.save({ timestamps: false });
  return doc.toObject() as T;
}

/** `$set` de los campos recibidos + `updatedAt` de `now()`. */
const setConFecha = (campos: object) => ({ $set: { ...campos, updatedAt: now() } });

const OPCIONES_UPDATE = {
  returnDocument: 'after',
  timestamps: false,
  runValidators: true,
} as const;

function encontrado<T>(doc: T | null, message: string): T {
  if (!doc) throw new AppError('NOT_FOUND', message);
  return doc;
}

// Público

export async function getCatalog(): Promise<CatalogResponse> {
  const categories = await CategoryModel.find({ activa: true })
    .sort(POR_ORDEN)
    .lean<CategoryLean[]>();
  const [products, extras] = await Promise.all([
    ProductModel.find({ activo: true, categoriaId: { $in: categories.map((c) => c._id) } })
      .sort(POR_ORDEN)
      .lean<ProductLean[]>(),
    ExtraModel.find({ activo: true, disponible: true }).lean<ExtraLean[]>(),
  ]);
  return toCatalog(categories, products, extras);
}

// Categorías

export async function listCategories(): Promise<AdminCategoriesResponse> {
  const docs = await CategoryModel.find().sort(POR_ORDEN).lean<CategoryLean[]>();
  return { categories: docs.map(toCategory) };
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  return toCategory(
    await guardar<CategoryLean>(new CategoryModel({ ...input, ...fechasDeCreacion() })),
  );
}

export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
  const doc = await CategoryModel.findByIdAndUpdate(
    id,
    setConFecha(input),
    OPCIONES_UPDATE,
  ).lean<CategoryLean>();
  return toCategory(encontrado(doc, NO_CATEGORIA));
}

export async function softDeleteCategory(id: string): Promise<OkResponse> {
  const res = await CategoryModel.updateOne({ _id: id }, setConFecha({ activa: false }), {
    timestamps: false,
  });
  if (res.matchedCount === 0) throw new AppError('NOT_FOUND', NO_CATEGORIA);
  return { ok: true };
}

// Productos

/** `categoriaId` y `extrasIds` tienen que existir (activos o no). */
async function validarReferencias(input: UpdateProductInput): Promise<void> {
  if (
    input.categoriaId !== undefined &&
    !(await CategoryModel.exists({ _id: input.categoriaId }))
  ) {
    throw new AppError('VALIDATION_ERROR', 'La categoría no existe.');
  }
  if (input.extrasIds !== undefined && input.extrasIds.length > 0) {
    const existentes = await ExtraModel.countDocuments({ _id: { $in: input.extrasIds } });
    if (existentes !== input.extrasIds.length) {
      throw new AppError('VALIDATION_ERROR', 'Uno de los extras no existe.');
    }
  }
}

/** Borra la foto anterior sin demorar la respuesta. Si falla, solo queda en el log. */
function borrarFotoEnSegundoPlano(publicId: string): void {
  destroyImage(publicId).then(
    (result) => {
      if (result !== 'ok') console.warn(`Cloudinary destroy de "${publicId}": ${result}.`);
    },
    (err: unknown) => {
      console.error(`No se pudo borrar la foto "${publicId}" de Cloudinary.`, err);
    },
  );
}

export async function listProducts(): Promise<AdminProductsResponse> {
  const docs = await ProductModel.find().sort(POR_ORDEN).lean<ProductLean[]>();
  return { products: docs.map(toProduct) };
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  await validarReferencias(input);
  return toProduct(
    await guardar<ProductLean>(new ProductModel({ ...input, ...fechasDeCreacion() })),
  );
}

/**
 * Si el `PUT` cambia `fotoPublicId` (a otro valor o a `null`), después de guardar se borra la
 * anterior en Cloudinary, en segundo plano.
 */
export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  const anterior = encontrado(
    await ProductModel.findById(id, { fotoPublicId: 1 }).lean<Pick<ProductLean, 'fotoPublicId'>>(),
    NO_PRODUCTO,
  );
  await validarReferencias(input);
  const doc = await ProductModel.findByIdAndUpdate(
    id,
    setConFecha(input),
    OPCIONES_UPDATE,
  ).lean<ProductLean>();
  const product = toProduct(encontrado(doc, NO_PRODUCTO));

  const fotoVieja = anterior.fotoPublicId ?? null;
  if (fotoVieja !== null && input.fotoPublicId !== undefined && input.fotoPublicId !== fotoVieja) {
    borrarFotoEnSegundoPlano(fotoVieja);
  }
  return product;
}

/** Soft: no borra la foto, porque el producto se puede reactivar. */
export async function softDeleteProduct(id: string): Promise<OkResponse> {
  const res = await ProductModel.updateOne({ _id: id }, setConFecha({ activo: false }), {
    timestamps: false,
  });
  if (res.matchedCount === 0) throw new AppError('NOT_FOUND', NO_PRODUCTO);
  return { ok: true };
}

export async function setProductDisponible(id: string, disponible: boolean): Promise<Product> {
  const doc = await ProductModel.findByIdAndUpdate(
    id,
    setConFecha({ disponible }),
    OPCIONES_UPDATE,
  ).lean<ProductLean>();
  return toProduct(encontrado(doc, NO_PRODUCTO));
}

// Extras

export async function listExtras(): Promise<AdminExtrasResponse> {
  const docs = await ExtraModel.find().sort(POR_CREACION).lean<ExtraLean[]>();
  return { extras: docs.map(toExtra) };
}

export async function createExtra(input: CreateExtraInput): Promise<Extra> {
  return toExtra(await guardar<ExtraLean>(new ExtraModel({ ...input, ...fechasDeCreacion() })));
}

export async function updateExtra(id: string, input: UpdateExtraInput): Promise<Extra> {
  const doc = await ExtraModel.findByIdAndUpdate(
    id,
    setConFecha(input),
    OPCIONES_UPDATE,
  ).lean<ExtraLean>();
  return toExtra(encontrado(doc, NO_EXTRA));
}

export async function softDeleteExtra(id: string): Promise<OkResponse> {
  const res = await ExtraModel.updateOne({ _id: id }, setConFecha({ activo: false }), {
    timestamps: false,
  });
  if (res.matchedCount === 0) throw new AppError('NOT_FOUND', NO_EXTRA);
  return { ok: true };
}

export async function setExtraDisponible(id: string, disponible: boolean): Promise<Extra> {
  const doc = await ExtraModel.findByIdAndUpdate(
    id,
    setConFecha({ disponible }),
    OPCIONES_UPDATE,
  ).lean<ExtraLean>();
  return toExtra(encontrado(doc, NO_EXTRA));
}
