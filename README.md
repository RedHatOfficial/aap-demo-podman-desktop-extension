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

The GitHub Actions workflow publishes the image to Quay after commits to
`main` and `feature/podman-desktop-addon`. The feature branch receives the
`:feature-podman-desktop-addon` tag; `:latest` is published only from the
default branch (`main`). Configure the repository secrets `QUAY_USERNAME` and
`QUAY_PASSWORD` for publishing.

## Updating the extension image

When this extension is running from a local Git checkout, the Status card
shows **Update extension**. It pulls the checkout with `git pull --ff-only`,
runs `npm ci`, and runs the production build. Stop and start the local
extension afterward so Podman Desktop loads the rebuilt backend and webview.

When using the custom Quay OCI image for development, **Set up local extension
updates** clones and builds this repository once. The checkout defaults to
`~/.aap-demo-podman-desktop-extension`; change
`aap-demo.extensionInstallLocation` in Podman Desktop settings to use another
location. Setup requires Git, Node.js 24 or newer, and npm. If Node.js/npm are
missing or Node.js is too old, the dashboard offers an explicit install in a
visible terminal using DNF on RHEL derivatives, Homebrew on macOS, or WinGet on
Windows. You remain in control of package-manager and administrator prompts;
return to the dashboard and choose **Check again** after installation. If the
runtime is still unavailable—or a RHEL package only provides Node.js older
than 24—use the manual Node.js instructions, restart Podman Desktop, and click
**Set up local extension updates** again.

After setup succeeds, switch manually in Podman Desktop: remove the custom OCI
extension from **Extensions → Installed**, then add the checkout under
**Extensions → Local Extensions**. Setup never removes or replaces the OCI
extension automatically. This one-time switch and the local setup/update
actions are developer-only; retire them when catalog distribution becomes the
supported installation path.

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
If CRC is missing, install the **OpenShift Local** extension from Podman
Desktop's **Extensions → Catalog** page, then open its dashboard and click
**Install** to install the OpenShift Local binaries. See the [OpenShift Local
installation guide](https://podman-desktop.io/docs/openshift/openshift-local).

When enabling the AO add-on, choose **AO with OpenAI**, **AO with Ollama**, or
**AO no AI**. OpenAI settings are configurable in Podman Desktop settings:
`aap-demo.aoLlmModel` (default `gpt-5.6-luna`), `aap-demo.aoLlmBaseUrl`
(default `https://api.openai.com/v1`), and `aap-demo.aoLlmApiKeyFile` (blank by
default, which uses `$AAP_DEMO_DIR/ao/llm-api-key` or
`~/.aap-demo/ao/llm-api-key`). The extension prompts for the OpenAI key using a
masked input when one is not already available. The key itself is not stored in
Podman Desktop settings; `aap-demo` writes it to the configured file with
restricted permissions.

The dashboard provides lifecycle controls, prerequisite checks, streamed command
output, parsed routes and credentials, add-on controls, and periodic status
refresh. A leading `~` is expanded to the current user's home directory.

The installation and resource-setting decisions are recorded in
[ADR-001](docs/adr/001-cli-installation-and-resource-settings.md).

To load the extension locally, enable Podman Desktop development extensions and
point the Local Extensions page at this repository. Keep `npm run watch` running
while iterating so the extension host and webview outputs stay current.
