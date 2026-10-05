# Testing the AAP Demo Podman Desktop extension

This guide covers automated checks and local testing through Podman Desktop.
The dashboard must be opened from the installed local extension; opening
`src/webview/index.html` directly with `file://` does not provide the Podman
Desktop host bridge.

## Prerequisites

- Podman Desktop 1.12 or newer
- Node.js 24 or newer, unless building the OCI image
- `aap-demo` installed and usable from the shell
- OpenShift Local (CRC) installed
- A Red Hat pull secret at a known path
- At least 16 GiB available to the CRC environment

For a full live smoke test, create or use a disposable AAP Demo environment.
Do not destroy an environment that contains data you need.

## Automated checks

From this directory:

```bash
npm ci
npm test
npm run typecheck
npm run build
```

The test suite is non-destructive. It does not create or destroy a cluster.

## Build and open locally

Build the extension outputs from this repository:

```bash
npm ci
npm run build
```

The first run requires the one-time Podman Desktop setup below because Podman
Desktop does not provide a supported CLI for registering an arbitrary local
extension folder.

### Repeat the local workflow with Python

The repository includes a dependency-free Python helper for the repeatable
parts of local extension development:

```bash
python3 scripts/podman_extension.py verify --install
python3 scripts/podman_extension.py build --open
```

Use `build` when only the compiled extension assets need refreshing. Use
`verify` before sharing a change; it runs `npm test`, `npm run typecheck`, and
`npm run build`. The optional `--install` flag runs `npm ci` when
`node_modules` is missing. Use `python3 scripts/podman_extension.py watch --open`
for continuous rebuilds while iterating.

The helper validates the required extension manifest fields and opens Podman
Desktop, but the local folder still must be selected once under
**Extensions → Local Extensions**. It does not uninstall or replace an
existing OCI extension image.

## Build an OCI extension image

To build the extension without installing npm on the host, use the standalone
container build script from the repository root:

```bash
./build-image.sh
```

Pass a different image name as the first argument when needed.

This uses the extension `Containerfile` and defaults to:

```text
localhost/aap-demo-podman-extension:dev
```

The script prints the image name. In Podman Desktop, open
**Extensions → Install custom...**, enter that image name, and install it.
The container contains the compiled extension assets; the extension still calls
the host `aap-demo` and CRC executables at runtime.

## Install the Quay-hosted image

The `Publish image to Quay` workflow publishes the OCI image to Quay:

```text
quay.io/cferman/aap-demo-podman-desktop-extension:latest
```

In Podman Desktop, open **Extensions → Install custom...**, enter that image
name, and install it. The Quay repository must be public, or Podman must be
authenticated to Quay before installation. Use the `:main` tag when testing
the branch-specific image directly. Configure the repository secrets
`QUAY_USERNAME` and `QUAY_PASSWORD` for GitHub Actions publishing.

### Updating an installed image

For a local folder extension, run `npm run build`, then disable and re-enable
the extension to reload the rebuilt files. For the Quay-hosted OCI extension,
disable/re-enable only restarts the image already installed. To pull a newly
published image, uninstall it from **Extensions → Installed**, then reinstall
it through **Extensions → Install custom...** using the desired image tag.

Prefer a commit-specific or version-specific tag when verifying an image. The
mutable `:latest` and `:main` tags may not force Podman Desktop to pull a new
image when the extension is only disabled and re-enabled.

## Local development without manually rebuilding

Start the continuous compiler:

```bash
npm run watch
```

Keep this terminal open. It rebuilds the extension host output in `dist/` and
the webview output in `media/` whenever source files change.

In Podman Desktop:

1. Open **Settings → Preferences → Extensions**.
2. Enable **Development mode**.
3. Open **Extensions → Local Extensions**.
4. Select **Add a local folder extension...**.
5. Choose this directory:

   ```text
   /path/to/aap-demo-podman-desktop-extension
   ```

6. Start the extension and confirm it is **ACTIVE**.
7. Open the dashboard by clicking the `AAP Demo: ...` status item at the
   bottom of the Podman Desktop window, or press **F1**, search for
   **AAP Demo: Open Dashboard**, and press **Enter**.

