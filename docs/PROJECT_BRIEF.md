# PROJECT BRIEF — AI 수학 발견 논문 기반 수업 플랫폼

> 이 문서는 **Claude Code**와 **Antigravity**가 함께 읽고, 서로 협의해 **최종 프로그램 계획안**을 만들기 위한 기준 문서입니다.
> 작성일: 2026-11-05 · 요청자: 동규 (고등학교 수학교사)
> 이 문서의 내용은 **요구사항과 초안 제안**입니다. 기술 선택과 구조는 두 에이전트가 협의해 확정합니다.

---

## 1. 프로젝트 한 줄 요약

AI가 수학 난제를 탐구한 실제 연구 논문을 바탕으로, 고등학교 수학 **단원·주제별 체험형 웹 프로그램**을 모은 **공개 수업 플랫폼**을 만든다.
학생은 활동하고 **결과물을 다운로드**하며, 교사는 그 결과물로 **평가**한다. 새 아이디어(모듈)를 계속 추가할 수 있어야 한다.

- 용도: 수업 활용 + 전국 교육자료전 출품
- 출발점: [awesome-ai-for-math](https://seewoo5.github.io/awesome-ai-for-math/) 논문 목록에서 고교 과정과 연결되는 논문 선별

---

## 2. 요청자의 요구사항 (반드시 지킬 것)

| # | 요구사항 | 비고 |
|---|---|---|
| R1 | 논문별 프로그램을 **단원·주제별로 묶은 플랫폼** 형식 | 첫 화면에서 단원/주제로 찾아 들어감 |
| R2 | **웹에서 작동** | 설치 없이 학교 PC·크롬북·태블릿 브라우저에서 실행 |
| R3 | **GitHub에 올려 누구나 접속·사용** | 공개 저장소 + 공개 URL |
| R4 | 학생이 **결과물을 다운로드** | 활동 기록, 답, 그림 등 |
| R5 | 결과물로 **평가** 가능 | 교사가 결과물을 모아 채점·확인 |
| R6 | 나중에 **다른 단원·주제의 모듈을 쉽게 추가** | 확장 구조가 핵심 설계 기준 |
| R7 | 수준은 **고등학교 교육과정** 범위 | 대학 수학 개념은 직관적 설명으로만 |

---

## 3. 사용자

| 사용자 | 하는 일 |
|---|---|
| 학생 | 모듈 선택 → 활동(탐구·게임·시뮬레이션) → 결과물 다운로드 → 제출 |
| 교사 | 단원에 맞는 모듈 선택 → 수업 진행 → 학생 결과물 수집 → 평가·피드백 |
| 기여자(향후) | 새 아이디어를 모듈 표준에 맞춰 추가 |

---

## 4. 초기 모듈 후보 (논문 9편)

### 4-1. 1순위 (교과 직결, 시각화 용이) — 첫 버전(MVP)은 여기서 1~2개로 시작 권장

| ID(가안) | 논문 | 핵심 수학 | 교과 연계 | 활동 아이디어 | 참고 코드 |
|---|---|---|---|---|---|
| `matrix-mult` | [AlphaTensor](https://www.nature.com/articles/s41586-022-05172-4) (Nature 2022) | 행렬 곱셈 횟수 줄이기 (2×2: 8번 → 7번, 스트라센) | 공통수학1 행렬, 정보 | 2×2 행렬 곱을 7번 곱셈으로 재구성하는 퍼즐 | [GitHub](https://github.com/google-deepmind/alphatensor) |
| `no-three-in-line` | [Three methods, one problem: no-three-in-line](https://arxiv.org/abs/2512.11469) | n×n 격자에 세 점이 일직선에 놓이지 않게 최대 배치 | 공통수학2 도형의 방정식(기울기·공선), 경우의 수 | 격자 점 배치 게임 + 공선 자동 판정 + AI 해 비교 | [GitHub](https://github.com/pranav-ramanathan/N3L_PatternBoost) |
| `colored-plane` | [Do Machines Dream of Colored Planes?](https://arxiv.org/abs/2501.18527) | 거리 1인 두 점이 다른 색이 되게 평면 색칠 (하드비거–넬슨 문제) | 두 점 사이 거리, 원의 방정식 | 평면 색칠 시뮬레이터, 학생 해 vs 신경망 해 | 없음 |
| `continued-fraction` | [Ramanujan Machine](https://www.pnas.org/doi/10.1073/pnas.2321440121) (PNAS 2024) | π, e의 연분수 공식 발견 | 수열, 수열의 극한, 급수 | 연분수 단계별 계산 → π, e 수렴 시각화 | [GitHub](https://github.com/RamanujanMachine/) |

### 4-2. 2순위 (융합형)

| ID(가안) | 논문 | 핵심 수학 | 교과 연계 | 참고 코드 |
|---|---|---|---|---|
| `symbolic-integration` | [Deep Learning for Symbolic Mathematics](https://arxiv.org/abs/1912.01412) | 트랜스포머로 적분·미분방정식 풀이 | 미적분 + 인공지능 기초 | [GitHub](https://github.com/facebookresearch/SymbolicMathematics) |
| `kissing-number` | [Finding Kissing Numbers with RL](https://arxiv.org/abs/2511.13391) | 한 원/구에 접하는 원/구의 최대 개수 (평면 6, 공간 12) | 기하, 공간 감각 | [GitHub](https://github.com/CDM1619/PackingStar) |
| `shellsort` | [A New Gap Sequence for Shellsort](https://arxiv.org/abs/2609.29881) | 강화학습으로 셸 정렬 간격 수열 발견 | 수열 + 정보(정렬) | 없음 |
| `factoring-game` | [Searching for Primes: AlphaZero Factoring Game](https://arxiv.org/abs/2609.22968) | 소인수분해 게임에서 AI와 대결 | 소인수분해, 수업 도입 | [GitHub](https://github.com/crasmarum/TokenGame) |
| `graph-counterexample` | [Constructions in combinatorics via neural networks](https://arxiv.org/abs/2104.14516) | AI로 그래프 추측의 반례 탐색 | 이산수학(동아리 수준) | [GitHub](https://github.com/zawagner22/cross-entropy-for-combinatorics) |

> 주의: 교과 연계 단원은 초안입니다. 최종 계획안에서는 **2022 개정 교육과정 성취기준 코드를 실제 문서로 확인**한 뒤 적을 것. 확인 못 한 코드는 지어내지 말고 "확인 필요"로 표시할 것.

---

## 5. 설계 방향 (초안 — 협의로 확정)

### 5-1. 호스팅·운영
- **제안**: GitHub 공개 저장소 + **GitHub Pages 정적 사이트**. 서버·DB·로그인 없음 → 비용 0, 학교망에서 접속 쉬움, 유지보수 부담 적음.
- 무거운 AI 모델은 브라우저에서 돌리지 않는다. 논문의 **결과(최적해, 예시 데이터)를 JSON으로 미리 담아** 학생 결과와 비교하는 방식을 우선 검토.
- 계산이 필요하면 JavaScript(또는 Pyodide 등 브라우저 Python)로 처리. 선택 근거를 계획안에 적을 것.

### 5-2. 개인정보
- 학생 정보를 서버로 **보내거나 저장하지 않는다**. 이름·학번은 결과물 파일 안에만 들어가고, 파일은 학생 기기에 저장.
- 외부 분석 도구·광고·추적 스크립트 사용 금지.

### 5-3. 결과물과 평가 흐름 (제안)
1. 학생이 활동 후 **결과물 다운로드**: 사람이 읽는 형식(PDF 또는 PNG 보고서) + 기계가 읽는 형식(JSON).
2. 학생이 학교에서 쓰는 방식(클래스룸, 패들릿 등)으로 교사에게 제출.
3. 교사는 플랫폼의 **교사용 평가 페이지**에 JSON 파일들을 한꺼번에 올림 → 모듈별 루브릭으로 자동 채점·집계 → 결과를 CSV/엑셀로 다운로드.
4. 이 모든 처리는 **교사 브라우저 안에서만** 실행 (서버 전송 없음).
5. JSON 위·변조 방지 수준(예: 간단한 체크섬)은 필요성을 협의해 결정.

### 5-4. 확장 구조 (가장 중요)
새 모듈 추가 = **폴더 하나 + 메타데이터 파일 하나 추가**로 끝나야 한다. 플랫폼 본체 코드를 고치지 않아도 목록·검색·평가에 자동 반영.

모듈 메타데이터 초안 (`modules/<id>/module.json`):
```json
{
  "id": "no-three-in-line",
  "title": "세 점이 한 직선 위에 놓이지 않게",
  "subject": "공통수학2",
  "unit": "도형의 방정식",
  "topics": ["기울기", "공선", "경우의 수"],
  "achievement_standards": ["확인 필요"],
  "grade": ["고1"],
  "periods": 1,
  "difficulty": 2,
  "paper": {
    "title": "Three methods, one problem: Classical and AI approaches to no-three-in-line",
    "url": "https://arxiv.org/abs/2512.11469",
    "code": "https://github.com/pranav-ramanathan/N3L_PatternBoost"
  },
  "output_schema": "schema.json",
  "rubric": "rubric.json",
  "teacher_guide": "guide.md"
}
```

모듈 폴더 구성 초안:
```
modules/<id>/
  module.json      # 메타데이터 (목록·검색·필터용)
  index.html|js    # 활동 화면
  schema.json      # 결과물 JSON 형식
  rubric.json      # 평가 기준 (자동 채점 항목 + 교사 판단 항목)
  guide.md         # 교사용 지도안 (차시 흐름, 발문, 예상 오개념)
  data/            # 논문 결과 데이터 (AI 해 등)
```

### 5-5. 화면 구성 (초안)
- **홈**: 단원별 / 주제별 / 난이도별 모듈 카드
- **모듈 화면**: 도입(논문 이야기를 고교 수준으로) → 활동 → AI 결과와 비교 → 정리 질문 → 결과물 다운로드
- **교사용**: 지도안, 루브릭, 평가 페이지(결과물 일괄 업로드·집계)
- **추가 가이드**: 새 모듈 만드는 방법 문서

### 5-6. 공통 품질 기준
- 한국어 UI, 수식 표시(KaTeX 등), 모바일·태블릿 화면 대응
- 오프라인에서도 한 번 열면 동작하면 좋음(선택)
- 수학 내용 정확성: 각 모듈의 수학적 사실은 논문·교과서로 검증
- 접근성: 색만으로 정보 구분 금지(색칠 모듈은 패턴·번호 병행)

---

## 6. 에이전트 협업 지시 (Claude Code ↔ Antigravity)

목표: 두 에이전트가 **각자 계획안을 쓰고, 서로 검토하고, 합의한 최종 계획안 1개**를 만든다. 코드 개발은 **요청자 승인 후** 시작한다.

### 6-1. 작업 폴더 규칙
```
docs/
  PROJECT_BRIEF.md          # 이 문서 (요청자만 수정)
  plans/
    plan_claude.md          # Claude Code 초안
    plan_antigravity.md     # Antigravity 초안
  reviews/
    review_by_claude.md     # Claude Code가 Antigravity 초안을 검토
    review_by_antigravity.md# Antigravity가 Claude Code 초안을 검토
  DISCUSSION_LOG.md         # 합의·쟁점 기록 (양쪽이 이어서 작성)
  FINAL_PLAN.md             # 합의된 최종 계획안
```

### 6-2. 진행 단계
1. **1단계 – 독립 초안**: 각자 이 문서를 읽고 `plans/plan_<이름>.md` 작성. 상대 초안을 보기 전에 먼저 쓸 것.
2. **2단계 – 교차 검토**: 상대 초안을 읽고 `reviews/review_by_<이름>.md` 작성. 형식: 동의하는 점 / 우려되는 점(근거 포함) / 대안.
3. **3단계 – 합의**: 쟁점을 `DISCUSSION_LOG.md`에 표로 정리 (쟁점 · Claude 의견 · Antigravity 의견 · 합의 결과 · 근거). 합의가 안 되면 두 안을 모두 적고 **요청자 결정 필요**로 표시.
4. **4단계 – 최종안**: `FINAL_PLAN.md` 작성. 맨 위에 "요청자 결정 필요 항목" 목록을 둘 것.
5. **5단계 – 승인**: 요청자가 승인하면 개발 시작. 승인 전에는 코드 작성 금지(프로토타입 실험이 필요하면 `sandbox/` 폴더에서만, 계획안에 명시).

### 6-3. 협의 원칙
- 근거 없는 주장 금지. 기술 선택은 이유(학교 환경, 유지보수, 비용, 확장성)와 함께.
- 요구사항 R1~R7을 어기는 안은 채택하지 않는다.
- 단순한 쪽을 우선한다. 교사 한 명이 유지보수할 수 있는 규모여야 한다.
- 상대 의견을 바꿀 때는 무엇 때문에 바뀌었는지 기록.

### 6-4. FINAL_PLAN.md에 반드시 들어갈 항목
1. 요청자 결정 필요 항목
2. 기술 스택과 선택 이유
3. 저장소 폴더 구조
4. 모듈 표준 (module.json, 결과물 스키마, 루브릭 형식) 확정안
5. 결과물 다운로드 형식과 평가 흐름
6. MVP 범위: 첫 출시 모듈(1~2개)과 기능
7. 모듈별 상세 설계: 학습 목표, 성취기준(확인된 것만), 활동 흐름, 결과물, 루브릭
8. 단계별 개발 일정 (마일스톤과 완료 기준)
9. 테스트 계획 (수학 정확성, 브라우저 호환, 학생 시범 사용)
10. GitHub 배포·버전 관리 방식
11. 새 모듈 추가 절차 (기여 가이드 초안)
12. 교육자료전 출품을 위한 산출물 목록 (보고서·시연 영상 등에 필요한 것)
13. 위험 요소와 대응

---

## 7. 요청자 확인이 필요한 사항 (계획안에서 질문으로 정리)

- 첫 버전에 넣을 모듈 1~2개 선택
- 결과물 형식: PDF, PNG, JSON 중 무엇을 학생에게 보여줄지
- 평가 방식: 자동 채점 비중 vs 교사 판단 비중, 점수형 vs 성취수준형(A~E)
- 학생 제출 경로: 학교에서 쓰는 플랫폼(클래스룸, 패들릿, e학습터 등)
- 교육자료전 출품 일정과 제출물 요건
- 저장소 공개 범위와 라이선스(예: MIT, CC BY)

---

## 8. 참고 자료

- 논문 목록: https://seewoo5.github.io/awesome-ai-for-math/
- 논문·코드 링크: 4절 표
- 아이디어 원문 보관: Claude Docs '연구대회 아이디어' 2번 항목
