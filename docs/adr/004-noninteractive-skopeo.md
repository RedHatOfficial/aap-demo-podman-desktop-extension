# ADR-004: Explain privileged skopeo installation failures

- Status: Accepted
- Date: 2026-10-12
- Issue: #23

## Context

The `apme-eap` add-on needs `skopeo`. Its upstream prerequisite check may try to
install the package with `sudo`, but a Podman Desktop extension command has no
interactive terminal. The resulting password-prompt error is not actionable and
the extension must not handle administrator credentials.

## Decision

When command output identifies both a missing `skopeo` and a noninteractive sudo
failure, format a recovery message that tells the user to run
`sudo dnf install skopeo` in a terminal, verify `command -v skopeo`, and retry
enabling `apme-eap`. Leave all other command errors unchanged.

## Consequences

Users get a safe, deterministic recovery path and no password is collected by
the extension. Installation still requires a terminal and the host’s package
manager, which is an explicit prerequisite of this workflow.
