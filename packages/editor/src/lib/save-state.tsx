import { Failure } from "../app/states.js";
import { Button } from "../components/ui/button.js";

export function SaveState({
  saving,
  pending,
  error,
  retry,
}: {
  saving: boolean;
  pending: boolean;
  error: unknown;
  retry: () => Promise<boolean>;
}) {
  return (
    <div>
      <p role="status" className="text-xs text-text-subtle">
        {saving ? "Saving" : pending ? "Not saved yet" : "Saved"}
      </p>
      {error === null ? null : (
        <>
          <Failure error={error} />
          <Button
            onClick={() => {
              void retry();
            }}
          >
            Retry saving
          </Button>
        </>
      )}
    </div>
  );
}
