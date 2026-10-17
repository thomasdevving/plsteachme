"use client";
import { useId, useState } from "react";
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
export function PasswordField({
  value,
  onChange,
  disabled,
  confirm = false,
  current = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  confirm?: boolean;
  current?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const label = confirm
    ? "Confirm password"
    : current
      ? "Password"
      : "New password";
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password">
        <input
          id={id}
          name={confirm ? "confirm-password" : "password"}
          type={visible ? "text" : "password"}
          autoComplete={current ? "current-password" : "new-password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={current ? 1 : PASSWORD_MIN_LENGTH}
          maxLength={current ? 1024 : 72}
          disabled={disabled}
          aria-describedby={!current && !confirm ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setVisible(!visible)}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {!current && !confirm && (
        <p id={`${id}-hint`} className="auth-hint">
          {PASSWORD_HINT}
        </p>
      )}
    </div>
  );
}
