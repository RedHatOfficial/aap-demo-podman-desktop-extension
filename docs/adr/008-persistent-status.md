# ADR-008: Poll status independently of dashboard visibility

- Status: Accepted
- Date: 2026-10-12
- Issue: #19

## Context

The status bar item is created at activation, but status polling was created
only when the dashboard opened and cleared when that panel was disposed.

## Decision

Create one polling interval during activation, update the status bar from it,
and register cleanup with the extension context. Dashboard message delivery
remains conditional on the current panel.

## Consequences

Status remains current across navigation and dashboard disposal. Reopening the
dashboard still receives fresh status, and only one poller exists per activation.
