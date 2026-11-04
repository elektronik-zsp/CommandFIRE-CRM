import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Gauge, Building2, MapPin, ClipboardCheck, Siren, Users as UsersIcon, LogOut, KeyRound, Menu, X } from 'lucide-react';
import { useAuth } from './auth';
import { api } from './api';
import { FormModal } from './ui';
import { useReloadOnNewVersion } from './version';

const NAV = [
  { to: '/', label: 'Pulpit', icon: Gauge, end: true },
  { to: '/zgloszenia', label: 'Zgłoszenia serwisowe', icon: Siren, perm: 'tickets.view' },
  { to: '/przeglady', label: 'Przeglądy', icon: ClipboardCheck, perm: 'inspections.view' },
  { to: '/obiekty', label: 'Obiekty', icon: MapPin, perm: 'sites.view' },
  { to: '/klienci', label: 'Klienci', icon: Building2, perm: 'clients.view' },
  { to: '/uzytkownicy', label: 'Zespół', icon: UsersIcon },
];

export function Logo({ light }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="3" fill="#D7261E" />
        <circle cx="16" cy="16" r="8" fill="none" stroke="white" strokeWidth="2.6" />
        <circle cx="16" cy="16" r="2.4" fill="white" />
        <path d="M16 4v3M16 25v3M4 16h3M25 16h3" stroke="white" strokeWidth="2" />
      </svg>
      <div className="leading-none">
        <div className={`font-display text-[21px] font-bold uppercase tracking-wider ${light ? 'text-white' : 'text-ink'}`}>Czujnik</div>
        <div className={`font-mono text-[9.5px] uppercase tracking-[0.2em] ${light ? 'text-white/50' : 'text-muted'}`}>CRM · Systemy SSP</div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout, can } = useAuth();
  const [pw, setPw] = useState(false);
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useReloadOnNewVersion(loc.pathname);

  const sidebar = (
    <aside className="flex flex-col h-full bg-ink text-white w-64">
      <div className="px-5 h-16 flex items-center justify-between border-b border-white/10">
        <Logo light />
        <button className="lg:hidden text-white/60 cursor-pointer" onClick={() => setOpen(false)}><X size={18} /></button>
      </div>
      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5">
        {NAV.filter((n) => !n.perm || can(n.perm)).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
            className={({ isActive }) => `group relative flex items-center gap-3 h-10 px-3 rounded-[3px] text-[13.5px] transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
            {({ isActive }) => (<>
              {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-signal" />}
              <Icon size={17} strokeWidth={1.8} />{label}
            </>)}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10">
        <div className="text-[13px] font-medium truncate">{user.name}</div>
        <div className="font-mono text-[10.5px] text-white/45 truncate mb-3">{user.email} · {user.role_name || user.role}</div>
        <div className="flex gap-1">
          <button onClick={() => setPw(true)} className="flex-1 flex items-center justify-center gap-1.5 h-8 text-[12px] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-[3px] cursor-pointer"><KeyRound size={13} />Hasło</button>
          <button onClick={logout} className="flex-1 flex items-center justify-center gap-1.5 h-8 text-[12px] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-[3px] cursor-pointer"><LogOut size={13} />Wyloguj</button>
        </div>
      </div>
      <div className="hazard h-1.5" />
    </aside>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <div className="hidden lg:block fixed inset-y-0 left-0 no-print">{sidebar}</div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex no-print">
          {sidebar}
          <div className="flex-1 bg-ink/50" onClick={() => setOpen(false)} />
        </div>
      )}
      <div className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-line no-print">
        <Logo />
        <button onClick={() => setOpen(true)} className="p-2 cursor-pointer" aria-label="Menu"><Menu size={20} /></button>
      </div>
      <main key={loc.pathname} className="grid-bg min-h-screen px-4 sm:px-8 py-7 max-w-[1400px]">
        <Outlet />
      </main>
      {pw && (
        <FormModal title="Zmiana hasła" onClose={() => setPw(false)} submitLabel="Zmień hasło"
          fields={[
            { name: 'current', label: 'Obecne hasło', type: 'password', required: true, span: 2 },
            { name: 'next', label: 'Nowe hasło', type: 'password', required: true, span: 2, hint: 'Min. 8 znaków' },
          ]}
          onSubmit={(v) => api('auth.changePassword', v)} />
      )}
    </div>
  );
}
