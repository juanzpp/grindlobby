from __future__ import annotations

import base64
import gzip
import hashlib
from pathlib import Path

BASE = Path(__file__).resolve().parent
EXPECTED_SHA256 = "04febd02166835d47ef8e16828261fb8c83212ec3cc22a621081174844b6c35d"
parts = sorted(BASE.glob("index.part.*"))
if len(parts) != 10:
    raise SystemExit(f"Expected 10 frontend parts, found {len(parts)}")

payload = "".join(p.read_text(encoding="utf-8").strip() for p in parts)
html = gzip.decompress(base64.b64decode(payload, validate=True))
digest = hashlib.sha256(html).hexdigest()
if digest != EXPECTED_SHA256:
    raise SystemExit(f"Frontend integrity check failed: {digest} != {EXPECTED_SHA256}")

(BASE / "index.html").write_bytes(html)
print(f"Football IQ frontend reconstructed: {len(html)} bytes, sha256={digest}")
