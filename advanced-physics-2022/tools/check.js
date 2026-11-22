// 슬라이드 자동 검사: 기능을 고친 뒤 깨진 곳이 없는지 확인한다.
//   쓰는 법 (advanced-physics-2022 폴더에서, 먼저 python3 tools/build.py):
//     node tools/check.js            # 모든 덱
//     node tools/check.js 02 03      # 이름이 02, 03 으로 시작하는 덱만
//   필요한 것: npm install playwright && npx playwright install chromium
//   AP22_ROUTE=경로.js 를 주면 그 모듈로 네트워크 요청을 바꿔 준다 (make_pdf.js 와 같음).
//
// 검사 항목 (하나라도 걸리면 종료 코드 1)
//   1. 1280px: 16:9 를 넘는 슬라이드, MathJax 오류, 가로 스크롤
//   2. 400px(휴대폰): 가로 스크롤, MathJax 오류
//   3. 단 너비에 맞춰 70 % 아래로 줄어든 수식
//   4. 발표 모드에서 화면을 넘는 슬라이드 (1920×1080, 1024×768, 844×390, 667×375, 390×844)
//   5. 시뮬레이터: 캔버스가 그려지는지, 빈 출력값, 스크립트 오류
//   6. 목차: T 로 열리고 항목 수가 슬라이드 수와 같은지
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const SLIDES = path.resolve(__dirname, '..', 'slides');
const hook = process.env.AP22_ROUTE ? require(path.resolve(process.env.AP22_ROUTE)) : null;
const want = process.argv.slice(2);
const decks = fs.readdirSync(SLIDES).filter(f => /^0\d-.*\.html$/.test(f) && (!want.length || want.some(w => f.startsWith(w)))).sort();

async function open(b, file, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...opts });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  if (hook) await hook(p);
  await p.goto('file://' + path.join(SLIDES, file));
  await p.waitForFunction(() => window.MathJax && MathJax.startup && MathJax.startup.promise, null, { timeout: 60000 });
  await p.evaluate(() => MathJax.startup.promise);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  return { ctx, p, errs };
}

(async () => {
  const b = await chromium.launch();
  let bad = 0;
  const fail = (deck, msg) => { bad++; console.log(`  ✗ ${deck}: ${msg}`); };
  for (const f of decks) {
    console.log(`## ${f}`);
    // 1, 3, 5, 6: 1280px
    let { ctx, p, errs } = await open(b, f, { width: 1280, height: 900 });
    const r = await p.evaluate(() => {
      const out = { tall: [], shrunk: [], mjx: document.querySelectorAll('mjx-merror').length, hscroll: document.documentElement.scrollWidth > innerWidth };
      for (const svg of document.querySelectorAll('.eq mjx-container[display="true"] > svg')) {
        const w1 = svg.getBoundingClientRect().width; svg.style.maxWidth = 'none';
        const w2 = svg.getBoundingClientRect().width; svg.style.maxWidth = '';
        if (w2 && w1 / w2 < 0.7) out.shrunk.push(svg.closest('.slide').id + ' ' + (w1 / w2).toFixed(2));
      }
      const st = document.createElement('style'); st.textContent = '.sl{height:auto!important}.slide .body{flex:none!important}'; document.head.appendChild(st);
      for (const s of document.querySelectorAll('.slide')) {
        const ratio = s.querySelector('.sl').offsetHeight / (s.clientWidth * 9 / 16);
        if (ratio > 1.0) out.tall.push(s.id + ' ' + Math.round(ratio * 100) + '%');
      }
      st.remove();
      out.sims = [...document.querySelectorAll('.sim')].map(s => ({ name: s.dataset.sim, canvas: !!(s.querySelector('canvas') && s.querySelector('canvas').width), empty: [...s.querySelectorAll('.sim-out b')].filter(x => !x.textContent).length }));
      out.n = document.querySelectorAll('.slide').length;
      return out;
    });
    if (r.tall.length) fail(f, '16:9 를 넘는 슬라이드 ' + r.tall.join(', '));
    if (r.mjx) fail(f, `MathJax 오류 ${r.mjx}개`);
    if (r.hscroll) fail(f, '1280px 에서 가로 스크롤');
    if (r.shrunk.length) fail(f, '많이 줄어든 수식 ' + r.shrunk.join(', '));
    for (const s of r.sims) if (!s.canvas || s.empty) fail(f, `시뮬레이터 ${s.name}: ${!s.canvas ? '그려지지 않음' : '빈 출력값 ' + s.empty + '개'}`);
    await p.keyboard.press('t');
    const toc = await p.locator('.toc-panel a[data-i]').count().catch(() => 0);
    if (toc !== r.n) fail(f, `목차 항목 ${toc}개 (슬라이드 ${r.n}장)`);
    if (errs.length) fail(f, '스크립트 오류: ' + errs.join(' | ').slice(0, 300));
    console.log(`  슬라이드 ${r.n}장, 시뮬레이터 ${r.sims.length}개, 목차 ${toc}개`);
    await ctx.close();
    // 2: 휴대폰 화면
    ({ ctx, p, errs } = await open(b, f, { width: 400, height: 860 }));
    const m = await p.evaluate(() => ({ hscroll: document.documentElement.scrollWidth > innerWidth, mjx: document.querySelectorAll('mjx-merror').length }));
    if (m.hscroll) fail(f, '400px 에서 가로 스크롤');
    if (errs.length) fail(f, '휴대폰 화면 스크립트 오류: ' + errs.join(' | ').slice(0, 300));
    await ctx.close();
    // 4: 발표 모드
    for (const [W, H] of [[1920, 1080], [1024, 768], [844, 390], [667, 375], [390, 844]]) {
      ({ ctx, p, errs } = await open(b, f, { width: W, height: H }, { hasTouch: W < 900, isMobile: W < 900 }));
      await p.keyboard.press('p'); await p.waitForTimeout(150); await p.keyboard.press('Home');
      const over = [];
      for (let i = 0; i < r.n; i++) {
        const q = await p.evaluate(() => { const s = document.querySelector('.slide.current'); const sl = s.querySelector('.sl'); return [s.id, sl.scrollHeight / sl.clientHeight]; });
        if (q[1] > 1.03) over.push(q[0] + ' ' + Math.round(q[1] * 100) + '%');
        await p.keyboard.press('Shift+ArrowRight');
      }
      if (over.length) fail(f, `발표 모드 ${W}×${H} 에서 넘침 ` + over.join(', '));
      if (errs.length) fail(f, `발표 모드 ${W}×${H} 스크립트 오류: ` + errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  }
  await b.close();
  console.log(bad ? `\n문제 ${bad}건` : '\n모든 검사 통과');
  process.exit(bad ? 1 : 0);
})();
