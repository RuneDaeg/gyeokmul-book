"""슬라이드에 들어가는 그림(SVG)을 실제 식으로 계산해서 만든다.

색은 모두 deck.css 의 클래스(c1, c2, ax, fA …)로 지정하므로 밝은/어두운 테마를 따라간다.
"""
import html
import math
import re


def _path(points):
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in points)


class Plot:
    """데이터 좌표 → SVG 좌표 변환."""

    def __init__(self, w, h, xr, yr, pad=(44, 16, 16, 34)):
        self.w, self.h = w, h
        self.l, self.t, self.r, self.b = pad
        self.t += 12   # y축 이름이 들어갈 자리
        self.x0, self.x1 = xr
        self.y0, self.y1 = yr

    def X(self, x):
        return self.l + (x - self.x0) / (self.x1 - self.x0) * (self.w - self.l - self.r)

    def Y(self, y):
        return self.h - self.b - (y - self.y0) / (self.y1 - self.y0) * (self.h - self.t - self.b)

    def curve(self, f, n=300, cls="c1", xa=None, xb=None, clip=None):
        xa = self.x0 if xa is None else xa
        xb = self.x1 if xb is None else xb
        pts = []
        for i in range(n + 1):
            x = xa + (xb - xa) * i / n
            y = f(x)
            if clip:
                y = max(clip[0], min(clip[1], y))
            pts.append((self.X(x), self.Y(y)))
        return f'<path class="{cls}" d="{_path(pts)}"/>'

    def axes(self, xlabel="", ylabel="", origin_y=None):
        oy = self.Y(self.y0 if origin_y is None else origin_y)
        s = [f'<path class="ax" d="M{self.l},{oy:.1f} H{self.w - self.r + 6}"/>',
             f'<path class="ax" d="M{self.l},{self.h - self.b} V{self.t - 6}"/>']
        if xlabel:
            s.append(f'<text x="{self.w - self.r}" y="{self.h - 3}" text-anchor="end">{xlabel}</text>')
        if ylabel:
            s.append(f'<text x="{self.l + 6}" y="{self.t - 6}">{ylabel}</text>')
        return "\n".join(s)

    def svg(self, inner, label):
        return svg(self.w, self.h, inner, label)


TEXT_RE = re.compile(r"<text([^>]*)>([^<]*\$[^<]*)</text>")


def tex_labels(inner):
    """'$...$' 가 든 라벨은 data-tex 에 LaTeX 원문을 두고, 페이지가 열릴 때 deck.js 가 MathJax 로 그린다.
    글자 내용은 스크립트가 돌지 않을 때 보일 대체 문자열이다."""
    def sub(m):
        src = m.group(2)
        plain = re.sub(r"\\(?:mathrm|text)\{([^}]*)\}", r"\1", src)
        plain = re.sub(r"\\[a-zA-Z]+\s?", "", plain).replace("$", "").replace("{", "").replace("}", "")
        return f'<text{m.group(1)} data-tex="{html.escape(src, quote=True)}">{plain}</text>'
    return TEXT_RE.sub(sub, inner)


def svg(w, h, inner, label):
    return (f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{label}" xmlns="http://www.w3.org/2000/svg">\n'
            f'{tex_labels(inner)}\n</svg>')


# ---------------------------------------------------------------- 역학
def traj():
    g, v0, th, k = 9.8, 20.0, math.radians(45), 0.25  # k = b/m (1/s)
    vx, vy = v0 * math.cos(th), v0 * math.sin(th)
    T0 = 2 * vy / g
    R0 = vx * T0
    p = Plot(480, 250, (0, 44), (0, 12.5), pad=(40, 14, 14, 36))

    def drag_xy(t):
        x = vx / k * (1 - math.exp(-k * t))
        y = (vy + g / k) / k * (1 - math.exp(-k * t)) - g * t / k
        return x, y

    pts0 = [(p.X(vx * t), p.Y(vy * t - g * t * t / 2)) for t in [T0 * i / 200 for i in range(201)]]
    pts1 = []
    t = 0.0
    while True:
        x, y = drag_xy(t)
        if y < 0 and t > 0.1:
            break
        pts1.append((p.X(x), p.Y(max(y, 0))))
        t += 0.01
    xr1 = drag_xy(t)[0]
    inner = [p.axes("$x$ (m)", "$y$ (m)"),
             f'<path class="c2 dash" d="{_path(pts0)}"/>',
             f'<path class="c1" d="{_path(pts1)}"/>',
             f'<text x="{p.X(30):.0f}" y="{p.Y(9.5):.0f}" class="t-ink">저항 없음: $R = {R0:.1f}$ m</text>',
             f'<text x="{p.X(13.5):.0f}" y="{p.Y(2.2):.0f}" text-anchor="middle" class="t-acc">선형 저항: $R \\approx {xr1:.1f}$ m</text>']
    for xv in (10, 20, 30, 40):
        inner.append(f'<text x="{p.X(xv):.0f}" y="{p.h - 18}" text-anchor="middle">{xv}</text>')
    for yv in (5, 10):
        inner.append(f'<text x="{p.l - 6}" y="{p.Y(yv) + 4:.0f}" text-anchor="end">{yv}</text>')
    return p.svg("\n".join(inner), "공기 저항이 있을 때와 없을 때의 포물선 궤적 비교 (v0 = 20 m/s, 45°)")


def vterm():
    p = Plot(440, 220, (0, 5), (0, 1.15), pad=(46, 14, 14, 36))
    inner = [p.axes("$t/\\tau$", "$v/v_T$"),
             f'<path class="gr dash" d="M{p.X(0):.0f},{p.Y(1):.0f} H{p.X(5):.0f}"/>',
             p.curve(lambda t: 1 - math.exp(-t)),
             f'<path class="gr dash" d="M{p.X(1):.0f},{p.Y(0):.0f} V{p.Y(1 - math.exp(-1)):.0f} H{p.X(0):.0f}"/>',
             f'<text x="{p.X(1) + 4:.0f}" y="{p.Y(0.1):.0f}">$\\tau = m/b$</text>',
             f'<text x="{p.l - 6}" y="{p.Y(0.632) + 4:.0f}" text-anchor="end">0.63</text>',
             f'<text x="{p.l - 6}" y="{p.Y(1) + 4:.0f}" text-anchor="end">1</text>',
             f'<text x="{p.X(3.2):.0f}" y="{p.Y(1.06):.0f}" class="t-acc">종단 속도 $v_T = mg/b$</text>']
    return p.svg("\n".join(inner), "선형 저항을 받으며 떨어지는 물체의 속력이 종단 속도에 다가가는 그래프")


