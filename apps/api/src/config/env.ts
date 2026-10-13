import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().positive().default(3000),
    MONGODB_URI: z.string().min(1, 'no puede estar vacía'),
    JWT_SECRET: z.string().min(32, 'mínimo 32 caracteres'),
    PRINT_KEY: z.string().min(32, 'mínimo 32 caracteres'),
    CORS_ORIGINS: z
      .string()
      .transform((s) =>
        s
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string()).min(1, 'al menos un origen')),
    CLOUDINARY_CLOUD_NAME: z.string().min(1, 'no puede estar vacía'),
    CLOUDINARY_API_KEY: z.string().min(1, 'no puede estar vacía'),
    CLOUDINARY_API_SECRET: z.string().min(1, 'no puede estar vacía'),
    FORCE_OPEN: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.FORCE_OPEN) {
      ctx.addIssue({
        code: 'custom',
        path: ['FORCE_OPEN'],
        message: 'no se permite con NODE_ENV=production',
      });
    }
  });

export type Env = z.output<typeof envSchema>;

type RawEnv = Record<string, string | undefined>;

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

/** Una línea por variable con problemas. También la usa el seed para sus variables. */
export function formatEnvIssues(error: z.ZodError, source: RawEnv): string {
  return error.issues
    .map((issue) => {
      const key = String(issue.path[0] ?? '');
      return `  - ${key}: ${source[key] === undefined ? 'falta' : issue.message}`;
    })
    .join('\n');
}

/** Valida un `process.env`. Tira `EnvError` con todas las variables con problemas. */
export function parseEnv(source: RawEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvError(`Variables de entorno inválidas:\n${formatEnvIssues(result.error, source)}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Env validado de `process.env` (se valida una sola vez). */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
