# Python Lifecycle Transition Design

## Goal

After `RedHatOfficial/aap-demo#264` lands, let the Podman Desktop extension use
the Python `aap-demo` 2.0.0.dev2 CLI for the core cluster lifecycle and the
Kubernetes-native Fleet addon, while keeping the existing Bash integration for
features that have not yet moved to Python.

The intended user outcome is that the dashboard can create, deploy, start,
stop, destroy, and inspect the Python-managed cluster, and enable or disable
Python Fleet, without requiring the full extension migration to happen in the
same change.

## Context and constraints

- PR #264 merges the Python CLI into `aap-demo` `main`; the package version
  remains `2.0.0.dev2`.
- The installed Python command currently resolves as `aap-demo` and reports
  `aap-demo 2.0.0.dev2`.
- The Python CLI exposes `create`, `deploy`, `start`, `stop`, `destroy`,
  `status`, `enable fleet`, and `disable fleet`, among other commands.
- Python status text remains close enough to the existing status contract to
  preserve the dashboard model, including `Tool`, `Built`, `Infra`, `Cluster`,
  `Kubeconfig`, `AAP Deployments`, `Credentials`, `Addons`, and `TLS` sections.
- Python uses XDG config/state locations and supports `AAP_DEMO_PULL_SECRET`,
  `--pull-secret`, and subscription manifests; the Bash integration uses the
  older `~/.aap-demo` and credential-attachment flow.
- Existing Bash-only lifecycle helpers and add-ons must remain available until
  the later full-Python migration.
- The extension must not put credentials or subscription manifests in process
  arguments or Podman Desktop settings.

## Scope

### Python-backed actions in this slice

- `create`
- `deploy`
- `start`
- `stop`
- `destroy`
- `status` for the core dashboard status contract
- `enable fleet`
- `disable fleet`

The extension will invoke these through a Python CLI backend and use the
Python CLI's supported flags and environment variables. Destructive or
confirmation-sensitive actions will run non-interactively in the same way the
current dashboard actions do, while preserving Python's safe subscription
manifest behavior unless the user has explicitly configured automatic license
application.

### Bash-backed actions retained for now

- `idle`
- `diagnose`
- `repair`
- `trust-ca`
- Existing Bash-only add-ons such as AO, portal, MCP server, and setup-pah.

The existing Bash CLI path and installer/update flow remain available for these
actions. The design must keep the two command paths explicit so installing the
Python executable at `~/.local/bin/aap-demo` does not silently route a Bash-only
action into an unsupported Python command.

### Out of scope

- Replacing the Bash installer/update flow with pipx management.
- Migrating every legacy add-on to Python.
- Removing Bash scripts, Bash add-on deployers, or the legacy CLI checkout.
- Publishing a new Python version.
- Implementing Python commands that PR #264 marks as not implemented.
- Adding Fleet node-management UI beyond the existing enable/disable addon
  control; the Python CLI remains responsible for node defaults and lifecycle.

## Design

### 1. Explicit backend routing

Introduce a backend-aware command service rather than making every action call
the same executable. The service will retain the existing Bash resolver and add
a Python resolver/configuration, with action routing owned in one place:

```text
Python: create, deploy, start, stop, destroy, status, fleet enable/disable
Bash:   idle, diagnose, repair, trust-ca, legacy add-ons
```

The Python path will be configurable for installed-command and testability
reasons, defaulting to `aap-demo`. The legacy path will remain the existing
`cliPath` behavior, with documentation and readiness errors making it clear
when a Bash-only action needs the legacy executable or checkout.

Flatpak execution will use the existing host bridge for both paths. Only
Python-supported environment variables will be forwarded to the Python
command; in particular, Python deployment will use `AAP_DEMO_PULL_SECRET` or
the explicit `--pull-secret` argument rather than the Bash-only
`PULL_SECRET_PATH` convention.

### 2. Python lifecycle and deploy behavior

The dashboard's existing lifecycle controls will route through the Python
backend for the in-scope actions. The extension will continue to apply CRC CPU
and memory settings before create/start/deploy when required, but will avoid
passing Bash-only image-cache and subscription-attachment controls to Python.

Python deploy will use the CLI's pull-secret discovery and subscription
manifest semantics:

- Discover configured pull secrets in the Python XDG config/state locations,
  while retaining legacy `~/.aap-demo` compatibility.
- Pass an explicitly configured pull-secret path through the Python-supported
  setting/flag.
- Do not run the existing Windows controller API subscription attachment after
  a Python deploy; Python handles manifests and the user-facing AAP workflow.
- Keep automatic manifest application opt-in and preserve the CLI's safe
  behavior when no manifest or approval is available.

### 3. Status and Fleet state

Python `status` becomes the source for core cluster, route, credential,
kubeconfig, TLS, and version data. The existing parser will be extended or
given a structured-data path so the dashboard does not depend on incidental
Rich formatting.

Python's status report does not expose Fleet as one of the normal status
addons, so the extension will obtain Fleet's enabled state through a separate
structured Python query against the Python config/state and merge a synthetic
Fleet entry into the dashboard status. Existing legacy add-on state may be
merged from the Bash status path when that path is available; failure to read
legacy add-ons must not make Python core status unavailable.

The existing Fleet control will become visible only for the Python Fleet
capability. Its enable/disable requests will call `aap-demo enable fleet` and
`aap-demo disable fleet`, stream output through the existing dashboard channel,
and refresh both Python Fleet state and core status afterward. Python's
`--no-import` behavior remains a CLI concern and is not silently selected by
the extension.

### 4. Readiness and user guidance

The dashboard will distinguish “legacy CLI missing” from “Python CLI missing”
for actions routed to each backend. The Python readiness message will identify
the required beta version and show the supported installation direction (pipx,
pip, or uv) without attempting package installation in this slice.

Documentation will explain the transitional state: install
`aap-demo==2.0.0.dev2` for the Python-backed actions, keep the legacy command
available for Bash-only features, and place pull secrets/manifests in the
Python-supported locations or configure their paths.

## Verification strategy

- Unit-test action-to-backend routing, Python argument/environment construction,
  Flatpak host forwarding, and missing-backend diagnostics.
- Test Python status parsing/normalization against the installed command's
  `2.0.0.dev2` output shape and structured Fleet state.
- Test pull-secret candidate ordering across XDG and legacy locations.
- Test deploy behavior on Windows to prove Python bypasses legacy subscription
  attachment while Bash deploy behavior remains unchanged where applicable.
- Test Fleet visibility, enable/disable messages, state refresh, and legacy
  add-on filtering in the webview helpers.
- Run the existing Vitest suite, typecheck, Python helper tests, and production
  build before implementation is considered complete.

## Future migration seam

The backend routing abstraction is intentionally the seam for the later full
Python migration. Future work can move `idle`, `diagnose`, `repair`,
`trust-ca`, and each legacy add-on by changing routing and capability metadata,
without reworking the dashboard message protocol or command execution safety.
