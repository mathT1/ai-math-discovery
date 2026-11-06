# M4 검토 (최종) — Antigravity

- **검토 대상**: M4 (품질·오프라인 서비스 워커·샘플 학급 데이터·기기 점검표 및 시연 절차)
- **검토 기준**: [`docs/FINAL_PLAN.md`](../FINAL_PLAN.md), [`docs/FACT_SOURCES.md`](../FACT_SOURCES.md), [`docs/handoff/to_antigravity_05_M4.md`](../handoff/to_antigravity_05_M4.md)
- **단위 테스트 실행 결과**: `node --test "tests/*.test.mjs"` → **52 / 52 전체 통과** (`samples.test.mjs` 포함)

---

## ① 오프라인 설계 (`tools/sw-template.js`, `tools/build-index.mjs`, `core/offline.js`)

### 동의하는 점
- **자동 파일 수집 및 내용 해시 기반 버전 관리**: [`tools/build-index.mjs`](../../tools/build-index.mjs) (139~160줄)에서 루트 HTML(`index.html`, `teacher.html`, `guide.html`)과 `core/`, `vendor/`, `modules/`, `samples/` 하위 정적 파일 및 폴더 경로(`modules/<id>/`, `./`) 총 78개 주소를 빠짐없이 수집합니다. 특히 CRLF/LF 줄바꿈 정규화 후 SHA-256 해시를 계산해 `VERSION`(`0.2.0-<10자해시>`)을 생성하므로, 어떤 정적 파일이든 1바이트만 바뀌어도 새 캐시 이름으로 깔끔하게 교체됩니다.
- **설치 시 브라우저 HTTP 캐시 우회**: [`tools/sw-template.js`](../../tools/sw-template.js) (15줄)에서 `new Request(f, { cache: 'reload' })`로 프리캐시를 수행하여, 새 버전의 서비스 워커가 설치될 때 브라우저의 오래된 HTTP 캐시가 섞여 들어가는 문제를 원천 차단했습니다.
- **쿼리 문자열 무시 매칭(`ignoreSearch: true`)**: [`tools/sw-template.js`](../../tools/sw-template.js) (48줄)에서 `cache.match(req, { ignoreSearch: true })`를 사용하여 `?drafts`, `?id=no-three-in-line`, `?submit=...` 등 쿼리 파라미터가 붙은 URL로 오프라인 진입하더라도 캐시된 `index.html`, `teacher.html`, 모듈 `index.html`로 정확히 응답합니다.
- **안전한 업데이트 전환 및 개인정보 무저장**: 첫 설치(`!self.registration.active`) 시에는 즉시 `skipWaiting()`으로 오프라인 준비를 마치고, 기존 서비스 워커가 있는 상태에서 새 버전이 감지되면 하단 배너의 `[새로고침]` 버튼을 눌렀을 때만 `SKIP_WAITING`을 보내 전환합니다([`core/offline.js`](../../core/offline.js) 58~77줄). 덕분에 학생이 탐구 중이거나 교사가 채점 중일 때 화면이 갑자기 새로고침되어 작업 상태가 유실될 위험이 없습니다. 또한 캐시에는 정적 사이트 파일만 저장되고 학생 이름·결과물은 일절 저장되지 않으며, `?nosw` 비상 해제 스위치도 정상 동작합니다.

### 우려되는 점 (근거: 파일:줄)
- **경미한 UX 참고 사항 (비필수)**: [`core/offline.js`](../../core/offline.js) (10~17줄)에서 `?nosw`로 접속하면 서비스 워커 등록 해제와 `aimath-*` 캐시 삭제 후 *"오프라인 저장을 해제했습니다. 한 번 더 새로고침하면 인터넷에서 새로 받습니다."*라는 배너를 띄웁니다. 이때 주소창에 `?nosw`가 그대로 남아 있으면 사용자가 단순 새로고침(`F5`)을 한 뒤에도 계속 `?nosw` 분기를 타서 서비스 워커가 재등록되지 않습니다. (단, [`docs/DEVICE_CHECK.md`](../DEVICE_CHECK.md) 87줄에 *"새로고침 후 다시 원래 주소(홈)로 열면"*이라고 안내되어 있어 실제 사용에는 지장이 없습니다.)

