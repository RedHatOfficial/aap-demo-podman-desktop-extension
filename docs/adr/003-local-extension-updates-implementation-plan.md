# Local Extension Updates Implementation Plan

> Implementation is complete and automated checks pass. The manual
> Podman Desktop OCI-to-local click-through in Task 5 remains to be verified.
> Follow-up implementation on 2026-10-07 also completed the OpenShift Local
> prerequisite refinements, Flatpak host-tool delegation, and CRC cache `oc`
> discovery described below.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give developers testing the custom OCI extension a temporary local-source setup/update path, including a clear offer to install missing Node.js/npm; retire this bridge when catalog distribution becomes the supported user path.

**Architecture:** Add a source-checkout service for safe clone/fast-forward and local production builds, plus a runtime-installer helper that detects supported package managers and opens an explicit, visible terminal handoff. The dashboard exposes setup for this custom-OCI developer workflow and local updates only for a local checkout. CLI repository install/update remains independent; catalog users will not need this bridge.

**Tech Stack:** TypeScript, Podman Desktop Extension API, Node.js 24+, npm, existing `CommandRunner`, Vitest.

**Spec:** [docs/adr/002-local-extension-update-bridge-design.md](docs/adr/002-local-extension-update-bridge-design.md)

## Global Constraints

- Extension source URL: `https://github.com/RedHatOfficial/aap-demo-podman-desktop-extension.git`.
- Default extension source path: `~/.aap-demo-podman-desktop-extension`.
- Clone/build only after the user explicitly selects **Set up local extension updates**.
- Existing checkouts use `git pull --ff-only` only when their `origin` is the official extension repository; never overwrite a non-Git path.
- Require Node.js `>=24` and npm; if missing or outdated, explain the requirement and offer an explicit terminal-based package-manager install for RHEL derivatives (DNF), macOS (Homebrew), or Windows (WinGet).
- Never invoke privilege elevation or install packages silently from the extension host; the user reviews and runs the command in a visible terminal.
- After the terminal handoff, let the user explicitly re-check Node.js/npm; provide manual guidance when the package manager is missing or the installed runtime is still unusable.
- Run `npm ci` and `npm run build` in the extension checkout and stream output.
- Do not automatically uninstall, replace, or enable a local extension.
- Keep `aap-demo` CLI checkout/update independent from extension-source checkout/update.
- This is a temporary developer-only path and is not carried into the catalog-distributed user experience.

## Review Focus

- Existing destination is a non-Git directory: preserve all contents and explain how to choose another path; test in Task 1.
- Existing destination is a Git checkout with a different `origin`: refuse to pull/build it; test in Task 2.
- Node is missing, unparsable, or older than 24, or npm is missing: stop before `npm ci`, present the supported package-manager offer, then allow re-check; test in Tasks 2 and 4.
- No supported package manager is available, or install does not make Node/npm resolvable: preserve the checkout, explain the unmet requirement, and show manual next steps; test in Tasks 2 and 4.
- User has no `aap-demo` CLI: extension-source setup still works because it must not call the CLI; exercise in Task 4.
- Clone, pull, `npm ci`, or build fails: preserve the checkout, stream diagnostics, and permit retry; test in Task 2.
- Podman Desktop is installed as a Flatpak: resolve Git/Bash normally first,
  then use `flatpak-spawn --host` when host delegation is available.
- OpenShift Local is managed by Podman Desktop: accept the installed/enabled
  extension as a CRC prerequisite signal even if `crc` is not visible on PATH.
- CRC provides `oc` in `~/.crc/cache`: add those cache directories to the
  augmented PATH so the CLI's `kubectl` fallback can use `oc`.

## Follow-up Implementation Notes: OpenShift Local and Host Tools

- The OpenShift Local install action now uses Podman Desktop's Extensions
  catalog navigation with `OpenShift Local` as the search term when the API is
  available. Older APIs fall back to Resources.
- The prerequisite row no longer shows the extra install-guide text or link.
  It shows the button only when OpenShift Local is truly missing.
