# ADR-007: Execute the CLI in the host environment from Flatpak

- Status: Accepted
- Date: 2026-10-12
- Issue: #20

## Context

Podman Desktop’s Flatpak sandbox may not expose host-installed `aap-demo` or
utilities such as `getcap`, even when they exist at `/usr/sbin/getcap`.

## Decision

When `FLATPAK_ID` is present, invoke the configured CLI through
`flatpak-spawn --host`. Forward the augmented `PATH` and resource environment
variables before `--host`; the fallback PATH includes `/usr/sbin` and `/sbin`.
Non-Flatpak execution remains direct.

## Consequences

Host-installed tools become visible to deploy without copying them into the
sandbox. Host packages and Flatpak host-spawn permission remain prerequisites.
