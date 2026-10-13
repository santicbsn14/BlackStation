import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';

type Schemas = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

export type Validated<S extends Schemas> = {
  [K in keyof S]: S[K] extends z.ZodType ? z.output<S[K]> : never;
};

/**
 * Valida body/query/params con zod y llama al handler con el resultado tipado. Un dato inválido
 * tira `ZodError`, que el `errorHandler` responde como 400 `VALIDATION_ERROR`.
 *
 *   router.post('/x', validate({ body: schema }, async ({ body }, _req, res) => { … }));
 */
export function validate<S extends Schemas>(
  schemas: S,
  handler: (input: Validated<S>, req: Request, res: Response) => unknown,
): RequestHandler {
  return async (req, res) => {
    const input: Record<string, unknown> = {};
    if (schemas.body) input.body = schemas.body.parse(req.body);
    if (schemas.query) input.query = schemas.query.parse(req.query);
    if (schemas.params) input.params = schemas.params.parse(req.params);
    await handler(input as Validated<S>, req, res);
  };
}
