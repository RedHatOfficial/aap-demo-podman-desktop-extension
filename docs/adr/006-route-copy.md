# ADR-006: Copy dashboard routes locally in the webview

- Status: Accepted
- Date: 2026-10-12
- Issue: #21

## Context

An AAP route is a browser URL. Opening it is a host-side action, but copying it
is a clipboard action. Sending both through the host `openExternal` bridge can
produce an “Could not open” warning even when the clipboard already contains the
URL.

## Decision

Render a dedicated **Copy Link** button for every route. The button uses the
webview Clipboard API and a textarea fallback, reports `Copied` only when the
operation returns success, and never sends an `open-url` message. The anchor
continues to use the host bridge for navigation.

## Consequences

Copying no longer depends on external URL handling or Flatpak host permissions.
Older webview environments still have a fallback, and a genuine clipboard
failure is visible as `Copy failed`.
