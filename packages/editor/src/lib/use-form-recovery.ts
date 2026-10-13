import { type Timestamp, timestampSchema } from "@keepcv/schema";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { forgetEdit, keepEdit, readEdit, useRecoveryKey } from "./edit-recovery.js";

export function useFormRecovery<T>(
  recoveryKey: string,
  schema: z.ZodType<T>,
  initial: T,
  expectedUpdatedAt?: Timestamp,
) {
  const key = useRecoveryKey(recoveryKey);
  const [state, setState] = useState(() => {
    const recovered = z
      .object({ values: schema, expectedUpdatedAt: timestampSchema.optional() })
      .safeParse(readEdit(key));
    return {
      values: recovered.success ? recovered.data.values : initial,
      expectedUpdatedAt: recovered.success ? recovered.data.expectedUpdatedAt : expectedUpdatedAt,
      pending: recovered.success,
    };
  });
  const held = useRef(state);
  const saving = useRef(false);

  function replace(next: typeof state): void {
    held.current = next;
    setState(next);
  }

  useEffect(() => {
    if (!state.pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.pending]);

  return {
    values: state.values,
    expectedUpdatedAt: state.expectedUpdatedAt,
    pending: state.pending,
    setValues: (update: T | ((current: T) => T)) => {
      const current = held.current;
      const values =
        typeof update === "function" ? (update as (current: T) => T)(current.values) : update;
      const next = { ...current, values, pending: true };
      keepEdit(key, { values, expectedUpdatedAt: next.expectedUpdatedAt });
      replace(next);
    },
    begin: () => {
      if (saving.current) return undefined;
      saving.current = true;
      const { values, expectedUpdatedAt: token } = held.current;
      return { values, expectedUpdatedAt: token };
    },
    finish: () => {
      saving.current = false;
    },
    acknowledge: (
      sent: { values: T; expectedUpdatedAt?: Timestamp | undefined },
      stored: T,
      token?: Timestamp,
    ) => {
      forgetEdit(key, sent);
      const current = held.current;
      if (current.values === sent.values) {
        replace({ values: stored, expectedUpdatedAt: token, pending: false });
        return true;
      } else if (
        JSON.stringify(readEdit(key)) ===
        JSON.stringify({ values: current.values, expectedUpdatedAt: current.expectedUpdatedAt })
      ) {
        keepEdit(key, { values: current.values, expectedUpdatedAt: token });
        replace({ ...current, expectedUpdatedAt: token });
      }
      return false;
    },
    discard: (values: T, token?: Timestamp) => {
      const current = held.current;
      forgetEdit(key, { values: current.values, expectedUpdatedAt: current.expectedUpdatedAt });
      replace({ values, expectedUpdatedAt: token, pending: false });
    },
  };
}
