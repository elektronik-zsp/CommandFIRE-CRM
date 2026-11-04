import { useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Printer, Upload, Download, Trash2, FileCode2, CircuitBoard, Building2, ChevronRight, FileInput } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useApi, Card, PageHeader, Button, Spinner, ErrorBox, KV, Badge, Field, Input, Empty } from '../ui';
import { fmtDate, fmtDateTime, fmtSize, daysUntil, relDays, dueTone, PANEL_EVENT_KINDS } from '../format';
import PanelModal from '../components/PanelModal';
import ImportDevicesModal from '../components/ImportDevicesModal';
import { readBase64 } from '../files';
import { HistoryList, AddEntry } from '../components/History';

const MAX_FILE = 4 * 1024 * 1024;


export default function PanelDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, can } = useAuth();
  const { data, error, reload } = useApi('panels.get', { id: Number(id) });
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(null); // { fileId? }
  const canImport = can('devices.edit') && can('configs.download');

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Spinner />;
  const { panel, client, sites, clientSites, files, history } = data;

  return (
    <>
      <Link to={`/klienci/${client.id}`} className="no-print inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink mb-3"><ArrowLeft size={13} />{client.name}</Link>
      <PageHeader kicker={`Karta centrali · ${client.name}`} title={[panel.manufacturer, panel.model].filter(Boolean).join(' ') || panel.name}>
        <span className="no-print flex gap-2">
          <Button variant="ghost" icon={Printer} onClick={() => window.print()}>Drukuj kartę</Button>
          {canImport && files.length > 0 && <Button variant="ghost" icon={FileInput} onClick={() => setImporting({})}>Importuj elementy</Button>}
          {can('panels.edit') && <Button variant="dark" icon={Pencil} onClick={() => setEditing(true)}>Edytuj</Button>}
        </span>
      </PageHeader>

      <div className="grid lg:grid-cols-[1fr_400px] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <Card title={<span className="flex items-center gap-2"><CircuitBoard size={16} />{panel.name}</span>} className="reveal">
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
              <Group title="Identyfikacja" items={[
                ['Producent', panel.manufacturer],
                ['Model', panel.model],
                ['Nr seryjny', panel.serial && <span className="font-mono">{panel.serial}</span>],
                ['Lokalizacja', panel.location],
                ['Uruchomiona', fmtDate(panel.installed_at)],
                ['Instalator', panel.installer],
              ]} />
              <Group title="Konfiguracja" items={[
                ['Firmware', panel.firmware && <span className="font-mono">{panel.firmware}</span>],
                ['Program serwisowy', panel.software_tool],
                ['Pętle / strefy', `${panel.loops ?? '—'} / ${panel.zones ?? '—'}`],
                ['Adres sieciowy', panel.network_address && <span className="font-mono">{panel.network_address}</span>],
                ['Transmisja', panel.transmission],
              ]} />
              <Group title="Zasilanie" items={[
                ['Zasilacz', panel.power_supply],
                ['Akumulatory', panel.batteries],
              ]} />
              <Group title="Serwis" items={[
                ...(can('panels.access') ? [['Dostęp', panel.service_access && <span className="whitespace-pre-wrap">{panel.service_access}</span>]] : []),
                ['Uwagi', panel.notes && <span className="whitespace-pre-wrap">{panel.notes}</span>],
              ]} />
            </div>
          </Card>

          <Card title={<span className="flex items-center gap-2"><Building2 size={16} />Obsługiwane obiekty</span>} pad={false} className="reveal"
            actions={<span className="font-mono text-[11.5px] text-muted">{sites.length} z {clientSites.length} obiektów klienta</span>}>
            {sites.length === 0 ? (
              <Empty icon={Building2}>
                <span>Centrala nie jest przypisana do żadnego obiektu.</span>
                {can('panels.edit') && <Button variant="ghost" icon={Pencil} className="mt-2 no-print" onClick={() => setEditing(true)}>Wybierz obiekty</Button>}
              </Empty>
            ) : (
              <ul>
                {sites.map((s) => {
                  const n = daysUntil(s.next_due);
                  return (
                    <li key={s.id} className="border-b border-line/70 last:border-0">
                      <Link to={`/obiekty/${s.id}`} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-paper/70">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-[13.5px]">{s.name}</div>
                          <div className="text-[12px] text-muted">{[s.address, s.city].filter(Boolean).join(', ') || '—'} · {s.device_count} el.</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">Przegląd</div>
                          {s.next_due ? <Badge tone={dueTone(n)} dot={n < 0}>{fmtDate(s.next_due)} · {relDays(n)}</Badge> : <span className="text-[12px] text-muted">nie zaplanowano</span>}
                        </div>
                        <ChevronRight size={16} className="text-muted group-hover:text-signal no-print" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {(can('configs.download') || can('configs.upload')) && <ConfigFiles panel={panel} files={files} user={user} can={can} onChanged={reload} onImport={canImport ? (f) => setImporting({ fileId: f.id }) : undefined} />}
        </div>

        <Card title="Historia centrali" className="reveal">
          <div className="flex flex-col gap-4">
            {can('history.add') && <div className="no-print">
              <AddEntry kinds={PANEL_EVENT_KINDS} placeholder="Np. zmiana opisów stref, aktualizacja do v5.2, wymiana płyty…"
                onSubmit={async (v) => { await api('history.add', { entity: 'panel', entity_id: panel.id, ...v }); reload(); }} />
            </div>}
            <HistoryList rows={history} onChanged={reload} />
          </div>
        </Card>
      </div>

      {importing && <ImportDevicesModal panels={[panel]} panelId={panel.id} fileId={importing.fileId} onClose={() => setImporting(null)} onDone={reload} />}
      {editing && (
        <PanelModal panel={{ ...panel, sites }} sites={clientSites} onClose={() => setEditing(false)} onSaved={reload}
          onDelete={can('panels.delete') ? async () => { await api('panels.delete', { id: panel.id }); nav(`/klienci/${client.id}`); } : undefined} />
      )}
    </>
  );
}

function Group({ title, items }) {
  return (
    <div>
      <div className="font-display uppercase tracking-wider text-[13px] text-ink-3 mb-2 pb-1 border-b border-line">{title}</div>
      <KV items={items} />
    </div>
  );
}

function ConfigFiles({ panel, files, user, can, onChanged, onImport }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState({ version: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [drag, setDrag] = useState(false);

  function pick(f) {
    setMsg(null);
    if (!f) return;
    if (f.size > MAX_FILE) { setMsg({ ok: false, text: `Plik ${f.name} ma ${fmtSize(f.size)} — limit to 4 MB. Spakuj go do ZIP.` }); return; }
    setFile(f);
    setMeta({ version: panel.firmware ? `fw ${panel.firmware}` : '', description: '' });
  }

  async function upload() {
    setBusy(true); setMsg(null);
    try {
      const r = await api('panels.upload', { panel_id: panel.id, filename: file.name, mime: file.type, data: await readBase64(file), ...meta });
      setMsg(r.same
        ? { ok: true, text: `Zapisano. Uwaga: zawartość jest identyczna z plikiem „${r.same.filename}” z ${fmtDate(r.same.created_at)}.` }
        : { ok: true, text: 'Plik konfiguracji zapisany.' });
      setFile(null); input.current.value = '';
      onChanged();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  }

  async function download(f) {
    try { window.location.href = (await api('panels.fileUrl', { id: f.id })).url; } catch (e) { alert(e.message); }
  }
  async function remove(f) {
    if (!confirm(`Usunąć plik ${f.filename}? Tej operacji nie można cofnąć.`)) return;
    try { await api('panels.deleteFile', { id: f.id }); onChanged(); } catch (e) { alert(e.message); }
  }

  return (
    <Card title={<span className="flex items-center gap-2"><FileCode2 size={16} />Pliki konfiguracji</span>} pad={false} className="reveal"
      actions={<span className="font-mono text-[11.5px] text-muted">{files.length} {files.length === 1 ? 'wersja' : 'wersji'}</span>}>
      {can('configs.upload') && <div className="no-print p-4 border-b border-line">
        {!file ? (
          <button type="button" onClick={() => input.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            className={`w-full flex flex-col items-center gap-1 py-6 border-2 border-dashed rounded-[3px] cursor-pointer transition-colors ${drag ? 'border-signal bg-signal/5' : 'border-line hover:border-ink-3 bg-paper/40'}`}>
            <Upload size={20} className="text-muted" />
            <span className="text-[13.5px] font-medium">Przeciągnij plik konfiguracji lub kliknij, aby wybrać</span>
            <span className="text-[12px] text-muted">Eksport z programu serwisowego centrali (dowolny format), maks. 4 MB</span>
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[13.5px]"><FileCode2 size={16} className="text-amber" /><b className="font-medium break-all">{file.name}</b><span className="font-mono text-[12px] text-muted">{fmtSize(file.size)}</span></div>
            <div className="grid sm:grid-cols-[180px_1fr] gap-2.5">
              <Field label="Wersja / oznaczenie"><Input value={meta.version} onChange={(e) => setMeta({ ...meta, version: e.target.value })} placeholder="np. v3 po rozbudowie" /></Field>
              <Field label="Opis zmian"><Input value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} placeholder="np. dodano 6 czujek w lokalu 1.14" /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setFile(null); input.current.value = ''; }}>Anuluj</Button>
              <Button icon={Upload} loading={busy} onClick={upload}>Zapisz plik</Button>
            </div>
          </div>
        )}
        <input ref={input} type="file" className="hidden" onChange={(e) => pick(e.target.files[0])} />
        {msg && <div className={`mt-3 text-[13px] ${msg.ok ? 'text-ok' : 'text-signal'}`}>{msg.text}</div>}
      </div>}

      {files.length === 0 ? <Empty icon={FileCode2}>Brak zapisanej konfiguracji tej centrali</Empty> : (
        <ul>
          {files.map((f, i) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-3 border-b border-line/70 last:border-0">
              <FileCode2 size={18} className={i === 0 ? 'text-amber shrink-0' : 'text-muted shrink-0'} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-[13.5px] break-all">{f.filename}</span>
                  {f.version && <span className="font-mono text-[11.5px] px-1.5 bg-paper-2 rounded-[2px]">{f.version}</span>}
                  {i === 0 && <Badge tone="ok">aktualna</Badge>}
                </div>
                {f.description && <div className="text-[12.5px] text-ink-3">{f.description}</div>}
                <div className="font-mono text-[11px] text-muted">{fmtDateTime(f.created_at)} · {f.uploader_name || '—'} · {fmtSize(f.size)} · sha256 {f.sha256?.slice(0, 10)}</div>
              </div>
              <div className="no-print flex gap-1 shrink-0">
                {onImport && <Button variant="ghost" icon={FileInput} onClick={() => onImport(f)} title="Importuj elementy systemu z tego pliku">Importuj</Button>}
                {can('configs.download') && <Button variant="ghost" icon={Download} onClick={() => download(f)} title="Pobierz">Pobierz</Button>}
                {(f.uploaded_by === user.id ? can('configs.upload') : can('configs.delete')) && (
                  <button onClick={() => remove(f)} className="w-9 h-9 flex items-center justify-center text-muted hover:text-signal cursor-pointer" aria-label="Usuń plik"><Trash2 size={15} /></button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
