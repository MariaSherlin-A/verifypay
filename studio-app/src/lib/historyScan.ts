/** One poisoning attempt, as returned by GET /api/history-scan (server/src/poisoning.js scanHistory). */
export interface PoisoningAttempt {
  poisoned: string;
  imitates: string;
  txHash: string;
  token: string;
  value: string;
  timestamp?: string;
}

export interface HistoryScanResult {
  realCounterparties: string[];
  attempts: PoisoningAttempt[];
  /** Number of transfers the backend actually read. */
  scanned: number;
  /** True when the explorer has older transfers that were not read (only the first page is scanned). */
  hasMore: boolean;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';

function toAttempt(v: unknown): PoisoningAttempt {
  if (!isRecord(v) || !isString(v.poisoned) || !isString(v.imitates) || !isString(v.txHash) || !isString(v.value)) {
    throw new Error('History scan returned an attempt in an unexpected format');
  }
  return {
    poisoned: v.poisoned,
    imitates: v.imitates,
    txHash: v.txHash,
    token: isString(v.token) ? v.token : '',
    value: v.value,
    timestamp: isString(v.timestamp) ? v.timestamp : undefined,
  };
}

/** Calls our backend, which reads the real Blockscout API. Throws the backend's own error message on failure. */
export async function fetchHistoryScan(address: string): Promise<HistoryScanResult> {
  let res: Response;
  try {
    res = await fetch(`/api/history-scan?address=${encodeURIComponent(address)}`);
  } catch (e) {
    throw new Error(`Cannot reach the VerifyPay backend: ${e instanceof Error ? e.message : String(e)}`);
  }
  const body: unknown = await res.json().catch(() => null);
  if (isRecord(body) && isString(body.error)) throw new Error(`History scan failed: ${body.error}`);
  if (!res.ok) throw new Error(`History scan failed: backend HTTP ${res.status}`);
  if (!isRecord(body) || !Array.isArray(body.attempts) || !Array.isArray(body.realCounterparties)) {
    throw new Error('History scan returned an unexpected response');
  }
  if (typeof body.scanned !== 'number') throw new Error('History scan response is missing the number of transfers scanned');
  return {
    realCounterparties: body.realCounterparties.filter(isString),
    attempts: body.attempts.map(toAttempt),
    scanned: body.scanned,
    hasMore: body.hasMore === true,
  };
}
