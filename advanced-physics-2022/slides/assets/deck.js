// 고급 물리학(2022 개정) 슬라이드: 발표 모드, 교사용 메모, 쪽 이동, 인쇄 맞춤
(function () {
  "use strict";
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var body = document.body;
  var idx = 0;
  var presentBtn = document.getElementById("btn-present");
  var notesBtn = document.getElementById("btn-notes");
  var hint = document.querySelector(".present-hint");

  // ---------- 그림 라벨의 수식 ----------
  // figures.py 가 data-tex 에 남긴 '글자 $수식$ 글자' 라벨을 MathJax 로 그려 그림 SVG 안에 끼워 넣는다.
  // MathJax 의 startup.pageReady 에서 부른다 (모든 수식 조판이 끝난 뒤).
  window.AP22_figLabels = function () {
    var MJ = window.MathJax;
    if (!MJ || !MJ.tex2svg || !MJ.startup || !MJ.startup.output) return;
    var NS = "http://www.w3.org/2000/svg";
    var opts = MJ.startup.output.options, cache = opts.fontCache;
    opts.fontCache = "none";   // 글자 모양을 각 라벨 안에 바로 넣는다
    document.querySelectorAll(".fig svg text[data-tex]").forEach(function (t) {
      try {
        var cls = t.getAttribute("class") || "";
        var F = parseFloat(getComputedStyle(t).fontSize) || 13;
        var x = parseFloat(t.getAttribute("x")) || 0, y = parseFloat(t.getAttribute("y")) || 0;
        var anchor = t.getAttribute("text-anchor") || "start";
        var g = document.createElementNS(NS, "g");
        g.setAttribute("class", ("mlab " + cls).trim());
        t.parentNode.insertBefore(g, t);
        var cx = 0;
        t.getAttribute("data-tex").split("$").forEach(function (part, i) {
          if (!part) return;
          if (i % 2 === 0) {
            var tt = document.createElementNS(NS, "text");
            tt.setAttribute("x", cx);
            tt.setAttribute("y", 0);
            if (cls) tt.setAttribute("class", cls);
            tt.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
            tt.style.whiteSpace = "pre";
            tt.textContent = part;
            g.appendChild(tt);
            cx += tt.getComputedTextLength();
          } else {
            var m = MJ.tex2svg(part, { display: false }).querySelector("svg");
            var vb = m.getAttribute("viewBox").split(/[\s,]+/).map(Number);
            var k = F * 1.06 / 1000;   // 수식 1 em = 라벨 글자 크기
            m.setAttribute("x", cx + 0.3);
            m.setAttribute("y", vb[1] * k);
            m.setAttribute("width", vb[2] * k);
            m.setAttribute("height", vb[3] * k);
            m.setAttribute("overflow", "visible");
            m.removeAttribute("style");
            g.appendChild(m);
            cx += vb[2] * k + 0.6;
          }
        });
        var dx = anchor === "middle" ? -cx / 2 : anchor === "end" ? -cx : 0;
        g.setAttribute("transform", "translate(" + (x + dx).toFixed(1) + "," + y.toFixed(1) + ")");
        t.parentNode.removeChild(t);
      } catch (e) { /* 실패하면 대체 글자를 그대로 둔다 */ }
    });
    opts.fontCache = cache;
  };

  // ---------- 단계별 표시 (발표 모드) ----------
  // 유도 단계(ol.steps)와 번호 목록의 항목을 한 줄씩 보여 준다. 단계 목록 뒤에 붙은 문단은 마지막 단계로 친다.
  var stepsOf = slides.map(function (s) {
    var out = [];
    s.querySelectorAll(".body ol > li").forEach(function (li) {
      if (li.closest("details, aside, .toc")) return;
      out.push(li);
    });
    s.querySelectorAll(".body ol.steps").forEach(function (ol) {
      for (var el = ol.nextElementSibling; el; el = el.nextElementSibling) {
        if (el.matches("aside, script")) continue;
        out.push(el);
      }
    });
    out.forEach(function (el) { el.classList.add("step"); });
    return out;
  });
  var rev = 0;   // 지금 슬라이드에서 보이는 단계 수

  function setRevealed(n) {
    var list = stepsOf[idx];
    rev = Math.max(0, Math.min(list.length, n));
    list.forEach(function (el, k) { el.classList.toggle("shown", k < rev); });
    updateHint();
  }
  function updateHint() {
    if (!hint) return;
    var n = stepsOf[idx].length;
    hint.textContent = (idx + 1) + " / " + slides.length +
      (n ? "  ·  단계 " + rev + "/" + n : "") + "  ·  ← → 이동  ·  Esc 끝내기";
  }
  function next(skipSteps) {
    if (!skipSteps && rev < stepsOf[idx].length) setRevealed(rev + 1);
    else if (idx < slides.length - 1) show(idx + 1, "start");
  }
  function prev(skipSteps) {
    if (!skipSteps && rev > 0) setRevealed(rev - 1);
    else if (idx > 0) show(idx - 1, skipSteps ? "start" : "end");
  }

  function store(key, val) {
    try {
      if (val === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, val);
    } catch (e) { return null; }
    return null;
  }

  function show(i, at) {
    idx = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach(function (s, k) {
      s.classList.toggle("current", k === idx);
      if (k !== idx) s.querySelector(".sl").style.fontSize = "";
    });
    setRevealed(at === "end" ? stepsOf[idx].length : 0);
    fitPresent();
    var id = slides[idx].id;
    if (id && location.hash !== "#" + id) {
      try { history.replaceState(null, "", "#" + id); } catch (e) { /* 무시 */ }
    }
  }

  // 발표 모드: 지금 슬라이드가 화면을 넘으면 글자를 줄여 맞춘다 (휴대폰, 4:3 화면 등).
  // 아직 안 나온 단계도 자리를 차지하므로 처음부터 끝까지 다 들어가는 크기가 된다.
  // 가로 화면(present-land)에서는 폭이 좁아도 휴대폰용 한 단 배치를 쓰지 않고 16:9 두 단을 그대로 줄인다.
  function fitPresent() {
    var on = body.classList.contains("present") && !printSaved;
    body.classList.toggle("present-land", on && window.innerWidth > window.innerHeight);
    if (!on) return;
    var sl = slides[idx].querySelector(".sl");
    sl.style.fontSize = "";
    for (var k = 0; k < 8 && sl.scrollHeight > sl.clientHeight + 6; k++) {
      var px = parseFloat(getComputedStyle(sl).fontSize);
      var g = Math.max(0.7, Math.min(0.97, (sl.clientHeight / sl.scrollHeight) * 0.98));
      if (px * g < 10) break;   // 이보다 작으면 읽을 수 없으니 넘치는 부분은 스크롤로 본다
      sl.style.fontSize = (px * g).toFixed(2) + "px";
    }
  }
  window.addEventListener("resize", function () { fitPresent(); });
  document.addEventListener("toggle", function (e) {
    if (e.target.matches && e.target.matches("details.answer")) fitPresent();
  }, true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitPresent(); });

  function nearestSlide() {
    var best = 0, bestD = Infinity;
    slides.forEach(function (s, k) {
      var d = Math.abs(s.getBoundingClientRect().top - 80);
      if (d < bestD) { bestD = d; best = k; }
    });
    return best;
  }

  function enterPresent() {
    body.classList.add("present");
    if (presentBtn) presentBtn.setAttribute("aria-pressed", "true");
    show(nearestSlide(), "start");
    var el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(function () { /* 전체 화면이 막힌 환경 */ });
    }
  }

  function exitPresent() {
    body.classList.remove("present", "present-land");
    if (presentBtn) presentBtn.setAttribute("aria-pressed", "false");
    slides.forEach(function (s) { s.classList.remove("current"); s.querySelector(".sl").style.fontSize = ""; });
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
    slides[idx].scrollIntoView({ block: "start" });
  }

  function setNotes(on) {
    body.classList.toggle("show-notes", on);
    if (notesBtn) notesBtn.setAttribute("aria-pressed", on ? "true" : "false");
    store("ap22-notes", on ? "1" : "0");
  }

  if (presentBtn) presentBtn.addEventListener("click", function () {
    body.classList.contains("present") ? exitPresent() : enterPresent();
  });
  if (notesBtn) notesBtn.addEventListener("click", function () {
    setNotes(!body.classList.contains("show-notes"));
  });
  setNotes(store("ap22-notes") === "1");

  document.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
    var inPresent = body.classList.contains("present");
    if (tocIsOpen()) {
      if (e.key === "Escape" || e.key === "t" || e.key === "T") { closeToc(); e.preventDefault(); }
      return;
    }
    if (e.key === "t" || e.key === "T") { openToc(); e.preventDefault(); return; }
    if (e.key === "p" || e.key === "P") { inPresent ? exitPresent() : enterPresent(); e.preventDefault(); return; }
    if (e.key === "n" || e.key === "N") { setNotes(!body.classList.contains("show-notes")); return; }
    if (!inPresent) return;
    if ((e.key === " " || e.key === "Enter") && e.target.closest && e.target.closest("summary, button, a")) return;
    // Shift 를 누르면 단계를 건너뛰고 슬라이드 단위로 이동
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " " || e.key === "Enter") { next(e.shiftKey); e.preventDefault(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Backspace") { prev(e.shiftKey); e.preventDefault(); }
    else if (e.key === "Home") { show(0, "start"); e.preventDefault(); }
    else if (e.key === "End") { show(slides.length - 1, "end"); e.preventDefault(); }
    else if (e.key === "Escape") { exitPresent(); }
  });

  // 발표 모드에서 화면을 좌우로 밀어 이동
  var x0 = null;
  document.addEventListener("touchstart", function (e) {
    if (body.classList.contains("present") && !body.classList.contains("ink-on") && !tocIsOpen() &&
        !(e.target.closest && e.target.closest(".sim, .eq"))) x0 = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) { if (dx < 0) next(); else prev(); swiped = true; }
    x0 = null;
  }, { passive: true });

  // 발표 모드에서 슬라이드를 누르면 다음 줄 (풀이 보기, 링크, 판서 중에는 제외)
  var swiped = false;
  document.addEventListener("click", function (e) {
    if (!body.classList.contains("present") || body.classList.contains("ink-on")) return;
    if (swiped) { swiped = false; return; }
    if (e.button !== 0 || e.target.closest("a, button, summary, details, input, label, select, .sim, .toc-panel, .ink-bar, .ink-fab")) return;
    if (!e.target.closest(".slide")) return;
    next(e.shiftKey);
  });

  document.addEventListener("fullscreenchange", function () {
    if (!document.fullscreenElement && body.classList.contains("present")) { /* 전체 화면만 끝나고 발표 모드는 유지 */ }
  });

  // ---------- 목차 ----------
  // 중단원(구분 슬라이드)마다 묶은 목차. 항목을 누르면 그 슬라이드로 간다 (발표 모드에서도).
  var tocPanel = null, tocBtn = document.getElementById("btn-toc"), tocFab = null, tocFilter = null;
  function tocText(el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; }
  function buildToc() {
    tocPanel = document.createElement("div");
    tocPanel.className = "toc-panel";
    tocPanel.hidden = true;
    tocPanel.setAttribute("role", "dialog");
    tocPanel.setAttribute("aria-label", "목차");
    var h1 = document.querySelector(".bar h1");
    var head = document.createElement("div");
    head.className = "toc-head";
    head.innerHTML = '<strong>목차</strong><span class="toc-deck"></span>' +
      '<input type="search" class="toc-filter" placeholder="제목·주제로 찾기" aria-label="슬라이드 제목이나 주제로 찾기" autocomplete="off">' +
      '<button type="button" class="btn toc-close">닫기 (Esc)</button>';
    head.querySelector(".toc-deck").textContent = tocText(h1);
    var bodyEl = document.createElement("div");
    bodyEl.className = "toc-body";
    var group = null, list = null;
    function newGroup(label, i) {
      group = document.createElement("section");
      group.className = "toc-group";
      var h = document.createElement("h3");
      if (i === null) h.textContent = label;
      else {
        var a = document.createElement("a");
        a.href = "#" + slides[i].id; a.setAttribute("data-i", i); a.textContent = label;
        h.appendChild(a);
      }
      list = document.createElement("ol");
      group.appendChild(h); group.appendChild(list);
      bodyEl.appendChild(group);
    }
    slides.forEach(function (s, i) {
      var title = tocText(s.querySelector("h2"));
      if (s.classList.contains("divider")) {
        newGroup((tocText(s.querySelector(".roman")) + "  " + title).trim(), i);
        return;
      }
      if (!group) newGroup("시작", null);
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + s.id; a.setAttribute("data-i", i);
      var no = document.createElement("span"); no.className = "toc-no"; no.textContent = (i + 1 < 10 ? "0" : "") + (i + 1);
      var tx = document.createElement("span"); tx.className = "toc-title"; tx.textContent = title;
      a.appendChild(no); a.appendChild(tx);
      var kick = tocText(s.querySelector(".kicker"));
      var kind = /^(유도|풀이|어림)/.exec(kick) || /^(확인 문제|시뮬레이션|심화)/.exec(kick);
      if (kind) { var tg = document.createElement("span"); tg.className = "toc-kind"; tg.textContent = kind[1]; a.appendChild(tg); }
      li.setAttribute("data-k", (title + " " + kick).toLowerCase());   // 찾기는 제목과 머리 표시 모두에서
      li.appendChild(a); list.appendChild(li);
    });
    tocPanel.appendChild(head); tocPanel.appendChild(bodyEl);
    document.body.appendChild(tocPanel);
    tocFilter = head.querySelector(".toc-filter");
    tocFilter.addEventListener("input", function () {
      var q = tocFilter.value.trim().toLowerCase();
      tocPanel.querySelectorAll(".toc-group").forEach(function (g) {
        var any = false;
        g.querySelectorAll("li").forEach(function (li) {
          var hit = !q || li.getAttribute("data-k").indexOf(q) >= 0;
          li.hidden = !hit; if (hit) any = true;
        });
        g.hidden = !any && !!q && g.querySelector("h3").textContent.toLowerCase().indexOf(q) < 0;
      });
    });
    tocFilter.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeToc(); e.preventDefault(); }
      else if (e.key === "Enter") {
        var first = tocPanel.querySelector(".toc-group:not([hidden]) li:not([hidden]) a");
        if (first) { goTo(+first.getAttribute("data-i")); e.preventDefault(); }
      }
    });
    head.querySelector(".toc-close").addEventListener("click", closeToc);
    tocPanel.addEventListener("click", function (e) {
      var a = e.target.closest("a[data-i]");
      if (a) { e.preventDefault(); goTo(+a.getAttribute("data-i")); }
      else if (e.target === tocPanel) closeToc();
    });
  }
  function goTo(i) {
    closeToc();
    if (body.classList.contains("present")) show(i, "start");
    else {
      idx = i;
      slides[i].scrollIntoView({ block: "start" });
      try { history.replaceState(null, "", "#" + slides[i].id); } catch (e) { /* 무시 */ }
    }
  }
  function openToc() {
    if (!tocPanel) buildToc();
    var cur = body.classList.contains("present") ? idx : nearestSlide();
    tocPanel.querySelectorAll("a[data-i]").forEach(function (a) {
      a.classList.toggle("here", +a.getAttribute("data-i") === cur);
    });
    tocFilter.value = ""; tocFilter.dispatchEvent(new Event("input"));
    tocPanel.hidden = false;
    body.classList.add("toc-open");
    if (tocBtn) tocBtn.setAttribute("aria-pressed", "true");
    var here = tocPanel.querySelector("a.here");
    if (here) here.scrollIntoView({ block: "center" });
  }
  function closeToc() {
    if (!tocPanel || tocPanel.hidden) return;
    tocPanel.hidden = true;
    body.classList.remove("toc-open");
    if (tocBtn) tocBtn.setAttribute("aria-pressed", "false");
  }
  function tocIsOpen() { return !!tocPanel && !tocPanel.hidden; }
  if (tocBtn) tocBtn.addEventListener("click", function () { tocIsOpen() ? closeToc() : openToc(); });
  tocFab = document.createElement("button");
  tocFab.type = "button"; tocFab.className = "toc-fab"; tocFab.textContent = "목차 (T)";
  tocFab.addEventListener("click", function (e) { e.stopPropagation(); tocIsOpen() ? closeToc() : openToc(); });
  document.body.appendChild(tocFab);


  // ---------- 인쇄·PDF ----------
  // 풀이를 펼치고(또는 숨기고), 한 쪽(16:9)을 넘는 슬라이드만 글자를 줄여 맞춘다.
  var printSaved = null;
  function fitForPrint(opts) {
    opts = opts || {};
    var answers = opts.answers !== false;
    restorePrint();
    slides.forEach(function (s) { s.querySelector(".sl").style.fontSize = ""; });
    printSaved = { present: body.classList.contains("present"), open: [] };
    if (printSaved.present) body.classList.remove("present", "present-land");
    document.querySelectorAll("details.answer").forEach(function (d) {
      printSaved.open.push([d, d.open]);
      if (answers) d.open = true;
    });
    body.classList.toggle("print-noanswers", !answers);
    var probe = document.createElement("style");
    probe.textContent = ".slide .sl{height:auto!important}.slide .body{flex:none!important}" +
      (opts.width ? ".slide{width:" + opts.width + "!important;height:auto!important;aspect-ratio:16/9!important}" : "");
    document.head.appendChild(probe);
    var report = [];
    slides.forEach(function (s) {
      var sl = s.querySelector(".sl");
      var H = s.clientWidth * 9 / 16, W = s.clientWidth;
      var f = 1;
      for (var k = 0; k < 6 && sl.offsetHeight > H * 0.995; k++) {
        var px = parseFloat(getComputedStyle(sl).fontSize);
        var g = Math.max(0.55, Math.min(0.97, (H / sl.offsetHeight) * 0.98));
        f *= g;
        sl.style.fontSize = (px * g / W * 100).toFixed(3) + "cqw";
      }
      if (f < 1 || sl.offsetHeight > H * 1.005) report.push([s.id, Math.round(f * 100), sl.offsetHeight > H * 1.005]);
    });
    probe.remove();
    return report;
  }
  function restorePrint() {
    if (!printSaved) return;
    printSaved.open.forEach(function (it) { it[0].open = it[1]; });
    slides.forEach(function (s) { s.querySelector(".sl").style.fontSize = ""; });
    body.classList.remove("print-noanswers");
    var wasPresent = printSaved.present;
    if (wasPresent) body.classList.add("present");
    printSaved = null;
    if (wasPresent) fitPresent();
  }
  // PDF 생성 스크립트가 직접 맞출 때는 건드리지 않는다
  window.addEventListener("beforeprint", function () { if (!window.AP22_PRINT_LOCK) fitForPrint({ answers: true }); });
  window.addEventListener("afterprint", function () { if (!window.AP22_PRINT_LOCK) restorePrint(); });
  var printBtn = document.getElementById("btn-print");
  if (printBtn) printBtn.addEventListener("click", function () { window.print(); });
  window.AP22 = { fitForPrint: fitForPrint, restorePrint: restorePrint };
})();
