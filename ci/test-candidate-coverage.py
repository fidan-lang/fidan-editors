"""Candidate CI must execute actual args Host and JSON-RPC coverage on every OS."""
import os
from pathlib import Path
import shutil
import subprocess
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[1]

class CandidateCoverage(unittest.TestCase):
    def test_all_hosts_use_exact_args_source_and_mandatory_json_rpc(self):
        workflow = yaml.safe_load((ROOT / ".github/workflows/verify-vscode.yaml").read_text())
        job = workflow["jobs"]["candidate-cli"]
        self.assertEqual({row["os"] for row in job["strategy"]["matrix"]["include"]}, {"windows-latest", "ubuntu-latest", "macos-latest"})
        steps = job["steps"]
        args = next(step for step in steps if step.get("with", {}).get("repository") == "fidan-lang/args")
        self.assertEqual(args["with"]["ref"], "${{ steps.candidate.outputs.args_sha }}")
        self.assertFalse(args["with"]["persist-credentials"])
        hosts = [step for step in steps if "scripts/check-extension-host.cjs" in step.get("run", "")]
        self.assertEqual(len(hosts), 2)
        for step in hosts:
            self.assertEqual(step["env"]["FIDAN_ARGS_ROOT"], "${{ github.workspace }}/args")
            self.assertIn("compiler/target/debug/fidan", step["env"]["FIDAN_BIN"])
        rpc = next(step for step in steps if "test_args_lsp.py" in step.get("run", ""))
        self.assertEqual(rpc["env"]["FIDAN_ARGS_ROOT"], "${{ github.workspace }}/args")
        self.assertIn("throw", rpc["run"])
        self.assertTrue(any("audited-setup compiler args" in step.get("run", "") for step in steps))

    def test_missing_args_source_fails_before_launching_the_editor(self):
        env = dict(os.environ)
        env.pop("FIDAN_ARGS_ROOT", None)
        result = subprocess.run([shutil.which("node"), str(ROOT / "vscode/scripts/check-extension-host.cjs")], env=env, capture_output=True, text=True, timeout=20)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("FIDAN_ARGS_ROOT is required", result.stderr)
        self.assertNotIn("HOST SKIP", result.stdout)

if __name__ == "__main__": unittest.main()
