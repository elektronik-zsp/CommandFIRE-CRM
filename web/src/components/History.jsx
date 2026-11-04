import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Plus, Pencil, ArrowRightLeft, MessageSquare, StickyNote, Gauge, Wrench, AlertTriangle, Hammer, RefreshCw,
  FileCode2, Trash2, Settings2, Cpu, Send, ClipboardCheck, Siren, Camera, X, ChevronLeft, ChevronRight, Loader2, ExternalLink,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button, Empty, Field, Input, Select } from '../ui';
import { fmtDate, fmtDateTime, todayISO, AUTO_KINDS } from '../format';
import { preparePhoto, MAX_PHOTOS, MAX_PHOTO_BYTES } from '../photos';

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
  const { user, can } = useAuth();
  const [viewer, setViewer] = useState(null); // { photos, index }
  if (!rows?.length) return <Empty>{empty}</Empty>;

  async function remove(h) {
    if (!confirm('Usunąć ten wpis z historii?')) return;
    try { await api('history.delete', { id: h.id }); onChanged?.(); } catch (e) { alert(e.message); }
  }

  return (
    <>
    <ol className="relative border-l-2 border-line ml-2">
      {rows.map((h) => {
        const k = KIND[h.kind] || KIND.notatka;
        const Icon = k.icon;
        const deletable = !h.virtual && !AUTO_KINDS.includes(h.kind) && (h.user_id === user.id ? can('history.add') : can('history.delete'));
        const alive = h.kind !== 'usunięcie';
        const changes = (h.changes || []).filter((c) => h.kind !== 'status' || c.field !== 'status'); // status is in the summary
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
            {changes.length > 0 && (
              <ul className="mt-0.5 text-[12.5px] text-ink-3">
                {changes.map((c) => (
                  <li key={c.field}><span className="text-muted">{c.label}:</span> <s className="text-muted decoration-muted/60">{short(c.from)}</s> → <b className="font-medium">{short(c.to)}</b></li>
                ))}
              </ul>
            )}
            {h.comment && <div className="mt-1 text-[13px] whitespace-pre-wrap border-l-2 border-line pl-2.5 text-ink-2">{h.comment}</div>}
            {h.photos?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {h.photos.map((ph, i) => (
                  <button key={ph.id} onClick={() => setViewer({ photos: h.photos, index: i })} className="block w-[72px] h-[72px] rounded-[2px] overflow-hidden border border-line hover:border-ink cursor-zoom-in bg-paper-2">
                    <img src={ph.thumb} alt={ph.filename || 'zdjęcie'} loading="lazy" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
    {viewer && <PhotoViewer {...viewer} onClose={() => setViewer(null)} />}
    </>
  );
}

/** Full-screen photo viewer with keyboard navigation. */
export function PhotoViewer({ photos, index: start = 0, onClose }) {
  const [i, setI] = useState(start);
  const ph = photos[i];
  const go = (d) => setI((x) => (x + d + photos.length) % photos.length);
  useEffect(() => {
    // capture phase + stopImmediatePropagation: Esc closes only the viewer, not the modal underneath
    const k = (e) => {
      if (!['Escape', 'ArrowRight', 'ArrowLeft'].includes(e.key)) return;
      e.stopImmediatePropagation();
      if (e.key === 'Escape') onClose();
      else go(e.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  });
  const nav = 'absolute top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 cursor-pointer';
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-ink/95 flex flex-col" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex items-center justify-between gap-3 px-4 h-12 text-white/80 font-mono text-[12px]">
        <span className="truncate">{i + 1} / {photos.length}{ph.filename ? ` · ${ph.filename}` : ''}</span>
        <span className="flex items-center gap-1">
          <a href={ph.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2 h-8 hover:text-white"><ExternalLink size={14} />Oryginał</a>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:text-white cursor-pointer" aria-label="Zamknij"><X size={18} /></button>
        </span>
      </div>
      <div className="relative flex-1 flex items-center justify-center p-4 min-h-0" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <img key={ph.id} src={ph.url} alt={ph.filename || 'zdjęcie'} className="reveal max-w-full max-h-full object-contain shadow-2xl" />
        {photos.length > 1 && <>
          <button onClick={() => go(-1)} className={`${nav} left-4`} aria-label="Poprzednie"><ChevronLeft size={22} /></button>
          <button onClick={() => go(1)} className={`${nav} right-4`} aria-label="Następne"><ChevronRight size={22} /></button>
        </>}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Inline form for a manual history entry.
 * kinds: [{value,label}] or strings; a single kind hides the selector.
 * extras(kind, values, set): additional inputs for a given kind.
 */
export function AddEntry({ kinds, withDate = true, extras, onSubmit, photos: withPhotos, placeholder = 'Opis…', submitLabel = 'Dodaj wpis' }) {
  const opts = kinds.map((k) => (typeof k === 'string' ? { value: k, label: k[0].toUpperCase() + k.slice(1) } : k));
  const blank = { kind: opts[0].value, event_date: todayISO(), comment: '', photos: [] };
  const [v, setV] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState(null);
  const fileInput = useRef(null);
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));

  async function addFiles(files) {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setError(null);
    if (v.photos.length + images.length > MAX_PHOTOS) { setError(`Maksymalnie ${MAX_PHOTOS} zdjęć w jednym wpisie.`); return; }
    setPreparing(true);
    try {
      const ready = [];
      for (const f of images) ready.push(await preparePhoto(f));
      const all = [...v.photos, ...ready];
      if (all.reduce((a, p) => a + p.bytes, 0) > MAX_PHOTO_BYTES) throw new Error('Zdjęcia są za duże na jeden wpis — dodaj część w kolejnym wpisie.');
      set('photos', all);
    } catch (err) { setError(err.message); }
    setPreparing(false);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await onSubmit({ ...v, photos: v.photos.map(({ preview, bytes, ...p }) => p) });
      setV({ ...blank, kind: v.kind });
    } catch (err) { setError(err.message); }
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
        onPaste={withPhotos ? (e) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); } } : undefined}
        className="w-full px-2.5 py-2 bg-white border border-line rounded-[3px] text-[13.5px] outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 resize-y" />
      {withPhotos && (v.photos.length > 0 || preparing) && (
        <div className="flex flex-wrap gap-1.5">
          {v.photos.map((p, i) => (
            <div key={i} className="relative w-[72px] h-[72px] rounded-[2px] overflow-hidden border border-line">
              <img src={p.preview} alt={p.filename} className="w-full h-full object-cover" />
              <button type="button" onClick={() => set('photos', v.photos.filter((_, j) => j !== i))} aria-label="Usuń zdjęcie"
                className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-ink/80 text-white hover:bg-signal cursor-pointer"><X size={12} /></button>
            </div>
          ))}
          {preparing && <div className="w-[72px] h-[72px] flex items-center justify-center border border-dashed border-line text-muted"><Loader2 size={18} className="animate-spin" /></div>}
        </div>
      )}
      {error && <div className="text-[12.5px] text-signal">{error}</div>}
      <div className="flex items-center justify-between gap-2">
        {withPhotos ? (
          <>
            <Button type="button" variant="ghost" icon={Camera} onClick={() => fileInput.current.click()} disabled={preparing || v.photos.length >= MAX_PHOTOS}>
              Zdjęcia{v.photos.length > 0 && <span className="font-mono text-[11px] text-muted">{v.photos.length}/{MAX_PHOTOS}</span>}
            </Button>
            <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </>
        ) : <span />}
        <Button type="submit" variant="dark" icon={Send} loading={busy} disabled={preparing}>{submitLabel}</Button>
      </div>
    </form>
  );
}
