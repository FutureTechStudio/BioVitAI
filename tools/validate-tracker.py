"""Validate tracker representations and dependency evidence without granting approval."""
from pathlib import Path
import csv
import json
from zipfile import ZipFile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PM = ROOT / 'documentation/BiovitAI-Documentation-v2.1/project-management'
ALLOWED = {'Backlog', 'Ready', 'In Progress', 'In Review', 'Done', 'Blocked'}


def validate():
    with (PM / 'BiovitAI_v2_1_Development_Tracker.csv').open(encoding='utf-8-sig', newline='') as source:
        rows = list(csv.DictReader(source))
    canonical = json.loads((PM / 'BiovitAI_v2_1_Development_Tracker.json').read_text(encoding='utf-8'))
    assert len(rows) == len(canonical) == 51
    assert len({r['ID'] for r in rows}) == 51
    for row, record in zip(rows, canonical):
        assert row == {key: str(value) for key, value in record.items()}, row['ID']
        assert row['Status'] in ALLOWED, row['ID']
        assert row['Status'] == 'Backlog' or row['Notes'].strip(), row['ID']
    by_id = {r['ID']: r for r in rows}
    register = json.loads((ROOT / 'docs/p0/approvals.json').read_text(encoding='utf8'))
    deferred = set(register.get('developmentDeferrals', {}).get('taskIds', []))
    accepted = set(register.get('developmentAcceptance', {}).get('taskIds', []))
    assert accepted <= {'BV-001', 'BV-002', 'BV-003', 'BV-005', 'BV-006', 'BV-007'}
    if accepted:
        assert (ROOT / register['developmentAcceptance']['evidence']).is_file()
    engineering = json.loads((ROOT / 'docs/engineering/development-prerequisites.json').read_text(encoding='utf8'))
    local_prerequisites = set()
    for entry in engineering['accepted']:
        engineering_scope = {f'BV-{number:03}' for number in [*range(8, 30), 31]}
        assert entry['taskId'] in engineering_scope and entry['status'] == 'In Review'
        assert entry['taskId'] not in local_prerequisites
        assert (ROOT / entry['evidence']).is_file() and entry['scope'].strip()
        local_prerequisites.add(entry['taskId'])
    accepted |= local_prerequisites
    assert deferred <= {'BV-004'}, 'Only the documented reviewer appointment can be deferred'
    if deferred:
        assert (ROOT / register['developmentDeferrals']['evidence']).is_file()
    visited = set()

    def visit(task_id, active):
        assert task_id in by_id, f'Unknown dependency: {task_id}'
        assert task_id not in active, f'Dependency cycle: {task_id}'
        if task_id in visited:
            return
        row = by_id[task_id]
        dependencies = [d.strip() for d in row['Dependencies'].split(',') if d.strip()]
        for dependency in dependencies:
            visit(dependency, active | {task_id})
            if row['Status'] in {'Ready', 'In Progress', 'In Review', 'Done'}:
                if row['Status'] != 'Done' and dependency in accepted and by_id[dependency]['Status'] == 'In Review':
                    continue  # Development acceptance is not a formal Done/signoff claim.
                if dependency in deferred and row['Status'] in {'Ready', 'In Progress', 'In Review'}:
                    continue  # Owner permits development; original Done acceptance still applies.
                assert by_id[dependency]['Status'] == 'Done', f'{task_id}: prerequisite {dependency} incomplete'
        visited.add(task_id)

    for task_id in by_id:
        visit(task_id, set())
    baseline = json.loads((PM / 'history/2026-10-20-before-p0/BiovitAI_v2_1_Development_Tracker.json').read_text(encoding='utf8'))
    for old, current in zip(baseline, canonical):
        assert {k: v for k, v in old.items() if k not in {'Status', 'Notes'}} == {k: v for k, v in current.items() if k not in {'Status', 'Notes'}}, current['ID']
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with ZipFile(PM / 'BiovitAI_v2_1_Development_Tracker.xlsx') as archive:
        # Validate package XML as well as cell data: missing namespace declarations
        # can otherwise leave a visually authored sheet inaccessible to Excel.
        for name in archive.namelist():
            if name.endswith(('.xml', '.rels')):
                ET.fromstring(archive.read(name))
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(item.itertext()) for item in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        sheet = ET.fromstring(archive.read('xl/worksheets/sheet2.xml'))
        values = {}
        for cell in sheet.findall('.//s:sheetData/s:row/s:c', ns):
            raw = cell.find('s:v', ns)
            value = raw.text if raw is not None else ''
            if cell.get('t') == 's':
                value = strings[int(value)]
            elif cell.get('t') == 'inlineStr':
                value = ''.join(cell.find('s:is', ns).itertext())
            values[cell.get('r')] = value
        assert values['A1'] == 'ID' and values['I1'] == 'Status' and values['O1'] == 'Notes'
        for index, row in enumerate(rows, 2):
            assert values[f'A{index}'] == row['ID']
            assert values[f'I{index}'] == row['Status'], row['ID']
            assert values.get(f'O{index}', '') == row['Notes'], row['ID']
        with (PM / 'BiovitAI_v2_1_Decision_Log.csv').open(encoding='utf-8-sig', newline='') as source:
            decisions = list(csv.DictReader(source))
        assert len(decisions) == 10 and len({row['ID'] for row in decisions}) == 10
        decision_values = {}
        decision_sheet = ET.fromstring(archive.read('xl/worksheets/sheet4.xml'))
        for cell in decision_sheet.findall('.//s:sheetData/s:row/s:c', ns):
            raw = cell.find('s:v', ns)
            value = raw.text if raw is not None else ''
            if cell.get('t') == 's':
                value = strings[int(value)]
            elif cell.get('t') == 'inlineStr':
                value = ''.join(cell.find('s:is', ns).itertext())
            decision_values[cell.get('r')] = value
        for index, row in enumerate(decisions, 2):
            assert decision_values[f'A{index}'] == row['ID']
            assert decision_values[f'E{index}'] == row['Status'], row['ID']
            assert decision_values[f'F{index}'] == row['Notes'], row['ID']
        journey = json.loads((PM / 'Connected_Journey_Tracker.json').read_text(encoding='utf8'))
        with (PM / 'Connected_Journey_Tracker.csv').open(encoding='utf8', newline='') as source:
            assert list(csv.DictReader(source)) == journey
        book = ET.fromstring(archive.read('xl/workbook.xml'))
        sheet = next(s for s in book.findall('s:sheets/s:sheet', ns) if s.get('name') == 'Journey')
        rid = sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        relationships = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        location = next(r.get('Target') for r in relationships if r.get('Id') == rid)
        part = location.lstrip('/') if location.startswith('/') else 'xl/' + location
        values = {}
        for cell in ET.fromstring(archive.read(part)).findall('.//s:sheetData/s:row/s:c', ns):
            raw = cell.find('s:v', ns)
            value = raw.text if raw is not None else ''
            if cell.get('t') == 's':
                value = strings[int(value)]
            elif cell.get('t') == 'inlineStr':
                value = ''.join(cell.find('s:is', ns).itertext())
            values[cell.get('r')] = value
        assert len(journey) == 18 and values['A4'] == 'ID'
        columns = ['ID', 'Workstream', 'Status', 'Dependencies', 'Related Tasks', 'Evidence', 'Notes']
        for index, record in enumerate(journey, 5):
            for column, key in zip('ABCDEFG', columns):
                assert values[column + str(index)] == record[key], record['ID'] + ': ' + key
    print('PASS: 51 tasks and 10 decisions reconciled across CSV/JSON/XLSX; baseline fields and dependency gates preserved')
    print('PASS: 18 connected journey epics reconcile across CSV/JSON/XLSX; workbook XML is well-formed')


if __name__ == '__main__':
    validate()
