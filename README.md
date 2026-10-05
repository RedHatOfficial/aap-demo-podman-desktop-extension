# AAP Demo Podman Desktop extension

This repository contains the Podman Desktop extension for managing the local
`aap-demo` environment.

## Quick install

In Podman Desktop, open **Extensions → Install custom...**, select **OCI
Image**, and enter:

```text
quay.io/cferman/aap-demo-podman-desktop-extension:latest
```

Select **Install**. The Quay repository must be public, or Podman must be
authenticated to Quay. The extension can install the `aap-demo` CLI, but you
still need OpenShift Local (CRC), a Red Hat pull secret, and enough host
resources for the AAP Demo environment.

## Open the dashboard

The dashboard opens automatically when Podman Desktop starts. Set
`aap-demo.openDashboardOnStartup` to `false` in Podman Desktop settings if you
prefer to open it yourself. You can also open it at any time using either of
these methods:

- Click the `AAP Demo: ...` status item at the bottom of the Podman Desktop
  window.
- Press **F1**, search for **AAP Demo: Open Dashboard**, and press **Enter**.

Do not open `src/webview/index.html` directly in a browser. That bypasses
Podman Desktop's extension host bridge and the dashboard actions will not
work.

## Install the aap-demo CLI

If the CLI is missing, click **Install aap-demo** in the dashboard's **Status**
box, or run **AAP Demo: Install aap-demo CLI** from the **F1** Command Palette.
The extension clones or updates the official repository and runs its
`install.sh`:

```text
~/.aap-demo/install.sh
```

Set `aap-demo.installLocation` in Podman Desktop settings to use a different
directory. An existing Git checkout is updated with `git pull --ff-only`; an
existing non-Git directory is never overwritten. The install output is shown
under **Command output**. If the script needs an interactive administrator
password or dependency installation, run it from a terminal instead.

When the CLI is already installed, click **Update aap-demo** in the **Status**
box, or run **AAP Demo: Update aap-demo CLI** from the **F1** Command Palette.
This pulls the configured checkout with `git pull --ff-only`, reruns
`install.sh`, streams the output, and refreshes status and prerequisites.

## Development

```bash
npm ci
npm test
npm run typecheck
npm run build
```

For local UI iteration without manually rebuilding after every edit, use:

```bash
npm run watch
```

Run `npm run build` from this repository, then follow the one-time Podman
Desktop local-extension setup in [TESTING.md](TESTING.md).

For a repeatable local workflow, use the helper script:

```bash
python3 scripts/podman_extension.py verify --install
python3 scripts/podman_extension.py build --open
python3 scripts/podman_extension.py local
```

`verify` runs the tests, typecheck, and production build. `--install` runs
`npm ci` when dependencies are not present. `--open` launches Podman Desktop
and prints the Local Extensions steps. Podman Desktop still requires selecting
the repository folder once in its UI; the helper does not remove or reinstall
an existing OCI extension.

Use `local` as the shortcut for building this checkout and opening Podman
Desktop for the local-extension replacement flow. If the old OCI copy is
installed, remove it from **Extensions → Installed** first, then add this
checkout under **Extensions → Local Extensions**. Those two UI operations are
not exposed through a supported Podman Desktop CLI/API.

To build an OCI image without using host npm, run
`./build-image.sh` from the repository root. It builds
`localhost/aap-demo-podman-extension:dev` with Podman and prints the steps for
installing it through **Extensions → Install custom...**. Pass a different
image name as the first argument when needed.

The current OCI image is published to Quay:

```text
quay.io/cferman/aap-demo-podman-desktop-extension:latest
```

The active GitHub Actions workflow publishes the image to Quay after commits
to `main`. Configure the repository secrets `QUAY_USERNAME` and
`QUAY_PASSWORD` before enabling the workflow. The branch-specific `:main` tag
is also available for testing and troubleshooting.

## Updating the extension image

When this extension is running from a local Git checkout, the Status card
shows **Update extension**. It pulls the checkout with `git pull --ff-only`,
runs `npm ci`, and runs the production build. Stop and start the local
extension afterward so Podman Desktop loads the rebuilt backend and webview.

For the Quay OCI extension, disable/re-enable only restarts the currently
installed image; it does not guarantee a fresh pull of a changed `:latest` or
`:main` tag.

To install a newly published OCI image, uninstall the extension from
**Extensions → Installed**, then use **Extensions → Install custom...** with:

```text
quay.io/cferman/aap-demo-podman-desktop-extension:latest
```

Use a commit-specific or version-specific tag when possible so the image being
tested is unambiguous.

The dashboard's **Update aap-demo** action updates the aap-demo checkout and
CLI. **Update extension** is available only when the extension itself is
running from a local Git checkout; it cannot replace the running OCI image.
For this custom Quay image, update it from the Extensions page by uninstalling
the old image and installing the new tag.

See [TESTING.md](TESTING.md) for the Podman Desktop local-extension setup,
automated checks, smoke tests, and troubleshooting.

The extension reads the `aap-demo.cliPath` setting (default: `aap-demo`), resolves
common user-local install locations such as `~/.local/bin`, and registers the
CLI in Podman Desktop's **CLI Tools** settings. It exposes these command-palette
actions:

- Open the AAP Demo dashboard
- Open the dashboard from the Podman Desktop status bar and see the latest cluster state
- Create, deploy, destroy, diagnose, repair, show status, and toggle the AAP idle state
- View routes, masked credentials, add-on state, and prerequisite readiness
- Enable or disable reported add-ons from the dashboard

If `aap-demo` is not installed, the dashboard shows **Install aap-demo** in the
Status box. That action clones or updates the official repository in
`~/.aap-demo`, runs its `install.sh`, streams its output, and refreshes the
checks when it finishes. Set `aap-demo.installLocation` to use another
directory. The same action is available from the command palette as **AAP Demo:
Install aap-demo CLI**.

The `aap-demo.pullSecretPath`, `aap-demo.cpus`, and `aap-demo.memory` settings
are passed to the CLI as `PULL_SECRET_PATH`, `CRC_CPUS`, and `CRC_MEMORY` when
commands run. CPU count defaults to 8, with a minimum of 4. CRC is detected
from the configured `aap-demo.crcPath` or common installation locations.

The dashboard provides lifecycle controls, prerequisite checks, streamed command
output, parsed routes and credentials, add-on controls, and periodic status
refresh. A leading `~` is expanded to the current user's home directory.

The installation and resource-setting decisions are recorded in
[ADR-001](docs/adr/001-cli-installation-and-resource-settings.md).

To load the extension locally, enable Podman Desktop development extensions and
point the Local Extensions page at this repository. Keep `npm run watch` running
while iterating so the extension host and webview outputs stay current.
