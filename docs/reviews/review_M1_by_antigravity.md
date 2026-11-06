# M1 검토 — Antigravity

> 작성자: Antigravity · 작성일: 2026-11-06
> 대상: `docs/handoff/to_antigravity_02_M1.md` 및 M1 플랫폼 본체 코드 일체
> 검증 수행: `node --test "tests/*.test.mjs"` (16/16 통과 직접 확인) 및 전 파일 정적 코드·보안·접근성 분석

---

## ① 모듈 표준

### 동의하는 점
- **`FINAL_PLAN.md` 4-6절 세부 결정 전항 동의**:
  - `level_cut`을 **백분율**(0~100%) 기준으로 통일한 결정, 모듈 폴더 내 파일 이름(`activity.js`, `grader.js`, `schema.json`, `rubric.json`, `guide.md`) 고정, `module.json`의 `data` 객체 자동 로드, `init(container, meta, data, ctx)`의 4번째 인자 `ctx = { saved, onChange }` 추가에 모두 동의합니다.
  - M0 검토에서 제안했던 제출 코드 형식(`[모듈id:반-번호:gzip+base64url]`)과 A4 PNG 이미지 기반 인쇄 방식이 깔끔하게 반영되었습니다.
- **가이드 및 견본의 완결성**:
  - `docs/CONTRIBUTING_MODULE.md`와 `modules/_template/`만 읽고도 새 모듈을 본체 코드 수정 없이 100% 독립적으로 제작할 수 있습니다.
  - `tools/build-index.mjs`가 필수 파일·필수 필드·루브릭과 질문 ID 연결·`activity.js` 및 `grader.js`의 export 함수 유무까지 자동으로 검사해 주어 M2·M3 개발 시 실수를 즉시 잡아낼 수 있습니다.

### 우려되는 점 (근거: 파일:줄) 및 대안
1. **모듈 고유 스타일(CSS) 적용 방법 안내 보완** (`core/shell.js:39-48`, `docs/CONTRIBUTING_MODULE.md:46-65`)
   - **근거**: M2(`no-three-in-line` 격자 보드·컨트롤 바)와 M3(`matrix-mult` 수식 블록 조립기)는 모듈 고유 레이아웃 스타일이 필요합니다. 현재 `core/shell.js`는 모듈 폴더의 CSS 파일을 별도로 불러오지 않으며, `CONTRIBUTING_MODULE.md`에도 모듈 전용 스타일 작성법 안내가 없습니다.
   - **대안**: `module.json`에 선택 필드 `"style": "activity.css"`가 있거나 고정 파일 `activity.css`가 필요할 때를 위해, `core/shell.js`에서 `meta.style`이 지정된 경우 `<link rel="stylesheet">`를 동적 추가하도록 3줄을 보강하거나, 또는 파일 추가 없이 `activity.js` 안에서 처리하도록 `CONTRIBUTING_MODULE.md`에 한 줄 안내를 추가하는 것을 권장합니다.
2. **성취기준 출처(`source`) 검사 정규식의 우회 가능성** (`tools/build-index.mjs:14, 35-39`)
   - **근거**: `STANDARD_CODE = /^\d{2}[가-힣ⅠⅡ]+\d?-?\d{2}-\d{2}$/`에 매칭될 때만 `source` 유무를 검사하고 있어서, 만약 성취기준 코드를 `"10공수2-01-02 (확인됨)"`처럼 변형해 적으면 정규식에 걸리지 않아 `source`가 비어 있어도 통과됩니다.
   - **대안**: 정규식과 더불어 **`a.code !== '후보(확인 필요)'`이면 반드시 `a.source`가 비어 있지 않아야 한다**는 조건을 추가하면 출처 누락을 빈틈없이 막을 수 있습니다.

---

## ② 채점 정확성

### 동의하는 점
- **구간표 및 성취수준 경계 (`core/grade.js:4-26, 52`)**:
  - `scoreAuto`가 `tiers` 배열을 위에서부터 순회해 첫 번째로 일치하는 구간의 점수를 반환하고 `Math.min(t.score, item.max)`로 만점 초과를 방지합니다.
  - `gradeRow`에서 백분율을 `Math.round((total / max) * 1000) / 10`으로 계산하여 `90.0%`는 `A`, `89.9%`는 `B`로 판정하는 경계 동작이 정확합니다.
  - 출력물 수기 입력(`values === null`)일 때 자동 채점 항목도 `auto-manual`로 전환되어 교사가 입력할 수 있고, 모든 항목 점수가 채워져야 `complete: true`가 되는 로직이 정확합니다.
