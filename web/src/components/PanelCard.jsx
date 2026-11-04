import { Link, useNavigate } from 'react-router-dom';
import { CircuitBoard, FileCode2, ChevronRight, Unlink } from 'lucide-react';
import { fmtDate } from '../format';

// Panel tile used on the site page. `siteId` = the site being viewed (its own name is omitted from "serves").
export default function PanelCard({ panel: p, siteId, onUnlink }) {
  const nav = useNavigate();
  const others = (p.sites || []).filter((s) => s.id !== siteId);
  const stop = (e) => e.stopPropagation();
  return (
    <div role="link" tabIndex={0} onClick={() => nav(`/centrale/${p.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/centrale/${p.id}`)}
      className="reveal group grid sm:grid-cols-[auto_1fr_auto] items-center gap-4 bg-white border border-line rounded-[3px] px-4 py-3.5 hover:border-ink transition-colors cursor-pointer">
      <span className="w-11 h-11 flex items-center justify-center bg-ink text-white rounded-[3px]"><CircuitBoard size={20} /></span>
      <div className="min-w-0">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">{p.name}{p.location ? ` · ${p.location}` : ''}</div>
        <div className="font-display text-[22px] font-semibold leading-tight">{[p.manufacturer, p.model].filter(Boolean).join(' ') || <span className="text-muted text-[15px] font-sans font-normal">Producent i model nieuzupełnione — uzupełnij w karcie centrali</span>}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-ink-3 font-mono">
          <span>SN {p.serial || '—'}</span><span>FW {p.firmware || '—'}</span><span>{p.loops ?? '—'} pętli / {p.zones ?? '—'} stref</span>
        </div>
        {others.length > 0 && (
          <div className="mt-1 text-[12.5px] text-ink-3">
            <span className="text-muted">Obsługuje także: </span>
            {others.map((s, i) => (
              <span key={s.id}>{i > 0 && ', '}<Link to={`/obiekty/${s.id}?tab=centrala`} onClick={stop} className="text-ink hover:text-signal underline decoration-line underline-offset-2">{s.name}</Link></span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 text-[12.5px] ${p.file_count ? 'text-ink' : 'text-signal'}`}>
          <FileCode2 size={15} />{p.file_count ? `${p.file_count} pl. konfiguracji · ${fmtDate(p.last_file_at)}` : 'brak pliku konfiguracji'}
        </span>
        {onUnlink && (
          <button onClick={(e) => { stop(e); onUnlink(p); }} title="Odłącz od tego obiektu" aria-label="Odłącz od tego obiektu"
            className="w-8 h-8 flex items-center justify-center rounded-[3px] text-muted hover:text-signal hover:bg-signal/10 cursor-pointer"><Unlink size={15} /></button>
        )}
        <ChevronRight size={18} className="text-muted group-hover:text-signal" />
      </div>
    </div>
  );
}
