import type { AuthMode } from "@keepcv/api";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Icon } from "../../../components/icon/icon.js";
import { Button } from "../../../components/ui/button.js";
import { TextField } from "../../../components/ui/field.js";
import { signIn } from "../../../lib/auth-mode.js";

function Card({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <main className="backdrop-grid grid min-h-dvh place-items-center bg-canvas px-6 py-12 text-text">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-overlay">
        <span className="surface-gradient-brand grid size-9 place-items-center rounded-xl text-on-brand shadow-card">
          <Icon name="resume" size="md" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-text">{title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">{lead}</p>
        <div className="mt-5">{children}</div>
      </div>
    </main>
  );
}

function PasswordForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [password, setPassword] = useState("");
  const [refused, setRefused] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  // There is one field on this page and nothing before it.
  useEffect(() => {
    form.current?.querySelector("input")?.focus();
  }, []);

  return (
    <form
      ref={form}
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSending(true);
        void signIn(password).then((said) => {
          setSending(false);
          setRefused(said);
          if (said === undefined) onSignedIn();
        });
      }}
    >
      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={(next) => {
          setPassword(next);
          setRefused(undefined);
        }}
        error={refused}
      />
      <Button type="submit" tone="primary" size="lg" pending={sending} className="w-full">
        Sign in
      </Button>
    </form>
  );
}

export function SignIn({ mode, onSignedIn }: { mode: AuthMode; onSignedIn: () => void }) {
  if (mode === "password") {
    return (
      <Card title="Sign in" lead="This store is behind the password set on the machine running it.">
        <PasswordForm onSignedIn={onSignedIn} />
      </Card>
    );
  }

  // Reached only when the upstream let the request through without naming a
  // user, which is a proxy misconfiguration and not something to retry here.
  return (
    <Card
      title="Nobody was named"
      lead="This store reads who you are from the proxy in front of it, and the request arrived without a user on it. Sign in with your proxy, or check that it sets the header the launcher was told to read."
    >
      <Button
        tone="secondary"
        size="lg"
        className="w-full"
        onClick={() => {
          window.location.reload();
        }}
      >
        Try again
      </Button>
    </Card>
  );
}
