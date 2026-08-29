from __future__ import annotations

import base64
import gzip
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
out = repo / "adega-crm"
work = Path(tempfile.mkdtemp(prefix="adega-normalize-"))
runtime = work / "runtime"
runtime.mkdir(parents=True)


def decode_join(parts: list[Path]) -> bytes:
    raw = "".join(p.read_text(encoding="utf-8").strip() for p in parts)
    return base64.b64decode(raw, validate=True)


# Base snapshot
base_parts = sorted((repo / "adega-full-preview/source-parts").glob("part_*"))
base_archive = work / "base.tgz"
base_archive.write_bytes(decode_join(base_parts))
with tarfile.open(base_archive, "r:gz") as tf:
    tf.extractall(runtime)

# Backend functional/auth patch
backend_parts = sorted((repo / "adega-demo-patch/backend").glob("part_*"))
if backend_parts:
    backend_archive = work / "backend.tgz"
    backend_archive.write_bytes(decode_join(backend_parts))
    with tarfile.open(backend_archive, "r:gz") as tf:
        tf.extractall(runtime)

# Frontend diffs were appended over time as independent base64/gzip streams.
# Detect a stream only when the accumulated parts decode AND decompress successfully.
parts = sorted((repo / "adega-demo-patch/frontend-diff").glob("part_*"))
groups: list[list[Path]] = []
cur: list[Path] = []
for part in parts:
    cur.append(part)
    try:
        payload = decode_join(cur)
        gzip.decompress(payload)
    except Exception:
        continue
    groups.append(cur)
    cur = []
if cur:
    raise RuntimeError(f"incomplete frontend diff stream: {[p.name for p in cur]}")

frontend = runtime / "frontend"
for index, group in enumerate(groups):
    diff = gzip.decompress(decode_join(group))
    diff_path = work / f"frontend-{index:02d}.diff"
    diff_path.write_bytes(diff)
    result = subprocess.run(
        ["patch", "--batch", "-p1", "-i", str(diff_path)],
        cwd=frontend,
        text=True,
        capture_output=True,
    )
    # patch returns 1 for already-applied/partially-applicable historical hunks; keep going,
    # but preserve .rej files so later validation can detect material regressions.
    if result.returncode not in (0, 1):
        raise RuntimeError(result.stdout + "\n" + result.stderr)

# Fallback for the approved dashboard blueprint if it is not already in the reconstructed patch stream.
manager = frontend / "components/ManagerApp.tsx"
css = frontend / "app/globals.css"
if manager.exists() and "dashboard-blueprint" not in manager.read_text(encoding="utf-8"):
    dashboard_diff = repo / "adega-dashboard/dashboard-manager.diff"
    if dashboard_diff.exists():
        subprocess.run(["patch", "--batch", "-p1", "-i", str(dashboard_diff)], cwd=frontend, check=False)
    dashboard_css = repo / "adega-dashboard/dashboard-blueprint.css"
    if dashboard_css.exists() and "dashboard-blueprint" not in css.read_text(encoding="utf-8"):
        css.write_text(css.read_text(encoding="utf-8") + "\n" + dashboard_css.read_text(encoding="utf-8"), encoding="utf-8")

# Materialize the approved login blueprint image from text storage.
small_image = repo / "adega-demo-patch/login-image-small.b64"
if small_image.exists():
    assets = frontend / "public/assets"
    assets.mkdir(parents=True, exist_ok=True)
    (assets / "login-blueprint.jpg").write_bytes(base64.b64decode(small_image.read_text(encoding="utf-8")))

# Replace the previous normalized directory atomically.
if out.exists():
    shutil.rmtree(out)
out.mkdir(parents=True)
for name in ("frontend", "backend"):
    src = runtime / name
    if src.exists():
        shutil.copytree(src, out / name)
for name in ("README.md", "SECURITY.md"):
    src = runtime / name
    if src.exists():
        shutil.copy2(src, out / name)

# Never materialize runtime databases, caches or legacy generated files into source control.
for pattern in ("*.db", "*.sqlite", "*.sqlite3"):
    for p in out.rglob(pattern):
        p.unlink()
for dirname in (".pytest_cache", "__pycache__", ".next", "node_modules"):
    for p in list(out.rglob(dirname)):
        if p.is_dir():
            shutil.rmtree(p, ignore_errors=True)
for p in out.rglob("*.rej"):
    p.unlink()

subprocess.run(["python", str(repo / "adega-crm-bootstrap/privacy_patch.py"), str(out)], check=True)
print(f"Normalized Adega CRM source materialized at {out}")
