import { model, Schema, type InferSchemaType } from 'mongoose';

// §3.9. `_id` = `orders:<fecha>`; `seq` = último `numero` asignado en esa jornada.
const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true },
  },
  { collection: 'counters', versionKey: false },
);

export type CounterDoc = InferSchemaType<typeof counterSchema>;
export const CounterModel = model('Counter', counterSchema);
