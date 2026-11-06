# AI 수학 발견 수업 플랫폼

AI가 수학 난제를 탐구한 실제 연구 논문을 바탕으로 만든, 고등학교 수학 **단원·주제별 체험형 웹 활동** 모음입니다.

- 설치 없이 브라우저에서 실행 (학교 PC·크롬북·태블릿)
- 학생은 활동 후 결과물(PNG 보고서 + JSON)을 저장해 제출
- 교사는 평가 페이지에서 결과물을 한꺼번에 채점하고 CSV로 내려받음
- 학생 정보는 어디에도 전송·저장하지 않음 (모든 처리는 각자의 브라우저 안에서)

> 현재 상태: **개발 중 (M1 본체 완성, 모듈은 M2부터)**. 계획은 [`docs/FINAL_PLAN.md`](docs/FINAL_PLAN.md) 참고.

## 첫 버전 모듈 (예정)

| 모듈 | 과목·단원 | 논문 |
|---|---|---|
| 세 점이 한 직선 위에 놓이지 않게 | 공통수학2 도형의 방정식 | [arXiv:2512.11469](https://arxiv.org/abs/2512.11469) |
| 행렬 곱셈 횟수 줄이기 | 공통수학1 행렬 | [AlphaTensor, Nature 2022](https://www.nature.com/articles/s41586-022-05172-4) |

## 내 컴퓨터에서 미리보기

Node.js 22 이상이 필요합니다(설치할 패키지는 없음).

```bash
node tools/serve.mjs            # http://localhost:8000  (만드는 중 모듈까지: /?drafts)
node tools/build-index.mjs      # 모듈 목록 생성 + 표준 검사
node --test "tests/*.test.mjs"  # 단위 테스트
node tests/e2e-browser.mjs      # 브라우저 종단 테스트 (Chrome, 미리보기 서버 실행 중일 때)
```

파일을 더블클릭해 열면 브라우저 보안 규칙 때문에 동작하지 않습니다.

## 새 모듈 추가

`modules/_template/`을 복사해 폴더 하나를 추가하면 목록·평가에 자동 반영됩니다. 자세한 방법은 [`docs/CONTRIBUTING_MODULE.md`](docs/CONTRIBUTING_MODULE.md)를 참고하세요.

## 라이선스

- 코드: [MIT](LICENSE)
- 교육 콘텐츠: [CC BY 4.0](LICENSE-CONTENT.md)