- **체크섬 범위 및 정규화 (`core/codec.js:6-38`)**:
  - `canonicalJSON`으로 키 순서를 정렬한 뒤 `{ meta, student, payload, reflections }` 전체를 SHA-256 해시 대상으로 삼아, 원자료·서술형 답·학생 정보 중 어디를 고쳐도 `'modified'`로 정확히 감지됩니다.

### 우려되는 점 (근거: 파일:줄) 및 대안
1. **교사가 서술형 점수를 선택할 때마다 `[답 보기]` 상세 행이 닫히는 현상** (`core/teacher.js:147-151, 187-190, 201`) **[중요 — 채점 UX]**
   - **근거**: 교사가 `[답 보기]` 버튼을 눌러 학생의 서술형 답안 행(`tr.detail`, 201행에서 `hidden: true`로 생성)을 펼쳐 읽은 뒤, `<select>`(155행)나 `<input class="score-input">`(159행)에서 점수를 입력하면 `onchange`가 `render()`(150행)를 호출합니다. 이때 `render()`가 표 전체를 새로 그리면서 모든 `tr.detail`이 다시 `hidden: true`가 되어 **방금 읽고 있던 답안 창이 닫혀 버립니다**. (특히 정리 질문이 `q1`, `q2` 2개일 때 `q1` 점수를 주면 답안이 닫혀서 `q2`를 채점하려면 `[답 보기]`를 다시 눌러야 합니다.)
   - **대안**: `row` 객체에 `expanded: false` 속성을 두고, `[답 보기]` 버튼(`187행`)에서 `row.expanded = !row.expanded; tr.hidden = !row.expanded;`로 토글하며, `201행`에서 `hidden: !row.expanded`로 렌더링하면 점수를 바꿔도 펼쳐진 답안 행이 그대로 유지됩니다.
2. **`validate.js`의 `NaN` / `Infinity` 방어** (`core/validate.js:8, 33`)
   - **근거**: `typeof NaN === 'number'`이므로 혹시라도 메모리상 객체에 `NaN`이 들어오면 `value < schema.minimum`과 `value > schema.maximum`이 모두 `false`가 되어 범위 검사를 통과합니다.
   - **대안**: `core/validate.js:8`에서 `if (typeof v === 'number') return !Number.isFinite(v) ? 'nan' : Number.isInteger(v) ? 'integer' : 'number';`로 한 줄 보강하면 완벽합니다.

---

## ③ 개인정보·보안

### 동의하는 점
- **외부 네트워크 요청 0건**: 모든 HTML, JS, CSS 및 `vendor/katex/katex.min.css` 내부의 `@font-face` 경로(`fonts/KaTeX_*.woff2`)까지 확인한 결과, 외부 서버나 CDN으로 나가는 요청이 전혀 없습니다.
- **공용 PC 임시 저장 보호 (`core/storage.js:24-27`)**: `saveDraft`에 `student`(반·번호·이름)가 포함되지 않으며, 당일(`YYYY-MM-DD`)이 아니면 자동 파기됩니다.
- **XSS 방어 (`core/markdown.js:5-12`, `core/ui.js:18`)**:
  - `el()` 도우미가 문자열 자식을 모두 `document.createTextNode`로 삽입하여 학생 이름이나 서술형 답안에 `<script>`나 `<img onerror=...>`가 들어와도 절대 실행되지 않습니다.
  - `markdownToHTML`도 `esc()`를 먼저 수행하고 링크에서 콜론(`:`)이 포함된 비표준 스킴(`javascript:` 등)을 차단하여 안전합니다.
- **CSV 수식 실행 방지 (`core/grade.js:63`)**: `=`, `+`, `-`, `@`, `\t`, `\r`로 시작하는 셀 앞에 `'`를 붙여 엑셀 수식 주입을 막고 있습니다.

### 우려되는 점 (근거: 파일:줄) 및 대안
1. **CSV 셀 앞쪽 공백·줄바꿈 뒤 수식 문자 방어 보강** (`core/grade.js:63`)
   - **근거**: 현재 `/^[=+\-@\t\r]/`로 검사하고 있는데, 학생 서술형 답안이 줄바꿈(`\n`)이나 공백(` `) 뒤에 `=SUM(...)`으로 시작할 경우 일부 스프레드시트에서 수식으로 해석될 여지가 있습니다.
   - **대안**: 정규식을 `/^[\s]*[=+\-@]|^[\t\r]/`로 살짝 넓히면 공백/줄바꿈 뒤에 오는 수식 기호까지 완벽히 방어됩니다.

