import type { Category, CreateProductRequest, Extra, Product } from '@blackstation/shared';
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '../../../../components/Button';
import { Drawer } from '../../../../components/Drawer';
import { Field, Input, Textarea, fieldAria } from '../../../../components/Field';
import { Icon } from '../../../../components/Icon';
import { Select } from '../../../../components/Select';
import { ApiError } from '../../../../services';
import { parseEntero, siguienteOrden } from '../catalogo';
import { useProductMutations, useUploadFoto } from '../hooks/useCatalogoMutations';
import './productoDrawer.css';

type Errores = Partial<Record<'nombre' | 'categoriaId' | 'precio' | 'general', string>>;

type ProductoDrawerProps = {
  /** `null`: alta. */
  product: Product | null;
  categories: Category[];
  extras: Extra[];
  /** Todos los productos, para ubicar el alta al final de su categoría. */
  products: Product[];
  onClose: () => void;
};

export function ProductoDrawer({
  product,
  categories,
  extras,
  products,
  onClose,
}: ProductoDrawerProps) {
  const formId = useId();
  const { crear, editar } = useProductMutations();
  const upload = useUploadFoto();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nombre, setNombre] = useState(product?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(product?.descripcion ?? '');
  const [categoriaId, setCategoriaId] = useState(
    product?.categoriaId ?? categories.find((c) => c.activa)?._id ?? '',
  );
  const [precio, setPrecio] = useState(product ? String(product.precio) : '');
  const [foto, setFoto] = useState(
    product?.fotoUrl ? { fotoUrl: product.fotoUrl, fotoPublicId: product.fotoPublicId } : null,
  );
  const [quitables, setQuitables] = useState(product?.ingredientesQuitables ?? []);
  const [nuevoQuitable, setNuevoQuitable] = useState('');
  const [extrasIds, setExtrasIds] = useState(product?.extrasIds ?? []);
  const [errores, setErrores] = useState<Errores>({});

  const guardando = crear.isPending || editar.isPending;
  // Categorías activas, más la actual del producto aunque esté inactiva.
  const opcionesCategoria = categories.filter((c) => c.activa || c._id === product?.categoriaId);
  const opcionesExtra = extras.filter((e) => e.activo || extrasIds.includes(e._id));

  function agregarQuitable() {
    const valor = nuevoQuitable.trim();
    if (!valor) return;
    const existe = quitables.some(
      (q) => q.toLocaleLowerCase('es') === valor.toLocaleLowerCase('es'),
    );
    if (!existe) setQuitables([...quitables, valor]);
    setNuevoQuitable('');
  }

  function onQuitableKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    agregarQuitable();
  }

  function alternarExtra(id: string, marcado: boolean) {
    setExtrasIds(marcado ? [...extrasIds, id] : extrasIds.filter((x) => x !== id));
  }

  function elegirFoto(file: File | undefined) {
    if (!file) return;
    upload.mutate(file, { onSuccess: setFoto });
    if (fileRef.current) fileRef.current.value = '';
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nuevos: Errores = {};
    const precioNum = parseEntero(precio);
    if (!nombre.trim()) nuevos.nombre = 'Poné un nombre.';
    if (!categoriaId) nuevos.categoriaId = 'Elegí una categoría.';
    if (precioNum === null) nuevos.precio = 'El precio es un número entero, sin centavos.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || precioNum === null) return;

    const request: CreateProductRequest = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      categoriaId,
      precio: precioNum,
      fotoUrl: foto?.fotoUrl ?? null,
      fotoPublicId: foto?.fotoPublicId ?? null,
      ingredientesQuitables: quitables,
      extrasIds,
    };
    const onError = (error: Error) => {
      if (error instanceof ApiError && error.status === 400) setErrores({ general: error.message });
    };
    if (product) {
      // Cambiar de categoría lo manda al final de la nueva.
      const orden =
        categoriaId === product.categoriaId
          ? product.orden
          : siguienteOrden(products.filter((p) => p.categoriaId === categoriaId));
      editar.mutate(
        { id: product._id, request: { ...request, orden } },
        { onSuccess: onClose, onError },
      );
    } else {
      const orden = siguienteOrden(products.filter((p) => p.categoriaId === categoriaId));
      crear.mutate({ ...request, orden }, { onSuccess: onClose, onError });
    }
  }

  const ids = {
    nombre: `${formId}-nombre`,
    descripcion: `${formId}-descripcion`,
    categoria: `${formId}-categoria`,
    precio: `${formId}-precio`,
    quitable: `${formId}-quitable`,
  };

  return (
    <Drawer
      side="right"
      title={product ? 'Editar producto' : 'Nuevo producto'}
      onClose={onClose}
      footer={
        <div className="adm-producto__footer">
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            loading={guardando}
            disabled={upload.isPending}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <form id={formId} className="adm-producto" onSubmit={onSubmit} noValidate>
        {errores.general && (
          <p className="adm-producto__error" role="alert">
            {errores.general}
          </p>
        )}

        <div className="adm-producto__foto">
          {foto ? (
            <img
              className="adm-producto__preview"
              src={foto.fotoUrl}
              alt={`Foto de ${nombre || 'producto'}`}
            />
          ) : (
            <span className="adm-producto__preview adm-producto__preview--vacia" aria-hidden="true">
              <Icon name="image" />
            </span>
          )}
          <div className="adm-producto__foto-acciones">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="u-visually-hidden"
              tabIndex={-1}
              aria-label="Archivo de la foto"
              onChange={(event) => elegirFoto(event.target.files?.[0])}
            />
            <Button onClick={() => fileRef.current?.click()} loading={upload.isPending}>
              {foto ? 'Reemplazar foto' : 'Subir foto'}
            </Button>
            {foto && (
              <Button variant="ghost" onClick={() => setFoto(null)} disabled={upload.isPending}>
                Quitar
              </Button>
            )}
          </div>
        </div>

        <Field id={ids.nombre} label="Nombre" error={errores.nombre}>
          <Input
            id={ids.nombre}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            {...fieldAria(ids.nombre, { error: errores.nombre })}
          />
        </Field>

        <Field id={ids.descripcion} label="Descripción">
          <Textarea
            id={ids.descripcion}
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </Field>

        <div className="adm-producto__fila">
          <Field id={ids.categoria} label="Categoría" error={errores.categoriaId}>
            <Select
              id={ids.categoria}
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              {...fieldAria(ids.categoria, { error: errores.categoriaId })}
            >
              {!categoriaId && <option value="">Elegí…</option>}
              {opcionesCategoria.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.nombre}
                  {c.activa ? '' : ' (inactiva)'}
                </option>
              ))}
            </Select>
          </Field>
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
        </div>

        <Field
          id={ids.quitable}
          label="Ingredientes que se pueden quitar"
          hint="Escribí uno y apretá Enter."
        >
          <div className="adm-producto__agregar">
            <Input
              id={ids.quitable}
              value={nuevoQuitable}
              placeholder="Ej.: cebolla"
              onChange={(e) => setNuevoQuitable(e.target.value)}
              onKeyDown={onQuitableKeyDown}
              {...fieldAria(ids.quitable, { hint: true })}
            />
            <Button onClick={agregarQuitable} disabled={!nuevoQuitable.trim()}>
              Agregar
            </Button>
          </div>
        </Field>
        {quitables.length > 0 && (
          <ul role="list" className="adm-producto__quitables" aria-label="Ingredientes quitables">
            {quitables.map((q) => (
              <li key={q} className="adm-producto__quitable">
                {q}
                <button
                  type="button"
                  onClick={() => setQuitables(quitables.filter((x) => x !== q))}
                  aria-label={`Sacar ${q}`}
                >
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <fieldset className="adm-producto__extras">
          <legend>Extras que se ofrecen</legend>
          {opcionesExtra.length === 0 ? (
            <p className="adm-producto__vacio">Todavía no hay extras.</p>
          ) : (
            opcionesExtra.map((e) => (
              <label key={e._id} className="adm-producto__extra">
                <input
                  type="checkbox"
                  checked={extrasIds.includes(e._id)}
                  onChange={(event) => alternarExtra(e._id, event.target.checked)}
                />
                {e.nombre}
                {!e.activo && <span className="adm-producto__vacio"> (inactivo)</span>}
              </label>
            ))
          )}
        </fieldset>
      </form>
    </Drawer>
  );
}
