# Noninteractive CA Trust Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose repair through the extension without password-prompting sudo and explain the split between browser trust and system-wide trust.

**Architecture:** Add `repair` as a supported action, force extension-launched commands into the upstream noninteractive trust mode, and recognize CA import failures in the shared error formatter so the user receives one manual system-trust command.

**Tech Stack:** TypeScript, Podman Desktop webview, Vitest.

**Spec:** GitHub issue #22: avoid interactive sudo prompts for ingress CA trust in non-terminal runs.

## Global Constraints

- Extension-launched actions must not prompt for an administrator password.
- Preserve successful NSS/browser trust when system trust cannot be changed.
- Provide one copyable manual command for users who need system trust.
- Run tests, type-check, and build.

## Review Focus

- Repair action: it is accepted by protocol, UI, and service.
- Sudo CA failure: no duplicate raw prompt is presented as the primary message.
- Saved CA path: use it in the manual command when output provides one.
- Missing saved path: use a documented default.
- Non-CA command errors: preserve existing formatting.

---

### Task 1: Add repair and noninteractive trust mode

**Files:**
- Modify: `src/aap-demo-service.ts`
- Modify: `src/dashboard-protocol.ts`
- Modify: `src/extension.ts`
- Modify: `src/webview/index.html`
- Test: `tests/aap-demo-service.test.ts`
- Test: `tests/dashboard-protocol.test.ts`

**Interfaces:**
- `AapDemoAction` includes `repair`.
- `AapDemoService.run('repair')` passes `['repair']` and `AAP_DEMO_TRUST_CA=false`.

- [ ] **Step 1: Write failing tests**

Add `repair` to the action matrix, assert it is accepted by `isDashboardMessage`, and assert both `repair` and existing actions receive `AAP_DEMO_TRUST_CA=false`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/aap-demo-service.test.ts tests/dashboard-protocol.test.ts`
Expected: FAIL because repair and the environment variable are unsupported.

- [ ] **Step 3: Implement the action**

Add `repair` to the action union and supported set, add a Repair button, register the command with the existing action loop, and set `AAP_DEMO_TRUST_CA=false` in the service’s generated environment.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/aap-demo-service.test.ts tests/dashboard-protocol.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/aap-demo-service.ts src/dashboard-protocol.ts src/extension.ts src/webview/index.html tests/aap-demo-service.test.ts tests/dashboard-protocol.test.ts
git commit -m "fix: run repair without interactive CA trust"
```

### Task 2: Format CA trust recovery guidance

**Files:**
- Modify: `src/command-error.ts`
- Test: `tests/command-error.test.ts`

**Interfaces:**
- `formatCommandError` returns browser/NSS and system-trust guidance for the known CA import failure.

- [ ] **Step 1: Write the failing test**

Use output containing `✓ Ingress CA trusted (Chrome/Firefox NSS)`, `Could not add CA to system trust store`, and a saved CA path. Assert the message contains the saved path, `sudo cp`, `update-ca-trust`, and says browser trust succeeded.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/command-error.test.ts`
Expected: FAIL because the generic command message has no recovery guidance.

- [ ] **Step 3: Implement minimal guidance**

Match the CA/system-trust failure, extract `Ingress CA saved to <path>`, and return one manual `sudo cp ... && sudo update-ca-trust` command with the browser/NSS success statement.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/command-error.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/command-error.ts tests/command-error.test.ts
git commit -m "fix: explain browser and system CA trust results"
```

### Task 3: Document repair behavior

**Files:**
- Modify: `README.md`
- Modify: `TESTING.md`
- Create: `docs/adr/005-noninteractive-ca-trust.md`

- [ ] **Step 1: Document Repair**

State that Repair does not prompt for sudo and that successful NSS trust is distinct from system-wide trust.

- [ ] **Step 2: Add the ADR**

Record the noninteractive environment decision and the manual command boundary.

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md TESTING.md docs/adr/005-noninteractive-ca-trust.md
git commit -m "docs: record noninteractive CA trust repair"
```
