import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "me.plsteach.app",
  appName: "plsteach.me",
  webDir: "dist",
  plugins: {
    SystemBars: {
      style: "LIGHT",
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
  },
  backgroundColor: "#faf7f2",
  android: { backgroundColor: "#faf7f2" },
  ios: { contentInset: "never", backgroundColor: "#faf7f2" },
};
export default config;
