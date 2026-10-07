import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).parents[1] / "scripts" / "podman_extension.py"
SPEC = importlib.util.spec_from_file_location("podman_extension", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class PodmanExtensionScriptTests(unittest.TestCase):
    def test_package_exposes_local_development_npm_scripts(self):
        manifest = json.loads((Path(__file__).parents[1] / "package.json").read_text())

        scripts = manifest["scripts"]

        self.assertEqual(
            scripts["dev:local"],
            "npm run build && node scripts/local-dev.mjs",
        )
        self.assertEqual(
            scripts["dev:watch"],
            "node scripts/local-dev.mjs && npm run watch",
        )
        self.assertEqual(
            scripts["verify:local"],
            "npm test && npm run typecheck && npm run build",
        )
        self.assertEqual(
            scripts["watch"],
            "node scripts/watch.mjs",
        )

    def test_validate_manifest_reports_all_required_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "package.json"
            manifest.write_text(json.dumps({"name": "example"}), encoding="utf-8")

            missing = MODULE.missing_manifest_fields(manifest)

            self.assertEqual(
                missing,
                ["displayName", "version", "publisher", "description"],
            )

    def test_validate_manifest_accepts_extension_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "package.json"
            manifest.write_text(
                json.dumps(
                    {
                        "name": "example",
                        "displayName": "Example",
                        "version": "1.0.0",
                        "publisher": "example",
                        "description": "Example extension",
                    }
                ),
                encoding="utf-8",
            )

            self.assertEqual(MODULE.missing_manifest_fields(manifest), [])

    def test_commands_use_npm_run_scripts(self):
        self.assertEqual(MODULE.npm_script_command("build"), ["npm", "run", "build"])
        self.assertEqual(
            MODULE.npm_script_command("typecheck"), ["npm", "run", "typecheck"]
        )

    def test_local_command_opens_podman_desktop_by_default(self):
        args = MODULE.parser().parse_args(["local"])

        self.assertTrue(args.open)
        self.assertFalse(args.install)


if __name__ == "__main__":
    unittest.main()
