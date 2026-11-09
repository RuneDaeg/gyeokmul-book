// 고급 물리학(2022 개정) 슬라이드: 판서
// 펜·형광펜·레이저·지우개, 되돌리기, 빈 화면. 판서는 이 브라우저에 쪽마다 저장된다.
// 좌표는 슬라이드 너비·높이에 대한 비율로 저장해, 일반 보기와 발표 모드에서 같은 자리에 보인다.
(function () {
  "use strict";
  var body = document.body;
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  if (!slides.length) return;

  var DECK = "ap22-ink:" + (location.pathname.split("/").pop() || "deck").replace(/\.html$/, "");
  var COLORS = { ink: null, red: "#e5484d", blue: "#2f7de1", green: "#2f9e44", hl: "#ffd43b", laser: "#ff3b30" };
  var WIDTHS = [0.0016, 0.0028, 0.0052];   // 슬라이드 너비에 대한 펜 굵기
  var HL_WIDTH = 0.018;
  var ERASE_R = 0.012;
  var state = { on: false, tool: "pen", color: "ink", width: 1, penSeen: false };
  var data = new Map();
  var lasers = [];
  var active = null;   // 지금 그리고 있는 { slide, stroke, pointerId, rect }
  var lastSlide = null;

  // 슬라이드 열쇠: 제목 + 같은 제목의 순번
  var seen = {};
  slides.forEach(function (s) {
    var h = s.querySelector("h2");
    var t = (h ? h.textContent : s.id).replace(/\s+/g, " ").trim();
    seen[t] = (seen[t] || 0) + 1;
    s.dataset.inkKey = t + "#" + seen[t];
  });

  function rec(s) {
    var d = data.get(s);
    if (d) return d;
    d = { s: [], b: [], undo: [], canvas: null, ctx: null };
    try {
      var raw = window.localStorage.getItem(DECK + ":" + s.dataset.inkKey);
      if (raw) { var o = JSON.parse(raw); d.s = o.s || []; d.b = o.b || []; }
    } catch (e) { /* 저장소를 쓸 수 없는 환경 */ }
    data.set(s, d);
    return d;
  }
  function save(s) {
    var d = rec(s), key = DECK + ":" + s.dataset.inkKey;
    try {
      if (!d.s.length && !d.b.length) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify({ s: d.s, b: d.b }));
    } catch (e) { /* 용량 초과 등 */ }
  }
  function list(s) { return s.classList.contains("ink-board") ? rec(s).b : rec(s).s; }
  function listName(s) { return s.classList.contains("ink-board") ? "b" : "s"; }

  // ---------- 그리기 ----------
  function canvasFor(s) {
    var d = rec(s);
    if (!d.canvas) {
      var c = document.createElement("canvas");
      c.className = "ink-layer";
      c.setAttribute("aria-hidden", "true");
      s.appendChild(c);
      d.canvas = c;
      d.ctx = c.getContext("2d");
      if (window.ResizeObserver) new ResizeObserver(function () { fit(s); }).observe(s);
      fit(s);
    }
    return d;
  }
  function fit(s) {
    var d = rec(s);
    if (!d.canvas) return;
    var r = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(s.clientWidth * r)), h = Math.max(1, Math.round(s.clientHeight * r));
    if (d.canvas.width !== w || d.canvas.height !== h) { d.canvas.width = w; d.canvas.height = h; }
    render(s);
  }
  function colorOf(name) {
    if (name === "ink") return getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#1b2a36";
    return COLORS[name] || name;
  }
  function path(ctx, p, W, H) {
    ctx.beginPath();
    ctx.moveTo(p[0][0] * W, p[0][1] * H);
    if (p.length === 1) { ctx.lineTo(p[0][0] * W + 0.01, p[0][1] * H); return; }
    for (var i = 1; i < p.length - 1; i++) {
      var mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
      ctx.quadraticCurveTo(p[i][0] * W, p[i][1] * H, mx * W, my * H);
    }
    var q = p[p.length - 1];
    ctx.lineTo(q[0] * W, q[1] * H);
  }
  function drawStroke(ctx, st, W, H) {
    var p = st.p;
    if (!p || !p.length) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = colorOf(st.c);
    if (st.t === "hl") {
      ctx.globalAlpha = 0.38;
      ctx.lineWidth = HL_WIDTH * W;
      ctx.lineCap = "butt";
      path(ctx, p, W, H);
      ctx.stroke();
    } else if (st.pr && p.length > 1) {
      // 펜 압력: 구간마다 굵기를 바꿔 그린다
      for (var i = 1; i < p.length; i++) {
        var pr = (p[i][2] + p[i - 1][2]) / 2;
        ctx.lineWidth = st.w * W * (0.35 + 1.3 * pr);
        ctx.beginPath();
        ctx.moveTo(p[i - 1][0] * W, p[i - 1][1] * H);
        ctx.lineTo(p[i][0] * W, p[i][1] * H);
        ctx.stroke();
      }
    } else {
      ctx.lineWidth = st.w * W;
      path(ctx, p, W, H);
      ctx.stroke();
    }
    ctx.restore();
  }
  function render(s) {
    var d = rec(s);
    if (!d.canvas) return;
    var ctx = d.ctx, W = d.canvas.width, H = d.canvas.height;
    ctx.clearRect(0, 0, W, H);
    list(s).forEach(function (st) { drawStroke(ctx, st, W, H); });
    if (active && active.slide === s && active.stroke) drawStroke(ctx, active.stroke, W, H);
    var now = performance.now();
    lasers.forEach(function (L) {
      if (L.slide !== s) return;
      var pts = L.p.filter(function (q) { return now - q[2] < 650; });
      if (!pts.length) return;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = COLORS.laser;
      ctx.shadowColor = COLORS.laser;
      ctx.shadowBlur = 8 * (W / 1000);
      ctx.lineWidth = 0.004 * W;
      ctx.globalAlpha = 0.9;
      path(ctx, pts, W, H);
      ctx.stroke();
      ctx.restore();
    });
  }
  function drawExisting() {
    slides.forEach(function (s) {
      var d = rec(s);
      if (d.s.length || d.b.length) canvasFor(s);
    });
  }

  var raf = 0;
  function tickLaser() {
    var now = performance.now();
    lasers = lasers.filter(function (L) { return L.live || now - L.p[L.p.length - 1][2] < 650; });
    var touched = [];
    lasers.forEach(function (L) { if (touched.indexOf(L.slide) < 0) touched.push(L.slide); });
    touched.forEach(render);
    if (lastLaserSlide && touched.indexOf(lastLaserSlide) < 0) render(lastLaserSlide);
    lastLaserSlide = touched[0] || null;
    raf = lasers.length ? requestAnimationFrame(tickLaser) : 0;
  }
  var lastLaserSlide = null;

  // ---------- 입력 ----------
  function point(e, rect) {
    var x = (e.clientX - rect.left) / rect.width, y = (e.clientY - rect.top) / rect.height;
    var pr = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5;
    return [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4, Math.round(pr * 100) / 100];
  }
  function eraseAt(s, q, rect) {
    var L = list(s), removed = [];
    var rx = ERASE_R, ry = ERASE_R * rect.width / rect.height;
    for (var i = L.length - 1; i >= 0; i--) {
      var hit = L[i].p.some(function (a) {
        var dx = (a[0] - q[0]) / rx, dy = (a[1] - q[1]) / ry;
        return dx * dx + dy * dy <= 1;
      });
      if (hit) removed.push([i, L.splice(i, 1)[0]]);
    }
    if (removed.length) {
      rec(s).undo.push({ op: "erase", list: listName(s), items: removed });
      render(s);
      save(s);
    }
  }

  document.addEventListener("pointerdown", function (e) {
    if (!state.on) return;
    var s = e.target.closest && e.target.closest(".slide");
    if (!s || e.target.closest("summary, a, button, input, .ink-bar")) return;
    if (e.pointerType === "pen") state.penSeen = true;
    else if (e.pointerType === "touch" && state.penSeen) return;   // 펜을 쓰는 동안 손바닥 무시
    if (e.button !== 0 && !(e.pointerType === "pen" && e.button === 5)) return;
    e.preventDefault();
    var rect = s.getBoundingClientRect();
    var tool = (e.pointerType === "pen" && (e.buttons & 32)) ? "eraser" : state.tool;
    canvasFor(s);
    lastSlide = s;
    active = { slide: s, pointerId: e.pointerId, rect: rect, tool: tool, stroke: null, laser: null };
    var q = point(e, rect);
    if (tool === "eraser") eraseAt(s, q, rect);
    else if (tool === "laser") {
      q[2] = performance.now();
      active.laser = { slide: s, p: [q], live: true };
      lasers.push(active.laser);
      if (!raf) raf = requestAnimationFrame(tickLaser);
    } else {
      active.stroke = { t: tool === "hl" ? "hl" : "pen", c: tool === "hl" ? "hl" : state.color, w: WIDTHS[state.width], pr: e.pointerType === "pen" ? 1 : 0, p: [q] };
      render(s);
    }
    try { s.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  });

  document.addEventListener("pointermove", function (e) {
    if (!active || e.pointerId !== active.pointerId) return;
    e.preventDefault();
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (!evs.length) evs = [e];
    evs.forEach(function (ev) {
      var q = point(ev, active.rect);
      if (active.tool === "eraser") eraseAt(active.slide, q, active.rect);
      else if (active.laser) { q[2] = performance.now(); active.laser.p.push(q); }
      else if (active.stroke) {
        var p = active.stroke.p, last = p[p.length - 1];
        if (Math.abs(q[0] - last[0]) + Math.abs(q[1] - last[1]) > 0.0008) p.push(q);
      }
    });
    if (active.stroke) render(active.slide);
  });

  function finish(e) {
    if (!active || (e && e.pointerId !== active.pointerId)) return;
    var s = active.slide;
    if (active.laser) active.laser.live = false;
    if (active.stroke) {
      list(s).push(active.stroke);
      rec(s).undo.push({ op: "add", list: listName(s), st: active.stroke });
      save(s);
    }
    active = null;
    render(s);
  }
  document.addEventListener("pointerup", finish);
  document.addEventListener("pointercancel", finish);

  // ---------- 명령 ----------
  function target() {
    var cur = document.querySelector(".slide.current");
    return cur || lastSlide || slides[0];
  }
  function undo() {
    var s = target(), d = rec(s), u = d.undo.pop();
    if (!u) return;
    var L = d[u.list];
    if (u.op === "add") { var i = L.lastIndexOf(u.st); if (i >= 0) L.splice(i, 1); }
    else if (u.op === "erase") u.items.slice().reverse().forEach(function (it) { L.splice(it[0], 0, it[1]); });
    else if (u.op === "clear") d[u.list] = u.prev;
    render(s);
    save(s);
  }
  function clearSlide() {
    var s = target(), d = rec(s), name = listName(s);
    if (!d[name].length) return;
    d.undo.push({ op: "clear", list: name, prev: d[name] });
    d[name] = [];
    render(s);
    save(s);
  }
  function clearDeck() {
    if (!window.confirm("이 덱의 판서를 모두 지울까요? 되돌릴 수 없습니다.")) return;
    slides.forEach(function (s) { var d = rec(s); d.s = []; d.b = []; d.undo = []; render(s); save(s); });
  }
  function toggleBoard() {
    var s = target();
    s.classList.toggle("ink-board");
    canvasFor(s);
    render(s);
    sync();
  }

  // ---------- 도구 막대 ----------
  var bar = document.createElement("div");
  bar.className = "ink-bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "판서 도구");
  bar.hidden = true;
  function sw(name, label, key) {
    var c = name === "ink" ? "var(--ink)" : COLORS[name];
    return '<button type="button" class="sw" data-color="' + name + '" title="' + label + ' 펜 (' + key + ')" aria-label="' + label + ' 펜" style="--c:' + c + '"><i></i></button>';
  }
  function wd(i, label, px) {
    return '<button type="button" class="wd" data-width="' + i + '" title="' + label + '" aria-label="' + label + '"><i style="width:' + px + 'px;height:' + px + 'px"></i></button>';
  }
  bar.innerHTML =
    sw("ink", "기본색", "1") + sw("red", "빨강", "2") + sw("blue", "파랑", "3") + sw("green", "초록", "4") +
    '<span class="sep"></span>' +
    '<button type="button" data-tool="hl" title="형광펜 (H)">형광펜</button>' +
    '<button type="button" data-tool="laser" title="레이저 (L): 잠깐 보였다 사라짐">레이저</button>' +
    '<button type="button" data-tool="eraser" title="지우개 (E): 닿은 선을 지움">지우개</button>' +
    '<span class="sep"></span>' +
    wd(0, "가늘게 (W)", 4) + wd(1, "보통 (W)", 7) + wd(2, "굵게 (W)", 11) +
    '<span class="sep"></span>' +
    '<button type="button" data-act="undo" title="되돌리기 (Z)">되돌리기</button>' +
    '<button type="button" data-act="clear" title="이 쪽 판서 지우기 (C)">지우기</button>' +
    '<button type="button" data-act="board" title="빈 화면에 판서 (B)">빈 화면</button>' +
    '<button type="button" data-act="cleardeck" title="이 덱의 판서를 모두 지우기" aria-label="이 덱의 판서를 모두 지우기">⌫</button>' +
    '<span class="sep pres-only"></span>' +
    '<button type="button" data-act="prev" class="pres-only" title="이전 슬라이드 (←)" aria-label="이전 슬라이드">◀</button>' +
    '<button type="button" data-act="next" class="pres-only" title="다음 슬라이드 (→)" aria-label="다음 슬라이드">▶</button>' +
    '<span class="sep"></span>' +
    '<button type="button" data-act="move" title="도구 막대를 위/아래로 옮기기" aria-label="도구 막대 옮기기">⇅</button>' +
    '<button type="button" data-act="close" title="판서 끝내기 (D 또는 Esc)">닫기</button>';
  body.appendChild(bar);
  try { if (window.localStorage.getItem("ap22-ink-bar") === "top") bar.classList.add("top"); } catch (e) { /* 무시 */ }

  var fab = document.createElement("button");
  fab.type = "button";
  fab.className = "ink-fab";
  fab.textContent = "판서 (D)";
  body.appendChild(fab);

  var headerBtn = document.getElementById("btn-ink");

  function sync() {
    bar.querySelectorAll("[data-color]").forEach(function (b) {
      b.setAttribute("aria-pressed", state.tool === "pen" && state.color === b.dataset.color ? "true" : "false");
    });
    bar.querySelectorAll("[data-tool]").forEach(function (b) {
      b.setAttribute("aria-pressed", state.tool === b.dataset.tool ? "true" : "false");
    });
    bar.querySelectorAll("[data-width]").forEach(function (b) {
      b.setAttribute("aria-pressed", +b.dataset.width === state.width ? "true" : "false");
    });
    var bb = bar.querySelector('[data-act="board"]');
    bb.setAttribute("aria-pressed", target().classList.contains("ink-board") ? "true" : "false");
    body.classList.toggle("ink-erase", state.tool === "eraser");
    if (headerBtn) headerBtn.setAttribute("aria-pressed", state.on ? "true" : "false");
  }
  function setOn(on) {
    state.on = on;
    body.classList.toggle("ink-on", on);
    bar.hidden = !on;
    if (on) drawExisting();
    sync();
  }
  function setTool(t) { state.tool = t; sync(); }

  bar.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.color) { state.color = b.dataset.color; setTool("pen"); }
    else if (b.dataset.tool) setTool(state.tool === b.dataset.tool ? "pen" : b.dataset.tool);
    else if (b.dataset.width) { state.width = +b.dataset.width; if (state.tool !== "pen" && state.tool !== "hl") setTool("pen"); sync(); }
    else if (b.dataset.act === "undo") undo();
    else if (b.dataset.act === "clear") clearSlide();
    else if (b.dataset.act === "board") toggleBoard();
    else if (b.dataset.act === "cleardeck") clearDeck();
    else if (b.dataset.act === "prev") go(-1);
    else if (b.dataset.act === "next") go(1);
    else if (b.dataset.act === "move") {
      bar.classList.toggle("top");
      try { window.localStorage.setItem("ap22-ink-bar", bar.classList.contains("top") ? "top" : ""); } catch (err) { /* 무시 */ }
    }
    else if (b.dataset.act === "close") setOn(false);
  });
  fab.addEventListener("click", function () { setOn(true); });
  if (headerBtn) headerBtn.addEventListener("click", function () { setOn(!state.on); });

  function go(dir) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: dir > 0 ? "ArrowRight" : "ArrowLeft", bubbles: true }));
    setTimeout(sync, 0);
  }

  // 단축키는 deck.js 보다 먼저 받는다 (Esc 는 판서를 먼저 끈다)
  document.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    var k = e.key;
    if ((e.ctrlKey || e.metaKey) && (k === "z" || k === "Z") && state.on) { undo(); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === "d" || k === "D") { setOn(!state.on); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (!state.on) return;
    var handled = true;
    if (k === "Escape") setOn(false);
    else if (k === "1") { state.color = "ink"; setTool("pen"); }
    else if (k === "2") { state.color = "red"; setTool("pen"); }
    else if (k === "3") { state.color = "blue"; setTool("pen"); }
    else if (k === "4") { state.color = "green"; setTool("pen"); }
    else if (k === "h" || k === "H") setTool(state.tool === "hl" ? "pen" : "hl");
    else if (k === "l" || k === "L") setTool(state.tool === "laser" ? "pen" : "laser");
    else if (k === "e" || k === "E") setTool(state.tool === "eraser" ? "pen" : "eraser");
    else if (k === "w" || k === "W") { state.width = (state.width + 1) % WIDTHS.length; sync(); }
    else if (k === "z" || k === "Z") undo();
    else if (k === "c" || k === "C") clearSlide();
    else if (k === "b" || k === "B") toggleBoard();
    else handled = false;
    if (handled) { e.preventDefault(); e.stopImmediatePropagation(); }
    else if (k === "ArrowRight" || k === "ArrowLeft" || k === "PageDown" || k === "PageUp" || k === " ") setTimeout(sync, 0);
  }, true);

  // 판서가 있는 쪽은 처음부터 보이게
  drawExisting();
  window.addEventListener("beforeprint", function () { slides.forEach(fit); });
  window.AP22_INK = { on: setOn, state: state };
})();
