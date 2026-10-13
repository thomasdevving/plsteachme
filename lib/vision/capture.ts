import type { ROI } from "./roi";
import { SESSION_CONFIG as config } from "@/lib/session/config";
export async function captureFrames(
  video: HTMLVideoElement,
  roi: ROI,
  signal: AbortSignal,
): Promise<string[]> {
  const canvas = document.createElement("canvas");
  const w = roi.width * video.videoWidth,
    h = roi.height * video.videoHeight;
  if (!w || !h) throw new Error("Camera not ready");
  const scale = Math.min(1, config.maxFrameSide / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  const frames: string[] = [];
  for (let i = 0; i < config.captureFrameCount; i++) {
    if (i)
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        };
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", abort);
          resolve();
        }, config.captureDurationMs / (config.captureFrameCount - 1));
        signal.addEventListener("abort", abort, { once: true });
      });
    signal.throwIfAborted();
    ctx.drawImage(
      video,
      roi.x * video.videoWidth,
      roi.y * video.videoHeight,
      w,
      h,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    let quality: number = config.jpegQuality;
    let data = canvas.toDataURL("image/jpeg", quality).split(",")[1];
    while ((data.length * 3) / 4 >= config.maxFrameBytes && quality > 0.2) {
      quality -= 0.1;
      data = canvas.toDataURL("image/jpeg", quality).split(",")[1];
    }
    if ((data.length * 3) / 4 >= config.maxFrameBytes)
      throw new Error("Frame too large");
    frames.push(data);
  }
  return frames;
}
