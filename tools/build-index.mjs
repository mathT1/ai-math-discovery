// modules/*/module.json 을 모아 modules/index.json 생성 + 모듈 표준 검사 [D5]
// 실행: node tools/build-index.mjs        (오류가 있으면 종료 코드 1 → Actions 배포 중단)
//       node tools/build-index.mjs --check (검사만, index.json 쓰지 않음)
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES = join(ROOT, 'modules');
const REQUIRED_FILES = ['index.html', 'module.json', 'activity.js', 'grader.js', 'schema.json', 'rubric.json', 'guide.md'];
const REQUIRED_FIELDS = ['id', 'version', 'status', 'title', 'subject', 'unit', 'topics', 'achievement_standards', 'grade', 'periods', 'difficulty', 'paper', 'questions'];
const ACTIVITY_EXPORTS = ['init', 'renderAIComparison', 'getResultData', 'renderSummaryCanvas'];
// 확정 성취기준 코드 모양 (예: 10공수2-01-02, 12미적Ⅱ-01-01, 12대수03-06)
const STANDARD_CODE = /^\d{2}[가-힣ⅠⅡ]+\d?-?\d{2}-\d{2}$/;

const exists = (p) => stat(p).then(() => true, () => false);
const readJSON = async (p) => JSON.parse(await readFile(p, 'utf8'));

async function checkModule(dir, errors) {
  const where = (msg) => errors.push(`modules/${dir}: ${msg}`);
  const base = join(MODULES, dir);
  for (const f of REQUIRED_FILES) if (!(await exists(join(base, f)))) where(`${f} 파일이 없습니다.`);

  let meta;
  try { meta = await readJSON(join(base, 'module.json')); } catch (e) { where(`module.json 을 읽을 수 없습니다: ${e.message}`); return null; }
  for (const k of REQUIRED_FIELDS) if (!(k in meta)) where(`module.json 에 "${k}" 가 없습니다.`);
  if (meta.id !== dir) where(`id("${meta.id}")가 폴더 이름("${dir}")과 다릅니다.`);
  if (!/^[a-z0-9_-]+$/.test(meta.id ?? '')) where('id는 영어 소문자·숫자·-·_ 만 씁니다.');
  if (!['draft', 'published'].includes(meta.status)) where('status는 "draft" 또는 "published" 입니다.');
  if (!/^\d+\.\d+\.\d+$/.test(meta.version ?? '')) where('version은 "1.0.0" 형식입니다.');
  if (!Number.isInteger(meta.difficulty) || meta.difficulty < 1 || meta.difficulty > 3) where('difficulty는 1~3 정수입니다.');
  if (!Array.isArray(meta.topics) || !meta.topics.length) where('topics가 비어 있습니다.');

  // 성취기준: "후보"가 아닌 코드에는 출처(source)가 꼭 있어야 함 [D21]
  // (코드 모양을 바꿔 적어도 빠져나가지 못하게 — Antigravity M1 검토)
  for (const a of meta.achievement_standards ?? []) {
    const code = String(a.code ?? '').trim();
    const candidate = code.startsWith('후보');
    if (!candidate && !String(a.source ?? '').trim()) {
      where(`성취기준 [${code}] 에 출처(source: 문서명·쪽)가 없습니다. 출처가 없으면 "후보(확인 필요)"로 적으세요.`);
    }
    if (!candidate && !STANDARD_CODE.test(code)) {
      where(`성취기준 코드 "${code}" 의 모양이 올바르지 않습니다 (예: 10공수2-01-02). 대괄호·설명은 빼고 코드만 적으세요.`);
    }
  }
  if (meta.style && !(await exists(join(base, meta.style)))) where(`style 파일(${meta.style})이 없습니다.`);
  for (const [k, p] of Object.entries(meta.data ?? {})) {
    if (!(await exists(join(base, p)))) where(`data.${k} 파일(${p})이 없습니다.`);
  }

  // 질문·루브릭 연결
  const qids = new Set((meta.questions ?? []).map((q) => q.id));
  try {
    const rubric = await readJSON(join(base, 'rubric.json'));
    if (!Array.isArray(rubric.scale) || !rubric.scale.length) where('rubric.json: scale이 없습니다.');
    if (typeof rubric.level_cut !== 'object') where('rubric.json: level_cut이 없습니다.');
    const ids = new Set();
    for (const it of rubric.items ?? []) {
      if (ids.has(it.id)) where(`rubric.json: 항목 id "${it.id}" 가 중복됩니다.`);
      ids.add(it.id);
      if (typeof it.max !== 'number' || it.max <= 0) where(`rubric.json: "${it.id}" 의 max가 올바르지 않습니다.`);
      if (it.type === 'auto') {
        if (!it.metric) where(`rubric.json: 자동 항목 "${it.id}" 에 metric이 없습니다.`);
        if (!Array.isArray(it.tiers) || !it.tiers.length) where(`rubric.json: 자동 항목 "${it.id}" 에 tiers가 없습니다.`);
      } else if (it.type === 'teacher') {
        if (it.question && !qids.has(it.question)) where(`rubric.json: "${it.id}" 의 question "${it.question}" 이 module.json questions에 없습니다.`);
      } else where(`rubric.json: "${it.id}" 의 type은 "auto" 또는 "teacher" 입니다.`);
    }
    if (!rubric.items?.length) where('rubric.json: items가 비어 있습니다.');
  } catch (e) { where(`rubric.json 을 읽을 수 없습니다: ${e.message}`); }
  try { await readJSON(join(base, 'schema.json')); } catch (e) { where(`schema.json 을 읽을 수 없습니다: ${e.message}`); }

  // activity.js 표준 함수 (DOM 없이 글자로 확인)
  try {
    const src = await readFile(join(base, 'activity.js'), 'utf8');
    for (const fn of ACTIVITY_EXPORTS) {
      if (!new RegExp(`export\\s+(async\\s+)?function\\s+${fn}\\b`).test(src)) where(`activity.js 에 export function ${fn} 이 없습니다.`);
    }
  } catch { /* 위에서 파일 없음 보고 */ }
  // grader.js는 DOM이 없어 Node에서 바로 불러 확인 가능
  try {
    const g = await import(pathToFileURL(join(base, 'grader.js')).href);
    if (typeof g.metrics !== 'function') where('grader.js 에 export function metrics 가 없습니다.');
  } catch (e) { where(`grader.js 를 불러올 수 없습니다: ${e.message}`); }

  return {
    id: meta.id, status: meta.status, version: meta.version, title: meta.title, subtitle: meta.subtitle ?? '',
    subject: meta.subject, unit: meta.unit, topics: meta.topics ?? [], grade: meta.grade ?? [],
    periods: meta.periods, difficulty: meta.difficulty,
  };
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const errors = [];
  const dirs = (await readdir(MODULES, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const modules = [];
  for (const d of dirs) {
    const m = await checkModule(d, errors);
    if (m) modules.push(m);
  }
  if (errors.length) {
    console.error(`모듈 표준 검사 실패 (${errors.length}건):`);
    for (const e of errors) console.error('  ✖ ' + e);
    process.exit(1);
  }
  if (!checkOnly) {
    const index = { generated_by: 'tools/build-index.mjs — 직접 고치지 마세요', modules };
    await writeFile(join(MODULES, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  }
  const pub = modules.filter((m) => m.status === 'published').length;
  console.log(`모듈 ${modules.length}개 검사 통과 (공개 ${pub}, 만드는 중 ${modules.length - pub})${checkOnly ? '' : ' → modules/index.json'}`);
}

main();
