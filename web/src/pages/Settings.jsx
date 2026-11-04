import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, Plus, Trash2, Search, Check } from 'lucide-react';
import { api } from '../api';
import { useApi, Card, PageHeader, Button, Spinner, ErrorBox, Field, Input, Select, Tabs } from '../ui';
import { DEVICE_TYPES, PANEL_MANUFACTURERS } from '../format';

const TEXTAREA = 'w-full px-2.5 py-2 bg-white border border-line rounded-[3px] text-[13.5px] outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 resize-y';

const COMPANY = [
  { name: 'name', label: 'Nazwa firmy', span: 2 },
  { name: 'address', label: 'Adres', placeholder: 'ulica i numer' },
  { name: 'city', label: 'Kod i miejscowość', placeholder: 'np. 00-950 Warszawa' },
  { name: 'nip', label: 'NIP' },
  { name: 'regon', label: 'REGON' },
  { name: 'phone', label: 'Telefon' },
  { name: 'email', label: 'E-mail' },
  { name: 'website', label: 'Strona www' },
  { name: 'certificates', label: 'Uprawnienia / certyfikaty', placeholder: 'np. certyfikat producenta, szkolenia, nr wpisu' },
  { name: 'footer', label: 'Stopka protokołów', type: 'textarea', span: 2, hint: 'Drukowana na dole protokołów przeglądów i serwisowych, np. klauzula, dane kontaktowe serwisu 24 h.' },
];
const RESETS = [{ value: 'year', label: 'od nowa co rok' }, { value: 'month', label: 'od nowa co miesiąc' }, { value: 'never', label: 'ciągła (bez zerowania)' }];
const TOKENS = [['{RRRR}', 'rok, np. 2026'], ['{RR}', 'rok, 2 cyfry'], ['{MM}', 'miesiąc'], ['{DD}', 'dzień'], ['{NR}', 'kolejny numer (wymagany)']];

// Preview of a pattern — mirrors formatNumber on the server.
function preview({ pattern, digits }, n) {
  const d = new Date().toLocaleDateString('sv-SE');
  return String(pattern || '').replaceAll('{RRRR}', d.slice(0, 4)).replaceAll('{RR}', d.slice(2, 4)).replaceAll('{MM}', d.slice(5, 7))
    .replaceAll('{DD}', d.slice(8, 10)).replaceAll('{NR}', String(Number(n) || 1).padStart(Number(digits) || 1, '0'));
}

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'firma';
  const { data, error, setData } = useApi('settings.get', {});

  return (
    <>
      <PageHeader kicker="Konfiguracja" title="Ustawienia" />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { key: 'firma', label: 'Dane firmy' },
        { key: 'numeracja', label: 'Numeracja dokumentów' },
        { key: 'slownik', label: 'Słownik elementów' },
      ]} />
      {error && tab !== 'slownik' && <ErrorBox>{error}</ErrorBox>}
      {tab === 'slownik' ? <Dictionary /> : !data ? !error && <Spinner /> : tab === 'firma' ? <CompanyForm data={data} onSaved={setData} /> : <NumberingForm data={data} onSaved={setData} />}
    </>
  );
}

