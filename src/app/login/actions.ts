"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getUiStrings } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { syncUiLangFromProfile } from "@/app/(tabs)/du/actions";

export type AuthState = { error: string | null };

const loginSchema = z.object({
  email: z.email("invalidEmail"),
  password: z.string().min(1, "passwordRequired"),
});

const signupSchema = z.object({
  email: z.email("invalidEmail"),
  password: z.string().min(8, "passwordMin"),
  displayName: z.string().trim().max(80, "nameTooLong").optional(),
});

/** Zod carries a message *key*; the UI language decides the wording. */
const AUTH_ERROR_KEYS = [
  "invalidEmail",
  "passwordRequired",
  "passwordMin",
  "nameTooLong",
] as const;

async function localizedIssue(message: string): Promise<string> {
  const { t } = await getUiStrings();
  const key = AUTH_ERROR_KEYS.find((candidate) => candidate === message);
  return key
    ? {
        invalidEmail: t.login.errorInvalidEmail,
        passwordRequired: t.login.errorPasswordRequired,
        passwordMin: t.login.errorPasswordMin,
        nameTooLong: t.login.errorNameTooLong,
      }[key]
    : message;
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: await localizedIssue(parsed.error.issues[0].message) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const { t } = await getUiStrings();
    return { error: t.login.errorWrongCredentials };
  }

  // A fresh device starts with no ui-lang cookie; restore the saved one.
  await syncUiLangFromProfile();
  redirect("/");
}

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName") ?? undefined,
  });
  if (!parsed.success) {
    return { error: await localizedIssue(parsed.error.issues[0].message) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName || null },
    },
  });
  if (error) {
    const { t } = await getUiStrings();
    return {
      error:
        error.code === "user_already_exists"
          ? t.login.errorAccountExists
          : t.login.errorSignupFailed,
    };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