- If Podman Desktop has the OpenShift Local extension available, the CRC
  prerequisite is marked available and shown as `Managed by Podman Desktop`.
- Extension change events trigger prerequisite refreshes so installing or
  enabling OpenShift Local updates the dashboard.
- Normal CLI actions and the CLI install/update path resolve host commands and
  support Flatpak host delegation for `aap-demo`, Git, and Bash.
- CRC cache directories containing an executable `oc` are included in the
  augmented PATH, allowing the existing aap-demo `kubectl` to `oc` fallback to
  work without requiring a separate `kubectl` install.
- The complete Flatpak host-bridge and secret-handling decision is recorded in
  [ADR-004](004-flatpak-host-bridge-and-secret-handling.md).

---

### Task 1: Extension source path and checkout validation

**Files:**
- Create: `src/extension-source.ts`
- Create: `tests/extension-source.test.ts`

**Interfaces:**
- Produces `AAP_DEMO_EXTENSION_REPOSITORY_URL`, `resolveExtensionInstallLocation(configuredPath: string, homeDirectory?: string): string`, `getExtensionCheckoutAction(targetExists: boolean, gitMetadataExists: boolean): 'clone' | 'update' | 'refuse'`, and `parseNodeMajorVersion(output: string): number | undefined`.
- `resolveExtensionInstallLocation` expands only a leading `~` or `~/`; otherwise it returns the configured path unchanged.
- `parseNodeMajorVersion` accepts Node's `v24.1.0` output and returns `24`; malformed output returns `undefined`.

- [ ] **Step 1: Add focused failing tests** for default/tilde paths, unchanged absolute paths, clone/update/refuse decisions, and valid/invalid Node versions.

```typescript
it('expands the default home-relative checkout path', () => {
  expect(resolveExtensionInstallLocation('~/.aap-demo-podman-desktop-extension', '/home/test'))
    .toBe('/home/test/.aap-demo-podman-desktop-extension');
});

it('uses the default location for a blank setting', () => {
  expect(resolveExtensionInstallLocation('', '/home/test'))
    .toBe('/home/test/.aap-demo-podman-desktop-extension');
});

it('keeps an absolute checkout path unchanged', () => {
  expect(resolveExtensionInstallLocation('/tmp/extension', '/home/test'))
    .toBe('/tmp/extension');
});

it('refuses an existing directory without Git metadata', () => {
  expect(getExtensionCheckoutAction(true, false)).toBe('refuse');
});

it('reads the Node major version and rejects malformed output', () => {
  expect(parseNodeMajorVersion('v24.1.0')).toBe(24);
  expect(parseNodeMajorVersion('node unavailable')).toBeUndefined();
});
```

- [ ] **Step 2: Run the focused test and confirm the missing exports fail it.**

Run: `npm test -- tests/extension-source.test.ts`

Expected: FAIL because the source-path and checkout helpers do not yet exist.

- [ ] **Step 3: Implement the pure helpers** using `node:os` and `node:path` for home expansion; do not touch the filesystem in these helpers.

```typescript
export function resolveExtensionInstallLocation(
  configuredPath: string,
  homeDirectory = os.homedir(),
): string {
  const value = configuredPath.trim() || '~/.aap-demo-podman-desktop-extension';
  if (value === '~') return homeDirectory;
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(homeDirectory, value.slice(2));
  }
  return value;
}

export function getExtensionCheckoutAction(
  targetExists: boolean,
  gitMetadataExists: boolean,
): 'clone' | 'update' | 'refuse' {
  if (!targetExists) return 'clone';
  return gitMetadataExists ? 'update' : 'refuse';
}

export function parseNodeMajorVersion(output: string): number | undefined {
  const match = output.trim().match(/^v?([0-9]+)\./);
  return match ? Number(match[1]) : undefined;
}
```

- [ ] **Step 4: Run the focused test and confirm it passes.**

Run: `npm test -- tests/extension-source.test.ts`