def potential():
    def U(x):
        return 1.2 + 3.2 * math.exp(-((x - 4.6) ** 2) / 0.8) - 3.0 * math.exp(-((x - 2.6) ** 2) / 1.1) \
            - 2.0 * math.exp(-((x - 6.8) ** 2) / 0.9) + 0.35 * (x - 4.5) ** 2 / 4
    E = 2.4
    p = Plot(480, 250, (0.4, 9.0), (-2.2, 5.2), pad=(40, 14, 14, 34))
    xs = [0.4 + 8.6 * i / 600 for i in range(601)]
    inner = [p.axes("$x$", "$U,\\ E$")]
    # 운동 가능 구간(E ≥ U) 음영
    seg = []
    for x in xs + [None]:
        if x is not None and U(x) <= E:
            seg.append(x)
        elif seg:
            a, b = seg[0], seg[-1]
            pts = [(p.X(a), p.Y(E))] + [(p.X(t), p.Y(U(t))) for t in seg] + [(p.X(b), p.Y(E))]
            inner.append(f'<path class="fA" d="{_path(pts)} Z"/>')
            for t in (a, b):
                inner.append(f'<path class="ax dash" d="M{p.X(t):.1f},{p.Y(E):.1f} V{p.Y(-2.2):.1f}"/>')
            seg = []
    inner.append(p.curve(U, cls="c2"))
    inner.append(f'<path class="c1" d="M{p.X(0.4):.0f},{p.Y(E):.1f} H{p.X(9):.0f}"/>')
    inner.append(f'<text x="{p.X(0.5):.0f}" y="{p.Y(E) - 6:.0f}" class="t-acc">역학적 에너지 $E$</text>')
    inner.append(f'<text x="{p.X(2.6):.0f}" y="{p.Y(1.3):.0f}" text-anchor="middle" class="t-ink">$E \\ge U$: 운동 가능</text>')
    inner.append(f'<text x="{p.X(2.6):.0f}" y="{p.Y(0.6):.0f}" text-anchor="middle">$K = E - U$</text>')
    inner.append(f'<text x="{p.X(4.6):.0f}" y="{p.Y(4.6):.0f}" text-anchor="middle" class="t-warn">$E \\lt U$: 금지 구간</text>')
    inner.append(f'<text x="{p.X(0.9):.0f}" y="{p.Y(-1.9):.0f}">전환점</text>')
    return p.svg("\n".join(inner), "퍼텐셜 에너지 곡선과 역학적 에너지, 운동 가능 구간")


# ---------------------------------------------------------------- 전자기학
def radial(kind):
    p = Plot(420, 220, (0, 4), (0, 1.15), pad=(40, 14, 14, 36))
    if kind == "E":
        f = lambda r: r if r < 1 else 1 / r ** 2
        lab_in, lab_out, ylab = "$E \\propto r$", "$E \\propto 1/r^2$", "$E$"
        aria = "균일하게 대전된 부도체 구의 반지름에 따른 전기장 세기"
    else:
        f = lambda r: r if r < 1 else 1 / r
        lab_in, lab_out, ylab = "$B \\propto r$", "$B \\propto 1/r$", "$B$"
        aria = "전류가 고르게 흐르는 원통 도선의 거리에 따른 자기장 세기"
    inner = [p.axes("$r$", ylab), p.curve(f),
             f'<path class="ax dash" d="M{p.X(1):.0f},{p.Y(0):.0f} V{p.Y(1):.0f}"/>',
             f'<text x="{p.X(1):.0f}" y="{p.h - 18}" text-anchor="middle">$R$</text>',
             f'<text x="{p.X(0.45):.0f}" y="{p.Y(0.78):.0f}" text-anchor="middle" class="t-acc">{lab_in}</text>',
             f'<text x="{p.X(2.4):.0f}" y="{p.Y(0.45):.0f}" class="t-acc">{lab_out}</text>']
    return p.svg("\n".join(inner), aria)


def phasor():
    w, h = 420, 250
    ox, oy, s = 120, 150, 1.0
    VR, VL, VC = 150, 120, 50
    ex, ey = ox + VR, oy - (VL - VC)
    phi = math.degrees(math.atan2(VL - VC, VR))
    inner = [
        f'<path class="ax" d="M{ox - 40},{oy} H{ox + 230}"/>',
        f'<path class="ax" d="M{ox},{oy + 80} V{oy - 140}"/>',
        f'<path class="c1" d="M{ox},{oy} H{ox + VR}"/>',
        f'<path class="c3" d="M{ox},{oy} V{oy - VL}"/>',
        f'<path class="c4" d="M{ox},{oy} V{oy + VC}"/>',
        f'<path class="gr dash" d="M{ox + VR},{oy} V{ey} M{ox},{ey} H{ox + VR}"/>',
        f'<path class="c2" d="M{ox},{oy} L{ex},{ey}"/>',
        f'<circle cx="{ex}" cy="{ey}" r="3.5" class="fInk"/>',
        f'<text x="{ox + 6}" y="{oy + 18}" class="t-acc">$\\Delta V_R$ (전류 $I$와 같은 위상)</text>',
        f'<text x="{ox + 8}" y="{oy - VL + 4}" class="t-warm">$\\Delta V_L$ ($I$보다 $90^\\circ$ 앞섬)</text>',
        f'<text x="{ox + 8}" y="{oy + VC + 4}" class="t-warn">$\\Delta V_C$ ($I$보다 $90^\\circ$ 뒤짐)</text>',
        f'<text x="{ex + 8}" y="{ey - 2}" class="t-ink">$\\Delta V_{{max}}$</text>',
        f'<text x="{ox + 38}" y="{oy - 10}" class="t-ink">$\\phi \\approx {phi:.0f}^\\circ$</text>',
        f'<path class="c2" d="M{ox + 30},{oy} A30,30 0 0 0 {ox + 30 * math.cos(math.radians(phi)):.1f},{oy - 30 * math.sin(math.radians(phi)):.1f}"/>',
    ]
    return svg(w, h, "\n".join(inner), "RLC 직렬 회로의 위상자 도표")


def resonance():
    p = Plot(460, 240, (0.4, 1.6), (0, 1.08), pad=(44, 14, 14, 36))
    inner = [p.axes("$\\omega/\\omega_0$", "$I/I_{max}$")]
    labels = []
    for Q, cls in ((10, "c1"), (4, "c3"), (2, "c2")):
        f = lambda x, Q=Q: 1 / math.sqrt(1 + Q * Q * (x - 1 / x) ** 2)
        inner.append(p.curve(f, cls=cls, n=500))
        labels.append((Q, cls))
    inner.append(f'<path class="ax dash" d="M{p.X(1):.0f},{p.Y(0):.0f} V{p.Y(1.04):.0f}"/>')
    inner.append(f'<text x="{p.X(1):.0f}" y="{p.h - 18}" text-anchor="middle">1</text>')
    y = 44
    for Q, cls in labels:
        tcls = {"c1": "t-acc", "c3": "t-warm", "c2": "t-ink"}[cls]
        inner.append(f'<text x="{p.X(0.44):.0f}" y="{y}" class="{tcls}">$Q = {Q}$</text>')
        y += 18
    return p.svg("\n".join(inner), "RLC 직렬 회로의 공진 곡선, Q 인자 10, 4, 2")


def emwave():
    w, h = 480, 230
    x0, y0, L = 40, 120, 420
    k = 2 * math.pi / 200
    E = [(x0 + x, y0 - 70 * math.sin(k * x)) for x in range(0, L + 1, 3)]
    # B 는 z 방향: 비스듬한 투영(오른쪽 아래 30°)
    B = [(x0 + x + 40 * math.sin(k * x) * 0.8, y0 + 40 * math.sin(k * x) * 0.55) for x in range(0, L + 1, 3)]
    inner = [f'<path class="ax" d="M{x0},{y0} H{x0 + L + 10}"/>',
             f'<text x="{x0 + L + 4}" y="{y0 + 96}" text-anchor="end">$x$ (진행 방향)</text>',
             f'<path class="c1" d="{_path(E)}"/>',
             f'<path class="c3" d="{_path(B)}"/>']
    for x in range(0, L + 1, 20):
        inner.append(f'<path class="gr" d="M{x0 + x},{y0} V{y0 - 70 * math.sin(k * x):.1f}"/>')
    inner += [f'<text x="{x0 + 52}" y="{y0 - 76}" class="t-acc">$\\vec E$ ($y$ 방향)</text>',
              f'<text x="{x0 + 4}" y="{y0 + 46}" class="t-warm">$\\vec B$ ($z$ 방향)</text>',
              f'<text x="{x0 + 250}" y="{y0 - 82}" class="t-ink">$\\vec E \\perp \\vec B \\perp$ 진행 방향, $E = cB$</text>']
    return svg(w, h, "\n".join(inner), "진행하는 평면 전자기파의 전기장과 자기장")


