#!/usr/bin/env python3
"""Build the extra store content from scripts/src/ into store/ and refresh store/starter.js.

  scripts/src/apps/<id>.html   single-file apps  -> store/apps/<id>.json   (html inlined, <!--BASE--> + <!--HEAD:Title--> expanded)
  scripts/src/zips/<id>/       multi-file apps   -> store/apps/<id>.zip    (deflate, deterministic, sha256 recorded in repo.json)
  scripts/src/store_meta.py    metadata, themes, widgets, sound packs
Run:  python3 scripts/build_store.py
"""
import hashlib, json, os, sys, zipfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, 'src'))
import store_meta as M
STORE = os.path.join(ROOT, 'store'); ADIR = os.path.join(STORE, 'apps')
BASE = open(os.path.join(HERE, 'src', 'base.css'), encoding='utf-8').read().strip()
HEAD = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>%s</title><style>'
VERSION, UPDATED, UPD_HUMAN = '1.0.0', '2026-10-12', 'Oct 2026'

def upsert(lst, entry):
    for i, e in enumerate(lst):
        if e['id'] == entry['id']:
            lst[i] = entry; return
    lst.append(entry)

def main():
    repo = json.load(open(os.path.join(STORE, 'repo.json'), encoding='utf-8'))
    S = repo['sections']
    for k in ('apps', 'themes', 'widgets', 'soundpacks'): S.setdefault(k, [])
    # ---- single-file apps
    for fn in sorted(os.listdir(os.path.join(HERE, 'src', 'apps'))):
        aid = fn[:-5]
        if aid not in M.APPS: continue
        name, cat, icon, color, desc, long, win, rating, dl = M.APPS[aid]
        html = open(os.path.join(HERE, 'src', 'apps', fn), encoding='utf-8').read()
        if '<!--HEAD:' in html:
            title = html.split('<!--HEAD:')[1].split('-->')[0]
            html = html.replace('<!--HEAD:%s-->' % title, HEAD % title.replace('&', '&amp;'))
        html = html.replace('<!--BASE-->', BASE)
        assert '<!--' not in html.replace('<!--[', ''), aid
        d = {'id': aid, 'type': 'app', 'name': name, 'version': VERSION, 'category': cat, 'icon': icon, 'color': color, 'desc': desc, 'long': long,
             'changelog': 'First release', 'developer': 'Leonux Community', 'permissions': ['Runs offline', 'Sandboxed'], 'window': win, 'html': html}
        json.dump(d, open(os.path.join(ADIR, aid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        upsert(S['apps'], {'id': aid, 'name': name, 'version': VERSION, 'category': cat, 'icon': icon, 'color': color, 'desc': desc, 'long': long,
             'size': max(1, round(len(html) / 1024)), 'rating': rating, 'downloads': dl, 'developer': 'Leonux Community', 'path': 'apps/%s.json' % aid,
             'changelog': 'First release', 'updated': UPD_HUMAN})
    # ---- zip apps
    zroot = os.path.join(HERE, 'src', 'zips')
    for aid in sorted(os.listdir(zroot)):
        meta = json.load(open(os.path.join(zroot, aid, 'app.json'), encoding='utf-8'))
        long, rating, dl = M.ZIPS[aid]
        files = []
        for dp, _, fns in os.walk(os.path.join(zroot, aid)):
            for f in fns:
                p = os.path.join(dp, f); files.append((os.path.relpath(p, os.path.join(zroot, aid)).replace(os.sep, '/'), p))
        files.sort(key=lambda t: (t[0] != 'index.html', t[0]))
        zp = os.path.join(ADIR, aid + '.zip')
        with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for rel, p in files:
                zi = zipfile.ZipInfo(rel, (2026, 10, 12, 0, 0, 0)); zi.compress_type = zipfile.ZIP_DEFLATED; zi.external_attr = 0o644 << 16
                z.writestr(zi, open(p, 'rb').read())
        raw = open(zp, 'rb').read()
        upsert(S['apps'], {'id': aid, 'name': meta['name'], 'version': meta['version'], 'category': meta['category'], 'icon': meta['icon'], 'color': meta['color'],
             'desc': meta['desc'], 'long': long, 'size': max(1, round(len(raw) / 1024)), 'rating': rating, 'downloads': dl, 'developer': 'Leonux Community',
             'format': 'zip', 'package': 'apps/%s.zip' % aid, 'files': len(files), 'sha256': hashlib.sha256(raw).hexdigest(), 'window': meta['window'],
             'changelog': 'First multi-file release', 'updated': UPD_HUMAN})
    common = {'version': VERSION, 'developer': 'Leonux Community', 'rating': 4.5, 'downloads': 3000, 'updated': UPD_HUMAN}
    for t in M.THEMES: upsert(S['themes'], dict(id=t['id'], type='theme', name=t['name'], version=VERSION, mode=t['mode'], accent=t['accent'], wallpaper=t['wallpaper'], desc=t['desc'], developer='Leonux Community', rating=4.6, downloads=4100, updated=UPD_HUMAN))
    for w in M.WIDGETS: upsert(S['widgets'], dict(id=w['id'], type='widget', name=w['name'], version=VERSION, desc=w['desc'], size=w['size'], developer='Leonux Community', rating=4.5, downloads=5200, updated=UPD_HUMAN, html=w['html']))
    for s in M.SOUNDPACKS: upsert(S['soundpacks'], dict(id=s['id'], type='soundpack', name=s['name'], version=VERSION, desc=s['desc'], developer='Leonux Community', rating=4.5, downloads=3300, updated=UPD_HUMAN, sounds=s['sounds']))
    ids = [e['id'] for e in S['apps']]; assert len(ids) == len(set(ids))
    repo['version'] = '2.1.0'; repo['updated'] = UPDATED
    json.dump(repo, open(os.path.join(STORE, 'repo.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print({k: len(v) for k, v in S.items()})
    import build_starter; build_starter.main()

if __name__ == '__main__':
    sys.path.insert(0, HERE); sys.exit(main())
