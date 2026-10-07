# ADR-001: CLI installation and resource settings

- Status: Accepted
- Date: 2026-10-03
- Updated: 2026-10-07

## Context

The Podman Desktop extension invokes the host-side `aap-demo` CLI. A newly
installed extension may not have that executable available, and Podman Desktop
does not provide a portable way for the extension to assume a source checkout
location. The AAP Demo also needs resource settings that must be passed to the
CLI before CRC creates or recreates the cluster.

The dashboard must remain usable when the CLI is missing, while avoiding
silent downloads, overwrites, or hidden changes to unrelated user directories.

## Decision

The extension provides an explicit **Install aap-demo** action in the dashboard
and an **AAP Demo: Install aap-demo CLI** command in the Command Palette. When
the CLI is already installed, it provides **Update aap-demo** in the dashboard
and **AAP Demo: Update aap-demo CLI** in the Command Palette.

The action:

1. Resolves `aap-demo.installLocation`, defaulting to `~/.aap-demo/aap-demo`.
   The parent `~/.aap-demo` remains the CLI data directory.
2. Reuses an existing Git checkout or a recognizable source tree containing
   `install.sh` and `aap-demo.sh`.
3. Clones `https://github.com/RedHatOfficial/aap-demo.git` into that location
   when absent or empty, creating parent directories as needed. If a legacy
   setting points to a populated `~/.aap-demo` data directory, it uses the
   `aap-demo` child so user data is preserved.
4. Updates an existing Git checkout with `git pull --ff-only`; a reused
   non-Git source tree can be installed but cannot be pulled for updates.
5. Runs the selected checkout's `install.sh` with Bash.
6. Streams clone, update, and install output to the dashboard, then refreshes
   CLI and prerequisite status.

When the extension runs inside a Flatpak sandbox and `flatpak-spawn` is
available, CLI actions and install/update helper commands are delegated through
`flatpak-spawn --host`. This lets `aap-demo` and its child commands see host
tools such as `crc`, Git, Bash, `oc`, and `kubectl` instead of failing inside
the sandbox. If Git or Bash is still unavailable, the dashboard reports the
missing tool directly instead of surfacing a raw `spawn ... ENOENT` error.
The augmented `PATH` is forwarded to host-side Git, Bash, and install commands
as well as to `aap-demo`, so user-local binaries and CRC's cached `oc` remain
visible after crossing the host boundary.
AO provider selection and its external-provider settings are forwarded through
the same host bridge, so choosing OpenAI does not fall back to a host-side
Ollama default.

CRC setup remains a host-level administrator operation. If an action reaches
`crc start` while the CRC daemon is unavailable, the dashboard gives explicit
terminal commands to reset the failed user service, restart the CRC socket
units, verify `crc status`, and retry. The extension does not attempt to
elevate privileges or manage the CRC daemon itself.
Repair guidance also checks for the no-cluster condition first. When
`aap-demo repair` reports that no cluster exists, the dashboard directs the
user to create and deploy the cluster before retrying repair instead of
recommending SCC commands against an unavailable OpenShift API.
The same prerequisite handling applies to `aap-demo diagnose`: without a
cluster, the dashboard directs the user to create one and does not expose the
expected missing kubeconfig path as a separate failure.

The update action requires an existing Git checkout, runs `git pull --ff-only`,
then repeats the install and refresh steps. Unrecognized existing directories
are not overwritten.

The install location can be changed in Podman Desktop settings:

```text
aap-demo.installLocation = ~/.aap-demo/aap-demo
```

The extension passes the following settings to the CLI for every command:

| Podman Desktop setting | Environment variable | Default | Validation |
| --- | --- | --- | --- |
| `aap-demo.pullSecretPath` | `PULL_SECRET_PATH` | automatic lookup | file path when configured |
| `aap-demo.cpus` | `CRC_CPUS` | `8` | integer, minimum `8` |
| `aap-demo.memory` | `CRC_MEMORY` | `24576` MiB | integer, minimum `16384` MiB |
| `aap-demo.cliPath` | executable path | `aap-demo` | resolved through configured and user-local paths |
| `aap-demo.crcPath` | CRC executable path | `crc` | resolved through configured and user-local paths |

The augmented PATH includes common user/package-manager locations and CRC
locations, including CRC cache directories that contain an executable `oc`
client. This lets the host-side `aap-demo` CLI use its existing `kubectl` to
`oc` fallback when CRC provides `oc` but the host does not have a separate
`kubectl` binary installed.

