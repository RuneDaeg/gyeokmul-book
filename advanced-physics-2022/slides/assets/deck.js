// 고급 물리학(2022 개정) 슬라이드: 발표 모드, 교사용 메모, 쪽 이동, 인쇄 맞춤
(function () {
  "use strict";
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var body = document.body;
  var idx = 0;
  var presentBtn = document.getElementById("btn-present");
  var notesBtn = document.getElementById("btn-notes");
  var hint = document.querySelector(".present-hint");

  function store(key, val) {
    try {
      if (val === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, val);
    } catch (e) { return null; }
    return null;
  }

  function show(i) {
    idx = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach(function (s, k) { s.classList.toggle("current", k === idx); });
    if (hint) hint.textContent = (idx + 1) + " / " + slides.length + "  ·  ← → 이동  ·  Esc 끝내기";
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
    show(nearestSlide());
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
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { show(idx + 1); e.preventDefault(); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { show(idx - 1); e.preventDefault(); }
    else if (e.key === "Home") { show(0); e.preventDefault(); }
    else if (e.key === "End") { show(slides.length - 1); e.preventDefault(); }
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
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    x0 = null;
  }, { passive: true });

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
