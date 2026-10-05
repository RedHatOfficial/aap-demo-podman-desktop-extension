# ADR-001: CLI installation and resource settings

- Status: Accepted
- Date: 2026-10-03

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

1. Resolves `aap-demo.installLocation`, defaulting to `~/.aap-demo`.
2. Clones `https://github.com/RedHatOfficial/aap-demo.git` into that location
   when it does not exist.
3. Updates an existing Git checkout with `git pull --ff-only`.
4. Refuses to use an existing non-Git directory rather than overwriting it.
5. Runs the checked-out `install.sh` with Bash.
6. Streams clone, update, and install output to the dashboard, then refreshes
   CLI and prerequisite status.

The update action requires an existing Git checkout, runs `git pull --ff-only`,
then repeats the install and refresh steps. It never overwrites a non-Git
directory.

The install location can be changed in Podman Desktop settings:

```text
aap-demo.installLocation = ~/.aap-demo
```

The extension passes the following settings to the CLI for every command:

| Podman Desktop setting | Environment variable | Default | Validation |
| --- | --- | --- | --- |
| `aap-demo.pullSecretPath` | `PULL_SECRET_PATH` | automatic lookup | file path when configured |
| `aap-demo.cpus` | `CRC_CPUS` | `8` | integer, minimum `4` |
| `aap-demo.memory` | `CRC_MEMORY` | `24576` MiB | integer, minimum `16384` MiB |
| `aap-demo.cliPath` | executable path | `aap-demo` | resolved through configured and user-local paths |
| `aap-demo.crcPath` | CRC executable path | `crc` | resolved through configured and user-local paths |

AO provider setup is selected with three explicit dashboard actions: **AO with
OpenAI**, **AO with Ollama**, and **AO no AI**. The OpenAI action reads
`aap-demo.aoLlmModel`, `aap-demo.aoLlmBaseUrl`, and
`aap-demo.aoLlmApiKeyFile`, whose defaults are `gpt-5.6-luna`,
`https://api.openai.com/v1`, and a blank key-file override (which uses
`$AAP_DEMO_DIR/ao/llm-api-key` or `~/.aap-demo/ao/llm-api-key`). If the key is
not already present, the extension collects it in a masked input. It passes
the key only to the CLI process; the CLI stores it in the configured key file
with restricted permissions. The key itself is not a Podman Desktop setting.

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
manual CLI setup for the common case. The default checkout is predictable and
can be updated safely. The non-Git-directory check prevents accidental data
loss, but users with an existing `~/.aap-demo` data directory must choose a
different install location or migrate that directory intentionally.

The CLI action still depends on `git`, Bash, network access, and the
dependencies handled by `install.sh`. Interactive administrator prompts may
not work through the extension host; those installs should be run from a
terminal. When CRC is missing, the dashboard offers **Install with Podman
Desktop**, which opens the OpenShift Local extension page using Podman Desktop's
extension deep link. The user confirms installing that extension and then uses
its own dashboard to install CRC binaries. This keeps Podman Desktop's
confirmation, prerequisite checks, and any required system prompts in control;
the AAP Demo extension never downloads or installs CRC itself and never supplies
the Red Hat pull secret automatically. The developer-only Node.js/npm install
offer likewise uses a visible terminal so package-manager and administrator
prompts remain under the user's control.
