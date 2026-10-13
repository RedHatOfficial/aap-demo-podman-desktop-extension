# Persistent AAP Demo Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the AAP Demo status item and refreshed details available after the user navigates away from the dashboard.

**Architecture:** Own one status polling loop at extension activation rather than inside the webview panel lifecycle. The status bar is updated even with no panel, while dashboard messages are delivered only when a panel exists.

**Tech Stack:** TypeScript, Podman Desktop extension API, Vitest.

**Spec:** GitHub issue #19.

## Global Constraints

- Maintain one polling interval per extension activation.
- Keep status-bar updates independent of panel visibility.
- Dispose the interval with the extension context.
- Run tests, type-check, and build.

## Review Focus

- Dashboard open: status still reaches the panel.
- Dashboard disposed: status polling continues for the status item.
- Reopen dashboard: latest status is fetched during initialization.
- Extension deactivation: interval is cleared.
- No duplicate interval after opening multiple times.

---

### Task 1: Move status polling to activation scope

**Files:** Modify `src/extension.ts`; test `tests/status-persistence.test.ts`.

- [ ] Add a regression test proving the interval is declared before dashboard registration and not inside `openDashboard`.
- [ ] Add one global interval, an initial status refresh, and a disposable; remove panel-owned polling.
- [ ] Run `npm test -- tests/status-persistence.test.ts && npm run typecheck`; commit.

### Task 2: Document the navigation contract

**Files:** Modify `README.md`, `TESTING.md`; create `docs/adr/008-persistent-status.md`.

- [ ] Document the persistent status-bar behavior and manual navigation test.
- [ ] Run `npm test && npm run typecheck && npm run build`; commit.
