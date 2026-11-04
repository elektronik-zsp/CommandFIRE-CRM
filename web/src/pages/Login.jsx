import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { api, setToken } from '../api';
import { Button, Input, Field, ErrorBox } from '../ui';
import { Logo } from '../Layout';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { token, user } = await api('auth.login', { email, password });
      setToken(token);
      onLogin(user);
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden lg:flex relative flex-col justify-between bg-ink text-white p-12 overflow-hidden">
        <Logo light />
        {/* concentric detector rings */}
        <svg className="absolute -right-40 top-1/2 -translate-y-1/2 opacity-[0.13]" width="720" height="720" viewBox="0 0 720 720" aria-hidden>
          {[340, 280, 220, 160, 100].map((r) => <circle key={r} cx="360" cy="360" r={r} fill="none" stroke="white" strokeWidth="1.5" />)}
          <circle cx="360" cy="360" r="40" fill="#D7261E" />
        </svg>
        <div className="relative reveal">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-signal mb-4">Ochrona przeciwpożarowa · serwis</div>
          <h1 className="text-[64px] leading-[0.92] font-bold max-w-md">Każdy obiekt.<br />Każda czujka.<br /><span className="text-signal">Każdy termin.</span></h1>
          <p className="mt-6 text-white/60 max-w-sm leading-relaxed">Klienci, obiekty, elementy systemów SSP, harmonogram przeglądów i zgłoszenia serwisowe w jednym miejscu.</p>
        </div>
        <div className="hazard h-2 -mx-12 -mb-12" />
      </div>
      <div className="flex items-center justify-center p-6 grid-bg">
        <form onSubmit={submit} className="reveal w-full max-w-sm bg-white border border-line rounded-[3px] p-7 flex flex-col gap-4">
          <div className="lg:hidden mb-2"><Logo /></div>
          <div>
            <h2 className="text-[26px] font-bold">Logowanie</h2>
            <p className="text-muted text-[13px]">Zaloguj się do panelu serwisowego.</p>
          </div>
          <Field label="E-mail"><Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Field>
          <Field label="Hasło"><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          {error && <ErrorBox>{error}</ErrorBox>}
          <Button type="submit" loading={busy} className="h-10 mt-1">Zaloguj <ArrowRight size={15} /></Button>
        </form>
      </div>
    </div>
  );
}
