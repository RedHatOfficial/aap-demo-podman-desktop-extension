#!/usr/bin/env python3
"""Build and verify the AAP Demo Podman Desktop extension locally.

Podman Desktop currently requires the local-extension folder to be selected in
its UI. This helper automates the repeatable repository-side work and opens
Podman Desktop so the remaining UI step is easy to find.
"""

from __future__ import annotations

import argparse
import json
import platform
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Sequence


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "package.json"
REQUIRED_MANIFEST_FIELDS = ("name", "displayName", "version", "publisher", "description")


def missing_manifest_fields(path: Path = MANIFEST) -> list[str]:
    """Return required Podman Desktop manifest fields missing from package.json."""

    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return list(REQUIRED_MANIFEST_FIELDS)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Invalid JSON in {path}: {error}") from error

    return [
        field
        for field in REQUIRED_MANIFEST_FIELDS
        if not isinstance(manifest.get(field), str) or not manifest[field].strip()
    ]


def npm_script_command(script: str) -> list[str]:
    """Build the npm command for a package script."""

    return ["npm", "run", script]


def run(command: Sequence[str], *, dry_run: bool = False) -> None:
    print(f"$ {' '.join(command)}")
    if not dry_run:
        subprocess.run(command, cwd=ROOT, check=True)


def require_npm() -> None:
    if shutil.which("npm") is None:
        raise RuntimeError(
            "npm was not found on PATH. Install Node.js/npm, then rerun this script."
        )


def validate_repository() -> None:
    missing = missing_manifest_fields()
    if missing:
        fields = ", ".join(missing)
        raise RuntimeError(f"package.json is missing required manifest fields: {fields}")


def install_dependencies(*, dry_run: bool = False) -> None:
    require_npm()
    run(["npm", "ci"], dry_run=dry_run)


def ensure_dependencies(*, install: bool, dry_run: bool = False) -> None:
    require_npm()
    if (ROOT / "node_modules").is_dir():
        return
    if not install:
        raise RuntimeError(
            "node_modules is missing. Rerun with --install to run npm ci, or run npm ci manually."
        )
    install_dependencies(dry_run=dry_run)


def open_podman_desktop() -> None:
    if platform.system() == "Darwin":
        run(["open", "-a", "Podman Desktop"])
    elif platform.system() == "Linux" and shutil.which("podman-desktop"):
        run(["podman-desktop"])
    elif platform.system() == "Windows":
        raise RuntimeError(
            "Open Podman Desktop manually on Windows, then use Extensions → Local Extensions."
        )
    else:
        raise RuntimeError(
            "Could not find a supported way to launch Podman Desktop; open it manually."
        )


def print_local_extension_steps() -> None:
    print("\nLocal extension steps in Podman Desktop:")
    print("  1. Settings → Preferences → Extensions → enable Development mode")
    print("  2. Extensions → Local Extensions")
    print("  3. Select Add a local folder extension...")
    print(f"  4. Select {ROOT}")
    print("  5. Start or restart AAP Demo, then reopen its dashboard")


def command_build(args: argparse.Namespace) -> None:
    validate_repository()
    ensure_dependencies(install=args.install, dry_run=args.dry_run)
    run(npm_script_command("build"), dry_run=args.dry_run)
    print(f"\nBuild output is ready in {ROOT / 'dist'} and {ROOT / 'media'}.")
    if args.open:
        open_podman_desktop()
        print_local_extension_steps()


def command_verify(args: argparse.Namespace) -> None:
    validate_repository()
    ensure_dependencies(install=args.install, dry_run=args.dry_run)
    for script in ("test", "typecheck", "build"):
        run(npm_script_command(script), dry_run=args.dry_run)
    print("\nLocal verification passed.")


def command_watch(args: argparse.Namespace) -> None:
    validate_repository()
    ensure_dependencies(install=args.install)
    if args.open:
        open_podman_desktop()
        print_local_extension_steps()
    run(npm_script_command("watch"))


def command_open(_: argparse.Namespace) -> None:
    open_podman_desktop()
    print_local_extension_steps()


def parser() -> argparse.ArgumentParser:
    command_parser = argparse.ArgumentParser(
        description="Build, verify, and open the AAP Demo Podman Desktop extension locally."
    )
    subparsers = command_parser.add_subparsers(dest="command", required=True)

    build = subparsers.add_parser("build", help="Build the backend and webview outputs.")
    build.add_argument(
        "--install", action="store_true", help="Run npm ci if node_modules is missing."
    )
    build.add_argument(
        "--open", action="store_true", help="Open Podman Desktop after the build."
    )
    build.add_argument("--dry-run", action="store_true", help="Print commands without running them.")
    build.set_defaults(handler=command_build)

    verify = subparsers.add_parser("verify", help="Run tests, typecheck, and build.")
    verify.add_argument(
        "--install", action="store_true", help="Run npm ci if node_modules is missing."
    )
    verify.add_argument("--dry-run", action="store_true", help="Print commands without running them.")
    verify.set_defaults(handler=command_verify)

    watch = subparsers.add_parser("watch", help="Watch source files and rebuild continuously.")
    watch.add_argument(
        "--install", action="store_true", help="Run npm ci if node_modules is missing."
    )
    watch.add_argument(
        "--open", action="store_true", help="Open Podman Desktop before starting the watcher."
    )
    watch.set_defaults(handler=command_watch)

    open_command = subparsers.add_parser("open", help="Open Podman Desktop and print local-extension steps.")
    open_command.set_defaults(handler=command_open)
    return command_parser


def main(argv: Sequence[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        args.handler(args)
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
