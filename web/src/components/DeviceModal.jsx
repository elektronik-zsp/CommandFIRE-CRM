import { useState } from 'react';
import { api } from '../api';
import { useApi, Modal, RecordForm, Tabs, Spinner, Field, Input } from '../ui';
import { deviceFields, clean } from '../forms';
import { DEVICE_EVENT_KINDS } from '../format';
import { HistoryList, AddEntry } from './History';

// Create / edit a system element; existing elements also get their service history.
export default function DeviceModal({ device, onClose, onSaved, initialTab = 'dane' }) {
  const [tab, setTab] = useState(initialTab);
  const [current, setCurrent] = useState(device);
  const history = useApi('history.list', { entity: 'device', entity_id: device.id || 0 });
  const isNew = !device.id;

  const form = (
    <RecordForm key={JSON.stringify(current)} fields={deviceFields} initial={current} onClose={onClose}
      onSubmit={async (v) => { await api('devices.save', clean(v)); onSaved?.(); }}
      onDelete={isNew ? undefined : async () => { await api('devices.delete', { id: device.id }); onSaved?.(); }} />
  );

  return (
    <Modal wide title={isNew ? 'Nowy element systemu' : `${device.type}${device.location ? ' — ' + device.location : ''}`} onClose={onClose}>
      {isNew ? form : (
        <>
          <Tabs value={tab} onChange={setTab} tabs={[
            { key: 'dane', label: 'Dane elementu' },
            { key: 'historia', label: 'Historia', count: history.data?.length },
          ]} />
          {tab === 'dane' && form}
          {tab === 'historia' && (
            <div className="flex flex-col gap-4">
              <AddEntry kinds={DEVICE_EVENT_KINDS} placeholder="Co zostało zrobione / stwierdzone…"
                extras={(kind, v, set) => kind === 'wymiana' && (
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <Field label="Nowy nr seryjny"><Input value={v.serial || ''} onChange={(e) => set('serial', e.target.value)} placeholder="opcjonalnie" /></Field>
                    <Field label="Następna wymiana do"><Input type="date" value={v.replace_by || ''} onChange={(e) => set('replace_by', e.target.value)} /></Field>
                  </div>
                )}
                onSubmit={async (v) => {
                  const r = await api('devices.event', {
                    device_id: device.id, kind: v.kind, event_date: v.event_date, comment: v.comment,
                    ...(v.kind === 'wymiana' ? { serial: v.serial || undefined, replace_by: v.replace_by || null } : {}),
                  });
                  setCurrent(r.device);
                  history.reload(); onSaved?.();
                }} />
              {history.data ? <HistoryList rows={history.data} onChanged={history.reload} /> : <Spinner />}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
