// Demonstration dataset — every client is flagged demo=true so it can be removed in one step.
const CLIENTS = [
  { name: 'Galeria Wisła Sp. z o.o.', nip: '5252812345', address: 'ul. Grochowska 207', city: 'Warszawa', contact_person: 'Anna Kowalczyk', phone: '+48 601 222 333', email: 'a.kowalczyk@galeriawisla.pl',
    sites: [
      { name: 'Galeria Wisła — budynek główny', address: 'ul. Grochowska 207', city: 'Warszawa', building_type: 'Handlowo-usługowy', panel_manufacturer: 'Polon-Alfa', panel_model: 'POLON 6000', system_type: 'adresowy', loops: 8, monitoring: true, monitoring_operator: 'Monitoring PSP — KM PSP Warszawa', contract_number: 'UK/2025/014', contract_end: 30, inspection_interval_months: 3, last: -95 },
      { name: 'Parking podziemny P-1', address: 'ul. Grochowska 207', city: 'Warszawa', building_type: 'Garaż podziemny', panel_manufacturer: 'Polon-Alfa', panel_model: 'POLON 4900', system_type: 'adresowy', loops: 2, monitoring: true, monitoring_operator: 'Monitoring PSP — KM PSP Warszawa', contract_number: 'UK/2025/014', contract_end: 30, inspection_interval_months: 6, last: -150 },
    ] },
  { name: 'Szpital Powiatowy im. J. Strusia', nip: '7781234567', address: 'ul. Szpitalna 4', city: 'Poznań', contact_person: 'inż. Marek Nowicki', phone: '+48 61 845 11 00', email: 'techniczny@szpital-strusia.pl',
    sites: [
      { name: 'Pawilon A — Izba przyjęć', address: 'ul. Szpitalna 4', city: 'Poznań', building_type: 'Szpital (ZL II)', panel_manufacturer: 'Schrack Seconet', panel_model: 'Integral IP', system_type: 'adresowy', loops: 6, monitoring: true, monitoring_operator: 'KM PSP Poznań', contract_number: 'SZP/ZP/112/2024', contract_end: 210, inspection_interval_months: 3, last: -100 },
      { name: 'Pawilon C — Oddziały zabiegowe', address: 'ul. Szpitalna 4', city: 'Poznań', building_type: 'Szpital (ZL II)', panel_manufacturer: 'Schrack Seconet', panel_model: 'Integral IP', system_type: 'adresowy', loops: 4, monitoring: true, monitoring_operator: 'KM PSP Poznań', contract_number: 'SZP/ZP/112/2024', contract_end: 210, inspection_interval_months: 3, last: -40 },
    ] },
  { name: 'LogiPark Stryków', nip: '7322098765', address: 'ul. Magazynowa 12', city: 'Stryków', contact_person: 'Tomasz Wiśniewski', phone: '+48 502 700 800', email: 'facility@logipark.pl',
    sites: [
      { name: 'Hala magazynowa DC-2', address: 'ul. Magazynowa 12', city: 'Stryków', building_type: 'Magazyn (PM)', panel_manufacturer: 'Bosch', panel_model: 'AVENAR panel 8000', system_type: 'adresowy', loops: 4, monitoring: false, contract_number: 'LP/SSP/03', contract_end: 400, inspection_interval_months: 6, last: -170 },
    ] },
  { name: 'Wspólnota Mieszkaniowa „Zielone Tarasy”', nip: '9512345678', address: 'ul. Słoneczna 18', city: 'Kraków', contact_person: 'Ewa Zielińska (zarządca)', phone: '+48 12 410 20 30', email: 'biuro@zielonetarasy.pl',
    sites: [
      { name: 'Budynek B — garaż i klatki schodowe', address: 'ul. Słoneczna 18B', city: 'Kraków', building_type: 'Mieszkalny wielorodzinny', panel_manufacturer: 'Esser (Honeywell)', panel_model: 'IQ8Control C', system_type: 'adresowy', loops: 1, monitoring: false, inspection_interval_months: 12, last: null },
    ] },
];

