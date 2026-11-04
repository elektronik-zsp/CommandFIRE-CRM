import { createContext, createElement, useContext } from 'react';
import { ShieldOff } from 'lucide-react';

export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// can(perm): does the signed-in user's role grant this permission (see the role matrix)
export const makeCan = (user) => (perm) => !!user?.permissions?.includes(perm);

/** Renders children only with the permission; otherwise a "no access" notice. */
export function Guard({ perm, children }) {
  const { can } = useAuth();
  if (can(perm)) return children;
  return createElement('div', { className: 'flex flex-col items-center gap-2 py-24 text-muted text-center' },
    createElement(ShieldOff, { size: 26, strokeWidth: 1.5 }),
    createElement('div', { className: 'text-[15px] text-ink font-medium' }, 'Brak dostępu'),
    createElement('div', { className: 'text-[13px]' }, 'Twoja rola nie ma uprawnień do tej części systemu. Skontaktuj się z administratorem.'));
}
