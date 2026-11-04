import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarPlus, AlertTriangle } from 'lucide-react';
import { useApi, Card, Table, PageHeader, Button, Select, ErrorBox, Badge, Empty } from '../ui';
import { fmtDate, daysUntil, relDays, todayISO, MONTHS, INSPECTION_STATUSES } from '../format';
import ScheduleModal from '../components/ScheduleModal';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Inspections() {
  const nav = useNavigate();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [status, setStatus] = useState('');
  const [tech, setTech] = useState('');
  const [creating, setCreating] = useState(false);
  const from = iso(cursor);
  const to = iso(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
  const { data, error, reload } = useApi('inspections.list', { from, to, status: status || undefined, technician_id: tech ? Number(tech) : undefined });
  const overdue = useApi('inspections.list', { status: 'zaplanowany', to: iso(new Date(Date.now() - 86400000)) }, [creating]);
  const users = useApi('users.list', {});
  const shift = (m) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + m, 1));

  // group by day
  const days = {};
  for (const i of data || []) (days[i.performed_date || i.scheduled_date] ||= []).push(i);
  const today = todayISO();

  const columns = [
    { key: 'site_name', label: 'Obiekt', render: (i) => <div><div className="font-medium">{i.site_name}</div><div className="text-[12px] text-muted">{i.client_name} · {i.site_city}</div></div> },
    { key: 'type', label: 'Rodzaj', className: 'hidden md:table-cell capitalize' },
    { key: 'technician_name', label: 'Technik', className: 'hidden sm:table-cell', render: (i) => i.technician_name || <span className="text-muted">nieprzypisany</span> },
    { key: 'status', label: 'Status', render: (i) => <Badge>{i.status}</Badge> },
    { key: 'result', label: 'Wynik', className: 'hidden sm:table-cell', render: (i) => i.result ? <Badge>{i.result}</Badge> : <span className="text-muted">—</span> },
  ];

  return (
    <>
      <PageHeader kicker="Harmonogram" title="Przeglądy">
        <Select value={tech} onChange={(e) => setTech(e.target.value)} placeholder="Wszyscy technicy" className="w-44"
          options={(users.data || []).map((u) => ({ value: String(u.id), label: u.name }))} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} options={INSPECTION_STATUSES} placeholder="Każdy status" className="w-40" />
        <Button icon={CalendarPlus} onClick={() => setCreating(true)}>Zaplanuj przegląd</Button>
      </PageHeader>

      {overdue.data?.length > 0 && (
        <Card className="reveal mb-4 border-l-4 border-l-signal" pad={false}
          title={<span className="flex items-center gap-2 text-signal"><AlertTriangle size={16} />Zaległe przeglądy ({overdue.data.length})</span>}>
          <Table rows={overdue.data} onRow={(i) => nav(`/przeglady/${i.id}`)} columns={[
            { key: 'scheduled_date', label: 'Termin', className: 'w-40', render: (i) => <div><div className="font-mono text-[12.5px]">{fmtDate(i.scheduled_date)}</div><Badge tone="danger" dot>{relDays(daysUntil(i.scheduled_date))}</Badge></div> },
            ...columns.slice(0, 3),
          ]} />
        </Card>
      )}

      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => shift(-1)} className="w-9 h-9 flex items-center justify-center bg-white border border-line rounded-[3px] hover:border-ink cursor-pointer" aria-label="Poprzedni miesiąc"><ChevronLeft size={16} /></button>
        <h2 className="text-[26px] font-semibold min-w-56 text-center">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h2>
        <button onClick={() => shift(1)} className="w-9 h-9 flex items-center justify-center bg-white border border-line rounded-[3px] hover:border-ink cursor-pointer" aria-label="Następny miesiąc"><ChevronRight size={16} /></button>
        <span className="font-mono text-[12px] text-muted ml-2">{data?.length ?? 0} pozycji</span>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}

      {data && Object.keys(days).length === 0 && <Card><Empty>Brak przeglądów w tym miesiącu</Empty></Card>}
      <div className="flex flex-col gap-3">
        {Object.entries(days).map(([day, rows]) => {
          const d = new Date(day + 'T00:00:00');
          return (
            <div key={day} className="reveal grid grid-cols-[64px_1fr] gap-3">
              <div className={`text-center pt-2 ${day === today ? 'text-signal' : ''}`}>
                <div className="font-display text-[30px] leading-none font-bold">{d.getDate()}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{d.toLocaleDateString('pl-PL', { weekday: 'short' })}</div>
              </div>
              <Card pad={false} className={day === today ? 'border-signal/50' : ''}>
                <Table rows={rows} onRow={(i) => nav(`/przeglady/${i.id}`)} columns={columns} />
              </Card>
            </div>
          );
        })}
      </div>

      {creating && <ScheduleModal onClose={() => setCreating(false)} onSaved={() => reload()} />}
    </>
  );
}
