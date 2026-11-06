"use client";

import { useActionState, useState } from "react";
import { login, signup, type AuthState } from "./actions";
import { useStrings, useUiLang } from "@/components/i18n-provider";
import { Button, Card, Field } from "@/components/ui";

const initialState: AuthState = { error: null };

export function LoginPanel() {
  const t = useStrings();
  const uiLang = useUiLang();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loginPending] = useActionState(login, initialState);
  const [signupState, signupAction, signupPending] = useActionState(signup, initialState);

  const isLogin = mode === "login";
  const error = isLogin ? loginState.error : signupState.error;
  const pending = isLogin ? loginPending : signupPending;

  return (
    <Card variant="raised" className="w-full max-w-sm p-7">
      <header className="mb-6 flex flex-col gap-1.5">
        <h1 className="font-display text-display-l text-ink">
          {isLogin ? t.login.titleLogin : t.login.titleSignup}
        </h1>
        <p className="text-body-sm text-ink-muted">
          {isLogin ? t.login.subLogin : t.login.subSignup}
        </p>
      </header>

      <form action={isLogin ? loginAction : signupAction} className="flex flex-col gap-4">
        {!isLogin && (
          <Field
            label={
              <>
                {t.login.name} <span className="font-normal text-ink-muted">{t.login.optional}</span>
              </>
            }
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            placeholder={t.login.namePlaceholder}
          />
        )}

        <Field
          label={t.login.email}
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
        />

        <Field
          label={t.login.password}
          id="password"
          name="password"
          type="password"
          required
          autoComplete={isLogin ? "current-password" : "new-password"}
          minLength={isLogin ? undefined : 8}
          error={error}
        />

        <Button type="submit" size="lg" loading={pending} className="mt-1">
          {isLogin ? t.login.signIn : t.login.createAccount}
        </Button>
      </form>

      <p className="mt-5 text-center text-body-sm text-ink-muted">
        {isLogin ? t.login.newHere : t.login.haveAccount}{" "}
        <button
          type="button"
          onClick={() => setMode(isLogin ? "signup" : "login")}
          className="min-h-11 font-semibold text-accent hover:underline"
        >
          {isLogin ? t.login.createAccount : t.login.signIn}
        </button>
      </p>

      <p className="mt-5 border-t border-hairline pt-4 text-center text-caption text-ink-muted">
        {t.login.staySignedIn}
        {uiLang === "de" && (
          <>
            <br />
            <span lang="en" className="opacity-80">
              You&apos;ll stay signed in on this device.
            </span>
          </>
        )}
      </p>
    </Card>
  );
}
