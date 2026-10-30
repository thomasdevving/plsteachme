import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import nextEnv from "@next/env";
import { fetchWithTimeout } from "../lib/network";
import { isPublicSupabaseKey } from "../lib/public-key";
import { transcriptionModel, visionModel } from "../lib/ai/models";

type Environment = Record<string, string | undefined>;
export type SetupCheck = { name: string; ok: boolean; detail: string };
export const setupTables: Record<string, string> = {
  waitlist: "id,session_hash",
  skill_votes: "id,skill",
  org_leads: "id",
  followups: "id",
  anonymous_counters: "name",
  coaching_trials: "id,user_id,completed_at,total_steps",
  teacher_profiles: "user_id,status",
  community_requests: "id,support_count",
  community_supports: "user_id,request_id",
  platform_lessons: "id,submitted_version_id,published_version_id",
  platform_lesson_versions: "id,document",
  platform_reviews: "id,version_id",
  platform_uploads: "path,attached_at",
  coaching_reports: "id,resolved_at",
  training_organizations: "id,plan",
  training_members: "id,role",
  training_modules: "id,status",
  vision_models: "id,status",
  learner_progress: "user_id,lesson_key",
  learning_events: "id,kind",
  training_pilot_access: "email",
  trial_claims: "email_hash",
  ai_usage: "day,calls",
  rate_limits: "key,hits",
  account_profiles: "user_id,username,first_name,last_name,has_avatar",
};