# ---------------------------------------------------------------- 광학
def _ray(points, cls="c1"):
    return f'<path class="{cls}" d="{_path(points)}"/>'


def lens():
    w, h = 500, 240
    cx, ay, f = 230, 130, 70
    s, ho = 110, 34
    si = 1 / (1 / f - 1 / s)
    hi = -ho * si / s
    ox, ix = cx - s, cx + si
    inner = [f'<path class="ax" d="M10,{ay} H{w - 10}"/>',
             f'<path class="c2" d="M{cx},{ay - 92} Q{cx + 16},{ay} {cx},{ay + 92} Q{cx - 16},{ay} {cx},{ay - 92} Z" style="fill:var(--accent-soft)"/>',
             f'<path class="c2" d="M{ox},{ay} V{ay - ho}"/>',
             f'<path class="fInk" d="M{ox - 5},{ay - ho + 8} L{ox},{ay - ho} L{ox + 5},{ay - ho + 8} Z"/>',
             f'<path class="c4" d="M{ix:.1f},{ay} V{ay - hi:.1f}"/>',
             f'<path class="fW" d="M{ix - 5:.1f},{ay - hi - 8:.1f} L{ix:.1f},{ay - hi:.1f} L{ix + 5:.1f},{ay - hi - 8:.1f} Z" style="fill:var(--warn)"/>']
    for fx, lab in ((cx - f, "$F$"), (cx + f, "$F'$")):
        inner.append(f'<circle cx="{fx}" cy="{ay}" r="3" class="fInk"/>')
        inner.append(f'<text x="{fx}" y="{ay + 18}" text-anchor="middle" class="t-ink">{lab}</text>')
    top = ay - ho
    # 1) 평행 → F′
    k1 = (ay - hi - top) / (ix - cx)
    inner.append(_ray([(ox, top), (cx, top), (ix + 40, top + k1 * (ix + 40 - cx))]))
    # 2) 중심 통과
    slope = (ay - hi - top) / (ix - ox)
    inner.append(_ray([(ox, top), (ix + 40, top + slope * (ix + 40 - ox))], cls="c3"))
    # 3) F 통과 → 평행
    yl = top + (ay - top) / (cx - f - ox) * (cx - ox) if cx - f != ox else ay
    inner.append(_ray([(ox, top), (cx, yl), (ix + 40, yl)], cls="c2"))
    inner += [f'<text x="{ox}" y="{top - 10}" text-anchor="middle">물체 ($p = {s / f:.2g}f$)</text>',
              f'<text x="{ix:.0f}" y="{ay - hi + 26:.0f}" text-anchor="middle" class="t-warn">실상 (거꾸로, $m = {-si / s:.1f}$)</text>']
    return svg(w, h, "\n".join(inner), "볼록 렌즈의 상 작도: 세 광선")


def mirror():
    w, h = 500, 240
    mx, ay, f = 430, 120, 80
    R = 2 * f
    s, ho = 1.6 * f, 40
    si = 1 / (1 / f - 1 / s)
    hi = -ho * si / s
    ox, ix = mx - s, mx - si
    top = ay - ho
    # 거울 곡면(반지름 R, 중심 C = mx − R)
    arc = [(mx - R + R * math.cos(t), ay + R * math.sin(t)) for t in [math.radians(a) for a in range(-38, 39, 2)]]
    inner = [f'<path class="ax" d="M10,{ay} H{mx + 20}"/>',
             f'<path class="c2" d="{_path(arc)}" style="stroke-width:3"/>',
             f'<path class="c2" d="M{ox},{ay} V{top}"/>',
             f'<path class="fInk" d="M{ox - 5},{top + 8} L{ox},{top} L{ox + 5},{top + 8} Z"/>',
             f'<path class="c4" d="M{ix:.1f},{ay} V{ay - hi:.1f}"/>']
    for px, lab in ((mx - f, "$F$"), (mx - R, "$C$")):
        inner.append(f'<circle cx="{px}" cy="{ay}" r="3" class="fInk"/>')
        inner.append(f'<text x="{px}" y="{ay - 8}" text-anchor="middle" class="t-ink">{lab}</text>')
    ytip = ay - hi
    # 1) 평행 → F 를 지나 반사
    k1 = (ytip - top) / (ix - mx)
    inner.append(_ray([(ox, top), (mx, top), (ix - 30, top + k1 * (ix - 30 - mx))]))
    # 2) F 를 지나 → 평행으로 반사
    yF = top + (ay - top) / ((mx - f) - ox) * (mx - ox)
    inner.append(_ray([(ox, top), (mx, yF), (ix - 30, yF)], cls="c3"))
    # 3) 꼭짓점으로 입사 → 광축에 대칭으로 반사
    kv = (ay - top) / (mx - ox)
    inner.append(_ray([(ox, top), (mx, ay), (ix - 30, ay + kv * (mx - (ix - 30)))], cls="c2"))
    inner += [f'<text x="{ox:.0f}" y="{top - 8:.0f}" text-anchor="middle">물체 ($p = 1.6f$)</text>',
              f'<text x="{ix:.0f}" y="{ytip + 20:.0f}" text-anchor="middle" class="t-warn">실상 ($m = {-si / s:.2f}$)</text>']
    return svg(w, h, "\n".join(inner), "오목 거울의 상 작도: 세 광선")


def slits():
    p = Plot(480, 230, (-3.2, 3.2), (0, 1.1), pad=(36, 14, 14, 36))

    def single(u):  # u = a sinθ / λ
        return 1.0 if abs(u) < 1e-9 else (math.sin(math.pi * u) / (math.pi * u)) ** 2

    d_over_a = 4
    two = lambda u: single(u) * math.cos(math.pi * d_over_a * u) ** 2
    inner = [p.axes("$a\\sin\\theta/\\lambda$", "$I$"), p.curve(two, n=1600), p.curve(single, cls="c3 dash", n=600)]
    for u in (-3, -2, -1, 1, 2, 3):
        inner.append(f'<text x="{p.X(u):.0f}" y="{p.h - 18}" text-anchor="middle">{u}</text>')
    inner += [f'<text x="{p.X(1.15):.0f}" y="{p.Y(0.78):.0f}" class="t-warm">단일 슬릿 회절 포락선</text>',
              f'<text x="{p.X(1.15):.0f}" y="{p.Y(0.62):.0f}" class="t-acc">이중 슬릿 ($d = 4a$)</text>',
              f'<text x="{p.X(1.15):.0f}" y="{p.Y(0.48):.0f}">4번째 밝은 무늬가 사라진다</text>']
    return p.svg("\n".join(inner), "이중 슬릿 간섭 무늬와 단일 슬릿 회절 포락선")


def grating():
    p = Plot(480, 220, (-1.25, 1.25), (0, 1.08), pad=(36, 14, 14, 36))

    def g(u, N):
        b = math.pi * u
        if abs(math.sin(b)) < 1e-9:
            return 1.0
        return (math.sin(N * b) / (N * math.sin(b))) ** 2
    inner = [p.axes("$d\\sin\\theta/\\lambda$", "$I/I_{max}$"),
             p.curve(lambda u: g(u, 2), cls="c3", n=1200),
             p.curve(lambda u: g(u, 8), cls="c1", n=1600)]
    for u in (-1, 0, 1):
        inner.append(f'<text x="{p.X(u):.0f}" y="{p.h - 18}" text-anchor="middle">$m = {u}$</text>')
    inner += [f'<text x="{p.X(-0.62):.0f}" y="{p.t - 6}" class="t-warm">$N = 2$</text>',
              f'<text x="{p.X(0.2):.0f}" y="{p.t - 6}" class="t-acc">$N = 8$: 극대가 날카롭다</text>']
    return p.svg("\n".join(inner), "슬릿 수 N이 2와 8일 때 회절격자의 세기 분포")


