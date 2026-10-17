import { useEffect, useRef, useState } from "react";
import { App as NativeApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleCheck,
  Download,
  ExternalLink,
  Heart,
  House,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { skillIds, type SkillId } from "../../lib/config";
import { modules } from "../../lib/modules";
import { catalogEntries, realLifeCategories } from "../../lib/learning-catalog";
import {
  emptyLessonProgress,
  progressSummary,
  recordCheckpoint,
  checkpointLabels,
  type LessonProgress,
} from "../../lib/learning-progress";
import {
  setMotionPaused,
  useMotionPaused,
  MOTION_KEY,
} from "../../lib/motion-preference";
import { en } from "../../messages/en";
import { SkillIcon } from "../../components/illustrations";
import { LessonArtwork } from "../../components/lesson-artwork";
import { useProgress } from "./progress";
import logo from "../../public/brand/hands-filled.png";

type Tab = "home" | "skills" | "progress" | "settings";
type Route = { tab: Tab; skill?: SkillId };
const tabs = [
  { id: "home", label: "Today", Icon: House },
  { id: "skills", label: "Explore", Icon: BookOpen },
  { id: "progress", label: "My progress", Icon: CircleCheck },
  { id: "settings", label: "Settings", Icon: Settings },
] as const;
const website = "https://plsteachme.vercel.app";
function readRoute(): Route {
  const value = window.location.hash.slice(1);
  if (
    value.startsWith("lesson/") &&
    skillIds.includes(value.slice(7) as SkillId)
  )
    return { tab: "skills", skill: value.slice(7) as SkillId };
  return {
    tab: tabs.some((tab) => tab.id === value) ? (value as Tab) : "home",
  };
}
function go(tab: Tab, skill?: SkillId) {
  window.location.hash = skill ? `lesson/${skill}` : tab;
}
const name = (skill: SkillId) => en.skills.names[skill];

export function App() {
  const [route, setRoute] = useState(readRoute);
  const { progress, ready, error, update } = useProgress();
  const [notice, setNotice] = useState("");
  const paused = useMotionPaused();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const navigate = () => {
      setRoute(readRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", navigate);
    try {
      setMotionPaused(localStorage.getItem(MOTION_KEY) === "true", false);
    } catch {
      /* Use the OS motion preference. */
    }
    const listener = Capacitor.isNativePlatform()
      ? NativeApp.addListener("backButton", () => {
          const current = readRoute();
          if (current.skill) go("skills");
          else if (current.tab !== "home") go("home");
          else void NativeApp.minimizeApp();
        })
      : null;
    return () => {
      window.removeEventListener("hashchange", navigate);
      void listener?.then((handle) => handle.remove());
    };
  }, []);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [route.tab, route.skill]);
  async function openWeb(path: string) {
    setNotice("");
    try {
      await Browser.open({ url: `${website}${path}` });
    } catch {
      setNotice(
        "The website could not be opened. Check your connection and try again.",
      );
    }
  }
  const started = skillIds.filter((skill) => progress.lessons[skill]);
  const completed = started.filter(
    (skill) => progress.lessons[skill]?.completed,
  );
  const continuing = started
    .filter((skill) => !progress.lessons[skill]?.completed)
    .sort(
      (a, b) =>
        (progress.lessons[b]?.updatedAt ?? 0) -
        (progress.lessons[a]?.updatedAt ?? 0),
    );
  const recommended =
    continuing[0] ??
    skillIds.find((skill) => !progress.lessons[skill]?.completed) ??
    "tie";
  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          className="wordmark"
          aria-label="plsteach.me home"
          onClick={() => go("home")}
        >
          <img src={logo} alt="" />
          <span>
            plsteach<span className="wordmark-me">.me</span>
          </span>
        </button>
        <span className="offline-pill">
          <Download size={13} aria-hidden="true" />
          On your device
        </span>
      </header>
      <main id="main">
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        {notice && (
          <p role="alert" className="notice">
            {notice}
          </p>
        )}
        {!ready ? (
          <section className="empty">
            <h1 ref={heading} tabIndex={-1}>
              Getting your lessons ready
            </h1>
            <p>
              {error
                ? "Your saved progress has been left untouched."
                : "Loading your saved practice…"}
            </p>
          </section>
        ) : route.skill ? (
          <Lesson
            key={route.skill}
            skill={route.skill}
            saved={progress.lessons[route.skill]}
            update={update}
            onClose={() => go("skills")}
            onWeb={() => void openWeb(`/learn?skill=${route.skill}`)}
          />
        ) : (
          <>
            {route.tab === "home" && (
              <>
                <section className="welcome">
                  <p className="eyebrow">A little help. A skill for life.</p>
                  <h1 ref={heading} tabIndex={-1}>
                    Little steps.
                    <br />
                    <em>Look at you go.</em>
                  </h1>
                  <p>
                    Everyday things get easier with a little practice.
                    <br className="wide-only" /> Let’s learn something useful.
                  </p>
                </section>
                <section className="featured" aria-labelledby="featured-title">
                  <div className="featured-copy">
                    <span className="light-pill">
                      <Sparkles size={13} aria-hidden="true" />
                      {continuing.length
                        ? "Keep your momentum"
                        : "A good place to start"}
                    </span>
                    <h2 id="featured-title">{name(recommended)}</h2>
                    <p>{modules[recommended].intro}</p>
                    <button
                      className="button light"
                      onClick={() => go("skills", recommended)}
                    >
                      {continuing.length ? "Continue lesson" : "Let’s try it"}
                      <ArrowRight size={18} aria-hidden="true" />
                    </button>
                    <small>
                      {modules[recommended].steps.length} illustrated steps ·
                      Your own pace
                    </small>
                  </div>
                  <div className="featured-art" aria-hidden="true">
                    <SkillIcon skill={recommended} size={132} />
                    <span className="art-spark">✳</span>
                  </div>
                </section>
                <div className="section-heading">
                  <h2>Your next small win</h2>
                  <button className="text-button" onClick={() => go("skills")}>
                    See all <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="quick-grid">
                  {(["button", "laundry", "cooking"] as SkillId[]).map(
                    (skill) => (
                      <SkillCard
                        key={skill}
                        skill={skill}
                        saved={progress.lessons[skill]}
                      />
                    ),
                  )}
                </div>
                <section className="gentle-note">
                  <Heart size={25} aria-hidden="true" />
                  <div>
                    <h2>No rush. No perfect score.</h2>
                    <p>
                      Repeat a step, take a break, start again. This is your
                      space to figure things out.
                    </p>
                  </div>
                </section>
                <p className="local-note">
                  <Download size={14} aria-hidden="true" />
                  All 9 lessons work offline. Your progress stays here.
                </p>
              </>
            )}
            {route.tab === "skills" && (
              <Explore heading={heading} progress={progress.lessons} />
            )}
            {route.tab === "progress" && (
              <>
                <section className="page-intro">
                  <p className="eyebrow">Every little step counts</p>
                  <h1 ref={heading} tabIndex={-1}>
                    Look how far
                    <br />
                    <em>you’ve come.</em>
                  </h1>
                  <p>Your practice, saved on this device.</p>
                </section>
                <div className="stats">
                  <div>
                    <strong>
                      {completed.length}
                      <small> / 9</small>
                    </strong>
                    <span>walkthroughs complete</span>
                  </div>
                  <div>
                    <strong>{continuing.length}</strong>
                    <span>in progress</span>
                  </div>
                </div>
                {!started.length ? (
                  <section className="empty">
                    <BookOpen size={42} aria-hidden="true" />
                    <h2>Your first small win is waiting.</h2>
                    <p>
                      Choose a skill and check your first step. We’ll save your
                      place.
                    </p>
                    <button
                      className="button primary"
                      onClick={() => go("skills")}
                    >
                      Find a skill
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </section>
                ) : (
                  <>
                    {continuing.length > 0 && (
                      <>
                        <h2 className="list-title">
                          Pick up where you left off
                        </h2>
                        <div className="skill-list">
                          {continuing.map((skill) => (
                            <ProgressCard
                              key={skill}
                              skill={skill}
                              saved={progress.lessons[skill]!}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    {completed.length > 0 && (
                      <>
                        <h2 className="list-title">Walkthroughs complete</h2>
                        <div className="skill-list">
                          {completed.map((skill) => (
                            <ProgressCard
                              key={skill}
                              skill={skill}
                              saved={progress.lessons[skill]!}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
                <p className="local-note">
                  Completion records your practice, not a certification of skill
                  or safety.
                </p>
              </>
            )}
            {route.tab === "settings" && (
              <>
                <section className="page-intro">
                  <p className="eyebrow">Make yourself at home</p>
                  <h1 ref={heading} tabIndex={-1}>
                    A little more
                    <br />
                    <em>your way.</em>
                  </h1>
                </section>
                <section className="settings-card">
                  <h2>Your practice</h2>
                  <label className="setting-row">
                    <span>
                      <strong>Pause illustrations</strong>
                      <small>
                        Keep lesson artwork still. Your device’s reduced-motion
                        setting is also respected.
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      checked={paused}
                      onChange={(event) =>
                        setMotionPaused(event.target.checked)
                      }
                    />
                  </label>
                  <div className="setting-row">
                    <span>
                      <strong>Available offline</strong>
                      <small>
                        All nine illustrated lessons are included. No account
                        needed.
                      </small>
                    </span>
                    <Download size={22} aria-hidden="true" />
                  </div>
                  <div className="setting-row">
                    <span>
                      <strong>Saved on this device</strong>
                      <small>
                        Progress is private to this installation. Uninstalling
                        or clearing app data removes it. Website progress is
                        separate.
                      </small>
                    </span>
                    <Heart size={22} aria-hidden="true" />
                  </div>
                </section>
                <section className="settings-card">
                  <h2>A little extra help</h2>
                  <p>
                    Camera coaching and account features are available on the
                    website. They need an internet connection and may require
                    sign-in.
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => void openWeb("/learn")}
                  >
                    Open the website
                    <ExternalLink size={16} aria-hidden="true" />
                  </button>
                  <button
                    className="text-button privacy-link"
                    onClick={() => void openWeb("/privacy")}
                  >
                    Website privacy information
                    <ExternalLink size={14} aria-hidden="true" />
                  </button>
                </section>
                <p className="app-version">
                  plsteach.me · Mobile 1.0.0
                  <br />
                  Made for the things nobody taught you.
                </p>
              </>
            )}
          </>
        )}
      </main>
      {!route.skill && (
        <nav className="bottom-nav" aria-label="Main navigation">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => go(id)}
              aria-current={route.tab === id ? "page" : undefined}
            >
              <Icon size={22} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function SkillCard({
  skill,
  saved,
}: {
  skill: SkillId;
  saved?: LessonProgress;
}) {
  return (
    <button
      className="skill-card"
      onClick={() => go("skills", skill)}
      aria-label={`${saved?.completed ? "Review" : saved ? "Resume" : "Start"} ${name(skill)}`}
    >
      <span className={`skill-art tone-${skill}`}>
        <SkillIcon skill={skill} size={62} />
        {saved?.completed && (
          <span className="complete-badge">
            <Check size={14} />
          </span>
        )}
      </span>
      <span className="card-copy">
        <small>{catalogEntries[skill].categories[0]}</small>
        <strong>{name(skill)}</strong>
        <span>
          {saved?.completed
            ? "Walkthrough complete"
            : saved
              ? `Continue · Step ${saved.step + 1} of 7`
              : "7 steps · Illustrated guide"}
        </span>
      </span>
      <ChevronRight size={18} className="card-arrow" aria-hidden="true" />
    </button>
  );
}
function ProgressCard({
  skill,
  saved,
}: {
  skill: SkillId;
  saved: LessonProgress;
}) {
  return (
    <button className="progress-card" onClick={() => go("skills", skill)}>
      <span className={`progress-icon tone-${skill}`}>
        <SkillIcon skill={skill} size={32} />
      </span>
      <span>
        <strong>{name(skill)}</strong>
        <small>
          {saved.completed
            ? "Review your walkthrough"
            : `Continue at step ${saved.step + 1} of 7`}
        </small>
        <span className="mini-track" aria-hidden="true">
          {saved.checkpoints.map((checkpoint, index) => (
            <i
              key={index}
              data-checked={
                checkpoint === "self_checked" ||
                checkpoint === "camera_confirmed"
              }
            />
          ))}
        </span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}
function Explore({
  heading,
  progress,
}: {
  heading: React.RefObject<HTMLHeadingElement | null>;
  progress: Partial<Record<SkillId, LessonProgress>>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All skills");
  const filtered = skillIds.filter(
    (skill) =>
      (category === "All skills" ||
        catalogEntries[skill].categories.some((item) => item === category)) &&
      `${name(skill)} ${modules[skill].intro} ${catalogEntries[skill].keywords}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <section className="page-intro">
        <p className="eyebrow">The everyday, made easier</p>
        <h1 ref={heading} tabIndex={-1}>
          What will you
          <br />
          <em>learn today?</em>
        </h1>
        <p>Nine useful skills. Start wherever you are.</p>
      </section>
      <label className="search-box">
        <Search size={20} aria-hidden="true" />
        <span className="sr-only">Search skills</span>
        <input
          type="search"
          placeholder="Try sewing, laundry, cooking…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="category-list" role="group" aria-label="Filter skills">
        {["All skills", ...realLifeCategories].map((item) => (
          <button
            key={item}
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="results-label" role="status">
        {filtered.length} {filtered.length === 1 ? "skill" : "skills"} to make
        your own
      </div>
      <div className="explore-grid">
        {filtered.map((skill) => (
          <SkillCard key={skill} skill={skill} saved={progress[skill]} />
        ))}
      </div>
      {!filtered.length && (
        <section className="empty">
          <Search size={36} aria-hidden="true" />
          <h2>No matching skills yet.</h2>
          <p>Try another word or explore all nine lessons.</p>
          <button
            className="button secondary"
            onClick={() => {
              setQuery("");
              setCategory("All skills");
            }}
          >
            Clear filters
          </button>
        </section>
      )}
    </>
  );
}

function Lesson({
  skill,
  saved,
  update,
  onClose,
  onWeb,
}: {
  skill: SkillId;
  saved?: LessonProgress;
  update: (skill: SkillId, progress: LessonProgress | null) => void;
  onClose: () => void;
  onWeb: () => void;
}) {
  const progress = saved ?? emptyLessonProgress(skill);
  const lesson = modules[skill];
  const current = lesson.steps[progress.step];
  const [replay, setReplay] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const summary = progressSummary(progress);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [progress.step, progress.completed]);
  useEffect(() => {
    if (resetOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [resetOpen]);
  function move(step: number) {
    update(skill, {
      ...progress,
      step,
      completed: false,
      updatedAt: Date.now(),
    });
  }
  function advance(checked: boolean) {
    const next = recordCheckpoint(
      progress,
      progress.step,
      checked ? "self_checked" : "unresolved",
    );
    update(skill, {
      ...next,
      completed: progress.step === lesson.steps.length - 1,
      step: Math.min(progress.step + 1, lesson.steps.length - 1),
    });
  }
  return (
    <article className="lesson">
      <div className="lesson-topline">
        <button className="text-button" onClick={onClose}>
          <ArrowLeft size={18} aria-hidden="true" />
          All skills
        </button>
        <span>{name(skill)}</span>
        <button
          className="icon-button"
          aria-label="Reset lesson progress"
          onClick={() => setResetOpen(true)}
        >
          <RotateCcw size={17} />
        </button>
      </div>
      {progress.completed ? (
        <>
          <section className="completion">
            <div className="completion-symbol">
              <Check size={45} aria-hidden="true" />
            </div>
            <p className="eyebrow">Walkthrough complete</p>
            <h1 ref={heading} tabIndex={-1}>
              One little skill.
              <br />
              <em>A lovely big feeling.</em>
            </h1>
            <p>{lesson.outcome}</p>
            <p>
              {summary.self} self-checked · {summary.unresolved} unresolved
            </p>
          </section>
          <section className="settings-card">
            <h2>Your checkpoint record</h2>
            <p>
              These are your own checks, not a certification of safety or
              mastery. Revisit anything you’re unsure about.
            </p>
            <ol className="checkpoint-list">
              {lesson.steps.map((step, index) => (
                <li key={step.title}>
                  <button onClick={() => move(index)}>
                    <span>
                      {index + 1}. {step.title}
                      <small>
                        {checkpointLabels[progress.checkpoints[index]]}
                      </small>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          </section>
          <div className="completion-actions">
            <button className="button primary" onClick={onClose}>
              Find your next skill
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button className="text-button" onClick={() => setResetOpen(true)}>
              <RotateCcw size={16} aria-hidden="true" />
              Practice again
            </button>
          </div>
        </>
      ) : (
        <>
          <div
            className="step-track"
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuemin={0}
            aria-valuemax={lesson.steps.length}
            aria-valuenow={progress.step}
            aria-valuetext={`Step ${progress.step + 1} of ${lesson.steps.length}`}
          >
            {lesson.steps.map((_, index) => (
              <span
                key={index}
                data-active={index === progress.step}
                data-done={index < progress.step}
              />
            ))}
          </div>
          <div className="lesson-illustration">
            <LessonArtwork skill={skill} step={progress.step} replay={replay} />
            <button
              className="replay-button"
              onClick={() => setReplay((value) => value + 1)}
            >
              <RotateCcw size={14} aria-hidden="true" />
              Replay
            </button>
          </div>
          <section className="step-copy">
            <p className="eyebrow">
              Step {progress.step + 1} of {lesson.steps.length} · At your own
              pace
            </p>
            <h1 ref={heading} tabIndex={-1}>
              {current.title}
            </h1>
            <p className="instruction">{current.instruction}</p>
            <div className="tip">
              <Sparkles size={19} aria-hidden="true" />
              <p>{current.tip}</p>
            </div>
            <div className="self-check">
              <span className="eyebrow">Your little checkpoint</span>
              <p>{current.check}</p>
            </div>
          </section>
          <details className="lesson-details">
            <summary>What you’ll need & staying safe</summary>
            <ul>
              {lesson.materials.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>{catalogEntries[skill].prerequisite}</p>
            <p>{catalogEntries[skill].safety}</p>
          </details>
          <div className="lesson-actions">
            <button
              className="button secondary back-step"
              disabled={progress.step === 0}
              aria-label="Previous lesson step"
              onClick={() => move(progress.step - 1)}
            >
              <ArrowLeft size={19} />
            </button>
            <button className="button primary" onClick={() => advance(true)}>
              {progress.step === lesson.steps.length - 1
                ? "I checked it · Finish"
                : "I checked it · Next"}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
          <button
            className="text-button skip-step"
            onClick={() => advance(false)}
          >
            I’m not sure yet — leave this unresolved
          </button>
          <section className="online-help">
            <p>
              Want camera coaching? Open this lesson on the website. Internet
              and sign-in may be needed; your app progress stays here.
            </p>
            <button className="text-button" onClick={onWeb}>
              Open online lesson
              <ExternalLink size={14} aria-hidden="true" />
            </button>
          </section>
        </>
      )}
      <dialog
        ref={dialog}
        onCancel={() => setResetOpen(false)}
        aria-labelledby="reset-title"
      >
        <div className="dialog-heading">
          <h2 id="reset-title">Start this lesson again?</h2>
          <button
            className="icon-button"
            aria-label="Close reset dialog"
            onClick={() => setResetOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <p>
          This clears your saved steps for {name(skill).toLowerCase()}. Your
          other lessons stay as they are.
        </p>
        <div className="dialog-actions">
          <button
            className="button secondary"
            onClick={() => setResetOpen(false)}
            autoFocus
          >
            Keep my progress
          </button>
          <button
            className="button primary"
            onClick={() => {
              update(skill, null);
              setResetOpen(false);
            }}
          >
            Reset lesson
          </button>
        </div>
      </dialog>
    </article>
  );
}
