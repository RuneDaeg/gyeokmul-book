// 격물치지 대문 HTML 에서 그림(SVG)을 뽑아 dist/index.html 을 만든다.
// 쓰는 법: node tools/build.mjs "<격물치지-대문.html 경로>"
import fs from "node:fs";

const SRC = process.argv[2] || "C:/Users/rune_/OneDrive/문서/카카오톡 받은 파일/격물치지-대문.html";
const OUT = new URL("../dist/index.html", import.meta.url);
const TPL = new URL("./template.html", import.meta.url);

const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/);
const L = (n) => lines[n - 1];
const range = (a, b) => lines.slice(a - 1, b).join("\n");

function one(re, text, what) {
  const m = text.match(re);
  if (!m) throw new Error("못 찾음: " + what);
  return m[1] ?? m[0];
}

// 별 반짝임 지연은 style 속성 대신 data-d 로 (CSP 에서 인라인 style 이 막혀도 괜찮게)
const noInlineStyle = (s) => s.replace(/ style="animation-delay:([0-9.]+s)"/g, ' data-d="$1"');

// 책 한 쪽은 좁으니 격물은 왼쪽(그래프·렌즈), 치지는 오른쪽(옛 지도·나침반)을 기준으로 자른다
const crop = (s, align) => s.replace('preserveAspectRatio="xMidYMin slice"', `preserveAspectRatio="${align} slice"`);
const gyeokWorld = crop(noInlineStyle(one(/(<svg[\s\S]*<\/svg>)/, range(163, 198), "격물 세계")), "xMinYMin");
// 연표 두루마리는 좁은 쪽에서 잘려 보여서 뺀다
const chijiWorld = crop(noInlineStyle(one(/(<svg[\s\S]*<\/svg>)/, range(201, 236), "치지 세계")), "xMaxYMin")
  .replace(/<g transform="translate\(60 300\)">[\s\S]*?<\/g>\n?/, "");
const gyeokGlyph = one(/<span class="gate-glyph" aria-hidden="true">(<svg[\s\S]*?<\/svg>)<\/span>/, L(199), "格物 글씨");
const chijiGlyph = one(/<span class="gate-glyph" aria-hidden="true">(<svg[\s\S]*?<\/svg>)<\/span>/, L(237), "致知 글씨");
const enso = one(/<span class="gate-enso" aria-hidden="true">(<svg[\s\S]*?<\/svg>)<\/span>/, L(239), "원상");
const brush = one(/<span class="gate-brush" aria-hidden="true">(<svg[\s\S]*?<\/svg>)<\/span>/, L(239), "格物致知 글씨");
const seal = one(/<span class="gate-seal" aria-hidden="true">(<svg[\s\S]*?<\/svg>)<\/span>/, L(239), "낙관");

function subjects(line) {
  const out = [];
  const re = /<button type="button" class="gate-subj" data-subj="(\w+)"><span class="gate-ic" aria-hidden="true">(<svg[\s\S]*?<\/svg>)<\/span><b>([^<]+)<\/b><\/button>/g;
  for (const m of line.matchAll(re)) {
    out.push(`<li class="subj" data-subj="${m[1]}"><span class="subj-ic" aria-hidden="true">${m[2]}</span><b>${m[3]}</b></li>`);
  }
  if (!out.length) throw new Error("교과를 못 찾음");
  return out.join("");
}

// 두 SVG 의 id 가 겹치지 않는지 확인 (한 문서에 함께 들어가므로)
const ids = [...(gyeokWorld + chijiWorld).matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
if (new Set(ids).size !== ids.length) throw new Error("SVG id 겹침: " + ids.join(","));

let html = fs.readFileSync(TPL, "utf8");
const parts = {
  ENSO: enso, BRUSH: brush, SEAL: seal,
  GYEOK_WORLD: gyeokWorld, GYEOK_GLYPH: gyeokGlyph, GYEOK_SUBJECTS: subjects(L(200)),
  CHIJI_WORLD: chijiWorld, CHIJI_GLYPH: chijiGlyph, CHIJI_SUBJECTS: subjects(L(238)),
};
for (const [k, v] of Object.entries(parts)) {
  if (!html.includes(`{{${k}}}`)) throw new Error("틀에 자리 없음: " + k);
  html = html.replace(`{{${k}}}`, () => v);
}
if (/style="/.test(html)) throw new Error("인라인 style 이 남아 있음");
fs.writeFileSync(OUT, html);
console.log("ok dist/index.html", (html.length / 1024).toFixed(1) + "KB", "subjects:", (html.match(/class="subj/g) || []).length);
