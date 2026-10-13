import { ROLES } from '@blackstation/shared';
import { model, Schema, type InferSchemaType } from 'mongoose';

// §3.8. `passwordHash` nunca se expone en la API.
const userSchema = new Schema(
  {
    nombre: { type: String, required: true },
    usuario: { type: String, required: true },
    passwordHash: { type: String, required: true },
    rol: { type: String, enum: [...ROLES], required: true, default: 'admin' },
    activo: { type: Boolean, required: true, default: true },
  },
  { collection: 'users', timestamps: true, versionKey: false },
);

userSchema.index({ usuario: 1 }, { unique: true });

export type UserDoc = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
