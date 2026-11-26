"""verification-report.md 4장(물리 오류 목록)을 읽어 slides/errors.html 을 만든다.

build.py 가 슬라이드를 만든 뒤 부른다. 슬라이드의 교사용 메모에 적힌
'기존 역학 p50' 같은 쪽 번호를 찾아, 오류마다 바로잡은 슬라이드로 가는 링크를 단다.
"""
import html
import re

MATS = [  # (보고서 소제목 앞부분, 키, 짧은 이름, 2015 자료 쪽수)
    ("OT 슬라이드", "ot", "OT 슬라이드", 104),
    ("OT 유인물", "oth", "OT 유인물", 29),
    ("역학", "mech", "역학", 308),
    ("전자기학", "em", "전자기학", 357),
    ("양자역학", "qm", "양자역학", 147),
    ("상대성 이론", "rel", "상대성 이론", 101),
]
NAME = {k: n for _, k, n, _ in MATS}
WORD = {"OT": "ot", "유인물": "oth", "역학": "mech", "전자기": "em", "양자": "qm", "상대론": "rel"}
DECK_DEFAULT = {"00": "ot", "01": "mech", "02": "em"}
DECK_LABEL = {"00": "OT", "01": "역학", "02": "전자기학", "03": "광학", "04": "현대 물리"}
GRADES = [("★★", "g2", "중대", "식이나 결론이 물리적으로 틀렸습니다. 학생이 그대로 외우면 틀립니다."),
          ("★", "g1", "보통", "성립 조건이 빠졌거나 오개념을 부를 수 있는 서술입니다."),
          ("·", "g0", "경미", "오타, 기호 불일치, 연도·인명 오기입니다.")]
GCLS = {g: c for g, c, _, _ in GRADES}

MATH = re.compile(r"(\$\$.+?\$\$|\$[^$\n]+?\$)")


def inline(md):
    """마크다운 한 줄을 HTML로. 수식($...$)은 자리표로 보호했다가 그대로 되돌려 MathJax 에 맡긴다."""
    store = []

    def keep(m):
        store.append(m.group(0))
        return f"\x00{len(store) - 1}\x00"
    s = html.escape(MATH.sub(keep, md), quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", s)
    s = re.sub(r"`(.+?)`", r"<code>\1</code>", s)
    return re.sub("\x00(\\d+)\x00", lambda m: html.escape(store[int(m.group(1))], quote=False), s)


def plain(md):
    return re.sub(r"[*`$\\]", "", md)


PAGE_RE = re.compile(r"p(\d+)((?:\s*[~·,]\s*p?\d+)*)")


def pages_in(text):
    """'p25·28~29', 'p40·p52', 'p63, p66' 같은 표기를 쪽 번호 집합으로."""
    found = set()
    for m in PAGE_RE.finditer(text):
        nums = [int(m.group(1))]
        ops = re.findall(r"([~·,])\s*p?(\d+)", m.group(2))
        for op, n in ops:
            n = int(n)
            if op == "~":
                nums.extend(range(nums[-1] + 1, n + 1))
            else:
                nums.append(n)
        found.update(nums)
    return found


def refs_in(text, default=None):
    """메모 문장에서 (자료, 쪽) 쌍을 읽는다. 자료 이름이 없으면 덱의 기본 자료로 본다."""
    out = set()
    cur = default
    tok = re.compile(r"(OT|유인물|역학|전자기|양자|상대론)|p\d+(?:\s*[~·,]\s*p?\d+)*")
    for m in tok.finditer(text):
        if m.group(1):
            cur = WORD[m.group(1)]
        elif cur:
            out.update((cur, p) for p in pages_in(m.group(0)))
    return out


def parse_report(md):
    sec = md[md.index("### 4-1."):md.index("## 5. 집계")]
    top = []
    for line in sec[:sec.index("### 4-2.")].splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split(" | ")]
        if len(cells) == 4 and cells[0].isdigit():
            top.append({"no": int(cells[0]), "where": cells[1], "now": cells[2], "fix": cells[3]})
    items, mat, topic = [], None, ""
    for line in sec[sec.index("### 4-2."):].splitlines():
        m = re.match(r"### 4-\d+\. (.*)", line)
        if m:
            mat = next(k for head, k, _, _ in MATS if m.group(1).startswith(head))
            topic = ""
            continue
        m = re.fullmatch(r"\*\*(.+)\*\*", line.strip())
        if m:
            topic = m.group(1)
            continue
        m = re.match(r"- \*\*(p[^*]*?) (★★|★|·|\(확인\))\*\* ?(.*)", line)
        if m:
            items.append({"mat": mat, "topic": topic, "pages": m.group(1), "grade": m.group(2),
                          "text": m.group(3), "subs": []})
            continue
        m = re.match(r"\s{2,}- (.*)", line)
        if m and items:
            items[-1]["subs"].append(m.group(1))
    return top, items


