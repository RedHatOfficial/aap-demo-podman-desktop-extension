# AAP Demo

Manage a local `aap-demo` environment from Podman Desktop.

## Quick install

In Podman Desktop, open **Extensions → Install custom...**, select **OCI
Image**, and enter:

```text
quay.io/cferman/aap-demo-podman-desktop-extension:latest
```

Select **Install**. The Quay repository must be public, or Podman must be
authenticated to Quay. The extension can install the `aap-demo` CLI. Before
creating a cluster, review the [OpenShift Local requirements](#openshift-local-crc-requirements).

## OpenShift Local (CRC) requirements

AAP Demo runs on OpenShift Local (CRC). Install the **OpenShift Local** extension
in Podman Desktop, then open that extension's dashboard and use its **Install**
flow to install the CRC binaries. If AAP Demo does not detect CRC, use
**Install with Podman Desktop** in the dashboard's **Status** box; confirm the
extension installation in Podman Desktop, finish installing CRC from its
dashboard, then refresh AAP Demo's prerequisites. AAP Demo does not install CRC
or accept Podman Desktop prompts on your behalf. See the
[OpenShift Local installation guide](https://podman-desktop.io/docs/openshift/openshift-local).

You also need a Red Hat pull secret. By default, AAP Demo looks for
`~/.aap-demo/pull-secret.txt`, `~/.aap-demo/pull-secret.json`, or
`~/.aap-demo/pull-secret`. To use another file, set
`aap-demo.pullSecretPath` in Podman Desktop settings.

CRC needs at least **8 CPUs** and **16 GiB of memory**. The extension defaults
to **8 CPUs** and **24 GiB**. Configure `aap-demo.cpus` and `aap-demo.memory`
in Podman Desktop settings before creating the cluster; leave additional
resources available for your host and Podman Desktop. Memory is configured in
MiB (the default is `24576`, and the minimum is `16384`).

## Open the dashboard

The dashboard opens automatically when Podman Desktop starts. Set
`aap-demo.openDashboardOnStartup` to `false` in Podman Desktop settings if you
prefer to open it yourself. You can also open it at any time using either of
these methods:

- Click the `AAP Demo: ...` status item at the bottom of the Podman Desktop
  window.
- Press **F1**, search for **AAP Demo: Open Dashboard**, and press **Enter**.

## Install the aap-demo CLI

If the CLI is missing, click **Install aap-demo** in the dashboard's **Status**
box, or run **AAP Demo: Install aap-demo CLI** from the **F1** Command Palette.
The extension clones or updates the official repository and runs its
`install.sh`. The default source checkout is kept separate from CLI data:

```text
~/.aap-demo/aap-demo/install.sh
```

The `~/.aap-demo` directory remains the CLI's data directory. Set
`aap-demo.installLocation` in Podman Desktop settings to use a different source
checkout directory. Existing Git checkouts are updated with `git pull
--ff-only`; a recognizable source tree without Git metadata can be reused for
installation but cannot be pulled for updates. Existing unrelated files are
preserved. The install output is shown under **Command output**. If the script
needs an interactive administrator password or dependency installation, run
it from a terminal instead.

## Updating

To update the aap-demo CLI, select **Update aap-demo** in the Status box, or
run **AAP Demo: Update aap-demo CLI** from the F1 Command Palette. This pulls
the Git checkout, reruns `install.sh`, and refreshes the dashboard.

For the OCI extension image, disabling and re-enabling the extension only
restarts the installed image; it does not guarantee a fresh pull of a changed
tag. To install a newly published image, uninstall the extension from
**Extensions → Installed**, then install the desired OCI tag again.

## Troubleshooting

- If CRC is not detected, install it through the OpenShift Local extension in
  Podman Desktop.
- If the dashboard reports unsafe SSL, use **Fix SSL** and approve the
  certificate or Keychain prompt.
- If the CLI is not found after installation, restart Podman Desktop or set
  `aap-demo.cliPath` to the installed executable.
- On Windows, install Git for Windows if AAP Demo reports that Bash or Git is
  missing. PowerShell can run `winget install --id Git.Git -e`; restart Podman
  Desktop afterward.
- If installation needs an administrator prompt or dependency installation,
  run the displayed `install.sh` command from a terminal.

The extension does not install CRC or accept Podman Desktop prompts on your
behalf.
