export function TrialSaveStatus({
  error,
  saving,
  retry,
}: {
  error: string;
  saving: boolean;
  retry: () => void;
}) {
  return error ? (
    <div className="trial-save-status" role="alert">
      <p>{error}</p>
      <button className="button secondary" onClick={retry}>
        Retry saving
      </button>
    </div>
  ) : saving ? (
    <p className="small-note" role="status">
      Saving your session…
    </p>
  ) : null;
}
