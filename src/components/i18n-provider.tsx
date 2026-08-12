"use client";

/** Carries the interface language (resolved server-side from the
 *  ui-lang cookie) to every client component via context. */

import { createContext, useContext, type ReactNode } from "react";
import { getStrings, type UiLang, type UiStrings } from "@/lib/i18n/strings";

const I18nContext = createContext<UiLang>("de");

export function I18nProvider({
  lang,
  children,
}: {
  lang: UiLang;
  children: ReactNode;
}) {
  return <I18nContext.Provider value={lang}>{children}</I18nContext.Provider>;
}

export function useUiLang(): UiLang {
  return useContext(I18nContext);
}

export function useStrings(): UiStrings {
  return getStrings(useContext(I18nContext));
}
