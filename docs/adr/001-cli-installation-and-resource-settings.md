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
and an **AAP Demo: Install aap-demo CLI** command in the Command Palette.

The action:

1. Resolves `aap-demo.installLocation`, defaulting to `~/.aap-demo`.
2. Clones `https://github.com/RedHatOfficial/aap-demo.git` into that location
   when it does not exist.
3. Updates an existing Git checkout with `git pull --ff-only`.
4. Refuses to use an existing non-Git directory rather than overwriting it.
5. Runs the checked-out `install.sh` with Bash.
6. Streams clone, update, and install output to the dashboard, then refreshes
   CLI and prerequisite status.

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

CPU and memory changes affect CRC when the cluster is created or recreated;
they do not resize an already-running VM automatically.

The dashboard is opened through Podman Desktop by clicking the bottom status
item or using **F1 → AAP Demo: Open Dashboard**. Opening the source HTML with
`file://` is not a supported test path because it does not provide the host
bridge.

The extension does not provide a self-update operation for its own OCI image.
Disabling and re-enabling a local folder extension reloads rebuilt files, but
disabling and re-enabling an OCI extension only restarts the installed image.
Updating a Quay image therefore requires uninstalling the installed extension
and reinstalling the desired image tag from **Extensions → Install custom...**.
Commit-specific or version-specific tags are preferred for repeatable testing.

## Consequences

This gives users a discoverable installation path without requiring a separate
manual CLI setup for the common case. The default checkout is predictable and
can be updated safely. The non-Git-directory check prevents accidental data
loss, but users with an existing `~/.aap-demo` data directory must choose a
different install location or migrate that directory intentionally.

The action still depends on `git`, Bash, network access, and the dependencies
handled by `install.sh`. Interactive administrator prompts may not work through
the extension host; those installs should be run from a terminal. The
extension never installs CRC or supplies the Red Hat pull secret automatically.
