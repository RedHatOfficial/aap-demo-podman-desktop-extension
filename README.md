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
authenticated to Quay. The extension still requires the `aap-demo` CLI and a
running local AAP Demo environment.

## Open the dashboard

After the extension is installed and active, open the dashboard from Podman
Desktop in either of these ways:

- Click the `AAP Demo: ...` status item at the bottom of the Podman Desktop
  window.
- Press **F1**, search for **AAP Demo: Open Dashboard**, and press **Enter**.

Do not open `src/webview/index.html` directly in a browser. That bypasses
Podman Desktop's extension host bridge and the dashboard actions will not
work.

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

See [TESTING.md](TESTING.md) for the Podman Desktop local-extension setup,
automated checks, smoke tests, and troubleshooting.

The extension reads the `aap-demo.cliPath` setting (default: `aap-demo`), resolves
common user-local install locations such as `~/.local/bin`, and registers the
CLI in Podman Desktop's **CLI Tools** settings. It exposes these command-palette
actions:

- Open the AAP Demo dashboard
- Open the dashboard from the Podman Desktop status bar and see the latest cluster state
- Create, deploy, destroy, diagnose, show status, and toggle the AAP idle state
- View routes, masked credentials, add-on state, and prerequisite readiness
- Enable or disable reported add-ons from the dashboard

The `aap-demo.pullSecretPath` and `aap-demo.memory` settings are passed to the
CLI as `PULL_SECRET_PATH` and `CRC_MEMORY` when commands run. CRC is detected
from the configured `aap-demo.crcPath` or common installation locations.

The dashboard provides lifecycle controls, prerequisite checks, streamed command
output, parsed routes and credentials, add-on controls, and periodic status
refresh. Automatic CLI installation is not yet included; install `aap-demo`
separately or set `aap-demo.cliPath` to its full path. A leading `~` is
expanded to the current user's home directory.

To load the extension locally, enable Podman Desktop development extensions and
point the Local Extensions page at this repository. Keep `npm run watch` running
while iterating so the extension host and webview outputs stay current.
