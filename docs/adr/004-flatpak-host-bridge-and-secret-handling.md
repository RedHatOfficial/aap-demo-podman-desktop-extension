# ADR-004: Flatpak host bridge and secret handling

- Status: Accepted
- Date: 2026-10-07

## Context

This pull request makes the extension work consistently when Podman Desktop
runs inside Flatpak. The extension process is sandboxed, while `aap-demo`,
Git, Bash, CRC, cached `oc`, and credential files live on the host. The change
also covers the dashboard's CLI install/update path, normal CLI actions, AO
provider configuration, and host-file checks and writes.

Without an explicit host boundary, a host tool can appear to be missing, a
user-local executable can disappear because `PATH` was not forwarded, or a
credential can be written inside the sandbox where the host-side CLI cannot
read it. Passing `OPENAI_API_KEY` as a Flatpak environment argument would also
expose the secret in process arguments and diagnostics.

## Decision

On non-Windows Flatpak installations, normal `aap-demo` actions and the Git,
Bash, and install/update helper commands use `flatpak-spawn --host` when it is
available. The configured augmented `PATH` is forwarded through that bridge,
including for the CRC cache locations that may contain `oc`.

The host bridge forwards the non-secret CLI settings needed by the workflow,
including quiet mode, UTF-8 settings, CRC resources, pull-secret location, AO
provider settings, and the Galaxy token path. `OPENAI_API_KEY` is excluded from
all process and environment arguments. For AO add-on actions, the extension
starts a host-side `/bin/sh` wrapper, sends the key through standard input, and
lets the wrapper export it only for the host-side `aap-demo` child. Existing
saved keys are reused, so the dashboard does not prompt again unnecessarily.

Host-file checks and writes also use the host bridge. Checks reject symbolic
links, and writes create a mode-600 temporary file in the destination directory
before atomically renaming it into place. If `flatpak-spawn` is unavailable,
host-file checks report unavailable and writes fail explicitly; they never
silently operate on a sandbox path.

## Consequences

Flatpak users need `flatpak-spawn` available for host CLI and credential
operations. A missing bridge is visible as an actionable failure instead of a
partial setup that appears successful. Host commands retain access to the same
augmented tool path as non-Flatpak commands, and API keys are not exposed in
the bridge command line.

The implementation uses a small shell wrapper for the secret handoff and
requires `/bin/sh` on the host. The non-Flatpak path continues to use local
filesystem APIs and rejects symlink targets before writing.

## Validation

Unit tests cover selected environment forwarding, Flatpak host-bridge absence,
symlink-safe host-file command construction, and the guarantee that an OpenAI
API key is absent from Flatpak arguments and the child environment. Full
validation uses `npm test`, `npm run typecheck`, and `npm run build`.
