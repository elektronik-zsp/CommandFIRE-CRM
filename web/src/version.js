import { useEffect, useRef } from 'react';

// The SPA loads once, so an open tab keeps running the old build after a deploy.
// On navigation (at most every 30 s) compare the deployed bundle name with ours and reload when it changed.
const BUNDLE = /assets\/index-[\w-]+\.js/;
const current = () => document.querySelector('script[type="module"][src*="/assets/index-"]')?.src.match(BUNDLE)?.[0];

export function useReloadOnNewVersion(path) {
  const first = useRef(true);
  const last = useRef(0);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const mine = current();
    if (!mine || Date.now() - last.current < 30_000) return;
    last.current = Date.now();
    fetch('/index.html', { cache: 'no-store' })
      .then((r) => r.text())
      .then((html) => { const live = html.match(BUNDLE)?.[0]; if (live && live !== mine) window.location.reload(); })
      .catch(() => {});
  }, [path]);
}
