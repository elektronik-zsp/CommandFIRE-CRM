// Same-origin API endpoint by default. Override only for local development.
const API_BASE = import.meta.env.VITE_API_BASE || '/api/';
const TOKEN_KEY = 'crm-ssp-token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api(action, params = {}) {
  const token = getToken();
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json().catch(() => ({ error: 'Nieprawidłowa odpowiedź serwera' }));
  if (res.status === 401 && action !== 'auth.login') {
    setToken(null);
    window.dispatchEvent(new Event('auth-expired'));
  }
  if (!res.ok) throw new Error(data.error || `Błąd ${res.status}`);
  return data;
}
