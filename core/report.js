// PNG 보고서 (A4 세로 비율, 1240×1754 = 150dpi)
// 인쇄도 이 그림을 그대로 씀 → 브라우저가 배경색을 빼고 인쇄해도 내용이 사라지지 않음

const W = 1240;
const H = 1754;
const M = 80; // 여백
const FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif';

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  for (const para of String(text ?? '').split(/\n/)) {
    let line = '';
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > maxWidth && line) {
        lines.push(line);
        line = ch.trimStart();
      } else line += ch;
    }
    lines.push(line);
  }
  return lines;
}

function drawText(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
  const lines = wrapLines(ctx, text, maxWidth);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[shown.length - 1] = shown[shown.length - 1].slice(0, -1) + '…';
  shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + shown.length * lineHeight;
}

/**
 * @param {object} o
 * @param {object} o.meta        module.json
 * @param {object} o.result      결과물 JSON
 * @param {string[]} o.evidence  grader가 다시 계산한 근거 문장
 * @param {(canvas:HTMLCanvasElement, payload:object)=>void} o.drawSummary activity.renderSummaryCanvas
 * @returns {HTMLCanvasElement}
 */
export function drawReport({ meta, result, evidence = [], drawSummary }) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#111111';
  ctx.textBaseline = 'top';

  // 머리말
  ctx.font = `bold 44px ${FONT}`;
  let y = drawText(ctx, meta.title, M, M, W - 2 * M, 56, 2);
  ctx.font = `24px ${FONT}`;
  ctx.fillStyle = '#444444';
  y = drawText(ctx, `${meta.subject ?? ''} · ${meta.unit ?? ''}   |   AI 수학 발견 수업 플랫폼`, M, y + 8, W - 2 * M, 32, 1);

  // 학생 정보 상자
  y += 20;
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 2;
  ctx.strokeRect(M, y, W - 2 * M, 70);
  ctx.fillStyle = '#111111';
  ctx.font = `bold 30px ${FONT}`;
  const s = result.student;
  ctx.fillText(`반: ${s.class}    번호: ${s.number}    이름: ${s.name || '(생략)'}`, M + 24, y + 20);
  y += 100;

  // 활동 그림
  const figH = 560;
  const fig = document.createElement('canvas');
  fig.width = W - 2 * M;
  fig.height = figH;
  const fctx = fig.getContext('2d');
  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0, 0, fig.width, fig.height);
  try { drawSummary?.(fig, result.payload); } catch (e) { console.warn('요약 그림 오류', e); }
  ctx.drawImage(fig, M, y);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#999999';
  ctx.strokeRect(M, y, fig.width, figH);
  y += figH + 30;

  // 다시 계산한 결과
  ctx.fillStyle = '#111111';
  ctx.font = `bold 28px ${FONT}`;
  ctx.fillText('활동 결과 (프로그램이 다시 계산한 값)', M, y);
  y += 44;
  ctx.font = `24px ${FONT}`;
  for (const line of evidence.slice(0, 5)) y = drawText(ctx, '• ' + line, M, y, W - 2 * M, 32, 2);
  y += 20;

  // 정리 질문
  ctx.font = `bold 28px ${FONT}`;
  ctx.fillText('정리 질문', M, y);
  y += 44;
  const qs = meta.questions ?? [];
  const room = H - 300 - y; // 아래 채점란 자리 남기기
  const perQ = qs.length ? Math.max(3, Math.floor(room / qs.length / 32) - 2) : 0;
  for (const q of qs) {
    ctx.font = `bold 23px ${FONT}`;
    y = drawText(ctx, `Q. ${q.prompt}`, M, y, W - 2 * M, 30, 2);
    ctx.font = `23px ${FONT}`;
    y = drawText(ctx, result.reflections?.[q.id] || '(미작성)', M + 24, y + 4, W - 2 * M - 24, 31, perQ) + 16;
  }

  // 교사 채점란 (출력물 제출용)
  const boxY = H - 220;
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 2;
  ctx.strokeRect(M, boxY, W - 2 * M, 110);
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillText('교사 채점란', M + 20, boxY + 14);
  ctx.font = `22px ${FONT}`;
  ctx.fillText('점수:            성취수준:            확인:', M + 20, boxY + 62);

  // 꼬리말
  ctx.font = `18px ${FONT}`;
  ctx.fillStyle = '#555555';
  const short = result.checksum ? result.checksum.replace('sha256:', '').slice(0, 12) : '없음';
  ctx.fillText(`생성 ${result.meta.created_at} · 모듈 ${meta.id} v${meta.version} · 확인코드 ${short}`, M, H - 80);
  return c;
}

export const canvasToBlob = (canvas) => new Promise((r) => canvas.toBlob(r, 'image/png'));
