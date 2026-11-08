// 고급 물리학(2022 개정) 슬라이드: 발표 모드, 교사용 메모, 쪽 이동
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
    if (body.classList.contains("present")) x0 = e.touches[0].clientX;
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
})();
