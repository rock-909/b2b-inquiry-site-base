"""运行真实扫描器，校验注释标出的命中点以及实际扫描范围。"""

import json
from pathlib import Path
import re
import subprocess


fixture_root = Path(__file__).resolve().parent
repo = fixture_root.parents[2]
targets = sorted(fixture_root.rglob("*.test.ts"))
expected = set()
for target in targets:
    for index, line in enumerate(target.read_text().splitlines()):
        match = re.search(r"// ruleid: ([\w-]+)", line)
        if match:
            expected.add((str(target), match[1], index + 2))
assert expected, "No positive rule fixtures were discovered"

result = subprocess.run(
    [
        "semgrep", "scan", "--config", str(repo / "semgrep.yml"),
        "--project-root", str(fixture_root), "--semgrepignore-v2",
        "--no-rewrite-rule-ids", "--metrics=off", "--disable-version-check",
        "--strict", "--json", str(fixture_root),
    ],
    cwd=fixture_root, capture_output=True, text=True, timeout=120,
    check=True,
)
report = json.loads(result.stdout)
assert not report["errors"], report["errors"]


def absolute(path):
    return str((fixture_root / path).resolve())


scanned = {absolute(path) for path in report["paths"]["scanned"]}
assert {str(target) for target in targets} <= scanned, "Some rule fixtures were not scanned"
actual = {
    (absolute(hit["path"]), hit["check_id"], hit["start"]["line"])
    for hit in report["results"]
}
assert actual == expected, f"Missing: {expected - actual}; unexpected: {actual - expected}"
print(f"PASS: {len(targets)} fixtures scanned, {len(expected)} exact findings, no unexpected matches")
