import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Pencil, Plus, ArrowLeft, Phone, Mail } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useApi, Card, Table, PageHeader, Button, FormModal, Spinner, ErrorBox, KV, Badge } from '../ui';
import { clientFields, siteFields, clean, toForm } from '../forms';
import { fmtDate, fmtDateTime, daysUntil, relDays, dueTone } from '../format';

export default function ClientDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data, error, reload } = useApi('clients.get', { id: Number(id) });
  const [modal, setModal] = useState(null);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Spinner />;
  const { client, sites, tickets } = data;

  return (
    <>
      <Link to="/klienci" className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink mb-3 no-print"><ArrowLeft size={13} />Klienci</Link>
      <PageHeader kicker={client.nip ? `NIP ${client.nip}` : 'Klient'} title={client.name}>
        <Button variant="ghost" icon={Pencil} onClick={() => setModal('edit')}>Edytuj</Button>
        <Button icon={Plus} onClick={() => setModal('site')}>Dodaj obiekt</Button>
      </PageHeader>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        <Card title="Dane klienta" className="reveal self-start">
          <KV items={[
            ['Adres', [client.address, client.city].filter(Boolean).join(', ')],
            ['Kontakt', client.contact_person],
            ['Telefon', client.phone && <a className="inline-flex items-center gap-1 hover:text-signal" href={`tel:${client.phone}`}><Phone size={12} />{client.phone}</a>],
            ['E-mail', client.email && <a className="inline-flex items-center gap-1 hover:text-signal" href={`mailto:${client.email}`}><Mail size={12} />{client.email}</a>],
            ['Notatki', client.notes && <span className="whitespace-pre-wrap">{client.notes}</span>],
          ]} />
        </Card>
        <div className="flex flex-col gap-4 min-w-0">
          <Card title={`Obiekty (${sites.length})`} pad={false} className="reveal">
            <Table rows={sites} empty="Klient nie ma jeszcze obiektów" onRow={(s) => nav(`/obiekty/${s.id}`)} columns={[
              { key: 'name', label: 'Obiekt', render: (s) => <div><div className="font-medium">{s.name}</div><div className="text-[12px] text-muted">{[s.address, s.city].filter(Boolean).join(', ')}</div></div> },
              { key: 'panel', label: 'Centrala', className: 'hidden md:table-cell', render: (s) => [s.panel_manufacturer, s.panel_model].filter(Boolean).join(' ') || '—' },
              { key: 'device_count', label: 'Elementy', className: 'text-right hidden sm:table-cell', render: (s) => <span className="font-mono">{s.device_count}</span> },
              { key: 'next_due', label: 'Następny przegląd', render: (s) => s.next_due ? <div><div className="font-mono text-[12.5px]">{fmtDate(s.next_due)}</div><Badge tone={dueTone(daysUntil(s.next_due))}>{relDays(daysUntil(s.next_due))}</Badge></div> : <span className="text-muted">nie zaplanowano</span> },
            ]} />
          </Card>
          <Card title="Ostatnie zgłoszenia" pad={false} className="reveal">
            <Table rows={tickets} empty="Brak zgłoszeń" onRow={(t) => nav(`/zgloszenia?id=${t.id}`)} columns={[
              { key: 'reported_at', label: 'Data', className: 'w-36', render: (t) => <span className="font-mono text-[12px]">{fmtDateTime(t.reported_at)}</span> },
              { key: 'title', label: 'Zgłoszenie', render: (t) => <div><div className="font-medium">{t.title}</div><div className="text-[12px] text-muted">{t.site_name}</div></div> },
              { key: 'priority', label: 'Priorytet', className: 'hidden sm:table-cell', render: (t) => <Badge>{t.priority}</Badge> },
              { key: 'status', label: 'Status', render: (t) => <Badge>{t.status}</Badge> },
            ]} />
          </Card>
        </div>
      </div>

      {modal === 'edit' && (
        <FormModal title="Edycja klienta" fields={clientFields} initial={client} onClose={() => setModal(null)}
          onSubmit={async (v) => { await api('clients.save', v); reload(); }}
          onDelete={user.role === 'admin' ? async () => { await api('clients.delete', { id: client.id }); nav('/klienci'); } : undefined} />
      )}
      {modal === 'site' && (
        <FormModal wide title="Nowy obiekt" fields={siteFields([client])} initial={toForm({ client_id: client.id, inspection_interval_months: 6, city: client.city, system_type: 'adresowy' })}
          onClose={() => setModal(null)}
          onSubmit={async (v) => { const s = await api('sites.save', clean(v)); nav(`/obiekty/${s.id}`); }} />
      )}
    </>
  );
}