def slide_notes(out_dir):
    """만들어진 슬라이드에서 (자료, 쪽) → [(파일, 슬라이드 번호, 제목)]."""
    where = {}
    for f in sorted(out_dir.glob("0*.html")):
        t = f.read_text(encoding="utf-8")
        short = DECK_LABEL.get(f.name[:2], f.stem)
        for sid, body in re.findall(r'<section id="s(\d+)"(.*?)</section>', t, re.S):
            title = re.sub(r"<.*?>", "", (re.search(r"<h2>(.*?)</h2>", body, re.S) or [None, ""])[1])
            for note in re.findall(r'<aside class="note">(.*?)</aside>', body, re.S):
                for key in refs_in(note, DECK_DEFAULT.get(f.name[:2])):
                    where.setdefault(key, []).append((f.name, int(sid), short, title))
    return where


def fixed_links(mat, pages_text, where):
    seen, links = set(), []
    for p in sorted(pages_in(pages_text)):
        for fname, sid, short, title in where.get((mat, p), []):
            if (fname, sid) in seen:
                continue
            seen.add((fname, sid))
            links.append(f'<a href="{fname}#s{sid}" title="{html.escape(title)}">{html.escape(short)} {sid}</a>')
    return links


PAGE = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<title>2015 자료 물리 오류 목록</title>
<meta name="description" content="2015 개정 고급물리학 수업자료 6종의 물리 오류 {total}건을 자료·등급별로 찾아보고, 2022 슬라이드에서 바로잡은 곳으로 이동하는 목록">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{fonts}">
<link rel="stylesheet" href="assets/deck.css">
<script>
window.MathJax = {{
  tex: {{ inlineMath: [["$", "$"]], displayMath: [["$$", "$$"]] }},
  svg: {{ fontCache: "global" }}
}};
</script>
<script src="{mathjax}" defer></script>
</head>
<body>
<header class="bar">
  <div class="crumb"><a href="index.html">고급 물리학 · 2022 개정</a></div>
  <h1>물리 오류 목록</h1>
