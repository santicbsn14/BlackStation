import type { LoginRequest } from '@blackstation/shared';
import { z } from 'zod';
import { regla } from './common';

const noVacio = (valor: unknown): valor is string => typeof valor === 'string' && valor !== '';

// §7: `usuario` y `password` strings no vacíos. Sin body (`undefined`) cuenta como vacío.
export const loginBodySchema = z.preprocess(
  (body) => body ?? {},
  z.object({
    usuario: regla(noVacio, 'Falta el usuario.'),
    password: regla(noVacio, 'Falta la contraseña.'),
  }),
) satisfies z.ZodType<LoginRequest>;
