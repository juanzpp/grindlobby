from __future__ import annotations

import base64
import gzip
import hashlib
from pathlib import Path

BASE = Path(__file__).resolve().parent
EXPECTED_SHA256 = "04febd02166835d47ef8e16828261fb8c83212ec3cc22a621081174844b6c35d"
PART_NAMES = [
    "index.part.00", "index.part.01", "index.part.02", "index.part.03",
    "index.part.04", "index.part.05", "index.part.06", "index.part.07",
    "index.part.08a", "index.part.08b", "index.part.08c", "index.part.08d",
    "index.part.09",
]
parts = [BASE / name for name in PART_NAMES]
missing = [p.name for p in parts if not p.exists()]
if missing:
    raise SystemExit(f"Missing frontend parts: {missing}")

payload = "".join(p.read_text(encoding="utf-8").strip() for p in parts)
if len(payload) != 75628:
    raise SystemExit(f"Frontend payload length mismatch: {len(payload)} != 75628")

html = gzip.decompress(base64.b64decode(payload, validate=True))
digest = hashlib.sha256(html).hexdigest()
if digest != EXPECTED_SHA256:
    raise SystemExit(f"Frontend integrity check failed: {digest} != {EXPECTED_SHA256}")

(BASE / "index.html").write_bytes(html)
print(f"Football IQ frontend reconstructed: {len(html)} bytes, sha256={digest}")