Expected: PASS for all path, checkout-action, and Node-version cases.

### Task 2: Clone/build service with runtime and repository checks

**Files:**
- Create: `src/extension-source-service.ts`
- Create: `tests/extension-source-service.test.ts`
- Modify: `src/extension-source.ts`

**Interfaces:**
- Consumes the URL, checkout-action helper, and Node-major parser from Task 1.
- Produces `ExtensionSourceServiceOptions` with `checkoutPath: string`, `pathValue: string`, `pathExists(path: string): boolean`, and `gitMetadataExists(path: string): boolean`; and `ExtensionSourceStreams = Pick<CommandRunnerOptions, 'onStdout' | 'onStderr'>`.
- Produces `ExtensionSourceService`, constructed as `new ExtensionSourceService(executor: CommandExecutor, options: ExtensionSourceServiceOptions)`.
- `prepare(streams?: Pick<CommandRunnerOptions, 'onStdout' | 'onStderr'>): Promise<CommandResult>` clones or fast-forwards, checks `node --version` for major `>=24`, checks `npm --version`, then runs `npm ci` and `npm run build`. npm commands use the checkout as `cwd`.
- Existing non-Git directories fail before any Git/npm command. Existing Git checkouts must have `origin` equal to the official repository URL before pull/build.
- Every child command receives the augmented `PATH` and optional stdout/stderr callbacks.
- The private `run(command: string, args: readonly string[], streams?: ExtensionSourceStreams, cwd?: string): Promise<CommandResult>` applies environment, cwd, and stream options.

- [ ] **Step 1: Add recording-executor tests** for absent checkout clone, valid checkout fast-forward, non-Git refusal, wrong-origin refusal, old/missing Node, missing npm, successful build sequence, and preserved errors on failed commands.

```typescript
class RecordingExecutor implements CommandExecutor {
  readonly calls: Array<{ command: string; args: readonly string[]; options?: CommandRunnerOptions }> = [];

  constructor(
    private readonly output: Record<string, string> = {},
    private readonly failedCommand?: string,
  ) {}

  async run(command: string, args: readonly string[] = [], options?: CommandRunnerOptions): Promise<CommandResult> {
    this.calls.push({ command, args, ...(options ? { options } : {}) });
    const key = [command, ...args].join(' ');
    if (key === this.failedCommand) throw new Error(`failed command: ${key}`);
    return { exitCode: 0, stdout: this.output[key] ?? '', stderr: '' };
  }
}
```

```typescript
const checkoutPath = '/home/test/.aap-demo-podman-desktop-extension';
const executor = new RecordingExecutor({ 'node --version': 'v24.0.0', 'npm --version': '11.0.0' });
const service = new ExtensionSourceService(executor, {
  checkoutPath,
  pathValue: '/usr/bin:/bin',
  pathExists: () => false,
  gitMetadataExists: () => false,
});
await service.prepare();
expect(executor.calls.map(({ command, args }) => [command, ...args])).toEqual([
  ['git', 'clone', AAP_DEMO_EXTENSION_REPOSITORY_URL, checkoutPath],
  ['node', '--version'],
  ['npm', '--version'],
  ['npm', 'ci'],
  ['npm', 'run', 'build'],
]);
```

Define `RecordingExecutor` in the test file as a `CommandExecutor` that records
the command, arguments, and options; returns configured stdout by the joined
command/argument string; and throws for a configured failing command. Assert
that npm commands have `cwd: checkoutPath` and each command receives the
configured `PATH`.

- [ ] **Step 2: Run the focused test and confirm expected failures** for the missing service and command sequence.

Run: `npm test -- tests/extension-source-service.test.ts`

Expected: FAIL because `ExtensionSourceService` and its injected checkout checks do not exist.

- [ ] **Step 3: Implement `prepare`** to refuse unsafe destinations, validate and fast-forward the official checkout, then check Node/npm and build. The service never deletes the checkout on failure.