// Functions from every migration, so a skipped migration is reported.
export const setupFunctions = [
  "claim_coaching_trial",
  "advance_coaching_trial",
  "platform_mutate",
  "increment_under16",
  "training_mutate",
  "progress_save",
  "learning_insights",
  "account_delete",
  "retention_cleanup",
  "coaching_trial_use",
  "ai_budget_use",
  "rate_hit",
  "ephemeral_cleanup",
  "account_login_email",
];
export const learningTables = [
  "coaching_trials",
  "account_profiles",
  "learner_progress",
  "learning_events",
  "coaching_reports",
  "trial_claims",
  "ai_usage",
  "rate_limits",
];
export const learningFunctions = [
  "claim_coaching_trial",
  "advance_coaching_trial",
  "progress_save",
  "coaching_trial_use",
  "ai_budget_use",
  "rate_hit",
  "account_login_email",
];
type SetupOptions = { learner?: boolean; deploymentOnly?: boolean };
function origin(value: string | undefined): string | null {
  try {
    const url = new URL(value || "");
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** No mutations, email, uploads or inference. Returned messages never include secrets or response bodies. */
export async function checkSetup(
  env: Environment,
  fetcher: typeof fetch = fetchWithTimeout,
  deployedUrl?: string,
  options: SetupOptions = {},
): Promise<SetupCheck[]> {
  const checks: SetupCheck[] = [];
  const record = (name: string, ok: boolean, detail: string) => {
    checks.push({ name, ok, detail });
  };
  const url = origin(
    env.SUPABASE_URL?.trim() || env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  );
  const publicKey =
    env.SUPABASE_ANON_KEY?.trim() ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const secret = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const publicKeySafe = isPublicSupabaseKey(publicKey, secret);
  const openai = env.OPENAI_API_KEY?.trim();
  if (!options.deploymentOnly) {
    record(
      "Supabase URL",
      Boolean(url),
      "Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL to the project HTTPS origin.",
    );
    record(
      "Supabase public key",
      publicKeySafe,
      "Set SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to a public key, never a privileged key.",
    );
    record(
      "Supabase server key",
      Boolean(secret),
      "Set SUPABASE_SERVICE_ROLE_KEY on the server.",
    );
    record("OpenAI key", Boolean(openai), "Set OPENAI_API_KEY on the server.");
    record(
      "Site origin",
      Boolean(origin(env.NEXT_PUBLIC_SITE_URL?.trim())),
      "Set NEXT_PUBLIC_SITE_URL to the browser-facing origin.",
    );
  }
  const reviewers = (env.PLATFORM_REVIEWER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const reviewerIdsValid =
    reviewers.length > 0 &&
    reviewers.every((id) =>
      /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        id,
      ),
    );
  if (!options.deploymentOnly && !options.learner)
    record(
      "Independent reviewers",
      reviewerIdsValid,
      "Set PLATFORM_REVIEWER_IDS to real Auth user UUIDs; use a separate teacher account.",
    );

  const readOnly: typeof fetch = async (input, init) => {
    const method = (
      init?.method || (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method))
      throw new Error("Setup checks cannot mutate data.");
    return fetcher(input, {
      ...init,
      redirect: "error",
      signal: AbortSignal.any([
        AbortSignal.timeout(15_000),
        ...(init?.signal ? [init.signal] : []),
      ]),
    });
  };
  const inspect = async (
    name: string,
    detail: string,
    operation: () => Promise<boolean>,
  ) => {
    try {
      record(name, await operation(), detail);
    } catch {
      record(
        name,
        false,
        detail +
          " The check failed or timed out; raw service errors are omitted.",
      );
    }
  };
  if (!options.deploymentOnly && url && secret && publicKey && publicKeySafe) {
    const clientOptions = {
      db: { timeout: 15_000, retry: false },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: readOnly },
    };
    const admin = createClient(url, secret, clientOptions),
      anonymous = createClient(url, publicKey, clientOptions);
    // Zero-row reads validate schema/grants without retrieving personal data.
    await Promise.all(
      Object.entries(setupTables)
        .filter(([table]) => !options.learner || learningTables.includes(table))
        .map(async ([table, columns]) => {
          await inspect(
            `Database: ${table}`,
            "Apply all checked-in migrations and verify service-role grants.",
            async () => {
              const result = await admin.from(table).select(columns).limit(0);
              return !result.error;
            },
          );
          await inspect(
            `Anonymous access: ${table}`,
            "Direct anonymous access must be denied by the checked-in grants.",
            async () => {
              const result = await anonymous
                .from(table)
                .select(columns)
                .limit(0);
              return [401, 403].includes(result.status);
            },
          );
        }),
    );
    await inspect(
      "Trial and platform functions",
      "Check the Data API schema cache and all migration functions.",
      async () => {
        const headers: Record<string, string> = {
          apikey: secret,
          Accept: "application/openapi+json",
        };
        // Legacy keys are JWTs; modern secret keys must not be used as bearer JWTs.
        if (!secret.startsWith("sb_secret_"))
          headers.Authorization = `Bearer ${secret}`;
        const response = await readOnly(`${url}/rest/v1/`, { headers });
        if (!response.ok) return false;
        const schema = await response.json();
        return (options.learner ? learningFunctions : setupFunctions).every(
          (name) => schema.paths?.[`/rpc/${name}`]?.post,
        );
      },
    );
    if (!options.learner)
      await inspect(
        "Private teacher storage",
        "Create the private teacher-demonstrations bucket with MP4/WebM/MOV support and a 100 MB limit.",
        async () => {
          const { data, error } = await admin.storage.getBucket(
            "teacher-demonstrations",
          );
          return (
            !error &&
            Boolean(data) &&
            data!.public === false &&
            (data!.file_size_limit == null ||
              data!.file_size_limit >= 100 * 1024 * 1024) &&
            (!data!.allowed_mime_types ||
              ["video/mp4", "video/webm", "video/quicktime"].every((type) =>
                data!.allowed_mime_types!.includes(type),
              ))
          );
        },
      );
    await inspect(
      "Private profile storage",
      "Apply the account profiles migration to create the private profile-avatars bucket (JPEG, 256 KiB).",
      async () => {
        const { data, error } =
          await admin.storage.getBucket("profile-avatars");
        return (
          !error &&
          Boolean(data) &&
          data!.public === false &&
          data!.file_size_limit === 262144 &&
          data!.allowed_mime_types?.length === 1 &&
          data!.allowed_mime_types[0] === "image/jpeg"
        );
      },
    );
    if (!options.learner && reviewerIdsValid)
      await inspect(
        "Reviewer accounts",
        "Each configured reviewer must exist and have a confirmed, non-anonymous account.",
        async () => {
          for (const id of reviewers) {
            const { data, error } = await admin.auth.admin.getUserById(id);
            if (
              error ||
              !data.user ||
              data.user.is_anonymous ||
              !data.user.email_confirmed_at
            )
              return false;
          }
          return true;
        },
      );
  }
  if (!options.deploymentOnly && openai)
    for (const [label, model] of [
      ["Vision model", visionModel(env)],
      ...(!options.learner
        ? [["Transcription model", transcriptionModel(env)]]
        : []),
    ])
      await inspect(
        label,
        "Verify the configured model is accessible to this OpenAI project; no inference is performed.",
        async () => {
          const response = await readOnly(
            `https://api.openai.com/v1/models/${encodeURIComponent(model)}`,
            { headers: { Authorization: `Bearer ${openai}` } },
          );
          if (!response.ok) return false;
          return (await response.json()).id === model;
        },
      );
  if (deployedUrl) {
    const deployed = origin(deployedUrl);
    record(
      "Deployment URL",
      Boolean(deployed),
      "Pass a valid HTTPS origin, or localhost for a local server.",
    );
    const endpoints: ReadonlyArray<
      readonly [string, string, (body: any) => boolean]
    > = options.learner
      ? [
          [
            "/api/coaching/session",
            "Deployed camera coaching",
            (body: any) => body.available === true,
          ],
          [
            "/api/auth/session",
            "Deployed account configuration",
            (body: any) => body.configured === true,
          ],
          [
            "/api/health",
            "Deployed database and AI configuration",
            (body: any) =>
              body.ok === true && body.database === true && body.ai === true,
          ],
        ]
      : [
          [
            "/api/config",
            "Deployed AI configuration",
            (body: any) => body.available === true && body.mock === false,
          ],
          [
            "/api/auth/session",
            "Deployed account configuration",
            (body: any) => body.configured === true,
          ],
          [
            "/api/platform?view=config",
            "Deployed platform configuration",
            (body: any) => body.available === true && body.aiAvailable === true,
          ],
        ];
    if (deployed)
      for (const [path, name, test] of endpoints)
        await inspect(
          name,
          "Set deployment environment variables and redeploy, then rerun this check.",
          async () => {
            // Never send server credentials to the supplied website.
            const response = await readOnly(deployed + path);
            return response.ok && test(await response.json());
          },
        );
  }
  return checks;
}

export function setupArgs(args: string[]) {
  const options: SetupOptions = {};
  let url: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--learner") options.learner = true;
    else if (args[i] === "--deployment-only") options.deploymentOnly = true;
    else if (
      args[i] === "--url" &&
      args[i + 1] &&
      !args[i + 1].startsWith("--") &&
      !url
    )
      url = args[++i];
    else
      throw new Error(
        "Usage: verify:setup [--learner] [--deployment-only --url https://plsteach.me]",
      );
  }
  if (options.deploymentOnly && !url)
    throw new Error("--deployment-only requires --url.");
  return { url, options };
}
async function main() {
  nextEnv.loadEnvConfig(process.cwd(), false, {
    info: () => {},
    error: () => {},
  });
  const { url, options } = setupArgs(process.argv.slice(2));
  const checks = await checkSetup(process.env, fetchWithTimeout, url, options);
  for (const check of checks)
    console.log(
      `${check.ok ? "PASS" : "FAIL"} ${check.name}${check.ok ? "" : `: ${check.detail}`}`,
    );
  const failures = checks.filter((check) => !check.ok).length;
  console.log(
    `\n${checks.length - failures}/${checks.length} setup checks passed. No writes or AI inference performed.`,
  );
  if (options.deploymentOnly)
    console.log(
      "This public check confirms configuration and basic database reachability only. It does not prove migrations, model access, billing, email delivery or AI feedback.",
    );
  console.log(
    "Next: test real email delivery/redirects, camera feedback, trial resume, and teacher upload/review in the browser. See docs/TEST_READINESS.md.",
  );
  process.exitCode = failures ? 1 : 0;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  void main().catch(() => {
    console.error(
      "Setup verification could not complete. Check configuration and network access; no secrets or raw errors were printed.",
    );
    process.exitCode = 1;
  });
