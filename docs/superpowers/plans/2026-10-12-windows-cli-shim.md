# Windows CLI Shim Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a configured Windows `aap-demo.cmd` path without passing literal surrounding quotes or relying on unsupported direct `.cmd` spawning.

**Architecture:** Normalize configured executable values at the resolver boundary, then adapt Windows batch shims at the command-runner boundary. POSIX execution remains unchanged; Windows tests use injectable platform options and a pure shell-command formatter.

**Tech Stack:** TypeScript, Node.js `child_process.spawn`, Vitest.

**Spec:** GitHub issue #25: Windows CLI path fails because a double-quoted path is treated as part of the command.

## Global Constraints

- Remove only one matching pair of outer single or double quotes.
- Never remove quotes embedded inside a real path.
- Preserve argument boundaries when invoking `.cmd` or `.bat` files.
- Run tests, type-check, and build.

## Review Focus

- Quoted absolute Windows path: spawn the unquoted path.
- Unquoted `.cmd` path with spaces: quote it exactly once for the shell.
- Arguments containing spaces or quotes: preserve them independently.
- POSIX executables: keep the existing direct-spawn behavior.
- Missing executable: preserve the configured value for the useful error.

---

### Task 1: Normalize configured executable paths

**Files:**
- Modify: `src/executable-path.ts`
- Test: `tests/executable-path.test.ts`

**Interfaces:**
- `resolveExecutablePath` and `resolveConfiguredExecutable` accept the existing command/path signatures and return unquoted paths.

- [ ] **Step 1: Write the failing test**

```ts
it('removes surrounding quotes from a configured Windows path', () => {
  expect(resolveConfiguredExecutable('"C:\\\\Users\\\\demo\\\\aap-demo.cmd"', '', {
    platform: 'win32',
  })).toBe('C:\\Users\\demo\\aap-demo.cmd');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/executable-path.test.ts`
Expected: FAIL because the returned value still contains quotes.

- [ ] **Step 3: Write minimal implementation**

Strip a matching outer quote pair before home expansion and executable lookup. Do not alter interior characters.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/executable-path.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/executable-path.ts tests/executable-path.test.ts
git commit -m "fix: normalize quoted executable paths"
```

### Task 2: Execute Windows batch shims safely

**Files:**
- Modify: `src/command-runner.ts`
- Test: `tests/command-runner.test.ts`

**Interfaces:**
- Produces `windowsShellCommand(command, args)` for deterministic shell formatting.

- [ ] **Step 1: Write the failing test**

```ts
it('quotes a Windows shim and each argument once', () => {
  expect(windowsShellCommand('C:\\Program Files\\aap-demo.cmd', ['status'])).toBe(
    '"C:\\Program Files\\aap-demo.cmd" "status"',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/command-runner.test.ts`
Expected: FAIL because the formatter does not exist.

- [ ] **Step 3: Write minimal implementation**

When the platform is Windows, `shell` was not explicitly set, and the command extension is `.cmd` or `.bat`, set `shell: true`, pass one quoted command string, and clear the separate argument array. Use the existing output/error capture paths.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/command-runner.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/command-runner.ts tests/command-runner.test.ts
git commit -m "fix: invoke Windows CLI shims through the shell"
```

### Task 3: Record Windows behavior

**Files:**
- Modify: `README.md`
- Modify: `TESTING.md`
- Create: `docs/adr/003-windows-cli-shims.md`

- [ ] **Step 1: Document configuration**

Explain that `aap-demo.cliPath` may be an absolute `.cmd` path with or without surrounding quotes and that the extension removes only the outer pair.

- [ ] **Step 2: Add the ADR**

Record why the resolver owns normalization and the runner owns batch-file invocation.

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md TESTING.md docs/adr/003-windows-cli-shims.md
git commit -m "docs: record Windows CLI shim handling"
```
