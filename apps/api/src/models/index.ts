import { CategoryModel } from './Category';
import { CounterModel } from './Counter';
import { CustomerModel } from './Customer';
import { ExtraModel } from './Extra';
import { OrderModel } from './Order';
import { PickupSlotModel } from './PickupSlot';
import { ProductModel } from './Product';
import { SettingsModel } from './Settings';
import { UserModel } from './User';

export * from './Category';
export * from './Counter';
export * from './Customer';
export * from './Extra';
export * from './Order';
export * from './PickupSlot';
export * from './Product';
export * from './Settings';
export * from './User';

/** Todos los modelos (el seed les corre `syncIndexes()`). */
export const ALL_MODELS = [
  CategoryModel,
  ProductModel,
  ExtraModel,
  OrderModel,
  PickupSlotModel,
  CustomerModel,
  SettingsModel,
  UserModel,
  CounterModel,
] as const;
