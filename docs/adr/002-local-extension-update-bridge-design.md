# Design: Developer-only local extension update bridge for custom OCI builds

- Status: Accepted
- Date: 2026-10-05
- Updated: 2026-10-07

The implementation is documented in ADR-001 and the repository README. The
automated checks cover source checkout safety, runtime detection/install
selection, dashboard messaging, and production compilation. The manual
Podman Desktop OCI-to-local smoke test remains a release/developer validation
step.

## Goal

Give developers testing the custom Quay image a reliable way to keep the
extension current without publishing and reinstalling a new OCI image for every
development change. The first transition from OCI to a local extension is
explicit and user-controlled; subsequent development updates use the local
checkout updater. This is a temporary development bridge only. It is not part
of the eventual catalog-distributed user experience and should be retired when
the extension is officially available through the Podman Desktop catalog.

The `aap-demo` CLI repository and the extension source repository remain
separate and are updated independently. Catalog publication is a later release
path; the local bridge supports development until then and is not a catalog
feature.

## Current constraints

- The running OCI image contains a built extension and cannot update its own
  installed image from source.
- The extension's public API exposes installed-extension discovery and change
  events, but no supported operation to install a local extension or replace an
  installed OCI extension. The OCI-to-local transition must remain a user
  action in Podman Desktop.
- Podman Desktop documents `extensions.autoUpdate` as enabled by default, and
  documents publishing an OCI image and submitting a separate catalog change.
  Therefore, Quay publication alone should not be described as catalog-managed
  automatic updating.

References: [Podman Desktop extension API](https://podman-desktop.io/api/%40podman-desktop/namespaces/extensions),
[publishing extensions](https://podman-desktop.io/docs/extensions/publish), and
[settings reference](https://podman-desktop.io/docs/configuration/settings-reference).

## Proposed user experience

While developers run the custom Quay image, offer an explicit **Set up
local extension updates** action. It clones/builds the extension repository
once and gives the developer the steps to replace the OCI copy with that local
checkout. This is a one-time manual switch; subsequent development updates use
the existing **Update extension** action, which pulls the extension checkout,
runs `npm ci`, builds it, and asks the developer to stop/start the local
extension. This workflow is explicitly temporary and must not be presented as
a requirement for catalog users.

The separate **Install/Update aap-demo** actions continue to manage the CLI
repository under `aap-demo.installLocation`. They do not update the extension
source.

CLI actions and install/update helper commands resolve host execution before
spawning them. When the extension runs inside Flatpak, `aap-demo`, Git, and
Bash can be invoked through `flatpak-spawn --host` so the workflow can use
tools installed on the host. Missing Git/Bash errors are reported as
actionable prerequisites rather than raw spawn failures.

Update `README.md` and ADR-001 to document the setup action, the one-time
OCI-to-local switch, local source updates, and the fact that official
catalog-managed OCI distribution is a later option rather than a near-term
requirement.

Suggested source checkout setting:

```text
aap-demo.extensionInstallLocation = ~/.aap-demo-podman-desktop-extension
```

The setup action will clone
`https://github.com/RedHatOfficial/aap-demo-podman-desktop-extension.git`, or
fast-forward an existing Git checkout. It will refuse to overwrite a
non-Git directory, and it will refuse to update an existing checkout unless
its `origin` is the official extension repository. It checks for Git, Node.js
24+, and npm, then runs `npm ci` and `npm run build`.

When Node.js/npm are missing or Node.js is too old, the dashboard explains the
exact requirement and offers a package-manager install for supported platforms:
DNF on RHEL derivatives, Homebrew on macOS, and WinGet on Windows. The user
explicitly starts the install in a visible terminal, where package-manager or
administrator prompts remain interactive. The extension does not elevate
privileges or install packages silently. After the user returns, the dashboard
re-checks Node.js/npm before continuing. If the package manager is missing,
the platform/distro cannot provide Node.js 24+, or the runtime still cannot be
resolved, the UI keeps the failure actionable and explains the next manual
step. Git remains a separate prerequisite with a clear diagnostic.

On success, the UI explains that the user must remove the OCI extension once
and add the built checkout under **Extensions → Local Extensions**. It does
not attempt that switch automatically or delete the OCI image.

The OpenShift Local prerequisite action is separate from this local-extension
bridge. It uses Podman Desktop navigation to open the Extensions catalog
searched for OpenShift Local when supported, and falls back to Resources on
older APIs. If Podman Desktop already has the OpenShift Local extension
available, the prerequisite is treated as managed by Podman Desktop even when
the `crc` executable is not directly visible to this extension process.

## Future distribution option: official OCI/catalog release

When official OCI/catalog distribution becomes a priority, CI can continue to
build and publish the OCI image, and maintainers can submit the required
Podman Desktop catalog entry. Podman Desktop's `extensions.autoUpdate` setting
defaults to enabled; the catalog release process must publish the correct
image/version metadata for that behavior to apply. Once catalog distribution
is the supported installation path, retire the developer-only local setup and
update actions rather than carrying them into the catalog user workflow.

Developers may later switch from the local extension to the official catalog
entry. Catalog onboarding and migration are not part of this development
bridge. Publishing an OCI image to Quay without catalog onboarding does not by itself
promise automatic updates.

## Safety and failure behavior

Flatpak host-command, environment, secret, and host-file behavior is defined
in [ADR-004](004-flatpak-host-bridge-and-secret-handling.md).

- Source cloning and npm lifecycle/build commands run only after explicit user
  action.
- Never automatically uninstall or replace either extension installation.
- Preserve a cloned checkout on build failure so developers can inspect or retry it.
- Stream setup output to the existing dashboard output area and give clear
  errors for missing Git, Node.js, npm, network access, or build failures.
- Resolve normal CLI actions and host Git/Bash through the augmented PATH or
  Flatpak host delegation before running deploy, clone, pull, or install
  commands.
- Keep CLI and extension update status/actions distinct to avoid implying that
  updating one repository updates the other.

## Out of scope

- Automatically switching between OCI and local extensions.
- Installing Node.js or npm without an explicit user action in a visible
  terminal.
- Publishing or submitting the extension to the Podman Desktop catalog.
- Keeping this developer-only OCI-to-local bridge as part of the future
  catalog-distributed experience.
- Making the Quay `latest` tag alone behave as a Podman Desktop catalog update.
- Merging the CLI and extension repositories.

## Validation plan

- Test install-location expansion, clone/update safety, missing and outdated
  runtime detection, supported package-manager command selection, explicit
  terminal handoff, unavailable package-manager handling, and build failure
  recovery.
- Test Flatpak host-tool delegation and CRC cache executable discovery.
- Run typecheck, unit tests, and production build.
- Manually verify the custom-OCI-to-local one-time setup and subsequent local
  updates in Podman Desktop.
- No catalog submission or catalog-update validation is required for this
  temporary developer workflow.

## Review question

Does this match the intended rollout: developers can switch once from the
custom OCI image to a local checkout for development; the local bridge is
retired when catalog distribution becomes the supported user path?
