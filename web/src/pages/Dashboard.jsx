import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, Battery, FileWarning, Database, Trash2, Plus } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useApi, Card, Stat, Table, Badge, PageHeader, Spinner, ErrorBox, Empty, Button } from '../ui';
import { fmtDate, daysUntil, relDays, dueTone, MONTHS } from '../format';

function MonthBars({ title, rows, field, color }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...rows.map((r) => r[field]));
  const total = rows.reduce((a, r) => a + r[field], 0);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[13px] font-medium">{title}</div>
        <div className="font-mono text-[11px] text-muted">12 mies. · razem {total}</div>
      </div>
      <div className="relative flex items-end gap-[2px] h-28 border-b border-line" onMouseLeave={() => setHover(null)}>
        {rows.map((r, i) => (
          <div key={r.month} className="flex-1 h-full flex items-end cursor-default" onMouseEnter={() => setHover(i)}>
            <div className="w-full rounded-t-[4px] transition-opacity" style={{
              height: `${(r[field] / max) * 100}%`, minHeight: r[field] ? 3 : 0, background: color,
              opacity: hover == null || hover === i ? 1 : 0.35,
            }} />
          </div>
        ))}
        {hover != null && (
          <div className="absolute -top-2 -translate-y-full pointer-events-none bg-ink text-white text-[12px] px-2 py-1 rounded-[3px] whitespace-nowrap"
            style={{ left: `${((hover + 0.5) / rows.length) * 100}%`, transform: 'translate(-50%, -100%)' }}>
            {MONTHS[Number(rows[hover].month.slice(5)) - 1]} {rows[hover].month.slice(0, 4)}: <b>{rows[hover][field]}</b>
          </div>
        )}
      </div>
      <div className="flex gap-[2px] mt-1">
        {rows.map((r) => <div key={r.month} className="flex-1 text-center font-mono text-[9.5px] text-muted">{MONTHS[Number(r.month.slice(5)) - 1].slice(0, 3)}</div>)}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data, error, loading, reload } = useApi('dashboard');
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  const { counts, sites, noSchedule, tickets, replacements, contracts, perMonth, demo } = data;
  const overdue = sites.filter((s) => daysUntil(s.next_due) < 0).length;

  async function demoAction(action) {
    if (action === 'demo.clear' && !confirm('Usunąć wszystkie dane demonstracyjne (klientów, obiekty, przeglądy, zgłoszenia)?')) return;
    setBusy(true);
    try { await api(action); await reload(); } catch (e) { alert(e.message); } finally { setBusy(false); }
  }

  const today = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <PageHeader kicker={today} title="Pulpit">
        {user.role === 'admin' && demo && <Button variant="ghost" icon={Trash2} loading={busy} onClick={() => demoAction('demo.clear')}>Usuń dane demo</Button>}
        <Button variant="dark" icon={Plus} onClick={() => nav('/zgloszenia?nowe=1')}>Nowe zgłoszenie</Button>
      </PageHeader>

      {counts.clients === 0 && (
        <div className="reveal mb-6 flex flex-wrap items-center justify-between gap-4 p-5 bg-white border border-line border-l-4 border-l-signal rounded-[3px]">
          <div>
            <div className="font-display uppercase text-[18px] font-semibold">Baza jest pusta</div>
            <p className="text-muted text-[13px]">Dodaj pierwszego klienta lub wczytaj przykładowe dane, aby zobaczyć, jak działa system.</p>
          </div>
          <div className="flex gap-2">
            {user.role === 'admin' && <Button variant="ghost" icon={Database} loading={busy} onClick={() => demoAction('demo.seed')}>Wczytaj dane demo</Button>}
            <Button icon={Plus} onClick={() => nav('/klienci?nowy=1')}>Dodaj klienta</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Obiekty" value={counts.sites} sub={`${counts.clients} klientów`} delay={0} />
        <Stat label="Elementy SSP" value={counts.devices} sub="w ewidencji" delay={50} />
        <Stat label="Po terminie" value={overdue} tone={overdue ? 'danger' : undefined} sub="zaległe przeglądy" delay={100} />
        <Stat label="Zgłoszenia" value={counts.open_tickets} tone={counts.critical_tickets ? 'danger' : counts.open_tickets ? 'warn' : undefined} sub={`${counts.critical_tickets} krytycznych`} delay={150} />
        <Stat label="Wykonane" value={counts.done_this_month} sub="przeglądy w tym miesiącu" delay={200} />
      </div>

      <div className="grid xl:grid-cols-[1.45fr_1fr] gap-4 mb-4">
        <Card title="Terminy przeglądów — 30 dni" pad={false} actions={<Link to="/przeglady" className="text-[12px] text-muted hover:text-ink">Harmonogram →</Link>}>
          <Table
            rows={sites}
            empty="Brak przeglądów w najbliższych 30 dniach"
            onRow={(s) => nav(`/obiekty/${s.id}`)}
            columns={[
              { key: 'next_due', label: 'Termin', className: 'w-36', render: (s) => {
                const n = daysUntil(s.next_due);
                return <div><div className="font-mono text-[13px]">{fmtDate(s.next_due)}</div><Badge tone={dueTone(n)} dot={n < 0}>{relDays(n)}</Badge></div>;
              } },
              { key: 'name', label: 'Obiekt', render: (s) => <div><div className="font-medium">{s.name}</div><div className="text-muted text-[12px]">{s.client_name} · {s.city}</div></div> },
              { key: 'panel', label: 'Centrala', className: 'hidden md:table-cell', render: (s) => <span className="text-[12.5px]">{[s.panel_manufacturer, s.panel_model].filter(Boolean).join(' ') || '—'}</span> },
            ]}
          />
        </Card>

        <Card title="Otwarte zgłoszenia" pad={false} actions={<Link to="/zgloszenia" className="text-[12px] text-muted hover:text-ink">Wszystkie →</Link>}>
          {tickets.length === 0 ? <Empty>Brak otwartych zgłoszeń</Empty> : (
            <ul>
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link to={`/zgloszenia?id=${t.id}`} className="flex items-start gap-3 px-4 py-2.5 border-b border-line/70 last:border-0 hover:bg-paper/70">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${t.priority === 'krytyczny' ? 'bg-signal pulse-dot' : t.priority === 'wysoki' ? 'bg-amber' : 'bg-line'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{t.title}</div>
                      <div className="text-[12px] text-muted truncate">{t.site_name} · {t.client_name}</div>
                    </div>
                    <Badge>{t.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
        <Card title={<span className="flex items-center gap-2"><Battery size={16} />Wymiany elementów — 90 dni</span>} pad={false}>
          {replacements.length === 0 ? <Empty>Brak zaplanowanych wymian</Empty> : (
            <ul>{replacements.map((d) => {
              const n = daysUntil(d.replace_by);
              return (
                <li key={d.id}><Link to={`/obiekty/${d.site_id}?tab=urzadzenia`} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-line/70 last:border-0 hover:bg-paper/70">
                  <div className="min-w-0"><div className="font-medium truncate">{d.type}{d.quantity > 1 && <span className="text-muted"> ×{d.quantity}</span>}</div><div className="text-[12px] text-muted truncate">{d.site_name}</div></div>
                  <div className="text-right shrink-0"><div className="font-mono text-[12px]">{fmtDate(d.replace_by)}</div><Badge tone={dueTone(n)}>{relDays(n)}</Badge></div>
                </Link></li>
              );
            })}</ul>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2"><FileWarning size={16} />Kończące się umowy — 60 dni</span>} pad={false}>
          {contracts.length === 0 ? <Empty>Brak umów do odnowienia</Empty> : (
            <ul>{contracts.map((s) => {
              const n = daysUntil(s.contract_end);
              return (
                <li key={s.id}><Link to={`/obiekty/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-line/70 last:border-0 hover:bg-paper/70">
                  <div className="min-w-0"><div className="font-medium truncate">{s.name}</div><div className="text-[12px] text-muted truncate">{s.contract_number} · {s.client_name}</div></div>
                  <div className="text-right shrink-0"><div className="font-mono text-[12px]">{fmtDate(s.contract_end)}</div><Badge tone={dueTone(n)}>{relDays(n)}</Badge></div>
                </Link></li>
              );
            })}</ul>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2"><CalendarClock size={16} />Aktywność</span>} className="md:col-span-2 xl:col-span-1">
          <div className="flex flex-col gap-6">
            <MonthBars title="Wykonane przeglądy" rows={perMonth} field="done" color="var(--color-ink)" />
            <MonthBars title="Nowe zgłoszenia serwisowe" rows={perMonth} field="tickets" color="var(--color-signal)" />
          </div>
        </Card>
      </div>

      {noSchedule.length > 0 && (
        <Card title="Obiekty bez harmonogramu przeglądów" pad={false}>
          <Table rows={noSchedule} onRow={(s) => nav(`/obiekty/${s.id}`)} columns={[
            { key: 'name', label: 'Obiekt', render: (s) => <span className="font-medium">{s.name}</span> },
            { key: 'client_name', label: 'Klient' },
            { key: 'hint', label: '', render: () => <span className="text-muted text-[12px]">Brak daty ostatniego przeglądu — zaplanuj pierwszy</span> },
          ]} />
        </Card>
      )}
    </>
  );
}