# ---------------------------------------------------------------- 현대 물리
def blackbody():
    h, c, k = 6.626e-34, 2.998e8, 1.381e-23

    def B(lam_nm, T):
        lam = lam_nm * 1e-9
        return 2 * h * c * c / lam ** 5 / (math.exp(h * c / (lam * k * T)) - 1)
    peak = B(2.898e-3 / 5000 * 1e9, 5000)
    p = Plot(480, 240, (100, 3000), (0, 1.1), pad=(36, 14, 14, 36))
    inner = [p.axes("$\\lambda$ (nm)", "세기")]
    p.y1 = 1.1
    for i, (T, cls, tc) in enumerate(((5000, "c1", "t-acc"), (4000, "c3", "t-warm"), (3000, "c2", "t-ink"))):
        inner.append(p.curve(lambda l, T=T: B(l, T) / peak, cls=cls, n=500))
        lm = 2.898e-3 / T * 1e9
        inner.append(f'<circle cx="{p.X(lm):.1f}" cy="{p.Y(B(lm, T) / peak):.1f}" r="3" class="fInk"/>')
        # 범례는 곡선이 없는 오른쪽 위에 모은다
        inner.append(f'<text x="{p.X(1550):.0f}" y="{p.Y(1.0 - 0.13 * i):.0f}" class="{tc}">{T} K · $\\lambda_{{max}} \\approx {lm:.0f}$ nm</text>')
    inner.append(f'<path class="fA" d="M{p.X(380):.1f},{p.Y(0):.1f} H{p.X(750):.1f} V{p.Y(1.1):.1f} H{p.X(380):.1f} Z"/>')
    inner.append(f'<text x="{p.X(565):.0f}" y="{p.h - 18}" text-anchor="middle" class="t-acc">가시광</text>')
    for lv in (1000, 2000):
        inner.append(f'<text x="{p.X(lv):.0f}" y="{p.h - 18}" text-anchor="middle">{lv}</text>')
    return p.svg("\n".join(inner), "온도 3000 K, 4000 K, 5000 K 흑체의 복사 스펙트럼과 빈 변위 법칙")


def hlevels():
    w, h = 460, 270
    top, bot = 26, 250
    Emin = -13.6

    def Y(E):
        return top + (E - 0) / (Emin - 0) * (bot - top)
    inner = []
    for n in range(1, 7):
        E = -13.6 / n ** 2
        y = Y(E)
        inner.append(f'<path class="c2" d="M120,{y:.1f} H440"/>')
        if n <= 3:
            inner.append(f'<text x="112" y="{y + 4:.1f}" text-anchor="end">$n = {n}$ (${E:.2f}$ eV)</text>')
    inner.append(f'<path class="c2 dash" d="M120,{Y(0):.1f} H440"/>')
    inner.append(f'<text x="112" y="{Y(0) + 4:.1f}" text-anchor="end">$n = \\infty$ (0 eV)</text>')
    series = (("라이먼 (자외선)", 1, 150, "c4", "t-warn"), ("발머 (가시광)", 2, 280, "c1", "t-acc"), ("파셴 (적외선)", 3, 390, "c3", "t-warm"))
    for name, nf, x0, cls, tcls in series:
        for i, ni in enumerate(range(nf + 1, nf + 4)):
            x = x0 + i * 16
            y1, y2 = Y(-13.6 / ni ** 2), Y(-13.6 / nf ** 2)
            inner.append(f'<path class="{cls}" d="M{x},{y1:.1f} V{y2 - 6:.1f}"/>')
            inner.append(f'<path d="M{x - 4},{y2 - 8:.1f} L{x},{y2:.1f} L{x + 4},{y2 - 8:.1f} Z" style="fill:var(--{ {"c4": "warn", "c1": "accent", "c3": "warm"}[cls] })"/>')
        inner.append(f'<text x="{x0 + 16}" y="{Y(-13.6 / nf ** 2) + 16:.1f}" text-anchor="middle" class="{tcls}">{name}</text>')
    return svg(w, h, "\n".join(inner), "수소 원자의 에너지 준위와 라이먼, 발머, 파셴 계열")


def box():
    w, h = 460, 260
    xl, xr, base = 90, 330, 240
    sc = 22  # 에너지 n² 단위 1당 픽셀
    inner = [f'<path class="c2" d="M{xl},18 V{base} H{xr} V18" style="stroke-width:2.4"/>',
             f'<path class="fW" d="M{xl - 22},18 H{xl} V{base} H{xl - 22} Z"/>',
             f'<path class="fW" d="M{xr},18 H{xr + 22} V{base} H{xr} Z"/>',
             f'<text x="{xl}" y="{base + 16}" text-anchor="middle">0</text>',
             f'<text x="{xr}" y="{base + 16}" text-anchor="middle">$L$</text>',
             f'<text x="{xl - 11}" y="34" text-anchor="middle" class="t-warn">$\\infty$</text>',
             f'<text x="{xr + 11}" y="34" text-anchor="middle" class="t-warn">$\\infty$</text>']
    for n, cls in ((1, "c1"), (2, "c3"), (3, "c4")):
        y0 = base - 14 - sc * n * n
        inner.append(f'<path class="gr dash" d="M{xl},{y0} H{xr}"/>')
        pts = [(xl + (xr - xl) * i / 200, y0 - 18 * math.sin(n * math.pi * i / 200)) for i in range(201)]
        inner.append(f'<path class="{cls}" d="{_path(pts)}"/>')
        inner.append(f'<text x="{xr + 28}" y="{y0 + 4}">$n = {n},\\ E = {'' if n == 1 else n * n}E_1$</text>')
    return svg(w, h, "\n".join(inner), "1차원 무한 퍼텐셜 상자 속 입자의 파동 함수 n = 1, 2, 3")


def tunnel():
    w, h = 480, 200
    y0 = 120
    xa, xb = 200, 270
    kap = 0.028
    lam = 60
    A = 40
    left = [(x, y0 - A * math.sin(2 * math.pi * x / lam)) for x in range(20, xa + 1, 2)]
    ph = 2 * math.pi * xa / lam
    y_a = A * math.sin(ph)
    mid = [(x, y0 - y_a * math.exp(-kap * (x - xa))) for x in range(xa, xb + 1, 2)]
    At = abs(y_a) * math.exp(-kap * (xb - xa))
    right = [(x, y0 - math.copysign(At, y_a) * math.cos(2 * math.pi * (x - xb) / lam)) for x in range(xb, 461, 2)]
    inner = [f'<path class="fW" d="M{xa},30 H{xb} V{y0 + 60} H{xa} Z"/>',
             f'<path class="ax" d="M10,{y0} H470"/>',
             f'<path class="c1" d="{_path(left)}"/>',
             f'<path class="c4" d="{_path(mid)}"/>',
             f'<path class="c1" d="{_path(right)}"/>',
             f'<text x="{(xa + xb) / 2}" y="24" text-anchor="middle" class="t-warn">장벽 $U \\gt E$</text>',
             f'<text x="60" y="{y0 + 62}">입사 + 반사</text>',
             f'<text x="{xb + 40}" y="{y0 + 62}">투과 (진폭 작음)</text>',
             f'<text x="{(xa + xb) / 2}" y="{y0 + 78}" text-anchor="middle">지수 감소 $e^{{-\\kappa x}}$</text>']
    return svg(w, h, "\n".join(inner), "퍼텐셜 장벽을 지나는 파동 함수의 터널 효과")


