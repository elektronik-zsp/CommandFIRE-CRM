import { useState } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, ArrowLeft, CalendarPlus, Siren, Radio, Phone, ClipboardCheck, Wrench } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useApi, Card, Table, PageHeader, Button, FormModal, Spinner, ErrorBox, KV, Badge, Tabs, Empty } from '../ui';
import { siteFields, deviceFields, clean, toForm } from '../forms';
import { fmtDate, fmtDateTime, daysUntil, relDays, dueTone } from '../format';
import TicketModal from '../components/TicketModal';
import ScheduleModal from '../components/ScheduleModal';

const INTERVAL = { 1: 'co miesiąc', 3: 'co kwartał', 6: 'co pół roku', 12: 'raz w roku' };

export default function SiteDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'info';
  const { data, error, reload } = useApi('sites.get', { id: Number(id) });
  const clients = useApi('clients.list', {});
  const [modal, setModal] = useState(null); // 'edit' | 'schedule' | {device} | {ticket}

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Spinner />;
  const { site, devices, inspections, tickets } = data;
  const n = daysUntil(site.next_due);
  const totalElements = devices.reduce((a, d) => a + (d.quantity || 1), 0);
  const byType = Object.entries(devices.reduce((acc, d) => ({ ...acc, [d.type]: (acc[d.type] || 0) + (d.quantity || 1) }), {})).sort((a, b) => b[1] - a[1]);

  // Operating log: inspections + tickets, newest first
  const history = [
    ...inspections.filter((i) => i.status === 'wykonany').map((i) => ({ kind: 'inspection', date: i.performed_date, row: i })),
    ...tickets.map((t) => ({ kind: 'ticket', date: t.reported_at, row: t })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <>
      <Link to={`/klienci/${site.client_id}`} className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink mb-3"><ArrowLeft size={13} />{site.client_name}</Link>
      <PageHeader kicker={[site.address, site.city].filter(Boolean).join(', ') || 'Obiekt'} title={site.name}>
        <Button variant="ghost" icon={Pencil} onClick={() => setModal('edit')}>Edytuj</Button>
        <Button variant="ghost" icon={Siren} onClick={() => setModal({ ticket: { site_id: site.id } })}>Zgłoszenie</Button>
        <Button icon={CalendarPlus} onClick={() => setModal('schedule')}>Zaplanuj przegląd</Button>
      </PageHeader>

      {/* status strip */}
      <div className="reveal grid grid-cols-2 md:grid-cols-4 bg-white border border-line rounded-[3px] mb-5 divide-x divide-line">
        <div className="px-4 py-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">Następny przegląd</div>
          <div className="flex items-center gap-2 mt-0.5"><span className="font-display text-[22px] font-semibold">{fmtDate(site.next_due)}</span>{site.next_due && <Badge tone={dueTone(n)} dot={n < 0}>{relDays(n)}</Badge>}</div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">Centrala</div>
          <div className="font-display text-[22px] font-semibold mt-0.5 truncate">{[site.panel_manufacturer, site.panel_model].filter(Boolean).join(' ') || '—'}</div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">Elementy</div>
          <div className="font-display text-[22px] font-semibold mt-0.5">{totalElements} <span className="text-[14px] text-muted font-sans normal-case">w {site.loops || '—'} pętlach</span></div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">Monitoring PSP</div>
          <div className="font-display text-[22px] font-semibold mt-0.5 flex items-center gap-1.5">{site.monitoring ? <><Radio size={18} className="text-info" />TAK</> : 'NIE'}</div>
        </div>
      </div>

      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { key: 'info', label: 'Informacje' },
        { key: 'urzadzenia', label: 'Elementy systemu', count: devices.length },
        { key: 'przeglady', label: 'Przeglądy', count: inspections.length },
        { key: 'zgloszenia', label: 'Zgłoszenia', count: tickets.length },
        { key: 'historia', label: 'Książka eksploatacji' },
      ]} />

      {tab === 'info' && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card title="Obiekt">
            <KV items={[
              ['Klient', <Link className="hover:text-signal" to={`/klienci/${site.client_id}`}>{site.client_name}</Link>],
              ['Adres', [site.address, site.city].filter(Boolean).join(', ')],
              ['Rodzaj', site.building_type],
              ['Kontakt', site.on_site_contact],
              ['Telefon', site.on_site_phone && <a className="inline-flex items-center gap-1 hover:text-signal" href={`tel:${site.on_site_phone}`}><Phone size={12} />{site.on_site_phone}</a>],
              ['Notatki', site.notes && <span className="whitespace-pre-wrap">{site.notes}</span>],
            ]} />
          </Card>
          <Card title="System i umowa">
            <KV items={[
              ['Typ systemu', site.system_type],
              ['Monitoring', site.monitoring ? site.monitoring_operator || 'tak' : 'brak'],
              ['Nr umowy', site.contract_number],
              ['Umowa do', site.contract_end && <span>{fmtDate(site.contract_end)} <Badge tone={dueTone(daysUntil(site.contract_end) - 30)}>{relDays(daysUntil(site.contract_end))}</Badge></span>],
              ['Przeglądy', INTERVAL[site.inspection_interval_months] || `co ${site.inspection_interval_months} mies.`],
              ['Ostatni przegląd', fmtDate(site.last_inspection)],
            ]} />
          </Card>
        </div>
      )}

      {tab === 'urzadzenia' && (
        <Card pad={false} title="Ewidencja elementów SSP" actions={<Button icon={Plus} onClick={() => setModal({ device: { site_id: site.id, status: 'sprawne', quantity: 1, manufacturer: site.panel_manufacturer } })}>Dodaj element</Button>}>
          {byType.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-line bg-paper/40">
              {byType.map(([t, c]) => <span key={t} className="text-[12px] px-2 py-0.5 bg-white border border-line rounded-[2px]">{t} <b className="font-mono">{c}</b></span>)}
            </div>
          )}
          <Table rows={devices} empty="Brak elementów w ewidencji" onRow={(d) => setModal({ device: d })} columns={[
            { key: 'addr', label: 'Pętla/adr.', className: 'w-24', render: (d) => <span className="font-mono text-[12.5px]">{d.loop_no != null ? `L${d.loop_no}` : '—'}{d.address_no != null ? `/${d.address_no}` : ''}</span> },
            { key: 'type', label: 'Element', render: (d) => <div><div className="font-medium">{d.type}{d.quantity > 1 && <span className="text-muted font-mono"> ×{d.quantity}</span>}</div><div className="text-[12px] text-muted">{[d.manufacturer, d.model].filter(Boolean).join(' ')}</div></div> },
            { key: 'location', label: 'Lokalizacja', className: 'hidden md:table-cell' },
            { key: 'serial', label: 'Nr seryjny', className: 'hidden lg:table-cell', render: (d) => <span className="font-mono text-[12px]">{d.serial || '—'}</span> },
            { key: 'replace_by', label: 'Wymiana', className: 'hidden sm:table-cell', render: (d) => d.replace_by ? <div><div className="font-mono text-[12px]">{fmtDate(d.replace_by)}</div><Badge tone={dueTone(daysUntil(d.replace_by) - 30)}>{relDays(daysUntil(d.replace_by))}</Badge></div> : <span className="text-muted">—</span> },
            { key: 'status', label: 'Stan', render: (d) => <Badge>{d.status}</Badge> },
          ]} />
        </Card>
      )}

      {tab === 'przeglady' && (
        <Card pad={false} title="Przeglądy i konserwacje" actions={<Button icon={CalendarPlus} onClick={() => setModal('schedule')}>Zaplanuj</Button>}>
          <Table rows={inspections} empty="Brak przeglądów" onRow={(i) => nav(`/przeglady/${i.id}`)} columns={[
            { key: 'date', label: 'Data', className: 'w-32', render: (i) => <span className="font-mono text-[12.5px]">{fmtDate(i.performed_date || i.scheduled_date)}</span> },
            { key: 'type', label: 'Rodzaj', render: (i) => <div><div className="font-medium capitalize">{i.type}</div>{i.protocol_number && <div className="font-mono text-[11.5px] text-muted">{i.protocol_number}</div>}</div> },
            { key: 'technician_name', label: 'Technik', className: 'hidden md:table-cell' },
            { key: 'status', label: 'Status', render: (i) => <Badge>{i.status}</Badge> },
            { key: 'result', label: 'Wynik', render: (i) => i.result ? <Badge>{i.result}</Badge> : <span className="text-muted">—</span> },
          ]} />
        </Card>
      )}

      {tab === 'zgloszenia' && (
        <Card pad={false} title="Zgłoszenia serwisowe" actions={<Button icon={Plus} onClick={() => setModal({ ticket: { site_id: site.id } })}>Nowe</Button>}>
          <Table rows={tickets} empty="Brak zgłoszeń" onRow={(t) => setModal({ ticket: t })} columns={[
            { key: 'reported_at', label: 'Zgłoszono', className: 'w-36', render: (t) => <span className="font-mono text-[12px]">{fmtDateTime(t.reported_at)}</span> },
            { key: 'title', label: 'Zgłoszenie', render: (t) => <div><div className="font-medium">{t.title}</div><div className="text-[12px] text-muted">{t.category}{t.assignee_name ? ` · ${t.assignee_name}` : ''}</div></div> },
            { key: 'priority', label: 'Priorytet', render: (t) => <Badge>{t.priority}</Badge> },
            { key: 'status', label: 'Status', render: (t) => <Badge>{t.status}</Badge> },
          ]} />
        </Card>
      )}

      {tab === 'historia' && (
        <Card title="Książka eksploatacji — chronologia zdarzeń">
          {history.length === 0 ? <Empty>Brak wpisów</Empty> : (
            <ol className="relative border-l-2 border-line ml-2">
              {history.map((h) => (
                <li key={h.kind + h.row.id} className="ml-5 pb-5 last:pb-0 relative">
                  <span className={`absolute -left-[29px] top-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center text-white ${h.kind === 'inspection' ? 'bg-ink' : 'bg-signal'}`}>
                    {h.kind === 'inspection' ? <ClipboardCheck size={10} /> : <Wrench size={10} />}
                  </span>
                  <div className="font-mono text-[11.5px] text-muted">{h.kind === 'inspection' ? fmtDate(h.date) : fmtDateTime(h.date)}</div>
                  {h.kind === 'inspection' ? (
                    <Link to={`/przeglady/${h.row.id}`} className="block hover:text-signal">
                      <span className="font-medium capitalize">{h.row.type}</span> {h.row.result && <Badge>{h.row.result}</Badge>}
                      <div className="text-[12.5px] text-muted">{h.row.technician_name}{h.row.protocol_number ? ` · protokół ${h.row.protocol_number}` : ''}{h.row.findings ? ` — ${h.row.findings}` : ''}</div>
                    </Link>
                  ) : (
                    <button onClick={() => setModal({ ticket: h.row })} className="block text-left hover:text-signal cursor-pointer">
                      <span className="font-medium">{h.row.title}</span> <Badge>{h.row.status}</Badge>
                      {h.row.resolution && <div className="text-[12.5px] text-muted">{h.row.resolution}</div>}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

      {modal === 'edit' && clients.data && (
        <FormModal wide title="Edycja obiektu" fields={siteFields(clients.data)} initial={toForm(site)} onClose={() => setModal(null)}
          onSubmit={async (v) => { await api('sites.save', clean(v)); reload(); }}
          onDelete={user.role === 'admin' ? async () => { await api('sites.delete', { id: site.id }); nav(`/klienci/${site.client_id}`); } : undefined} />
      )}
      {modal === 'schedule' && <ScheduleModal initial={{ site_id: site.id, scheduled_date: site.next_due || '' }} onClose={() => setModal(null)} onSaved={reload} />}
      {modal?.device && (
        <FormModal title={modal.device.id ? 'Edycja elementu' : 'Nowy element systemu'} fields={deviceFields} initial={modal.device} onClose={() => setModal(null)}
          onSubmit={async (v) => { await api('devices.save', clean(v)); reload(); }}
          onDelete={modal.device.id ? async () => { await api('devices.delete', { id: modal.device.id }); reload(); } : undefined} />
      )}
      {modal?.ticket && <TicketModal ticket={modal.ticket} onClose={() => setModal(null)} onSaved={reload} />}
    </>
  );
}
