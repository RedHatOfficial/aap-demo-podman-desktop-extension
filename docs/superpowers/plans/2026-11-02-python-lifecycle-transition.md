# Python Lifecycle Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the extension's core lifecycle, deploy, and status through `aap-demo` Python `2.0.0.dev2` while preserving Bash support for deferred features.

**Architecture:** Add explicit legacy and Python CLI backends to the command service. Python owns `create`, `deploy`, `start`, `stop`, `destroy`, and `status`; Bash remains the backend for deferred actions, Fleet, and legacy add-ons. Normalize Python structured status and keep Python pull-secret/manifest handling separate from legacy subscription attachment.

**Tech Stack:** TypeScript, Podman Desktop API, Vitest, Vite, Node.js 24, existing Flatpak host bridge, Markdown documentation.

**Spec:** `docs/superpowers/specs/2026-11-02-python-lifecycle-transition-design.md`

## Global Constraints

Scope update: implement Python core lifecycle, deploy, and structured status in
this slice. Defer Fleet routing/state/UI and leave Fleet on the existing path.

- The Python package version remains exactly `2.0.0.dev2`.
- Python owns `create`, `deploy`, `start`, `stop`, `destroy`, `status`, `enable fleet`, and `disable fleet`.
- Bash remains responsible for `idle`, `diagnose`, `repair`, `trust-ca`, and legacy add-ons until a later migration.
- The Python CLI path defaults to `aap-demo`; the existing legacy CLI path remains separately configurable.
- Python deploy uses `AAP_DEMO_PULL_SECRET` or `--pull-secret`; do not pass the Bash-only `PULL_SECRET_PATH` convention to Python.
- Do not run the legacy Windows controller API subscription attachment after Python deploy.
- Do not silently select Python Fleet `--no-import`.
- Do not automatically install or update Python packages in this slice.
- Do not put credentials or subscription manifest contents in process arguments or Podman Desktop settings.

## Review Focus

- A Python executable is present while the legacy Bash executable is absent; Python-backed actions work and Bash-only actions report the correct missing backend.
- A legacy Bash executable and Python executable resolve to different paths; each action reaches the intended executable without cross-routing.
- Python status reports `not_created`, `stopped`, or `running` and includes ANSI-free structured fields; the dashboard preserves the existing state model.
- Pull secrets exist in XDG config, XDG state, or legacy `~/.aap-demo`; readiness finds them in the documented precedence order without treating a directory as a secret file.
- Python deploy runs on Windows; the extension does not prompt for or attach legacy subscription credentials, and the Python command receives only supported settings.

---

### Task 1: Add explicit Python and legacy command backends

**Files:**
- Modify: `src/aap-demo-service.ts`
- Test: `tests/aap-demo-service.test.ts`

**Interfaces:**
- Consumes: Existing `CommandExecutor`, `CommandRunnerOptions`, `resolveHostCommand`, and `AapDemoSettings`.
- Produces: `AapDemoBackend`, `AapDemoCliPaths`, `AapDemoService.runWithBackend()`, `AapDemoService.runPythonQuery()`, and backend-aware `runAddon()` behavior used by later extension tasks.

- [ ] **Step 1: Write failing backend-routing tests**

Add these cases to `tests/aap-demo-service.test.ts`:

```ts
it('routes Python lifecycle actions to the Python CLI with noninteractive basic output', async () => {
  const executor = new RecordingExecutor();
  const service = new AapDemoService(executor, {
    legacy: '/opt/aap-demo-v1',
    python: '/home/test/.local/bin/aap-demo',
  });

  await service.run('deploy');
  expect(executor.calls[0]).toMatchObject({
    command: '/home/test/.local/bin/aap-demo',
    args: ['--output', 'basic', '--yes', 'deploy'],
  });
});

it('routes deferred lifecycle actions to the legacy CLI', async () => {
  const executor = new RecordingExecutor();
  const service = new AapDemoService(executor, {
    legacy: '/opt/aap-demo-v1',
    python: '/home/test/.local/bin/aap-demo',
  });

  await service.run('diagnose');
  expect(executor.calls[0]).toMatchObject({
    command: '/opt/aap-demo-v1',
    args: ['diagnose'],
  });
});

it('routes Fleet enable and disable to Python', async () => {
  const executor = new RecordingExecutor();
  const service = new AapDemoService(executor, {
    legacy: '/opt/aap-demo-v1',
    python: '/home/test/.local/bin/aap-demo',
  });

  await service.runAddon('enable', 'fleet');
  await service.runAddon('disable', 'fleet');
  expect(executor.calls.map(call => [call.command, call.args])).toEqual([
    ['/home/test/.local/bin/aap-demo', ['--output', 'basic', '--yes', 'enable', 'fleet']],
    ['/home/test/.local/bin/aap-demo', ['--output', 'basic', '--yes', 'disable', 'fleet']],
  ]);
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- tests/aap-demo-service.test.ts`

