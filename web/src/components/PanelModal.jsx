import { api } from '../api';
import { FormModal } from '../ui';
import { panelFields, clean } from '../forms';

// Create / edit a panel card. `sites` = all sites of the panel's client (to pick the served ones).
export default function PanelModal({ panel, sites, onClose, onSaved, onDelete }) {
  const initial = { ...panel, site_ids: (panel.site_ids || (panel.sites || []).map((s) => s.id)).map(String) };
  return (
    <FormModal wide title={panel.id ? 'Edycja karty centrali' : 'Nowa karta centrali'} fields={panelFields(sites)} initial={initial} onClose={onClose}
      onSubmit={async (v) => onSaved?.(await api('panels.save', clean(v)))}
      onDelete={onDelete} />
  );
}
