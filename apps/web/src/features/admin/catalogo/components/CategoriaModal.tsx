import type { Category } from '@blackstation/shared';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../../../components/Button';
import { Field, Input, fieldAria } from '../../../../components/Field';
import { Modal } from '../../../../components/Modal';
import { ApiError } from '../../../../services';
import { siguienteOrden } from '../catalogo';
import { useCategoryMutations } from '../hooks/useCatalogoMutations';

type CategoriaModalProps = {
  /** `null`: alta. */
  category: Category | null;
  categories: Category[];
  onClose: () => void;
};

export function CategoriaModal({ category, categories, onClose }: CategoriaModalProps) {
  const id = useId();
  const { crear, editar } = useCategoryMutations();
  const [nombre, setNombre] = useState(category?.nombre ?? '');
  const [error, setError] = useState<string | null>(null);
  const guardando = crear.isPending || editar.isPending;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!nombre.trim()) {
      setError('Poné un nombre.');
      return;
    }
    const opciones = {
      onSuccess: onClose,
      onError: (e: Error) => {
        if (e instanceof ApiError && e.status === 400) setError(e.message);
      },
    };
    if (category) editar.mutate({ id: category._id, request: { nombre: nombre.trim() } }, opciones);
    else crear.mutate({ nombre: nombre.trim(), orden: siguienteOrden(categories) }, opciones);
  }

  return (
    <Modal
      title={category ? 'Editar categoría' : 'Nueva categoría'}
      onClose={onClose}
      dismissible={!guardando}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form={id} loading={guardando}>
            Guardar
          </Button>
        </>
      }
    >
      <form id={id} onSubmit={onSubmit} noValidate>
        <Field id={`${id}-nombre`} label="Nombre" error={error}>
          <Input
            id={`${id}-nombre`}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            {...fieldAria(`${id}-nombre`, { error })}
          />
        </Field>
      </form>
    </Modal>
  );
}
