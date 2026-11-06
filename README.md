# AI 수학 발견 수업 플랫폼

AI가 수학 난제를 탐구한 실제 연구 논문을 바탕으로 만든, 고등학교 수학 **단원·주제별 체험형 웹 활동** 모음입니다.

- 설치 없이 브라우저에서 실행 (학교 PC·크롬북·태블릿)
- 학생은 활동 후 결과물(PNG 보고서 + JSON)을 저장해 제출
- 교사는 평가 페이지에서 결과물을 한꺼번에 채점하고 CSV로 내려받음
- 학생 정보는 어디에도 전송·저장하지 않음 (모든 처리는 각자의 브라우저 안에서)
- 한 번 접속해 두면 인터넷이 끊겨도 동작 (현장 시연·불안정한 학교망)
- 교사 연수·시연용 샘플 학급(30명) 데이터 포함

> 현재 상태: **출품 준비 (M5) — 모듈 2개 공개, 기기 점검 후 v1.0.0**. 계획은 [`docs/FINAL_PLAN.md`](docs/FINAL_PLAN.md), 기기 점검·시연 절차는 [`docs/DEVICE_CHECK.md`](docs/DEVICE_CHECK.md) 참고.

## 첫 버전 모듈

| 모듈 | 과목·단원 | 논문 |
|---|---|---|
| 세 점이 한 직선 위에 놓이지 않게 | 공통수학2 도형의 방정식 | [arXiv:2512.11469](https://arxiv.org/abs/2512.11469) |
| 곱셈 한 번을 줄여라 | 공통수학1 행렬 | [AlphaTensor, Nature 2022](https://www.nature.com/articles/s41586-022-05172-4) |

## 내 컴퓨터에서 미리보기

Node.js 22 이상이 필요합니다(설치할 패키지는 없음).

```bash
node tools/serve.mjs            # http://localhost:8000  (만드는 중 모듈까지: /?drafts)
node tools/build-index.mjs      # 모듈 목록 + 오프라인용 sw.js 생성, 표준 검사
node tools/make-samples.mjs     # 샘플 학급 데이터 다시 만들기 (samples/)
node --test "tests/*.test.mjs"  # 단위 테스트
node tests/e2e-browser.mjs [모듈id]  # 브라우저 종단 테스트 (Chrome, 미리보기 서버 실행 중일 때)
node tests/e2e-offline.mjs      # 오프라인 종단 테스트 (서버를 직접 띄웠다 끔)
node tests/e2e-bulk.mjs         # 일괄 채점 40명 (미리보기 서버 실행 중일 때)
node tools/exhibition/capture.mjs       # 출품용 화면 사진·지도안 PDF
node tools/exhibition/record-demo.mjs   # 시연 영상 (Python + opencv-python 필요)
```

미리보기(localhost)에서는 고친 파일이 바로 보이도록 오프라인 저장이 꺼져 있습니다. 시험하려면 주소 끝에 `?sw=1`을 붙이세요.

파일을 더블클릭해 열면 브라우저 보안 규칙 때문에 동작하지 않습니다.

## 새 모듈 추가

`modules/_template/`을 복사해 폴더 하나를 추가하면 목록·평가에 자동 반영됩니다. 자세한 방법은 [`docs/CONTRIBUTING_MODULE.md`](docs/CONTRIBUTING_MODULE.md)를 참고하세요.

## 라이선스

- 코드: [MIT](LICENSE)
- 교육 콘텐츠: [CC BY 4.0](LICENSE-CONTENT.md)
