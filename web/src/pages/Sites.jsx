import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Radio } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useApi, Card, Table, PageHeader, Button, Input, Select, FormModal, ErrorBox, Badge } from '../ui';
import { siteFields, clean, toForm } from '../forms';
import { fmtDate, daysUntil, relDays, dueTone } from '../format';

const FILTERS = [
  { value: 'overdue', label: 'Po terminie' },
  { value: 'soon', label: 'Przegląd w 30 dni' },
  { value: 'none', label: 'Bez harmonogramu' },
  { value: 'tickets', label: 'Z otwartymi zgłoszeniami' },
];

export default function Sites() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, error } = useApi('sites.list', { search: search.trim() || undefined });
  const clients = useApi(can('sites.edit') && 'clients.list', {}, [creating]);

  const rows = (data || []).filter((s) => {
    const n = daysUntil(s.next_due);
    if (filter === 'overdue') return n != null && n < 0;
    if (filter === 'soon') return n != null && n >= 0 && n <= 30;
    if (filter === 'none') return n == null;
    if (filter === 'tickets') return s.open_tickets > 0;
    return true;
  });

  return (
    <>
      <PageHeader kicker="Ewidencja instalacji" title="Obiekty">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} options={FILTERS} placeholder="Wszystkie obiekty" className="w-52" />
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input placeholder="Szukaj obiektu, adresu, centrali…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-64" />
        </div>
        {can('sites.edit') && <Button icon={Plus} onClick={() => setCreating(true)}>Nowy obiekt</Button>}
      </PageHeader>
      {error && <ErrorBox>{error}</ErrorBox>}
      <Card pad={false} className="reveal">
        <Table rows={rows} empty="Brak obiektów" onRow={(s) => nav(`/obiekty/${s.id}`)} columns={[
          { key: 'name', label: 'Obiekt', render: (s) => <div><div className="font-medium">{s.name}</div><div className="text-[12px] text-muted">{s.client_name}</div></div> },
          { key: 'city', label: 'Lokalizacja', className: 'hidden md:table-cell', render: (s) => <div className="text-[13px]">{s.address}<div className="text-muted">{s.city}</div></div> },
          { key: 'panel', label: 'System', className: 'hidden lg:table-cell', render: (s) => (
            <div className="text-[13px]">
              <div>{[s.panel_manufacturer, s.panel_model].filter(Boolean).join(' ') || '—'}</div>
              <div className="flex items-center gap-2 text-muted text-[12px]">{s.system_type}{s.loops ? ` · ${s.loops} pętli` : ''}{s.monitoring && <span className="inline-flex items-center gap-0.5 text-info"><Radio size={11} />PSP</span>}</div>
            </div>
          ) },
          { key: 'device_count', label: 'Elem.', className: 'text-right hidden sm:table-cell', render: (s) => <span className="font-mono">{s.device_count}</span> },
          { key: 'open_tickets', label: 'Zgł.', className: 'text-right hidden sm:table-cell', render: (s) => s.open_tickets ? <Badge tone="warn">{s.open_tickets}</Badge> : <span className="text-muted">—</span> },
          { key: 'next_due', label: 'Następny przegląd', render: (s) => {
            const n = daysUntil(s.next_due);
            return s.next_due ? <div><div className="font-mono text-[12.5px]">{fmtDate(s.next_due)}</div><Badge tone={dueTone(n)} dot={n < 0}>{relDays(n)}</Badge></div> : <span className="text-muted text-[12px]">nie zaplanowano</span>;
          } },
        ]} />
      </Card>
      {creating && clients.data && (
        <FormModal wide title="Nowy obiekt" fields={siteFields(clients.data)} initial={toForm({ inspection_interval_months: 6, system_type: 'adresowy' })}
          onClose={() => setCreating(false)}
          onSubmit={async (v) => { const s = await api('sites.save', clean(v)); nav(`/obiekty/${s.id}`); }} />
      )}
    </>
  );
}
