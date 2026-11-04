import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useApi, Card, Table, PageHeader, Button, FormModal, ErrorBox, Badge } from '../ui';
import { userFields } from '../forms';
import { fmtDate } from '../format';

export default function Users() {
  const { user, setUser } = useAuth();
  const { data, error, reload } = useApi('users.list', {});
  const [editing, setEditing] = useState(null);
  const isAdmin = user.role === 'admin';

  return (
    <>
      <PageHeader kicker="Konta i uprawnienia" title="Zespół">
        {isAdmin && <Button icon={Plus} onClick={() => setEditing({ role: 'technik', active: true })}>Dodaj osobę</Button>}
      </PageHeader>
      {error && <ErrorBox>{error}</ErrorBox>}
      {!isAdmin && <p className="mb-4 text-muted text-[13px]">Konta zespołu może zmieniać tylko administrator.</p>}
      <Card pad={false} className="reveal">
        <Table rows={data} onRow={isAdmin ? (u) => setEditing(u) : undefined} columns={[
          { key: 'name', label: 'Osoba', render: (u) => <div><div className="font-medium">{u.name}{u.id === user.id && <span className="text-muted font-normal"> (Ty)</span>}</div><div className="text-[12px] text-muted">{u.email}</div></div> },
          { key: 'phone', label: 'Telefon', className: 'hidden sm:table-cell' },
          { key: 'role', label: 'Rola', render: (u) => <Badge>{u.role}</Badge> },
          { key: 'active', label: 'Konto', render: (u) => <Badge tone={u.active ? 'ok' : 'muted'}>{u.active ? 'aktywne' : 'wyłączone'}</Badge> },
          { key: 'created_at', label: 'Od', className: 'hidden md:table-cell', render: (u) => <span className="font-mono text-[12px]">{fmtDate(u.created_at)}</span> },
        ]} />
      </Card>
      <p className="mt-4 text-[12.5px] text-muted max-w-2xl">
        <b className="text-ink">Technik</b> obsługuje klientów, obiekty, przeglądy i zgłoszenia. <b className="text-ink">Administrator</b> dodatkowo zarządza zespołem i może usuwać klientów oraz obiekty.
      </p>
      {editing && (
        <FormModal title={editing.id ? 'Edycja konta' : 'Nowa osoba w zespole'} fields={userFields(!editing.id)} initial={editing} onClose={() => setEditing(null)}
          onSubmit={async (v) => { const saved = await api('users.save', v); if (saved.id === user.id) setUser(saved); reload(); }} />
      )}
    </>
  );
}
