import type { Rol } from '../enums';
import type { Id, IsoDate } from './common';

export type LoginRequest = {
  usuario: string;
  password: string;
};

export type AuthUser = {
  _id: Id;
  nombre: string;
  rol: Rol;
};

export type LoginResponse = {
  token: string;
  expiresAt: IsoDate;
  user: AuthUser;
};
