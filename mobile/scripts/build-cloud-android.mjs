import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = process.env.PLSTEACH_TOOL_ROOT || "/workspace";
const javaHome = process.env.JAVA_HOME || path.join(root, ".plsteach-jdk");
if (!existsSync(path.join(javaHome, "bin/javac")))
  throw new Error(
    "Run npm run setup:android:cloud first (JDK 21 is required).",
  );
const javaUser = path.join(root, ".plsteach-java-user");
mkdirSync(javaUser, { recursive: true });
const args = [`-Duser.home=${javaUser}`];
// Use the machine's managed CA trust store, retaining TLS verification with
// the cloud HTTPS proxy. Never copy proxy credentials into project files.
if (existsSync("/etc/ssl/certs/java/cacerts"))
  args.push("-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts");
const proxyValue = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxyValue) {
  const proxy = new URL(proxyValue);
  if (proxy.username || proxy.password)
    throw new Error(
      "Authenticated proxies need a separately configured Gradle credential provider.",
    );
  for (const protocol of ["https", "http"])
    args.push(
      `-D${protocol}.proxyHost=${proxy.hostname}`,
      `-D${protocol}.proxyPort=${proxy.port || (proxy.protocol === "https:" ? "443" : "80")}`,
    );
  args.push("-Dhttp.nonProxyHosts=localhost|127.*");
}
args.push("assembleDebug", "--max-workers=2", "--console=plain");
const result = spawnSync("./gradlew", args, {
  cwd: fileURLToPath(new URL("../android/", import.meta.url)),
  stdio: "inherit",
  env: {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: process.env.ANDROID_HOME || path.join(root, ".android-sdk"),
    ANDROID_USER_HOME: path.join(root, ".android-user"),
    GRADLE_USER_HOME: path.join(root, ".gradle"),
  },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
