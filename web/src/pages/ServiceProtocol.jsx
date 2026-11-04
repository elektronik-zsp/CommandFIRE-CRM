import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, FileCheck2, Printer, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useApi, Card, PageHeader, Button, Spinner, ErrorBox, Field, Input, Select, Badge, KV } from '../ui';
import { fmtDate, fmtDateTime, todayISO, SYSTEM_STATES } from '../format';
import { CompanyHeader, Signatures, CompanyFooter } from '../components/PrintParts';

const TEXTAREA = 'w-full px-2.5 py-2 bg-white border border-line rounded-[3px] text-[13.5px] outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 resize-y';
const UNITS = ['szt.', 'kpl.', 'm', 'mb', 'h'];

// Service protocol of a ticket (one per ticket): draft → issued with a number from Ustawienia → Numeracja.
export default function ServiceProtocol() {
  const { id } = useParams();
  const { can } = useAuth();
  const { data, error, reload } = useApi('protocols.get', { ticket_id: Number(id) });
  const users = useApi('users.list', {});
  const [form, setForm] = useState(null);
  const [closeTicket, setCloseTicket] = useState(true);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const editable = can('tickets.edit');

  useEffect(() => {
    if (!data) return;
    const p = data.protocol;
    setForm({
      performed_date: p?.performed_date || todayISO(),
      technician_id: String(p?.technician_id || data.ticket.assigned_to || ''),
      work_done: p?.work_done || data.ticket.resolution || '',
      parts: p?.parts?.length ? p.parts : [],
      system_state: p?.system_state || SYSTEM_STATES[0],
      recommendations: p?.recommendations || '',
      // the site's responsible person signs by default
      signer_name: p?.signer_name ?? data.site.responsible_name ?? '',
      signer_position: p?.signer_position ?? data.site.responsible_position ?? '',
    });
  }, [data]);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data || !form) return <Spinner />;
  const { protocol, ticket, site, client, panels, company } = data;
  const issued = !!protocol?.protocol_number;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setPart = (i, patch) => set('parts', form.parts.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const technician = users.data?.find((u) => String(u.id) === form.technician_id);

  async function run(kind) {
    if (kind === 'issue' && !confirm(`Wystawić protokół? Otrzyma kolejny numer z numeracji dokumentów${closeTicket && ticket.status !== 'zakończone' ? ', a zgłoszenie zostanie zakończone' : ''}.`)) return;
    setBusy(kind); setMsg(null);
    try {
      const r = await api('protocols.save', {
        ticket_id: ticket.id, ...form, technician_id: form.technician_id ? Number(form.technician_id) : null,
        ...(kind === 'issue' ? { issue: true, closeTicket } : {}),
      });
      setMsg({ ok: true, text: kind === 'issue' ? `Wystawiono protokół ${r.protocol_number}.` : 'Zapisano.' });
      await reload();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(null);
  }

  return (
    <>
      <div className="print:hidden">
        <Link to={`/zgloszenia?id=${ticket.id}`} className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink mb-3"><ArrowLeft size={13} />Zgłoszenie #{ticket.id}</Link>
        <PageHeader kicker={`${ticket.title} · ${site.name}`} title={`Protokół serwisowy${issued ? ' ' + protocol.protocol_number : ''}`}>
          <Badge tone={issued ? 'ok' : 'warn'}>{issued ? 'wystawiony' : protocol ? 'roboczy' : 'nowy'}</Badge>
          <Button variant="ghost" icon={Printer} onClick={() => window.print()}>Drukuj / PDF</Button>
          {editable && <Button variant={issued ? 'primary' : 'dark'} icon={Save} loading={busy === 'save'} onClick={() => run('save')}>Zapisz</Button>}
          {editable && !issued && <Button icon={FileCheck2} loading={busy === 'issue'} onClick={() => run('issue')}>Wystaw protokół</Button>}
        </PageHeader>
        {msg && <div className={`mb-4 p-3 rounded-[3px] border text-[13px] ${msg.ok ? 'border-ok/40 bg-ok/5 text-ok' : 'border-signal/40 bg-signal/5 text-signal-dark'}`}>{msg.text}</div>}
        {!editable && <div className="mb-4 p-3 rounded-[3px] border border-line bg-paper/60 text-[13px] text-muted">Tylko podgląd — Twoja rola nie ma uprawnień do edycji zgłoszeń.</div>}

        <fieldset disabled={!editable} className="min-w-0">
          <div className="grid lg:grid-cols-[1fr_340px] gap-4">
            <div className="flex flex-col gap-4 min-w-0">
              <Card title="Zgłoszenie">
                <KV items={[
                  ['Zgłoszenie', `#${ticket.id} ${ticket.title}`],
                  ['Zgłoszono', `${fmtDateTime(ticket.reported_at)}${ticket.reported_by ? ' · ' + ticket.reported_by : ''}`],
                  ['Rodzaj', `${ticket.category} · priorytet ${ticket.priority}`],
                  ['Opis', ticket.description && <span className="whitespace-pre-wrap">{ticket.description}</span>],
                ]} />
              </Card>
              <Card title="Wykonane prace">
                <textarea rows={6} className={TEXTAREA} value={form.work_done} onChange={(e) => set('work_done', e.target.value)}
                  placeholder="Co zostało stwierdzone i wykonane — diagnoza, naprawa, wymienione elementy, testy po naprawie…" />
              </Card>
              <Card title="Użyte materiały i części" pad={false}
                actions={editable && <Button variant="ghost" icon={Plus} onClick={() => set('parts', [...form.parts, { name: '', qty: '1', unit: 'szt.' }])}>Dodaj pozycję</Button>}>
                {form.parts.length === 0 ? <div className="px-4 py-4 text-[13px] text-muted">Brak — dodaj pozycję, jeśli użyto materiałów lub wymieniono elementy.</div> : (
                  <ul>
                    {form.parts.map((x, i) => (
                      <li key={i} className="flex items-center gap-2 px-4 py-2 border-b border-line/70 last:border-0">
                        <span className="font-mono text-[11px] text-muted w-5">{i + 1}.</span>
                        <Input value={x.name} onChange={(e) => setPart(i, { name: e.target.value })} placeholder="np. czujka optyczna DOR-4046" className="flex-1" />
                        <Input value={x.qty} onChange={(e) => setPart(i, { qty: e.target.value })} className="w-20 text-right" inputMode="decimal" aria-label="Ilość" />
                        <Select value={x.unit} onChange={(e) => setPart(i, { unit: e.target.value })} options={UNITS} className="w-24" aria-label="Jednostka" />
                        <button type="button" onClick={() => set('parts', form.parts.filter((_, j) => j !== i))} className="w-8 h-8 flex items-center justify-center text-muted hover:text-signal cursor-pointer" aria-label="Usuń pozycję"><Trash2 size={15} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Stan systemu i zalecenia">
                <div className="flex flex-col gap-3">
                  <Field label="Stan systemu po pracach"><Select value={form.system_state} onChange={(e) => set('system_state', e.target.value)} options={SYSTEM_STATES} /></Field>
                  <Field label="Zalecenia / uwagi"><textarea rows={3} className={TEXTAREA} value={form.recommendations} onChange={(e) => set('recommendations', e.target.value)} /></Field>
                </div>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card title="Protokół">
                <div className="flex flex-col gap-3">
                  <Field label="Nr protokołu" hint={issued ? `Wystawiony ${fmtDateTime(protocol.issued_at)}` : 'Nadawany przy wystawieniu wg wzorca z Ustawień'}>
                    <Input value={protocol?.protocol_number || ''} disabled placeholder="—" />
                  </Field>
                  <Field label="Data wykonania prac"><Input type="date" value={form.performed_date || ''} onChange={(e) => set('performed_date', e.target.value)} /></Field>
                  <Field label="Wykonał"><Select value={form.technician_id} onChange={(e) => set('technician_id', e.target.value)} placeholder="—" options={(users.data || []).map((u) => ({ value: String(u.id), label: u.name }))} /></Field>
                  {!issued && ticket.status !== 'zakończone' && (
                    <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                      <input type="checkbox" checked={closeTicket} onChange={(e) => setCloseTicket(e.target.checked)} className="w-4 h-4 accent-signal" />
                      Po wystawieniu zakończ zgłoszenie
                    </label>
                  )}
                </div>
              </Card>
              <Card title="Podpis ze strony obiektu">
                <div className="flex flex-col gap-3">
                  <Field label="Imię i nazwisko"><Input value={form.signer_name} onChange={(e) => set('signer_name', e.target.value)} /></Field>
                  <Field label="Stanowisko / funkcja"><Input value={form.signer_position} onChange={(e) => set('signer_position', e.target.value)} /></Field>
                  {!site.responsible_name && <p className="text-[12px] text-muted">Obiekt nie ma wskazanej osoby odpowiedzialnej — można ją dodać w <Link className="underline" to={`/obiekty/${site.id}`}>edycji obiektu</Link>.</p>}
                </div>
              </Card>
              <Card title="Obiekt">
                <KV items={[
                  ['Klient', client.name],
                  ['Obiekt', site.name],
                  ['Adres', [site.address, site.city].filter(Boolean).join(', ')],
                  ['Centrala', panels?.length ? panels.map((p) => [p.name, p.manufacturer, p.model].filter(Boolean).join(' ')).join(', ') : [site.panel_manufacturer, site.panel_model].filter(Boolean).join(' ')],
                ]} />
              </Card>
            </div>
          </div>
        </fieldset>
      </div>

      {/* ---------- printable protocol ---------- */}
      <div className="hidden print:block text-[11px] leading-snug text-black">
        <CompanyHeader company={company} title="Protokół serwisowy" number={protocol?.protocol_number || 'roboczy'} date={fmtDate(form.performed_date)} />
        <table className="w-full mb-3"><tbody>
          <tr>
            <td className="w-1/2 align-top pr-4"><b>Zleceniodawca:</b><br />{client.name}<br />{[client.address, client.city].filter(Boolean).join(', ')}{client.nip && <><br />NIP {client.nip}</>}</td>
            <td className="align-top"><b>Obiekt:</b><br />{site.name}<br />{[site.address, site.city].filter(Boolean).join(', ')}</td>
          </tr>
          <tr>
            <td className="pt-2 pr-4 align-top"><b>Centrala SSP:</b> {panels?.length ? panels.map((p) => [p.manufacturer, p.model].filter(Boolean).join(' ') || p.name).join(', ') : [site.panel_manufacturer, site.panel_model].filter(Boolean).join(' ') || '—'}</td>
            <td className="pt-2 align-top"><b>Zgłoszenie:</b> #{ticket.id} z {fmtDateTime(ticket.reported_at)} ({ticket.category})</td>
          </tr>
        </tbody></table>
        <Section title="Przedmiot zgłoszenia">{ticket.title}{ticket.description ? ` — ${ticket.description}` : ''}</Section>
        <Section title="Wykonane prace">{form.work_done || '—'}</Section>
        {form.parts.filter((x) => x.name?.trim()).length > 0 && (
          <div className="mb-2">
            <b>Użyte materiały i części:</b>
            <table className="w-full border-collapse mt-1">
              <thead><tr className="border-b border-black"><th className="text-left py-0.5 w-6">Lp.</th><th className="text-left py-0.5">Nazwa</th><th className="text-right py-0.5 w-24">Ilość</th></tr></thead>
              <tbody>{form.parts.filter((x) => x.name?.trim()).map((x, i) => (
                <tr key={i} className="border-b border-gray-300"><td className="py-0.5">{i + 1}</td><td className="py-0.5">{x.name}</td><td className="py-0.5 text-right">{x.qty} {x.unit}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="mb-2"><b>Stan systemu po wykonaniu prac:</b> {form.system_state}</div>
        <Section title="Zalecenia / uwagi">{form.recommendations || 'brak'}</Section>
        <Signatures left={{ label: 'Wykonał', name: technician?.name }} right={{ label: 'Za obiekt (odbiór prac)', name: form.signer_name, sub: form.signer_position }} />
        <CompanyFooter company={company} />
      </div>
    </>
  );
}

function Section({ title, children }) {
  return <div className="mb-2"><b>{title}:</b><div className="whitespace-pre-wrap">{children}</div></div>;
}