### 대안
- 현재 구조 그대로 출품해도 무방합니다. 만약 추후 다듬는다면 [`core/offline.js`](../../core/offline.js) (15줄)에서 `unregisterAndClear()` 완료 후 `history.replaceState(null, '', location.pathname)`으로 주소창의 `?nosw`를 지워 주면 단순 새로고침만으로도 깔끔하게 복구됩니다(선택 사항).

---

## ② 샘플 데이터 (`tools/make-samples.mjs`, `samples/*.json`, `tests/samples.test.mjs`)

### 동의하는 점
- **결정론적(Deterministic) 생성 및 무결성 보장**: [`tools/make-samples.mjs`](../../tools/make-samples.mjs) (14~20줄, 41~48줄)에서 고정 시드 PRNG(`rng(20261215)`, `rng(20261216)`)와 실제 [`core/schema.js`](../../core/schema.js)의 `buildResult`를 사용하여, 언제 재생성하더라도 동일한 30명 데이터가 만들어지며 60건 모두 `verifyChecksum`이 `'ok'`(SHA-256 일치)로 통과합니다.
- **가상 학급 개인정보 안전성**: 학생 이름이 `샘플 01` ~ `샘플 30`, 학급이 `1-3`으로 통일되어 있어 실제 학생 개인정보로 오인될 여지가 전혀 없습니다([`tests/samples.test.mjs`](../../tests/samples.test.mjs) 30~31줄에서 자동 검증).
- **채점 기준표(`rubric.json`)와의 정합성**: [`tools/make-samples.mjs`](../../tools/make-samples.mjs) (57~77줄, 130~147줄)의 점수대별(30/20/10/0점) 서술형 답안 문장이 각 모듈 `rubric.json`의 수준 기술(예: 세로선 분모 0 처리 및 비둘기집 원리 $2n$ 상한 설명 / 블록 행렬 반복 적용과 $\bmod\ 2$ 조건 및 $2\times 2$ 7번 유지 설명)과 정확히 부합합니다.
- **시연 맞춤형 구성(1~20번 채점 완료 + 21~30번 미채점)**: 교사 평가 페이지에서 샘플 버튼을 누르자마자 1~20번의 성취수준(A~E) 집계와 CSV 내보내기를 즉시 보여 줄 수 있고, 동시에 21~30번의 빈 드롭다운을 심사위원 앞에서 직접 선택해 실시간 합산·등급 산출 과정을 시연할 수 있습니다.

### 우려되는 점 (근거: 파일:줄)
- **등급 분포 참고 의견 (비필수)**: [`tools/make-samples.mjs`](../../tools/make-samples.mjs) (166~172줄)로 생성된 `samples/matrix-mult-30.json`의 채점 완료분(1~20번) 등급 분포가 `A 7 · B 2 · C 1 · D 1 · E 9`입니다. [`tests/samples.test.mjs`](../../tests/samples.test.mjs) (52~53줄)의 검증 기준(4개 이상 등급 등장, 단일 등급 최대 10명 이하)을 통과하고 다양한 감점·오답 사례(짝수 조건 위반 등)를 보여 주기에 좋으나, `no-three-in-line`(`A 7 · B 1 · C 3 · D 4 · E 5`)과 비교하면 C·D가 각 1명이고 E가 9명이라 중간 등급(C·D) 비중이 살짝 적습니다.

### 대안
- 시연 및 기능 검증에는 현재 상태로도 충분하므로 **필수 수정 사항은 아닙니다**. 만약 M5 작업 중 여유가 있다면 `matrix-mult`의 16~19번 중 2명 정도의 서술형 기본 점수(`base: 10`)를 `20`으로 조정해 C·D를 2~3명으로 늘리고 E를 7명선으로 맞추면 분포 막대가 한층 고르게 보일 것입니다(선택 사항).

---

## ③ 기기 점검표·시연 절차 (`docs/DEVICE_CHECK.md`)

