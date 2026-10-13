# 격물치지 — 도름스 책 첫 화면

도름스 서재 책 [프로젝트:격물](https://dorms.school/collaboration?project=pub-7845d798-58b0-421b-aae1-cb4e5d8463d6)의 첫 화면이에요.
격물(수학·과학 그림)과 치지(역사·지리·사회·윤리 그림)를 함께 담았어요.

- `dist/` — 도름스에 실리는 화면 (index.html, book.manifest.json 이 맨 위)
- `dorms-book.json` — 이 레포가 그 책의 레포인지 확인하는 코드
- `tools/` — 격물치지 대문 HTML 에서 붓글씨·교과 그림·두 세계 그림(SVG)을 뽑아 `dist/index.html` 을 만드는 도구

```
node tools/build.mjs "<격물치지-대문.html 경로>"
```

`dist/index.html` 은 도름스 밖에서 열면 예시 데이터로 보여요.
도름스 안에서는 MessagePort 다리로 실제 책 정보(실린 글, 쓰는 사람들)를 받아 그려요.
바깥 글꼴·그림·스크립트를 부를 수 없는 곳이라 모든 그림은 SVG 로, 스타일과 스크립트는 따로 된 파일로 들어 있어요.
