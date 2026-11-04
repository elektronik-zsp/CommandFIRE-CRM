import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Check, Lock, Ban, Save, Undo2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useApi, Card, Table, PageHeader, Button, FormModal, ErrorBox, Badge, Tabs, Spinner } from '../ui';
import { userFields } from '../forms';
import { fmtDate } from '../format';

export default function Users() {
  const { user, setUser, can } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'osoby';
  const { data, error, reload } = useApi('users.list', {});
  const roles = useApi('roles.list', {});
  const [editing, setEditing] = useState(null);
  const isAdmin = user.role === 'admin';
  const manage = can('users.manage');
  // only an administrator manages administrator accounts
  const editable = (u) => manage && (isAdmin || u.role !== 'admin');
  const roleOptions = (roles.data?.roles || []).filter((r) => isAdmin || r.key !== 'admin');

  return (
    <>
      <PageHeader kicker="Konta i uprawnienia" title="Zespół">
        {manage && tab === 'osoby' && <Button icon={Plus} disabled={!roles.data} onClick={() => setEditing({ role: roleOptions.find((r) => r.key === 'technik')?.key || roleOptions[0]?.key, active: true })}>Dodaj osobę</Button>}
      </PageHeader>
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { key: 'osoby', label: 'Osoby', count: data?.length },
        { key: 'role', label: 'Role i uprawnienia', count: roles.data?.roles.length },
      ]} />
      {(error || roles.error) && <ErrorBox>{error || roles.error}</ErrorBox>}

      {tab === 'osoby' && (
        <>
          {!manage && <p className="mb-4 text-muted text-[13px]">Twoja rola nie pozwala zmieniać kont zespołu.</p>}
          <Card pad={false} className="reveal">
            <Table rows={data} onRow={(u) => editable(u) && setEditing(u)} columns={[
              { key: 'name', label: 'Osoba', render: (u) => <div><div className="font-medium">{u.name}{u.id === user.id && <span className="text-muted font-normal"> (Ty)</span>}</div><div className="text-[12px] text-muted">{u.email}</div></div> },
              { key: 'phone', label: 'Telefon', className: 'hidden sm:table-cell' },
              { key: 'role', label: 'Rola', render: (u) => <Badge tone={u.role === 'admin' ? 'danger' : undefined}>{u.role_name || u.role}</Badge> },
              { key: 'active', label: 'Konto', render: (u) => <Badge tone={u.active ? 'ok' : 'muted'}>{u.active ? 'aktywne' : 'wyłączone'}</Badge> },
              { key: 'created_at', label: 'Od', className: 'hidden md:table-cell', render: (u) => <span className="font-mono text-[12px]">{fmtDate(u.created_at)}</span> },
            ]} />
          </Card>
          <p className="mt-4 text-[12.5px] text-muted max-w-2xl">
            Zakres dostępu każdej osoby wynika z jej roli — szczegóły w zakładce <button className="text-ink underline underline-offset-2 cursor-pointer" onClick={() => setParams({ tab: 'role' })}>Role i uprawnienia</button>.
          </p>
        </>
      )}

      {tab === 'role' && (roles.data ? <RoleMatrix data={roles.data} isAdmin={isAdmin} onChanged={() => { roles.reload(); reload(); }} /> : !roles.error && <Spinner />)}

      {editing && (
        <FormModal title={editing.id ? 'Edycja konta' : 'Nowa osoba w zespole'} fields={userFields(!editing.id, roleOptions)} initial={editing} onClose={() => setEditing(null)}
          onSubmit={async (v) => { const saved = await api('users.save', v); if (saved.id === user.id) setUser(saved); reload(); roles.reload(); }} />
      )}
    </>
  );
}

const roleFields = (roles) => [
  { name: 'name', label: 'Nazwa roli', required: true, span: 2 },
  { name: 'description', label: 'Opis', type: 'textarea', rows: 2, span: 2 },
  ...(roles ? [{ name: 'copy', label: 'Uprawnienia początkowe', type: 'select', span: 2, options: roles.map((r) => ({ value: r.key, label: `jak „${r.name}”` })), hint: 'Puste = bez uprawnień; zaznaczysz je w matrycy' }] : []),
];

