from __future__ import annotations

import base64
import hashlib
import lzma
from pathlib import Path

BASE = Path(__file__).resolve().parent
EXPECTED_SHA256 = "305e68c9083cf0c52947801131bf27b4c0bc812890bba1080354aa6ded4ffec0"
PART_NAMES = [
    "brdeploy.part.00", "brdeploy.part.01", "brdeploy.part.02", "brdeploy.part.03",
    "brdeploy.part.04", "brdeploy.part.05", "brdeploy.part.06", "brdeploy.part.07",
    "brdeploy.part.08", "brdeploy.part.09", "brdeploy.part.10a", "brdeploy.part.10b",
    "brdeploy.part.11", "brdeploy.part.12",
]
parts = [BASE / name for name in PART_NAMES]
missing = [p.name for p in parts if not p.exists()]
if missing:
    raise SystemExit(f"Missing frontend parts: {missing}")

payload = "".join(p.read_text(encoding="utf-8").strip() for p in parts)
if len(payload) != 72352:
    raise SystemExit(f"Frontend payload length mismatch: {len(payload)} != 72352")

html = lzma.decompress(base64.b64decode(payload, validate=True))
digest = hashlib.sha256(html).hexdigest()
if digest != EXPECTED_SHA256:
    raise SystemExit(f"Frontend integrity check failed: {digest} != {EXPECTED_SHA256}")

(BASE / "index.html").write_bytes(html)
print(f"Football IQ frontend reconstructed: {len(html)} bytes, sha256={digest}")
