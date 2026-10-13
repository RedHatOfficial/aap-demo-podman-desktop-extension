# Flatpak Host CLI Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Flatpak-launched CLI actions use host executables and host utility paths, including `/usr/sbin/getcap`.

**Architecture:** Detect `FLATPAK_ID`, invoke the CLI through `flatpak-spawn --host`, and forward the augmented `PATH` plus resource environment variables. Non-Flatpak execution remains direct.

**Tech Stack:** TypeScript, Node.js child processes, Flatpak, Vitest.

**Spec:** GitHub issue #20.

## Global Constraints

- Preserve direct execution outside Flatpak.
- Do not use shell string concatenation for CLI arguments.
- Include `/usr/sbin` and `/sbin` in the host search path.
- Run tests, type-check, and build.

## Review Focus

- Flatpak with `flatpak-spawn`: use `--host` and forwarded PATH.
- Missing wrapper: preserve a useful direct-command fallback.
- Non-Flatpak systems: no wrapper.
- Pull secret, CPU, and memory remain environment variables.

---

### Task 1: Host command wrapper

**Files:** Create `src/host-command.ts`; test `tests/host-command.test.ts`.

- [ ] Add tests for direct resolution, Flatpak `--host` resolution, and environment forwarding; verify they fail.
- [ ] Implement `resolveHostCommand` and `forwardHostEnvironment`.
- [ ] Run `npm test -- tests/host-command.test.ts` and commit.

### Task 2: Service integration

**Files:** Modify `src/aap-demo-service.ts`, `src/executable-path.ts`, `src/extension.ts`; test service and executable-path suites.

- [ ] Add failing coverage for Flatpak deploy arguments and `/usr/sbin`/`/sbin` PATH entries.
- [ ] Resolve service commands through the host wrapper and forward PATH/resource settings.
- [ ] Run the focused tests and `npm run typecheck`; commit.

### Task 3: Documentation

**Files:** Modify `README.md`, `TESTING.md`; create `docs/adr/007-flatpak-host-execution.md`.

- [ ] Document host execution, required host packages, and the verification step.
- [ ] Run `npm test && npm run typecheck && npm run build`; commit.