```typescript
const action = getExtensionCheckoutAction(pathExists(checkoutPath), gitMetadataExists(checkoutPath));
if (action === 'refuse') throw new Error(`Not a Git checkout: ${checkoutPath}`);
if (action === 'clone') await run('git', ['clone', AAP_DEMO_EXTENSION_REPOSITORY_URL, checkoutPath]);
if (action === 'update') {
  const origin = await run('git', ['-C', checkoutPath, 'remote', 'get-url', 'origin']);
  if (origin.stdout.trim() !== AAP_DEMO_EXTENSION_REPOSITORY_URL) throw new Error('Extension checkout origin is not the official repository.');
  await run('git', ['-C', checkoutPath, 'pull', '--ff-only']);
}
const node = await run('node', ['--version']);
if ((parseNodeMajorVersion(node.stdout) ?? 0) < 24) throw new Error('Building the local extension requires Node.js 24 or newer.');
await run('npm', ['--version']);
await run('npm', ['ci'], { cwd: checkoutPath });
return run('npm', ['run', 'build'], { cwd: checkoutPath });
```

The private `run` helper merges `{ ...process.env, PATH: pathValue }` and the
provided stdout/stderr callbacks into `CommandExecutor.run`. Wrap missing
`node` and `npm` errors with messages that name the required executable.

- [ ] **Step 4: Run the focused test and confirm all command-sequence and failure cases pass.**

Run: `npm test -- tests/extension-source-service.test.ts`

Expected: PASS; failed preconditions must prevent subsequent npm/build commands.

### Task 3: Runtime install resolver and terminal handoff

**Files:**
- Create: `src/runtime-installer.ts`
- Create: `tests/runtime-installer.test.ts`

**Interfaces:**
- Produces a pure resolver for RHEL-family Linux (DNF), macOS (Homebrew), and Windows (WinGet); unsupported OSes produce manual guidance, not a guessed command.
- Produces a terminal-launch adapter injected behind an interface so tests assert the command without launching a real terminal.
- Resolver distinguishes package-manager missing from install command available and returns a platform-specific argument vector (never a concatenated user-controlled shell string).
- Runtime installation is never run silently in the extension host and never escalates privileges; the visible terminal is responsible for interactive prompts.
- After the terminal opens, the dashboard asks the developer to return and choose **Check again**. Re-check requires Node.js `>=24` and npm; success resumes setup/update, failure preserves the checkout and provides manual next steps.

- [ ] **Step 1: Add failing tests** for DNF/Homebrew/WinGet command selection, missing managers, unsupported OS guidance, and terminal-launch adapter arguments.

- [ ] **Step 2: Run the focused test and confirm expected failures.**

Run: `npm test -- tests/runtime-installer.test.ts`

Expected: FAIL because the runtime resolver and terminal adapter do not exist.

- [ ] **Step 3: Implement platform detection, manager lookup, safe argument-vector construction, and injectable visible-terminal launch.** Provide a copyable command/manual fallback when a terminal cannot be opened; do not guess distro-specific package syntax when the manager or compatible package is unavailable.

- [ ] **Step 4: Run focused tests and confirm they pass.**

### Task 4: Wire setup into settings, extension host, and dashboard

**Files:**
- Modify: `package.json`
- Modify: `src/dashboard-protocol.ts`
- Modify: `src/extension.ts`
- Modify: `src/webview/index.html`
- Modify: `src/webview/dashboard.ts`
- Modify: `tests/dashboard-protocol.test.ts`
- Modify: `tests/addon-ui.test.ts`

**Interfaces:**
- Consumes `ExtensionSourceService.prepare()` from Task 2.
- Add `aap-demo.extensionInstallLocation`, default `~/.aap-demo-podman-desktop-extension`.
- Add dashboard host messages `{ type: 'setup-extension' }`, `{ type: 'install-runtime' }`, and `{ type: 'check-runtime' }`; validate each in `isDashboardMessage`.
- The host sends the existing extension-source state to show **Set up local extension updates** for the custom OCI developer workflow, and **Update extension** only for a local checkout.
- Convert typed missing/outdated-runtime failures from Task 2 into a dashboard offer backed by Task 3. After terminal handoff, **Check again** re-runs the prerequisite check before retrying setup/update.
- A successful setup sends `{ type: 'extension-setup-complete', path: extensionInstallLocation }`; the dashboard explains that the OCI extension remains installed and the user must manually remove it once and add the checkout under **Extensions → Local Extensions**.