AO provider setup is selected with three explicit dashboard actions: **AO with
OpenAI**, **AO with Ollama**, and **AO no AI**. The OpenAI action reads
`aap-demo.aoLlmModel`, `aap-demo.aoLlmBaseUrl`, and
`aap-demo.aoLlmApiKeyFile`, whose defaults are `gpt-5.6-luna`,
`https://api.openai.com/v1`, and a blank key-file override (which uses
`$AAP_DEMO_DIR/ao/llm-api-key` or `~/.aap-demo/ao/llm-api-key`). If the key is
not already present, the extension collects it in a masked input. It passes
the key only to the CLI process; the CLI stores it in the configured key file
with restricted permissions. The key itself is not a Podman Desktop setting.
A previously saved key is reused, so enabling AO again does not prompt for it
unnecessarily. The Flatpak secret-handling and host-file safety rules are
recorded in [ADR-004](004-flatpak-host-bridge-and-secret-handling.md).

CPU and memory changes affect CRC when the cluster is created or recreated;
they do not resize an already-running VM automatically.

The dashboard is opened through Podman Desktop by clicking the bottom status
item or using **F1 → AAP Demo: Open Dashboard**. Opening the source HTML with
`file://` is not a supported test path because it does not provide the host
bridge.

The extension opens the dashboard automatically after activation so its
navigation entry is present and selected after Podman Desktop starts. This
defaults to enabled and can be disabled with
`aap-demo.openDashboardOnStartup = false`.

For development with the custom OCI image, the dashboard can prepare the
extension's local Git checkout and provide **Update extension** for local
builds. This is a temporary developer workflow, not part of the eventual
catalog-distributed user experience. When the extension is published through
the Podman Desktop catalog, retire this OCI-to-local setup/update workflow in
favor of catalog distribution and updates.

Preparing or updating the local extension requires Git and Node.js 24 or newer
with npm. When Node.js/npm are missing, the dashboard explains the requirement
and offers a package-manager install for RHEL derivatives (DNF), macOS
(Homebrew), or Windows (WinGet). The action opens a visible terminal for the
user to review and run the install command. It never elevates privileges or
installs packages silently; any administrator prompt is handled interactively
by the package manager in that terminal. The extension re-checks the runtime
after the user returns. If the package manager is unavailable or the installed
version does not meet the requirement (for example, if a RHEL repository only
offers an older Node.js), it gives manual next steps. If Podman Desktop must be
restarted before retrying, the user starts setup/update again; the source
checkout is preserved and the runtime retry is not persisted across restarts.

From the custom OCI extension, **Set up local extension updates** clones the
extension repository into `aap-demo.extensionInstallLocation`, defaulting to
`~/.aap-demo-podman-desktop-extension`, and runs `npm ci` plus the production
build. It refuses to overwrite a non-Git directory and only updates a checkout
whose origin is the official extension repository. The user then manually
removes the custom OCI extension and adds the checkout under **Extensions →
Local Extensions**. The action does not replace the OCI extension. Once
running locally, **Update extension** updates that same source checkout; the
CLI repository remains independently managed through `aap-demo.installLocation`.

The local build runs `git pull --ff-only`, `npm ci`, and the production build;
the user then stops and starts the local extension to load the rebuilt files.
The local updater is hidden for OCI-installed extensions. Disabling and
re-enabling an OCI extension only restarts the installed image. During
development, updating a Quay image therefore requires uninstalling the
installed extension and reinstalling the desired image tag from
**Extensions → Install custom...**. Commit-specific or version-specific tags
are preferred for repeatable testing.

This source setup/update bridge is temporary and developer-only. It should be
retired when catalog distribution becomes the supported installation path;
catalog users should not be asked to clone or build the source repository.

## Consequences

This gives users a discoverable installation path without requiring a separate
manual CLI setup for the common case. Source defaults to
`~/.aap-demo/aap-demo`, separate from the CLI's `~/.aap-demo` data directory.
Existing checkouts and recognizable source trees are reused, while unrelated
files remain untouched. The extension also detects the previous
`~/.aap-demo` install-location setting and selects a child checkout without
requiring users to change that setting.

The CLI action still depends on `git`, Bash, network access, and the
dependencies handled by `install.sh`. When Podman Desktop is installed as a
Flatpak, normal `aap-demo` actions and Git/Bash helper calls are attempted
through `flatpak-spawn --host` when available; otherwise the user still needs
those tools visible to the extension host.

When CRC is missing, the dashboard offers **Install with Podman Desktop**,
which opens the Podman Desktop Extensions catalog with a search for OpenShift
Local when that navigation API is available. Older Podman Desktop versions
fall back to the Resources page, and failures show a concise warning. The
dashboard does not show a separate install-guide link or extra explanatory
text in the prerequisite row.

If the OpenShift Local extension is installed or enabled in Podman Desktop but
the `crc` executable is not visible to this extension host, the CRC
prerequisite is still considered satisfied and is shown as **Managed by Podman
Desktop**. Extension change events refresh the prerequisite card so installing
or enabling OpenShift Local updates the dashboard without requiring a full
restart. The AAP Demo extension never downloads or installs CRC itself and
never supplies the Red Hat pull secret automatically. The developer-only
Node.js/npm install offer likewise uses a visible terminal so package-manager
and administrator prompts remain under the user's control.
