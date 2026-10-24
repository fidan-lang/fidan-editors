"""Run only the credential-free release-tag guard, never publication steps."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[1]

class ReleaseTagTests(unittest.TestCase):
    def test_namespaced_tag_guard_accepts_only_canonical_stable_tags(self):
        bash = os.environ.get("BASH_BIN") or shutil.which("bash")
        if os.name == "nt" and not os.environ.get("BASH_BIN"):
            installed = Path(os.environ.get("ProgramFiles", "")) / "Git/bin/bash.exe"
            if installed.is_file():
                bash = str(installed)
        self.assertIsNotNone(bash, "Bash required for the real release guard")
        workflow = yaml.safe_load((ROOT / ".github/workflows/publish-vscode-extension.yaml").read_text(encoding="utf-8"))
        step = next(s for s in workflow["jobs"]["publish-vscode"]["steps"] if s.get("id") == "release_tag")
        (ROOT / "target").mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ROOT / "target", prefix="tag-guard-") as tmp:
            scratch = Path(tmp)
            script = scratch / "guard.sh"
            script.write_text(step["run"], encoding="utf-8")
            output = scratch / "output"
            for tag in ("vscode/v1.0.10", "vscode/v0.0.0", "v1.0.10", "vscode/v01.0.10", "main", "../vscode/v1.0.10", "vscode/v1.0.10\nFORGED=1", 'vscode/v1.0.10"; touch INJECTED; #', "$(touch INJECTED)"):
                with self.subTest(tag=tag):
                    output.unlink(missing_ok=True)
                    env = {name: os.environ[name] for name in ("PATH", "SystemRoot", "WINDIR") if name in os.environ}
                    env.update(REQUESTED_TAG=tag, GITHUB_OUTPUT=output.as_posix())
                    result = subprocess.run([bash, script.as_posix()], cwd=scratch, env=env, capture_output=True, text=True, timeout=15)
                    valid = tag in ("vscode/v1.0.10", "vscode/v0.0.0")
                    self.assertEqual(result.returncode == 0, valid, result.stderr)
                    self.assertFalse((scratch / "INJECTED").exists())
                    if valid:
                        self.assertEqual(output.read_text().strip(), "tag=" + tag)
                    else:
                        self.assertFalse(output.exists())

if __name__ == "__main__":
    unittest.main()
