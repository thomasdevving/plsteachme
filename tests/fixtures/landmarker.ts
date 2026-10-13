// Deterministic camera geometry for UI integration tests; never imported by Next.js.
export async function createLandmarker() {
  return {
    detect(_video: HTMLVideoElement, time: number) {
      return {
        time,
        pose: Array.from({ length: 33 }, (_, i) => ({
          x: i === 11 ? 0.3 : i === 12 ? 0.7 : 0.5,
          y: i === 0 ? 0.2 : 0.4,
          visibility: 1,
        })),
        hands: [0.3, 0.7].map((x) =>
          Array.from({ length: 21 }, () => ({ x, y: 0.6 })),
        ),
        luminance: 100,
        ambiguous: false,
      };
    },
    close() {},
  };
}
