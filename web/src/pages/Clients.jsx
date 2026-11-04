import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api } from '../api';
import { useApi, Card, Table, PageHeader, Button, Input, FormModal, ErrorBox, Badge } from '../ui';
import { clientFields } from '../forms';

export default function Clients() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const { data, error, reload } = useApi('clients.list', { search: search.trim() || undefined });
  const creating = params.get('nowy') === '1';

  return (
    <>
      <PageHeader kicker="Kartoteka" title="Klienci">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input placeholder="Szukaj: nazwa, NIP, miasto…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-64" />
        </div>
        <Button icon={Plus} onClick={() => setParams({ nowy: '1' })}>Nowy klient</Button>
      </PageHeader>
      {error && <ErrorBox>{error}</ErrorBox>}
      <Card pad={false} className="reveal">
        <Table rows={data} empty={search ? 'Brak wyników' : 'Nie dodano jeszcze klientów'} onRow={(c) => nav(`/klienci/${c.id}`)}
          columns={[
            { key: 'name', label: 'Klient', render: (c) => <div><div className="font-medium">{c.name}</div>{c.nip && <div className="font-mono text-[11.5px] text-muted">NIP {c.nip}</div>}</div> },
            { key: 'city', label: 'Miejscowość', className: 'hidden md:table-cell' },
            { key: 'contact_person', label: 'Kontakt', className: 'hidden lg:table-cell', render: (c) => <div className="text-[13px]"><div>{c.contact_person || '—'}</div><div className="text-muted">{c.phone}</div></div> },
            { key: 'site_count', label: 'Obiekty', className: 'text-right', render: (c) => <span className="font-mono">{c.site_count}</span> },
            { key: 'open_tickets', label: 'Zgłoszenia', className: 'text-right', render: (c) => c.open_tickets ? <Badge tone="warn">{c.open_tickets} otwarte</Badge> : <span className="text-muted">—</span> },
          ]} />
      </Card>
      {creating && (
        <FormModal title="Nowy klient" fields={clientFields} onClose={() => setParams({})}
          onSubmit={async (v) => { const c = await api('clients.save', v); reload(); nav(`/klienci/${c.id}`); }} />
      )}
    </>
  );
}
