"use client";

import { useActionState, useState } from "react";
import { login, signup, type AuthState } from "./actions";

const initialState: AuthState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-line bg-background px-3 py-2.5 text-sm " +
  "outline-none transition focus:border-accent-bright focus:ring-2 " +
  "focus:ring-accent-bright/30";

const labelClasses =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted";

function SubmitButton({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold
        text-white transition hover:bg-accent-bright disabled:opacity-60"
    >
      {pending ? "Einen Moment …" : label}
    </button>
  );
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-error">
      {error}
    </p>
  );
}

export function LoginPanel() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loginPending] = useActionState(
    login,
    initialState,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signup,
    initialState,
  );

  const isLogin = mode === "login";

  return (
    <section className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
      <header className="mb-6 flex flex-col gap-1.5">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {isLogin ? "Willkommen zurück." : "Los geht's."}
        </h1>
        <p className="text-sm text-muted">
          {isLogin
            ? "Melde dich an und mach weiter, wo du warst."
            : "Erstelle dein Konto — kostenlos."}
        </p>
      </header>

      <form
        action={isLogin ? loginAction : signupAction}
        className="flex flex-col gap-4"
      >
        {!isLogin && (
          <div>
            <label htmlFor="displayName" className={labelClasses}>
              Name <span className="normal-case">(optional)</span>
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              placeholder="Wie sollen wir dich nennen?"
              className={inputClasses}
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className={labelClasses}>
            E-Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClasses}>
            Passwort
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={isLogin ? undefined : 8}
            className={inputClasses}
          />
        </div>

        <ErrorNote error={isLogin ? loginState.error : signupState.error} />

        <SubmitButton
          label={isLogin ? "Anmelden" : "Konto erstellen"}
          pending={isLogin ? loginPending : signupPending}
        />
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        {isLogin ? "Neu hier?" : "Schon ein Konto?"}{" "}
        <button
          type="button"
          onClick={() => setMode(isLogin ? "signup" : "login")}
          className="font-medium text-accent-bright hover:underline"
        >
          {isLogin ? "Konto erstellen" : "Anmelden"}
        </button>
      </p>

      <p className="mt-6 border-t border-line pt-4 text-center text-xs text-muted">
        Du bleibst auf diesem Gerät angemeldet.
        <br />
        <span className="opacity-75">You&apos;ll stay signed in on this device.</span>
      </p>
    </section>
  );
}
