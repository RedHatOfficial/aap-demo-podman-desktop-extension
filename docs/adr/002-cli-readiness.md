# ADR-002: Preflight CLI availability before dashboard actions

- Status: Accepted
- Date: 2026-10-12
- Issue: #26

## Context

Podman Desktop can activate the extension while `aap-demo` is absent from the
extension host environment. Spawning the unresolved command produces a low-level
portal/child-process error that does not tell the user how to recover.

## Decision

Resolve `aap-demo.cliPath` against the extension’s augmented `PATH` before every
CLI action. When resolution fails, publish the prerequisite state and an
actionable dashboard error that points to **Install aap-demo** or the configured
path setting. Do not spawn a child process in this state. Re-evaluate the path on
each action so an install performed after activation is recognized immediately.

## Consequences

The dashboard becomes usable even when the CLI is missing, and users receive a
stable recovery path instead of a platform-specific process error. CLI version
detection may remain `unknown` until the next activation, but action execution
uses the current resolved path.
