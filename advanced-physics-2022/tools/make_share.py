"""연수·학생에게 공유할 판을 만든다: 2015 자료 검증 자료와 교사용 메모를 뺀다.

쓰는 법 (advanced-physics-2022 폴더에서, 먼저 python3 tools/build.py 와 node tools/make_pdf.js):
    python3 tools/make_share.py                    # 공유판 (연수용)       → dist/share/
    python3 tools/make_share.py --student          # 학생용 (풀이도 뺌)    → dist/student/
    python3 tools/make_share.py --web              # 아티팩트로 올릴 판도  → dist/share-web/
    python3 tools/make_share.py --student --web    #                       → dist/student-web/

- 공유판에서 빼는 것: 오류 목록(errors.html, errors.pdf), 검증 보고서 안내, 목록 페이지의 '검증 자료',
  슬라이드의 교사용 메모(2015 자료에서 고친 곳을 적은 메모)와 그 버튼
- 학생용은 여기에 더해 확인 문제의 풀이(접힌 '풀이 보기')와 풀이 포함 PDF 를 뺀다.
  수업 내용인 '유도'·'풀이' 슬라이드(단계별 예제 풀이)는 남긴다.
- 남기는 것: 슬라이드 내용, 발표 모드, 판서, 목차, 시뮬레이터, PDF
- --web: PDF 링크를 pdf.html#이름 (PDF.js 보기 페이지)으로 바꾸고, 아티팩트 첫 화면용 main.html
  (문서 뼈대 없는 목록 페이지)을 둔다. 아티팩트 보기 화면은 브라우저 PDF 뷰어와 내려받기를 막아서
  PDF 링크를 직접 열 수 없기 때문이다.
그 뒤 python3 tools/make_standalone.py --share (또는 --student) 경로/tex-svg.js 로 단독 HTML 도 만들 수 있다.
"""
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SLIDES = ROOT / "slides"


def cut(html, pattern, what, flags=re.S, count=None):
    new, n = re.subn(pattern, "", html, flags=flags)
    if not n or (count is not None and n != count):
        raise SystemExit(f"공유판: '{what}' 을 찾지 못했습니다 ({n}곳). 목록 페이지나 슬라이드 형식이 바뀌었는지 확인하세요.")
    return new


def deck(html, student):
    # 2015 자료 수정 기록 메모는 빼고, 교사용 판에는 수업 팁 메모(<aside class="note tip">)만 남긴다
    html = re.sub(r'\s*<aside class="note">.*?</aside>', "", html, flags=re.S)
    assert '<aside class="note">' not in html
    if student:
        html = re.sub(r'\s*<aside class="note tip">.*?</aside>', "", html, flags=re.S)
        html = cut(html, r'\s*<button type="button" class="btn" id="btn-notes"[^>]*>교사용 메모</button>', "교사용 메모 버튼")
        assert "<aside" not in html
    else:
        html, n = re.subn(r'(<button type="button" class="btn" id="btn-notes"[^>]*>)교사용 메모(</button>)', r"\1수업 팁\2", html)
        assert n == 1, "교사용 메모 버튼"
    if student:
        html = cut(html, r'\s*<details class="answer">.*?</details>', "확인 문제 풀이")
        html, n = re.subn(r'href="pdf/([0-9a-z-]+?)\.pdf"', r'href="pdf/\1-student.pdf"', html)
        assert n == 1, "덱의 PDF 버튼"
        assert 'class="answer"' not in html and "풀이 보기" not in html
    return html


