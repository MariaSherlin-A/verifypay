import { useCallback, useEffect, useState } from 'react';

export type Tab = 'pay' | 'business' | 'agent';
const TABS: readonly Tab[] = ['pay', 'business', 'agent'];

const readTab = (): Tab => {
  const t = new URLSearchParams(window.location.search).get('tab');
  return TABS.find((x) => x === t) ?? 'pay';
};

/** Top-level screen, kept in the URL query (?tab=business) so back/forward and shared links work. */
export function useTab(): [Tab, (t: Tab) => void] {
  const [tab, setTabState] = useState<Tab>(readTab);

  useEffect(() => {
    const onPop = () => setTabState(readTab());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setTab = useCallback((t: Tab) => {
    const url = new URL(window.location.href);
    if (t === 'pay') url.searchParams.delete('tab');
    else url.searchParams.set('tab', t);
    window.history.pushState(null, '', `${url.pathname}${url.search}`);
    setTabState(t);
  }, []);

  return [tab, setTab];
}
