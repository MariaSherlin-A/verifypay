import { isHex, type Hex } from 'viem';

/** Response of POST /api/agent-pass/start (server/src/server.js agentPassStart). */
export interface AgentPassSession {
  sessionId: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
}

/** The approval the backend signed: use these exact values for PayeeRegistry.requestPayoutChange. */
export interface AgentPassApproval {
  signature: Hex;
  deadline: number;
  nonce: string;
}

export type AgentPassPoll =
  | { status: 'pending' }
  | { status: 'approved'; result: AgentPassApproval }
  | { status: 'denied' | 'expired' | 'rejected' | 'error' | 'unknown'; error?: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) {
    throw new Error(`Cannot reach the VerifyPay backend: ${e instanceof Error ? e.message : String(e)}`);
  }
  const json: unknown = await res.json().catch(() => null);
  if (isRecord(json) && typeof json.error === 'string') throw new Error(json.error);
  if (!res.ok || !isRecord(json)) throw new Error(`Backend returned HTTP ${res.status}`);
  return json;
}

export async function startAgentPass(action: 'payoutChange' | 'raiseLimits', params: Record<string, string>): Promise<AgentPassSession> {
  const j = await post('/api/agent-pass/start', { action, params });
  if (typeof j.sessionId !== 'string' || typeof j.userCode !== 'string' || typeof j.verificationUri !== 'string') {
    throw new Error('World ID start returned an unexpected response');
  }
  return {
    sessionId: j.sessionId,
    userCode: j.userCode,
    verificationUri: j.verificationUri,
    verificationUriComplete: typeof j.verificationUriComplete === 'string' ? j.verificationUriComplete : undefined,
    expiresIn: typeof j.expiresIn === 'number' ? j.expiresIn : 300,
    interval: typeof j.interval === 'number' && j.interval > 0 ? j.interval : 5,
  };
}

export async function pollAgentPass(sessionId: string): Promise<AgentPassPoll> {
  const j = await post('/api/agent-pass/poll', { sessionId });
  switch (j.status) {
    case 'pending':
      return { status: 'pending' };
    case 'approved': {
      const r = j.result;
      if (!isRecord(r) || typeof r.signature !== 'string' || !isHex(r.signature) || typeof r.deadline !== 'number' || typeof r.nonce !== 'string') {
        throw new Error('World ID approval came back in an unexpected format; nothing was sent');
      }
      return { status: 'approved', result: { signature: r.signature, deadline: r.deadline, nonce: r.nonce } };
    }
    case 'denied':
    case 'expired':
    case 'rejected':
    case 'error':
    case 'unknown':
      return { status: j.status, error: typeof j.error === 'string' ? j.error : undefined };
    default:
      throw new Error(`World ID poll returned an unknown status: ${JSON.stringify(j.status)}`);
  }
}