Expected: FAIL because the service only accepts one CLI path and does not add Python command prefixes.

- [ ] **Step 3: Implement backend types and routing**

Add the following public types and action sets to `src/aap-demo-service.ts`:

```ts
export type AapDemoBackend = 'legacy' | 'python';

export interface AapDemoCliPaths {
  legacy: CliPathResolver;
  python: CliPathResolver;
}

const PYTHON_ACTIONS = new Set<AapDemoAction>([
  'create', 'deploy', 'start', 'stop', 'destroy', 'status',
]);

const PYTHON_ADDONS = new Set(['fleet']);
```

Preserve the existing single-path constructor form for current callers by
normalizing a string/function into `{ legacy: value, python: value }`,
while allowing the extension to pass both explicit paths. Add
`runWithBackend(backend, action, idleState?, options?)` and make `run()` use
the Python backend for `PYTHON_ACTIONS` and the legacy backend otherwise.
Make `runAddon()` select Python only for `fleet`; all other addons remain
legacy. For Python actions, prepend `['--output', 'basic', '--yes']`; for
Python `status`, use `['--output', 'json']` instead so the extension can parse
structured output.

Keep host-bridge resolution backend-neutral, but make `withSettings()` accept
the backend. Python receives `PYTHONIOENCODING`, `PYTHONUTF8`, `CRC_CPUS`, and
`CRC_MEMORY`; it does not receive `AAP_DEMO_SKIP_CACHE`, `PULL_SECRET_PATH`,
or legacy-only subscription variables. Legacy behavior remains unchanged.
Expose `runPythonQuery(args, options?)` for structured read-only calls; it must
prepend `['--output', 'json']` and use the Python resolver without pretending
the query is one of the lifecycle actions.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- tests/aap-demo-service.test.ts`

Expected: PASS, including all existing legacy, Flatpak, AO, and secret-handling cases.

- [ ] **Step 5: Commit the backend service**

```bash
git add src/aap-demo-service.ts tests/aap-demo-service.test.ts
git commit -m "feat: add Python and legacy CLI backends"
```

### Task 2: Normalize Python status

**Files:**
- Create: `src/python-status.ts`
- Modify: `src/status-parser.ts`
- Test: `tests/python-status.test.ts`
- Test: `tests/status-parser.test.ts`

**Interfaces:**
- Consumes: Python `aap-demo status --output json` and `aap-demo config get addons.enabled --output json` stdout.
- Produces: `parsePythonStatusOutput(output)` returning `AapDemoStatus`.

- [ ] **Step 1: Write failing structured-status tests**

Create `tests/python-status.test.ts` with these fixtures and assertions:

```ts
const runningStatus = JSON.stringify({
  tool_version: '2.0.0.dev2',
  built: 'unknown',
  infra: 'OpenShift Local (CRC)',
  cluster_state: 'running',
  cluster_name: 'crc-microshift',
  kubeconfig: '/Users/example/.local/state/aap-demo/kubeconfig.microshift',
  tls: { system_trust: 'trusted', browser_trust: 'trusted' },
  routes: ['https://aap.apps.example.test'],
  credentials: [{ namespace: 'aap', username: 'admin', password: 'secret' }],
  addons: [{ name: 'portal', enabled: false }],
});

it('maps Python JSON status to the dashboard status model', () => {
  expect(parsePythonStatusOutput(runningStatus)).toMatchObject({
    toolVersion: '2.0.0.dev2',
    cluster: { state: 'running', name: 'crc-microshift' },
    kubeconfig: '/Users/example/.local/state/aap-demo/kubeconfig.microshift',
    routes: ['https://aap.apps.example.test'],
    credentials: [{ namespace: 'aap', username: 'admin', password: 'secret' }],
    addons: [{ name: 'portal', state: 'disabled' }],
  });
});

it('maps Python not_created and stopped states to existing dashboard states', () => {
  expect(parsePythonStatusOutput('{"cluster_state":"not_created"}').cluster.state).toBe('not-running');
  expect(parsePythonStatusOutput('{"cluster_state":"stopped"}').cluster.state).toBe('stopped');
});

```

Add a Python parser test for the `--output json` TLS mapping.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- tests/python-status.test.ts tests/status-parser.test.ts`

