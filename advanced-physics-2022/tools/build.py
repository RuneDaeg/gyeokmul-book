"""고급 물리학(2022 개정) 슬라이드를 만든다.

쓰는 법 (advanced-physics-2022 폴더에서):
    python3 tools/build.py

src/*.html 의 슬라이드 원고에 공통 머리말·도구 막대·쪽 번호를 붙이고,
{{fig:이름}} 자리에 tools/figures.py 가 계산한 SVG 그림을 넣어 slides/ 에 쓴다.
마지막으로 verification-report.md 4장에서 오류 목록 페이지(slides/errors.html)를 만든다.
"""
import html
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from figures import FIGS  # noqa: E402
import errors  # noqa: E402

SRC = ROOT / "src"
OUT = ROOT / "slides"

FONTS = ("https://fonts.googleapis.com/css2?family=Hahmlet:wght@500;600;700"
         "&family=IBM+Plex+Sans+KR:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap")
MATHJAX = "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js"

PAGE = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{fonts}">
<link rel="stylesheet" href="assets/deck.css">
<script>
window.MathJax = {{
  tex: {{ inlineMath: [["$", "$"], ["\\\\(", "\\\\)"]], displayMath: [["$$", "$$"], ["\\\\[", "\\\\]"]] }},
  svg: {{ fontCache: "global" }},
  options: {{ skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code", "svg"] }}
}};
</script>
<script src="{mathjax}" defer></script>
</head>
<body>
<header class="bar">
  <div class="crumb"><a href="index.html">고급 물리학 · 2022 개정</a></div>
  <h1>{title}</h1>
  <div class="tools">
    <button type="button" class="btn" id="btn-notes" aria-pressed="false" title="단축키 N">교사용 메모</button>
    <button type="button" class="btn" id="btn-ink" aria-pressed="false" title="단축키 D">판서</button>
    <button type="button" class="btn" id="btn-present" aria-pressed="false" title="단축키 P">발표 모드</button>
    <a class="btn" href="pdf/{pdf}" title="풀이를 펼친 PDF">PDF</a>
  </div>
</header>
<main class="deck">
{slides}
</main>
<footer class="site-foot">
  <p>{foot}</p>
</footer>
<div class="present-hint" aria-live="polite"></div>
<script src="assets/deck.js"></script>
<script src="assets/ink.js"></script>
</body>
</html>
"""

META_RE = re.compile(r"^<!--\s*(.*?)-->", re.S)


def parse(path):
    text = path.read_text(encoding="utf-8")
    m = META_RE.match(text)
    meta = {}
    for line in m.group(1).strip().splitlines():
        k, _, v = line.partition(":")
        meta[k.strip()] = v.strip()
    return meta, text[m.end():]


def build_deck(path):
    meta, body = parse(path)

    def fig(m):
        name = m.group(1)
        if name not in FIGS:
            raise SystemExit(f"{path.name}: 그림 '{name}' 이 없습니다")
        return FIGS[name]()
    body = re.sub(r"\{\{fig:([a-z_0-9]+)\}\}", fig, body)

    total = len(re.findall(r'<section class="slide', body))
    counter = {"n": 0}

    def open_tag(m):
        counter["n"] += 1
        return f'<section id="s{counter["n"]}" class="slide{m.group(1)}"'
    body = re.sub(r'<section class="slide([^"]*)"', open_tag, body)
    closes = {"n": 0}

    def close_tag(_):
        closes["n"] += 1
        n = closes["n"]
        return (f'<div class="slide-no"><a href="#s{n}">{html.escape(meta["short"])} · '
                f'{n:02d} / {total:02d}</a></div></section>')
    body = re.sub(r"</section>", close_tag, body)
    if counter["n"] != closes["n"]:
        raise SystemExit(f"{path.name}: section 태그 짝이 맞지 않습니다")

    page = PAGE.format(title=html.escape(meta["title"]), desc=html.escape(meta["desc"]),
                       fonts=FONTS, mathjax=MATHJAX, slides=body.strip(),
                       foot=meta.get("foot", "2022 개정 교육과정 고급 물리학 수업 자료"),
                       pdf=meta["file"].replace(".html", ".pdf"))
    out = OUT / meta["file"]
    out.write_text(page, encoding="utf-8")
    return meta, total


INDEX = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<title>고급 물리학 2022 수업 자료</title>
<meta name="description" content="2022 개정 교육과정 고급 물리학 수업 슬라이드 다섯 묶음: OT·물리 수학, 역학, 전자기학, 광학, 현대 물리">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{fonts}">
<link rel="stylesheet" href="assets/deck.css">
</head>
<body>
<main class="home">
  <header class="home-head">
    <p class="kicker">2022 개정 교육과정 · 과학 계열 진로 선택</p>
    <h1>고급 물리학 수업 자료</h1>
    <p class="lede">교과서(대전광역시교육감 인정, 조영원 외)의 단원 순서를 따라 역학 · 전자기학 · 광학 · 현대 물리를 정리한 슬라이드입니다. 슬라이드마다 교과서 쪽을 적었고, 핵심 식은 '유도'·'풀이' 슬라이드에서 한 단계씩 끌어냅니다. 2015 개정 자료를 검증하며 찾은 오류는 바로잡은 서술로 다시 썼습니다.</p>
  </header>
  <ol class="decks">
{items}
  </ol>
  <section class="verify">
    <h2>검증 자료</h2>
    <ul class="decks">
      <li class="deck-card">
        <a href="errors.html">
          <span class="no">!</span>
          <span class="t">2015 자료 물리 오류 목록</span>
          <span class="d">자료 6종에서 찾은 오류를 자료·등급별로 걸러 보고, 2022 슬라이드에서 바로잡은 곳으로 바로 갑니다.</span>
          <span class="n">{errsum}</span>
        </a>
      </li>
    </ul>
    <h2>PDF 내려받기</h2>
    <div class="tbl-wrap"><table class="tbl pdfs">
      <thead><tr><th>묶음</th><th>풀이 포함 (수업용)</th><th>학생용 (풀이 숨김)</th></tr></thead>
      <tbody>
{pdfrows}
        <tr><td>오류 목록</td><td colspan="2"><a href="pdf/errors.pdf">errors.pdf</a> (A4 세로)</td></tr>
      </tbody>
    </table></div>
    <p class="small">슬라이드 한 장이 16:9 한 쪽입니다. 교사용 메모는 PDF에 넣지 않았습니다. 판서한 화면을 그대로 남기려면 슬라이드에서 <kbd>Ctrl</kbd>+<kbd>P</kbd> → 'PDF로 저장'을 쓰세요.</p>
  </section>
  <section class="howto">
    <h2>쓰는 법</h2>
    <ul>
      <li><strong>발표 모드</strong>: 오른쪽 위 버튼이나 <kbd>P</kbd>. <kbd>←</kbd> <kbd>→</kbd> 로 넘기고 <kbd>Esc</kbd> 로 끝냅니다. 터치 화면에서는 좌우로 밉니다.</li>
      <li><strong>교사용 메모</strong>: 버튼이나 <kbd>N</kbd>. 슬라이드마다 2015 자료의 어떤 오류를 고쳤는지, 수업 운영 팁이 보입니다.</li>
      <li><strong>판서</strong>: 버튼이나 <kbd>D</kbd>. 펜 색 <kbd>1</kbd>~<kbd>4</kbd>, 형광펜 <kbd>H</kbd>, 레이저 <kbd>L</kbd>, 지우개 <kbd>E</kbd>, 굵기 <kbd>W</kbd>, 되돌리기 <kbd>Z</kbd>, 이 쪽 지우기 <kbd>C</kbd>, 빈 화면 <kbd>B</kbd>, 끝내기 <kbd>Esc</kbd>. 마우스·터치·펜 모두 되고, 펜은 누르는 세기에 따라 굵기가 바뀝니다. 판서는 이 브라우저에 쪽마다 저장되어 다시 열어도 남아 있습니다.</li>
      <li><strong>유도 · 풀이 슬라이드</strong>: 머리 표시가 '유도'나 '풀이'로 시작하는 슬라이드는 앞 슬라이드의 식을 번호 붙은 단계로 끌어냅니다. 판서 대신 한 단계씩 짚어 가며 쓰세요.</li>
      <li><strong>풀이 보기</strong>: 확인 문제의 풀이는 접혀 있어 학생 화면에서 바로 보이지 않습니다.</li>
      <li>쪽 번호를 누르면 그 슬라이드로 가는 주소(#s12 형식)가 됩니다.</li>
    </ul>
    <p class="small">검증 결과 전체는 같은 폴더의 verification-report.md 에 있습니다.</p>
  </section>
</main>
</body>
</html>
"""

ITEM = """    <li class="deck-card">
      <a href="{file}">
        <span class="no">{no}</span>
        <span class="t">{title}</span>
        <span class="d">{desc}</span>
        <span class="n">슬라이드 {total}장</span>
      </a>
    </li>"""


def build_index(decks, errsum=""):
    items, pdfrows = [], []
    for i, (meta, total) in enumerate(decks):
        no = "OT" if i == 0 else ["I", "II", "III", "IV"][i - 1]
        title = meta["title"].replace("고급 물리학 ", "")
        title = re.sub(r"^(I|II|III|IV|Ⅰ|Ⅱ|Ⅲ|Ⅳ)\s+", "", title)
        items.append(ITEM.format(file=meta["file"], no=no, title=html.escape(title),
                                 desc=html.escape(meta["desc"]), total=total))
        stem = meta["file"].replace(".html", "")
        pdfrows.append(f'        <tr><td>{no} {html.escape(title)}</td><td><a href="pdf/{stem}.pdf">{stem}.pdf</a></td>'
                       f'<td><a href="pdf/{stem}-student.pdf">{stem}-student.pdf</a></td></tr>')
    (OUT / "index.html").write_text(INDEX.format(fonts=FONTS, items="\n".join(items), errsum=errsum, pdfrows="\n".join(pdfrows)), encoding="utf-8")


def main():
    OUT.mkdir(exist_ok=True)
    decks = []
    for path in sorted(SRC.glob("*.html")):
        meta, total = build_deck(path)
        decks.append((meta, total))
        print(f"{meta['file']}: 슬라이드 {total}장")
    total, linked = errors.build(ROOT / "verification-report.md", OUT, FONTS, MATHJAX)
    print(f"errors.html: 오류 {total}건, 바로잡은 슬라이드 링크가 있는 항목 {linked}건")
    build_index(decks, f"오류 {total}건 · 자료별·등급별 찾기")
    print(f"index.html: 묶음 {len(decks)}개, 슬라이드 {sum(t for _, t in decks)}장")
    return decks


if __name__ == "__main__":
    main()
