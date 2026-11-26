"""slides/ 의 페이지를 파일 하나로 열리는 HTML 로 묶는다.

쓰는 법 (advanced-physics-2022 폴더에서, 먼저 python3 tools/build.py):
    python3 tools/make_standalone.py [MathJax 의 tex-svg.js 경로]
    python3 tools/make_standalone.py --share [경로]     # 교사용 공유판 (먼저 python3 tools/make_share.py)
    python3 tools/make_standalone.py --student [경로]   # 학생용 (먼저 python3 tools/make_share.py --student)

결과: dist/고급물리학-2022-html/ 에 덱 5개, 목록(index.html), 오류 목록(errors.html), pdf/ 를 두고
      dist/고급물리학-2022-html.zip 으로 묶는다.

- deck.css, deck.js, ink.js, sims.js 를 페이지 안에 넣으므로 assets 폴더가 필요 없다.
- tex-svg.js 경로를 주면 MathJax(3.2.2)도 페이지 안에 넣어, 인터넷 없이도 수식이 그려진다.
  (npm pack mathjax@3.2.2 로 받은 꾸러미의 es5/tex-svg.js). 주지 않으면 CDN 에서 불러온다.
- 글꼴은 Google Fonts 에서 불러오고, 인터넷이 없으면 컴퓨터에 있는 한글 글꼴로 보인다.
"""
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SLIDES = ROOT / "slides"
NAME = "고급물리학-2022-html"
OUT = ROOT / "dist" / NAME
MATHJAX_TAG = re.compile(r'<script src="https://cdn\.jsdelivr\.net/npm/mathjax@[^"]+/es5/tex-svg\.js" defer></script>\n?')


def safe_js(src):
    # 페이지 안에 넣은 스크립트가 중간에서 끝나지 않게
    return src.replace("</script", "<\\/script").replace("<!--", "<\\!--")


def inline(html, mathjax):
    def css(m):
        return "<style>\n" + (SLIDES / m.group(1)).read_text(encoding="utf-8") + "\n</style>"
    html = re.sub(r'<link rel="stylesheet" href="(assets/[^"]+\.css)">', css, html)

    def js(m):
        return "<script>\n" + safe_js((SLIDES / m.group(1)).read_text(encoding="utf-8")) + "\n</script>"
    html = re.sub(r'<script src="(assets/[^"]+\.js)"></script>', js, html)
    if mathjax is not None and MATHJAX_TAG.search(html):
        # defer 스크립트였으므로 본문의 다른 스크립트 뒤, </body> 바로 앞에 둔다
        html = MATHJAX_TAG.sub("", html)
        html = html.replace("</body>", "<script>\n" + mathjax + "\n</script>\n</body>", 1)
    assert 'src="assets/' not in html and 'href="assets/' not in html
    return html


def main():
    global SLIDES, NAME, OUT
    args = sys.argv[1:]
    for flag, src, name in (("--share", "share", "고급물리학-2022-교사용"), ("--student", "student", "고급물리학-2022-학생용")):
        if flag in args:           # tools/make_share.py 가 만든 교사용(공유판)·학생용 판
            args.remove(flag)
            SLIDES, NAME = ROOT / "dist" / src, name
            OUT = ROOT / "dist" / NAME
    mj_path = pathlib.Path(args[0]) if args else None
    mathjax = safe_js(mj_path.read_text(encoding="utf-8")) if mj_path else None
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    pages = sorted(SLIDES.glob("0*.html")) + [f for f in (SLIDES / "index.html", SLIDES / "errors.html") if f.exists()]
    for f in pages:
        out = OUT / f.name
        out.write_text(inline(f.read_text(encoding="utf-8"), mathjax), encoding="utf-8")
        print(f"{f.name}: {out.stat().st_size / 1e6:.1f} MB")
    if (SLIDES / "pdf").is_dir():
        shutil.copytree(SLIDES / "pdf", OUT / "pdf")
    zip_path = shutil.make_archive(str(OUT), "zip", root_dir=OUT.parent, base_dir=NAME)
    print(f"{pathlib.Path(zip_path).name}: {pathlib.Path(zip_path).stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
