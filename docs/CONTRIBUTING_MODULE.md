# 새 모듈 추가 가이드

새 활동(모듈)은 **폴더 하나**를 추가하면 홈 목록, 교사 평가 페이지, 지도안 보기에 자동으로 반영됩니다. 플랫폼 본체(`core/`, `index.html`, `teacher.html`, `guide.html`)는 고치지 않습니다. 고쳐야만 한다면 표준에 빈틈이 있다는 뜻이므로 따로 기록해 주세요.

---

## 1. 준비

- [Node.js](https://nodejs.org/) 22 이상 (검사·미리보기용, 설치할 패키지는 없음)
- 미리보기: `node tools/serve.mjs` 를 실행한 뒤 http://localhost:8000/?drafts 를 엽니다.
  - 파일을 더블클릭해 열면 브라우저 보안 규칙 때문에 동작하지 않습니다.

## 2. 순서

1. `modules/_template/` 폴더를 복사해 `modules/<새-id>/` 로 이름을 바꿉니다.
   - id: 영어 소문자·숫자·`-`만 (예: `no-three-in-line`)
2. `module.json` 을 고칩니다 (3절). `status` 는 `"draft"` 로 둡니다.
3. `activity.js` 에 활동을 만듭니다 (4절).
4. `grader.js`, `schema.json`, `rubric.json` 을 씁니다 (5·6절).
5. `guide.md` 에 지도안을 씁니다 (7절).
6. `data/` 에 논문 결과를 넣고, `tests/` 에 검증 테스트를 추가합니다 (8절).
7. 검사: `node tools/build-index.mjs` → `node --test "tests/*.test.mjs"`
8. 브라우저 확인: `node tests/e2e-browser.mjs <새-id>` (Chrome 필요)
9. 다 되면 `status` 를 `"published"` 로 바꿔 올립니다(push). GitHub Actions가 검사를 통과하면 자동 배포합니다.

`index.html` 은 고치지 않습니다. 화면은 `core/shell.js` 가 만듭니다.

## 3. module.json

| 항목 | 필수 | 설명 |
|---|---|---|
| `id` | ✔ | 폴더 이름과 같아야 함 |
| `version` | ✔ | `1.0.0` 형식. 결과물 형식이 바뀌면 올림 |
| `status` | ✔ | `draft`(홈에 안 보임, `?drafts` 로 보임) / `published` |
| `title`, `subtitle` | ✔ / | 카드·화면 제목 |
| `subject`, `unit`, `topics` | ✔ | 홈 필터에 쓰임 |
| `achievement_standards` | ✔ | `{code, description, source}` 목록. **확정 코드는 `source`(문서명·쪽) 필수** — 없으면 검사가 실패함. 확인 전에는 `code: "후보(확인 필요)"` |
| `grade`, `periods`, `difficulty` | ✔ | 학년 목록, 차시 수, 난이도 1~3 |
| `paper` | ✔ | `title, authors, year, url, code, ai_method, license_note` |
| `story` | | `hook`(도입 질문), `ai_connection`(연구 이야기). `$수식$` 사용 가능 |
| `questions` | ✔ | 정리 질문 `{id, type:"text", prompt}` 목록 |
| `data` | | `{"이름": "data/파일.json"}` — 화면이 불러와 `activity.js` 에 넘겨 줌 |

**화면에 쓰는 사실은 `docs/FACT_SOURCES.md`(또는 `guide.md` 사실–출처 표)에 출처가 있는 것만 씁니다.**

## 4. activity.js — 함수 4개

```js
export function init(container, meta, data, ctx) {}
// container: 활동을 그릴 곳, meta: module.json, data: module.json의 data 파일들
// ctx.saved: 오늘 하던 기록(payload) 또는 null → 있으면 그 상태로 복원
// ctx.onChange(): 학생이 무언가 바꿀 때마다 호출 → 자동 임시 저장

export function getResultData() {}
// 제출할 payload. 원자료만 넣음(점 좌표, 고른 식 등). 점수·정답 여부·개수 같은 요약값은 넣지 않음.

export function renderAIComparison(container, payload, data) {}
// 'AI와 비교' 탭을 열 때마다 호출됨

export function renderSummaryCanvas(canvas, payload) {}
// PNG 보고서·인쇄물에 들어갈 그림 (가로 1080 × 세로 560). 흰 배경, 색만으로 구분하지 말 것
```

접근성: 색만으로 정보를 구분하지 않습니다(기호·선 모양·번호를 함께). 버튼은 키보드로 누를 수 있어야 합니다.

## 5. grader.js — 다시 계산

```js
export function metrics(payload, data) {
  return { values: { 지표: 숫자 }, evidence: ['사람이 읽는 근거 문장'] };
}
```

- 학생이 낸 **원자료로 다시 계산**합니다. 학생 파일에 적힌 값을 믿지 않습니다.
- DOM(document, window)을 쓰지 않습니다. 교사 페이지와 Node 테스트에서도 실행됩니다.

## 6. schema.json · rubric.json

`schema.json`: payload 형식. 지원: `type, required, properties, additionalProperties, items, enum, const, minimum, maximum, minLength, maxLength, minItems, maxItems`.

`rubric.json`:

```json
{
  "scale": ["A", "B", "C", "D", "E"],
  "level_cut": { "A": 90, "B": 80, "C": 70, "D": 60 },
  "items": [
    { "id": "valid", "label": "규칙 준수", "type": "auto", "metric": "collinearTriples", "max": 20,
      "tiers": [{ "max": 0, "score": 20 }] },
    { "id": "q1", "label": "판정 방법 설명", "type": "teacher", "question": "q1", "max": 30,
      "levels": { "30": "판정식을 세우고 이유를 설명", "20": "판정식만", "0": "미작성" } }
  ]
}
```

- `level_cut`: **백분율**(총점 ÷ 만점 × 100) 기준. `scale` 순서대로 처음 넘는 단계, 모두 못 넘으면 마지막 단계.
- 자동 항목 `tiers`: 위에서부터 **처음 맞는 구간**의 점수. 조건은 `min`(이상), `max`(이하), `eq`(같음)를 섞어 쓸 수 있음.
- 교사 항목: 자동 점수를 주지 않습니다. 평가 페이지에 `levels` 선택 칸으로 나옵니다. 답을 안 쓰면 "미작성" 표시만 합니다.
- 출력물(수기 입력)로 낸 학생은 원자료가 없으므로 자동 항목도 교사가 점수를 넣습니다.
- 배점은 숫자만 고치면 되고 코드는 바꾸지 않습니다.

## 7. guide.md — 지도안 (다섯 부분 필수)

1. 차시 흐름 (단계·시간·활동·발문)
2. 학습 목표
3. 예상 오개념과 대응
4. 평가 (자동 항목·교사 항목 설명)
5. **사실–출처 표** — 화면에 나오는 수학적 사실·논문 설명마다 출처

`guide.html?id=<id>` 로 보면 표·목록·수식이 정리되어 보입니다.

## 8. 데이터와 테스트

- `data/` 의 모든 해(배치, 식 등)는 `tests/<id>.test.mjs` 에서 **다시 검증**해 통과한 것만 씁니다.
- `grader.js` 의 지표가 맞는지(정답 예시 → 만점, 틀린 예시 → 감점)도 테스트합니다.
- 논문 데이터를 가져올 때는 라이선스를 확인하고 `paper.license_note` 에 적습니다. 불명확하면 직접 만듭니다.

## 9. 제출 코드 형식 (참고)

패들릿용 제출 코드는 `[모듈id:반-번호:압축코드]` 형식입니다. 교사 평가 페이지는 붙여 넣은 글 속에서 이 형식만 찾아 읽습니다.
