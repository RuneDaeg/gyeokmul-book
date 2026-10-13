"use strict";

// 도름스 책 화면 다리(bridge)
// 1) 부모 창에 dorms-book-hello 를 보내면
// 2) 부모가 { type: "dorms-book", version: 1 } 와 함께 MessagePort 를 넘겨줘요.
// 3) 그 포트로 { id, method, params } 를 보내고 { id, ok, data | error } 를 받아요.
// 6초 안에 아무 요청도 없으면 도름스가 기본 화면으로 돌아가니, 포트를 받자마자 "ready" 를 불러요.

const bridge = (() => {
  let port = null;
  let seq = 0;
  const waiting = new Map();

  const connected = new Promise((resolve) => {
    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (port || !msg || msg.type !== "dorms-book" || msg.version !== 1) return;
      if (!event.ports || event.ports.length !== 1) return;
      port = event.ports[0];
      port.onmessage = (e) => {
        const res = e.data || {};
        const done = waiting.get(res.id);
        if (!done) return;
        waiting.delete(res.id);
        res.ok ? done.resolve(res.data) : done.reject(new Error(res.error || "실패했어요."));
      };
      port.start();
      resolve(true);
    });
  });

  function call(method, params) {
    if (!port) return Promise.reject(new Error("도름스와 연결되지 않았어요."));
    const id = ++seq;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      port.postMessage({ id, method, params: params || {} });
    });
  }

  function hello() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "dorms-book-hello", version: 1 }, "*");
    }
  }

  return { connected, call, hello, get live() { return !!port; } };
})();

// 도름스 밖(로컬, 미리보기 링크)에서 열었을 때 쓰는 예시 데이터
const SAMPLE = {
  book: { title: "프로젝트:격물", subtitle: "수학, 과학 교과 수업 및 문항 그림 제작 앱", callNumber: "200-003" },
  indexes: [
    { key: "cover", label: "표지", module: "cover" },
    { key: "essays", label: "격물치지", module: "essays" },
    { key: "essays-2", label: "수작(Sujak)", module: "essays" },
    { key: "flow", label: "이어짐", module: "flow" },
    { key: "requests", label: "요청함", module: "requests" },
    { key: "people", label: "쓰는 사람들", module: "people" },
  ],
  entries: [
    { key: "a", index: "essays", kind: "free", title: "Project: 격물", author: "Rune", dorms: 1, comments: 0, createdAt: "2026-10-13T15:50:03Z" },
    { key: "b", index: "essays", kind: "free", title: "Project: 치지", author: "Rune", dorms: 1, comments: 0, createdAt: "2026-10-13T15:57:26Z" },
    { key: "c", index: "essays-2", kind: "app", title: "수학 그림 그리기 SuJak", author: "McKay", dorms: 13, comments: 5, createdAt: "2026-10-09T09:16:18Z" },
  ],
  people: [
    { userId: null, name: "Rune", role: "owner", pieces: 2 },
    { userId: null, name: "McKay", role: null, pieces: 1 },
  ],
};

const KIND_LABEL = { free: "글", resource: "자료", app: "앱", topic: "포스트잇", library: "책 추천", app_request: "요청" };

const $ = (id) => document.getElementById(id);

function el(tag, props, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props || {});
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(child);
  }
  return node;
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function act(method, params) {
  if (bridge.live) bridge.call(method, params).catch(() => {});
}

function render({ book, indexes, entries, people }) {
  if (book) {
    $("title").textContent = book.title || "프로젝트:격물";
    $("subtitle").textContent = book.subtitle || "";
    $("callNo").textContent = book.callNumber || "";
    $("footCallNo").textContent = book.callNumber || "";
  }

  const counts = {};
  for (const e of entries) counts[e.index] = (counts[e.index] || 0) + 1;

  const chapters = indexes.filter((i) => i.module !== "cover");
  $("toc").replaceChildren(...chapters.map((idx, n) => el("li", null,
    el("button", { className: "row", type: "button", onclick: () => act("open.index", { key: idx.key }) },
      el("span", { className: "toc-no", textContent: String(n + 2).padStart(2, "0") }),
      el("span", { className: "toc-label", textContent: idx.label }),
      counts[idx.key] ? el("span", { className: "toc-count", textContent: `${counts[idx.key]}편` }) : null,
    ),
  )));

  const recent = [...entries]
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
    .slice(0, 4);
  $("recentBlock").hidden = recent.length === 0;
  $("recent").replaceChildren(...recent.map((p) => el("li", null,
    el("button", { className: "row", type: "button", onclick: () => act("open.piece", { key: p.key }) },
      el("span", { className: "piece-main" },
        el("span", { className: "piece-title", textContent: p.title || "제목 없음" }),
        el("span", { className: "piece-meta", textContent: [p.author, formatDate(p.createdAt), `도름 ${p.dorms ?? 0}`].filter(Boolean).join(" · ") }),
      ),
      el("span", { className: "tag", textContent: KIND_LABEL[p.kind] || "글" }),
    ),
  )));

  $("peopleBlock").hidden = people.length === 0;
  $("people").replaceChildren(...people.map((person) => {
    const avatar = person.avatar
      ? el("img", { className: "avatar", src: person.avatar, alt: "" })
      : el("span", { className: "avatar", textContent: (person.name || "?").slice(0, 1) });
    const role = person.faceNote || (person.role === "owner" ? "책을 여는 분" : "글이 실린 분");
    return el("li", null,
      el("button", { className: "row", type: "button", onclick: () => person.userId && act("open.profile", { userId: person.userId }) },
        avatar,
        el("span", null,
          el("span", { className: "person-name", textContent: person.name }),
          el("span", { className: "person-role", textContent: person.pieces ? `${role} · ${person.pieces}편` : role }),
        ),
      ),
    );
  }));

  $("mode").textContent = bridge.live ? "" : "미리보기 (예시 데이터)";
  const cover = $("cover");
  cover.classList.add("is-ready");
  cover.removeAttribute("aria-busy");
}

// 화면 높이를 도름스에 알려 줘서 책 안에서 스크롤 없이 다 보이게 해요.
function watchHeight() {
  let last = 0;
  const send = () => {
    const h = Math.ceil(document.documentElement.scrollHeight);
    if (Math.abs(h - last) < 4) return;
    last = h;
    act("ui.resize", { height: h });
  };
  new ResizeObserver(send).observe(document.body);
  window.addEventListener("load", send);
  send();
}

async function loadLive() {
  await bridge.call("ready");
  const [bookRes, indexes, entries, people] = await Promise.all([
    bridge.call("book.get"),
    bridge.call("indexes.list"),
    bridge.call("entries.list"),
    bridge.call("people.list"),
  ]);
  return { book: bookRes && bookRes.book, indexes, entries, people };
}

async function main() {
  bridge.hello();
  const live = await Promise.race([
    bridge.connected,
    new Promise((resolve) => setTimeout(() => resolve(false), 1500)),
  ]);

  if (!live) {
    render(SAMPLE);
    return;
  }

  try {
    render(await loadLive());
  } catch (err) {
    render(SAMPLE);
    act("ui.notify", { message: "책 정보를 불러오지 못했어요." });
  }
  watchHeight();
}

main();