const DEVICES = [
  { type: 'Centrala', manufacturer: null, model: null, loop_no: null, location: 'Pomieszczenie ochrony, parter', quantity: 1, installed: -2200 },
  { type: 'Akumulator', manufacturer: 'Yuasa', model: 'NP17-12 (12V 17Ah)', location: 'Obudowa centrali', quantity: 2, installed: -1500, replace_by: 45 },
  { type: 'Czujka dymu optyczna', manufacturer: 'Polon-Alfa', model: 'DOR-6046', loop_no: 1, location: 'Korytarz parter', quantity: 24, installed: -2200 },
  { type: 'Czujka ciepła', manufacturer: 'Polon-Alfa', model: 'TOR-6046', loop_no: 1, location: 'Kuchnia, zaplecze', quantity: 4, installed: -2200 },
  { type: 'Czujka wielosensorowa', manufacturer: 'Polon-Alfa', model: 'DUR-6046', loop_no: 2, location: 'Strefa sklepów, piętro 1', quantity: 32, installed: -2200 },
  { type: 'ROP', manufacturer: 'Polon-Alfa', model: 'ROP-63', loop_no: 2, location: 'Wyjścia ewakuacyjne', quantity: 12, installed: -2200 },
  { type: 'Sygnalizator akustyczno-optyczny', manufacturer: 'W2', model: 'SAOZ-Pk1', loop_no: 3, location: 'Klatki schodowe', quantity: 8, installed: -2200 },
  { type: 'Moduł wejść/wyjść', manufacturer: 'Polon-Alfa', model: 'EKS-6203', loop_no: 3, location: 'Rozdzielnia, centrala wentylacyjna', quantity: 3, installed: -2200 },
  { type: 'Zasilacz', manufacturer: 'Merawex', model: 'ZSP135-DR-7A', location: 'Szacht techniczny 1p', quantity: 1, installed: -1800, replace_by: 600 },
];

const TICKETS = [
  { title: 'Uszkodzenie pętli nr 2 — przerwa linii', category: 'awaria', priority: 'krytyczny', status: 'w realizacji', days: -1, reported_by: 'Ochrona obiektu' },
  { title: 'Alarm fałszywy — czujka w kuchni (zapylenie)', category: 'alarm fałszywy', priority: 'wysoki', status: 'nowe', days: -2, reported_by: 'Kierownik zmiany' },
  { title: 'Wymiana akumulatorów w centrali', category: 'konserwacja', priority: 'normalny', status: 'nowe', days: -5, reported_by: 'Przegląd okresowy' },
  { title: 'Rozbudowa o 6 czujek — nowy najemca lokal 1.14', category: 'modernizacja', priority: 'niski', status: 'nowe', days: -9, reported_by: 'Zarządca' },
  { title: 'Brak transmisji do PSP po burzy', category: 'awaria', priority: 'krytyczny', status: 'zakończone', days: -30, reported_by: 'Stacja monitoringu', resolution: 'Wymieniono uszkodzony moduł transmisji, wykonano test połączenia z PSP.' },
];

const addDays = (d) => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };

export async function seedDemo({ q, one, user, checklist }) {
  let ti = 0;
  for (const c of CLIENTS) {
    const client = await one(`INSERT INTO clients (name, nip, address, city, contact_person, phone, email, demo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,true) RETURNING id`, [c.name, c.nip, c.address, c.city, c.contact_person, c.phone, c.email]);
    for (const s of c.sites) {
      const site = await one(`INSERT INTO sites (client_id, name, address, city, building_type, panel_manufacturer, panel_model, system_type, loops,
          monitoring, monitoring_operator, contract_number, contract_end, inspection_interval_months, last_inspection)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [client.id, s.name, s.address, s.city, s.building_type, s.panel_manufacturer, s.panel_model, s.system_type, s.loops,
          s.monitoring, s.monitoring_operator || null, s.contract_number || null, s.contract_end != null ? addDays(s.contract_end) : null,
          s.inspection_interval_months, s.last != null ? addDays(s.last) : null]);
      for (const d of DEVICES) {
        await q(`INSERT INTO devices (site_id, type, manufacturer, model, loop_no, location, quantity, installed_at, replace_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [site.id, d.type, d.manufacturer || s.panel_manufacturer, d.model || s.panel_model, d.loop_no ?? null, d.location,
            d.quantity, addDays(d.installed), d.replace_by != null ? addDays(d.replace_by) : null]);
      }
      if (s.last != null) {
        await q(`INSERT INTO inspections (site_id, scheduled_date, performed_date, technician_id, status, result, protocol_number, checklist, findings)
          VALUES ($1,$2,$2,$3,'wykonany',$4,$5,$6,$7)`,
          [site.id, addDays(s.last), user.id, ti % 2 ? 'pozytywny' : 'pozytywny z uwagami', `PR/${new Date().getFullYear()}/${100 + site.id}`,
            JSON.stringify(checklist.map((x) => ({ ...x, state: 'ok' }))), ti % 2 ? null : 'Zalecana wymiana akumulatorów w ciągu 3 miesięcy.']);
      }
      const plan = [-2, 3, 9, null, 16, 38][ti % 6];
      if (plan != null) {
        await q(`INSERT INTO inspections (site_id, scheduled_date, technician_id, status, checklist) VALUES ($1,$2,$3,'zaplanowany',$4)`,
          [site.id, addDays(plan), user.id, JSON.stringify(checklist)]);
      }
      const t = TICKETS[ti++ % TICKETS.length];
      await q(`INSERT INTO tickets (site_id, title, category, priority, status, assigned_to, reported_by, reported_at, resolution, resolved_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [site.id, t.title, t.category, t.priority, t.status, user.id, t.reported_by, addDays(t.days), t.resolution || null,
          t.status === 'zakończone' ? addDays(t.days + 1) : null]);
    }
  }
}