def bands():
    w, h = 480, 240
    inner = []
    cols = (("도체", 30, (50, 120), (100, 200), True), ("반도체", 185, (40, 92), (124, 200), False), ("절연체", 340, (30, 62), (160, 200), False))
    for name, x, cb, vb, overlap in cols:
        bw = 110
        # 전도띠 (위), 원자가띠 (아래); y 는 위로 갈수록 에너지 큼
        inner.append(f'<path class="c2" d="M{x},{cb[0]} H{x + bw} V{cb[1]} H{x} Z" style="fill:var(--paper)"/>')
        inner.append(f'<path class="c2" d="M{x},{vb[0]} H{x + bw} V{vb[1]} H{x} Z" style="fill:var(--accent-soft)"/>')
        if overlap:
            inner.append(f'<path class="fA" d="M{x},{cb[1] - 26} H{x + bw} V{cb[1]} H{x} Z" style="fill:var(--accent-soft)"/>')
            inner.append(f'<text x="{x + bw / 2}" y="{cb[1] - 32}" text-anchor="middle" class="t-acc">일부만 채워짐</text>')
        else:
            gap = vb[0] - cb[1]
            inner.append(f'<path class="ax dash" d="M{x + bw / 2},{cb[1]} V{vb[0]}"/>')
            inner.append(f'<text x="{x + bw / 2 + 6}" y="{cb[1] + gap / 2 + 4}" class="t-warn">띠틈 $E_g$</text>')
        inner.append(f'<text x="{x + bw / 2}" y="{cb[0] + 16}" text-anchor="middle">전도띠</text>')
        inner.append(f'<text x="{x + bw / 2}" y="{vb[1] - 10}" text-anchor="middle" class="t-acc">원자가띠</text>')
        inner.append(f'<text x="{x + bw / 2}" y="228" text-anchor="middle" class="t-ink">{name}</text>')
    inner.append('<path class="ax" d="M14,210 V22"/><text x="18" y="18">에너지</text>')
    return svg(w, h, "\n".join(inner), "도체, 반도체, 절연체의 에너지 띠 구조 비교")


def twin():
    p = Plot(400, 280, (-2, 22), (0, 44), pad=(40, 14, 14, 30))
    turn = (19, 21.05)
    inner = [p.axes("$x$ (광년)", "$ct$ (년)"),
             f'<path class="c2" d="M{p.X(0):.1f},{p.Y(0):.1f} V{p.Y(42.1):.1f}"/>',
             f'<path class="c1" d="M{p.X(0):.1f},{p.Y(0):.1f} L{p.X(turn[0]):.1f},{p.Y(turn[1]):.1f} L{p.X(0):.1f},{p.Y(42.1):.1f}"/>',
             f'<path class="gr dash" d="M{p.X(0):.1f},{p.Y(0):.1f} L{p.X(14):.1f},{p.Y(14):.1f}"/>',
             f'<text x="{p.X(14) + 4:.0f}" y="{p.Y(11):.0f}">빛 ($45^\\circ$)</text>',
             f'<text x="{p.X(1.5):.0f}" y="{p.Y(41.0):.0f}" class="t-ink">A (지구): 42.1년</text>',
             f'<text x="{p.X(12):.0f}" y="{p.Y(4):.0f}" class="t-acc">B ($0.95c$): 13.1년</text>',
             f'<text x="{p.X(16.3):.0f}" y="{p.Y(21) + 4:.0f}" text-anchor="end">관성계가 바뀜 →</text>']
    return p.svg("\n".join(inner), "쌍둥이 역설의 시공간 도표")



# ---------------------------------------------------------------- 조각으로 나누어 더하기 (구분구적)
_COL = {"c1": "var(--accent)", "c2": "var(--ink)", "c3": "var(--warm)", "c4": "var(--warn)", "ax": "var(--muted)"}


def _arrow(x1, y1, x2, y2, cls="c2", head=8, dash=False):
    """화살표: 선과 삼각형 머리. 색은 cls 의 선 색을 따른다."""
    ang = math.atan2(y2 - y1, x2 - x1)
    bx, by = x2 - head * math.cos(ang), y2 - head * math.sin(ang)
    px, py = -math.sin(ang) * head * 0.42, math.cos(ang) * head * 0.42
    c = cls + (" dash" if dash else "")
    return (f'<path class="{c}" d="M{x1:.1f},{y1:.1f} L{bx:.1f},{by:.1f}"/>'
            f'<path d="M{x2:.1f},{y2:.1f} L{bx + px:.1f},{by + py:.1f} L{bx - px:.1f},{by - py:.1f} Z" '
            f'style="fill:{_COL[cls]}"/>')


def _arc(cx, cy, r, a0, a1, cls="ax"):
    """각 표시용 호. 각은 도 단위, 반시계가 양(화면에서는 위쪽)."""
    x0, y0 = cx + r * math.cos(math.radians(a0)), cy - r * math.sin(math.radians(a0))
    x1, y1 = cx + r * math.cos(math.radians(a1)), cy - r * math.sin(math.radians(a1))
    sweep = 0 if a1 > a0 else 1
    return f'<path class="{cls}" d="M{x0:.1f},{y0:.1f} A{r},{r} 0 0 {sweep} {x1:.1f},{y1:.1f}"/>'


