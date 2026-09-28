"""Fetch explicitly selected, pinned OpenAI skills; never execute downloaded code."""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIN = "49f948faa9258a0c61caceaf225e179651397431"
SKILLS = ("openai-docs", "gh-fix-ci", "security-threat-model", "security-best-practices")
LOCK = ROOT / "docs/agents/upstream-skills.lock.json"
HEADERS = {"User-Agent": "treido-pinned-skill-import/1"}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_url(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=45) as response:
        data = response.read(2_000_001)
    if len(data) > 2_000_000:
        raise ValueError("Oversized upstream file")
    return data


def safe_target(relative: str) -> Path:
    path = ROOT / relative
    if ".." in Path(relative).parts or "\\" in relative or not relative.startswith(".agents/skills/"):
        raise ValueError("Unexpected managed path: " + relative)
    target = path.resolve()
    target.relative_to((ROOT / ".agents/skills").resolve())
    if path.is_symlink():
        raise ValueError("Managed skill cannot be a symlink")
    return target


def verify() -> None:
    record = json.loads(LOCK.read_text(encoding="utf-8"))
    if record["upstream_commit"] != PIN or sorted(record["skills"]) != sorted(SKILLS):
        raise ValueError("Pin/selection does not match lock; review upstream changes")
    expected = set()
    for item in record["files"]:
        target = safe_target(item["path"])
        if digest(target.read_bytes()) != item["sha256"]:
            raise ValueError("Managed upstream bytes changed: " + item["path"])
        expected.add(item["path"])
    actual = {p.relative_to(ROOT).as_posix() for name in SKILLS
              for p in (ROOT / ".agents/skills" / name).rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc"}
    if actual != expected:
        raise ValueError("Managed upstream inventory changed")
    for name in SKILLS:
        if not any(p.startswith(f".agents/skills/{name}/LICENSE") for p in expected):
            raise ValueError("Missing retained upstream license: " + name)
    print(f"Verified {len(SKILLS)} pinned OpenAI skills / {len(expected)} original files")


def install() -> None:
    if LOCK.exists():
        verify()
        return
    for name in SKILLS:
        folder = ROOT / ".agents/skills" / name
        if folder.exists():
            raise ValueError("Refusing to overwrite existing skill: " + name)
    tree = json.loads(read_url(f"https://api.github.com/repos/openai/skills/git/trees/{PIN}?recursive=1"))
    if tree.get("truncated"):
        raise ValueError("Incomplete upstream tree")
    entries = [e for e in tree["tree"] if e["type"] == "blob" and
               any(e["path"].startswith(f"skills/.curated/{name}/") for name in SKILLS)]
    if not 4 <= len(entries) <= 200:
        raise ValueError("Unexpected selected skill inventory")
    staged = []
    for entry in entries:
        source = entry["path"]
        if entry["mode"] not in ("100644", "100755") or ".." in Path(source).parts:
            raise ValueError("Unsafe upstream entry: " + source)
        if Path(source).suffix.lower() in (".woff", ".woff2", ".ttf", ".otf", ".eot"):
            raise ValueError("Font files are not distributed in this skill collection")
        data = read_url(f"https://raw.githubusercontent.com/openai/skills/{PIN}/{source}")
        git_hash = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
        if git_hash != entry["sha"]:
            raise ValueError("Upstream Git blob checksum mismatch: " + source)
        target = source.replace("skills/.curated/", ".agents/skills/", 1)
        safe_target(target)
        staged.append((target, source, entry["sha"], data))
    for name in SKILLS:
        licenses = [data for path, _, _, data in staged if path.startswith(f".agents/skills/{name}/LICENSE")]
        if not licenses or not any(b"Apache License" in b or b"MIT License" in b for b in licenses):
            raise ValueError("Review upstream license before redistribution: " + name)
        if not any(path == f".agents/skills/{name}/SKILL.md" for path, _, _, _ in staged):
            raise ValueError("Missing skill metadata: " + name)
    # All remote bytes, paths and licenses are checked before writing active skills.
    for path, _, _, data in staged:
        target = safe_target(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    record = {"schema_version": 1, "upstream_repository": "openai/skills",
              "upstream_commit": PIN, "retrieved_on": "2026-09-12", "skills": list(SKILLS),
              "modifications": "None; complete selected directories retained byte-for-byte. Downloaded scripts were not executed by this importer.",
              "files": [{"path": path, "upstream_path": source, "git_blob_sha1": sha,
                         "sha256": digest(data), "bytes": len(data)} for path, source, sha, data in staged]}
    LOCK.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    verify()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--install", action="store_true", help="Initial pinned import; never overwrite existing modified skills")
    group.add_argument("--verify", action="store_true", help="Offline byte/inventory/license verification")
    args = parser.parse_args()
    try:
        install() if args.install else verify()
    except (OSError, ValueError, KeyError) as error:
        print(f"Skill verification/import failed: {error}", file=sys.stderr)
        raise SystemExit(1)
