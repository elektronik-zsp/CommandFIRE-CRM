import { api } from '../api';
import { useApi, FormModal, Spinner, Modal } from '../ui';
import { scheduleFields, clean, toForm } from '../forms';

// Plan a new inspection (the protocol itself is filled in on the inspection page).
export default function ScheduleModal({ initial = {}, onClose, onSaved }) {
  const sites = useApi('sites.list', {});
  const users = useApi('users.list', {});
  if (!sites.data || !users.data) return <Modal title="Zaplanuj przegląd" onClose={onClose}><Spinner /></Modal>;
  return (
    <FormModal title="Zaplanuj przegląd" fields={scheduleFields(sites.data, users.data)} submitLabel="Zaplanuj"
      initial={toForm({ type: 'przegląd okresowy', ...initial })} onClose={onClose}
      onSubmit={async (v) => { const row = await api('inspections.save', clean(v)); onSaved?.(row); }} />
  );
}
