import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, Search, FileCheck2 } from 'lucide-react';
import { useAuth } from '../auth';
import { useApi, Card, Table, PageHeader, Button, Input, Select, ErrorBox, Badge } from '../ui';
import { fmtDateTime, fmtDate, daysUntil, TICKET_PRIORITIES, TICKET_STATUSES } from '../format';
import TicketModal from '../components/TicketModal';

export default function Tickets() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const openId = params.get('id');
  const [status, setStatus] = useState(openId ? '' : 'otwarte');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const { data, error, reload } = useApi('tickets.list', { status: status || undefined, priority: priority || undefined, search: search.trim() || undefined });

  const editing = params.get('nowe') === '1' && can('tickets.create') ? {} : openId ? data?.find((t) => String(t.id) === openId) : null;
  const close = () => setParams({});

  return (
    <>
      <PageHeader kicker="Serwis" title="Zgłoszenia">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Wszystkie"
          options={[{ value: 'otwarte', label: 'Otwarte' }, ...TICKET_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))]} className="w-40" />
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} options={TICKET_PRIORITIES} placeholder="Każdy priorytet" className="w-40" />
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input placeholder="Szukaj…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-52" />
        </div>
        {can('tickets.create') && <Button icon={Plus} onClick={() => setParams({ nowe: '1' })}>Nowe zgłoszenie</Button>}
      </PageHeader>
      {error && <ErrorBox>{error}</ErrorBox>}
      <Card pad={false} className="reveal">
        <Table rows={data} empty="Brak zgłoszeń" onRow={(t) => setParams({ id: String(t.id) })} columns={[
          { key: 'id', label: 'Nr', className: 'w-14', render: (t) => <span className="font-mono text-[12px] text-muted">#{t.id}</span> },
          { key: 'title', label: 'Zgłoszenie', render: (t) => (
            <div className="flex items-start gap-2.5">
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${t.status === 'zakończone' ? 'bg-ok' : t.priority === 'krytyczny' ? 'bg-signal pulse-dot' : t.priority === 'wysoki' ? 'bg-amber' : 'bg-line'}`} />
              <div><div className="font-medium">{t.title}</div>
                <div className="text-[12px] text-muted"><Link onClick={(e) => e.stopPropagation()} to={`/obiekty/${t.site_id}`} className="hover:text-signal">{t.site_name}</Link> · {t.client_name}
                  {t.protocol_number && <> · <Link onClick={(e) => e.stopPropagation()} to={`/zgloszenia/${t.id}/protokol`} className="inline-flex items-center gap-0.5 text-ok hover:text-signal"><FileCheck2 size={11} />{t.protocol_number}</Link></>}</div></div>
            </div>
          ) },
          { key: 'category', label: 'Kategoria', className: 'hidden lg:table-cell capitalize' },
          { key: 'reported_at', label: 'Zgłoszono', className: 'hidden md:table-cell', render: (t) => <span className="font-mono text-[12px]">{fmtDateTime(t.reported_at)}</span> },
          { key: 'due_date', label: 'Termin', className: 'hidden md:table-cell', render: (t) => t.due_date
            ? <span className={`font-mono text-[12px] ${t.status !== 'zakończone' && daysUntil(t.due_date) < 0 ? 'text-signal font-semibold' : ''}`}>{fmtDate(t.due_date)}</span>
            : <span className="text-muted">—</span> },
          { key: 'assignee_name', label: 'Technik', className: 'hidden sm:table-cell', render: (t) => t.assignee_name || <span className="text-muted">—</span> },
          { key: 'priority', label: 'Priorytet', render: (t) => <Badge>{t.priority}</Badge> },
          { key: 'status', label: 'Status', render: (t) => <Badge>{t.status}</Badge> },
        ]} />
      </Card>
      {editing && <TicketModal ticket={editing} onClose={close} onSaved={reload} />}
    </>
  );
}
