import { ACLARACION_MAX, formatearPrecio } from '@blackstation/shared';
import { useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, btnClass } from '../../../../components/Button';
import { Field, Input, Textarea, fieldAria } from '../../../../components/Field';
import { Skeleton } from '../../../../components/Skeleton';
import { waLink } from '../../../../lib/whatsapp';
import { useCart, useCartView } from '../../carrito/hooks/useCart';
import { useEstadoLocal } from '../../hooks/useEstadoLocal';
import { usePublicSettings } from '../../hooks/usePublicSettings';
import { useSlots } from '../../hooks/useSlots';
import { FranjasSelector } from '../components/FranjasSelector';
import { MetodoPagoSelector } from '../components/MetodoPagoSelector';
import { RepasoSheet } from '../components/RepasoSheet';
import { ResumenPedido } from '../components/ResumenPedido';
import { CHECKOUT_IDS, useCheckoutForm } from '../hooks/useCheckoutForm';
import './checkoutPage.css';

export function CheckoutPage() {
  const navigate = useNavigate();
  const { lineas, revalidar, abrirDrawer } = useCart();

  // Al entrar: catálogo al día. Si hay líneas no disponibles, vuelve al menú con el carrito abierto.
  useEffect(() => {
    let vigente = true;
    void revalidar().then((vista) => {
      if (!vigente || !vista || vista.noDisponibles.length === 0) return;
      abrirDrawer();
      void navigate('/', { replace: true });
    });
    return () => {
      vigente = false;
    };
  }, [revalidar, abrirDrawer, navigate]);

  if (lineas.length === 0) {
    return (
      <section className="pub-checkout__mensaje l-stack">
        <h1>No hay nada en tu pedido</h1>
        <Link to="/" className={btnClass('primary')}>
          Ver el menú
        </Link>
      </section>
    );
  }

  return <CheckoutForm />;
}

