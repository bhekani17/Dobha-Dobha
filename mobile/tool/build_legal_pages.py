"""Builds the public web pages Google Play links to from the app's own legal text.

    python tool/build_legal_pages.py      (from mobile/)

Writes web/privacy.html (from lib/legal/privacy.dart) and web/terms.html (from lib/legal/terms.dart).
Run it after changing either Dart file, then deploy. web/delete-account.html is hand-written.
"""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PAGE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} - Dobha Dobha</title>
  <link rel="icon" href="/favicon.png">
  <link rel="stylesheet" href="/legal.css">
</head>
<body>
  <main>
    <a class="brand" href="/"><img src="/icons/Icon-192.png" alt="">Dobha Dobha</a>
    <h1>{title}</h1>
    <p class="muted">Last updated {updated}</p>
{body}
    <footer><a href="/privacy.html">Privacy Policy</a> · <a href="/terms.html">Terms and Conditions</a> · <a href="/delete-account.html">Delete your account</a></footer>
  </main>
</body>
</html>
"""

STRING = r"'((?:[^'\\]|\\.)*)'"


def unescape(s):
    return s.replace("\\'", "'").replace('\\$', '$')


def sections(source):
    out = []
    for m in re.finditer(r"TermsSection\(" + STRING + r",\s*\[(.*?)\]\),", source, re.S):
        out.append((unescape(m.group(1)), [unescape(p) for p in re.findall(STRING, m.group(2))]))
    return out


def build(dart, updated_const, title, out):
    source = (ROOT / 'lib/legal' / dart).read_text(encoding='utf-8')
    updated = re.search(updated_const + r" = '([^']+)'", source).group(1)
    secs = sections(source)
    if not secs:
        raise SystemExit(f'No sections found in {dart}')
    body = '\n'.join(
        f'    <h2>{html.escape(t)}</h2>\n' + '\n'.join(f'    <p>{html.escape(p)}</p>' for p in ps) for t, ps in secs
    )
    (ROOT / 'web' / out).write_text(PAGE.format(title=title, updated=updated, body=body), encoding='utf-8', newline='\n')
    print(f'web/{out}: {len(secs)} sections')


build('privacy.dart', 'privacyUpdated', 'Privacy Policy', 'privacy.html')
build('terms.dart', 'termsUpdated', 'Terms and Conditions', 'terms.html')
