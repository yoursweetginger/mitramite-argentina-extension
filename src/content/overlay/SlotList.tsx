import type { AppointmentSlot } from '../../types/busqueda';

interface SlotListProps {
  slots: AppointmentSlot[];
}

export function SlotList({ slots }: SlotListProps) {
  if (slots.length === 0) {
    return (
      <p data-testid="slot-list" style={{ margin: '8px 0', fontStyle: 'italic' }}>
        No hay turnos disponibles
      </p>
    );
  }

  return (
    <table data-testid="slot-list" style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>
      <thead>
        <tr>
          <th style={thStyle}>Fecha</th>
          <th style={thStyle}>Hora</th>
          <th style={thStyle}>Sede</th>
          <th style={thStyle}>Trámite</th>
          <th style={thStyle}>Cupos</th>
        </tr>
      </thead>
      <tbody>
        {slots.map((slot, i) => (
          <tr key={slot.id ?? i}>
            <td style={tdStyle}>{slot.fecha}</td>
            <td style={tdStyle}>{slot.hora ?? '—'}</td>
            <td style={tdStyle}>{slot.sede ?? '—'}</td>
            <td style={tdStyle}>{slot.tramite ?? '—'}</td>
            <td style={tdStyle}>{slot.cupos !== undefined ? String(slot.cupos) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const thStyle: React.CSSProperties = {
  padding: '4px 8px',
  textAlign: 'left',
  borderBottom: '1px solid #ccc',
  background: '#f0f0f0',
};

const tdStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderBottom: '1px solid #eee',
};
