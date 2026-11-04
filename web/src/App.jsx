import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api, getToken, setToken } from './api';
import { Spinner } from './ui';
import { AuthCtx, Guard, makeCan } from './auth';
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
import PanelDetail from './pages/PanelDetail';

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
    <AuthCtx.Provider value={{ user, setUser, logout, can: makeCan(user) }}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="klienci" element={<Guard perm="clients.view"><Clients /></Guard>} />
          <Route path="klienci/:id" element={<Guard perm="clients.view"><ClientDetail /></Guard>} />
          <Route path="obiekty" element={<Guard perm="sites.view"><Sites /></Guard>} />
          <Route path="obiekty/:id" element={<Guard perm="sites.view"><SiteDetail /></Guard>} />
          <Route path="centrale/:id" element={<Guard perm="panels.view"><PanelDetail /></Guard>} />
          <Route path="przeglady" element={<Guard perm="inspections.view"><Inspections /></Guard>} />
          <Route path="przeglady/:id" element={<Guard perm="inspections.view"><InspectionDetail /></Guard>} />
          <Route path="zgloszenia" element={<Guard perm="tickets.view"><Tickets /></Guard>} />
          <Route path="uzytkownicy" element={<Users />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthCtx.Provider>
  );
}
