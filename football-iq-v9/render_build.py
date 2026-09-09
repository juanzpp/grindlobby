from __future__ import annotations

import base64
import hashlib
import lzma
from pathlib import Path

BASE = Path(__file__).resolve().parent
OLD_SHA256 = "3fe6540f3e4ee3b5cc75a6c68d9fa1c046887635d02b0dca0736da7e5362915b"
OLD_PAYLOAD_LEN = 87792
PATCH_SHA256 = "0b348b5b52820637a7931deb2aea6dcdf02c01fea3bb26b3ec030dcc01005a03"
FINAL_SHA256 = "93b9540fa35de9ce3a2fd9e318abd3342de2d4e0f28525b1a65aed0b83604988"
PART_NAMES = [f"frontend_payload.part.{i:02d}" for i in range(5)]
PATCH_NAME = "draft_v13.patch.b64"
SPLIT = "\n__FIQ_V13_SPLIT_9C7B3A__\n"

parts = [BASE / name for name in PART_NAMES]
missing = [p.name for p in parts if not p.exists()]
if missing:
    raise SystemExit(f"Missing frontend payload parts: {missing}")

payload = "".join(p.read_text(encoding="utf-8").strip() for p in parts)
if len(payload) != OLD_PAYLOAD_LEN:
    raise SystemExit(f"Frontend payload length mismatch: {len(payload)} != {OLD_PAYLOAD_LEN}")

old_html = lzma.decompress(base64.b64decode(payload, validate=True))
old_digest = hashlib.sha256(old_html).hexdigest()
if old_digest != OLD_SHA256:
    raise SystemExit(f"Base frontend integrity check failed: {old_digest} != {OLD_SHA256}")

patch_path = BASE / PATCH_NAME
if not patch_path.exists():
    raise SystemExit(f"Missing frontend patch: {PATCH_NAME}")
patch_payload = patch_path.read_text(encoding="utf-8").strip()
patch_raw = lzma.decompress(base64.b64decode(patch_payload, validate=True))
patch_digest = hashlib.sha256(patch_raw).hexdigest()
if patch_digest != PATCH_SHA256:
    raise SystemExit(f"Frontend patch integrity check failed: {patch_digest} != {PATCH_SHA256}")

patch_text = patch_raw.decode("utf-8")
if SPLIT not in patch_text:
    raise SystemExit("Frontend patch separator missing")
css_patch, js_patch = patch_text.split(SPLIT, 1)

html = old_html.decode("utf-8")
if "</style>" not in html or "</script>" not in html:
    raise SystemExit("Frontend insertion anchors missing")
html = html.replace("</style>", "\n\n" + css_patch + "\n\n</style>", 1)
script_pos = html.rfind("</script>")
html = html[:script_pos] + "\n\n" + js_patch + "\n\n" + html[script_pos:]
final_html = html.encode("utf-8")
final_digest = hashlib.sha256(final_html).hexdigest()
if final_digest != FINAL_SHA256:
    raise SystemExit(f"Final frontend integrity check failed: {final_digest} != {FINAL_SHA256}")

(BASE / "index.html").write_bytes(final_html)
print(f"Football IQ v13 frontend reconstructed: {len(final_html)} bytes, sha256={final_digest}")