def ring_field(kind):
    """고리의 한 조각이 축 위의 점 P에 만드는 장. kind='E' 는 전하 고리, 'B' 는 전류 고리."""
    w, h = 400, 290
    cx, cy, ry = 95, 150, 92
    px = 245
    top, bot = (cx, cy - ry), (cx, cy + ry)
    d = math.hypot(px - cx, ry)
    ux, uy = (px - cx) / d, ry / d            # 위 조각 → P 방향 (화면 좌표)
    L = 60
    inner = [_arrow(24, cy, 388, cy, "ax", head=7),
             f'<text x="386" y="{cy + 18}" text-anchor="end">축</text>',
             f'<ellipse class="c2" cx="{cx}" cy="{cy}" rx="26" ry="{ry}" style="stroke-width:3"/>',
             f'<path class="ax" d="M{cx},{cy} L{top[0]},{top[1]}"/>',
             f'<text x="{cx - 8}" y="{cy - ry / 2 + 4:.0f}" text-anchor="end" class="t-ink">$R$</text>',
             f'<path class="c2 dash" d="M{top[0]},{top[1]} L{px},{cy}" style="stroke-width:1.2"/>',
             f'<text x="{(cx + px) / 2 + 6:.0f}" y="{cy - ry / 2 - 10:.0f}" class="t-ink">$\\sqrt{{R^2 + z^2}}$</text>',
             f'<text x="{(cx + px) / 2:.0f}" y="{cy + 18}" text-anchor="middle" class="t-ink">$z$</text>',
             f'<circle cx="{px}" cy="{cy}" r="3.5" class="fInk"/>',
             f'<text x="{px - 4}" y="{cy + 18}" text-anchor="end" class="t-ink">P</text>']
    if kind == "E":
        tip = (px + L * ux, cy + L * uy)
        tip2 = (px + L * ux, cy - L * uy)
        ang = math.degrees(math.atan2(ry, cx - px))       # P 에서 위 조각을 보는 방향
        inner += [f'<circle cx="{top[0]}" cy="{top[1]}" r="5" class="fAcc"/>',
                  f'<circle cx="{bot[0]}" cy="{bot[1]}" r="4.5" class="ax" style="fill:var(--paper)"/>',
                  f'<text x="{cx}" y="{top[1] - 12}" text-anchor="middle" class="t-acc">$dq$</text>',
                  f'<text x="{cx + 12}" y="{bot[1] + 16}" class="">맞은편 조각</text>',
                  _arrow(px, cy, tip2[0], tip2[1], "ax", dash=True),
                  _arrow(px, cy, tip[0], tip[1], "c3"),
                  f'<path class="c3 dash" d="M{tip[0]:.1f},{cy} V{tip[1]:.1f}" style="stroke-width:1.2"/>',
                  _arrow(px, cy, tip[0], cy, "c1"),
                  f'<text x="{tip[0] + 6:.0f}" y="{tip[1] + 6:.0f}" class="t-warm">$d\\vec E$</text>',
                  f'<text x="{tip[0] + 6:.0f}" y="{cy + 4}" class="t-acc">$dE_z$</text>',
                  _arc(px, cy, 34, ang, 180),
                  f'<text x="{px - 40}" y="{cy - 7}" text-anchor="end" class="t-ink">$\\alpha$</text>']
        label = "고르게 대전된 고리의 한 조각 dq 가 축 위의 점 P에 만드는 전기장과 그 축 성분"
    else:
        vx, vy = uy, -ux                                   # r 에 수직, 위·오른쪽
        tip = (px + L * vx, cy + L * vy)
        tip2 = (px + L * vx, cy - L * vy)
        q = 9
        r1 = (px - q * ux, cy - q * uy)
        inner += [f'<circle cx="{top[0]}" cy="{top[1]}" r="7" class="c1" style="fill:var(--paper)"/>',
                  f'<circle cx="{top[0]}" cy="{top[1]}" r="2.2" class="fAcc"/>',
                  f'<circle cx="{bot[0]}" cy="{bot[1]}" r="7" class="ax" style="fill:var(--paper)"/>',
                  f'<path class="ax" d="M{bot[0] - 4.5},{bot[1] - 4.5} l9,9 M{bot[0] + 4.5},{bot[1] - 4.5} l-9,9"/>',
                  f'<text x="{cx}" y="{top[1] - 14}" text-anchor="middle" class="t-acc">$I\\,d\\vec l$</text>',
                  f'<text x="{cx + 14}" y="{bot[1] + 16}">맞은편 요소</text>',
                  _arrow(px, cy, tip2[0], tip2[1], "ax", dash=True),
                  _arrow(px, cy, tip[0], tip[1], "c3"),
                  f'<path class="c3 dash" d="M{tip[0]:.1f},{cy} V{tip[1]:.1f}" style="stroke-width:1.2"/>',
                  _arrow(px, cy, tip[0], cy, "c1"),
                  f'<path class="ax" d="M{r1[0]:.1f},{r1[1]:.1f} l{q * vx:.1f},{q * vy:.1f} l{q * ux:.1f},{q * uy:.1f}"/>',
                  f'<text x="{tip[0] + 6:.0f}" y="{tip[1] + 4:.0f}" class="t-warm">$d\\vec B \\perp \\hat r$</text>',
                  f'<text x="{tip[0] + 6:.0f}" y="{cy + 18}" class="t-acc">$dB_z$</text>']
        label = "원형 전류 고리의 전류 요소가 축 위의 점 P에 만드는 자기장과 그 축 성분"
    return svg(w, h, "\n".join(inner), label)


def disk_rings():
    """원판을 반지름 r, 폭 dr 인 고리로 쪼갠다."""
    w, h = 400, 290
    cx, cy, R, k = 100, 150, 104, 0.3       # k: 원근으로 눌린 비율
    r0, r1 = 58, 70
    px = 285

    def ell(r):
        return f"M{cx},{cy - r} A{r * k:.1f},{r} 0 1 1 {cx},{cy + r} A{r * k:.1f},{r} 0 1 1 {cx},{cy - r} Z"
    inner = [f'<ellipse class="fA" cx="{cx}" cy="{cy}" rx="{R * k:.1f}" ry="{R}"/>',
             f'<path d="{ell(r1)} {ell(r0)}" fill-rule="evenodd" style="fill:var(--accent);opacity:0.55"/>',
             f'<ellipse class="c2" cx="{cx}" cy="{cy}" rx="{R * k:.1f}" ry="{R}"/>',
             _arrow(24, cy, 388, cy, "ax", head=7),
             f'<text x="386" y="{cy + 18}" text-anchor="end">축</text>',
             f'<path class="ax" d="M{cx},{cy} V{cy - r0}"/>',
             f'<text x="{cx - 7}" y="{cy - r0 / 2 + 4:.0f}" text-anchor="end" class="t-ink">$r$</text>',
             f'<path class="ax" d="M{cx},{cy} V{cy + R}" stroke-dasharray="3 3"/>',
             f'<text x="{cx - 7}" y="{cy + R / 2 + 8:.0f}" text-anchor="end" class="t-ink">$R$</text>',
             f'<path class="c1" d="M{cx + 30},{cy - r1} h14 M{cx + 30},{cy - r0} h14" style="stroke-width:1.2"/>',
             f'<text x="{cx + 49}" y="{cy - (r0 + r1) / 2 + 5:.0f}" class="t-acc">$dr$</text>',
             f'<path class="c2 dash" d="M{cx},{cy - (r0 + r1) / 2:.0f} L{px},{cy}" style="stroke-width:1.2"/>',
             f'<text x="{(cx + px) / 2 + 14:.0f}" y="{cy - (r0 + r1) / 4 - 10:.0f}" class="t-ink">$\\sqrt{{r^2 + z^2}}$</text>',
             f'<text x="{(cx + px) / 2 + 10:.0f}" y="{cy + 18}" text-anchor="middle" class="t-ink">$z$</text>',
             f'<circle cx="{px}" cy="{cy}" r="3.5" class="fInk"/>',
             f'<text x="{px - 4}" y="{cy + 18}" text-anchor="end" class="t-ink">P</text>',
             _arrow(px, cy, px + 58, cy, "c1"),
             f'<text x="{px + 30}" y="{cy - 10}" text-anchor="middle" class="t-acc">$dE_z$</text>',
             f'<text x="{cx + 62}" y="34" class="t-acc">고리 하나: $dq = \\sigma\\,(2\\pi r\\,dr)$</text>']
    return svg(w, h, "\n".join(inner), "원판을 반지름 r, 폭 dr 인 고리들로 쪼개 축 위의 점 P의 전기장을 더하는 그림")


