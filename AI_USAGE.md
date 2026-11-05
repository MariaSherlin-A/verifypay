# AI usage (ETHGlobal disclosure)

Tools: Claude (planning, research, code generation, review) and Claude Code. Every AI-produced file was reviewed by the team.

| Date (IST) | Files | What AI did | What the human did |
|---|---|---|---|
| Nov 5 | specs/*, CLAUDE.md, prompts/* | Drafted idea analysis, prior-art check (Meigi, UnSend), PRD/TRD/security/implementation specs | Chose the idea and sponsors, reviewed and edited every spec |
| Nov 5 | src/PayeeRegistry.sol, src/SafeSend.sol, test/*, script/Deploy.s.sol | Wrote contracts, 29 Foundry tests (unit, fuzz, invariant), deploy script | Reviewed logic and security decisions, ran tests |
| Nov 5 | cre/* | Wrote CRE workflow from Chainlink's official templates | Will install CLI, generate bindings, run simulations |
| Nov 6 | src/SafeSend.sol (USDC+EURC), src/AgentWallet.sol, test/AgentWallet.t.sol, test/Eip712Compat.t.sol | Added multi-stablecoin escrow, agent wallet with caps and World-gated raises, typed-data compatibility tests | Reviewed design and tests |
| Nov 6 | server/*, web/*, agent/* | Wrote backend (Agent Pass device flow, ID-token validation, signer, history scan), web app, agent script | Will register the World app, configure .env, test on Arc Testnet |
| Nov 6 | cre/README.md, docs/chainlink-cre-feedback.md | Wrote CRE workflow guide (prize fit, run steps, evidence checklist) and feedback template | Will run the simulations and fill in the feedback |
| Nov 6 | docs/world-integration.md, SPONSOR_QUALIFICATION.md | Wrote World Agent Pass guide and per-sponsor qualification checklist | Will tick off each item during the build |
| Nov 6 | src/PayeeRegistry.sol, test/PayeeRegistry.t.sol | Found and fixed a bug: re-verifying the current controller now clears a controller change queued by an earlier DNS hijack (was executable later while Active); added `test_ReverifySameControllerClearsQueuedHijack` (45 tests) | Reviewed the fix; runs `forge test` in Arc Studio |
| Nov 6 | ARC_STUDIO_BUILD.md, .gitignore, foundry.toml, docs test counts | Rewrote the Arc Studio guide (prompts per step, no-mocks rules, live checks of Arc RPC, explorer API, CRE forwarder, World OIDC discovery); un-ignored docs/; portable solc version | Builds in Arc Studio following the guide |
