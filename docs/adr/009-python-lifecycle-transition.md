# ADR-009: Transition core lifecycle actions to the Python CLI

- Status: Accepted
- Date: 2026-11-02
- Related: `RedHatOfficial/aap-demo#264`
- Design: [Python lifecycle transition](../superpowers/specs/2026-11-02-python-lifecycle-transition-design.md)

## Context

`aap-demo#264` moves the Python `aap-demo` CLI, version `2.0.0.dev2`, onto the
upstream `main` branch. The Python command now provides the core cluster
lifecycle (`create`, `deploy`, `start`, `stop`, `destroy`, and `status`) and a
Kubernetes-native `fleet` addon. The Podman Desktop extension currently routes
all actions through the older Bash-oriented command and assumes its install,
state, output, and subscription-attachment behavior.

A full Python migration is intentionally larger than this first cutover. Some
existing add-ons and helper commands remain Bash-only, so replacing the single
CLI path immediately would make those actions fail or route to Python commands
that are not implemented. The extension also needs to recognize Python's XDG
state/config locations and avoid applying the old Windows controller API
subscription flow to Python deploys.

## Decision

Use explicit backend routing in the extension.

The Python backend owns:

- `create`
- `deploy`
- `start`
- `stop`
- `destroy`
- `status` for core dashboard state
- `enable fleet`
- `disable fleet`

The existing Bash backend remains responsible for `idle`, `diagnose`, `repair`,
`trust-ca`, and legacy add-ons until a later migration.

Add a separately configurable Python CLI path, defaulting to `aap-demo`, while
retaining the existing legacy CLI path. Both paths use the existing Flatpak
host bridge when required. Backend-specific environment variables and flags
are passed only to the backend that supports them.

Python deploy will use `AAP_DEMO_PULL_SECRET` or `--pull-secret` and Python's
XDG pull-secret/manifest discovery. The extension will retain compatibility
with pull secrets in `~/.aap-demo`, but it will not run the legacy Windows
subscription-attachment flow after a Python deploy. Automatic manifest
application remains opt-in.

Python status supplies core cluster, route, credential, kubeconfig, TLS, and
version data. Fleet state is queried separately through Python structured
output and merged into the dashboard model because Fleet is not included in
Python's normal status addon list. Legacy addon state may be merged when the
Bash backend is available; a legacy status failure must not prevent Python
core status from rendering.

The existing Fleet dashboard control will call Python `enable fleet` and
`disable fleet`, stream command output through the existing message channel,
and refresh core status and Fleet state after completion. The extension will
not silently select `--no-import`; Python's default Fleet registration behavior
remains authoritative.

## Consequences

The extension can manage the Python cluster lifecycle and Kubernetes-native
Fleet immediately after the upstream cutover without blocking on migration of
all legacy add-ons. Users must have the Python beta installed for those
actions and must retain a usable legacy CLI path for Bash-only features.

The extension carries two command resolvers and a small status aggregation
layer during the transition. Pull-secret readiness must check both Python XDG
locations and the legacy location, and tests must cover both backend routing
and Flatpak host execution.

The existing Bash installer/update flow remains in place for now. Python
installation guidance is documented, but automatic pipx/pip/uv management is
deferred to the full migration.

## Future migration

When the remaining commands and add-ons are supported by Python, move their
routing and capability metadata to the Python backend, retire the legacy
installer/update path, and remove the compatibility status merge. The backend
routing seam introduced by this decision is the migration boundary for that
work.
