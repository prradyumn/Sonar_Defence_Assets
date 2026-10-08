#!/usr/bin/env python3
"""dev_server: serve the game folder and let the in-game layout editor save js/layout.js.

    python3 tools/dev_server.py            # then open http://localhost:8000/?edit=1
    python3 tools/dev_server.py --port 8123

POST /save-layout with {"overrides": {selector: {prop: number}}, "config": {name: number}}
rewrites js/layout.js. Listens on 127.0.0.1 only. Standard library only.
"""
import argparse
import functools
import http.server
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAYOUT = os.path.join(ROOT, 'js', 'layout.js')
HEADER = '/* layout overrides written by the in-game editor (index.html?edit=1 → Save). Hand-editing is fine. */\n'
SELECTOR = re.compile(r'^[\w\s#.\-\[\]="\':>*()+~,]{1,200}$')   # no { } ; < … so a key can never break out of its CSS rule
PROPS = {'left', 'top', 'width', 'height', 'minHeight', 'maxWidth', 'marginLeft', 'fontSize', 'zIndex', 'rotate', 'scale', 'opacity'}
CONST = re.compile(r'^[A-Z][A-Z0-9_]{0,31}$')


def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) < 1e6


def check(data):
    if not isinstance(data, dict) or set(data) - {'overrides', 'config'}:
        raise ValueError('expected {"overrides": {...}, "config": {...}}')
    ov, cfg = data.get('overrides', {}), data.get('config', {})
    if not isinstance(ov, dict) or not isinstance(cfg, dict) or len(ov) > 500:
        raise ValueError('overrides and config must be objects')
    for sel, props in ov.items():
        if not SELECTOR.match(sel) or '{' in sel or '}' in sel:
            raise ValueError('bad selector: %r' % sel[:60])
        if not isinstance(props, dict) or any(k not in PROPS or not is_num(v) for k, v in props.items()):
            raise ValueError('bad properties for %s' % sel)
    for k, v in cfg.items():
        if not CONST.match(k) or not is_num(v):
            raise ValueError('bad constant %r' % k)
    return {'overrides': ov, 'config': cfg}


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')          # a reload always picks up the new layout.js
        super().end_headers()

    def reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path.split('?')[0] != '/save-layout':
            return self.reply(404, {'ok': False, 'error': 'not found'})
        origin = self.headers.get('Origin')
        host = self.headers.get('Host', '')
        if origin and origin not in ('http://' + host, 'null'):   # only pages served by this server may save
            return self.reply(403, {'ok': False, 'error': 'cross-site save refused'})
        if 'application/json' not in self.headers.get('Content-Type', ''):
            return self.reply(415, {'ok': False, 'error': 'send application/json'})
        n = int(self.headers.get('Content-Length') or 0)
        if not 0 < n <= 1 << 20:
            return self.reply(413, {'ok': False, 'error': 'empty or too large'})
        try:
            data = check(json.loads(self.rfile.read(n).decode('utf-8')))
        except (ValueError, UnicodeDecodeError) as e:
            return self.reply(400, {'ok': False, 'error': str(e)})
        tmp = LAYOUT + '.part'
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(HEADER + 'window.LAYOUT = ' + json.dumps(data, indent=2, ensure_ascii=False) + ';\n')
        os.replace(tmp, LAYOUT)
        sys.stderr.write('saved js/layout.js (%d overrides, %d constants)\n' % (len(data['overrides']), len(data['config'])))
        self.reply(200, {'ok': True, 'path': 'js/layout.js'})

    def log_message(self, fmt, *args):
        if self.command != 'GET' or (args and str(args[1])[:1] in '45'):   # keep the console quiet: POSTs and errors only
            super().log_message(fmt, *args)


def main():
    ap = argparse.ArgumentParser(description='Serve Sonar Defence and accept layout saves from the in-game editor.')
    ap.add_argument('--port', type=int, default=8000)
    args = ap.parse_args()
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), functools.partial(Handler, directory=ROOT))
    print('Sonar Defence on http://localhost:%d/   ·   editor: http://localhost:%d/?edit=1   (Ctrl+C stops)' % (args.port, args.port))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print()


if __name__ == '__main__':
    main()
