import type { LoginResponse, Rol } from '@blackstation/shared';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Types } from 'mongoose';
import { getEnv } from '../config/env';
import { AppError } from '../lib/AppError';
import { now } from '../lib/clock';
import { UserModel } from '../models';

/** §7: el token vence a las 12 h. */
const TOKEN_TTL_S = 12 * 60 * 60;

/**
 * Hash bcrypt (costo 10, igual que el seed) de una contraseña aleatoria descartada. Si el usuario no
 * existe o está inactivo se compara igual contra este, para que la demora sea la misma.
 */
const HASH_FIJO = '$2b$10$0Y9dNuPK8o/BKBx2QJzMsOyQ8pB2gIWffgQCRZ.4C7kE48fyOV33S';

type UserLean = { _id: Types.ObjectId; nombre: string; rol: Rol; passwordHash: string };

export async function login(usuario: string, password: string): Promise<LoginResponse> {
  const user = await UserModel.findOne({ usuario, activo: true })
    .select('nombre rol passwordHash')
    .lean<UserLean>();

  const ok = await bcrypt.compare(password, user?.passwordHash ?? HASH_FIJO);
  if (!user || !ok) {
    throw new AppError('INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
  }

  // `iat` explícito sale de `now()`: `exp` = `iat` + 12 h y los tests controlan el reloj.
  const iat = Math.floor(now().getTime() / 1000);
  const token = jwt.sign({ sub: user._id.toString(), rol: user.rol, iat }, getEnv().JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: TOKEN_TTL_S,
  });

  return {
    token,
    expiresAt: new Date((iat + TOKEN_TTL_S) * 1000).toISOString(),
    user: { _id: user._id.toString(), nombre: user.nombre, rol: user.rol },
  };
}
