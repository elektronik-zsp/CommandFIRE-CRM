import { useState } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, ArrowLeft, CalendarPlus, Siren, Radio, Phone, CircuitBoard, FileCode2, ChevronRight } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useApi, Card, Table, PageHeader, Button, FormModal, Spinner, ErrorBox, KV, Badge, Tabs, Empty } from '../ui';
import { siteFields, panelFields, clean, toForm } from '../forms';
import { fmtDate, fmtDateTime, daysUntil, relDays, dueTone } from '../format';
import TicketModal from '../components/TicketModal';
import ScheduleModal from '../components/ScheduleModal';
import DeviceModal from '../components/DeviceModal';
import { HistoryList } from '../components/History';

const INTERVAL = { 1: 'co miesiąc', 3: 'co kwartał', 6: 'co pół roku', 12: 'raz w roku' };

export default function SiteDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'info';
  const { data, error, reload } = useApi('sites.get', { id: Number(id) });
  const clients = useApi('clients.list', {});
  const [modal, setModal] = useState(null); // 'edit' | 'schedule' | 'panel' | {device} | {ticket}

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Spinner />;
  const { site, devices, inspections, tickets, panels, history } = data;
  const n = daysUntil(site.next_due);
  const totalElements = devices.reduce((a, d) => a + (d.quantity || 1), 0);
  const byType = Object.entries(devices.reduce((acc, d) => ({ ...acc, [d.type]: (acc[d.type] || 0) + (d.quantity || 1) }), {})).sort((a, b) => b[1] - a[1]);

  // Operating log: inspections, tickets and the element / panel change log, newest first
  const book = [
    ...inspections.filter((i) => i.status === 'wykonany').map((i) => ({
      virtual: true, kind: 'przegląd', entity: 'inspection', entity_id: i.id, event_date: i.performed_date, created_at: i.performed_date + 'T12:00:00',
      entity_label: `${i.type}${i.result ? ' — ' + i.result : ''}${i.protocol_number ? ' · ' + i.protocol_number : ''}`, comment: i.findings, user_name: i.technician_name,
    })),
    ...tickets.map((t) => ({
      virtual: true, kind: 'zgłoszenie', entity: 'ticket', entity_id: t.id, event_date: t.reported_at.slice(0, 10), created_at: t.reported_at,
      entity_label: `#${t.id} ${t.title} (${t.status})`, comment: t.resolution,
    })),
    ...history,
  ].sort((a, b) => b.event_date.localeCompare(a.event_date) || String(b.created_at).localeCompare(String(a.created_at)));
  const openEntity = (h) => {
    if (h.entity === 'ticket') { const t = tickets.find((x) => x.id === h.entity_id); if (t) setModal({ ticket: t }); }
    if (h.entity === 'device') { const d = devices.find((x) => x.id === h.entity_id); if (d) setModal({ device: d, tab: 'historia' }); }
  };
  const newPanel = () => setModal({ panel: {
    site_id: site.id, name: panels.length ? '' : 'Centrala główna', manufacturer: site.panel_manufacturer, model: site.panel_model, loops: site.loops,
  } });

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
          <button onClick={() => setParams({ tab: 'centrala' })} className="block max-w-full font-display text-[22px] font-semibold mt-0.5 truncate hover:text-signal cursor-pointer">{[site.panel_manufacturer, site.panel_model].filter(Boolean).join(' ') || '—'}</button>
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
        { key: 'centrala', label: 'Karta centrali', count: panels.length },
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

      {tab === 'centrala' && (
        <div className="flex flex-col gap-3">
          {panels.length === 0 ? (
            <Card><Empty icon={CircuitBoard}>
              <span>Ten obiekt nie ma jeszcze karty centrali.</span>
              <Button icon={Plus} onClick={newPanel} className="mt-2">Utwórz kartę centrali</Button>
            </Empty></Card>
          ) : (
            <>
              {panels.map((p) => (
                <Link key={p.id} to={`/centrale/${p.id}`} className="reveal group grid sm:grid-cols-[auto_1fr_auto] items-center gap-4 bg-white border border-line rounded-[3px] px-4 py-3.5 hover:border-ink transition-colors">
                  <span className="w-11 h-11 flex items-center justify-center bg-ink text-white rounded-[3px]"><CircuitBoard size={20} /></span>
                  <div className="min-w-0">
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">{p.name}{p.location ? ` · ${p.location}` : ''}</div>
                    <div className="font-display text-[22px] font-semibold leading-tight">{[p.manufacturer, p.model].filter(Boolean).join(' ') || '—'}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-ink-3 font-mono">
                      <span>SN {p.serial || '—'}</span><span>FW {p.firmware || '—'}</span><span>{p.loops ?? '—'} pętli / {p.zones ?? '—'} stref</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 text-[12.5px] ${p.file_count ? 'text-ink' : 'text-signal'}`}>
                      <FileCode2 size={15} />{p.file_count ? `${p.file_count} pl. konfiguracji · ${fmtDate(p.last_file_at)}` : 'brak pliku konfiguracji'}
                    </span>
                    <ChevronRight size={18} className="text-muted group-hover:text-signal" />
                  </div>
                </Link>
              ))}
              <div><Button variant="ghost" icon={Plus} onClick={newPanel}>Dodaj kolejną centralę</Button></div>
            </>
          )}
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
          <HistoryList rows={book} showEntity onEntity={openEntity} onChanged={reload} empty="Brak wpisów" />
        </Card>
      )}

      {modal === 'edit' && clients.data && (
        <FormModal wide title="Edycja obiektu" fields={siteFields(clients.data)} initial={toForm(site)} onClose={() => setModal(null)}
          onSubmit={async (v) => { await api('sites.save', clean(v)); reload(); }}
          onDelete={user.role === 'admin' ? async () => { await api('sites.delete', { id: site.id }); nav(`/klienci/${site.client_id}`); } : undefined} />
      )}
      {modal === 'schedule' && <ScheduleModal initial={{ site_id: site.id, scheduled_date: site.next_due || '' }} onClose={() => setModal(null)} onSaved={reload} />}
      {modal?.device && <DeviceModal device={modal.device} initialTab={modal.tab} onClose={() => setModal(null)} onSaved={reload} />}
      {modal?.panel && (
        <FormModal wide title="Nowa karta centrali" fields={panelFields} initial={modal.panel} onClose={() => setModal(null)}
          onSubmit={async (v) => { const p = await api('panels.save', clean(v)); nav(`/centrale/${p.id}`); }} />
      )}
      {modal?.ticket && <TicketModal ticket={modal.ticket} onClose={() => setModal(null)} onSaved={reload} />}
    </>
  );
}