function useSaver(onSaved) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  async function save(payload) {
    setBusy(true); setMsg(null);
    try { onSaved(await api('settings.save', payload)); setMsg({ ok: true, text: 'Zapisano.' }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  }
  const note = msg && <span className={`text-[13px] ${msg.ok ? 'text-ok' : 'text-signal'}`}>{msg.text}</span>;
  return { busy, save, note };
}

function CompanyForm({ data, onSaved }) {
  const [v, setV] = useState(data.company);
  const { busy, save, note } = useSaver(onSaved);
  return (
    <form onSubmit={(e) => { e.preventDefault(); save({ company: v }); }} className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
      <Card title="Dane firmy" className="reveal">
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3.5">
          {COMPANY.map((f) => (
            <Field key={f.name} label={f.label} span={f.span} hint={f.hint}>
              {f.type === 'textarea'
                ? <textarea rows={3} className={TEXTAREA} value={v[f.name] || ''} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
                : <Input value={v[f.name] || ''} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />}
            </Field>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3 mt-5">{note}<Button type="submit" icon={Save} loading={busy}>Zapisz dane firmy</Button></div>
      </Card>
      <Card title="Gdzie są używane" className="reveal">
        <p className="text-[13px] text-ink-3">Dane firmy drukują się w nagłówku <b>protokołów przeglądów</b> i <b>protokołów serwisowych</b>, a stopka — na dole każdego protokołu.</p>
      </Card>
    </form>
  );
}

function NumberingForm({ data, onSaved }) {
  const init = () => Object.fromEntries(Object.entries(data.numbering).map(([k, c]) => [k, { ...c, next: String(data.next[k].n) }]));
  const [v, setV] = useState(init);
  useEffect(() => setV(init()), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const { busy, save, note } = useSaver(onSaved);
  const set = (k, patch) => setV((s) => ({ ...s, [k]: { ...s[k], ...patch } }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); save({ numbering: Object.fromEntries(Object.entries(v).map(([k, c]) => [k, { ...c, digits: Number(c.digits), next: Number(c.next) }])) }); }}
      className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
      <div className="flex flex-col gap-4">
        {Object.entries(data.kinds).map(([k, kind]) => (
          <Card key={k} title={kind.label} className="reveal">
            <div className="grid sm:grid-cols-[1fr_110px_190px_130px] gap-x-3 gap-y-3 items-start">
              <Field label="Wzorzec"><Input value={v[k].pattern} onChange={(e) => set(k, { pattern: e.target.value })} className="font-mono" /></Field>
              <Field label="Cyfry numeru"><Select value={String(v[k].digits)} onChange={(e) => set(k, { digits: e.target.value })} options={['1', '2', '3', '4', '5', '6']} /></Field>
              <Field label="Numeracja"><Select value={v[k].reset} onChange={(e) => set(k, { reset: e.target.value })} options={RESETS} /></Field>
              <Field label="Następny numer"><Input type="number" min="1" value={v[k].next} onChange={(e) => set(k, { next: e.target.value })} className="font-mono" /></Field>
            </div>
            <div className="mt-3 flex items-baseline gap-2 text-[13px]">
              <span className="text-muted">Następny dokument otrzyma numer:</span>
              <b className="font-mono text-[15px]">{v[k].pattern?.includes('{NR}') ? preview(v[k], v[k].next) : <span className="text-signal">wzorzec musi zawierać {'{NR}'}</span>}</b>
            </div>
          </Card>
        ))}
        <div className="flex items-center justify-end gap-3">{note}<Button type="submit" icon={Save} loading={busy}>Zapisz numerację</Button></div>
      </div>
      <Card title="Znaczniki we wzorcu" className="reveal">
        <ul className="flex flex-col gap-1.5 text-[13px]">
          {TOKENS.map(([t, d]) => <li key={t} className="flex gap-3"><code className="font-mono text-[12.5px] bg-paper-2 px-1.5 rounded-[2px] w-16 shrink-0">{t}</code><span className="text-ink-3">{d}</span></li>)}
        </ul>
        <p className="mt-3 text-[12.5px] text-muted">Numer nadawany jest przy <b className="text-ink">zamknięciu przeglądu</b> i przy <b className="text-ink">wystawieniu protokołu serwisowego</b>, według daty wykonania. „Następny numer” pozwala kontynuować dotychczasową (np. papierową) numerację w bieżącym okresie. Numer wpisany ręcznie w przeglądzie zostaje zachowany.</p>
      </Card>
    </form>
  );
}

// Element dictionary: manufacturer's element code (Polon-Alfa: first two characters of the serial number) → symbol and type.
const EMPTY = { manufacturer: 'Polon-Alfa', code: '', model: '', type: '' };
const TYPE_OPTS = DEVICE_TYPES.map((t) => ({ value: t, label: t }));

function Dictionary() {
  const { data, error, reload } = useApi('dictionary.list', {});
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState(null);
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Spinner />;
  const t = search.trim().toLowerCase();
  const rows = data.filter((d) => !t || `${d.manufacturer} ${d.code} ${d.model} ${d.type}`.toLowerCase().includes(t));
  const done = (text) => { setMsg({ ok: true, text }); reload(); };
  const fail = (e) => setMsg({ ok: false, text: e.message });

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
      <Card pad={false} className="reveal" title={`Słownik elementów (${data.length})`}
        actions={<div className="relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj kodu, symbolu…" className="pl-8 w-52" /></div>}>
        {msg && <div className={`px-4 py-2 border-b border-line text-[13px] ${msg.ok ? 'text-ok' : 'text-signal'}`}>{msg.text}</div>}
        <div className="grid grid-cols-[150px_80px_1fr_220px_76px] gap-2 px-4 py-2 border-b border-line font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
          <span>Producent</span><span>Kod</span><span>Symbol</span><span>Typ elementu</span><span />
        </div>
        <DictRow key={`new-${data.length}`} row={EMPTY} isNew onSaved={(r) => done(`Dodano ${r.model}.`)} onError={fail} />
        {rows.map((d) => <DictRow key={`${d.id}-${d.code}-${d.model}-${d.type}-${d.manufacturer}`} row={d} onSaved={(r) => done(`Zapisano ${r.model}.`)} onError={fail}
          onDelete={async () => { if (!confirm(`Usunąć ${d.model} (kod ${d.code}) ze słownika?`)) return; try { await api('dictionary.delete', { id: d.id }); done(`Usunięto ${d.model}.`); } catch (e) { fail(e); } }} />)}
        {rows.length === 0 && <div className="px-4 py-4 text-[13px] text-muted">Brak pozycji pasujących do wyszukiwania.</div>}
      </Card>
      <Card title="Jak to działa" className="reveal">
        <div className="flex flex-col gap-2 text-[13px] text-ink-3">
          <p>Przy <b className="text-ink">imporcie elementów z pliku centrali</b> kod elementu jest szukany w słowniku — stąd symbol (model) i typ w ewidencji.</p>
          <p>W centralach <b className="text-ink">Polon-Alfa</b> kod to <b className="text-ink">dwa pierwsze znaki numeru seryjnego</b>, np. numer <code className="font-mono bg-paper-2 px-1">02</code>6283007801 → DOR-4046.</p>
          <p>Elementy typu <b className="text-ink">Moduł wejść/wyjść</b> dostają numer modułu zamiast strefy.</p>
          <p>Zmiany słownika nie zmieniają elementów już zapisanych w ewidencji — obowiązują przy kolejnych importach.</p>
        </div>
      </Card>
    </div>
  );
}

function DictRow({ row, isNew, onSaved, onError, onDelete }) {
  const [v, setV] = useState(row);
  const [busy, setBusy] = useState(false);
  const dirty = ['manufacturer', 'code', 'model', 'type'].some((k) => (v[k] || '') !== (row[k] || ''));
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  async function save(e) {
    e?.preventDefault();
    setBusy(true);
    try { const r = await api('dictionary.save', v); if (isNew) setV(EMPTY); onSaved(r); } catch (err) { onError(err); }
    setBusy(false);
  }
  return (
    <form onSubmit={save} className={`grid grid-cols-[150px_80px_1fr_220px_76px] gap-2 items-center px-4 py-1.5 border-b border-line/70 last:border-0 ${isNew ? 'bg-paper/60' : dirty ? 'bg-amber/5' : ''}`}>
      <Select value={v.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} options={PANEL_MANUFACTURERS} />
      <Input value={v.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder={isNew ? 'np. 02' : ''} className="font-mono" maxLength={12} />
      <Input value={v.model} onChange={(e) => set('model', e.target.value)} placeholder={isNew ? 'np. DOR-4046' : ''} className="font-mono" />
      <Select value={v.type} onChange={(e) => set('type', e.target.value)} options={TYPE_OPTS} placeholder={isNew ? '— typ —' : undefined} />
      <span className="flex justify-end gap-1">
        {isNew
          ? <Button type="submit" icon={Plus} loading={busy} disabled={!v.code || !v.model || !v.type} title="Dodaj do słownika">Dodaj</Button>
          : <>
            {dirty && <button type="submit" disabled={busy} title="Zapisz zmiany" aria-label="Zapisz zmiany" className="w-8 h-8 flex items-center justify-center rounded-[3px] bg-ink text-white cursor-pointer"><Check size={15} /></button>}
            <button type="button" onClick={onDelete} title="Usuń" aria-label="Usuń" className="w-8 h-8 flex items-center justify-center text-muted hover:text-signal cursor-pointer"><Trash2 size={15} /></button>
          </>}
      </span>
    </form>
  );
}
