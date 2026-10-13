import { model, Schema, type InferSchemaType } from 'mongoose';

// §3.7. Documento único, creado por seed (que trae `horarios` y `mensajes` por defecto).
const horarioSchema = new Schema(
  {
    dia: { type: Number, required: true, min: 0, max: 6 },
    activo: { type: Boolean, required: true },
    abre: { type: String, required: true },
    cierra: { type: String, required: true },
  },
  { _id: false },
);

const mensajesSchema = new Schema(
  {
    confirmacion: { type: String, required: true },
    pedirTransferencia: { type: String, required: true },
    recordatorio: { type: String, required: true },
  },
  { _id: false },
);

const settingsSchema = new Schema(
  {
    horarios: { type: [horarioSchema], required: true },
    intervaloMin: { type: Number, required: true, default: 15 },
    cupoMaxDefault: { type: Number, required: true, default: 6 },
    anticipacionMinMin: { type: Number, required: true, default: 30 },
    pedidosHabilitados: { type: Boolean, required: true, default: true },
    minutosTransferencia: { type: Number, required: true, default: 15 },
    alias: { type: String, required: true },
    cbu: { type: String, required: true },
    titular: { type: String, required: true },
    telefonoLocal: { type: String, required: true },
    mensajes: { type: mensajesSchema, required: true },
    // Sin forma hasta la Etapa 06.
    reputacion: { type: Schema.Types.Mixed, required: false },
  },
  {
    collection: 'settings',
    timestamps: { createdAt: false, updatedAt: true },
    versionKey: false,
  },
);

// `Mixed` se infiere como `any`: se reemplaza por el tipo de shared.
export type SettingsDoc = Omit<InferSchemaType<typeof settingsSchema>, 'reputacion'> & {
  reputacion?: Record<string, unknown>;
};
export const SettingsModel = model('Settings', settingsSchema);
