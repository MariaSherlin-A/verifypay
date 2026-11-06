import type { Address } from 'viem';

/** Escrow ids this browser created, for the Undo window (same storage key shape as web/app.js). */
const key = (safeSend: Address): string => `vp:pending:${safeSend}`;

export function loadPending(safeSend: Address): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(safeSend)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function savePending(safeSend: Address, id: bigint): void {
  try {
    localStorage.setItem(key(safeSend), JSON.stringify([...new Set([...loadPending(safeSend), id.toString()])]));
  } catch {
    // storage unavailable: the id is still shown on screen and can be read back from the chain's Escrowed events
  }
}
