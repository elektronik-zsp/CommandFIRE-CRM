import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle2, Printer, Trash2, Check, X, Minus } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useApi, Card, PageHeader, Button, Spinner, ErrorBox, Field, Input, Select, Badge, KV } from '../ui';
import { fmtDate, todayISO, INSPECTION_TYPES, INSPECTION_RESULTS } from '../format';
import { CompanyHeader, Signatures, CompanyFooter } from '../components/PrintParts';

const STATES = [
  { v: 'ok', label: 'Sprawne', icon: Check, on: 'bg-ok text-white border-ok' },
  { v: 'usterka', label: 'Usterka', icon: X, on: 'bg-signal text-white border-signal' },
  { v: 'nd', label: 'Nie dotyczy', icon: Minus, on: 'bg-ink-3 text-white border-ink-3' },
];
const STATE_LABEL = { ok: 'sprawne', usterka: 'USTERKA', nd: 'n/d', '': '—' };
const TEXTAREA = 'w-full px-2.5 py-2 bg-white border border-line rounded-[3px] text-[13.5px] outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 resize-y';

export default function InspectionDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const editable = can('inspections.edit');
  const { data, error, reload } = useApi('inspections.get', { id: Number(id) });
  const users = useApi('users.list', {});
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => { if (data) setForm({ ...data.inspection, technician_id: data.inspection.technician_id ? String(data.inspection.technician_id) : '' }); }, [data]);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data || !form) return <Spinner />;
  const { site, client, devices, company } = data;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (idx, patch) => set('checklist', form.checklist.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const done = form.status === 'wykonany';
  const faults = form.checklist.filter((c) => c.state === 'usterka').length;
  const filled = form.checklist.filter((c) => c.state).length;

  const payload = () => {
    const { site_id, type, scheduled_date, performed_date, technician_id, status, result, protocol_number, checklist, findings, recommendations } = form;
    return { id: form.id, site_id, type, scheduled_date, performed_date, technician_id: technician_id ? Number(technician_id) : null, status, result, protocol_number, checklist, findings, recommendations };
  };

  async function run(kind) {
    setBusy(kind); setMsg(null);
    try {
      if (kind === 'save') { await api('inspections.save', payload()); setMsg({ ok: true, text: 'Zapisano.' }); }
      if (kind === 'complete') {
        const p = payload();
        if (!p.performed_date) p.performed_date = todayISO();
        if (!p.result) p.result = faults ? 'pozytywny z uwagami' : 'pozytywny';
        const r = await api('inspections.complete', p);
        setMsg({ ok: true, text: r.next ? `Przegląd zamknięty. Następny zaplanowano na ${fmtDate(r.next.scheduled_date)}.` : 'Przegląd zamknięty.' });
      }
      if (kind === 'cancel') { await api('inspections.save', { ...payload(), status: 'odwołany' }); }
      if (kind === 'delete') {
        if (!confirm('Usunąć ten przegląd?')) { setBusy(null); return; }
        await api('inspections.delete', { id: form.id }); nav(`/obiekty/${site.id}?tab=przeglady`); return;
      }
      await reload();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(null);
  }

  const technician = users.data?.find((u) => String(u.id) === form.technician_id);

  return (
    <>
      <div className="print:hidden">
        <Link to={`/obiekty/${site.id}?tab=przeglady`} className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink mb-3"><ArrowLeft size={13} />{site.name}</Link>
        <PageHeader kicker={`${form.type} · ${client.name}`} title={`Protokół przeglądu${form.protocol_number ? ' ' + form.protocol_number : ''}`}>
          <Badge>{form.status}</Badge>
          <Button variant="ghost" icon={Printer} onClick={() => window.print()}>Drukuj / PDF</Button>
          {editable && <Button variant="dark" icon={Save} loading={busy === 'save'} onClick={() => run('save')}>Zapisz</Button>}
          {!done && can('inspections.complete') && <Button icon={CheckCircle2} loading={busy === 'complete'} onClick={() => run('complete')}>Zamknij przegląd</Button>}
        </PageHeader>
        {msg && <div className={`mb-4 p-3 rounded-[3px] border text-[13px] ${msg.ok ? 'border-ok/40 bg-ok/5 text-ok' : 'border-signal/40 bg-signal/5 text-signal-dark'}`}>{msg.text}</div>}

        {!editable && <div className="mb-4 p-3 rounded-[3px] border border-line bg-paper/60 text-[13px] text-muted">Tylko podgląd — Twoja rola nie ma uprawnień do edycji przeglądów.</div>}
        <fieldset disabled={!editable} className="min-w-0">
        <div className="grid lg:grid-cols-[1fr_340px] gap-4">
          <div className="flex flex-col gap-4 min-w-0">
            <Card title="Lista kontrolna" actions={<span className="font-mono text-[11.5px] text-muted">{filled}/{form.checklist.length} · usterki: <b className={faults ? 'text-signal' : ''}>{faults}</b></span>} pad={false}>
              <div className="px-4 py-2 border-b border-line flex gap-2">
                <button className="text-[12px] text-muted hover:text-ink cursor-pointer underline-offset-2 hover:underline"
                  onClick={() => set('checklist', form.checklist.map((c) => ({ ...c, state: c.state || 'ok' })))}>Oznacz pozostałe jako sprawne</button>
              </div>
              <ol>
                {form.checklist.map((c, i) => (
                  <li key={i} className={`px-4 py-3 border-b border-line/70 last:border-0 ${c.state === 'usterka' ? 'bg-signal/[0.04]' : ''}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-[11px] text-muted w-5">{String(i + 1).padStart(2, '0')}</span>
                      <span className="flex-1 min-w-48 text-[13.5px]">{c.label}</span>
                      <div className="flex">
                        {STATES.map((s) => (
                          <button key={s.v} title={s.label} onClick={() => setItem(i, { state: c.state === s.v ? '' : s.v })}
                            className={`h-8 px-2.5 border -ml-px first:ml-0 first:rounded-l-[3px] last:rounded-r-[3px] text-[12px] inline-flex items-center gap-1 cursor-pointer transition-colors ${c.state === s.v ? s.on : 'bg-white border-line text-muted hover:text-ink'}`}>
                            <s.icon size={13} /><span className="hidden sm:inline">{s.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {(c.state === 'usterka' || c.note) && (
                      <input value={c.note || ''} onChange={(e) => setItem(i, { note: e.target.value })} placeholder="Opis usterki / uwagi…"
                        className="mt-2 ml-8 w-[calc(100%-2rem)] h-8 px-2.5 bg-white border border-line rounded-[3px] text-[13px] outline-none focus:border-ink" />
                    )}
                  </li>
                ))}
              </ol>
            </Card>
            <Card title="Wnioski">
              <div className="flex flex-col gap-3">
                <Field label="Stwierdzone usterki i uwagi"><textarea rows={3} className={TEXTAREA} value={form.findings || ''} onChange={(e) => set('findings', e.target.value)} /></Field>
                <Field label="Zalecenia"><textarea rows={3} className={TEXTAREA} value={form.recommendations || ''} onChange={(e) => set('recommendations', e.target.value)} /></Field>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card title="Przegląd">
              <div className="flex flex-col gap-3">
                <Field label="Rodzaj"><Select value={form.type} onChange={(e) => set('type', e.target.value)} options={INSPECTION_TYPES} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Planowana data"><Input type="date" value={form.scheduled_date || ''} onChange={(e) => set('scheduled_date', e.target.value)} /></Field>
                  <Field label="Data wykonania"><Input type="date" value={form.performed_date || ''} onChange={(e) => set('performed_date', e.target.value)} /></Field>
                </div>
                <Field label="Technik"><Select value={form.technician_id} onChange={(e) => set('technician_id', e.target.value)} placeholder="—" options={(users.data || []).map((u) => ({ value: String(u.id), label: u.name }))} /></Field>
                <Field label="Nr protokołu" hint={!form.protocol_number ? 'Nadawany przy zamknięciu wg wzorca z Ustawień' : undefined}><Input value={form.protocol_number || ''} onChange={(e) => set('protocol_number', e.target.value)} /></Field>
                <Field label="Wynik"><Select value={form.result || ''} onChange={(e) => set('result', e.target.value)} options={INSPECTION_RESULTS} placeholder="—" /></Field>
              </div>
            </Card>
            <Card title="Obiekt">
              <KV items={[
                ['Klient', client.name],
                ['Adres', [site.address, site.city].filter(Boolean).join(', ')],
                ['Centrala', [site.panel_manufacturer, site.panel_model].filter(Boolean).join(' ')],
                ['Pętle', site.loops],
                ['Monitoring', site.monitoring ? site.monitoring_operator || 'tak' : 'brak'],
                ['Kontakt', [site.on_site_contact, site.on_site_phone].filter(Boolean).join(', ')],
              ]} />
            </Card>
            {form.status === 'zaplanowany' && (editable || can('inspections.delete')) && (
              <div className="flex gap-2">
                {editable && <Button variant="ghost" className="flex-1" loading={busy === 'cancel'} onClick={() => run('cancel')}>Odwołaj</Button>}
                {can('inspections.delete') && <Button variant="danger" icon={Trash2} loading={busy === 'delete'} onClick={() => run('delete')}>Usuń</Button>}
              </div>
            )}
          </div>
        </div>
        </fieldset>
      </div>

      {/* ---------- printable protocol ---------- */}
      <div className="hidden print:block text-[11px] leading-snug text-black">
        <CompanyHeader company={company} title="Protokół przeglądu" number={form.protocol_number} date={fmtDate(form.performed_date)} />
        <div className="flex justify-between mb-3">
          <div className="font-display text-[15px] font-bold uppercase">Przegląd systemu sygnalizacji pożarowej — {form.type}</div>
          <div>Wynik: <b>{form.result || '—'}</b></div>
        </div>
        <table className="w-full mb-3"><tbody>
          <tr><td className="w-1/2 align-top pr-4"><b>Zleceniodawca:</b><br />{client.name}<br />{[client.address, client.city].filter(Boolean).join(', ')}{client.nip && <><br />NIP {client.nip}</>}</td>
            <td className="align-top"><b>Obiekt:</b><br />{site.name}<br />{[site.address, site.city].filter(Boolean).join(', ')}</td></tr>
          <tr><td className="pt-2 pr-4 align-top"><b>Centrala SSP:</b> {[site.panel_manufacturer, site.panel_model].filter(Boolean).join(' ') || '—'}<br /><b>Typ systemu:</b> {site.system_type || '—'}, pętle: {site.loops || '—'}</td>
            <td className="pt-2 align-top"><b>Monitoring PSP:</b> {site.monitoring ? site.monitoring_operator || 'tak' : 'nie'}<br /><b>Liczba elementów:</b> {devices.reduce((a, d) => a + (d.quantity || 1), 0)}</td></tr>
        </tbody></table>
        <table className="w-full border-collapse mb-3">
          <thead><tr className="border-b border-black"><th className="text-left py-1 w-6">Lp.</th><th className="text-left py-1">Czynność kontrolna</th><th className="text-left py-1 w-20">Stan</th><th className="text-left py-1 w-1/3">Uwagi</th></tr></thead>
          <tbody>{form.checklist.map((c, i) => (
            <tr key={i} className="border-b border-gray-300"><td className="py-1">{i + 1}</td><td className="py-1">{c.label}</td><td className="py-1 font-semibold">{STATE_LABEL[c.state || '']}</td><td className="py-1">{c.note}</td></tr>
          ))}</tbody>
        </table>
        <div className="mb-2"><b>Stwierdzone usterki i uwagi:</b><div className="whitespace-pre-wrap min-h-8">{form.findings || 'brak'}</div></div>
        <div className="mb-8"><b>Zalecenia:</b><div className="whitespace-pre-wrap min-h-8">{form.recommendations || 'brak'}</div></div>
        <Signatures left={{ label: 'Wykonał', name: technician?.name }}
          right={{ label: 'Przedstawiciel użytkownika obiektu', name: site.responsible_name, sub: site.responsible_position }} />
        <CompanyFooter company={company} />
      </div>
    </>
  );
}