def biot_wire():
    """직선 도선의 전류 요소가 점 P에 만드는 자기장."""
    w, h = 400, 270
    wy, ox, s = 205, 150, 130
    ex = 290
    py = wy - s
    th = math.degrees(math.atan2(ex - ox, s))
    inner = [f'<path class="c2" d="M20,{wy} H380" style="stroke-width:3.2"/>',
             _arrow(30, wy - 14, 80, wy - 14, "c2", head=7),
             f'<text x="55" y="{wy - 22}" text-anchor="middle" class="t-ink">$I$</text>',
             f'<path class="c1" d="M{ex - 12},{wy} H{ex + 12}" style="stroke-width:6"/>',
             f'<text x="{ex}" y="{wy + 20}" text-anchor="middle" class="t-acc">$dx$</text>',
             f'<path class="ax" d="M{ox},{wy} V{py}" stroke-dasharray="3 3"/>',
             f'<text x="{ox - 8}" y="{(wy + py) / 2 + 14:.0f}" text-anchor="end" class="t-ink">$s$</text>',
             f'<path class="ax" d="M{ox},{wy + 30} H{ex} M{ox},{wy + 25} v10 M{ex},{wy + 25} v10"/>',
             f'<text x="{(ox + ex) / 2:.0f}" y="{wy + 48}" text-anchor="middle" class="t-ink">$x = s\\tan\\theta$</text>',
             f'<path class="c2 dash" d="M{ex},{wy} L{ox},{py}" style="stroke-width:1.2"/>',
             f'<text x="{(ox + ex) / 2 + 10:.0f}" y="{(wy + py) / 2 - 8:.0f}" class="t-ink">$r = \\sqrt{{x^2 + s^2}}$</text>',
             _arc(ox, py, 36, -90, -90 + th),
             f'<text x="{ox + 14}" y="{py + 54}" class="t-ink">$\\theta$</text>',
             f'<circle cx="{ox}" cy="{py}" r="8" class="c3" style="fill:var(--paper)"/>',
             f'<circle cx="{ox}" cy="{py}" r="2.6" style="fill:var(--warm)"/>',
             f'<text x="{ox - 14}" y="{py + 4}" text-anchor="end" class="t-ink">P</text>',
             f'<text x="{ox + 16}" y="{py - 6}" class="t-warm">$d\\vec B$: 지면에서 나오는 방향</text>']
    return svg(w, h, "\n".join(inner), "직선 도선의 전류 요소 dx 가 거리 s 인 점 P에 만드는 자기장의 기하")


def inertia_slices():
    """회전 관성: 원판은 고리로, 구는 얇은 원판으로 쪼갠다."""
    w, h = 400, 280
    R = 78
    c1x, c2x, cy = 100, 300, 128
    r0, r1 = 42, 52
    z = 34
    rz = math.sqrt(R * R - z * z)
    inner = [  # 원판 (위에서 본 모습): 축은 중심을 지나 지면에 수직
        f'<circle class="fA" cx="{c1x}" cy="{cy}" r="{R}"/>',
        f'<path d="M{c1x - r1},{cy} a{r1},{r1} 0 1 0 {2 * r1},0 a{r1},{r1} 0 1 0 {-2 * r1},0 Z '
        f'M{c1x - r0},{cy} a{r0},{r0} 0 1 0 {2 * r0},0 a{r0},{r0} 0 1 0 {-2 * r0},0 Z" fill-rule="evenodd" style="fill:var(--accent);opacity:0.55"/>',
        f'<circle class="c2" cx="{c1x}" cy="{cy}" r="{R}"/>',
        f'<circle cx="{c1x}" cy="{cy}" r="3.5" class="fInk"/>',
        f'<text x="{c1x - 8}" y="{cy + 16}" text-anchor="end">축</text>',
        f'<path class="ax" d="M{c1x},{cy} L{c1x + r0 * 0.766:.1f},{cy - r0 * 0.643:.1f}"/>',
        f'<text x="{c1x + 12}" y="{cy - 20}" class="t-ink">$r$</text>',
        f'<path class="c1" d="M{c1x + r0},{cy} h{r1 - r0}" style="stroke-width:1.4"/>',
        f'<text x="{c1x + r1 + 3}" y="{cy + 16}" class="t-acc">$dr$</text>',
        f'<path class="ax" d="M{c1x},{cy} L{c1x - R * 0.5:.1f},{cy + R * 0.866:.1f}" stroke-dasharray="3 3"/>',
        f'<text x="{c1x - R * 0.25 - 8:.0f}" y="{cy + R * 0.5:.0f}" text-anchor="end" class="t-ink">$R$</text>',
        f'<text x="{c1x}" y="{cy + R + 26}" text-anchor="middle" class="t-ink">원판 → 고리</text>',
        f'<text x="{c1x}" y="{cy + R + 48}" text-anchor="middle" class="t-acc">$dm = \\sigma\\,2\\pi r\\,dr$</text>',
        # 구 (옆에서 본 모습): 축은 세로
        f'<circle class="fA" cx="{c2x}" cy="{cy}" r="{R}"/>',
        f'<ellipse cx="{c2x}" cy="{cy - z}" rx="{rz:.1f}" ry="9" style="fill:var(--accent);opacity:0.55"/>',
        f'<ellipse class="c1" cx="{c2x}" cy="{cy - z}" rx="{rz:.1f}" ry="9" style="stroke-width:1.4"/>',
        f'<circle class="c2" cx="{c2x}" cy="{cy}" r="{R}"/>',
        f'<path class="ax" d="M{c2x},{cy - R - 16} V{cy + R + 8}" stroke-dasharray="8 3 2 3"/>',
        f'<text x="{c2x + 6}" y="{cy - R - 6}">축</text>',
        f'<circle cx="{c2x}" cy="{cy}" r="3" class="fInk"/>',
        f'<text x="{c2x - 6}" y="{cy - z / 2 + 6:.0f}" text-anchor="end" class="t-ink">$z$</text>',
        f'<path class="ax" d="M{c2x},{cy} L{c2x + rz:.1f},{cy - z}"/>',
        f'<text x="{c2x + rz / 2 + 4:.0f}" y="{cy - z / 2 + 16:.0f}" class="t-ink">$R$</text>',
        f'<text x="{c2x}" y="{cy + 44}" text-anchor="middle" class="t-ink">조각의 반지름 $\\sqrt{{R^2 - z^2}}$</text>',
        f'<text x="{c2x + rz + 6:.0f}" y="{cy - z + 5}" class="t-acc">$dz$</text>',
        f'<text x="{c2x}" y="{cy + R + 26}" text-anchor="middle" class="t-ink">구 → 얇은 원판</text>',
        f'<text x="{c2x}" y="{cy + R + 48}" text-anchor="middle" class="t-acc">$dm = \\rho\\,\\pi(R^2 - z^2)\\,dz$</text>']
    return svg(w, h, "\n".join(inner), "회전 관성을 구할 때 원판은 고리로, 구는 얇은 원판으로 쪼개는 그림")


