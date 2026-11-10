// 고급 물리학(2022 개정) 슬라이드: 발표 모드, 교사용 메모, 쪽 이동, 인쇄 맞춤
(function () {
  "use strict";
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var body = document.body;
  var idx = 0;
  var presentBtn = document.getElementById("btn-present");
  var notesBtn = document.getElementById("btn-notes");
  var hint = document.querySelector(".present-hint");

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
    slides.forEach(function (s, k) { s.classList.toggle("current", k === idx); });
    setRevealed(at === "end" ? stepsOf[idx].length : 0);
    var id = slides[idx].id;
    if (id && location.hash !== "#" + id) {
      try { history.replaceState(null, "", "#" + id); } catch (e) { /* 무시 */ }
    }
  }

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
    body.classList.remove("present");
    if (presentBtn) presentBtn.setAttribute("aria-pressed", "false");
    slides.forEach(function (s) { s.classList.remove("current"); });
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
    if (body.classList.contains("present") && !body.classList.contains("ink-on")) x0 = e.touches[0].clientX;
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
    if (e.button !== 0 || e.target.closest("a, button, summary, details, input, label, .ink-bar, .ink-fab")) return;
    if (!e.target.closest(".slide")) return;
    next(e.shiftKey);
  });

  document.addEventListener("fullscreenchange", function () {
    if (!document.fullscreenElement && body.classList.contains("present")) { /* 전체 화면만 끝나고 발표 모드는 유지 */ }
  });

  // ---------- 인쇄·PDF ----------
  // 풀이를 펼치고(또는 숨기고), 한 쪽(16:9)을 넘는 슬라이드만 글자를 줄여 맞춘다.
  var printSaved = null;
  function fitForPrint(opts) {
    opts = opts || {};
    var answers = opts.answers !== false;
    restorePrint();
    printSaved = { present: body.classList.contains("present"), open: [] };
    if (printSaved.present) body.classList.remove("present");
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
    if (printSaved.present) body.classList.add("present");
    printSaved = null;
  }
  // PDF 생성 스크립트가 직접 맞출 때는 건드리지 않는다
  window.addEventListener("beforeprint", function () { if (!window.AP22_PRINT_LOCK) fitForPrint({ answers: true }); });
  window.addEventListener("afterprint", function () { if (!window.AP22_PRINT_LOCK) restorePrint(); });
  var printBtn = document.getElementById("btn-print");
  if (printBtn) printBtn.addEventListener("click", function () { window.print(); });
  window.AP22 = { fitForPrint: fitForPrint, restorePrint: restorePrint };
})();
