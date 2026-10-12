export const SESSION_CONFIG = {
  passConfidence: 0.75,
  correctionConfidence: 0.75,
  maxUncertaintyRetries: 2,
  stillnessWindowMs: 1500,
  minimumMovementMs: 2000,
  stillnessThreshold: 0.015,
  captureFrameCount: 3,
  captureDurationMs: 600,
  apiTimeoutMs: 8000,
} as const;
