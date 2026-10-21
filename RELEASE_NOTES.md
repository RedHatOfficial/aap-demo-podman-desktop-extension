# Release Notes

## Unreleased

This release focuses on making the AAP Demo workflow easier to configure,
understand, and troubleshoot from Podman Desktop.

### Added

- Added pull-secret detection with a setup button beside **Update extension**.
- Added pull-secret guidance explaining that the secret allows OpenShift Local
  to authenticate to Red Hat registries and download the images required by
  AAP.
- Added deploy-time prompts for missing pull secrets.
- Added CPU and memory validation before deployment.
- Added automatic synchronization of the configured CPU and memory values to
  the CRC configuration before creating or starting the VM.
- Added prompts for Red Hat subscription credentials when deployment reports
  that no valid subscription was found.
- Added secure storage for the Red Hat subscription credentials.
- Added the installed `aap-demo` CLI version and build hash to the dashboard.

### Improved

- Renamed the VM actions to **Start VM** and **Stop VM** for clarity.
- Reordered the VM controls below **Deploy AAP** and improved the spacing
  between deployment and lifecycle actions.
- Disabled image caching for Podman Desktop to avoid cache-related deployment
  issues.
- Added follow-up guidance after saving subscription credentials to rerun
  deployment.
- Expanded prerequisite and deployment status messaging so users know what is
  missing and how to resolve it.

### Verification

- 245 automated tests passed.
- 1 test was skipped by design.
- Type checking, backend and webview builds, and diff validation passed.
