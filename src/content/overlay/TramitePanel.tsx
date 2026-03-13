import type { TramiteStatus } from '../../types/busqueda';

interface TramitePanelProps {
  tramite: TramiteStatus;
}

export function TramitePanel({ tramite }: TramitePanelProps) {
  const oficina = tramite.oficina_remitente;

  return (
    <div data-testid="tramite-panel">
      {/* Section 1: Document Info */}
      <section>
        <h3>Información del documento</h3>
        <dl>
          <dt>Nº de trámite</dt>
          <dd>{tramite.id_tramite}</dd>
          <dt>Tipo de trámite</dt>
          <dd>{tramite.tipo_tramite}</dd>
          <dt>Clase</dt>
          <dd>{tramite.clase_tramite}</dd>
          <dt>Tipo de DNI</dt>
          <dd>{tramite.tipo_dni}</dd>
          <dt>Descripción</dt>
          <dd>{tramite.descripcion_tramite}</dd>
          <dt>Fecha de toma</dt>
          <dd>{tramite.fecha_toma}</dd>
        </dl>
      </section>

      {/* Section 2: Status Timeline */}
      <section>
        <h3>Estado del trámite</h3>
        <dl>
          <dt>Último estado</dt>
          <dd>{tramite.ultimo_estado.descripcion}</dd>
          <dt>Fecha</dt>
          <dd>{tramite.ultimo_estado.fecha}</dd>
          {tramite.anteultimo_estado !== null && (
            <>
              <dt>Anteúltimo estado</dt>
              <dd>{tramite.anteultimo_estado.descripcion}</dd>
              <dt>Fecha</dt>
              <dd>{tramite.anteultimo_estado.fecha}</dd>
            </>
          )}
        </dl>
      </section>

      {/* Section 3: Office & Delivery */}
      <section>
        <h3>Oficina & Retiro</h3>
        <dl>
          <dt>Tipo de retiro</dt>
          <dd>{tramite.tipo_retiro || '—'}</dd>
          <dt>Correo</dt>
          <dd>{tramite.correo || '—'}</dd>
          <dt>Oficina</dt>
          <dd>{oficina.descripcion || '—'}</dd>
          <dt>Domicilio</dt>
          <dd>{oficina.domicilio || '—'}</dd>
          <dt>Código postal</dt>
          <dd>{oficina.codigo_postal || '—'}</dd>
          <dt>Provincia</dt>
          <dd>{oficina.provincia || '—'}</dd>
        </dl>
      </section>
    </div>
  );
}
