import { useMemo, useRef, useState } from 'react';
import { FileInput, FileCode2, Upload, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { useApi, Modal, Button, Select, Badge, Spinner, ErrorBox } from '../ui';
import { DEVICE_TYPES, fmtDateTime } from '../format';
import { readBase64 } from '../files';

const SKIP = '__skip';

// Import system elements from a panel configuration file: pick the file → check types and target sites → import.
export default function ImportDevicesModal({ panels, panelId, fileId, onClose, onDone }) {
  const [pid, setPid] = useState(String(panelId || panels[0]?.id || ''));
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load(src) {
    setBusy(true); setError(null);
    try {
      const body = src.file ? { filename: src.file.name, data: await readBase64(src.file) } : { file_id: src.fileId };
      setPreview(await api('devices.importPreview', { panel_id: Number(pid), ...body }));
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <Modal wide title="Import elementów z pliku centrali" onClose={onClose}>
      {error && <div className="mb-4"><ErrorBox>{error}</ErrorBox></div>}
      {!preview
        ? <Source panels={panels} pid={pid} setPid={setPid} fileId={fileId} busy={busy} onLoad={load} />
        : <Preview data={preview} onBack={() => setPreview(null)} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function Source({ panels, pid, setPid, fileId, busy, onLoad }) {
  const panel = useApi(pid && 'panels.get', { id: Number(pid) });
  const files = panel.data?.files || [];
  const [choice, setChoice] = useState(fileId ? String(fileId) : '');
  const [local, setLocal] = useState(null);
  const input = useRef(null);
  const selected = choice || (files[0] && !local ? String(files[0].id) : '');

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-ink-3">
        Elementy (pętla, adres, typ, nr seryjny) i opisy stref zostaną odczytane z pliku konfiguracji. Przed importem zobaczysz podgląd i możesz poprawić typy oraz obiekty.
        Obsługiwane: <b>POLON 4900 (.ctr)</b> oraz <b>lista elementów CSV/TXT</b> z programu serwisowego (kolumny: pętla, adres, typ, opis, nr seryjny, strefa).
      </p>
      {panels.length > 1 && (
        <Select value={pid} onChange={(e) => { setPid(e.target.value); setChoice(''); }} options={panels.map((p) => ({ value: String(p.id), label: [p.name, p.manufacturer, p.model].filter(Boolean).join(' · ') }))} />
      )}
      <div className="border border-line rounded-[3px] divide-y divide-line">
        {!panel.data && pid ? <Spinner /> : files.length === 0
          ? <div className="px-3 py-3 text-[13px] text-muted">Na karcie centrali nie ma zapisanych plików konfiguracji.</div>
          : files.map((f, i) => (
            <label key={f.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-paper/50">
              <input type="radio" name="src" checked={!local && selected === String(f.id)} onChange={() => { setChoice(String(f.id)); setLocal(null); }} className="accent-signal" />
              <FileCode2 size={16} className={i === 0 ? 'text-amber' : 'text-muted'} />
              <span className="flex-1 min-w-0">
                <span className="font-medium text-[13.5px] break-all">{f.filename}</span>
                {f.version && <span className="ml-2 font-mono text-[11.5px] px-1.5 bg-paper-2 rounded-[2px]">{f.version}</span>}
                <span className="block font-mono text-[11px] text-muted">{fmtDateTime(f.created_at)} · {f.uploader_name || '—'}</span>
              </span>
              {i === 0 && <Badge tone="ok">aktualna</Badge>}
            </label>
          ))}
        <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-paper/50">
          <input type="radio" name="src" checked={!!local} onChange={() => input.current.click()} className="accent-signal" />
          <Upload size={16} className="text-muted" />
          <span className="flex-1 text-[13.5px]">{local ? <><b className="font-medium">{local.name}</b> <span className="text-muted">— plik z komputera</span></> : 'Inny plik z komputera…'}</span>
          <input ref={input} type="file" className="hidden" accept=".ctr,.csv,.txt,.tsv" onChange={(e) => { if (e.target.files[0]) { setLocal(e.target.files[0]); setChoice(''); } }} />
        </label>
      </div>
      <div className="flex justify-end">
        <Button icon={FileInput} loading={busy} disabled={!local && !selected} onClick={() => onLoad(local ? { file: local } : { fileId: Number(selected) })}>Odczytaj elementy</Button>
      </div>
    </div>
  );
}

function Preview({ data, onBack, onClose, onDone }) {
  const [types, setTypes] = useState(() => Object.fromEntries(data.codes.map((c) => [c.code, c.type])));
  const [rows, setRows] = useState(() => data.rows.map((r, i) => ({ ...r, key: i, include: true, site_id: r.site_id ? String(r.site_id) : '' })));
  const [update, setUpdate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const existing = useMemo(() => new Set(data.existing), [data.existing]);
  const exists = (r) => existing.has(`${r.site_id}:${r.loop_no}:${r.address_no}`);
  const loops = [...new Set(rows.map((r) => r.loop_no))].sort((a, b) => (a ?? 0) - (b ?? 0));
  const siteOpts = data.sites.map((x) => ({ value: String(x.id), label: x.name }));
  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.include && types[r.code] !== SKIP);
  const missingSite = chosen.filter((r) => !r.site_id).length;
  const toUpdate = chosen.filter(exists).length;

  async function run() {
    setBusy(true); setError(null);
    try {
      const r = await api('devices.import', {
        panel_id: data.panel.id, filename: data.filename, update,
        rows: chosen.map((x) => ({ site_id: Number(x.site_id), loop_no: x.loop_no, address_no: x.address_no, type: types[x.code],
          manufacturer: data.manufacturer, model: x.model, serial: x.serial, location: x.location, notes: x.notes })),
      });
      setResult(r); onDone?.();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  if (result) return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <FileInput size={28} className="text-ok" />
      <div className="font-display uppercase text-[18px] font-semibold">Import zakończony</div>
      <p className="text-[13.5px]">Dodano <b>{result.created}</b>, zaktualizowano <b>{result.updated}</b>{result.skipped ? <>, pominięto <b>{result.skipped}</b> istniejących</> : null} elementów.</p>
      <p className="text-[12.5px] text-muted">Wpis o imporcie trafił do historii centrali.</p>
      <Button onClick={onClose}>Zamknij</Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px]">
        <span><span className="text-muted">Plik:</span> <b className="font-medium">{data.filename}</b></span>
        <span><span className="text-muted">Format:</span> {data.format}</span>
        <span><span className="text-muted">Elementów:</span> <b>{data.rows.length}</b> w {loops.length} {loops.length === 1 ? 'pętli' : 'pętlach'}</span>
      </div>

      <section>
        <h3 className="font-display uppercase tracking-wider text-[13px] text-ink-3 mb-1.5">Rodzaje elementów w pliku</h3>
        <div className="border border-line rounded-[3px] divide-y divide-line">
          {data.codes.map((c) => (
            <div key={c.code} className="grid grid-cols-[70px_1fr_50px_230px] items-center gap-3 px-3 py-1.5 text-[13px]">
              <code className="font-mono text-[12px] text-muted">{c.code}</code>
              <span>{c.label}</span>
              <span className="font-mono text-right text-muted">{c.count}×</span>
              <Select value={types[c.code]} onChange={(e) => setTypes({ ...types, [c.code]: e.target.value })}
                options={[...DEVICE_TYPES.map((t) => ({ value: t, label: t })), { value: SKIP, label: '— nie importuj —' }]} />
            </div>
          ))}
        </div>
        {data.format.startsWith('POLON') && <p className="mt-1.5 text-[12px] text-muted">Rodzaj elementu odczytany z kodu w konfiguracji — sprawdź i w razie potrzeby popraw; zmiana dotyczy wszystkich elementów z tym kodem.</p>}
      </section>

      {data.sites.length > 1 && (
        <section className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
          <span className="text-muted">Obiekt dla całej pętli:</span>
          {loops.map((l) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="font-mono">L{l ?? '—'}</span>
              <Select value="" placeholder="—" options={siteOpts} className="w-36"
                onChange={(e) => e.target.value && setRows((rs) => rs.map((r) => (r.loop_no === l ? { ...r, site_id: e.target.value } : r)))} />
            </span>
          ))}
        </section>
      )}

      <div className="border border-line rounded-[3px] max-h-[46vh] overflow-auto">
        <table className="w-full text-[12.5px] border-collapse">
          <thead className="sticky top-0 bg-paper-2 z-10">
            <tr className="text-left font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
              <th className="px-2 py-1.5 w-8"><input type="checkbox" className="accent-signal" checked={rows.every((r) => r.include)} onChange={(e) => setRows((rs) => rs.map((r) => ({ ...r, include: e.target.checked })))} aria-label="Zaznacz wszystkie" /></th>
              <th className="px-2 py-1.5 w-20">Pętla/adr.</th><th className="px-2 py-1.5">Typ</th><th className="px-2 py-1.5">Lokalizacja</th>
              <th className="px-2 py-1.5 w-20">Nr ser.</th>{data.sites.length > 1 && <th className="px-2 py-1.5 w-36">Obiekt</th>}<th className="px-2 py-1.5 w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const skip = types[r.code] === SKIP;
              return (
                <tr key={r.key} className={`border-t border-line/70 ${!r.include || skip ? 'opacity-45' : ''}`}>
                  <td className="px-2 py-1"><input type="checkbox" className="accent-signal" checked={r.include} onChange={(e) => setRow(r.key, { include: e.target.checked })} /></td>
                  <td className="px-2 py-1 font-mono">L{r.loop_no ?? '—'}/{r.address_no}</td>
                  <td className="px-2 py-1">{skip ? <span className="text-muted">pominięty</span> : types[r.code]}</td>
                  <td className="px-2 py-1">{r.location || <span className="text-muted">—</span>}</td>
                  <td className="px-2 py-1 font-mono text-[11.5px]">{r.serial || '—'}</td>
                  {data.sites.length > 1 && <td className="px-2 py-1"><Select value={r.site_id} placeholder="— wybierz —" options={siteOpts} onChange={(e) => setRow(r.key, { site_id: e.target.value })} /></td>}
                  <td className="px-2 py-1 text-right">{exists(r) ? <Badge tone="warn">istnieje</Badge> : <Badge tone="ok">nowy</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <label className="flex items-start gap-2 text-[13px] cursor-pointer">
        <input type="checkbox" checked={update} onChange={(e) => setUpdate(e.target.checked)} className="mt-0.5 w-4 h-4 accent-signal" />
        <span>Aktualizuj elementy, które już są w ewidencji (ten sam obiekt, pętla i adres){toUpdate > 0 && <span className="text-muted"> — {toUpdate} takich</span>}. Status, daty i notatki wpisane ręcznie zostają.</span>
      </label>
      {missingSite > 0 && <div className="flex items-center gap-2 text-[13px] text-signal-dark"><AlertTriangle size={15} />{missingSite} zaznaczonych elementów nie ma przypisanego obiektu.</div>}
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>← Inny plik</Button>
        <Button icon={FileInput} loading={busy} disabled={!chosen.length || missingSite > 0} onClick={run}>
          Importuj {chosen.length} {chosen.length === 1 ? 'element' : chosen.length % 10 >= 2 && chosen.length % 10 <= 4 && (chosen.length % 100 < 10 || chosen.length % 100 >= 20) ? 'elementy' : 'elementów'}
        </Button>
      </div>
    </div>
  );
}
