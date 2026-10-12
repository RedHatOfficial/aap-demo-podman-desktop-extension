# ADR-005: Keep CA repair noninteractive in the extension

- Status: Accepted
- Date: 2026-10-12
- Issue: #22

## Context

The extension host has no terminal connected to the user’s sudo session. An
ingress CA repair can successfully update Chrome/Firefox NSS while failing to
copy the certificate into the system trust store. Invoking sudo from the
extension produces duplicate password-prompt errors and obscures the successful
browser trust work.

## Decision

Expose the upstream `repair` action through the dashboard and set
`AAP_DEMO_TRUST_CA=false` for extension-launched CLI actions. If output still
reports that system trust could not be updated, format a message that states
browser/NSS trust succeeded and provides one terminal command using the saved
CA path: `sudo cp <path> /etc/pki/ca-trust/source/anchors/crc-ingress-ca.crt && sudo update-ca-trust`.

## Consequences

Repair no longer attempts an extension-host password prompt. Users who require
system-wide trust have an explicit, auditable terminal step, while browser trust
results remain visible and understandable.