</header>
<main class="errs">
  <section class="errs-head">
    <p class="kicker">2015 개정 고급물리학 수업자료 검증 · 6종 {pages}쪽</p>
    <h2>2015 자료에서 찾은 물리 오류 {total}건</h2>
    <p class="lede">OT 슬라이드·유인물, 역학, 전자기학, 양자역학, 상대성 이론 자료의 모든 쪽을 이미지로 확인했고, 계산이 의심스러운 곳은 수치로 검산했습니다. 쪽 번호는 Notion에 올린 PDF의 페이지 번호입니다. 오른쪽 <strong>바로잡은 곳</strong> 링크를 누르면 같은 내용을 고쳐 쓴 2022 슬라이드로 갑니다.</p>
    <ul class="tally">
{tally}
    </ul>
    <div class="tbl-wrap"><table class="tbl matrix">
      <thead><tr><th>자료 (쪽수)</th>{mhead}<th>합계</th></tr></thead>
      <tbody>
{mrows}
      </tbody>
    </table></div>
    <p class="small">보고서 5장 집계 표는 OT 슬라이드 p63·p66 처럼 한 항목에 묶인 오류를 따로 세어 ★★ 29건(겹침을 빼면 27건)으로 적었습니다. 이 목록은 항목 단위로 셉니다.</p>
  </section>

  <section class="errs-top" id="top">
    <h2>가장 먼저 고칠 것: 중대 오류 ★★</h2>
    <ol class="fixes">
{fixes}
    </ol>
  </section>

  <section class="errs-all" id="all">
    <h2>자료별 전체 목록</h2>
    <div class="filters" role="search">
      <div class="chips" data-key="mat" role="group" aria-label="자료">
        <button type="button" class="chip" data-val="" aria-pressed="true">전체</button>
{matchips}
      </div>
      <div class="chips" data-key="grade" role="group" aria-label="등급">
        <button type="button" class="chip" data-val="" aria-pressed="true">모든 등급</button>
{gradechips}
      </div>
      <label class="search"><span>찾기</span><input type="search" id="q" placeholder="쪽, 용어, 식 (예: p268, 수직축, 부호)" autocomplete="off"></label>
      <p class="count" aria-live="polite"><span id="shown">{total}</span>건 / 전체 {total}건</p>
    </div>
{mats}
    <p class="empty" hidden>조건에 맞는 항목이 없습니다.</p>
  </section>
  <p class="small">원문은 같은 폴더 위의 verification-report.md 4장에 있습니다. 보고서를 고친 뒤 <code>python3 tools/build.py</code> 를 실행하면 이 페이지도 다시 만들어집니다.</p>
