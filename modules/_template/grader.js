// [견본] 채점 지표 — 학생이 낸 원자료(payload)로 다시 계산합니다 [D10]
// 반환: { values: { 지표이름: 숫자 }, evidence: ['사람이 읽는 근거 문장'] }
// rubric.json의 auto 항목은 values의 숫자를 구간표(tiers)로 점수로 바꿉니다.
// DOM을 쓰지 마세요 (교사 페이지와 Node 테스트에서도 실행됨).

export function metrics(payload) {
  const expected = (payload.n * (payload.n + 1)) / 2;
  const correct = payload.answer === expected ? 1 : 0;
  return {
    values: { correct, n: payload.n },
    evidence: [
      `n = ${payload.n}, 정답 ${expected}, 학생 답 ${payload.answer ?? '없음'} → ${correct ? '맞음' : '틀림'}`,
    ],
  };
}
