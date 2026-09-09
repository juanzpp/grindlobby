from __future__ import annotations

import base64
import hashlib
import lzma
from pathlib import Path

BASE = Path(__file__).resolve().parent
EXPECTED_SHA256 = "3fe6540f3e4ee3b5cc75a6c68d9fa1c046887635d02b0dca0736da7e5362915b"
EXPECTED_PAYLOAD_LEN = 87792
PART_NAMES = [f"frontend_payload.part.{i:02d}" for i in range(5)]

parts = [BASE / name for name in PART_NAMES]
missing = [p.name for p in parts if not p.exists()]
if missing:
    raise SystemExit(f"Missing frontend payload parts: {missing}")

payload = "".join(p.read_text(encoding="utf-8").strip() for p in parts)
if len(payload) != EXPECTED_PAYLOAD_LEN:
    raise SystemExit(f"Frontend payload length mismatch: {len(payload)} != {EXPECTED_PAYLOAD_LEN}")

html = lzma.decompress(base64.b64decode(payload, validate=True))
digest = hashlib.sha256(html).hexdigest()
if digest != EXPECTED_SHA256:
    raise SystemExit(f"Frontend integrity check failed: {digest} != {EXPECTED_SHA256}")

(BASE / "index.html").write_bytes(html)
print(f"Football IQ frontend reconstructed: {len(html)} bytes, sha256={digest}")
