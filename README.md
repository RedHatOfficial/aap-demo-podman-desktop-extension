# AAP Demo

Run and manage a local Ansible Automation Platform demo environment from
Podman Desktop. The extension wraps the `aap-demo` CLI with a dashboard for
cluster lifecycle, prerequisites, routes, credentials, diagnostics, and optional
add-ons.

## Quick install

In Podman Desktop, open **Extensions → Install custom...**, select **OCI
Image**, and enter:

```text
quay.io/cferman/aap-demo-podman-desktop-extension:latest
```

Select **Install**. Before creating a cluster, complete the requirements below.

## OpenShift Local (CRC) requirements

AAP Demo runs on OpenShift Local (CRC). Install the **OpenShift Local** extension
in Podman Desktop, then open that extension's dashboard and use its **Install**
flow to install the CRC binaries. If AAP Demo does not detect CRC, use
**Install with Podman Desktop** in the dashboard's **Status** box; confirm the
extension installation in Podman Desktop, finish installing CRC from its
dashboard, then refresh AAP Demo's prerequisites. AAP Demo does not install CRC
or accept Podman Desktop prompts on your behalf. See the
[OpenShift Local installation guide](https://podman-desktop.io/docs/openshift/openshift-local).

You also need a Red Hat pull secret. AAP Demo looks for a pull secret under
`~/.aap-demo` by default. To use another file, set `aap-demo.pullSecretPath`.

CRC needs at least **8 CPUs** and **16 GiB of memory**. AAP Demo defaults to
**8 CPUs** and **24 GiB**; configure `aap-demo.cpus` and `aap-demo.memory` if
needed.

## Use AAP Demo

Open the dashboard by clicking the **AAP Demo** item at the bottom of Podman
Desktop, or press **F1** and run **AAP Demo: Open Dashboard**.

Use it to create, start, deploy, stop, destroy, diagnose, repair, and inspect
the cluster. Add-ons are listed alphabetically; green means enabled and gray
means disabled.

## Add-ons

Use add-ons to turn on optional capabilities after AAP is deployed.

- **AO with OpenAI** deploys Automation Orchestrator and configures it to use an
  OpenAI-compatible API endpoint and model.
- **AO with Ollama** deploys Automation Orchestrator and configures it to use a
  local Ollama provider.
- **AO no AI** deploys Automation Orchestrator without connecting an AI
  provider.
- **MCP server** exposes the local AAP instance through an MCP endpoint for
  compatible clients.
- **portal operator (amd64 only)** enables the portal operator path. This add-on
  is only intended for amd64 local environments.

## Local development

Install dependencies, then run the local watcher:

```bash
npm ci
npm run dev:watch
```

The command prints the Podman Desktop local-extension setup steps and rebuilds
the backend and webview as files change. Use `npm run dev:local` for a one-time
build, or `npm run verify:local` before sharing changes.

## Install the aap-demo CLI

If the CLI is missing, click **Install aap-demo** in the **Status** box. You can
also run **AAP Demo: Install aap-demo CLI** from the F1 Command Palette.

## Updating

Select **Update aap-demo** in the Status box to update the CLI.

For the OCI extension image, disabling and re-enabling the extension only
restarts the installed image; it does not guarantee a fresh pull of a changed
tag. To install a newly published image, uninstall the extension from
**Extensions → Installed**, then install the desired OCI tag again.

## Troubleshooting

- If CRC is not detected, install it through the OpenShift Local extension in
  Podman Desktop.
- If the dashboard reports unsafe SSL, use **Fix SSL** and approve the
  certificate or Keychain prompt.
- If the CLI is not found after installation, restart Podman Desktop.
- On Windows, install Git for Windows if prompted: `winget install --id Git.Git -e`.

The extension does not install CRC or accept Podman Desktop prompts on your
behalf.
