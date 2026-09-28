import type { Id, IsoDate } from './common';

// Entidades (admin)

export type Category = {
  _id: Id;
  nombre: string;
  orden: number;
  activa: boolean;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type Product = {
  _id: Id;
  nombre: string;
  descripcion: string;
  categoriaId: Id;
  precio: number;
  fotoUrl: string | null;
  fotoPublicId: string | null;
  disponible: boolean;
  activo: boolean;
  orden: number;
  ingredientesQuitables: string[];
  extrasIds: Id[];
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type Extra = {
  _id: Id;
  nombre: string;
  precio: number;
  disponible: boolean;
  cantidadMax: number;
  activo: boolean;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

// GET /api/catalog

export type CatalogExtra = {
  _id: Id;
  nombre: string;
  precio: number;
  cantidadMax: number;
};

export type CatalogProduct = {
  _id: Id;
  nombre: string;
  descripcion: string;
  precio: number;
  fotoUrl: string | null;
  disponible: boolean;
  ingredientesQuitables: string[];
  extras: CatalogExtra[];
};

export type CatalogCategory = {
  _id: Id;
  nombre: string;
  orden: number;
  products: CatalogProduct[];
};

export type CatalogResponse = {
  categories: CatalogCategory[];
};

// Admin: categorías

export type AdminCategoriesResponse = {
  categories: Category[];
};

export type CreateCategoryRequest = {
  nombre: string;
  orden?: number;
};

export type UpdateCategoryRequest = {
  nombre?: string;
  orden?: number;
  activa?: boolean;
};

// Admin: productos

export type AdminProductsResponse = {
  products: Product[];
};

export type CreateProductRequest = {
  nombre: string;
  descripcion?: string;
  categoriaId: Id;
  precio: number;
  fotoUrl?: string | null;
  fotoPublicId?: string | null;
  orden?: number;
  ingredientesQuitables?: string[];
  extrasIds?: Id[];
};

export type UpdateProductRequest = Partial<CreateProductRequest>;

// Admin: extras

export type AdminExtrasResponse = {
  extras: Extra[];
};

export type CreateExtraRequest = {
  nombre: string;
  precio: number;
  cantidadMax?: number;
};

export type UpdateExtraRequest = Partial<CreateExtraRequest>;

/** PATCH /api/admin/products/:id/disponible y /api/admin/extras/:id/disponible */
export type UpdateDisponibleRequest = {
  disponible: boolean;
};

// Admin: uploads

export type UploadSignatureRequest = {
  folder?: string;
};

export type UploadSignatureResponse = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
};
