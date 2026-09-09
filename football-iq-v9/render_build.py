from __future__ import annotations
import base64, hashlib, lzma
from pathlib import Path
BASE=Path(__file__).resolve().parent
BASE_SHA256='3fe6540f3e4ee3b5cc75a6c68d9fa1c046887635d02b0dca0736da7e5362915b'
BASE_PAYLOAD_LEN=87792
PATCH_PAYLOAD_LEN=15868
PATCH_SHA256='39328f4ede8dff1b82d00c4fa7405c4e84b5fdf10f5ab7745f29770c6af45c24'
FINAL_SHA256='7714bf1234437044cd0079d127298dc77c99a6320be14a270747b73e20b391da'
BASE_PARTS=[f'frontend_payload.part.{i:02d}' for i in range(5)]
PATCH_PARTS=['v14.patch.part.00', 'v14.patch.part.01', 'v14.patch.part.02', 'v14.patch.part.03', 'v14.patch.part.04', 'v14.patch.part.05']
SPLIT='\n__FIQ_V14_SPLIT_A91C5D__\n'
LEGACY='\n\n\n  // ---------- BR DRAFT 2026 ----------'
parts=[BASE/n for n in BASE_PARTS]
missing=[p.name for p in parts if not p.exists()]
if missing: raise SystemExit(f'Missing base frontend parts: {missing}')
payload=''.join(p.read_text().strip() for p in parts)
if len(payload)!=BASE_PAYLOAD_LEN: raise SystemExit(f'Base payload length mismatch: {len(payload)} != {BASE_PAYLOAD_LEN}')
base_html=lzma.decompress(base64.b64decode(payload,validate=True))
base_sha=hashlib.sha256(base_html).hexdigest()
if base_sha!=BASE_SHA256: raise SystemExit(f'Base integrity failed: {base_sha} != {BASE_SHA256}')
pparts=[BASE/n for n in PATCH_PARTS]
missing=[p.name for p in pparts if not p.exists()]
if missing: raise SystemExit(f'Missing V14 patch parts: {missing}')
pp=''.join(p.read_text().strip() for p in pparts)
if len(pp)!=PATCH_PAYLOAD_LEN: raise SystemExit(f'Patch payload length mismatch: {len(pp)} != {PATCH_PAYLOAD_LEN}')
raw=lzma.decompress(base64.b64decode(pp,validate=True))
psha=hashlib.sha256(raw).hexdigest()
if psha!=PATCH_SHA256: raise SystemExit(f'Patch integrity failed: {psha} != {PATCH_SHA256}')
patch=raw.decode('utf-8')
if SPLIT not in patch: raise SystemExit('Patch separator missing')
css,js=patch.split(SPLIT,1)
html=base_html.decode('utf-8')
iife=html.rfind('})();'); script_end=html.rfind('</script>'); legacy=html.find(LEGACY,iife)
if iife<0 or script_end<0 or legacy<0 or legacy>script_end: raise SystemExit('V14 insertion/legacy anchors missing')
html=html[:legacy]+'\n\n'+html[script_end:]
html=html.replace('</style>','\n\n'+css+'\n\n</style>',1)
iife=html.rfind('})();')
html=html[:iife]+'\n\n'+js+'\n\n'+html[iife:]
out=html.encode('utf-8'); digest=hashlib.sha256(out).hexdigest()
if digest!=FINAL_SHA256: raise SystemExit(f'Final integrity failed: {digest} != {FINAL_SHA256}')
(BASE/'index.html').write_bytes(out)
print(f'Football IQ v14.1 P0 reconstructed: {len(out)} bytes, sha256={digest}')