Expected: FAIL because `src/python-status.ts` and the `fleet` status field do not exist.

- [ ] **Step 3: Implement strict Python normalization**

Implement `parsePythonStatusOutput()` with `JSON.parse`, defaulting missing arrays to
empty arrays and unknown cluster states to `unknown`. Map `cluster_state` values
`not_created` and `not running` to `not-running`; map `running` and `stopped`
directly. Map Python addon `{name, enabled}` to the existing `{name, state}`
shape, preserve routes/credentials, and combine Python TLS system/browser values
using the existing trust-state rules.

Keep the existing human-text parser for legacy status.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- tests/python-status.test.ts tests/status-parser.test.ts`

Expected: PASS, including existing ANSI/text parsing tests.

- [ ] **Step 5: Commit status normalization**

```bash
git add src/python-status.ts src/status-parser.ts tests/python-status.test.ts tests/status-parser.test.ts
git commit -m "feat: normalize Python status"
```

### Task 3: Support Python XDG pull-secret discovery and configuration

**Files:**
- Modify: `src/prerequisites.ts`
- Modify: `src/extension.ts`
- Modify: `tests/prerequisites.test.ts`

**Interfaces:**
- Consumes: `PrerequisiteSettings.environment`, existing configured pull-secret path, and `parsePythonStatusOutput()`.
- Produces: XDG-aware `pullSecretCandidates(configuredPath, environment, homeDirectory)` and Python-specific readiness data.

- [ ] **Step 1: Write failing candidate-order tests**

Add tests covering explicit configuration, `XDG_CONFIG_HOME`, `XDG_STATE_HOME`,
and legacy fallback:

```ts
it('checks Python XDG config, state, and legacy pull-secret locations in order', () => {
  expect(pullSecretCandidates('', {
    XDG_CONFIG_HOME: '/home/test/.config',
    XDG_STATE_HOME: '/home/test/.local/state',
  }, '/home/test')).toEqual([
    '/home/test/.config/aap-demo/pull-secret.txt',
    '/home/test/.config/aap-demo/pull-secret.json',
    '/home/test/.local/state/aap-demo/pull-secret.txt',
    '/home/test/.local/state/aap-demo/pull-secret.json',
    '/home/test/.aap-demo/pull-secret.txt',
    '/home/test/.aap-demo/pull-secret.json',
    '/home/test/.aap-demo/pull-secret',
  ]);
});

