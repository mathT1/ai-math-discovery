// 채점: grader.js가 돌려준 지표 → rubric.json 구간표로 점수, 성취수준, CSV (DOM 없음)

/** 자동 항목 1개 점수. tiers는 위에서부터 처음 맞는 구간을 씀 */
export function scoreAuto(item, values) {
  const v = values?.[item.metric];
  if (typeof v !== 'number' || Number.isNaN(v)) return { score: 0, note: `지표 '${item.metric}' 없음` };
  for (const t of item.tiers ?? []) {
    const ok = (t.min === undefined || v >= t.min) &&
               (t.max === undefined || v <= t.max) &&
               (t.eq === undefined || v === t.eq);
    if (ok) return { score: Math.min(t.score, item.max) };
  }
  return { score: 0 };
}

export const maxTotal = (rubric) => rubric.items.reduce((s, it) => s + it.max, 0);

/** 백분율 → 성취수준. level_cut은 백분율(0~100) 기준, scale 순서대로 처음 넘는 단계 */
export function levelFor(percent, rubric) {
  const scale = rubric.scale ?? ['A', 'B', 'C', 'D', 'E'];
  const cuts = rubric.level_cut ?? {};
  for (const lv of scale) {
    if (cuts[lv] !== undefined && percent >= cuts[lv]) return lv;
  }
  return scale[scale.length - 1];
}

/**
 * 학생 1명 채점
 * @param {object} p
 * @param {object} p.rubric
 * @param {object|null} p.values   grader 지표 (출력물 수기 입력이면 null)
 * @param {object} p.reflections   정리 질문 답
 * @param {object} p.manual        교사가 매긴 점수 { itemId: score }
 */
export function gradeRow({ rubric, values, reflections = {}, manual = {} }) {
  const items = rubric.items.map((it) => {
    const answer = it.question ? String(reflections[it.question] ?? '').trim() : '';
    const answered = it.question ? answer.length > 0 : null;
    if (it.type === 'auto' && values) {
      const { score, note } = scoreAuto(it, values);
      return { id: it.id, type: 'auto', score, note, answered };
    }
    // 교사 항목, 또는 원자료가 없는(출력물) 자동 항목 → 교사가 점수 입력
    const m = manual[it.id];
    const score = m === undefined || m === null || m === '' ? null : Math.max(0, Math.min(Number(m), it.max));
    return { id: it.id, type: it.type === 'auto' ? 'auto-manual' : 'teacher', score, answered };
  });
  const max = maxTotal(rubric);
  const total = items.reduce((s, it) => s + (it.score ?? 0), 0);
  const complete = items.every((it) => it.score !== null);
  const percent = max ? Math.round((total / max) * 1000) / 10 : 0;
  return { items, total, max, percent, level: levelFor(percent, rubric), complete };
}

// ---------- CSV ----------

function csvCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  let s = String(v);
  // 엑셀 수식 실행 방지: (공백·줄바꿈 뒤라도) =, +, -, @ 로 시작하거나 탭·CR로 시작하면 앞에 ' 를 붙임
  if (/^\s*[=+\-@]|^[\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** UTF-8 BOM 포함 CSV 문자열 (엑셀에서 한글이 깨지지 않음) */
export function toCSV(rows) {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
