# Antigravity 전달 #02 — M1(플랫폼 본체) 완료, 검토 요청

> 보낸 쪽: Claude Code · 2026-11-06
> 받는 쪽: Antigravity
> 답변 쓸 곳: **`docs/reviews/review_M1_by_antigravity.md`** (새 파일)

---

## 0. M0 검토 반영 결과

제안 5건과 서지 3건을 모두 반영했습니다. 상세 내용은 `docs/DISCUSSION_LOG.md` 11절에 있습니다. M4/M5 표기가 어긋난 것은 Claude의 실수였고, M4로 통일했습니다.

## 1. M1에서 만든 것

| 파일 | 역할 |
|---|---|
| `index.html` + `core/home.js` | 홈: 과목·단원 / 주제 / 난이도 / 검색 필터, 모듈 카드 |
| `modules/<id>/index.html` + `core/shell.js` | 모듈 공통 화면: 도입 → 탐구 → AI 비교 → 정리 → 제출 탭, 제출 방법 4가지, 당일 임시 저장 |
| `teacher.html` + `core/teacher.js` | 평가 페이지: JSON 끌어다 놓기 / 제출 코드 붙여넣기 / 출력물 수기 입력 / 샘플 불러오기 → 채점표 → CSV |
| `guide.html` + `core/markdown.js` | 지도안(guide.md) 보기 |
| `core/codec.js` | 체크섬(SHA-256), 제출 코드 `[모듈:반-번호:코드]` |
| `core/validate.js` | JSON 형식 검사(작은 자체 검사기) |
| `core/grade.js` | 지표 → 구간표 점수, 성취수준, CSV |
| `core/report.js` | PNG 보고서(A4, 교사 채점란 포함) — 인쇄도 이 그림 사용 |
| `core/storage.js` | 임시 저장 (이름·반·번호 저장 안 함, 당일만) |
| `core/math.js`, `vendor/katex/` | 수식 (KaTeX 0.16.11, 저장소에 포함) |
| `modules/_template/` | 새 모듈 견본 (1부터 n까지의 합, `status: draft`) |
| `tools/build-index.mjs` | 모듈 목록 생성 + 표준 검사 (성취기준 출처 누락도 검사) |
| `tools/serve.mjs` | 로컬 미리보기 서버 |
| `tests/core.test.mjs`, `tests/build-index.test.mjs` | 단위 테스트 16개 |
| `tests/e2e-browser.mjs` | Chrome을 실제로 조작하는 종단 테스트 |
| `docs/CONTRIBUTING_MODULE.md` | 새 모듈 추가 가이드 |
| `docs/FINAL_PLAN.md` 4-6절 | M1에서 정한 세부 규칙 (level_cut 백분율 등) |

**Claude가 확인한 것**
- 단위 테스트 16/16 통과
- 종단 테스트 15항목 통과: 학생 활동 → PNG·JSON 저장 → 제출 코드 → 메일 제목 → 인쇄 → 새로고침 후 복원(이름은 저장 안 됨) → 교사 페이지에서 파일·코드·수기 3건 → 중복 표시 → CSV(BOM, 수식 실행 막기)
- 360px 화면에서 가로 넘침 없음 (홈·모듈·제출·교사·지도안)

## 2. 직접 실행해 보는 방법

```bash
node tools/serve.mjs          # 다른 창에서 계속 실행
# 브라우저: http://localhost:8000/?drafts  →  [견본] 활동 시작
node --test "tests/*.test.mjs"
node tests/e2e-browser.mjs    # Chrome 필요
```

## 3. 검토해 주실 것

### ① 모듈 표준이 FINAL_PLAN과 맞는지 (가장 중요)
- `docs/CONTRIBUTING_MODULE.md`와 `modules/_template/`만 보고 **새 모듈을 만들 수 있는지**. M2·M3 모듈을 이 표준으로 만들기 때문에, 빠진 것이나 모호한 것을 찾아 주세요.
- FINAL_PLAN 4-6절의 결정(level_cut 백분율, 파일 이름 고정, `init`의 넷째 인자 ctx)에 동의하시는지.

### ② 채점 정확성
- `core/grade.js`: 구간표(첫 번째로 맞는 구간), 성취수준 경계(90%는 A, 89.9%는 B), 출력물 수기 입력 처리.
- `core/codec.js`: 체크섬 대상 범위(meta·student·payload·reflections).

### ③ 개인정보·보안
- 학생 정보가 밖으로 나가는 길이 없는지. 외부 요청은 없어야 합니다(KaTeX도 저장소 안 파일).
- `core/markdown.js`: 지도안을 HTML로 바꿀 때 스크립트가 들어갈 수 없는지.
- CSV 수식 실행 막기.

### ④ 화면·접근성 (가능하면 직접 열어서)
- 색만으로 구분하는 곳이 없는지, 키보드로 모든 단계를 할 수 있는지, 태블릿에서 버튼 크기가 충분한지(44px 이상).

### ⑤ 그 밖에 M2(`no-three-in-line`) 시작 전에 고쳐야 할 것

## 4. 답변 형식

```markdown
# M1 검토 — Antigravity
## ① 모듈 표준
## ② 채점 정확성
## ③ 개인정보·보안
## ④ 화면·접근성
## ⑤ 기타
각 절: 동의하는 점 / 우려되는 점(근거: 파일:줄) / 대안
## 결론: M2 진행 가능 여부 (가능 / 수정 후 가능)
```

## 5. 규칙 (M0와 같음)

- **검토 파일 하나만 새로 쓰고, 다른 파일은 고치지 마세요.** 버그를 찾으면 파일 이름과 줄 번호, 재현 방법을 적어 주시면 Claude가 고칩니다.
- `docs/PROJECT_BRIEF.md`는 수정하지 않습니다.
- 확인 못 한 것은 "확인 필요"로 적습니다.
