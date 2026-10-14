"use client";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { SESSION_CONFIG } from "@/lib/session/config";
import { createLandmarker } from "@/lib/vision/mediapipe";
import type { CameraSetup } from "@/lib/skills/schema";
import { framingCopy } from "@/lib/vision/framing";
import { CameraGuide } from "./camera-guide";
import { getROI } from "@/lib/vision/roi";
import type { LandmarkFrame } from "@/lib/vision/prechecks";
import { liveCopy as c } from "@/lib/copy/en";
export function CameraView({
  camera,
  frame,
  videoRef,
  onFrame,
  onError,
  debug = false,
  paused = false,
  setup = false,
}: {
  camera: CameraSetup;
  frame: LandmarkFrame | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  onFrame: (frame: LandmarkFrame) => void;
  onError: (message: string) => void;
  debug?: boolean;
  paused?: boolean;
  setup?: boolean;
}) {
  const overlay = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ onFrame, onError, debug, paused, camera });
  latest.current = { onFrame, onError, debug, paused, camera };
  const [loading, setLoading] = useState(true);
  const [aspect, setAspect] = useState(3 / 4);
  useEffect(() => {
    let cancelled = false,
      stream: MediaStream | undefined,
      engine: Awaited<ReturnType<typeof createLandmarker>> | undefined,
      timer: ReturnType<typeof setTimeout> | undefined,
      lastVideoTime = -1;
    const close = () => {
      stream?.getTracks().forEach((t) => t.stop());
      engine?.close();
    };
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: camera.facingMode,
            width: { ideal: 640 },
            height: { ideal: 960 },
          },
          audio: false,
        });
        if (cancelled) {
          close();
          return;
        }
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        if (video.videoHeight) setAspect(video.videoWidth / video.videoHeight);
        try {
          engine = await createLandmarker();
        } catch {
          throw new Error("model");
        }
        if (cancelled) {
          close();
          return;
        }
        setLoading(false);
        function tick() {
          if (cancelled) return;
          const started = performance.now();
          stream?.getVideoTracks().forEach((t) => {
            t.enabled = !latest.current.paused;
          });
          if (
            !latest.current.paused &&
            !document.hidden &&
            video.readyState >= 2 &&
            video.currentTime !== lastVideoTime
          ) {
            lastVideoTime = video.currentTime;
            try {
              const frame = engine!.detect(video, started);
              latest.current.onFrame(frame);
              const canvas = overlay.current;
              if (canvas) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d")!;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (latest.current.debug) {
                  ctx.strokeStyle = "#f5a77c";
                  ctx.fillStyle = "#f5a77c";
                  ctx.lineWidth = 3;
                  for (const point of [
                    frame.pose[0],
                    frame.pose[11],
                    frame.pose[12],
                    ...frame.hands.flat(),
                  ].filter(Boolean)) {
                    ctx.beginPath();
                    ctx.arc(
                      point.x * canvas.width,
                      point.y * canvas.height,
                      4,
                      0,
                      Math.PI * 2,
                    );
                    ctx.fill();
                  }
                  const roi = getROI(frame, latest.current.camera.framing);
                  ctx.strokeRect(
                    roi.x * canvas.width,
                    roi.y * canvas.height,
                    roi.width * canvas.width,
                    roi.height * canvas.height,
                  );
                }
              }
            } catch {
              latest.current.onError(c.modelError);
              close();
              return;
            }
          }
          // Bound work and yield between inferences. Slow phones lower the rate.
          timer = setTimeout(
            tick,
            Math.max(
              16,
              SESSION_CONFIG.inferenceIntervalMs -
                (performance.now() - started),
            ),
          );
        }
        tick();
      } catch (error) {
        close();
        if (!cancelled) {
          setLoading(false);
          latest.current.onError(
            error instanceof Error && error.message === "model"
              ? c.modelError
              : c.cameraError,
          );
        }
      }
    }
    start();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      close();
    };
  }, [videoRef, camera.facingMode]);
  return (
    <>
      <div
        className="camera-stage"
        style={{ aspectRatio: aspect, "--camera-aspect": aspect } as CSSProperties}
        data-mirrored={camera.facingMode === "user"}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          className="camera-video"
          aria-label={camera.facingMode === "user" ? c.preview : c.rearPreview}
        />
        <canvas ref={overlay} className="landmark-overlay" aria-hidden="true" />
        {setup && <CameraGuide camera={camera} frame={frame} />}
        {loading && (
          <p className="camera-caption" role="status">
            {c.modelsLoading}
          </p>
        )}
        {paused && <p className="camera-caption">{c.paused}</p>}
      </div>
      {setup && (
        <p className="guide-caption">{framingCopy[camera.framing].guide}</p>
      )}
    </>
  );
}
