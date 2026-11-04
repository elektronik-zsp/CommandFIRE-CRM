// Pieces shared by printed documents (inspection and service protocols).

// Company block at the top of a printed document; from Ustawienia → Dane firmy.
export function CompanyHeader({ company = {}, title, number, date }) {
  const contact = [company.phone && `tel. ${company.phone}`, company.email, company.website].filter(Boolean).join(' · ');
  return (
    <div className="flex justify-between items-start gap-6 border-b-2 border-black pb-2 mb-3">
      <div className="min-w-0">
        {company.name
          ? <div className="font-display text-[16px] font-bold uppercase leading-tight">{company.name}</div>
          : <div className="text-[10px] italic">Uzupełnij dane firmy w Ustawieniach</div>}
        {(company.address || company.city) && <div>{[company.address, company.city].filter(Boolean).join(', ')}</div>}
        {(company.nip || company.regon) && <div>{[company.nip && `NIP ${company.nip}`, company.regon && `REGON ${company.regon}`].filter(Boolean).join(' · ')}</div>}
        {contact && <div>{contact}</div>}
        {company.certificates && <div className="text-[10px]">{company.certificates}</div>}
      </div>
      <div className="text-right shrink-0">
        <div className="font-display text-[20px] font-bold uppercase leading-tight">{title}</div>
        <div>nr <b>{number || '—'}</b></div>
        {date && <div>z dnia <b>{date}</b></div>}
      </div>
    </div>
  );
}

export function Signatures({ left, right }) {
  return (
    <div className="grid grid-cols-2 gap-16 mt-12">
      {[left, right].map((s, i) => (
        <div key={i} className="border-t border-black pt-1 text-center">
          <div>{s.label}</div>
          {s.name && <div className="font-semibold">{s.name}</div>}
          {s.sub && <div className="text-[10px]">{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function CompanyFooter({ company }) {
  return company?.footer ? <div className="mt-8 pt-1 border-t border-gray-400 text-[9.5px] text-center whitespace-pre-wrap">{company.footer}</div> : null;
}
