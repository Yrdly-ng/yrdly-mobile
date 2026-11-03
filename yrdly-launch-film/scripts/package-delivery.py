"""Package verified exports and an explicit allowlist of editable project files."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED

root = Path(__file__).resolve().parent.parent
output = root / 'output'
delivery = root / 'delivery'
delivery.mkdir(exist_ok=True)
media = json.loads((output / 'media-verification.json').read_text())
temporal = json.loads((output / 'temporal-analysis.json').read_text())
playback = json.loads((output / 'playback-verification.json').read_text())
if len(media['files']) != 7 or len(temporal) != 7 or len(playback['checks']) != 7:
    raise RuntimeError('All seven exports must be verified before packaging')
if any(item['spikes'] or item['jumps'] for item in temporal):
    raise RuntimeError('Unresolved temporal defects')
if any(item['error'] or item['corruptedFrames'] for item in playback['checks']):
    raise RuntimeError('Unresolved playback defects')

checksums = []
videos = []
for item in media['files']:
    video = root / item['file']
    digest = hashlib.sha256(video.read_bytes()).hexdigest()
    if digest != item['sha256']:
        raise RuntimeError(f'Export changed after verification: {video.name}')
    checksums.append(f'{digest}  {video.name}')
    videos.append(video)
(output / 'SHA256SUMS.txt').write_text('\n'.join(checksums) + '\n')

with ZipFile(delivery / 'yrdly-final-videos.zip', 'w', compression=ZIP_STORED) as archive:
    for file in videos + [output / 'SHA256SUMS.txt', output / 'DELIVERY.md']:
        archive.write(file, file.name)

# Excludes node_modules, caches, device probes, private captures, environment files and Git data.
folders = ['assets', 'src', 'scripts', 'storyboard', 'previews', 'output']
files = [root / name for name in ['README.md', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'remotion.config.ts', '.gitignore']]
for folder in folders:
    files.extend(file for file in (root / folder).rglob('*') if file.is_file() and not file.is_symlink() and not any(part.startswith('.') for part in file.relative_to(root / folder).parts) and file.name != 'ios-reference.py')
files.extend(file for file in (root / 'review').glob('*') if file.is_file() and file.suffix in ['.png', '.json'])
with ZipFile(delivery / 'yrdly-editable-project.zip', 'w', compression=ZIP_DEFLATED, compresslevel=3) as archive:
    for file in sorted(set(files)):
        archive.write(file, Path('yrdly-launch-film') / file.relative_to(root))

report = []
for filename in ['yrdly-final-videos.zip', 'yrdly-editable-project.zip']:
    file = delivery / filename
    with ZipFile(file) as archive:
        if archive.testzip() is not None:
            raise RuntimeError(f'Archive integrity check failed: {filename}')
        members = archive.namelist()
        if filename == 'yrdly-editable-project.zip':
            required = ['src/Root.tsx', 'assets/asset-manifest.json', 'scripts/render-campaign.mjs', 'output/index.html']
            if any(f'yrdly-launch-film/{name}' not in members for name in required):
                raise RuntimeError('Editable archive is incomplete')
    report.append({'file': filename, 'bytes': file.stat().st_size, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'entries': len(members), 'integrity': 'passed'})
(delivery / 'archive-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
