"""연수·학생에게 공유할 판을 만든다: 2015 자료 검증 자료와 교사용 메모를 뺀다.

쓰는 법 (advanced-physics-2022 폴더에서, 먼저 python3 tools/build.py 와 node tools/make_pdf.js):
    python3 tools/make_share.py

    python3 tools/make_share.py --web   # claude.ai 아티팩트로 올릴 판도 함께

결과: dist/share/ (index.html, 덱 5개, assets/, pdf/)
      --web 이면 dist/share-web/ 도: PDF 링크를 pdf.html#이름 (PDF.js 보기 페이지)으로 바꾸고,
      아티팩트 첫 화면용 main.html(문서 뼈대 없는 목록 페이지)을 둔다. 아티팩트 보기 화면은
      브라우저 PDF 뷰어와 내려받기를 막아서 PDF 링크를 직접 열 수 없기 때문이다.
- 빼는 것: 오류 목록(errors.html, errors.pdf), 검증 보고서 안내, 목록 페이지의 '검증 자료',
  슬라이드의 교사용 메모(2015 자료에서 고친 곳을 적은 메모)와 그 버튼
- 남기는 것: 슬라이드 내용, 확인 문제 풀이(접힌 채), 발표 모드, 판서, 목차, 시뮬레이터, 덱 PDF
그 뒤 python3 tools/make_standalone.py --share 경로/tex-svg.js 로 단독 HTML 도 만들 수 있다.
"""
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SLIDES = ROOT / "slides"
OUT = ROOT / "dist" / "share"


def cut(html, pattern, what, flags=re.S):
    new, n = re.subn(pattern, "", html, flags=flags)
    if not n:
        raise SystemExit(f"공유판: '{what}' 을 찾지 못했습니다. 목록 페이지나 슬라이드 형식이 바뀌었는지 확인하세요.")
    return new


def deck(html):
    html = re.sub(r'\s*<aside class="note">.*?</aside>', "", html, flags=re.S)
    html = cut(html, r'\s*<button type="button" class="btn" id="btn-notes"[^>]*>교사용 메모</button>', "교사용 메모 버튼")
    assert '<aside class="note">' not in html
    return html


def index(html):
    html = cut(html, r" 2015 개정 자료를 검증하며 찾은 오류는 바로잡은 서술로 다시 썼습니다\.", "목록 머리말의 검증 문장")
    html = cut(html, r'\s*<h2>검증 자료</h2>\s*<ul class="decks">.*?</ul>', "검증 자료 카드")
    html = cut(html, r'\s*<tr><td>오류 목록</td>.*?</tr>', "오류 목록 PDF 줄")
    html = cut(html, r'\s*<li><strong>교사용 메모</strong>.*?</li>', "교사용 메모 안내")
    html = cut(html, r'\s*<p class="small">검증 결과 전체는.*?</p>', "검증 보고서 안내")
    html = html.replace(" 교사용 메모는 PDF에 넣지 않았습니다.", "")
    for word in ("errors.html", "errors.pdf", "verification", "교사용 메모", "2015 개정 자료"):
        assert word not in html, word
    return html


def web():
    """아티팩트용: PDF 링크를 보기 페이지로 바꾸고 main.html 을 만든다."""
    out = ROOT / "dist" / "share-web"
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(OUT, out)
    shutil.copy(ROOT / "tools" / "web" / "pdf.html", out / "pdf.html")
    pdf_link = re.compile(r'href="pdf/([0-9a-z-]+)\.pdf"')
    for f in [out / "index.html"] + sorted(out.glob("0*.html")):
        html = f.read_text(encoding="utf-8")
        html, n = pdf_link.subn(r'href="pdf.html#\1"', html)
        assert n, f.name
        f.write_text(html, encoding="utf-8")
    idx = (out / "index.html").read_text(encoding="utf-8")
    # 아티팩트 보기 화면에서는 내려받기와 인쇄 창이 막혀 있으므로 안내를 그에 맞춘다
    idx = idx.replace("<h2>PDF 내려받기</h2>", "<h2>PDF 보기</h2>")
    idx, n = re.subn(r'<p class="small">슬라이드 한 장이 16:9 한 쪽입니다\..*?</p>',
                     '<p class="small">슬라이드 한 장이 16:9 한 쪽입니다. 이 페이지에서는 PDF 를 화면으로 넘겨 볼 수 있고, 파일로 내려받을 수는 없습니다.</p>', idx, flags=re.S)
    assert n == 1
    (out / "index.html").write_text(idx, encoding="utf-8")
    head = re.search(r"<head>(.*?)</head>", idx, re.S).group(1)
    head = re.sub(r'<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*', "", head)
    body = re.search(r"<body>(.*?)</body>", idx, re.S).group(1)
    (out / "main.html").write_text(head.strip() + "\n" + body.strip() + "\n", encoding="utf-8")
    print(f"dist/share-web: 파일 {sum(1 for p in out.rglob('*') if p.is_file())}개 (pdf.html, main.html 포함)")


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "pdf").mkdir(parents=True)
    for f in sorted(SLIDES.glob("0*.html")):
        (OUT / f.name).write_text(deck(f.read_text(encoding="utf-8")), encoding="utf-8")
    (OUT / "index.html").write_text(index((SLIDES / "index.html").read_text(encoding="utf-8")), encoding="utf-8")
    shutil.copytree(SLIDES / "assets", OUT / "assets")
    for f in sorted((SLIDES / "pdf").glob("0*.pdf")):
        shutil.copy(f, OUT / "pdf" / f.name)
    files = sorted(p.relative_to(OUT).as_posix() for p in OUT.rglob("*") if p.is_file())
    print(f"dist/share: 파일 {len(files)}개")
    if "--web" in sys.argv[1:]:
        web()


if __name__ == "__main__":
    main()
