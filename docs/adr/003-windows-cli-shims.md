# ADR-003: Normalize and invoke Windows CLI shims at process boundaries

- Status: Accepted
- Date: 2026-10-12
- Issue: #25

## Context

Windows installations of `aap-demo` commonly expose a `aap-demo.cmd` shim. A
settings value copied from a shell may contain surrounding quotes. Passing those
quotes as part of the `spawn` command causes `cmd.exe` to look up a command whose
name literally begins with a quote. Node also requires shell handling for batch
files.

## Decision

Strip one matching pair of outer quotes when resolving configured executable
paths. When the resolved command is a `.cmd` or `.bat` file on Windows and the
caller has not explicitly selected a shell, build one quoted shell command from
the executable and its arguments and invoke it with `shell: true`.

## Consequences

Copied quoted Windows settings work without manual editing, and batch-file
arguments retain their boundaries. POSIX commands and callers that explicitly
choose a shell retain their existing behavior.