---

## ④ 화면·접근성

### 동의하는 점
- **색각 이상 배려 (`core/ui.css:76-83`)**: 배지마다 테두리 선 모양(`solid`, `dashed`, `double`, `dotted`)이 다르고 상태 문단에 `✔`, `!`, `✖` 기호가 함께 표시되어 흑백 화면에서도 의미가 명확히 전달됩니다.
- **터치 영역 및 반응형 (`core/ui.css:52, 62, 104, 160`)**: 모든 버튼·입력창의 최소 높이가 `44px`(탭은 `48px`) 이상이며, 360px 폭에서도 가로 넘침이 없도록 `flex-wrap`과 `minmax(min(100%, ...), 1fr)`가 잘 적용되어 있습니다.
- **인쇄 품질 (`core/report.js`, `core/ui.css:151-159`)**: A4 비율 캔버스 이미지를 생성해 인쇄하므로 브라우저의 배경 그래픽 인쇄 옵션과 무관하게 격자·도형·채점란이 깨지지 않고 출력됩니다.

### 우려되는 점 (근거: 파일:줄) 및 대안
1. **PNG 보고서에서 질문·근거가 길 때 하단 교사 채점란(`boxY = H - 220`)과 겹칠 가능성** (`core/report.js:89, 97-104`)
   - **근거**: `core/report.js:98`에서 질문당 최대 줄 수 `perQ`를 `Math.max(3, Math.floor(room / qs.length / 32) - 2)`로 계산합니다. 만약 `evidence`가 5개(각 2줄씩 최대 10줄)이고 질문(`qs`)이 2~3개이면서 질문 문장(`q.prompt`) 자체가 2줄을 차지하면, 최소 3줄(`Math.max(3, ...)`) 강제 때문에 `y` 좌표가 `H - 220`(1534px, 교사 채점란 상단)을 넘어 글자와 채점란 테두리가 겹칠 수 있습니다.
   - **대안**: `core/report.js:99-104` 루프에서 각 질문의 답변 줄 수를 남은 공간(`Math.floor((H - 240 - y) / 31)`) 이하로 한 번 더 제한(`Math.max(1, Math.min(perQ, ...))`)하면 어떤 경우에도 교사 채점란을 침범하지 않습니다.
2. **수업 단계 탭 바(`role="tablist"`)의 좌우 화살표 키 이동** (`core/shell.js:78-84`)
   - **근거**: Tab 키로 이동 후 Enter/Space로 탭을 바꿀 수 있어 키보드 조작 자체는 가능하나, `role="tablist"` 표준 UX인 좌우 방향키(`ArrowLeft`, `ArrowRight`) 전환이 있으면 키보드 사용성이 더 좋아집니다.
   - **대안**: `tabBar()`에 좌우 화살표 키 입력 시 인접 탭으로 `showTab()`을 호출하는 짧은 핸들러 추가를 권장합니다(선택 사항).

---

## ⑤ 기타 (M2 시작 전 참고 사항)

- `teacher.html`에서 **[샘플 학급 불러오기]**를 두 번 누르면 같은 샘플 30명이 60명으로 중복 추가됩니다(`core/teacher.js:105-114`). 의도된 동작(여러 파일 추가와 동일)일 수 있으나, 연수·시연 중 실수로 두 번 누를 때를 대비해 이미 샘플이 로드되어 있으면 안내하거나 기존 샘플 행을 교체하는 방식도 고려해 볼 만합니다(사소한 개선).

---

## 결론: M2 진행 가능 여부

- **판정: 가능 (✅ M2 즉시 진행 가능)**
- M1 플랫폼 본체의 아키텍처, 모듈 표준 검사기, 원자료 재계산 채점 파이프라인, 4가지 제출 방식, 보안·개인정보 보호 모두 매우 높은 완성도로 구현되었습니다.
- 위에서 짚은 보완 제안들(특히 **②-1 `core/teacher.js`에서 채점 시 펼쳐진 답안 행(`row.expanded`) 유지** 및 **④-1 `core/report.js` 하단 채점란 겹침 방지**)은 코드 몇 줄로 수정 가능한 사항이므로, M2(`no-three-in-line`) 개발과 함께 반영해 주시면 됩니다.

