import {
  formatearPrecio,
  type Horario,
  type MensajesSettings,
  type Settings,
  type UpdateSettingsRequest,
} from '@blackstation/shared';
import { useId, useState, type FormEvent } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';
import { Button } from '../../../../components/Button';
import { Field, Input, fieldAria } from '../../../../components/Field';
import { Modal } from '../../../../components/Modal';
import { Select } from '../../../../components/Select';
import { Switch } from '../../../../components/Switch';
import { getSession } from '../../../../lib/session';
import { ApiError } from '../../../../services';
import {
  DIAS_SEMANA,
  INTERVALOS,
  PLANTILLAS,
  aFormulario,
  cambiaFranjas,
  cruzaMedianoche,
  validar,
  type AjustesForm,
  type CampoError,
  type Errores,
} from '../ajustes';
import { useContarActivosHoy, useUpdateSettings } from '../hooks/useAjustes';
import { MensajeEditor } from './MensajeEditor';
import './ajustesFormulario.css';

/** Pedido de ejemplo de la preview de mensajes (`vence` fijo: no depende de la hora actual). */
const EJEMPLO = {
  nombre: 'Juan',
  numero: 12,
  hora: '21:30',
  total: formatearPrecio(12500),
  vence: '21:15',
};

type Confirmacion = { activos: number; request: UpdateSettingsRequest };

