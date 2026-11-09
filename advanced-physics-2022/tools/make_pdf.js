// 슬라이드와 오류 목록을 PDF 로 만든다.
//   쓰는 법 (advanced-physics-2022 폴더에서): npm install playwright && npx playwright install chromium
//                                            node tools/make_pdf.js
// 결과: slides/pdf/0X-이름.pdf (풀이 포함), slides/pdf/0X-이름-student.pdf (풀이 숨김), slides/pdf/errors.pdf
// 슬라이드 한 장이 16:9 한 쪽이 되고, 풀이를 펼쳐 한 쪽을 넘는 슬라이드는 글자를 줄여 맞춘다.
// AP22_ROUTE=경로.js 를 주면 그 모듈로 네트워크 요청을 바꿔 준다 (글꼴·MathJax 를 로컬에서 줄 때).
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SLIDES = path.join(ROOT, 'slides');
const OUT = path.join(SLIDES, 'pdf');
const hook = process.env.AP22_ROUTE ? require(path.resolve(process.env.AP22_ROUTE)) : null;

async function open(browser, file) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  if (hook) await hook(page);
  await page.goto('file://' + path.join(SLIDES, file), { waitUntil: 'load' });
  await page.waitForFunction(() => window.MathJax && MathJax.startup && MathJax.startup.promise, null, { timeout: 60000 });
  await page.evaluate(() => MathJax.startup.promise);
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const decks = fs.readdirSync(SLIDES).filter(f => /^0\d-.*\.html$/.test(f)).sort();
  for (const file of decks) {
    for (const v of [{ suffix: '', answers: true, label: '풀이 포함' }, { suffix: '-student', answers: false, label: '학생용' }]) {
      const { ctx, page } = await open(browser, file);
      await page.emulateMedia({ media: 'print', colorScheme: 'light' });
      const fitted = await page.evaluate(a => { window.AP22_PRINT_LOCK = true; return window.AP22.fitForPrint({ answers: a }); }, v.answers);
      const n = await page.evaluate(() => document.querySelectorAll('.slide').length);
      const out = path.join(OUT, file.replace('.html', v.suffix + '.pdf'));
      await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
      console.log(`${path.basename(out)}: ${n}쪽 (${v.label}), 글자를 줄여 맞춘 슬라이드 ${fitted.length}장` +
        (fitted.length ? ' ' + fitted.map(([id, f, over]) => `${id} ${f}%` + (over ? ' (아직 넘침!)' : '')).join(', ') : ''));
      await ctx.close();
    }
  }
  const { ctx, page } = await open(browser, 'errors.html');
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  await page.pdf({ path: path.join(OUT, 'errors.pdf'), format: 'A4', printBackground: true,
    margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' } });
  console.log('errors.pdf: 오류 목록 (A4)');
  await ctx.close();
  await browser.close();
})();
