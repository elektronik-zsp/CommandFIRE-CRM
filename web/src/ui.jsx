import { useEffect, useState, useCallback } from 'react';
import { X, Loader2, AlertTriangle, Inbox } from 'lucide-react';
import { TONES } from './format';
import { api } from './api';

// ---------- data hook ----------
export function useApi(action, params, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(params || {});
  const reload = useCallback(() => {
    setLoading(true);
    return api(action, params)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, key, ...deps]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

// ---------- primitives ----------
const BTN = {
  primary: 'bg-signal text-white hover:bg-signal-dark',
  dark: 'bg-ink text-white hover:bg-ink-3',
  ghost: 'bg-transparent text-ink hover:bg-paper-2 border border-line',
  danger: 'bg-transparent text-signal hover:bg-signal/10 border border-signal/40',
};
export function Button({ variant = 'primary', icon: Icon, children, className = '', loading, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-[3px] text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${BTN[variant]} ${className}`}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : Icon && <Icon size={15} strokeWidth={2} />}
      {children}
    </button>
  );
}

const BADGE = {
  danger: 'bg-signal/10 text-signal-dark border-signal/30',
  warn: 'bg-amber/15 text-[#8a5f00] border-amber/40',
  ok: 'bg-ok/10 text-ok border-ok/30',
  info: 'bg-info/10 text-info border-info/30',
  muted: 'bg-paper-2 text-muted border-line',
};
export function Badge({ tone, children, dot }) {
  const t = tone || TONES[children] || 'muted';
  return (
    <span className={`inline-flex items-center gap-1.5 px-1.5 py-[1px] rounded-[2px] border text-[11px] font-medium uppercase tracking-wide whitespace-nowrap ${BADGE[t]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${t === 'danger' ? 'bg-signal pulse-dot' : t === 'warn' ? 'bg-amber' : t === 'ok' ? 'bg-ok' : 'bg-muted'}`} />}
      {children}
    </span>
  );
}

export function Card({ title, actions, children, className = '', pad = true }) {
  return (
    <section className={`bg-white border border-line rounded-[3px] ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 h-11 border-b border-line">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ kicker, title, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6 reveal">
      <div>
        {kicker && <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal mb-1">{kicker}</div>}
        <h1 className="text-[34px] leading-none font-bold">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Spinner() {
  return <div className="flex items-center justify-center py-16 text-muted"><Loader2 className="animate-spin" /></div>;
}
export function ErrorBox({ children }) {
  return <div className="flex items-start gap-2 p-3 border border-signal/40 bg-signal/5 text-signal-dark rounded-[3px]"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{children}</div>;
}
export function Empty({ children, icon: Icon = Inbox }) {
  return <div className="flex flex-col items-center gap-2 py-10 text-muted text-center"><Icon size={22} strokeWidth={1.5} />{children}</div>;
}

export function Table({ columns, rows, onRow, empty = 'Brak danych' }) {
  if (!rows?.length) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted font-normal whitespace-nowrap ${c.className || ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} onClick={onRow ? () => onRow(r) : undefined}
              className={`border-b border-line/70 last:border-0 ${onRow ? 'cursor-pointer hover:bg-paper/70' : ''}`}>
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-2.5 align-middle ${c.className || ''}`}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 sm:p-10" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`reveal w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} bg-white rounded-[3px] shadow-2xl`}>
        <div className="hazard h-1 rounded-t-[3px]" />
        <header className="flex items-center justify-between px-5 h-12 border-b border-line">
          <h2 className="text-[19px] font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 text-muted hover:text-ink cursor-pointer" aria-label="Zamknij"><X size={18} /></button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ---------- forms ----------
const INPUT = 'h-9 px-2.5 bg-white border border-line rounded-[3px] text-[13.5px] outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 transition';

const width = (c = '') => (/(^|\s)w-/.test(c) ? c : `w-full ${c}`);
export function Input(props) { return <input {...props} className={`${INPUT} ${width(props.className)}`} />; }
export function Select({ options, placeholder, ...props }) {
  return (
    <select {...props} className={`${INPUT} pr-7 ${width(props.className)}`}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => typeof o === 'object'
        ? <option key={o.value} value={o.value}>{o.label}</option>
        : <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function Field({ label, children, span, hint }) {
  return (
    <label className={`flex flex-col gap-1 ${span === 2 ? 'sm:col-span-2' : ''}`}>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-muted">{hint}</span>}
    </label>
  );
}

/**
 * Generic record form in a modal.
 * fields: [{ name, label, type, options, required, span, placeholder, hint }]
 */
export function FormModal({ title, onClose, wide, ...props }) {
  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <RecordForm {...props} onClose={onClose} />
    </Modal>
  );
}

// The form body of FormModal, usable inside other layouts (e.g. a tabbed modal).
export function RecordForm({ fields, initial = {}, onSubmit, onClose, onDelete, submitLabel = 'Zapisz' }) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await onSubmit(values); onClose(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!confirm('Na pewno usunąć? Tej operacji nie można cofnąć.')) return;
    setBusy(true);
    try { await onDelete(); onClose(); } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
        {fields.map((f) => {
          if (f.section) return <div key={f.section} className="sm:col-span-2 pt-2 mt-1 border-t border-line font-display uppercase tracking-wider text-[13px] text-ink-3">{f.section}</div>;
          const v = values[f.name] ?? '';
          const common = { value: v, required: f.required, placeholder: f.placeholder, onChange: (e) => set(f.name, e.target.value) };
          let input;
          if (f.type === 'textarea') input = <textarea {...common} rows={f.rows || 3} className={`${INPUT} w-full h-auto py-2 resize-y`} />;
          else if (f.type === 'select') input = <Select {...common} options={f.options} placeholder={f.required ? undefined : '—'} />;
          else if (f.type === 'checkboxes') {
            const sel = (values[f.name] || []).map(String);
            const toggle = (val) => set(f.name, sel.includes(val) ? sel.filter((x) => x !== val) : [...sel, val]);
            input = f.options.length === 0 ? <span className="text-[13px] text-muted h-9 flex items-center">{f.empty || 'Brak pozycji do wyboru'}</span> : (
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 p-2.5 border border-line rounded-[3px] bg-paper/40">
                {f.options.map((o) => (
                  <label key={o.value} className="flex items-start gap-2 text-[13px] cursor-pointer">
                    <input type="checkbox" checked={sel.includes(String(o.value))} onChange={() => toggle(String(o.value))} className="mt-0.5 w-4 h-4 accent-signal shrink-0" />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            );
          }
          else if (f.type === 'checkbox') input = (
            <span className="flex items-center gap-2 h-9">
              <input type="checkbox" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} className="w-4 h-4 accent-signal" />
              <span className="text-[13px]">{f.checkLabel || 'Tak'}</span>
            </span>
          );
          else input = <Input type={f.type || 'text'} {...common} list={f.list ? `${f.name}-list` : undefined} />;
          return (
            <Field key={f.name} label={f.label + (f.required ? ' *' : '')} span={f.span} hint={f.hint}>
              {input}
              {f.list && <datalist id={`${f.name}-list`}>{f.list.map((o) => <option key={o} value={o} />)}</datalist>}
            </Field>
          );
        })}
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div>{onDelete && <Button type="button" variant="danger" onClick={remove} disabled={busy}>Usuń</Button>}</div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button type="submit" loading={busy}>{submitLabel}</Button>
        </div>
      </div>
    </form>
  );
}

export function Stat({ label, value, tone, sub, delay = 0 }) {
  const color = tone === 'danger' ? 'text-signal' : tone === 'warn' ? 'text-[#a87600]' : 'text-ink';
  return (
    <div className="reveal bg-white border border-line rounded-[3px] px-4 py-3.5 relative overflow-hidden" style={{ animationDelay: `${delay}ms` }}>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={`font-display text-[42px] leading-[1.05] font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[12px] text-muted">{sub}</div>}
      {tone === 'danger' && value > 0 && <div className="absolute top-0 right-0 w-1 h-full bg-signal" />}
    </div>
  );
}

export function KV({ items }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 text-[13.5px]">
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted pt-[3px]">{k}</dt>
          <dd className="min-w-0 break-words">{v || v === 0 ? v : '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-line mb-4 overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`px-3 h-10 -mb-px border-b-2 text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors ${value === t.key ? 'border-signal text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
          {t.label}{t.count != null && <span className="ml-1.5 font-mono text-[11px] text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
