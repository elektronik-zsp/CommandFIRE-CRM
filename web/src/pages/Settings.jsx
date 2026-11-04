import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { api } from '../api';
import { useApi, Card, PageHeader, Button, Spinner, ErrorBox, Field, Input, Select, Tabs } from '../ui';

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
      ]} />
      {error && <ErrorBox>{error}</ErrorBox>}
      {!data ? !error && <Spinner /> : tab === 'firma' ? <CompanyForm data={data} onSaved={setData} /> : <NumberingForm data={data} onSaved={setData} />}
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
