import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api, getToken, setToken } from './api';
import { Spinner } from './ui';
import { AuthCtx } from './auth';
import Layout from './Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Sites from './pages/Sites';
import SiteDetail from './pages/SiteDetail';
import Inspections from './pages/Inspections';
import InspectionDetail from './pages/InspectionDetail';
import Tickets from './pages/Tickets';
import Users from './pages/Users';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!getToken());

  useEffect(() => {
    if (getToken()) api('auth.me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setChecking(false));
    const onExpired = () => setUser(null);
    window.addEventListener('auth-expired', onExpired);
    return () => window.removeEventListener('auth-expired', onExpired);
  }, []);

  const logout = () => { setToken(null); setUser(null); };

  if (checking) return <Spinner />;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <AuthCtx.Provider value={{ user, setUser, logout }}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="klienci" element={<Clients />} />
          <Route path="klienci/:id" element={<ClientDetail />} />
          <Route path="obiekty" element={<Sites />} />
          <Route path="obiekty/:id" element={<SiteDetail />} />
          <Route path="przeglady" element={<Inspections />} />
          <Route path="przeglady/:id" element={<InspectionDetail />} />
          <Route path="zgloszenia" element={<Tickets />} />
          <Route path="uzytkownicy" element={<Users />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthCtx.Provider>
  );
}
