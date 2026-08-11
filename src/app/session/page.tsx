import { Suspense } from "react";
import { SessionPlayer } from "./player";

/** Full-screen session player; the mode arrives as ?modus= from Heute. */
export default function SessionPage() {
  return (
    <Suspense>
      <SessionPlayer />
    </Suspense>
  );
}
