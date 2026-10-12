#!/usr/bin/env python3
"""Regenerate the PRECACHE list + VERSION in sw.js from the files on disk. Run from the project root."""
import hashlib, os, re, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'scripts', '__pycache__', '.git', 'src'}
SKIP_FILES = {'sw.js', 'API.md', 'README.md'}
files = []
for d, dirs, fs in os.walk(ROOT):
    dirs[:] = sorted(x for x in dirs if x not in SKIP_DIRS)
    for f in sorted(fs):
        rel = os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, '/')
        if f in SKIP_FILES or f.endswith(('.zip', '.pyc', '.md')) and not rel.startswith('store/'): continue
        files.append(rel)
files.sort()
def h(p): return hashlib.sha1(open(os.path.join(ROOT, p), 'rb').read()).hexdigest()[:10]
entries = ',\n'.join('    "%s#%s"' % (p, h(p)) for p in files)
sw = open(os.path.join(ROOT, 'sw.js')).read()
ver = '2.3.0-' + time.strftime('%Y%m%d%H%M')
sw = re.sub(r"const PRECACHE = \[.*?\n\];", lambda m: 'const PRECACHE = [\n' + entries + '\n];', sw, flags=re.S)
sw = re.sub(r"const VERSION = '[^']*';", "const VERSION = '%s';" % ver, sw)
sw = re.sub(r"Version: \S+", "Version: " + ver, sw, count=1)
open(os.path.join(ROOT, 'sw.js'), 'w').write(sw)
print(len(files), 'files precached, version', ver)
