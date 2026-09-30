import type {
  CreateCategoryRequest,
  CreateExtraRequest,
  CreateProductRequest,
  UpdateCategoryRequest,
  UpdateExtraRequest,
  UpdateProductRequest,
} from '@blackstation/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createCategory,
  createExtra,
  createProduct,
  deleteCategory,
  deleteExtra,
  deleteProduct,
  updateCategory,
  updateExtra,
  updateExtraDisponible,
  updateProduct,
  updateProductDisponible,
  uploadProductPhoto,
} from '../../../../services';
import { catalogKeys } from '../../../../services/queryKeys';
import { useToastError } from '../../hooks/useToastError';

/**
 * Mutación del catálogo: invalida todo `catalogKeys` (también el catálogo público) y muestra un
 * toast si falla. Con `inline`, los 400 los muestra el formulario.
 */
function useCatalogoMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  { inline = false }: { inline?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const onError = useToastError({ inline });
  return useMutation({
    mutationFn,
    onError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
  });
}

type Editar<T> = { id: string; request: T };

export function useCategoryMutations() {
  return {
    crear: useCatalogoMutation((r: CreateCategoryRequest) => createCategory(r), { inline: true }),
    editar: useCatalogoMutation(
      ({ id, request }: Editar<UpdateCategoryRequest>) => updateCategory(id, request),
      { inline: true },
    ),
    desactivar: useCatalogoMutation((id: string) => deleteCategory(id)),
    reactivar: useCatalogoMutation((id: string) => updateCategory(id, { activa: true })),
  };
}

export function useProductMutations() {
  return {
    crear: useCatalogoMutation((r: CreateProductRequest) => createProduct(r), { inline: true }),
    editar: useCatalogoMutation(
      ({ id, request }: Editar<UpdateProductRequest>) => updateProduct(id, request),
      { inline: true },
    ),
    desactivar: useCatalogoMutation((id: string) => deleteProduct(id)),
    reactivar: useCatalogoMutation((id: string) => updateProduct(id, { activo: true })),
    disponible: useCatalogoMutation(({ id, disponible }: { id: string; disponible: boolean }) =>
      updateProductDisponible(id, { disponible }),
    ),
  };
}

export function useExtraMutations() {
  return {
    crear: useCatalogoMutation((r: CreateExtraRequest) => createExtra(r), { inline: true }),
    editar: useCatalogoMutation(
      ({ id, request }: Editar<UpdateExtraRequest>) => updateExtra(id, request),
      { inline: true },
    ),
    desactivar: useCatalogoMutation((id: string) => deleteExtra(id)),
    reactivar: useCatalogoMutation((id: string) => updateExtra(id, { activo: true })),
    disponible: useCatalogoMutation(({ id, disponible }: { id: string; disponible: boolean }) =>
      updateExtraDisponible(id, { disponible }),
    ),
  };
}

type Ordenable = { _id: string; orden: number };

/**
 * Flechas ↑↓: intercambia el `orden` con la fila vecina (2 PUT). Si los dos tienen el mismo
 * `orden` (datos viejos), renumera la lista visible con su posición.
 */
export function useSwapOrden(tipo: 'category' | 'product') {
  const actualizar = (id: string, orden: number) =>
    tipo === 'category' ? updateCategory(id, { orden }) : updateProduct(id, { orden });

  return useCatalogoMutation(
    async ({ lista, desde, hacia }: { lista: Ordenable[]; desde: number; hacia: number }) => {
      const a = lista[desde];
      const b = lista[hacia];
      if (!a || !b) return;
      if (a.orden !== b.orden) {
        await Promise.all([actualizar(a._id, b.orden), actualizar(b._id, a.orden)]);
        return;
      }
      const nueva = [...lista];
      nueva[desde] = b;
      nueva[hacia] = a;
      await Promise.all(
        nueva.flatMap((item, i) => (item.orden === i + 1 ? [] : [actualizar(item._id, i + 1)])),
      );
    },
  );
}

/** Sube la foto (mock: la achica y la guarda como data URL; API: Cloudinary). */
export function useUploadFoto() {
  const onError = useToastError();
  return useMutation({ mutationFn: (file: File) => uploadProductPhoto(file), onError });
}