export function AjustesFormulario({ settings }: { settings: Settings }) {
  const id = useId();
  const guardar = useUpdateSettings();
  const contarActivos = useContarActivosHoy();
  const [guardado, setGuardado] = useState(() => aFormulario(settings));
  const [form, setForm] = useState(guardado);
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [revisando, setRevisando] = useState(false);

  const hayCambios = JSON.stringify(form) !== JSON.stringify(guardado);
  const ocupado = guardar.isPending || revisando;

  // Salir con cambios sin guardar: aviso. Sin sesión (venció o 401) se deja ir.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hayCambios && getSession() !== null && currentLocation.pathname !== nextLocation.pathname,
  );
  useBeforeUnload((event) => {
    if (hayCambios) event.preventDefault();
  });

  function cambiar<K extends keyof AjustesForm>(campo: K, valor: AjustesForm[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function cambiarHorario(dia: number, cambios: Partial<Horario>) {
    setForm((f) => ({
      ...f,
      horarios: f.horarios.map((h) => (h.dia === dia ? { ...h, ...cambios } : h)),
    }));
  }

  function cambiarMensaje(clave: keyof MensajesSettings, valor: string) {
    setForm((f) => ({ ...f, mensajes: { ...f.mensajes, [clave]: valor } }));
  }

  function enviar(request: Confirmacion['request']) {
    setConfirmacion(null);
    guardar.mutate(request, {
      onSuccess: (actualizado) => {
        const nuevo = aFormulario(actualizado);
        setGuardado(nuevo);
        setForm(nuevo);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 400) setErrorGeneral(error.message);
      },
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorGeneral(null);
    const resultado = validar(form);
    if (!resultado.ok) {
      setErrores(resultado.errores);
      document.getElementById(`${id}-${Object.keys(resultado.errores)[0] ?? ''}`)?.focus();
      return;
    }
    setErrores({});
    if (cambiaFranjas(guardado, form)) {
      setRevisando(true);
      try {
        const activos = await contarActivos();
        if (activos > 0) {
          setConfirmacion({ activos, request: resultado.request });
          return;
        }
      } catch {
        // Sin poder contarlos, se guarda igual: el aviso es informativo.
      } finally {
        setRevisando(false);
      }
    }
    enviar(resultado.request);
  }

  const campo = (nombre: CampoError) => `${id}-${nombre}`;
  const error = (nombre: CampoError) => errores[nombre];
  const ejemplo = { ...EJEMPLO, alias: form.alias, minutos: form.minutosTransferencia };

  return (
    <form className="adm-ajustes" onSubmit={(e) => void onSubmit(e)} noValidate>
      <section className="adm-ajustes__seccion" aria-labelledby={`${id}-general`}>
        <h2 id={`${id}-general`} className="adm-ajustes__titulo">
          General
        </h2>
        <Switch
          label="Tomar pedidos"
          checked={form.pedidosHabilitados}
          onChange={(v) => cambiar('pedidosHabilitados', v)}
        />
      </section>

      <section className="adm-ajustes__seccion" aria-labelledby={`${id}-horarios`}>
        <h2 id={`${id}-horarios`} className="adm-ajustes__titulo">
          Horarios
        </h2>
        <ul role="list" className="adm-ajustes__horarios">
          {DIAS_SEMANA.map(({ dia, nombre }) => {
            const h = form.horarios.find((x) => x.dia === dia);
            if (!h) return null;
            const err = error(`horario-${dia}`);
            return (
              <li key={dia} className={`adm-ajustes__horario${h.activo ? '' : ' is-inactivo'}`}>
                <Switch
                  label={nombre}
                  checked={h.activo}
                  onChange={(activo) => cambiarHorario(dia, { activo })}
                />
                <label className="adm-ajustes__hora">
                  <span>Abre</span>
                  <Input
                    id={campo(`horario-${dia}`)}
                    type="time"
                    value={h.abre}
                    disabled={!h.activo}
                    onChange={(e) => cambiarHorario(dia, { abre: e.target.value })}
                    aria-invalid={err ? true : undefined}
                  />
                </label>
                <label className="adm-ajustes__hora">
                  <span>Cierra</span>
                  <Input
                    type="time"
                    value={h.cierra}
                    disabled={!h.activo}
                    onChange={(e) => cambiarHorario(dia, { cierra: e.target.value })}
                    aria-invalid={err ? true : undefined}
                  />
                </label>
                <span className="adm-ajustes__nota">
                  {err ? (
                    <span className="adm-ajustes__error" role="alert">
                      {err}
                    </span>
                  ) : (
                    h.activo && cruzaMedianoche(h) && 'Cierra al día siguiente'
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="adm-ajustes__seccion" aria-labelledby={`${id}-franjas`}>
        <h2 id={`${id}-franjas`} className="adm-ajustes__titulo">
          Franjas
        </h2>
        <div className="adm-ajustes__grilla">
          <Field id={`${id}-intervalo`} label="Intervalo">
            <Select
              id={`${id}-intervalo`}
              value={form.intervaloMin}
              onChange={(e) => cambiar('intervaloMin', Number(e.target.value))}
            >
              {INTERVALOS.map((m) => (
                <option key={m} value={m}>
                  Cada {m} minutos
                </option>
              ))}
            </Select>
          </Field>
          <NumeroField
            id={campo('cupoMaxDefault')}
            label="Cupo por franja"
            hint="Pedidos por franja, salvo que la edites en Franjas."
            value={form.cupoMaxDefault}
            error={error('cupoMaxDefault')}
            onChange={(v) => cambiar('cupoMaxDefault', v)}
          />
          <NumeroField
            id={campo('anticipacionMinMin')}
            label="Anticipación mínima (min)"
            hint="Entre el pedido y el retiro."
            value={form.anticipacionMinMin}
            error={error('anticipacionMinMin')}
            onChange={(v) => cambiar('anticipacionMinMin', v)}
          />
        </div>
      </section>

      <section className="adm-ajustes__seccion" aria-labelledby={`${id}-transferencia`}>
        <h2 id={`${id}-transferencia`} className="adm-ajustes__titulo">
          Transferencia
        </h2>
        <div className="adm-ajustes__grilla">
          <NumeroField
            id={campo('minutosTransferencia')}
            label="Minutos para transferir"
            hint="Después, el pedido se cancela solo."
            value={form.minutosTransferencia}
            error={error('minutosTransferencia')}
            onChange={(v) => cambiar('minutosTransferencia', v)}
          />
          <TextoField
            id={campo('alias')}
            label="Alias"
            value={form.alias}
            error={error('alias')}
            onChange={(v) => cambiar('alias', v)}
          />
          <TextoField
            id={campo('cbu')}
            label="CBU"
            value={form.cbu}
            error={error('cbu')}
            onChange={(v) => cambiar('cbu', v)}
          />
          <TextoField
            id={campo('titular')}
            label="Titular"
            value={form.titular}
            error={error('titular')}
            onChange={(v) => cambiar('titular', v)}
          />
        </div>
        <fieldset className="adm-ajustes__telefono">
          <legend>WhatsApp del local</legend>
          <p className="adm-ajustes__nota">Adonde los clientes mandan el comprobante.</p>
          <div className="adm-ajustes__telefono-campos">
            <Field id={campo('telefono')} label="Característica" error={error('telefono')}>
              <Input
                id={campo('telefono')}
                inputMode="numeric"
                className="u-tabular"
                value={form.caracteristica}
                onChange={(e) => cambiar('caracteristica', e.target.value)}
                {...fieldAria(campo('telefono'), { error: error('telefono') })}
              />
            </Field>
            <Field id={`${id}-numero`} label="Número">
              <Input
                id={`${id}-numero`}
                inputMode="numeric"
                className="u-tabular"
                value={form.numero}
                onChange={(e) => cambiar('numero', e.target.value)}
              />
            </Field>
          </div>
        </fieldset>
      </section>

      <section className="adm-ajustes__seccion" aria-labelledby={`${id}-mensajes`}>
        <h2 id={`${id}-mensajes`} className="adm-ajustes__titulo">
          Mensajes de WhatsApp
        </h2>
        <p className="adm-ajustes__nota">
          Tocá una variable para insertarla donde está el cursor. Abajo, cómo le llega al cliente.
        </p>
        {PLANTILLAS.map(({ clave, titulo }) => (
          <MensajeEditor
            key={clave}
            id={campo(`mensaje-${clave}`)}
            titulo={titulo}
            valor={form.mensajes[clave]}
            error={error(`mensaje-${clave}`)}
            onChange={(v) => cambiarMensaje(clave, v)}
            ejemplo={ejemplo}
          />
        ))}
      </section>

      <div className="adm-ajustes__barra">
        {errorGeneral && (
          <p className="adm-ajustes__error" role="alert">
            {errorGeneral}
          </p>
        )}
        {!errorGeneral && Object.keys(errores).length > 0 && (
          <p className="adm-ajustes__error" role="alert">
            Revisá los campos marcados.
          </p>
        )}
        {hayCambios && !errorGeneral && Object.keys(errores).length === 0 && (
          <p className="adm-ajustes__nota">Tenés cambios sin guardar.</p>
        )}
        <Button
          variant="ghost"
          disabled={!hayCambios || ocupado}
          onClick={() => {
            setForm(guardado);
            setErrores({});
            setErrorGeneral(null);
          }}
        >
          Descartar
        </Button>
        <Button variant="primary" type="submit" disabled={!hayCambios} loading={ocupado}>
          Guardar
        </Button>
      </div>

      {confirmacion && (
        <Modal
          title="Hay pedidos activos"
          description={`Hay ${confirmacion.activos} ${confirmacion.activos === 1 ? 'pedido activo' : 'pedidos activos'} hoy. Los cambios de horario e intervalo aplican ya.`}
          onClose={() => setConfirmacion(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmacion(null)}>
                Volver
              </Button>
              <Button variant="primary" onClick={() => enviar(confirmacion.request)}>
                Guardar igual
              </Button>
            </>
          }
        />
      )}

      {blocker.state === 'blocked' && (
        <Modal
          title="Tenés cambios sin guardar"
          description="Si salís ahora, se pierden."
          onClose={() => blocker.reset()}
          footer={
            <>
              <Button variant="ghost" onClick={() => blocker.reset()}>
                Quedarme
              </Button>
              <Button variant="danger" onClick={() => blocker.proceed()}>
                Salir sin guardar
              </Button>
            </>
          }
        />
      )}
    </form>
  );
}

type CampoProps = {
  id: string;
  label: string;
  value: string;
  onChange: (valor: string) => void;
  error?: string;
  hint?: string;
};

function NumeroField({ id, label, value, onChange, error, hint }: CampoProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <Input
        id={id}
        inputMode="numeric"
        className="u-tabular"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...fieldAria(id, { error, hint: hint !== undefined })}
      />
    </Field>
  );
}

function TextoField({ id, label, value, onChange, error }: CampoProps) {
  return (
    <Field id={id} label={label} error={error}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...fieldAria(id, { error })}
      />
    </Field>
  );
}
