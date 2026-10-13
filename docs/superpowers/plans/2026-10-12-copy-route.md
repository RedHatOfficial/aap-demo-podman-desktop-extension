# AAP Route Copy Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy an AAP access URL in the webview and report the actual clipboard result instead of attempting to open the URL.

**Architecture:** Add a small browser clipboard adapter with a modern API and textarea fallback. Render a dedicated Copy Link button beside each route; route navigation remains owned by the existing host bridge and is not used for copying.

**Tech Stack:** TypeScript DOM APIs, Podman Desktop webview, Vitest.

**Spec:** GitHub issue #21: AAP Access URL Copy Link reports an error even though the URL is copied.

## Global Constraints

- Copy must never send an `open-url` message.
- Report success only after a clipboard mechanism resolves successfully.
- Keep route links independently clickable.
- Run tests, type-check, and build.

## Review Focus

- Clipboard API success: show Copied.
- Clipboard API rejection: try the textarea fallback.
- No clipboard API or failed fallback: show Copy failed.
- Route click: still opens the exact URL through the host bridge.
- Multiple routes: each gets an independent copy button.

---

### Task 1: Implement and test clipboard adapter

**Files:**
- Create: `src/webview/clipboard.ts`
- Test: `tests/clipboard.test.ts`

**Interfaces:**
- Produces `copyText(text: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing tests**

Cover Clipboard API success, API rejection followed by `document.execCommand('copy')`, and unavailable mechanisms returning `false`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/clipboard.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement minimal adapter**

Use `navigator.clipboard.writeText` first. On rejection or absence, create a readonly off-screen textarea, select it, call `document.execCommand('copy')`, and remove it in `finally`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/clipboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/webview/clipboard.ts tests/clipboard.test.ts
git commit -m "fix: add clipboard fallback for dashboard actions"
```

### Task 2: Separate route copying from route navigation

**Files:**
- Modify: `src/webview/dashboard.ts`
- Modify: `src/webview/index.html`
- Test: `tests/route-copy.test.ts`

**Interfaces:**
- `renderRoutes` creates one link and one `Copy Link` button per route.

- [ ] **Step 1: Write the failing test**

Assert the dashboard source imports `copyText`, creates `Copy Link`, and does not use `postToHost({ type: 'open-url' })` in the copy handler.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/route-copy.test.ts`
Expected: FAIL because routes have no dedicated copy behavior.

- [ ] **Step 3: Implement route action**

Create a button that calls `copyText(route)`, changes its label to `Copied` only for a true result, and otherwise uses `Copy failed`; restore `Copy Link` after 1200 ms. Keep `addExternalLink` attached only to the anchor.

- [ ] **Step 4: Add spacing and verify**

Add `.route-actions` styling, then run `npm test && npm run typecheck && npm run build`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/webview/dashboard.ts src/webview/index.html tests/route-copy.test.ts
git commit -m "fix: copy AAP routes without opening them"
```

### Task 3: Document the copy contract

**Files:**
- Modify: `README.md`
- Modify: `TESTING.md`
- Create: `docs/adr/006-route-copy.md`

- [ ] **Step 1: Document behavior**

State that Copy Link uses the webview clipboard and that link navigation remains separate.

- [ ] **Step 2: Add the ADR**

Record why copying is a local webview operation rather than an `open-url` host message.

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md TESTING.md docs/adr/006-route-copy.md
git commit -m "docs: record AAP route copy behavior"
```
