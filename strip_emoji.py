#!/usr/bin/env python3
"""
Remove pictographic emoji from index.html.

KEEPS typographic marks (→ ← ↑ ↓ ✓ ✔ ✕ ✖ ▼ ▲) — those are legitimate
type, not emoji, and they carry meaning in sort menus and close buttons.

RULES, in order:
 1. Icon-only wrapper elements (<span class="icon">📊</span>,
    .pill-icon, .upload-icon, .empty-icon) — remove the WHOLE element,
    not just its contents, so no empty span is left behind.
 2. Buttons whose only label is an emoji — replace with a word.
 3. Everywhere else — strip the emoji and any doubled space it leaves.

Verifies afterwards that no button, option or title ends up blank.
"""
import re, sys, shutil

SRC = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'index.emojiless.html'

PICTO = re.compile('[\U0001F300-\U0001FAFF]|[\u2600-\u26FF]|[\u2700-\u27BF]|\uFE0F|\u20E3')
KEEP  = {'→','←','↑','↓','✓','✔','✕','✖','▼','▲','·'}

def strip_emoji(s):
    """Remove pictographs. Collapse only the space the emoji itself left —
    never touch indentation, or the diff becomes unreviewable."""
    def rm(m):
        return '' if m.group(0) not in KEEP else m.group(0)
    # emoji + the single space that followed it
    s = re.sub('(?:' + PICTO.pattern + ')+[ ]?', 
               lambda m: m.group(0) if any(c in KEEP for c in m.group(0)) else '', s)
    return s

h = open(SRC, encoding='utf-8').read()
orig_len = len(h)
report = []

# ---- RULE 2 first (most specific): emoji-only buttons get a real word ----
# matched on their onclick so we hit the right ones
BTN_LABELS = [
    (r'DS\.showSamsaraSettings\(\)',      'Settings'),
    (r'DS\.cycleTheme\(\)',               'Theme'),
    (r'DS\.deleteDriver\(',               'Delete'),
    (r'DS\.quickDeleteProject',           'Delete'),
    (r'navigator\.clipboard\.writeText',  'Copy'),
    (r'DS\.deleteQueueItem\(',            'Delete'),
]
def relabel(m):
    whole, attrs, inner = m.group(0), m.group(1), m.group(2)
    if not PICTO.search(inner):
        return whole
    if re.sub(r'<[^>]+>', '', strip_emoji(inner)).strip():
        return whole                      # has other text; leave to rule 3
    for pat, word in BTN_LABELS:
        if re.search(pat, attrs):
            report.append(f"  relabelled button -> '{word}'")
            return f'<button{attrs}>{word}</button>'
    return whole
h = re.sub(r'<button\b([^>]*)>(.*?)</button>', relabel, h, flags=re.S)

# ---- RULE 1: drop icon-only wrapper elements entirely ----
ICON_CLASSES = ['icon', 'pill-icon', 'upload-icon', 'empty-icon', 'stat-icon', 'nav-icon']
before = len(h)
for cls in ICON_CLASSES:
    # <span class="icon">EMOJI</span>  (also div)
    pat = re.compile(
        r'<(span|div)\b[^>]*class="[^"]*\b' + cls + r'\b[^"]*"[^>]*>([^<]{0,12})</\1>\s*')
    def drop(m):
        if PICTO.search(m.group(2)) and strip_emoji(m.group(2)).strip() == '':
            return ''
        return m.group(0)
    h = pat.sub(drop, h)
report.append(f"  removed icon-only wrappers ({before-len(h)} chars)")

# ---- also drop bare decorative emoji divs (font-size:1.6rem style icons) ----
h = re.sub(
    r'<div\b[^>]*style="[^"]*font-size:1\.6rem[^"]*"[^>]*>([^<]{0,8})</div>\s*',
    lambda m: '' if PICTO.search(m.group(1)) and not strip_emoji(m.group(1)).strip() else m.group(0),
    h)

# ---- RULE 3: strip everywhere else ----
h = strip_emoji(h)

# tidy artefacts left behind
# no global whitespace edits — indentation must survive for a reviewable diff

open(OUT, 'w', encoding='utf-8').write(h)

# ---------------- verification ----------------
print(f"{SRC} -> {OUT}")
print(f"  {orig_len} -> {len(h)} chars")
for r in set(report): print(r)

left = PICTO.findall(h)
left = [c for c in left if c not in KEEP]
print(f"\n  pictographs remaining: {len(left)}")
if left:
    from collections import Counter
    print("   ", Counter(left).most_common(10))

bad = []
for m in re.finditer(r'<button\b[^>]*>(.*?)</button>', h, re.S):
    if not re.sub(r'<[^>]+>', '', m.group(1)).strip():
        bad.append(h[:m.start()].count('\n') + 1)
print(f"  blank buttons: {len(bad)}" + (f" at lines {bad[:10]}" if bad else ""))

for tag in ('option', 'title'):
    n = sum(1 for m in re.finditer(rf'<{tag}\b[^>]*>(.*?)</{tag}>', h, re.S)
            if not m.group(1).strip())
    print(f"  blank <{tag}>: {n}")

print(f"  script tags balanced: {h.count('<script')} / {h.count('</script>')}")
print(f"  style tags balanced:  {h.count('<style')} / {h.count('</style>')}")
print(f"  kept typographic marks: " +
      ' '.join(f"{k}×{h.count(k)}" for k in ['→','↓','✓','✕'] if h.count(k)))
