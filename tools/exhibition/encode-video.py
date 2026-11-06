# 출품 자료 만들기 ② 뒷부분 — 기록한 프레임을 mp4로 (record-demo.mjs가 자동 실행)
# 필요: Python 3, opencv-python  (pip install opencv-python)
# 프레임은 화면이 바뀔 때만 기록되므로, 시각(timestamp)에 맞춰 15fps로 고르게 채움
import json, os, sys
import cv2

sys.stdout.reconfigure(encoding='utf-8')

out = sys.argv[1]
frames = json.load(open(os.path.join(out, 'frames.json'), encoding='utf-8'))
if not frames:
    sys.exit('프레임이 없습니다')
FPS, W, H = 15, 1280, 720
dst = os.path.join(out, 'demo.mp4')
writer = None
# H.264(avc1)는 OpenH264 DLL이 없으면 열린 척하고 비압축에 가깝게 저장되어 쓰지 않음 → MPEG-4
for codec in ('mp4v',):
    w = cv2.VideoWriter(dst, cv2.VideoWriter_fourcc(*codec), FPS, (W, H))
    if w.isOpened():
        writer, used = w, codec
        break
if writer is None:
    sys.exit('mp4 인코더를 열 수 없습니다')

t0, t_end = frames[0]['t'], frames[-1]['t'] + 1.0
i, img, n = 0, None, 0
t = t0
while t <= t_end:
    while i + 1 < len(frames) and frames[i + 1]['t'] <= t:
        i += 1
        img = None
    if img is None:
        img = cv2.imread(os.path.join(out, 'frames', frames[i]['file']))
        if img.shape[1] != W or img.shape[0] != H:
            img = cv2.resize(img, (W, H))
    writer.write(img)
    n += 1
    t += 1 / FPS
writer.release()
mb = os.path.getsize(dst) / 1e6
print(f'mp4 완성: {dst} ({n / FPS:.0f}초, {mb:.1f}MB, 코덱 {used})')
