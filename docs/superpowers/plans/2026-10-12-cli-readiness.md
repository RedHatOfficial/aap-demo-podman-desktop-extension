# CLI Readiness Error Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic process-spawn failure shown when `aap-demo` is unavailable with an actionable dashboard message and install action.

**Architecture:** Resolve the configured CLI against the extension’s augmented search path before every action. If it is unavailable, publish prerequisite state and a stable command error without spawning a child process; after installation, the same preflight automatically permits execution.

**Tech Stack:** TypeScript, Podman Desktop extension API, Vitest.

**Spec:** GitHub issue #26: `Portal call failed: Failed to start command: Failed to execute child process "aap-demo" (No such file or directory)`.

## Global Constraints

- Do not spawn the CLI when executable resolution fails.
- Preserve the configured `aap-demo.cliPath` value in the user-facing guidance.
- Keep the existing dashboard install flow available.
- Run `npm test`, `npm run typecheck`, and `npm run build`.

## Review Focus

- Missing default CLI: show install guidance instead of a child-process error.
- Missing custom CLI path: mention the configured setting so it can be corrected.
- CLI installed in a user-local directory: resolve it through the augmented path.
- Status refresh while missing: keep prerequisites visible and do not crash activation.
- CLI installed after activation: resolve again on the next action.

---

### Task 1: Add a stable missing-CLI message

**Files:**
- Create: `src/cli-readiness.ts`
- Test: `tests/cli-readiness.test.ts`

**Interfaces:**
- Produces `missingCliMessage(configuredPath: string): string` for extension and test callers.

- [ ] **Step 1: Write the failing test**

```ts
it('explains how to install the default CLI', () => {
  expect(missingCliMessage('aap-demo')).toContain('Install aap-demo');
});

it('mentions a custom CLI setting', () => {
  expect(missingCliMessage('/custom/aap-demo')).toContain('/custom/aap-demo');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli-readiness.test.ts`
Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Write minimal implementation**

Return one message containing the configured path, the dashboard install action, and the `aap-demo.cliPath` setting.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli-readiness.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli-readiness.ts tests/cli-readiness.test.ts
git commit -m "fix: explain missing aap-demo CLI"
```

### Task 2: Preflight CLI actions in the extension

**Files:**
- Modify: `src/extension.ts`
- Test: `tests/cli-readiness.test.ts`

**Interfaces:**
- Consumes `missingCliMessage` and `resolveExecutablePath`.
- Produces a preflight that publishes `prerequisites` and `command-error` without calling `CommandRunner` when the CLI is missing.

- [ ] **Step 1: Write the failing test**

Extend the helper test to verify the message includes `aap-demo.cliPath` and `Install aap-demo`; use source assertions to pin that `extension.ts` checks `resolveExecutablePath` before `service.run`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli-readiness.test.ts`
Expected: FAIL because the extension has no missing-CLI preflight.

- [ ] **Step 3: Write minimal implementation**

Build settings before resolving `cliPath`, resolve with `settings.pathValue`, and add this guard at the start of `runAction`:

```ts
if (!resolveExecutablePath(configuredCliPath, settings.pathValue)) {
  statusBar.text = 'AAP Demo: CLI not installed';
  statusBar.tooltip = missingCliMessage(configuredCliPath);
  await postDashboardMessage({ type: 'prerequisites', prerequisites: checkPrerequisites({
    cliPath: configuredCliPath,
    crcPath,
    installLocation: installLocationSetting,
    ...settings,
  }, settings.pathValue) });
  await postDashboardMessage({ type: 'command-error', action, message: missingCliMessage(configuredCliPath) });
  return;
}
```

Keep the existing post-install `runAction('status')`; it will re-resolve the CLI after installation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass, type-check succeeds, and both Vite builds succeed.

- [ ] **Step 5: Commit**

```bash
git add src/extension.ts tests/cli-readiness.test.ts
git commit -m "fix: preflight missing CLI actions"
```

### Task 3: Update issue documentation

**Files:**
- Modify: `README.md`
- Modify: `TESTING.md`
- Create: `docs/adr/002-cli-readiness.md`

- [ ] **Step 1: Document the dashboard behavior**

State that a missing or unresolved CLI is reported as a prerequisite failure with an Install action, and that custom paths must be configured through `aap-demo.cliPath`.

- [ ] **Step 2: Add the ADR**

Record the preflight decision and the consequence that CLI execution is intentionally skipped until resolution succeeds.

- [ ] **Step 3: Verify documentation and code together**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md TESTING.md docs/adr/002-cli-readiness.md
git commit -m "docs: record CLI readiness behavior"
```
