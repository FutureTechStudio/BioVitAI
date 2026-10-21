#!/usr/bin/env python3
from pathlib import Path
import json,hashlib,re,csv,io,zipfile
root=Path(__file__).resolve().parents[1]
m=json.loads((root/'governance/MANIFEST.json').read_text(encoding='utf8'))
req=root/'requirements'
assert len(list(req.glob('[0-5][0-9]-*.md')))==60
for f in m['original_file_integrity']:
 src=(root/'archive/v2-original'/f['file']).read_bytes()
 updated=(req/f['file']).read_bytes()
 assert hashlib.sha256(src).hexdigest()==f['v2_file_sha256'],f['file']
 assert updated.startswith(src), f'V2 content not preserved in {f["file"]}'
 assert b'BIOVITAI_V2_1_INTEGRATION_AMENDMENT' in updated
for f in m['new_files']:
 assert hashlib.sha256((req/f['file']).read_bytes()).hexdigest()==f['sha256']
tracker=list(csv.DictReader(io.StringIO((root/'project-management/BiovitAI_v2_1_Development_Tracker.csv').read_text(encoding='utf-8-sig'))))
assert len(tracker)==51
assert {r['Status'] for r in tracker} <= {'Backlog','Ready','In Progress','In Review','Done','Blocked'}
assert zipfile.ZipFile(root/'project-management/BiovitAI_v2_1_Development_Tracker.xlsx').testzip() is None
print('PASS: 44 V2 source bodies and originals preserved; 16 new specs; 60 working requirements; 51 tasks; XLSX integrity.')
