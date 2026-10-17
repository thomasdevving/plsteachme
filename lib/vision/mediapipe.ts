import { SESSION_CONFIG } from "../session/config";
import { selectPose, type LandmarkFrame } from "./prechecks";
export async function createLandmarker() {
  const { FilesetResolver, HandLandmarker, PoseLandmarker } =
    await import("@mediapipe/tasks-vision");
  const files = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  const pose = await PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: "/mediapipe/pose_landmarker_lite.task" },
    runningMode: "VIDEO",
    numPoses: 2,
    minPoseDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  let hands: Awaited<ReturnType<typeof HandLandmarker.createFromOptions>>;
  try {
    hands = await HandLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: "/mediapipe/hand_landmarker.task" },
      runningMode: "VIDEO",
      numHands: 2,
    });
  } catch (e) {
    pose.close();
    throw e;
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return {
    detect(video: HTMLVideoElement, time: number): LandmarkFrame {
      canvas.width = SESSION_CONFIG.inferenceWidth;
      canvas.height = Math.round(
        (SESSION_CONFIG.inferenceWidth * video.videoHeight) / video.videoWidth,
      );
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const p = pose.detectForVideo(canvas, time),
        h = hands.detectForVideo(canvas, time);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let luminance = 0,
        count = 0;
      for (let i = 0; i < pixels.length; i += 64) {
        luminance +=
          0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
        count++;
      }
      const selection = selectPose(p.landmarks);
      return {
        time,
        ...selection,
        hands: h.landmarks.sort((a, b) => a[0].x - b[0].x),
        luminance: luminance / count,
      };
    },
    close() {
      pose.close();
      hands.close();
    },
  };
}