def cm_slices():
    """질량 중심: 막대는 dx, 반원 고리는 dθ, 반원판은 r dr dθ 조각으로."""
    w, h = 400, 290
    inner = []
    # 막대: 오른쪽으로 갈수록 무겁다 (선밀도 ∝ x)
    x0, x1, ry = 30, 370, 34
    n = 17
    for i in range(n):
        xa = x0 + (x1 - x0) * i / n
        inner.append(f'<rect x="{xa:.1f}" y="{ry - 9}" width="{(x1 - x0) / n + 0.5:.1f}" height="18" '
                     f'style="fill:var(--accent);opacity:{0.08 + 0.62 * (i + 0.5) / n:.2f}"/>')
    xe = x0 + (x1 - x0) * 0.56
    xc = x0 + (x1 - x0) * 2 / 3
    inner += [f'<rect class="c2" x="{x0}" y="{ry - 9}" width="{x1 - x0}" height="18"/>',
              f'<rect class="c1" x="{xe:.1f}" y="{ry - 12}" width="9" height="24" style="stroke-width:1.5"/>',
              f'<text x="{xe + 4:.0f}" y="{ry - 18}" text-anchor="middle" class="t-acc">$dm = \\lambda\\,dx$</text>',
              f'<text x="{x0}" y="{ry + 26}" class="t-ink">$0$</text>',
              f'<text x="{x1}" y="{ry + 26}" text-anchor="end" class="t-ink">$L$</text>',
              f'<path class="c4" d="M{xc:.1f},{ry - 14} V{ry + 14}" style="stroke-width:2.4"/>',
              f'<text x="{xc:.0f}" y="{ry + 28}" text-anchor="middle" class="t-warn">$2L/3$</text>']
    # 반원 고리
    cx, cy, R = 100, 262, 86
    th = math.radians(52)
    ex, ey = cx + R * math.cos(th), cy - R * math.sin(th)
    yc = cy - 2 * R / math.pi
    inner += [f'<path class="ax" d="M{cx - R - 12},{cy} H{cx + R + 12}"/>',
              f'<path class="c2" d="M{cx - R},{cy} A{R},{R} 0 0 1 {cx + R},{cy}" style="stroke-width:3"/>',
              f'<path class="ax" d="M{cx},{cy} L{ex:.1f},{ey:.1f}"/>',
              f'<path class="ax" d="M{ex:.1f},{ey:.1f} V{cy}" stroke-dasharray="3 3"/>',
              _arc(cx, cy, 22, 0, 52),
              f'<text x="{cx + 27}" y="{cy - 9}" class="t-ink">$\\theta$</text>',
              f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="5" class="fAcc"/>',
              f'<text x="{ex + 9:.0f}" y="{ey - 4:.0f}" class="t-acc">$dm = \\lambda R\\,d\\theta$</text>',
              f'<text x="{ex + 5:.0f}" y="{(ey + cy) / 2 + 10:.0f}" class="t-ink">$y$</text>',
              f'<path class="c4" d="M{cx - 7},{yc - 7:.1f} l14,14 M{cx + 7},{yc - 7:.1f} l-14,14" style="stroke-width:2.2"/>',
              f'<text x="{cx - 12}" y="{yc + 5:.0f}" text-anchor="end" class="t-warn">$2R/\\pi$</text>',
              f'<text x="{cx}" y="{cy + 20}" text-anchor="middle" class="t-ink">반원 고리</text>']
    # 반원판
    cx, R = 300, 80
    r0, r1, a0, a1 = 44, 58, math.radians(48), math.radians(66)
    pts = [(cx + r0 * math.cos(a0), cy - r0 * math.sin(a0)), (cx + r1 * math.cos(a0), cy - r1 * math.sin(a0)),
           (cx + r1 * math.cos(a1), cy - r1 * math.sin(a1)), (cx + r0 * math.cos(a1), cy - r0 * math.sin(a1))]
    yc = cy - 4 * R / (3 * math.pi)
    inner += [f'<path class="fA" d="M{cx - R},{cy} A{R},{R} 0 0 1 {cx + R},{cy} Z"/>',
              f'<path class="c2" d="M{cx - R},{cy} A{R},{R} 0 0 1 {cx + R},{cy} Z"/>',
              f'<path d="M{pts[0][0]:.1f},{pts[0][1]:.1f} L{pts[1][0]:.1f},{pts[1][1]:.1f} A{r1},{r1} 0 0 0 {pts[2][0]:.1f},{pts[2][1]:.1f} '
              f'L{pts[3][0]:.1f},{pts[3][1]:.1f} A{r0},{r0} 0 0 1 {pts[0][0]:.1f},{pts[0][1]:.1f} Z" style="fill:var(--accent);opacity:0.7"/>',
              f'<path class="ax" d="M{cx},{cy} L{pts[0][0]:.1f},{pts[0][1]:.1f}"/>',
              f'<text x="{cx + 20}" y="{cy - 12}" class="t-ink">$r$</text>',
              f'<text x="{cx + 6}" y="{cy - R - 8}" text-anchor="middle" class="t-acc">$dA = r\\,dr\\,d\\theta$</text>',
              f'<path class="c4" d="M{cx - 7},{yc - 7:.1f} l14,14 M{cx + 7},{yc - 7:.1f} l-14,14" style="stroke-width:2.2"/>',
              f'<text x="{cx - 12}" y="{yc + 5:.0f}" text-anchor="end" class="t-warn">$4R/3\\pi$</text>',
              f'<text x="{cx}" y="{cy + 20}" text-anchor="middle" class="t-ink">반원판</text>']
    return svg(w, h, "\n".join(inner), "막대, 반원 고리, 반원판을 작은 조각으로 나누어 질량 중심을 구하는 그림")



def cradle():
    """뉴턴의 요람: 왼쪽 하나를 놓으면 오른쪽 하나만 튀어나온다."""
    w, h = 400, 250
    py, L, r, gap, cx = 30, 150, 15, 30, 200
    th = math.radians(36)
    xs = [cx + (i - 2) * gap for i in range(5)]
    lx, ly = xs[0] - L * math.sin(th), py + L * math.cos(th)
    rx, ry = xs[4] + L * math.sin(th), ly
    inner = [f'<path class="c2" d="M{xs[0] - 50},{py} H{xs[4] + 50}" style="stroke-width:5"/>']
    for x in xs[1:]:
        inner.append(f'<path class="ax" d="M{x},{py} V{py + L}"/>')
        inner.append(f'<circle class="c2" cx="{x}" cy="{py + L}" r="{r}" style="fill:var(--accent-soft)"/>')
    inner += [  # 왼쪽: 들어 올린 구슬(실선)과 원래 자리(점선). 오른쪽: 튀어나온 구슬(점선)
        f'<circle class="ax dash" cx="{xs[0]}" cy="{py + L}" r="{r}"/>',
        f'<path class="c2" d="M{xs[0]},{py} L{lx:.1f},{ly:.1f}" style="stroke-width:1.2"/>',
        f'<circle class="c1" cx="{lx:.1f}" cy="{ly:.1f}" r="{r}" style="fill:var(--accent);fill-opacity:0.55"/>',
        f'<path class="c3 dash" d="M{xs[4]},{py} L{rx:.1f},{ry:.1f}" style="stroke-width:1.2"/>',
        f'<circle class="c3 dash" cx="{rx:.1f}" cy="{ry:.1f}" r="{r}"/>',
        _arrow(lx + 20, ly + 22, xs[0] - 22, py + L + 8, "c1"),
        _arrow(xs[4] + 22, py + L + 8, rx - 20, ry + 22, "c3"),
        f'<text x="8" y="{py + 40}" class="t-acc">① 하나를 놓는다</text>',
        f'<text x="{w - 8}" y="{py + 40}" text-anchor="end" class="t-warm">② 하나만 나온다</text>',
        f'<text x="{cx + 15}" y="{py + L + r + 24}" text-anchor="middle">가운데 구슬은 거의 움직이지 않는다</text>',
        f'<text x="{cx}" y="{py + L + r + 46}" text-anchor="middle" class="t-ink">같은 높이까지 올라간다: $v\' = v$</text>']
    return svg(w, h, "\n".join(inner), "뉴턴의 요람: 왼쪽 구슬 하나를 놓으면 오른쪽 끝 구슬 하나만 같은 높이까지 튀어나오는 그림")


FIGS = {
    "traj": traj, "vterm": vterm, "potential": potential,
    "gauss_sphere": lambda: radial("E"), "ampere_cyl": lambda: radial("B"),
    "phasor": phasor, "resonance": resonance, "emwave": emwave,
    "lens": lens, "mirror": mirror, "slits": slits, "grating": grating,
    "blackbody": blackbody, "hlevels": hlevels, "box": box, "tunnel": tunnel,
    "bands": bands, "twin": twin,
    "ring_e": lambda: ring_field("E"), "ring_b": lambda: ring_field("B"), "disk_rings": disk_rings,
    "biot_wire": biot_wire, "inertia_slices": inertia_slices, "cm_slices": cm_slices, "cradle": cradle,
}
