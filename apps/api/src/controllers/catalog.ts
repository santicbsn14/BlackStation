import type { RequestHandler } from 'express';
import { validate } from '../middlewares/validate';
import {
  createCategory,
  createExtra,
  createProduct,
  getCatalog,
  listCategories,
  listExtras,
  listProducts,
  setExtraDisponible,
  setProductDisponible,
  softDeleteCategory,
  softDeleteExtra,
  softDeleteProduct,
  updateCategory,
  updateExtra,
  updateProduct,
} from '../services/catalog';
import {
  categoryIdParams,
  createCategoryBodySchema,
  createExtraBodySchema,
  createProductBodySchema,
  disponibleBodySchema,
  extraIdParams,
  productIdParams,
  updateCategoryBodySchema,
  updateExtraBodySchema,
  updateProductBodySchema,
} from '../validators/catalog';

/** `GET /api/catalog` */
export const getCatalogController: RequestHandler = async (_req, res) => {
  res.json(await getCatalog());
};

// `/api/admin/categories`

export const listCategoriesController: RequestHandler = async (_req, res) => {
  res.json(await listCategories());
};

export const createCategoryController = validate(
  { body: createCategoryBodySchema },
  async ({ body }, _req, res) => {
    res.status(201).json(await createCategory(body));
  },
);

export const updateCategoryController = validate(
  { params: categoryIdParams, body: updateCategoryBodySchema },
  async ({ params, body }, _req, res) => {
    res.json(await updateCategory(params.id, body));
  },
);

export const deleteCategoryController = validate(
  { params: categoryIdParams },
  async ({ params }, _req, res) => {
    res.json(await softDeleteCategory(params.id));
  },
);

// `/api/admin/products`

export const listProductsController: RequestHandler = async (_req, res) => {
  res.json(await listProducts());
};

export const createProductController = validate(
  { body: createProductBodySchema },
  async ({ body }, _req, res) => {
    res.status(201).json(await createProduct(body));
  },
);

export const updateProductController = validate(
  { params: productIdParams, body: updateProductBodySchema },
  async ({ params, body }, _req, res) => {
    res.json(await updateProduct(params.id, body));
  },
);

export const deleteProductController = validate(
  { params: productIdParams },
  async ({ params }, _req, res) => {
    res.json(await softDeleteProduct(params.id));
  },
);

export const productDisponibleController = validate(
  { params: productIdParams, body: disponibleBodySchema },
  async ({ params, body }, _req, res) => {
    res.json(await setProductDisponible(params.id, body.disponible));
  },
);

// `/api/admin/extras`

export const listExtrasController: RequestHandler = async (_req, res) => {
  res.json(await listExtras());
};

export const createExtraController = validate(
  { body: createExtraBodySchema },
  async ({ body }, _req, res) => {
    res.status(201).json(await createExtra(body));
  },
);

export const updateExtraController = validate(
  { params: extraIdParams, body: updateExtraBodySchema },
  async ({ params, body }, _req, res) => {
    res.json(await updateExtra(params.id, body));
  },
);

export const deleteExtraController = validate(
  { params: extraIdParams },
  async ({ params }, _req, res) => {
    res.json(await softDeleteExtra(params.id));
  },
);

export const extraDisponibleController = validate(
  { params: extraIdParams, body: disponibleBodySchema },
  async ({ params, body }, _req, res) => {
    res.json(await setExtraDisponible(params.id, body.disponible));
  },
);
