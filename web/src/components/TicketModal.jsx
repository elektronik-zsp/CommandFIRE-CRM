import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck2, FileText } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useApi, Modal, RecordForm, Spinner, Tabs, Button, Badge } from '../ui';
import { ticketFields, clean, toForm } from '../forms';
import { HistoryList, AddEntry } from './History';

// Create / edit a service ticket. `ticket` = existing row or defaults for a new one.
export default function TicketModal({ ticket = {}, onClose, onSaved, initialTab = 'dane' }) {
  const { can } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState(initialTab);
  const sites = useApi('sites.list', {});
  const users = useApi('users.list', {});
  const history = useApi('history.list', { entity: 'ticket', entity_id: ticket.id || 0 });
  const title = ticket.id ? `Zgłoszenie #${ticket.id}` : 'Nowe zgłoszenie serwisowe';
  if (!sites.data || !users.data) return <Modal title={title} onClose={onClose}><Spinner /></Modal>;

  const form = (
    <RecordForm readOnly={!can(ticket.id ? 'tickets.edit' : 'tickets.create')} fields={ticketFields(sites.data, users.data)} initial={toForm({ category: 'awaria', priority: 'normalny', status: 'nowe', ...ticket })}
      onClose={onClose}
      onSubmit={async (v) => { await api('tickets.save', clean(v)); onSaved?.(); }}
      onDelete={ticket.id && can('tickets.delete') ? async () => { await api('tickets.delete', { id: ticket.id }); onSaved?.(); } : undefined} />
  );

  return (
    <Modal wide title={title} onClose={onClose}>
      {!ticket.id ? form : (
        <>
          {/* service protocol: one per ticket, edited on its own page (print / PDF) */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-3 py-2.5 bg-paper/60 border border-line rounded-[3px]">
            <span className="flex items-center gap-2 text-[13px]">
              <FileText size={16} className="text-muted" />Protokół serwisowy
              {ticket.protocol_number ? <Badge tone="ok">{ticket.protocol_number}</Badge> : ticket.protocol_id ? <Badge tone="warn">roboczy</Badge> : <span className="text-muted">— nie wystawiono</span>}
            </span>
            {(ticket.protocol_id || can('tickets.edit')) && (
              <Button variant={ticket.protocol_id ? 'ghost' : 'dark'} icon={FileCheck2} onClick={() => nav(`/zgloszenia/${ticket.id}/protokol`)}>
                {ticket.protocol_id ? 'Otwórz protokół' : 'Sporządź protokół'}
              </Button>
            )}
          </div>
          <Tabs value={tab} onChange={setTab} tabs={[
            { key: 'dane', label: 'Szczegóły' },
            { key: 'historia', label: 'Historia i komentarze', count: history.data?.length },
          ]} />
          {tab === 'dane' && form}
          {tab === 'historia' && (
            <div className="flex flex-col gap-4">
              {can('history.add') && <AddEntry photos kinds={['komentarz']} withDate={false} placeholder="Dodaj komentarz — ustalenia z klientem, postęp prac… (zdjęcie można też wkleić Ctrl+V)" submitLabel="Dodaj komentarz"
                onSubmit={async (v) => { await api('history.add', { entity: 'ticket', entity_id: ticket.id, kind: 'komentarz', comment: v.comment, photos: v.photos }); history.reload(); }} />}
              {history.data ? <HistoryList rows={history.data} onChanged={history.reload} /> : <Spinner />}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
