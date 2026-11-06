// 결과물 JSON 직렬화·체크섬·제출 코드 (브라우저와 Node 공통, DOM 없음)

export const RESULT_FORMAT = 'ai-math-result/1';

/** 키를 정렬해 항상 같은 문자열이 나오는 JSON (체크섬용) */
export function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  return '{' + Object.keys(value).sort()
    .filter((k) => value[k] !== undefined)
    .map((k) => JSON.stringify(k) + ':' + canonicalJSON(value[k]))
    .join(',') + '}';
}

export async function sha256Hex(text) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null; // http(보안 아님) 환경 등
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function checksumBody(result) {
  const { meta, student, payload, reflections } = result;
  return canonicalJSON({ meta, student, payload, reflections });
}

export async function computeChecksum(result) {
  const hex = await sha256Hex(checksumBody(result));
  return hex ? 'sha256:' + hex : null;
}

/** @returns {'ok'|'modified'|'missing'|'unavailable'} */
export async function verifyChecksum(result) {
  if (!result.checksum) return 'missing';
  const now = await computeChecksum(result);
  if (!now) return 'unavailable';
  return now === result.checksum ? 'ok' : 'modified';
}

/** 결과물 객체 만들기 (체크섬 포함) */
export async function buildResult({ moduleMeta, platformVersion, student, payload, reflections, createdAt }) {
  const result = {
    format: RESULT_FORMAT,
    meta: {
      platform_version: platformVersion,
      module_id: moduleMeta.id,
      module_version: moduleMeta.version,
      created_at: createdAt ?? localISOString(new Date()),
    },
    student: {
      class: String(student.class ?? '').trim(),
      number: Number(student.number),
      name: String(student.name ?? '').trim(),
    },
    payload,
    reflections: reflections ?? {},
  };
  result.checksum = await computeChecksum(result);
  return result;
}

/** 시간대(+09:00 등)가 붙은 ISO 문자열 */
export function localISOString(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

// ---------- base64url ----------

export function bytesToBase64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlToBytes(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- 압축 ----------

export const canCompress = () =>
  typeof globalThis.CompressionStream === 'function' && typeof globalThis.DecompressionStream === 'function';

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

// ---------- 제출 코드: [모듈id:반-번호:압축코드] ----------
// 패들릿 등 텍스트에 섞여 있어도 정규식으로 찾을 수 있게 대괄호로 감싼다 (Antigravity M0 검토 제안)

export const SUBMISSION_RE = /\[([a-z0-9_-]+):([0-9A-Za-z-]*):([A-Za-z0-9_-]{8,})\]/g;

export function whoTag(student) {
  return `${student.class}-${student.number}`.replace(/[^0-9A-Za-z-]/g, '');
}

export async function encodeSubmission(result) {
  if (!canCompress()) throw new Error('이 브라우저는 제출 코드를 지원하지 않습니다.');
  const json = new TextEncoder().encode(JSON.stringify(result));
  const zipped = await pipe(json, new CompressionStream('gzip'));
  return `[${result.meta.module_id}:${whoTag(result.student)}:${bytesToBase64url(zipped)}]`;
}

/** 텍스트에서 제출 코드를 모두 찾아 결과물로 되돌림 */
export async function decodeSubmissions(text) {
  const results = [];
  const errors = [];
  for (const m of String(text).matchAll(SUBMISSION_RE)) {
    const [, moduleId, who, code] = m;
    try {
      const raw = await pipe(base64urlToBytes(code), new DecompressionStream('gzip'));
      results.push(JSON.parse(new TextDecoder().decode(raw)));
    } catch {
      errors.push(`${moduleId}:${who} 코드를 읽을 수 없습니다(잘렸거나 일부가 바뀜).`);
    }
  }
  return { results, errors };
}
