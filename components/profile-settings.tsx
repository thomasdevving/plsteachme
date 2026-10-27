"use client";
import { useCallback, useEffect, useState } from "react";
import { fetchWithTimeout } from "@/lib/network";
import { prepareProfilePhoto } from "@/lib/profile-photo";
import type { AccountProfile } from "@/lib/auth/profile";

export function ProfileSettings() {
  const [profile, setProfile] = useState<AccountProfile | null>(null),
    [loading, setLoading] = useState(true);
  const [username, setUsername] = useState(""),
    [firstName, setFirstName] = useState(""),
    [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchWithTimeout("/api/profile", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Your profile could not load.");
      const value = result.profile as AccountProfile | null;
      setProfile(value);
      setUsername(value?.username || "");
      setFirstName(value?.firstName || "");
      setLastName(value?.lastName || "");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your profile could not load.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function action(kind: string, request: () => Promise<Response>) {
    setBusy(kind);
    setError("");
    setMessage("");
    try {
      const response = await request();
      const result = await response.json().catch(() => null);
      if (!response.ok || !result)
        throw new Error(result?.error || "Your profile could not be updated.");
      setProfile(result.profile);
      if (kind === "save" && result.profile) {
        setUsername(result.profile.username);
        setFirstName(result.profile.firstName);
        setLastName(result.profile.lastName);
      }
      setMessage(
        kind === "save"
          ? "Your profile has been saved."
          : kind === "remove"
            ? "Your photo has been removed."
            : "Your photo has been updated.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your profile could not be updated.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="account-profile" aria-labelledby="profile-heading">
      <h2 id="profile-heading">Your profile</h2>
      {loading ? (
        <p role="status">Loading your profile…</p>
      ) : (
        <>
          <div className="profile-photo-row">
            {profile?.hasAvatar ? (
              <img
                className="profile-avatar"
                src={`/api/profile/avatar?v=${encodeURIComponent(profile.updatedAt)}`}
                width={80}
                height={80}
                alt="Your profile photo"
              />
            ) : (
              <span
                className="profile-avatar profile-initials"
                aria-label="No profile photo"
              >
                {`${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase() ||
                  "?"}
              </span>
            )}
            <div>
              <label className="profile-upload" htmlFor="profile-photo">
                {busy === "photo" ? "Uploading…" : "Choose a profile photo"}
              </label>
              <input
                id="profile-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!!busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  void action("photo", async () =>
                    fetchWithTimeout("/api/profile/avatar", {
                      method: "POST",
                      headers: { "Content-Type": "image/jpeg" },
                      body: await prepareProfilePhoto(file),
                    }),
                  );
                }}
              />
              <p className="auth-hint">
                JPG, PNG or WebP, up to 5 MB. Cropped to a square.
              </p>
              {profile?.hasAvatar && (
                <button
                  type="button"
                  className="auth-text-button"
                  disabled={!!busy}
                  onClick={() =>
                    action("remove", () =>
                      fetchWithTimeout("/api/profile/avatar", {
                        method: "DELETE",
                      }),
                    )
                  }
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void action("save", () =>
                fetchWithTimeout("/api/profile", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ username, firstName, lastName }),
                }),
              );
            }}
          >
            <div className="profile-name-fields">
              <label htmlFor="profile-first-name">
                First name
                <input
                  id="profile-first-name"
                  autoComplete="given-name"
                  maxLength={80}
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={!!busy}
                />
              </label>
              <label htmlFor="profile-last-name">
                Last name
                <input
                  id="profile-last-name"
                  autoComplete="family-name"
                  maxLength={80}
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={!!busy}
                />
              </label>
            </div>
            <label htmlFor="profile-username">Username</label>
            <input
              id="profile-username"
              autoComplete="username"
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9_]{3,24}"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!!busy}
              aria-describedby="profile-username-hint"
            />
            <p id="profile-username-hint" className="auth-hint">
              3–24 letters, numbers or underscores. Usernames are not
              case-sensitive.
            </p>
            <button className="button primary" disabled={!!busy}>
              {busy === "save" ? "Saving…" : "Save profile"}
            </button>
          </form>
          <p className="auth-hint">
            Your name and photo are private account details.{" "}
            <a href="/forgot-password">Set or change your password</a>.
          </p>
        </>
      )}
      {error && (
        <>
          <p className="auth-error" role="alert">
            {error}
          </p>
          {!profile && (
            <button
              type="button"
              className="auth-text-button"
              onClick={load}
              disabled={!!busy || loading}
            >
              Reload profile
            </button>
          )}
        </>
      )}
      <p className="profile-message" role="status">
        {message}
      </p>
    </section>
  );
}
