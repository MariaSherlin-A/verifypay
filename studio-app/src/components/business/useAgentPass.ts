import { useCallback, useEffect, useRef, useState } from 'react';
import {
  pollAgentPass,
  startAgentPass,
  type AgentPassApproval,
  type AgentPassSession,
} from '@/lib/agentPass';

export type AgentPassState =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'waiting'; session: AgentPassSession }
  /** The backend call failed (not World ID's answer): the real error, with a way to resume polling the same session. */
  | { kind: 'error'; message: string; session: AgentPassSession | null }
  | { kind: 'approved'; approval: AgentPassApproval }
  /** denied, expired, rejected or error from World ID / the backend's validation. No transaction may be sent. */
  | { kind: 'not-approved'; status: string; detail?: string };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * World ID Agent Pass flow (web/app.js agentPass): the backend runs the device flow and validates the ID token,
 * the browser only shows the code/link and polls. Polling waits `interval` seconds between calls.
 * (The backend reports World's slow_down as plain "pending", so the server-provided interval is the only pacing signal.)
 */
export function useAgentPass() {
  const [state, setState] = useState<AgentPassState>({ kind: 'idle' });
  const run = useRef(0);

  useEffect(
    () => () => {
      run.current += 1; // unmounting cancels any running poll loop
    },
    [],
  );

  const pollLoop = useCallback(async (id: number, session: AgentPassSession): Promise<AgentPassApproval | null> => {
    for (;;) {
      await sleep(session.interval * 1000);
      if (run.current !== id) return null;
      let poll;
      try {
        poll = await pollAgentPass(session.sessionId);
      } catch (e) {
        if (run.current === id) setState({ kind: 'error', message: e instanceof Error ? e.message : String(e), session });
        return null;
      }
      if (run.current !== id) return null;
      if (poll.status === 'pending') continue;
      if (poll.status === 'approved') {
        setState({ kind: 'approved', approval: poll.result });
        return poll.result;
      }
      setState({ kind: 'not-approved', status: poll.status, detail: poll.error });
      return null;
    }
  }, []);

  /** Starts the flow and resolves with the backend's approval once the person approved, or null in every other case. */
  const start = useCallback(
    async (action: 'payoutChange' | 'raiseLimits', params: Record<string, string>): Promise<AgentPassApproval | null> => {
      run.current += 1;
      const id = run.current;
      setState({ kind: 'starting' });
      let session: AgentPassSession;
      try {
        session = await startAgentPass(action, params);
      } catch (e) {
        if (run.current === id) setState({ kind: 'error', message: e instanceof Error ? e.message : String(e), session: null });
        return null;
      }
      if (run.current !== id) return null;
      setState({ kind: 'waiting', session });
      return pollLoop(id, session);
    },
    [pollLoop],
  );

  /** After a poll error: keep waiting on the same World ID session. */
  const resume = useCallback(async (): Promise<AgentPassApproval | null> => {
    if (state.kind !== 'error' || !state.session) return null;
    run.current += 1;
    const id = run.current;
    const { session } = state;
    setState({ kind: 'waiting', session });
    return pollLoop(id, session);
  }, [state, pollLoop]);

  const cancel = useCallback(() => {
    run.current += 1;
    setState({ kind: 'idle' });
  }, []);

  return { state, start, resume, cancel };
}
