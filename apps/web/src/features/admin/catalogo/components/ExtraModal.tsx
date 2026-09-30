import type { Extra } from '@blackstation/shared';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../../../components/Button';
import { Field, Input, fieldAria } from '../../../../components/Field';
import { Modal } from '../../../../components/Modal';
import { ApiError } from '../../../../services';
import { parseEntero } from '../catalogo';
import { useExtraMutations } from '../hooks/useCatalogoMutations';
import './extraModal.css';

type Errores = Partial<Record<'nombre' | 'precio' | 'cantidadMax' | 'general', string>>;

type ExtraModalProps = {
  /** `null`: alta. */
  extra: Extra | null;
  onClose: () => void;
};

export function ExtraModal({ extra, onClose }: ExtraModalProps) {
  const id = useId();
  const { crear, editar } = useExtraMutations();
  const [nombre, setNombre] = useState(extra?.nombre ?? '');
  const [precio, setPrecio] = useState(extra ? String(extra.precio) : '');
  const [cantidadMax, setCantidadMax] = useState(String(extra?.cantidadMax ?? 1));
  const [errores, setErrores] = useState<Errores>({});
  const guardando = crear.isPending || editar.isPending;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const precioNum = parseEntero(precio);
    const maxNum = parseEntero(cantidadMax, 1);
    const nuevos: Errores = {};
    if (!nombre.trim()) nuevos.nombre = 'Poné un nombre.';
    if (precioNum === null) nuevos.precio = 'El precio es un número entero, sin centavos.';
    if (maxNum === null) nuevos.cantidadMax = 'Tiene que ser 1 o más.';
    setErrores(nuevos);
    if (precioNum === null || maxNum === null || nuevos.nombre) return;

    const request = { nombre: nombre.trim(), precio: precioNum, cantidadMax: maxNum };
    const opciones = {
      onSuccess: onClose,
      onError: (e: Error) => {
        if (e instanceof ApiError && e.status === 400) setErrores({ general: e.message });
      },
    };
    if (extra) editar.mutate({ id: extra._id, request }, opciones);
    else crear.mutate(request, opciones);
  }

  const ids = { nombre: `${id}-nombre`, precio: `${id}-precio`, max: `${id}-max` };

  return (
    <Modal
      title={extra ? 'Editar extra' : 'Nuevo extra'}
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
      <form id={id} className="adm-extra-form" onSubmit={onSubmit} noValidate>
        {errores.general && (
          <p className="adm-extra-form__error" role="alert">
            {errores.general}
          </p>
        )}
        <Field id={ids.nombre} label="Nombre" error={errores.nombre}>
          <Input
            id={ids.nombre}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            {...fieldAria(ids.nombre, { error: errores.nombre })}
          />
        </Field>
        <div className="adm-extra-form__fila">
          <Field id={ids.precio} label="Precio ($)" error={errores.precio}>
            <Input
              id={ids.precio}
              inputMode="numeric"
              className="u-tabular"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              {...fieldAria(ids.precio, { error: errores.precio })}
            />
          </Field>
          <Field
            id={ids.max}
            label="Máximo por unidad"
            error={errores.cantidadMax}
            hint="Cuántos de este extra por producto."
          >
            <Input
              id={ids.max}
              inputMode="numeric"
              className="u-tabular"
              value={cantidadMax}
              onChange={(e) => setCantidadMax(e.target.value)}
              {...fieldAria(ids.max, { error: errores.cantidadMax, hint: true })}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
