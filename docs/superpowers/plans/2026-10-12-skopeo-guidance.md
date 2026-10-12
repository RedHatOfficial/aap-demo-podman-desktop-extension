# Skopeo Installation Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the APME EAP add-on’s noninteractive `sudo`/missing-`skopeo` failure into a clear manual recovery message.

**Architecture:** Detect the known prerequisite-installation signature in the shared command-error formatter and replace the opaque shell failure with distro-aware terminal instructions. The add-on command remains unchanged because the extension cannot safely collect or relay an administrator password.

**Tech Stack:** TypeScript, Vitest.

**Spec:** GitHub issue #23: enabling `apme-eap` fails when `skopeo` is absent and `sudo` cannot prompt from the extension.

## Global Constraints

- Never ask the extension to capture or transmit a sudo password.
- Keep the guidance specific to the missing `skopeo` prerequisite.
- Tell the user to retry the add-on after installation.
- Run tests, type-check, and build.

## Review Focus

- Missing skopeo plus terminal-required sudo: show manual installation steps.
- Missing skopeo without sudo text: preserve the original error.
- Unrelated sudo failures: do not mislabel them as skopeo setup.
- Add-on output with ANSI or extra lines: match case-insensitively without losing output.
- Successful add-on runs: do not change the command path.

---

### Task 1: Add focused error guidance

**Files:**
- Modify: `src/command-error.ts`
- Test: `tests/command-error.test.ts`

**Interfaces:**
- `formatCommandError` continues to accept an unknown error and returns a user-facing string.

- [ ] **Step 1: Write the failing test**

```ts
it('explains how to install skopeo when sudo cannot prompt', () => {
  const error = new CommandExecutionError('Command exited unsuccessfully: aap-demo', {
    exitCode: 1, signal: null, stdout: 'INFO: skopeo not found — installing...',
    stderr: 'sudo: a terminal is required to read the password',
  });
  expect(formatCommandError(error)).toContain('sudo dnf install skopeo');
  expect(formatCommandError(error)).toContain('retry enabling apme-eap');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/command-error.test.ts`
Expected: FAIL because the formatter currently returns only raw command output.

- [ ] **Step 3: Write minimal implementation**

Match `skopeo not found` together with `sudo` and either `terminal` or `password`; return concise instructions for an interactive terminal, including `sudo dnf install skopeo`, `command -v skopeo`, and retry guidance. Keep the existing formatter path for nonmatching errors.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/command-error.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/command-error.ts tests/command-error.test.ts
git commit -m "fix: explain noninteractive skopeo installation"
```

### Task 2: Document the administrator boundary

**Files:**
- Modify: `README.md`
- Modify: `TESTING.md`
- Create: `docs/adr/004-noninteractive-skopeo.md`

- [ ] **Step 1: Document recovery**

Explain that the extension reports the prerequisite and leaves privileged installation to a terminal, then instructs users to retry the add-on.

- [ ] **Step 2: Add the ADR**

Record why password prompting is intentionally not implemented in the extension.

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md TESTING.md docs/adr/004-noninteractive-skopeo.md
git commit -m "docs: record noninteractive skopeo recovery"
```