If the `aap-demo` CLI is missing, the Status box shows **Install aap-demo**.
Click it to clone or update the repository in `~/.aap-demo` and run its
`install.sh`. Set `aap-demo.installLocation` in Podman Desktop settings to use
another directory. The install output appears under **Command output**. The
selected location must be empty or an existing aap-demo Git checkout; the
extension will not overwrite an unrelated directory.

After backend changes, stop and start the local extension if the extension host
does not reload. After webview changes, close and reopen the dashboard. If the
dashboard still shows old markup, confirm the watch terminal rebuilt the files
and reload the local extension.

### Opening the dashboard

The dashboard is hosted by Podman Desktop and must be opened through the
extension host:

- Click the `AAP Demo: ...` status item at the bottom of the Podman Desktop
  window; or
- Press **F1**, search for **AAP Demo: Open Dashboard**, and press **Enter**.

Opening `src/webview/index.html` directly with `file://` does not provide the
Podman Desktop host bridge, so dashboard buttons and status updates will not
work there.

## Manual smoke test

### Dashboard and status

1. Open the AAP Demo dashboard from Podman Desktop.
2. Confirm the **Status** box shows the cluster state, infrastructure, and
   last-updated time.
3. Confirm prerequisites appear inside the Status box:
   - CRC executable and resolved path;
   - configured CPU count and minimum;
   - pull-secret path and existence;
   - available memory and the minimum.
4. Click **Refresh status** and confirm the timestamp and command output update.

### Lifecycle actions

Use a disposable environment for state-changing tests.

1. Click **Create cluster** when no cluster exists and confirm streamed output.
2. Click **Deploy AAP** after the cluster is ready.
3. Refresh status and confirm routes, credentials, and add-ons appear.
4. Use **Diagnose** and confirm command output is shown.
5. Test **Set idle** and confirm it changes to **Wake AAP**.
6. Use **Destroy cluster** only when cleanup is explicitly intended.

If the cluster already exists and should be preserved, limit the test to
**Refresh status**, **Diagnose**, and read-only dashboard checks.

### Add-ons

1. Confirm add-ons are displayed alphabetically.
2. Confirm enabled add-ons are green and disabled add-ons are grey.
3. Confirm the helper text says `green means enabled and grey means disabled`.
4. Click an add-on toggle and confirm it becomes temporarily unavailable while
   the command runs.
5. Refresh status and confirm the add-on state changed.

### Routes and credentials

1. Click each AAP route and confirm it opens in the default browser.
2. Confirm credentials are masked initially.
3. Use **Show**/**Hide** to reveal and re-mask a credential.
4. Use **Copy** and confirm the button reports **Copied**.

## Troubleshooting

### Manifest metadata error

The selected folder must contain the extension `package.json` with `name`,
`displayName`, `version`, `publisher`, and `description`. Select the
`podman-desktop-extension` folder, not the repository parent or `src` folder.

### `spawn ... ENOENT`

Podman Desktop may have a smaller `PATH` than your terminal. Set the full path
in **Settings → Extensions → AAP Demo**:

```text
aap-demo.cliPath = /Users/cferman/.local/bin/aap-demo
```

Alternatively, use the configured path supported by your installation and
restart the local extension.

### Status says not running even though CRC is running

Check the CLI and CRC directly from a terminal:

```bash
aap-demo status
crc status -o json
```

Then verify `aap-demo.crcPath` points to the actual CRC executable and refresh
the dashboard.

### Changes are not visible

Confirm `npm run watch` is still running, then:

1. Check that `dist/extension.js` or `media/index.html` has a recent timestamp.
2. Stop and start the local extension from the Extensions page.
3. Reopen AAP Demo Dashboard.

### Host bridge unavailable

Do not test by opening the HTML file directly. Open the dashboard from the
active Podman Desktop extension so the `acquirePodmanDesktopApi()` bridge is
available.

## Cleanup

Stop the watcher with `Ctrl-C` when finished. Stop the local extension from the
Podman Desktop Extensions page if it should no longer run.
