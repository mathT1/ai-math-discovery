// 활동 임시 저장 — 공용 PC 개인정보 보호 [D16]
// - 이름·반·번호는 저장하지 않음
// - 저장한 날(당일)에만 복원, 날짜가 바뀌면 자동 삭제
// - 저장이 막힌 환경(시크릿 창 등)에서도 오류 없이 동작

const PREFIX = 'aimath:';
const today = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD

function safe(fn, fallback = null) {
  try { return fn(); } catch { return fallback; }
}

export function loadDraft(moduleId) {
  const raw = safe(() => localStorage.getItem(PREFIX + moduleId));
  if (!raw) return null;
  const draft = safe(() => JSON.parse(raw));
  if (!draft || draft.date !== today()) {
    clearDraft(moduleId);
    return null;
  }
  return draft;
}

export function saveDraft(moduleId, { payload, reflections, tab }) {
  safe(() => localStorage.setItem(PREFIX + moduleId,
    JSON.stringify({ date: today(), payload, reflections, tab })));
}

export function clearDraft(moduleId) {
  safe(() => localStorage.removeItem(PREFIX + moduleId));
}

/** 다른 날짜의 임시 저장을 모두 지움 */
export function purgeOldDrafts() {
  safe(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const d = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (!d || d.date !== today()) localStorage.removeItem(key);
    }
  });
}