- [ ] **Step 1: Add failing protocol and UI tests** for accepting only the `setup-extension` message, rendering its button, and including one-time switch instructions after success.

In `tests/addon-ui.test.ts`, define `dashboardSource` by reading
`src/webview/dashboard.ts`, following the existing `extensionSource` pattern.

```typescript
it('accepts the explicit local-extension setup request', () => {
  expect(isDashboardMessage({ type: 'setup-extension' })).toBe(true);
});

it('provides the OCI-to-local setup action in the dashboard markup', () => {
  expect(dashboardHtml).toContain('id="setup-extension"');
});

it('renders the setup-complete handoff instructions', () => {
  expect(dashboardSource).toContain("message.type === 'extension-setup-complete'");
  expect(dashboardSource).toContain('Extensions → Local Extensions');
});
```

- [ ] **Step 2: Run focused tests and confirm they fail** because the message, button, and handler are absent.

Run: `npm test -- tests/dashboard-protocol.test.ts tests/addon-ui.test.ts`

Expected: FAIL on the new message and setup-action expectations.

- [ ] **Step 3: Implement host and UI wiring.** Read the setting at activation, construct the service with `settings.pathValue`, route the validated message to it, stream output, and keep CLI install/update actions unchanged.

```typescript
if (message.type === 'setup-extension') {
  await runExtensionSetup();
}
```

`runExtensionSetup` calls `ExtensionSourceService.prepare`, posts output chunks
as `command-output`, sends `command-error` on failure, and sends
`extension-setup-complete` with the resolved path on success. The webview
prints the one-time switch steps and path; it never sends an uninstall or
enable command.

- [ ] **Step 4: Run focused tests and confirm they pass.**

Run: `npm test -- tests/dashboard-protocol.test.ts tests/addon-ui.test.ts`

Expected: PASS; normal lifecycle/add-on actions and the two independent update actions remain unchanged.

### Task 5: Document the temporary developer workflow

**Files:**
- Modify: `README.md`
- Modify: `TESTING.md`
- Modify: `docs/adr/001-cli-installation-and-resource-settings.md`

**Interfaces:**
- Consumes the completed dashboard setup, updater, and runtime-install behavior from Task 4.
- ADR-001 documents the distinct CLI and extension checkouts/settings/actions.
- ADR-002 remains the design record for the temporary developer bridge; update its status to accepted only after user review approves the written design.
- README and TESTING explain that the OCI-to-local switch, runtime-install offer, and local update path are temporary developer tools; catalog-distributed users do not need them.

- [ ] **Step 1: Update README, TESTING, and ADR-001** with the separate checkout path and user-confirmed transition steps.

- [ ] **Step 2: Keep the README, TESTING, and ADR-001 wording scoped to the temporary developer bridge** and document retirement when catalog distribution becomes the supported user path. Do not make catalog work a prerequisite.

- [ ] **Step 3: Run repository verification.**

Run: `npm test && npm run typecheck && npm run build`

Expected: all tests, typecheck, and both production builds pass.

- [ ] **Step 4: Manually validate in Podman Desktop:** from the OCI dashboard, prepare the source checkout, confirm the OCI extension remains untouched, then perform the one-time user-managed switch; from the local extension, update/build and stop/start it; verify CLI update still affects only the `aap-demo` checkout.

## Handoff

The implementation is intentionally split into checkout safety, source build,
runtime-install offer, UI wiring, and documentation. The service tests define
external commands before host integration; the runtime offer remains explicit
and visible to the developer. The final UI validation exercises the temporary
OCI-to-local development handoff, not the future catalog-user journey.
