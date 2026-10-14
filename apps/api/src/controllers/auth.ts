import type { LoginResponse } from '@blackstation/shared';
import { AppError } from '../lib/AppError';
import { loginLimiter } from '../lib/loginLimiter';
import { validate } from '../middlewares/validate';
import { login } from '../services/auth';
import { loginBodySchema } from '../validators/auth';

/** `POST /api/auth/login`, con el límite de intentos por IP de §7. */
export const postLogin = validate({ body: loginBodySchema }, async ({ body }, req, res) => {
  const ip = req.ip ?? '';

  const retryAfter = loginLimiter.check(ip);
  if (retryAfter !== null) {
    res.set('Retry-After', String(retryAfter));
    throw new AppError(
      'TOO_MANY_ATTEMPTS',
      'Demasiados intentos fallidos. Probá de nuevo en unos minutos.',
    );
  }

  let response: LoginResponse;
  try {
    response = await login(body.usuario, body.password);
  } catch (err) {
    if (err instanceof AppError && err.code === 'INVALID_CREDENTIALS') {
      loginLimiter.registrarFallo(ip);
    }
    throw err;
  }

  loginLimiter.reset(ip);
  res.json(response);
});
