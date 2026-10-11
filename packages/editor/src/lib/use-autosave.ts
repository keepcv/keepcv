import { useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { forgetEdit, keepEdit, readEdit } from "./edit-recovery.js";

export function useAutosave<T>(
  key: string,
  read: (value: unknown) => T | null,
  save: (value: T) => Promise<unknown>,
  valid: (value: T) => boolean,
) {
  const [pending, setPending] = useState<T | null>(() => read(readEdit(key)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const held = useRef<T | null>(pending);
  const flight = useRef<Promise<boolean> | null>(null);
  const latest = useRef({ save, valid });
  latest.current = { save, valid };

  const flush = useCallback((): Promise<boolean> => {
    if (flight.current !== null) return flight.current;
    if (held.current === null) return Promise.resolve(true);
    const run = async (): Promise<boolean> => {
      setSaving(true);
      try {
        while (held.current !== null) {
          const value = held.current;
          if (!latest.current.valid(value)) throw new Error("Correct the settings before leaving.");
          await latest.current.save(value);
          if (held.current === value) {
            held.current = null;
            setPending(null);
            forgetEdit(key, value);
          }
        }
        setError(null);
        return true;
      } catch (reason) {
        setError(reason);
        return false;
      } finally {
        setSaving(false);
      }
    };
    flight.current = run().finally(() => {
      flight.current = null;
    });
    return flight.current;
  }, [key]);

  useEffect(() => {
    if (pending === null || !valid(pending) || error !== null) return;
    const timer = setTimeout(() => {
      void flush();
    }, 500);
    return () => {
      clearTimeout(timer);
    };
  }, [pending, valid, error, flush]);

  useEffect(
    () => () => {
      if (held.current !== null) void flush();
    },
    [flush],
  );
  useBlocker({
    shouldBlockFn: async () => !(await flush()),
    enableBeforeUnload: pending !== null || saving,
    disabled: pending === null && !saving,
  });

  return {
    pending,
    saving,
    error,
    flush,
    change: (value: T) => {
      held.current = value;
      keepEdit(key, value);
      setPending(value);
      setError(null);
    },
  };
}