// Permission matrix: rows = permissions (grouped), columns = roles. Edits stay local until "Zapisz zmiany".
function RoleMatrix({ data, isAdmin, onChanged }) {
  const { roles, catalog } = data;
  const saved = useMemo(() => Object.fromEntries(roles.map((r) => [r.key, r.permissions])), [roles]);
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null); // 'new' | role
  useEffect(() => setDraft(saved), [saved]);

  const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  const dirty = roles.filter((r) => r.key !== 'admin' && !same(draft[r.key] || [], saved[r.key]));
  const has = (r, perm) => r.key === 'admin' ? perm !== 'scope.own' : (draft[r.key] || []).includes(perm);
  const toggle = (r, perm) => setDraft((d) => ({ ...d, [r.key]: has(r, perm) ? d[r.key].filter((x) => x !== perm) : [...d[r.key], perm] }));
  const locked = (r) => !isAdmin || r.key === 'admin';

  async function saveAll() {
    setBusy(true); setMsg(null);
    try {
      for (const r of dirty) await api('roles.save', { key: r.key, name: r.name, description: r.description, permissions: draft[r.key] });
      setMsg({ ok: true, text: `Zapisano uprawnienia: ${dirty.map((r) => r.name).join(', ')}. Zmiany obowiązują od następnego działania użytkownika.` });
      onChanged();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted max-w-2xl">
          {isAdmin
            ? <>Zaznacz, co może każda rola. <b className="text-ink">Administrator</b> ma zawsze pełny dostęp. Pozycja <b className="text-ink">Ograniczenia</b> zawęża widok roli zamiast go rozszerzać.</>
            : <>Matrycę uprawnień zmienia tylko administrator.</>}
        </p>
        {isAdmin && (
          <div className="flex gap-2">
            {dirty.length > 0 && <Button variant="ghost" icon={Undo2} onClick={() => setDraft(saved)}>Odrzuć</Button>}
            {dirty.length > 0 && <Button icon={Save} loading={busy} onClick={saveAll}>Zapisz zmiany ({dirty.length})</Button>}
            <Button variant={dirty.length ? 'ghost' : 'dark'} icon={Plus} onClick={() => setModal('new')}>Dodaj rolę</Button>
          </div>
        )}
      </div>
      {msg && <div className={`p-3 rounded-[3px] border text-[13px] ${msg.ok ? 'border-ok/40 bg-ok/5 text-ok' : 'border-signal/40 bg-signal/5 text-signal-dark'}`}>{msg.text}</div>}

      <Card pad={false} className="reveal overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-line align-bottom">
              <th className="sticky left-0 z-10 bg-white text-left px-4 py-3 font-normal min-w-64">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">Uprawnienie</span>
              </th>
              {roles.map((r) => (
                <th key={r.key} className={`px-2 py-3 font-normal text-center min-w-28 ${dirty.includes(r) ? 'bg-amber/10' : ''}`}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-display uppercase text-[14px] font-semibold leading-tight tracking-wide flex items-center gap-1">
                      {r.key === 'admin' && <Lock size={12} className="text-muted" />}{r.name}
                    </span>
                    <span className="font-mono text-[10.5px] text-muted">{r.user_count} {r.user_count === 1 ? 'osoba' : r.user_count > 1 && r.user_count < 5 ? 'osoby' : 'osób'}</span>
                    {isAdmin && r.key !== 'admin' && (
                      <button onClick={() => setModal(r)} className="text-[11.5px] text-muted hover:text-ink cursor-pointer inline-flex items-center gap-1"><Pencil size={11} />zmień</button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalog.map((g) => [
              <tr key={g.group} className="bg-paper/60 border-b border-line">
                <td colSpan={roles.length + 1} className="sticky left-0 px-4 py-1.5 font-display uppercase tracking-wider text-[12.5px] text-ink-3">{g.group}</td>
              </tr>,
              ...g.items.map((it) => (
                <tr key={it.key} className="border-b border-line/70 last:border-0 hover:bg-paper/40">
                  <td className="sticky left-0 bg-white px-4 py-2">
                    <div className={it.restrict ? 'text-signal-dark' : ''}>{it.label}</div>
                    <div className="font-mono text-[10.5px] text-muted">{it.key}</div>
                  </td>
                  {roles.map((r) => {
                    const on = has(r, it.key);
                    return (
                      <td key={r.key} className={`text-center px-2 py-1.5 ${dirty.includes(r) ? 'bg-amber/5' : ''}`}>
                        <button type="button" disabled={locked(r)} onClick={() => toggle(r, it.key)}
                          aria-label={`${r.name}: ${it.label}`} aria-pressed={on}
                          className={`w-7 h-7 inline-flex items-center justify-center rounded-[3px] border transition-colors ${locked(r) ? 'cursor-default' : 'cursor-pointer'} ${
                            on ? (it.restrict ? 'bg-signal border-signal text-white' : r.key === 'admin' ? 'bg-ink-3 border-ink-3 text-white' : 'bg-ink border-ink text-white')
                              : `bg-white border-line text-transparent ${locked(r) ? '' : 'hover:border-ink-3'}`}`}>
                          {it.restrict ? <Ban size={14} /> : <Check size={15} strokeWidth={2.5} />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </Card>

      {modal === 'new' && (
        <FormModal title="Nowa rola" fields={roleFields(roles)} initial={{ copy: '' }} onClose={() => setModal(null)}
          onSubmit={async (v) => {
            const src = roles.find((r) => r.key === v.copy);
            await api('roles.save', { name: v.name, description: v.description, permissions: src ? (src.key === 'admin' ? catalog.flatMap((g) => g.items).filter((i) => !i.restrict).map((i) => i.key) : draft[src.key]) : [] });
            onChanged();
          }} />
      )}
      {modal?.key && (
        <FormModal title={`Rola: ${modal.name}`} fields={roleFields()} initial={modal} onClose={() => setModal(null)}
          onSubmit={async (v) => { await api('roles.save', { key: modal.key, name: v.name, description: v.description, permissions: saved[modal.key] }); onChanged(); }}
          onDelete={async () => { await api('roles.delete', { key: modal.key }); onChanged(); }} />
      )}
    </div>
  );
}
