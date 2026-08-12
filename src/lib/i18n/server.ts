import { cookies } from "next/headers";
import { getStrings, parseUiLang, UI_LANG_COOKIE, type UiLang, type UiStrings } from "./strings";

/** The interface language for this request. The cookie mirrors
 *  learner_profiles.prefs.uiLang so unauthenticated pages (login) and
 *  the root layout render in the right language without a DB read. */
export async function getUiLang(): Promise<UiLang> {
  const store = await cookies();
  return parseUiLang(store.get(UI_LANG_COOKIE)?.value);
}

export async function getUiStrings(): Promise<{ lang: UiLang; t: UiStrings }> {
  const lang = await getUiLang();
  return { lang, t: getStrings(lang) };
}