function CheckoutForm() {
  const form = useCheckoutForm();
  const estado = useEstadoLocal();
  const slots = useSlots();
  const settings = usePublicSettings();
  const { lineas, total, catalogCargando } = useCartView();

  const cerradoPorApi = form.cerrado && estado.tipo === 'abierto';
  if (form.cerrado || estado.tipo === 'cerrado' || estado.tipo === 'deshabilitado') {
    return (
      <section className="pub-checkout__mensaje l-stack" role="status">
        <h1>
          {cerradoPorApi || estado.tipo === 'cargando' || estado.tipo === 'error'
            ? 'En este momento no estamos tomando pedidos'
            : estado.texto}
        </h1>
        <p>Tu pedido queda guardado para cuando abramos.</p>
        <Link to="/" className={btnClass('secondary')}>
          Volver al menú
        </Link>
      </section>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.confirmar();
  }

  const { errores } = form;
  const franjas = slots.data?.slots ?? [];
  const avisoHorario = errores.hora
    ? errores.hora
    : form.franjaPerdida
      ? `La franja de las ${form.franjaPerdida} ya no está disponible. Elegí otra.`
      : null;

  return (
    <form className="pub-checkout" onSubmit={onSubmit} noValidate>
      <h1>Tu pedido</h1>

      {catalogCargando ? (
        <Skeleton className="pub-checkout__skeleton-resumen" />
      ) : (
        <ResumenPedido lineas={lineas} total={total} />
      )}

      <section className="pub-checkout__seccion" aria-labelledby="checkout-datos-titulo">
        <h2 id="checkout-datos-titulo">Tus datos</h2>
        <Field id={CHECKOUT_IDS.nombre} label="Nombre" error={errores.nombre}>
          <Input
            id={CHECKOUT_IDS.nombre}
            name="nombre"
            autoComplete="name"
            value={form.nombre}
            onChange={(e) => form.setNombre(e.target.value)}
            onBlur={form.blurNombre}
            {...fieldAria(CHECKOUT_IDS.nombre, { error: errores.nombre })}
          />
        </Field>
        <fieldset className="pub-checkout__telefono">
          <legend className="pub-checkout__legend">Celular</legend>
          <Field
            id={CHECKOUT_IDS.caracteristica}
            label="Característica"
            className="pub-checkout__caracteristica"
          >
            <Input
              id={CHECKOUT_IDS.caracteristica}
              name="caracteristica"
              inputMode="numeric"
              autoComplete="tel-area-code"
              value={form.caracteristica}
              onChange={(e) => form.cambiarTelefono('caracteristica', e.target.value)}
              onBlur={() => form.blurTelefono('caracteristica')}
              aria-invalid={errores.telefono ? true : undefined}
            />
          </Field>
          <Field
            id={CHECKOUT_IDS.numero}
            label="Número"
            hint="Sin 0 ni 15"
            error={errores.telefono}
            className="pub-checkout__numero"
          >
            <Input
              id={CHECKOUT_IDS.numero}
              name="numero"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-local"
              value={form.numero}
              onChange={(e) => form.cambiarTelefono('numero', e.target.value)}
              onBlur={() => form.blurTelefono('numero')}
              {...fieldAria(CHECKOUT_IDS.numero, { error: errores.telefono, hint: true })}
            />
          </Field>
        </fieldset>
      </section>

      <section
        id={CHECKOUT_IDS.horario}
        className="pub-checkout__seccion"
        aria-labelledby="checkout-horario-titulo"
        tabIndex={-1}
      >
        <h2 id="checkout-horario-titulo">Horario de retiro</h2>
        {estado.tipo === 'error' ? (
          <div className="pub-checkout__aviso" role="alert">
            <p>No pudimos cargar los horarios.</p>
            <Button onClick={estado.reintentar}>Reintentar</Button>
          </div>
        ) : !slots.data ? (
          <Skeleton className="pub-checkout__skeleton-bloque" />
        ) : franjas.length === 0 ? (
          <p className="pub-checkout__vacio">No quedan horarios disponibles para hoy</p>
        ) : (
          <FranjasSelector
            franjas={franjas}
            elegida={form.hora}
            onElegir={form.elegirHora}
            describedBy={avisoHorario ? 'checkout-horario-aviso' : undefined}
          />
        )}
        {avisoHorario && (
          <p id="checkout-horario-aviso" className="pub-checkout__error" role="alert">
            {avisoHorario}
          </p>
        )}
      </section>

      <section
        id={CHECKOUT_IDS.pago}
        className="pub-checkout__seccion"
        aria-labelledby="checkout-pago-titulo"
        tabIndex={-1}
      >
        <h2 id="checkout-pago-titulo">Pago</h2>
        {settings.data ? (
          <MetodoPagoSelector
            value={form.metodoPago}
            onChange={form.setMetodoPago}
            minutosTransferencia={settings.data.minutosTransferencia}
            soloTransferencia={form.soloTransferencia}
          />
        ) : (
          <Skeleton className="pub-checkout__skeleton-bloque" />
        )}
      </section>

      <section className="pub-checkout__seccion" aria-labelledby="checkout-aclaracion-titulo">
        <h2 id="checkout-aclaracion-titulo">Aclaración</h2>
        <Field
          id={CHECKOUT_IDS.aclaracion}
          label="¿Algo que tengamos que saber? (opcional)"
          error={errores.aclaracion}
          aside={
            <span className="pub-checkout__contador u-tabular" aria-hidden="true">
              {form.aclaracion.length}/{ACLARACION_MAX}
            </span>
          }
        >
          <Textarea
            id={CHECKOUT_IDS.aclaracion}
            name="aclaracion"
            rows={3}
            maxLength={ACLARACION_MAX}
            value={form.aclaracion}
            onChange={(e) => form.setAclaracion(e.target.value)}
            {...fieldAria(CHECKOUT_IDS.aclaracion, { error: errores.aclaracion })}
          />
        </Field>
      </section>

      {form.bloqueado && (
        <div
          id={CHECKOUT_IDS.bloqueado}
          className="pub-checkout__aviso pub-checkout__aviso--bloqueado"
          role="alert"
          tabIndex={-1}
        >
          <p>No podemos tomar tu pedido online. Escribinos por WhatsApp</p>
          {settings.data && (
            <a
              className={btnClass('secondary')}
              href={waLink(settings.data.telefonoLocal)}
              target="_blank"
              rel="noreferrer"
            >
              Escribir por WhatsApp
            </a>
          )}
        </div>
      )}

      <div className="pub-checkout__footer">
        <div className="pub-checkout__total">
          <span>Total</span>
          <strong className="u-tabular">{formatearPrecio(total)}</strong>
        </div>
        <Button
          type="submit"
          variant="primary"
          className="pub-checkout__confirmar"
          loading={form.enviando}
          disabled={form.bloqueado || catalogCargando}
        >
          Confirmar pedido
        </Button>
      </div>

      {form.repasoAbierto && form.hora && (
        <RepasoSheet
          hora={form.hora}
          total={total}
          metodoPago={form.metodoPago}
          minutosTransferencia={settings.data?.minutosTransferencia}
          enviando={form.enviando}
          onVolver={form.cerrarRepaso}
          onConfirmar={form.enviar}
        />
      )}
    </form>
  );
}