def index(html, student):
    html = cut(html, r" 2015 개정 자료를 검증하며 찾은 오류는 바로잡은 서술로 다시 썼습니다\.", "목록 머리말의 검증 문장")
    html = cut(html, r'\s*<h2>검증 자료</h2>\s*<ul class="decks">.*?</ul>', "검증 자료 카드")
    html = cut(html, r'\s*<tr><td>오류 목록</td>.*?</tr>', "오류 목록 PDF 줄")
    if student:
        html = cut(html, r'\s*<li><strong>교사용 메모</strong>.*?</li>', "교사용 메모 안내")
    else:
        tips = sum(f.read_text(encoding="utf-8").count('<aside class="note tip">') for f in SLIDES.glob("0*.html"))
        html, n = re.subn(r'<li><strong>교사용 메모</strong>.*?</li>',
                          '<li><strong>수업 팁</strong>: 버튼이나 <kbd>N</kbd>. 헷갈리기 쉬운 규약과 개념, 진도 조정, 활동 제안 같은 수업 운영 팁이 해당 슬라이드 아래에 보입니다 (TIPS곳).</li>'.replace("TIPS", str(tips)), html, flags=re.S)
        assert n == 1
    html = cut(html, r'\s*<p class="small">검증 결과 전체는.*?</p>', "검증 보고서 안내")
    html = html.replace(" 교사용 메모는 PDF에 넣지 않았습니다.", "")
    for word in ("errors.html", "errors.pdf", "verification", "교사용 메모", "2015 개정 자료"):
        assert word not in html, word
    if not student:
        html = html.replace("<title>고급 물리학 2022 수업 자료</title>", "<title>고급 물리학 교사용 자료</title>")
        html = html.replace("<h1>고급 물리학 수업 자료</h1>", "<h1>고급 물리학 교사용 자료</h1>")
        assert "교사용 자료" in html
    if student:
        html = html.replace("<title>고급 물리학 2022 수업 자료</title>", "<title>고급 물리학 학생용 자료</title>")
        html = html.replace("<h1>고급 물리학 수업 자료</h1>", "<h1>고급 물리학 학생용 자료</h1>")
        html = cut(html, r'\s*<li><strong>풀이 보기</strong>.*?</li>', "풀이 보기 안내")
        html = html.replace("<thead><tr><th>묶음</th><th>풀이 포함 (수업용)</th><th>학생용 (풀이 숨김)</th></tr></thead>",
                            "<thead><tr><th>묶음</th><th>PDF</th></tr></thead>")
        # 풀이 포함 PDF 칸을 뺀다
        html, n = re.subn(r'<td><a href="pdf/[0-9a-z-]+?\.pdf">[^<]*</a></td>(<td><a href="pdf/[0-9a-z-]+-student\.pdf">)', r"\1", html)
        assert n == 5, n
        assert "풀이 포함" not in html and "학생용 자료" in html
    return html


def web(src, out, student):
    """아티팩트용: PDF 링크를 보기 페이지로 바꾸고 main.html 을 만든다."""
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(src, out)
    viewer = (ROOT / "tools" / "web" / "pdf.html").read_text(encoding="utf-8")
    if student:
        a = "var STUDENT_ONLY = false;"
        assert viewer.count(a) == 1
        viewer = viewer.replace(a, "var STUDENT_ONLY = true;")
    (out / "pdf.html").write_text(viewer, encoding="utf-8")
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
    print(f"{out.relative_to(ROOT)}: 파일 {sum(1 for p in out.rglob('*') if p.is_file())}개 (pdf.html, main.html 포함)")


def main():
    student = "--student" in sys.argv[1:]
    out = ROOT / "dist" / ("student" if student else "share")
    if out.exists():
        shutil.rmtree(out)
    (out / "pdf").mkdir(parents=True)
    for f in sorted(SLIDES.glob("0*.html")):
        (out / f.name).write_text(deck(f.read_text(encoding="utf-8"), student), encoding="utf-8")
    (out / "index.html").write_text(index((SLIDES / "index.html").read_text(encoding="utf-8"), student), encoding="utf-8")
    shutil.copytree(SLIDES / "assets", out / "assets")
    for f in sorted((SLIDES / "pdf").glob("0*.pdf")):
        if student and not f.stem.endswith("-student"):
            continue
        shutil.copy(f, out / "pdf" / f.name)
    print(f"{out.relative_to(ROOT)}: 파일 {sum(1 for p in out.rglob('*') if p.is_file())}개")
    if "--web" in sys.argv[1:]:
        web(out, ROOT / "dist" / (out.name + "-web"), student)


if __name__ == "__main__":
    main()
