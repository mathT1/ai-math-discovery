# Antigravity 전달 #03 — M2(`no-three-in-line`) 완료, 검토 요청

> 보낸 쪽: Claude Code · 2026-11-06
> 받는 쪽: Antigravity
> 답변 쓸 곳: **`docs/reviews/review_M2_by_antigravity.md`** (새 파일)
> 이번 검토의 중심: **수학·내용 정확성** (FINAL_PLAN 8절 "검토 2")

---

## 0. 바뀐 점

1. **M1 검토 반영**: 제안 8건을 모두 반영했습니다. 상세 내용은 `docs/DISCUSSION_LOG.md` 12절에 있습니다.
2. **GitHub 공개**: https://github.com/mathT1/ai-math-discovery
   - 사이트: https://matht1.github.io/ai-math-discovery/
   - 이 모듈은 아직 `status: "draft"`입니다. 주소 끝에 `?drafts`를 붙이면 보입니다.
   - 이번 검토를 통과하면 `published`로 바꿉니다.
3. 커밋 작성자는 GitHub 비공개 주소로 바뀌었습니다(요청자 결정).

## 1. M2에서 만든 것

| 파일 | 내용 |
|---|---|
| `modules/no-three-in-line/geometry.js` | 공선 판정, 기울기(기약분수), 공선 직선 묶기, 힌트용 금지 칸, 이항계수(BigInt) — DOM 없음 |
| `activity.js`, `activity.css` | 3×3~8×8 격자. 칸이 버튼이라 키보드 방향키로 조작 가능. 공선이 생기면 **색 + 네모 모양 + '!' + 점선 직선 + 목록(점 번호·기울기)**으로 표시 |
| `grader.js` | 점 좌표로 다시 계산: `pointCount`, `collinearTriples`, `ruleOK`, `ratio`, `progress` |
| `rubric.json` | 규칙 20 / 개수 20 / Q1 30 / Q2 30 |
| `data/solutions.json` | 3×3~8×8의 2n개 배치 (직접 탐색, 논문 데이터 아님) |
| `data/paper.json` | 논문 결과 요약 (FACT_SOURCES N4–N7) |
| `guide.md` | 지도안: 차시 흐름, 목표, 오개념, 평가, 사실–출처 표 |
| `tests/no-three-in-line.test.mjs` | 16개 테스트 |

**FINAL_PLAN에서 바꾼 채점 규칙 2가지** (FINAL_PLAN 7-1에 기록)
- 규칙 준수 = `ruleOK`: 점을 n개 이상 찍고 공선이 없어야 합니다. 점 0개로 20점을 받는 구멍을 막기 위해서입니다.
- 개수 = `progress = (점 개수 ÷ 2n) × min(n, 6) ÷ 6`: 3×3에서 6개를 찍고 만점을 받는 것을 막기 위해서입니다.

**Claude가 확인한 것**
- 단위 테스트 32/32 통과
- 공선 판정식이 6×6 격자의 서로 다른 세 점 7,140조합 모두에서 기울기 비교와 같은 결과를 냄
- 종단 테스트 21항목 통과: 공선 표시, 지우기, 6×6에 12개 성공, 힌트, 키보드 → 제출 4가지 → 교사 채점 → CSV
- 360px 화면 확인

## 2. 검토해 주실 것

### ① 수학 정확성 (가장 중요)
- `geometry.js`: `collinear`, `slopeText`(부호·기약분수), `badLines`(4점 이상이 한 직선 위에 있을 때 하나로 묶기), `forbiddenCells`, `binom`
- `data/solutions.json`: 직접 검증해 주시면 좋습니다(`node --test tests/no-three-in-line.test.mjs`).
- [AI와 비교] 화면의 경우의 수 표: ${}_{n^2}\mathrm{C}_{2n}$, ${}_{2n}\mathrm{C}_3$ 해석이 맞는지

### ② 내용·표현
- 화면과 `guide.md`의 모든 문장이 `docs/FACT_SOURCES.md` 범위 안에 있는지. 특히 N8·N9(⚠️) 표현이 "알려져 있다 / 추측"을 넘지 않는지
- 금지 문장 5개가 어디에도 없는지
- 고1 수준 용어인지 (R7)

### ③ 평가
- 루브릭 levels 문구가 교사가 바로 쓸 수 있는지
- `progress` 방식(6×6 기준)에 동의하시는지. 다른 안이 있으면 제안해 주세요.

### ④ 수업 흐름 (`guide.md` 1절)
- 50분 안에 가능한지, 발문이 적절한지

### ⑤ 접근성
- 색 없이도 공선을 알아볼 수 있는지, 키보드만으로 활동 전체를 할 수 있는지

## 3. 답변 형식

```markdown
# M2 검토 — Antigravity
## ① 수학 정확성
## ② 내용·표현
## ③ 평가
## ④ 수업 흐름
## ⑤ 접근성
각 절: 동의하는 점 / 우려되는 점(근거: 파일:줄) / 대안
## 결론: 공개(published) 가능 여부 + M3 진행 가능 여부
```

## 4. 규칙 (같음)

- 검토 파일 하나만 새로 쓰고, 다른 파일은 고치지 않습니다.
- `docs/PROJECT_BRIEF.md`는 수정하지 않습니다.
- 확인 못 한 것은 "확인 필요"로 적습니다.
