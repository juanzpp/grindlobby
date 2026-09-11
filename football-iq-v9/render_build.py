from __future__ import annotations
import base64, hashlib, lzma
from pathlib import Path

BASE = Path(__file__).resolve().parent

# Reconstruct the current V14.1 P0 frontend exactly as before.
BASE_SHA256 = '3fe6540f3e4ee3b5cc75a6c68d9fa1c046887635d02b0dca0736da7e5362915b'
BASE_PAYLOAD_LEN = 87792
PATCH_PAYLOAD_LEN = 15868
PATCH_SHA256 = '39328f4ede8dff1b82d00c4fa7405c4e84b5fdf10f5ab7745f29770c6af45c24'
V14_FINAL_SHA256 = '7714bf1234437044cd0079d127298dc77c99a6320be14a270747b73e20b391da'
BASE_PARTS = [f'frontend_payload.part.{i:02d}' for i in range(5)]
PATCH_PARTS = [f'v14.patch.part.{i:02d}' for i in range(6)]
SPLIT = '\n__FIQ_V14_SPLIT_A91C5D__\n'
LEGACY = '\n\n\n  // ---------- BR DRAFT 2026 ----------'

parts = [BASE / n for n in BASE_PARTS]
missing = [p.name for p in parts if not p.exists()]
if missing:
    raise SystemExit(f'Missing base frontend parts: {missing}')
payload = ''.join(p.read_text().strip() for p in parts)
if len(payload) != BASE_PAYLOAD_LEN:
    raise SystemExit(f'Base payload length mismatch: {len(payload)} != {BASE_PAYLOAD_LEN}')
base_html = lzma.decompress(base64.b64decode(payload, validate=True))
base_sha = hashlib.sha256(base_html).hexdigest()
if base_sha != BASE_SHA256:
    raise SystemExit(f'Base integrity failed: {base_sha} != {BASE_SHA256}')

pparts = [BASE / n for n in PATCH_PARTS]
missing = [p.name for p in pparts if not p.exists()]
if missing:
    raise SystemExit(f'Missing V14 patch parts: {missing}')
pp = ''.join(p.read_text().strip() for p in pparts)
if len(pp) != PATCH_PAYLOAD_LEN:
    raise SystemExit(f'Patch payload length mismatch: {len(pp)} != {PATCH_PAYLOAD_LEN}')
raw = lzma.decompress(base64.b64decode(pp, validate=True))
psha = hashlib.sha256(raw).hexdigest()
if psha != PATCH_SHA256:
    raise SystemExit(f'Patch integrity failed: {psha} != {PATCH_SHA256}')
patch = raw.decode('utf-8')
if SPLIT not in patch:
    raise SystemExit('V14 patch separator missing')
css, js = patch.split(SPLIT, 1)

html = base_html.decode('utf-8')
iife = html.rfind('})();')
script_end = html.rfind('</script>')
legacy = html.find(LEGACY, iife)
if iife < 0 or script_end < 0 or legacy < 0 or legacy > script_end:
    raise SystemExit('V14 insertion/legacy anchors missing')
html = html[:legacy] + '\n\n' + html[script_end:]
html = html.replace('</style>', '\n\n' + css + '\n\n</style>', 1)
iife = html.rfind('})();')
html = html[:iife] + '\n\n' + js + '\n\n' + html[iife:]

v14_out = html.encode('utf-8')
v14_digest = hashlib.sha256(v14_out).hexdigest()
if v14_digest != V14_FINAL_SHA256:
    raise SystemExit(f'V14.1 integrity failed: {v14_digest} != {V14_FINAL_SHA256}')

# Apply V15 as an additive override so all V14.1 P0 fixes remain intact.
V15_PARTS = [f'v15.patch.part.{i:02d}' for i in range(4)]
V15_PAYLOAD_LEN = 10864
V15_RAW_SHA256 = '3f06553dcdfe7a157f8250b1ea84e5ae127781f83813bdfafbea411a0ce8588d'
V15_SPLIT = '\n__FIQ_V15_SPLIT__\n'
v15_files = [BASE / n for n in V15_PARTS]
missing = [p.name for p in v15_files if not p.exists()]
if missing:
    raise SystemExit(f'Missing V15 patch parts: {missing}')
v15_payload = ''.join(p.read_text().strip() for p in v15_files)
if len(v15_payload) != V15_PAYLOAD_LEN:
    raise SystemExit(f'V15 payload length mismatch: {len(v15_payload)} != {V15_PAYLOAD_LEN}')
v15_raw = lzma.decompress(base64.b64decode(v15_payload, validate=True))
v15_sha = hashlib.sha256(v15_raw).hexdigest()
if v15_sha != V15_RAW_SHA256:
    raise SystemExit(f'V15 patch integrity failed: {v15_sha} != {V15_RAW_SHA256}')
v15_patch = v15_raw.decode('utf-8')
if V15_SPLIT not in v15_patch:
    raise SystemExit('V15 patch separator missing')
v15_style, v15_js = v15_patch.split(V15_SPLIT, 1)

if 'fiq-v15-daily-draft-style' in html or 'FIQ V15: hard daily' in html:
    raise SystemExit('V15 markers unexpectedly already present in V14.1 base')
head_end = html.rfind('</head>')
script_end = html.rfind('</script>')
if head_end < 0 or script_end < 0:
    raise SystemExit('V15 insertion anchors missing')
html = html[:head_end] + '\n' + v15_style + '\n' + html[head_end:]
script_end = html.rfind('</script>')
html = html[:script_end] + '\n\n  ' + v15_js + '\n\n' + html[script_end:]

required = [
    'fiq-v15-daily-draft-style',
    'v15HardDailyBank',
    'dailyModeTimed',
    'dailyModeUntimed',
    'legendPackPending',
]
for marker in required:
    if marker not in html:
        raise SystemExit(f'V15 verification marker missing: {marker}')

out = html.encode('utf-8')
digest = hashlib.sha256(out).hexdigest()
(BASE / 'index.html').write_bytes(out)
print(f'Football IQ V15 built over V14.1 P0: {len(out)} bytes, sha256={digest}')