### 동의하는 점
- **학교 현장 기기·브라우저 망라**: [`docs/DEVICE_CHECK.md`](../docs/DEVICE_CHECK.md) (11~29줄)에서 교실 윈도우 PC(크롬·엣지·웨일), 시연 노트북, 학교 관리 크롬북, 아이패드(사파리), 안드로이드 태블릿까지 7가지 환경별 점검 항목을 구체적으로 제시했습니다. 특히 학교 관리 크롬북의 클립보드·파일 다운로드 정책 차단 시 대처법(긴 주소/QR 코드)과 시크릿 창 종료 시 `localStorage` 초기화 주의사항까지 꼼꼼하게 다루었습니다.
- **7분 현장 시연 절차의 완결성**: [`docs/DEVICE_CHECK.md`](../docs/DEVICE_CHECK.md) (92~174줄)의 7단계 시연 동선(① 홈 개인정보 무전송 안내 → ② 모듈 1 격자·공선·힌트 → ③ 고전 vs AI 구성 비교 → ④ 모듈 2 스트라센 1단계 소거 → ⑤ $4\times 4$ 47번 및 $\bmod\ 2$ 주의점 → ⑥ 4가지 제출 방식 및 PNG 보고서 → ⑦ 교사 평가 페이지 샘플 30명 원클릭 로드·재검산·채점·CSV)이 요구사항 R1~R7과 출품작의 핵심 강점을 7분 안에 빈틈없이 보여 주도록 구성되어 있습니다.

### 우려되는 점 (근거: 파일:줄)
- 우려되는 점 없음.

### 대안
- 대안 불필요 (현재 문서 그대로 시연 대본 및 현장 점검표로 활용 가능).

---

## ④ 전체 최종 점검

### 동의하는 점
- **사실성(Fact-check) 및 금지 표현 전수 검사 통과**: [`docs/FACT_SOURCES.md`](../FACT_SOURCES.md) 5절에 명시된 금지 문장 6개(*"2n개 달성이 항상 가능하다"*, *"PatternBoost가 대칭성을 강제한다"*, *"FunSearch가 이 문제를 풀었다"*, *"AlphaTensor가 2×2에서 6번 곱셈을 찾았다"*, *"AlphaTensor가 일반 행렬에서 4×4 47번을 찾았다"*, *"7×4 = 28, 7×7 = 49가 AlphaTensor 기록이다"*)가 `index.html`, `teacher.html`, `guide.html`, `core/`, `modules/`, `samples/` 어디에도 포함되지 않았음을 확인했습니다.
- **문서·메타데이터·테스트 일관성**: [`README.md`](../../README.md)의 상태 배지(`M4 품질·오프라인 — 모듈 2개 공개`), 실행 명령어, 오프라인·개인정보 안내가 실제 구현과 정확히 일치하며, 52개 단위 테스트와 오프라인 E2E 검증 시나리오([`tests/e2e-offline.mjs`](../../tests/e2e-offline.mjs))가 모두 완비되었습니다.

### 우려되는 점 (근거: 파일:줄)
- 출품 전 기능을 가로막는 필수 수정 사항(Blocker) 없음.

### 대안
- 없음.

---

## 결론: M5(출품 산출물) 진행 가능 여부 + 출품 전 필수 수정 목록

- **M5 진행 가능 여부**: **즉시 진행 가능 (승인)**
  - M0~M4에 걸친 모든 기능 요구사항(R1~R7), 오프라인 동작(서비스 워커 프리캐시 78종), 가상 학급 샘플 60건(30명×2모듈), 기기 점검표 및 7분 시연 절차가 완벽하게 구현·검증되었습니다.
- **출품 전 필수 수정 목록**: **없음 (0건)**
  - 본 검토서의 ①(`?nosw` 주소창 정리)과 ②(`matrix-mult` 샘플 C·D/E 등급 비율 미세 조정)에 적은 제안은 모두 선택 사항(Nice-to-have)이므로, 코드 수정 없이 바로 **M5(출품 산출물 정리)** 단계로 넘어가도 좋습니다.

