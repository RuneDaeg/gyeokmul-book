// 고급 물리학(2022 개정) 슬라이드: 슬라이더로 조작하는 시뮬레이터
// 원고에서 <div class="sim" data-sim="이름"></div> 로 넣는다. 그림은 640 × 340 좌표로 그리고 화면 크기에 맞춰 늘린다.
(function () {
  "use strict";
  var W = 640, H = 340;
  var LIGHT = { ink: "#1b2a36", muted: "#586a73", line: "#c6d3d1", accent: "#1f5fa6", soft: "rgba(31,95,166,0.12)",
                warm: "#9a5b12", warn: "#b3452c", ok: "#2c7650", paper: "#fbfcfa" };
  var printing = false;

  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function theme() {
    if (printing) return LIGHT;
    var t = { ink: cssVar("--ink"), muted: cssVar("--muted"), line: cssVar("--line"), accent: cssVar("--accent"),
              soft: cssVar("--accent-soft"), warm: cssVar("--warm"), warn: cssVar("--warn"), ok: cssVar("--ok"), paper: cssVar("--paper") };
    return t.ink ? t : LIGHT;
  }
  function num(x, d) { return (Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x).toFixed(d).replace("-", "−"); }
  function signed(x, d) { return (x >= 0 ? "+" : "") + num(x, d); }

  // ---------- 그리기 도구 ----------
  function seg(c, x1, y1, x2, y2, color, w, dash) {
    c.save(); c.beginPath(); c.setLineDash(dash || []); c.strokeStyle = color; c.lineWidth = w || 1.5;
    c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore();
  }
  function txt(c, s, x, y, color, align, size, weight) {
    c.save(); c.fillStyle = color; c.textAlign = align || "left"; c.textBaseline = "middle";
    c.font = (weight || 400) + " " + (size || 12) + "px " + FONT; c.fillText(s, x, y); c.restore();
  }
  function dot(c, x, y, r, fill, stroke) {
    c.save(); c.beginPath(); c.arc(x, y, r, 0, 2 * Math.PI);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.6; c.stroke(); }
    c.restore();
  }
  function arrow(c, x1, y1, x2, y2, color, w, dash) {
    var a = Math.atan2(y2 - y1, x2 - x1), h = 8;
    seg(c, x1, y1, x2 - 0.6 * h * Math.cos(a), y2 - 0.6 * h * Math.sin(a), color, w || 1.8, dash);
    c.save(); c.fillStyle = color; c.beginPath(); c.moveTo(x2, y2);
    c.lineTo(x2 - h * Math.cos(a - 0.4), y2 - h * Math.sin(a - 0.4));
    c.lineTo(x2 - h * Math.cos(a + 0.4), y2 - h * Math.sin(a + 0.4)); c.closePath(); c.fill(); c.restore();
  }

  // 그래프: box = [왼쪽, 위, 오른쪽, 아래] (그림 좌표), xr·yr = 데이터 범위
  function Plot(c, t, box, xr, yr) {
    this.c = c; this.t = t; this.l = box[0]; this.tp = box[1]; this.r = box[2]; this.b = box[3];
    this.x0 = xr[0]; this.x1 = xr[1]; this.y0 = yr[0]; this.y1 = yr[1];
  }
  Plot.prototype.X = function (x) { return this.l + (x - this.x0) / (this.x1 - this.x0) * (this.r - this.l); };
  Plot.prototype.Y = function (y) { return this.b - (y - this.y0) / (this.y1 - this.y0) * (this.b - this.tp); };
  Plot.prototype.axes = function (xt, yt, o) {
    o = o || {};
    var c = this.c, t = this.t, self = this;
    var ya = this.Y(o.zero !== undefined ? o.zero : this.y0);
    (yt || []).forEach(function (v) {
      var y = self.Y(v);
      seg(c, self.l, y, self.r, y, t.line, 0.6);
      txt(c, o.yfmt ? o.yfmt(v) : String(v).replace("-", "−"), self.l - 6, y, t.muted, "right", 11);
    });
    (xt || []).forEach(function (v) {
      var x = self.X(o.xpos ? o.xpos(v) : v);
      seg(c, x, ya, x, ya + 4, t.muted, 1);
      txt(c, o.xfmt ? o.xfmt(v) : String(v).replace("-", "−"), x, self.b + 13, t.muted, "center", 11);
    });
    seg(c, this.l, ya, this.r + 4, ya, t.muted, 1.2);
    seg(c, this.l, this.b, this.l, this.tp - 4, t.muted, 1.2);
  };
  Plot.prototype.clip = function (fn) {
    var c = this.c; c.save(); c.beginPath(); c.rect(this.l, this.tp - 2, this.r - this.l + 2, this.b - this.tp + 4); c.clip(); fn(); c.restore();
  };
  Plot.prototype.curve = function (f, color, w, dash, n, xa, xb) {
    var c = this.c, self = this; n = n || 300;
    xa = xa === undefined ? this.x0 : xa; xb = xb === undefined ? this.x1 : xb;
    this.clip(function () {
      c.beginPath(); c.setLineDash(dash || []); c.strokeStyle = color; c.lineWidth = w || 2;
      for (var i = 0; i <= n; i++) {
        var x = xa + (xb - xa) * i / n, y = f(x);
        if (!isFinite(y)) y = self.y1 * 10;
        var py = Math.max(-2000, Math.min(2000, self.Y(y)));
        if (i) c.lineTo(self.X(x), py); else c.moveTo(self.X(x), py);
      }
      c.stroke();
    });
  };
  function legend(c, t, x, y, items) {   // items: [글자, 색, 점선?]
    items.forEach(function (it, k) {
      seg(c, x, y + 16 * k, x + 22, y + 16 * k, it[1], 2, it[2]);
      txt(c, it[0], x + 28, y + 16 * k, t.ink, "left", 11.5);
    });
  }

  var SIMS = {};

  // ---------- 1. 구분구적 ----------
  SIMS.riemann = {
    aria: "함수 3x² 아래 넓이를 N개의 직사각형으로 나누어 더하는 그림",
    labs: [["$x$", 620, 323, "end"], ["$f(x) = 3x^2$", 64, 6]],
    controls: [{ id: "n", label: "조각 수 $N$", min: 1, max: 60, step: 1, value: 6, d: 0 },
               { id: "mode", label: "높이를 재는 곳", options: [["mid", "조각의 가운데"], ["left", "왼쪽 끝"], ["right", "오른쪽 끝"]], value: "mid" }],
    outs: [["sum", "조각의 합"], ["exact", "적분값 $\\int_0^1 3x^2\\,dx$"], ["err", "차이"]],
    draw: function (c, v, t) {
      var p = new Plot(c, t, [56, 28, 620, 300], [0, 1], [0, 3.2]);
      var f = function (x) { return 3 * x * x; };
      p.axes([0, 0.25, 0.5, 0.75, 1], [1, 2, 3]);
      var n = v.n, dx = 1 / n, sum = 0, off = v.mode === "left" ? 0 : v.mode === "right" ? 1 : 0.5;
      for (var i = 0; i < n; i++) {
        var h = f((i + off) * dx); sum += h * dx;
        c.fillStyle = t.soft; c.strokeStyle = t.accent; c.lineWidth = n > 30 ? 0.7 : 1.2;
        c.beginPath(); c.rect(p.X(i * dx), p.Y(h), p.X((i + 1) * dx) - p.X(i * dx), p.Y(0) - p.Y(h)); c.fill(); c.stroke();
      }
      p.curve(f, t.ink, 2.2);
      return { sum: num(sum, 4), exact: "1", err: signed(sum - 1, 4) + " (" + signed((sum - 1) * 100, 2) + " %)" };
    }
  };

  // ---------- 2. 포물선 운동과 선형 저항 ----------
  SIMS.projectile = {
    aria: "발사각, 처음 속력, 저항 계수에 따른 포물선 궤적",
    labs: [["$x$ (m)", 624, 323, "end"], ["$y$ (m)", 56, 4]],
    controls: [{ id: "th", label: "발사각 $\\theta$", min: 10, max: 80, step: 1, value: 45, d: 0, unit: "°" },
               { id: "v0", label: "처음 속력 $v_0$", min: 5, max: 30, step: 1, value: 20, d: 0, unit: " m/s" },
               { id: "k", label: "저항 계수 $b/m$", min: 0, max: 1, step: 0.05, value: 0.25, d: 2, unit: " s⁻¹" }],
    outs: [["R0", "도달 거리 (저항 없음)"], ["R1", "도달 거리 (저항 있음)"], ["H1", "최고 높이 (저항 있음)"], ["T1", "비행 시간 (저항 있음)"]],
    play: "발사",
    reset: true,
    draw: function (c, v, t, st) {
      var g = 9.8, th = v.th * Math.PI / 180, vx = v.v0 * Math.cos(th), vy = v.v0 * Math.sin(th), k = v.k;
      var p = new Plot(c, t, [50, 24, 624, 300], [0, 96], [0, 46.1]);
      p.axes([0, 20, 40, 60, 80], [10, 20, 30, 40]);
      var T0 = 2 * vy / g, R0 = vx * T0;
      function pos(tt) {
        if (k < 0.005) return [vx * tt, vy * tt - g * tt * tt / 2];
        var e = 1 - Math.exp(-k * tt);
        return [vx / k * e, (vy + g / k) / k * e - g * tt / k];
      }
      var T1 = T0, H1 = 0, tt = 0, prev = [0, 0];
      for (tt = 0.005; tt < 20; tt += 0.005) {
        var q = pos(tt); if (q[1] > H1) H1 = q[1];
        if (q[1] < 0) { T1 = tt - 0.005 + 0.005 * prev[1] / (prev[1] - q[1]); break; }
        prev = q;
      }
      var R1 = pos(T1)[0], Tend = Math.max(T0, T1);
      st.end = Tend;
      var tmax = st.playing || st.t > 0 ? Math.min(st.t, Tend) : Tend;
      p.clip(function () {
        function path(fn, tEnd, color, w, dash) {
          c.beginPath(); c.setLineDash(dash || []); c.strokeStyle = color; c.lineWidth = w;
          var te = Math.min(tmax, tEnd);
          for (var i = 0; i <= 200; i++) { var s = fn(te * i / 200); if (i) c.lineTo(p.X(s[0]), p.Y(s[1])); else c.moveTo(p.X(s[0]), p.Y(s[1])); }
          c.stroke(); c.setLineDash([]);
          if (st.playing || st.t > 0) { var e = fn(te); dot(c, p.X(e[0]), p.Y(Math.max(0, e[1])), 5, color); }
        }
        path(function (s) { return [vx * s, vy * s - g * s * s / 2]; }, T0, t.ink, 1.8, [6, 5]);
        path(pos, T1, t.accent, 2.4);
      });
      legend(c, t, 478, 38, [["저항 없음", t.ink, [6, 5]], ["선형 저항 (−bv)", t.accent]]);
      return { R0: num(R0, 1) + " m", R1: num(R1, 1) + " m", H1: num(H1, 1) + " m", T1: num(T1, 2) + " s" };
    },
    step: function (v, st) { return st.t < st.end + 0.4; }
  };

  // ---------- 3. 막대의 회전 관성과 평행축 정리 ----------
  SIMS.inertia = {
    aria: "막대를 N조각으로 나누어 회전 관성을 더하고 축의 위치를 옮겨 보는 그림",
    labs: [["$x/L$", 600, 323, "end"], ["$r^2 = (x - a)^2$", 68, 86]],
    controls: [{ id: "n", label: "조각 수 $N$", min: 1, max: 40, step: 1, value: 8, d: 0 },
               { id: "a", label: "회전축의 위치 $a/L$", min: 0, max: 1, step: 0.05, value: 0, d: 2 }],
    outs: [["sum", "조각의 합 $\\sum m_ir_i^2$"], ["exact", "적분값 $\\int r^2\\,dm$"], ["icm", "질량 중심 축 $\\frac{1}{12}ML^2$"], ["md", "평행축 항 $Md^2$"]],
    draw: function (c, v, t) {
      var p = new Plot(c, t, [60, 104, 600, 300], [0, 1], [0, 1.05]);
      var n = v.n, a = v.a, dx = 1 / n, sum = 0, rmax = Math.max(a, 1 - a);
      p.axes([0, 0.25, 0.5, 0.75, 1], [0.5, 1]);
      for (var i = 0; i < n; i++) {
        var x = (i + 0.5) * dx, r2 = (x - a) * (x - a); sum += r2 * dx;
        var xa = p.X(i * dx), wd = p.X((i + 1) * dx) - xa;
        c.globalAlpha = 0.12 + 0.78 * r2 / (rmax * rmax); c.fillStyle = t.accent; c.fillRect(xa, 40, wd, 26); c.globalAlpha = 1;   // 막대의 조각: 축에서 멀수록 진하게
        c.strokeStyle = t.ink; c.lineWidth = 0.8; c.strokeRect(xa, 40, wd, 26);
        c.fillStyle = t.soft; c.strokeStyle = t.accent; c.lineWidth = n > 24 ? 0.7 : 1.2;
        c.beginPath(); c.rect(xa, p.Y(r2), wd, p.Y(0) - p.Y(r2)); c.fill(); c.stroke();
      }
      p.curve(function (x) { return (x - a) * (x - a); }, t.ink, 2.2);
      seg(c, p.X(a), 22, p.X(a), 300, t.warn, 1.8, [7, 4]);
      txt(c, "회전축", p.X(a) + (a > 0.85 ? -8 : 8), 26, t.warn, a > 0.85 ? "right" : "left", 12, 600);
      dot(c, p.X(0.5), 53, 4, t.paper, t.ink);
      txt(c, "질량 중심", p.X(0.5), 80, t.muted, "center", 11);
      var ex = 1 / 12 + (a - 0.5) * (a - 0.5);
      return { sum: num(sum, 4) + " ML²", exact: num(ex, 4) + " ML²", icm: num(1 / 12, 4) + " ML²", md: num((a - 0.5) * (a - 0.5), 4) + " ML²" };
    }
  };

  // ---------- 4. 케플러 궤도 ----------
  function keplerE(M, e) { var E = M, i; for (i = 0; i < 30; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
  SIMS.kepler = {
    aria: "처음 속력에 따라 달라지는 행성의 타원 궤도와 같은 시간 동안 쓸고 지나간 넓이",
    labs: [],
    controls: [{ id: "f", label: "처음 속력 $v_0/v_{\\text{원}}$", min: 0.6, max: 1.3, step: 0.01, value: 1.2, d: 2 }],
    outs: [["e", "이심률 $e$"], ["a", "긴반지름 $a/r_0$"], ["T", "주기 $T/T_{\\text{원}}$"], ["vr", "가장 빠를 때 / 느릴 때"]],
    play: "공전",
    draw: function (c, v, t, st) {
      var f = v.f, a = 1 / (2 - f * f), e = Math.abs(1 - f * f), b = a * Math.sqrt(1 - e * e), s = f >= 1 ? 1 : -1;
      var xmin = Math.min(-1, s > 0 ? -a * (1 + e) : -a * (1 - e)), ymax = Math.max(1, b);
      var sc = Math.min((W - 70) / (1 - xmin), (H - 44) / (2 * ymax), 120);
      var cx = W / 2 - sc * (1 + xmin) / 2, cy = H / 2;
      function P(E) { return [cx + sc * s * a * (Math.cos(E) - e), cy - sc * s * b * Math.sin(E)]; }
      var E0 = s > 0 ? 0 : Math.PI, K = 12, j, i;
      for (j = 0; j < K; j += 2) {            // 같은 시간 간격마다 쓸고 지나간 부채꼴 (하나 걸러 색칠)
        var Ea = keplerE(E0 + 2 * Math.PI * j / K, e), Eb = keplerE(E0 + 2 * Math.PI * (j + 1) / K, e);
        if (Eb < Ea) Eb += 2 * Math.PI;
        c.beginPath(); c.moveTo(cx, cy);
        for (i = 0; i <= 16; i++) { var q = P(Ea + (Eb - Ea) * i / 16); c.lineTo(q[0], q[1]); }
        c.closePath(); c.fillStyle = t.soft; c.fill();
      }
      c.beginPath(); c.setLineDash([4, 4]); c.strokeStyle = t.muted; c.lineWidth = 1; c.arc(cx, cy, sc, 0, 2 * Math.PI); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.strokeStyle = t.accent; c.lineWidth = 2.2;
      for (i = 0; i <= 240; i++) { var r = P(2 * Math.PI * i / 240); if (i) c.lineTo(r[0], r[1]); else c.moveTo(r[0], r[1]); }
      c.stroke();
      dot(c, cx, cy, 7, t.warm);
      txt(c, "태양", cx, cy + 18, t.warm, "center", 11);
      st.T = 4 * Math.pow(a, 1.5);
      var E = keplerE(E0 + 2 * Math.PI * st.t / st.T, e), pl = P(E);
      var rr = a * (1 - e * Math.cos(E)), sp = Math.sqrt(2 / rr - 1 / a);
      var dxE = -s * a * Math.sin(E), dyE = s * b * Math.cos(E), nn = Math.hypot(dxE, dyE) || 1;
      arrow(c, pl[0], pl[1], pl[0] + 34 * sp * dxE / nn, pl[1] - 34 * sp * dyE / nn, t.warn, 2);
      dot(c, pl[0], pl[1], 6, t.ink);
      txt(c, "점선: 원 궤도 (v₀ = v원)", 16, H - 14, t.muted, "left", 11);
      txt(c, "색칠한 부채꼴: 같은 시간 동안 쓸고 지나간 넓이", 16, 16, t.muted, "left", 11);
      return { e: num(e, 3), a: num(a, 2), T: num(Math.pow(a, 1.5), 2), vr: e < 0.0005 ? "1" : num((1 + e) / (1 - e), 2) + " 배" };
    },
    step: function () { return true; }
  };

  // ---------- 5. 원판의 전기장: 고리 N개의 합 ----------
  SIMS.diskfield = {
    aria: "원판을 N개의 고리로 나누어 축 위 전기장을 더한 값과 적분값의 비교",
    labs: [["$z/R$", 620, 323, "end"], ["$E\\,/\\,(\\sigma/2\\varepsilon_0)$", 226, 4]],
    controls: [{ id: "n", label: "고리 수 $N$", min: 1, max: 30, step: 1, value: 4, d: 0 },
               { id: "z", label: "축 위의 거리 $z/R$", min: 0.05, max: 4, step: 0.05, value: 1, d: 2 }],
    outs: [["sum", "고리 $N$개의 합"], ["exact", "적분값"], ["pt", "점전하 근사 $R^2/2z^2$"], ["pl", "무한 평면"]],
    draw: function (c, v, t) {
      var n = v.n, z = v.z, i;
      function ring(zz, k) { var r = (k + 0.5) / n; return zz * r / n / Math.pow(r * r + zz * zz, 1.5); }
      function total(zz) { var s = 0; for (var k = 0; k < n; k++) s += ring(zz, k); return s; }
      function exact(zz) { return 1 - zz / Math.sqrt(zz * zz + 1); }
      var cmax = 0; for (i = 0; i < n; i++) cmax = Math.max(cmax, ring(z, i));
      for (i = n - 1; i >= 0; i--) {            // 원판 앞면: 이 거리에서 기여가 큰 고리일수록 진하게
        c.beginPath(); c.arc(100, 160, 78 * (i + 1) / n, 0, 2 * Math.PI);
        c.fillStyle = t.paper; c.fill();
        c.globalAlpha = 0.1 + 0.8 * ring(z, i) / cmax; c.fillStyle = t.accent; c.fill(); c.globalAlpha = 1;
        c.strokeStyle = t.ink; c.lineWidth = n > 16 ? 0.5 : 1; c.stroke();
      }
      txt(c, "원판 앞면: 고리 " + n + "개", 100, 262, t.ink, "center", 12);
      txt(c, "진할수록 기여가 크다", 100, 280, t.muted, "center", 11);
      var p = new Plot(c, t, [226, 28, 620, 300], [0, 4], [0, 1.15]);
      p.axes([0, 1, 2, 3, 4], [0.5, 1]);
      p.curve(function () { return 1; }, t.muted, 1.4, [5, 4]);
      p.curve(function (x) { return 1 / (2 * x * x); }, t.warm, 1.6, [5, 4], 300, 0.4, 4);
      p.curve(exact, t.accent, 2.4, null, 300, 0.001, 4);
      p.curve(total, t.ink, 1.4, null, 400, 0.001, 4);
      seg(c, p.X(z), p.Y(0), p.X(z), p.Y(1.15), t.warn, 1.2, [3, 3]);
      dot(c, p.X(z), p.Y(Math.min(1.15, total(z))), 4.5, t.ink);
      legend(c, t, 470, 92, [["고리 N개의 합", t.ink], ["적분값", t.accent], ["점전하 근사", t.warm, [5, 4]], ["무한 평면", t.muted, [5, 4]]]);
      return { sum: num(total(z), 4), exact: num(exact(z), 4), pt: num(1 / (2 * z * z), 4), pl: "1" };
    }
  };

  // ---------- 6. RLC 직렬 회로의 공명 ----------
  SIMS.rlc = {
    aria: "저항, 코일, 축전기 값에 따른 RLC 직렬 회로의 전류 진폭과 위상각",
    labs: [["$f$ (Hz)", 620, 323, "end"], ["$I_0$ (A)", 62, 2], ["$\\phi$", 78, 211]],
    controls: [{ id: "R", label: "저항 $R$", min: 10, max: 100, step: 5, value: 20, d: 0, unit: " Ω" },
               { id: "L", label: "코일 $L$", min: 10, max: 200, step: 10, value: 100, d: 0, unit: " mH" },
               { id: "C", label: "축전기 $C$", min: 1, max: 100, step: 1, value: 10, d: 0, unit: " μF" }],
    outs: [["f0", "공명 진동수 $f_0$"], ["im", "최대 전류 $V_0/R$"], ["Q", "$Q = \\omega_0L/R$"], ["bw", "반치폭 $\\Delta f$"]],
    draw: function (c, v, t) {
      var R = v.R, L = v.L * 1e-3, C = v.C * 1e-6, V0 = 10;
      var lg = function (x) { return Math.log(x) / Math.LN10; };
      var p = new Plot(c, t, [56, 24, 620, 190], [1, 3.5], [0, 1.05]);
      var q = new Plot(c, t, [56, 226, 620, 300], [1, 3.5], [-95, 95]);
      var ticks = [10, 30, 100, 300, 1000, 3000];
      p.axes(ticks, [0.25, 0.5, 0.75, 1], { xpos: lg });
      q.axes(ticks, [-90, 90], { xpos: lg, zero: 0, yfmt: function (y) { return (y > 0 ? "+" : "−") + "90°"; } });
      function X(fl) { var w = 2 * Math.PI * Math.pow(10, fl); return w * L - 1 / (w * C); }
      p.curve(function (fl) { return V0 / Math.sqrt(R * R + X(fl) * X(fl)); }, t.accent, 2.4, null, 600);
      q.curve(function (fl) { return Math.atan2(X(fl), R) * 180 / Math.PI; }, t.warm, 2, null, 600);
      var w0 = 1 / Math.sqrt(L * C), f0 = w0 / (2 * Math.PI), Q = w0 * L / R, bw = R / (2 * Math.PI * L), im = V0 / R;
      var fa = f0 * (Math.sqrt(1 + 1 / (4 * Q * Q)) - 1 / (2 * Q)), fb = f0 * (Math.sqrt(1 + 1 / (4 * Q * Q)) + 1 / (2 * Q));
      seg(c, p.X(lg(f0)), 24, p.X(lg(f0)), 300, t.warn, 1.2, [3, 3]);
      seg(c, p.X(Math.max(1, lg(fa))), p.Y(im / Math.SQRT2), p.X(Math.min(3.5, lg(fb))), p.Y(im / Math.SQRT2), t.ink, 1.4);
      txt(c, "최대의 1/√2", p.X(Math.min(3.5, lg(fb))) + 6, p.Y(im / Math.SQRT2), t.muted, "left", 11);
      txt(c, "전류가 전압보다 앞섬 (용량성)", 70, 286, t.muted, "left", 11);
      txt(c, "전류가 뒤짐 (유도성)", 612, 240, t.muted, "right", 11);
      return { f0: num(f0, f0 < 100 ? 1 : 0) + " Hz", im: num(im, 2) + " A", Q: num(Q, 2), bw: num(bw, bw < 100 ? 1 : 0) + " Hz" };
    }
  };

  // ---------- 7. 슬릿의 간섭·회절 무늬 ----------
  function waveRGB(nm) {   // 가시광선 파장을 화면 색으로 (근사)
    var r = 0, g = 0, b = 0;
    if (nm < 440) { r = (440 - nm) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = (510 - nm) / 20; } else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = (645 - nm) / 65; } else r = 1;
    var k = nm < 420 ? 0.3 + 0.7 * (nm - 380) / 40 : nm > 700 ? 0.3 + 0.7 * (780 - nm) / 80 : 1;
    return [255 * r * k, 255 * g * k, 255 * b * k];
  }
  SIMS.slits = {
    aria: "슬릿 수, 슬릿 폭, 슬릿 간격, 파장에 따른 간섭·회절 무늬의 세기",
    labs: [["$\\sin\\theta$", 620, 323, "end"], ["$I/I_0$", 62, 80]],
    controls: [{ id: "N", label: "슬릿 수 $N$", min: 1, max: 5, step: 1, value: 2, d: 0 },
               { id: "a", label: "슬릿 폭 $a$", min: 2, max: 20, step: 1, value: 5, d: 0, unit: " μm" },
               { id: "d", label: "슬릿 간격 $d$", min: 10, max: 100, step: 5, value: 25, d: 0, unit: " μm" },
               { id: "lam", label: "파장 $\\lambda$", min: 400, max: 700, step: 10, value: 550, d: 0, unit: " nm" }],
    outs: [["dy", "무늬 간격 $\\lambda L/d$"], ["w", "가운데 회절 무늬 폭 $2\\lambda L/a$"], ["miss", "사라지는 차수"]],
    draw: function (c, v, t) {
      var N = v.N, a = v.a * 1000, d = v.d * 1000, lam = v.lam, S = 0.08;
      function env(s) { var al = Math.PI * a * s / lam; return Math.abs(al) < 1e-9 ? 1 : Math.pow(Math.sin(al) / al, 2); }
      function I(s) {
        if (N === 1) return env(s);
        var be = Math.PI * d * s / lam, sb = Math.sin(be);
        var m = Math.abs(sb) < 1e-7 ? 1 : Math.pow(Math.sin(N * be) / (N * sb), 2);
        return env(s) * m;
      }
      var p = new Plot(c, t, [56, 100, 620, 300], [-S, S], [0, 1.08]);
      var rgb = waveRGB(lam), x;
      c.fillStyle = "#000"; c.fillRect(56, 22, 564, 50);
      for (x = 56; x < 620; x += 0.5) {            // 스크린에 보이는 무늬
        var k = Math.pow(I(-S + 2 * S * (x - 56) / 564), 0.55);
        c.fillStyle = "rgb(" + Math.round(rgb[0] * k) + "," + Math.round(rgb[1] * k) + "," + Math.round(rgb[2] * k) + ")";
        c.fillRect(x, 22, 0.6, 50);
      }
      p.axes([-0.08, -0.04, 0, 0.04, 0.08], [0.5, 1]);
      if (N > 1) p.curve(env, t.muted, 1.4, [5, 4], 400);
      p.curve(I, t.accent, 2, null, 1400);
      if (N > 1) legend(c, t, 478, 114, [["회절 포락선", t.muted, [5, 4]]]);
      var ratio = v.d / v.a, miss = "없음";
      if (N === 1) miss = "–";
      else if (Math.abs(ratio - Math.round(ratio)) < 1e-9 && ratio >= 2) miss = "m = ±" + Math.round(ratio) + ", ±" + 2 * Math.round(ratio) + ", …";
      return { dy: N === 1 ? "–" : num(lam / v.d, 1) + " mm", w: num(2 * lam / v.a, 0) + " mm", miss: miss };
    }
  };

  // ---------- 8. 얇은 렌즈의 상 작도 ----------
  SIMS.lens = {
    aria: "렌즈의 종류, 초점 거리, 물체 거리에 따른 상 작도",
    labs: [],
    controls: [{ id: "kind", label: "렌즈", options: [["1", "볼록 렌즈"], ["-1", "오목 렌즈"]], value: "1" },
               { id: "f", label: "초점 거리 $|f|$", min: 5, max: 30, step: 1, value: 12, d: 0, unit: " cm" },
               { id: "p", label: "물체 거리 $p$", min: 5, max: 60, step: 1, value: 30, d: 0, unit: " cm" }],
    outs: [["q", "상 거리 $q$"], ["m", "배율 $m = -q/p$"], ["kind", "상의 종류"]],
    draw: function (c, v, t) {
      var sc = 4.9, cx = 320, cy = 170, ho = 8, f = (+v.kind) * v.f, pp = v.p, XR = 64;
      function X(x) { return cx + sc * x; } function Y(y) { return cy - sc * y; }
      seg(c, X(-XR), cy, X(XR), cy, t.muted, 1.1);
      var conv = f > 0, hh = 27;          // 렌즈: 볼록은 바깥쪽, 오목은 안쪽 화살촉
      seg(c, cx, Y(hh), cx, Y(-hh), t.ink, 2.4);
      [1, -1].forEach(function (u) {
        var y = Y(u * hh), dy = (conv ? 1 : -1) * u * 9;
        seg(c, cx - 7, y + dy, cx, y, t.ink, 2.4); seg(c, cx + 7, y + dy, cx, y, t.ink, 2.4);
      });
      [[-Math.abs(f), "F"], [Math.abs(f), "F′"]].forEach(function (o) { dot(c, X(o[0]), cy, 3.2, t.ink); txt(c, o[1], X(o[0]), cy + 14, t.ink, "center", 12); });
      arrow(c, X(-pp), cy, X(-pp), Y(ho), t.ink, 2.6);
      txt(c, "물체", X(-pp), Y(ho) - 12, t.ink, "center", 12);
      if (Math.abs(pp - f) < 1e-9) {
        seg(c, X(-pp), Y(ho), cx, Y(ho), t.accent, 2); seg(c, cx, Y(ho), X(XR), Y(ho - ho / f * XR), t.accent, 2);
        seg(c, X(-pp), Y(ho), X(XR), Y(-ho / pp * XR), t.warm, 2);
        txt(c, "물체가 초점에 있으면 굴절한 빛이 평행해 상이 생기지 않는다", cx, 22, t.warn, "center", 12);
        return { q: "∞", m: "–", kind: "상이 생기지 않음" };
      }
      var q = pp * f / (pp - f), hi = -q / pp * ho, virt = q < 0;
      c.save(); c.beginPath(); c.rect(X(-XR), 8, 2 * XR * sc, H - 16); c.clip();
      // 1) 축에 평행하게 들어가 초점을 지난다(오목: 초점에서 나온 것처럼 퍼진다)
      seg(c, X(-pp), Y(ho), cx, Y(ho), t.accent, 2); seg(c, cx, Y(ho), X(XR), Y(ho - ho / f * XR), t.accent, 2);
      // 2) 렌즈 중심을 지나 곧게 간다
      seg(c, X(-pp), Y(ho), X(XR), Y(-ho / pp * XR), t.warm, 2);
      // 3) 초점을 향해 들어가 축에 평행하게 나온다
      if (Math.abs(hi) <= hh) { seg(c, X(-pp), Y(ho), cx, Y(hi), t.ink, 1.3); seg(c, cx, Y(hi), X(XR), Y(hi), t.ink, 1.3); }
      if (virt) {                           // 허상: 굴절한 빛을 거꾸로 이은 점선이 만나는 곳
        seg(c, cx, Y(ho), X(q), Y(hi), t.accent, 1.2, [5, 4]);
        seg(c, X(Math.min(-pp, q)), Y(-ho / pp * Math.min(-pp, q)), X(-pp), Y(ho), t.warm, 1.2, [5, 4]);
        if (Math.abs(hi) <= hh) seg(c, cx, Y(hi), X(q), Y(hi), t.ink, 1, [5, 4]);
      }
      c.restore();
      if (Math.abs(q) <= XR && Math.abs(hi) <= 33) {
        arrow(c, X(q), cy, X(q), Y(hi), t.warn, 2.6, virt ? [5, 4] : null);
        txt(c, virt ? "허상" : "실상", X(q), Y(hi) + (hi > 0 ? -12 : 13), t.warn, "center", 12, 600);
      } else txt(c, "상이 화면 밖에 있다", cx, 22, t.warn, "center", 12);
      var am = Math.abs(q / pp);
      return { q: signed(q, 1) + " cm", m: signed(-q / pp, 2), kind: (virt ? "바로 선 허상" : "거꾸로 선 실상") + (am > 1.005 ? ", 확대" : am < 0.995 ? ", 축소" : ", 같은 크기") };
    }
  };

  // ---------- 9. 1차원 무한 퍼텐셜 상자 ----------
  SIMS.box = {
    aria: "양자수와 상자 폭에 따른 파동 함수, 확률 밀도, 에너지 준위",
    labs: [["$\\psi_n(x)$", 66, 6], ["$|\\psi_n(x)|^2$", 66, 172], ["$x$", 400, 323, "end"], ["$E_n$", 452, 6]],
    controls: [{ id: "n", label: "양자수 $n$", min: 1, max: 6, step: 1, value: 2, d: 0 },
               { id: "L", label: "상자 폭 $L$", min: 0.2, max: 2, step: 0.1, value: 1, d: 1, unit: " nm" }],
    outs: [["E", "에너지 $E_n$"], ["lam", "드브로이 파장 $2L/n$"], ["ph", "$n \\to n-1$ 전이의 빛"], ["nodes", "안쪽 마디 수"]],
    draw: function (c, v, t) {
      var n = v.n, L = v.L, E1 = 0.37603 / (L * L), k;
      var p = new Plot(c, t, [60, 30, 400, 150], [0, 1], [-1.2, 1.2]);
      var q = new Plot(c, t, [60, 196, 400, 300], [0, 1], [0, 1.15]);
      [p, q].forEach(function (g) { seg(c, g.l, g.tp - 6, g.l, g.b, t.ink, 3); seg(c, g.r, g.tp - 6, g.r, g.b, t.ink, 3); });
      seg(c, 60, p.Y(0), 400, p.Y(0), t.muted, 1); seg(c, 60, q.Y(0), 400, q.Y(0), t.muted, 1);
      c.beginPath(); c.moveTo(q.X(0), q.Y(0));
      for (k = 0; k <= 200; k++) c.lineTo(q.X(k / 200), q.Y(Math.pow(Math.sin(n * Math.PI * k / 200), 2)));
      c.lineTo(q.X(1), q.Y(0)); c.closePath(); c.fillStyle = t.soft; c.fill();
      p.curve(function (x) { return Math.sin(n * Math.PI * x); }, t.accent, 2.4);
      q.curve(function (x) { return Math.pow(Math.sin(n * Math.PI * x), 2); }, t.accent, 2);
      txt(c, "0", 60, 312, t.muted, "center", 11); txt(c, "L = " + num(L, 1) + " nm", 400, 312, t.muted, "right", 11);
      seg(c, 452, 300, 452, 22, t.muted, 1.2);
      for (k = 1; k <= 6; k++) {              // 에너지 준위: n² 에 비례
        var y = 300 - 262 * k * k / 36, on = k === n;
        seg(c, 462, y, 540, y, on ? t.accent : t.muted, on ? 3 : 1.4);
        txt(c, "n=" + k, 546, y, on ? t.accent : t.muted, "left", 11, on ? 600 : 400);
        if (k >= 2 || on) txt(c, num(E1 * k * k, E1 * k * k < 10 ? 2 : 1) + " eV", 632, y, on ? t.accent : t.muted, "right", 11, on ? 600 : 400);
      }
      var En = E1 * n * n;
      return { E: num(En, En < 10 ? 3 : 2) + " eV", lam: num(2 * L / n, 3) + " nm",
               ph: n > 1 ? num(1239.84 / (E1 * (2 * n - 1)), 0) + " nm" : "–", nodes: String(n - 1) };
    }
  };

  // ---------- 10. 광전 효과 ----------
  SIMS.photo = {
    aria: "금속과 빛의 파장에 따른 광전자의 최대 운동 에너지",
    labs: [["$f$ ($10^{15}$ Hz)", 620, 323, "end"], ["$K_{max}$ (eV)", 62, 4]],
    controls: [{ id: "W", label: "금속 (일함수)", options: [["2.14", "세슘 2.14 eV"], ["2.28", "나트륨 2.28 eV"], ["4.31", "아연 4.31 eV"], ["4.70", "구리 4.70 eV"]], value: "2.28" },
               { id: "lam", label: "빛의 파장 $\\lambda$", min: 150, max: 700, step: 5, value: 400, d: 0, unit: " nm" },
               { id: "I", label: "빛의 세기 (상대값)", min: 1, max: 10, step: 1, value: 5, d: 0 }],
    outs: [["hf", "광자 에너지 $hf$"], ["K", "$K_{max} = hf - W$"], ["Vs", "정지 전압 $V_s$"], ["cur", "광전류 (상대값)"], ["l0", "한계 파장 $hc/W$"]],
    draw: function (c, v, t) {
      var h = 4.135667, Wk = parseFloat(v.W), f = 299.792458 / v.lam, hf = h * f, K = hf - Wk;
      var p = new Plot(c, t, [56, 28, 620, 300], [0, 2.1], [-5.2, 6.6]);
      p.axes([0, 0.5, 1, 1.5, 2], [-4, -2, 2, 4, 6], { zero: 0 });
      [2.14, 2.28, 4.31, 4.70].forEach(function (w) {
        var on = Math.abs(w - Wk) < 1e-6, col = on ? t.accent : t.muted, f0 = w / h;
        p.curve(function (x) { return h * x - w; }, col, on ? 1.4 : 0.8, [4, 4], 2, 0, f0);
        p.curve(function (x) { return h * x - w; }, col, on ? 2.6 : 1.1, null, 2, f0, 2.1);
        if (on) { dot(c, p.X(0), p.Y(-w), 3.5, t.accent); txt(c, "−W", p.X(0) + 8, p.Y(-w) + 2, t.accent, "left", 11.5, 600);
                  txt(c, "f₀", p.X(f0), p.Y(0) + 13, t.accent, "center", 11.5, 600); }
      });
      seg(c, p.X(f), p.Y(-5.2), p.X(f), p.Y(6.6), t.warn, 1.2, [3, 3]);
      if (K > 0) dot(c, p.X(f), p.Y(K), 5, t.ok); else dot(c, p.X(f), p.Y(0), 5, t.paper, t.warn);
      txt(c, K > 0 ? "전자가 나온다" : "전자가 나오지 않는다 (세기를 올려도 같다)", p.X(f) + (f > 1.2 ? -8 : 8), 40, K > 0 ? t.ok : t.warn, f > 1.2 ? "right" : "left", 12, 600);
      txt(c, "기울기는 모든 금속에서 h", 612, 290, t.muted, "right", 11);
      return { hf: num(hf, 2) + " eV", K: K > 0 ? num(K, 2) + " eV" : "방출 안 됨", Vs: K > 0 ? num(K, 2) + " V" : "–",
               cur: K > 0 ? String(v.I) : "0", l0: num(1239.84 / Wk, 0) + " nm" };
    }
  };

  // ---------- 11. 뉴턴의 요람 ----------
  SIMS.cradle = {
    aria: "뉴턴의 요람: 들어 올린 구슬 수만큼 반대편에서 튀어나오는 모습",
    labs: [],
    controls: [{ id: "n", label: "들어 올린 구슬 수 $n$", min: 1, max: 4, step: 1, value: 1, d: 0, unit: "개" },
               { id: "th", label: "놓는 각 $\\theta_0$", min: 10, max: 40, step: 5, value: 30, d: 0, unit: "°" }],
    outs: [["v", "충돌 직전 속력 $v$"], ["p", "들어가는 운동량 $nmv$"], ["out", "나오는 구슬"], ["alt", "1개가 $nv$ 로 나온다면"]],
    play: "놓기",
    restart: true,
    draw: function (c, v, t, st) {
      var N = 5, n = v.n, th0 = v.th * Math.PI / 180, py = 42, Lp = 190, r = 17, i;
      var a = th0 * Math.cos(2 * Math.PI * st.t / 2.0);      // 왼쪽 묶음의 각(+). 음수가 되면 오른쪽 묶음이 나간다
      seg(c, 190, py, 450, py, t.ink, 5);
      for (i = 0; i < N; i++) {
        var px = 320 + (i - 2) * 2 * r, ang = 0, moving = false;
        if (a > 0 && i < n) { ang = -a; moving = true; }
        if (a < 0 && i >= N - n) { ang = -a; moving = true; }
        var x = px + Lp * Math.sin(ang), y = py + Lp * Math.cos(ang);
        seg(c, px, py, x, y, t.muted, 1.2);
        dot(c, x, y, r - 1, moving ? t.accent : t.soft, t.ink);
      }
      txt(c, "구슬 5개 (각 50 g), 줄 길이 25 cm, 탄성 충돌", 16, H - 14, t.muted, "left", 11);
      txt(c, a > 0 ? "들어가는 구슬 " + n + "개" : "나오는 구슬 " + n + "개", a > 0 ? 150 : 490, 290, t.accent, "center", 12, 600);
      var sp = Math.sqrt(2 * 9.8 * 0.25 * (1 - Math.cos(th0)));
      return { v: num(sp, 2) + " m/s", p: num(n * 0.05 * sp, 3) + " kg·m/s", out: n + "개, 속력 v",
               alt: n === 1 ? "지금과 같다" : "운동 에너지가 " + n + "배: 불가능" };
    },
    step: function () { return true; }
  };

  // ---------- 화면에 붙이기 ----------
  var FONT = "sans-serif", all = [];
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  function build(root) {
    var def = SIMS[root.getAttribute("data-sim")];
    if (!def) { root.textContent = "시뮬레이터 '" + root.getAttribute("data-sim") + "' 가 없습니다"; return; }
    var view = el("div", "sim-view"), canvas = document.createElement("canvas"), side = el("div", "sim-side");
    canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", def.aria);
    view.appendChild(canvas);
    (def.labs || []).forEach(function (l) {
      var s = el("span", "sim-lab" + (l[3] ? " " + l[3] : ""), l[0]);
      s.style.left = (l[1] / W * 100) + "%"; s.style.top = (l[2] / H * 100) + "%"; view.appendChild(s);
    });
    var v = {}, outs = {}, st = { t: 0, playing: false }, btn = null, last = 0;
    def.controls.forEach(function (cdef) {
      v[cdef.id] = cdef.value;
      var lab = el("label", "sim-ctl"), name = el("span", "sim-name", cdef.label), input;
      lab.appendChild(name);
      if (cdef.options) {
        input = document.createElement("select");
        cdef.options.forEach(function (o) { var op = el("option", "", o[1]); op.value = o[0]; input.appendChild(op); });
        input.value = cdef.value;
        input.addEventListener("change", function () { v[cdef.id] = input.value; changed(); });
      } else {
        var out = el("output", "", "");
        input = document.createElement("input"); input.type = "range";
        input.min = cdef.min; input.max = cdef.max; input.step = cdef.step; input.value = cdef.value;
        var show = function () { out.textContent = num(v[cdef.id], cdef.d || 0) + (cdef.unit || ""); };
        input.addEventListener("input", function () { v[cdef.id] = +input.value; show(); changed(); });
        show(); lab.appendChild(out);
      }
      lab.appendChild(input); side.appendChild(lab);
    });
    if (def.play) {
      btn = el("button", "btn sim-btn", "▶ " + def.play); btn.type = "button";
      btn.addEventListener("click", function () { st.playing ? stop() : start(); });
      side.appendChild(btn);
    }
    var box = el("div", "sim-outs");
    def.outs.forEach(function (o) {
      var row = el("div", "sim-out"); row.appendChild(el("span", "", o[1]));
      outs[o[0]] = el("b", "", ""); row.appendChild(outs[o[0]]); box.appendChild(row);
    });
    side.appendChild(box);
    root.appendChild(view); root.appendChild(side);

    function redraw() {
      var cw = view.clientWidth; if (!cw) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var pw = Math.round(cw * dpr), ph = Math.round(cw * H / W * dpr);
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      var c = canvas.getContext("2d");
      c.setTransform(pw / W, 0, 0, pw / W, 0, 0); c.clearRect(0, 0, W, H);
      c.lineJoin = "round"; c.lineCap = "round";
      var res = def.draw(c, v, theme(), st) || {};
      Object.keys(outs).forEach(function (k) { if (k in res) outs[k].textContent = res[k]; });
    }
    function tick(ts) {
      if (!st.playing) return;
      st.t += Math.min(0.05, (ts - last) / 1000); last = ts;
      var go = !def.step || def.step(v, st) !== false;
      redraw();
      if (go) requestAnimationFrame(tick); else stop(true);
    }
    function start() { if (def.reset) st.t = 0; st.playing = true; btn.textContent = "■ 멈춤"; last = performance.now(); requestAnimationFrame(tick); }
    function stop(done) { st.playing = false; if (btn) btn.textContent = "▶ " + def.play; if (done && def.reset) { st.t = 0; redraw(); } }
    function changed() { if (def.reset) { st.t = 0; if (st.playing) stop(); } else if (def.restart) st.t = 0; redraw(); }
    if (window.ResizeObserver) new ResizeObserver(redraw).observe(view);
    all.push(redraw);
    redraw();
  }

  function init() {
    FONT = cssVar("--f-body") || "sans-serif";
    document.querySelectorAll(".sim[data-sim]").forEach(build);
    var redrawAll = function () { all.forEach(function (f) { f(); }); };
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", redrawAll);
    }
    window.addEventListener("beforeprint", function () { printing = true; redrawAll(); });
    window.addEventListener("afterprint", function () { printing = false; redrawAll(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawAll);
    window.AP22_sims = { redraw: redrawAll, light: function (on) { printing = !!on; redrawAll(); } };
  }
  init();
})();
