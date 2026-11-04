import { api } from '../api';
import { useAuth } from '../auth';
import { useApi, FormModal, Spinner, Modal } from '../ui';
import { ticketFields, clean, toForm } from '../forms';

// Create / edit a service ticket. `ticket` = existing row or defaults for a new one.
export default function TicketModal({ ticket = {}, onClose, onSaved }) {
  const { user } = useAuth();
  const sites = useApi('sites.list', {});
  const users = useApi('users.list', {});
  if (!sites.data || !users.data) return <Modal title="Zgłoszenie" onClose={onClose}><Spinner /></Modal>;

  const initial = toForm({ category: 'awaria', priority: 'normalny', status: 'nowe', ...ticket });
  return (
    <FormModal wide title={ticket.id ? `Zgłoszenie #${ticket.id}` : 'Nowe zgłoszenie serwisowe'}
      fields={ticketFields(sites.data, users.data)} initial={initial} onClose={onClose}
      onSubmit={async (v) => { await api('tickets.save', clean(v)); onSaved?.(); }}
      onDelete={ticket.id && user.role === 'admin' ? async () => { await api('tickets.delete', { id: ticket.id }); onSaved?.(); } : undefined} />
  );
}