it('uses an explicit pull-secret path without adding fallback candidates', () => {
  expect(pullSecretCandidates('/tmp/pull-secret.json', {}, '/home/test'))
    .toEqual(['/tmp/pull-secret.json']);
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- tests/prerequisites.test.ts`

Expected: FAIL because `pullSecretCandidates()` only knows legacy `~/.aap-demo` paths.

- [ ] **Step 3: Implement XDG-aware discovery**

Update `pullSecretCandidates()` to accept the environment and home directory,
derive `XDG_CONFIG_HOME` from `$XDG_CONFIG_HOME` or `~/.config`, derive
`XDG_STATE_HOME` from `$XDG_STATE_HOME` or `~/.local/state`, and return Python
`.txt`/`.json` candidates before legacy candidates. Update `findPullSecret()` and
`checkPrerequisites()` to pass the environment through. Keep the existing
configured-path behavior and valid-pull-secret content check.

In `extension.ts`, pass `process.env` to prerequisite checks and use the
resolved Python pull-secret path as `AAP_DEMO_PULL_SECRET` for Python deploys.
Do not put pull-secret contents in settings or argv.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- tests/prerequisites.test.ts tests/install-script.test.ts`

Expected: PASS, with existing legacy path and Windows installer tests unchanged.

- [ ] **Step 5: Commit pull-secret support**

```bash
git add src/prerequisites.ts src/extension.ts tests/prerequisites.test.ts
git commit -m "feat: discover Python XDG pull secrets"
```

### Task 4: Integrate backend routing into activation and deployment

**Files:**
- Modify: `package.json`
- Modify: `src/extension.ts`
- Modify: `src/cli-readiness.ts`
- Modify: `src/cli-version.ts`
- Test: `tests/extension-activation.test.ts`
- Test: `tests/addon-ui.test.ts`

**Interfaces:**
- Consumes: `AapDemoService` backend routing, Python status parsers, and XDG-aware prerequisites.
- Produces: `aap-demo.pythonCliPath` configuration, backend-specific readiness/version checks, merged dashboard status, and Python deploy behavior.

- [ ] **Step 1: Write failing activation/configuration tests**

Add tests that assert:

```ts
it('declares the configurable Python CLI path', () => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const setting = manifest.contributes.configuration.properties['aap-demo.pythonCliPath'];
  expect(setting.default).toBe('aap-demo');
  expect(setting.description).toContain('Python');
});

it('routes Python deploy without invoking legacy Windows subscription attachment', () => {
  const fixture = createActivationFixture({
    platform: 'win32',
    pythonStatus: JSON.stringify({ cluster_state: 'running', routes: [], credentials: [], addons: [] }),
    pythonDeploy: { stdout: 'deploy complete\n', stderr: '' },
  });

  return activateWithFixture(fixture).then(async state => {
    await state.commandHandlers.get('aap-demo.deploy')?.();
    expect(state.commands.some(command => command.includes('attach'))).toBe(false);
    expect(state.inputPrompts).toEqual([]);
  });
});
```

Extend the activation fixture so it can record both configured CLI paths and a
Python JSON status result. Assert that a Python status failure is surfaced as a
Python readiness message rather than a legacy “Install aap-demo” message. The
fixture must expose `createActivationFixture()`, `activateWithFixture()`,
`state.commands`, and `state.inputPrompts` as test-only helpers; production
code must not depend on them.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- tests/extension-activation.test.ts tests/addon-ui.test.ts`

Expected: FAIL because `package.json` has no Python CLI setting and activation constructs only one service path.

- [ ] **Step 3: Add configuration and backend-specific activation**

Add this `package.json` property beside `aap-demo.cliPath`:

```json
"aap-demo.pythonCliPath": {
  "type": "string",
  "default": "aap-demo",
  "description": "Path to the Python aap-demo executable used for the core lifecycle and Fleet."
}
```

Read both `cliPath` and `pythonCliPath` in `activate()`, resolve each through
the existing augmented PATH/Flatpak readiness functions, and construct
`AapDemoService` with `{ legacy, python }`. Detect the Python version for the
CLI tool and `cliVersion`; retain the legacy path for deferred actions.

Make readiness helpers accept a backend path and backend label. The Python
missing message must say that `aap-demo==2.0.0.dev2` is required and show
`pipx install aap-demo`, `pip install 'aap-demo==2.0.0.dev2'`, and
`uv tool install aap-demo` as user-run commands. Do not execute them.

- [ ] **Step 4: Route core actions and merge status**

Update `runAction()` so Python actions check the Python executable and use
`service.run()`'s Python routing. For status:

1. Run Python `status --output json` through `service.run()` and map it with
   `parsePythonStatusOutput()`.
2. Run Python `config get addons.enabled --output json` through
   `service.runPythonQuery(['config', 'get', 'addons.enabled'])` and map it with
   `parsePythonFleetState()`.
3. Best-effort run legacy `status` only to retain old add-on states; merge those
   add-ons with Python core fields and the Python Fleet field.
4. Update the status bar, post the merged status, and refresh prerequisites.

If the optional legacy status fails, keep Python core status and report no
legacy add-ons. If Python status fails, do not fall back silently to legacy
status; show the Python backend error so the user knows which installation is
required.

Before Python deploy, keep pull-secret/resource checks, but remove the
legacy Windows credential pre-prompt and skip the post-deploy
`attachWindowsSubscription()` call. Python actions must receive only Python
environment variables; `runAction('status')` used for preflight must use the
same Python backend.

- [ ] **Step 5: Run activation tests and the typecheck**

Run: `npm test -- tests/extension-activation.test.ts tests/addon-ui.test.ts && npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit activation integration**

```bash
git add package.json src/extension.ts src/cli-readiness.ts src/cli-version.ts tests/extension-activation.test.ts tests/addon-ui.test.ts
git commit -m "feat: route core actions through Python CLI"
```

### Task 5: Expose Python Fleet in the dashboard

Deferred by current scope; do not execute this task in this branch. Fleet
continues using the existing path until a separate migration plan is approved.

**Files:**
- Modify: `src/webview/addon-ui.ts`
- Modify: `src/webview/dashboard.ts`
- Modify: `src/dashboard-protocol.ts`
- Test: `tests/addon-ui.test.ts`

**Interfaces:**
- Consumes: `AapDemoStatus.fleet` and `DashboardMessage` addon actions.
- Produces: Fleet visibility only for Python Fleet state, with existing AO provider behavior unchanged.

- [ ] **Step 1: Write failing Fleet visibility tests**

Add tests for the rendering helper:

```ts
it('renders Fleet only when Python Fleet state is available', () => {
  expect(renderableAddons([{ name: 'fleet' }, { name: 'portal' }], { includeFleet: true })
    .map(addon => addon.name)).toEqual(['fleet', 'portal']);
  expect(renderableAddons([{ name: 'fleet' }, { name: 'portal' }])
    .map(addon => addon.name)).toEqual(['portal']);
});
```

Add a dashboard source assertion that a Fleet control posts `{ type: 'addon', action, addon: 'fleet' }` and does not include `llmProvider`.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- tests/addon-ui.test.ts`

Expected: FAIL because Fleet is currently always filtered out.

- [ ] **Step 3: Implement conditional Fleet rendering**

Change `renderableAddons()` to accept:

```ts
export function renderableAddons<T extends { name: string }>(
  addons: T[],
  options: { includeFleet?: boolean } = {},
): T[] {
  return sortAddons(addons).filter(addon =>
    (options.includeFleet || addon.name !== 'fleet')
      && !new Set(['local-cache', 'product-demo-satellite']).has(addon.name),
  );
}
```

In `dashboard.ts`, append the synthetic `fleet` status entry when
`status.fleet` is present, call `renderableAddons(..., { includeFleet: true })`,
and preserve the existing AO-specific controls. The Fleet button uses the
existing generic addon message path.

Update `dashboard-protocol.ts` validation only if needed; `fleet` already meets
the generic addon message schema and must remain unable to carry an AO provider.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- tests/addon-ui.test.ts tests/dashboard-protocol.test.ts`

Expected: PASS, including existing hidden-addon and AO-provider tests.

- [ ] **Step 5: Commit Fleet UI support**

```bash
git add src/webview/addon-ui.ts src/webview/dashboard.ts src/dashboard-protocol.ts tests/addon-ui.test.ts
git commit -m "feat: expose Python Fleet in the dashboard"
```

### Task 6: Document transitional Python setup and verify the branch

**Files:**
- Modify: `README.md`
- Modify: `RELEASE_NOTES.md`
- Create: `tests/documentation.test.ts`

**Interfaces:**
- Consumes: Final configuration keys and user-visible backend behavior from Tasks 1–5.
- Produces: User-facing transition guidance and a verified build.

- [ ] **Step 1: Write documentation assertions**

Create `tests/documentation.test.ts` with exact file-backed assertions:

```text
aap-demo==2.0.0.dev2
pipx install aap-demo
XDG_CONFIG_HOME / XDG_STATE_HOME
legacy Bash CLI
```

The test must read `README.md` and `RELEASE_NOTES.md` from the repository root
and assert that each required phrase occurs in the expected document; it must
not inspect implementation source strings.

- [ ] **Step 2: Run the documentation assertions to verify they fail**

Run: `npm test -- tests/documentation.test.ts`

Expected: FAIL until the transition guidance is added.

- [ ] **Step 3: Update user-facing guidance**

Add a short “Python CLI transition” section to `README.md` that explains:

1. Install the beta with `pipx install aap-demo`, or explicitly install
   `aap-demo==2.0.0.dev2` with pip.
2. Set `aap-demo.pythonCliPath` if the command is not on the host PATH.
3. Python-backed dashboard actions are create/deploy/start/stop/destroy/status
   and Fleet.
4. Bash-only actions still require the legacy command path until the full
   migration.
5. Pull secrets can live in Python XDG config/state directories or legacy
   `~/.aap-demo`; subscription manifests remain user-managed and automatic
   application is opt-in.

Add a release-note entry that links ADR-009 and calls out that the extension
still has two CLI backends during the transition.

- [ ] **Step 4: Run documentation assertions to verify they pass**

Run: `npm test -- tests/documentation.test.ts`

Expected: PASS.

- [ ] **Step 5: Run complete verification**

Run: `npm run verify:local`

Expected: Vitest, typecheck, and both Vite builds pass.

Then run: `python3 -m pytest tests/test_podman_extension.py -q`

Expected: PASS.

- [ ] **Step 6: Commit documentation and verification changes**

```bash
git add README.md RELEASE_NOTES.md tests/documentation.test.ts
git commit -m "docs: explain Python CLI transition"
```

## Final review checklist

- [ ] `git status --short --branch` shows only intentional committed work.
- [ ] `git log --oneline --decorate -8` contains the spec, ADR, and implementation commits.
- [ ] `npm run verify:local` passes.
- [ ] Python status output from `aap-demo 2.0.0.dev2` maps to a running/stopped/not-running dashboard state.
- [ ] Python Fleet state is visible and routes enable/disable to Python.
- [ ] Legacy Bash-only actions still route to the configured legacy CLI.
- [ ] No credential or manifest contents appear in process arguments, settings, or documentation examples.
