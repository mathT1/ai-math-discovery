// 모듈 목록 (modules/index.json — tools/build-index.mjs가 자동 생성) [D5·D6]
import { fetchJSON } from './ui.js';

const ROOT = new URL('../', import.meta.url);

/** @param {{drafts?: boolean}} opt  drafts=true면 만드는 중(status: draft) 모듈도 포함 */
export async function loadCatalog({ drafts = false } = {}) {
  const index = await fetchJSON(new URL('modules/index.json', ROOT));
  return index.modules.filter((m) => drafts || m.status === 'published');
}

export const moduleURL = (id, file = '') => new URL(`modules/${encodeURIComponent(id)}/${file}`, ROOT);

export const showDrafts = () => new URLSearchParams(location.search).has('drafts');