</main>
<script>
(function () {{
  var state = {{ mat: "", grade: "" }};
  var items = Array.prototype.slice.call(document.querySelectorAll(".item"));
  var q = document.getElementById("q");
  function apply() {{
    var needle = (q.value || "").trim().toLowerCase();
    var shown = 0;
    items.forEach(function (li) {{
      var ok = (!state.mat || li.dataset.mat === state.mat) &&
               (!state.grade || li.dataset.grade === state.grade) &&
               (!needle || li.dataset.q.indexOf(needle) !== -1);
      li.hidden = !ok;
      if (ok) shown++;
    }});
    document.querySelectorAll(".topic, .mat").forEach(function (box) {{
      box.hidden = !box.querySelector(".item:not([hidden])");
    }});
    document.getElementById("shown").textContent = shown;
    document.querySelector(".empty").hidden = shown !== 0;
  }}
  document.querySelectorAll(".chips").forEach(function (group) {{
    group.addEventListener("click", function (e) {{
      var b = e.target.closest(".chip");
      if (!b) return;
      group.querySelectorAll(".chip").forEach(function (c) {{ c.setAttribute("aria-pressed", c === b ? "true" : "false"); }});
      state[group.dataset.key] = b.dataset.val;
      apply();
    }});
  }});
  q.addEventListener("input", apply);
}})();
</script>
</body>
</html>
"""


def build(report_path, out_dir, fonts, mathjax):
    top, items = parse_report(report_path.read_text(encoding="utf-8"))
    where = slide_notes(out_dir)
    errs = [it for it in items if it["grade"] in GCLS]
    total = len(errs)

    count = {(k, g): 0 for _, k, _, _ in MATS for g, _, _, _ in GRADES}
    for it in errs:
        count[(it["mat"], it["grade"])] += 1
    tally = "\n".join(
        f'      <li class="{c}"><span class="gr">{g}</span><span class="n">{sum(count[(k, g)] for _, k, _, _ in MATS)}</span>'
        f'<span class="l"><strong>{lab}</strong> {d}</span></li>' for g, c, lab, d in GRADES)
    mhead = "".join(f'<th class="nw">{g} {lab}</th>' for g, _, lab, _ in GRADES)
    mrows = "\n".join(
        f'        <tr><td class="nw">{n} ({pg}쪽)</td>' + "".join(f'<td class="mono">{count[(k, g)]}</td>' for g, _, _, _ in GRADES)
        + f'<td class="mono">{sum(count[(k, g)] for g, _, _, _ in GRADES)}</td></tr>' for _, k, n, pg in MATS)

    fixes = []
    for row in top:
        mats = [WORD[w] for w in re.findall(r"OT|유인물|역학|전자기|양자|상대론", row["where"])]
        links = fixed_links(mats[0], row["where"], where) if mats else []
        fl = f'<span class="fixed">바로잡은 곳 {" ".join(links)}</span>' if links else ""
        fixes.append(f"""      <li class="fix" id="top-{row['no']}">
        <div class="fix-h"><span class="no">{row['no']}</span><span class="where">{inline(row['where'])}</span>{fl}</div>
        <div class="fix-b"><div class="now"><span class="tag">2015 자료</span><p>{inline(row['now'])}</p></div>
        <div class="ok"><span class="tag">바로잡은 서술</span><p>{inline(row['fix'])}</p></div></div>
      </li>""")

    mats_html = []
    for head, k, n, pg in MATS:
        group = [it for it in items if it["mat"] == k]
        if not group:
            continue
        blocks, topics = [], []
        for it in group:
            if it["topic"] not in topics:
                topics.append(it["topic"])
        for tp in topics:
            lis = []
            for it in (x for x in group if x["topic"] == tp):
                g = it["grade"]
                cls = GCLS.get(g, "chk")
                text = it["text"]
                ref = re.findall(r"4-1표 (\d+)(?:·(\d+))?번", text)
                nums = [int(x) for pair in ref for x in pair if x]
                text = re.sub(r"4-1표 \d+(?:·\d+)?번을 보세요\.\s*", "", text).strip()
                if nums and not text:  # 표를 가리키기만 한 항목은 표의 수정안을 옮겨 온다
                    rows = {r["no"]: r for r in top}
                    text = " ".join(rows[x]["fix"] for x in nums if x in rows)
                body = "".join(f'<a class="toplink" href="#top-{x}">중대 오류 {x}번</a> ' for x in nums) + inline(text)
                subs = "".join(f"<li>{inline(s)}</li>" for s in it["subs"])
                subs = f"<ul>{subs}</ul>" if subs else ""
                links = fixed_links(k, it["pages"], where)
                fl = f'<p class="fixed">바로잡은 곳 {" ".join(links)}</p>' if links else ""
                q = html.escape(f'{n} {it["pages"]} {g} {it["topic"]} {plain(text)} {" ".join(map(plain, it["subs"]))}'.lower())
                label = "확인" if cls == "chk" else g
                lis.append(f"""          <li class="item {cls}" data-mat="{k}" data-grade="{g if cls != 'chk' else 'chk'}" data-q="{q}">
            <span class="pg">{html.escape(it['pages'])}</span><span class="gr">{label}</span>
            <div class="tx"><p>{body}</p>{subs}{fl}</div>
          </li>""")
            heading = f'<h4>{inline(tp)}</h4>' if tp else ""
            blocks.append(f'      <div class="topic">{heading}\n        <ul class="items">\n' + "\n".join(lis) + "\n        </ul>\n      </div>")
        mats_html.append(f'    <section class="mat" data-mat="{k}" id="m-{k}">\n      <h3>{n} <span>· 2015 자료 {pg}쪽</span></h3>\n'
                         + "\n".join(blocks) + "\n    </section>")

    matchips = "\n".join(f'        <button type="button" class="chip" data-val="{k}" aria-pressed="false">{n}</button>' for _, k, n, _ in MATS)
    gradechips = "\n".join(f'        <button type="button" class="chip {c}" data-val="{g}" aria-pressed="false">{g} {lab}</button>' for g, c, lab, _ in GRADES)
    page = PAGE.format(fonts=fonts, mathjax=mathjax, total=total, pages=f"{sum(m[3] for m in MATS):,}",
                       tally=tally, mhead=mhead, mrows=mrows, fixes="\n".join(fixes),
                       matchips=matchips, gradechips=gradechips, mats="\n".join(mats_html))
    (out_dir / "errors.html").write_text(page, encoding="utf-8")
    linked = sum(1 for it in errs if fixed_links(it["mat"], it["pages"], where))
    return total, linked
