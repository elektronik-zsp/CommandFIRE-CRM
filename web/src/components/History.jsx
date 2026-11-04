import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Pencil, ArrowRightLeft, MessageSquare, StickyNote, Gauge, Wrench, AlertTriangle, Hammer, RefreshCw,
  FileCode2, Trash2, Settings2, Cpu, Send, ClipboardCheck, Siren,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button, Empty, Field, Input, Select } from '../ui';
import { fmtDate, fmtDateTime, todayISO, AUTO_KINDS } from '../format';

const KIND = {
  utworzenie: { icon: Plus, label: 'Utworzenie', color: 'bg-ink-3' },
  zmiana: { icon: Pencil, label: 'Zmiana danych', color: 'bg-ink-3' },
  status: { icon: ArrowRightLeft, label: 'Zmiana statusu', color: 'bg-info' },
  'usunięcie': { icon: Trash2, label: 'Usunięcie', color: 'bg-muted' },
  komentarz: { icon: MessageSquare, label: 'Komentarz', color: 'bg-ink' },
  notatka: { icon: StickyNote, label: 'Notatka', color: 'bg-ink' },
  test: { icon: Gauge, label: 'Test / pomiar', color: 'bg-info' },
  konserwacja: { icon: Wrench, label: 'Konserwacja', color: 'bg-info' },
  serwis: { icon: Wrench, label: 'Serwis', color: 'bg-info' },
  usterka: { icon: AlertTriangle, label: 'Usterka', color: 'bg-signal' },
  naprawa: { icon: Hammer, label: 'Naprawa', color: 'bg-ok' },
  wymiana: { icon: RefreshCw, label: 'Wymiana', color: 'bg-ok' },
  plik: { icon: FileCode2, label: 'Plik konfiguracji', color: 'bg-amber' },
  'zmiana konfiguracji': { icon: Settings2, label: 'Zmiana konfiguracji', color: 'bg-amber' },
  'aktualizacja oprogramowania': { icon: Cpu, label: 'Aktualizacja oprogramowania', color: 'bg-amber' },
  // virtual rows built from inspections / tickets in the site's operating log
  'przegląd': { icon: ClipboardCheck, label: 'Przegląd', color: 'bg-ink' },
  'zgłoszenie': { icon: Siren, label: 'Zgłoszenie serwisowe', color: 'bg-signal' },
};
const ENTITY = { device: 'Element', panel: 'Centrala', ticket: 'Zgłoszenie', inspection: 'Przegląd' };
const ENTITY_ROUTE = { panel: '/centrale/', inspection: '/przeglady/' };

const short = (v) => {
  if (v == null || v === '') return '—';
  const s = /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? fmtDate(String(v)) : String(v);
  return s.length > 60 ? s.slice(0, 60) + '…' : s;
};

// When the entry was typed in the same day it describes, show the time too.
const when = (h) => (h.created_at?.slice(0, 10) === h.event_date ? fmtDateTime(h.created_at) : fmtDate(h.event_date));

/** Timeline of history entries. `showEntity` adds the subject (used in the site's operating log). */
export function HistoryList({ rows, onChanged, showEntity, onEntity, empty = 'Brak wpisów w historii' }) {
  const { user } = useAuth();
  if (!rows?.length) return <Empty>{empty}</Empty>;

  async function remove(h) {
    if (!confirm('Usunąć ten wpis z historii?')) return;
    try { await api('history.delete', { id: h.id }); onChanged?.(); } catch (e) { alert(e.message); }
  }

  return (
    <ol className="relative border-l-2 border-line ml-2">
      {rows.map((h) => {
        const k = KIND[h.kind] || KIND.notatka;
        const Icon = k.icon;
        const deletable = !h.virtual && !AUTO_KINDS.includes(h.kind) && (h.user_id === user.id || user.role === 'admin');
        const alive = h.kind !== 'usunięcie';
        return (
          <li key={h.virtual ? h.entity + h.entity_id : h.id} className="group ml-5 pb-4 last:pb-0 relative">
            <span className={`absolute -left-[29px] top-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center text-white ${k.color}`}>
              <Icon size={10} strokeWidth={2.5} />
            </span>
            <div className="flex items-center gap-2 flex-wrap font-mono text-[11.5px] text-muted">
              <span>{when(h)}</span>
              <span className="uppercase tracking-wider">{k.label}</span>
              {h.user_name && <span>· {h.user_name}</span>}
              {deletable && (
                <button onClick={() => remove(h)} className="ml-auto opacity-0 group-hover:opacity-100 text-muted hover:text-signal cursor-pointer" aria-label="Usuń wpis">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            {showEntity && h.entity_label && (
              <div className="text-[12px] text-muted">
                {ENTITY[h.entity]}:{' '}
                {ENTITY_ROUTE[h.entity] && alive ? <Link to={ENTITY_ROUTE[h.entity] + h.entity_id} className="text-ink hover:text-signal">{h.entity_label}</Link>
                  : onEntity && alive ? <button onClick={() => onEntity(h)} className="text-ink hover:text-signal cursor-pointer">{h.entity_label}</button>
                  : <span className="text-ink">{h.entity_label}</span>}
              </div>
            )}
            {h.summary && <div className="text-[13.5px] font-medium">{h.summary}</div>}
            {h.changes?.length > 0 && h.kind !== 'status' && (
              <ul className="mt-0.5 text-[12.5px] text-ink-3">
                {h.changes.map((c) => (
                  <li key={c.field}><span className="text-muted">{c.label}:</span> <s className="text-muted decoration-muted/60">{short(c.from)}</s> → <b className="font-medium">{short(c.to)}</b></li>
                ))}
              </ul>
            )}
            {h.comment && <div className="mt-1 text-[13px] whitespace-pre-wrap border-l-2 border-line pl-2.5 text-ink-2">{h.comment}</div>}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Inline form for a manual history entry.
 * kinds: [{value,label}] or strings; a single kind hides the selector.
 * extras(kind, values, set): additional inputs for a given kind.
 */
export function AddEntry({ kinds, withDate = true, extras, onSubmit, placeholder = 'Opis…', submitLabel = 'Dodaj wpis' }) {
  const opts = kinds.map((k) => (typeof k === 'string' ? { value: k, label: k[0].toUpperCase() + k.slice(1) } : k));
  const blank = { kind: opts[0].value, event_date: todayISO(), comment: '' };
  const [v, setV] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await onSubmit(v); setV({ ...blank, kind: v.kind }); }
    catch (err) { setError(err.message); }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 p-3 bg-paper/60 border border-line rounded-[3px]">
      {(opts.length > 1 || withDate) && (
        <div className="grid sm:grid-cols-[1fr_160px] gap-2.5">
          {opts.length > 1 ? <Field label="Rodzaj wpisu"><Select value={v.kind} onChange={(e) => set('kind', e.target.value)} options={opts} /></Field> : <div />}
          {withDate && <Field label="Data"><Input type="date" value={v.event_date} max={todayISO()} onChange={(e) => set('event_date', e.target.value)} required /></Field>}
        </div>
      )}
      {extras?.(v.kind, v, set)}
      <textarea value={v.comment} onChange={(e) => set('comment', e.target.value)} placeholder={placeholder} rows={2}
        className="w-full px-2.5 py-2 bg-white border border-line rounded-[3px] text-[13.5px] outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 resize-y" />
      {error && <div className="text-[12.5px] text-signal">{error}</div>}
      <div className="flex justify-end"><Button type="submit" variant="dark" icon={Send} loading={busy}>{submitLabel}</Button></div>
    </form>
  );
}
