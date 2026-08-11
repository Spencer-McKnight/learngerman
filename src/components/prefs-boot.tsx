"use client";

import { useEffect } from "react";

/** Applies device-level preferences (stored in localStorage) on load. */
export function PrefsBoot() {
  useEffect(() => {
    if (window.localStorage.getItem("lg:das-amber") === "on") {
      document.documentElement.classList.add("das-amber");
    }
  }, []);
  return null;
}
