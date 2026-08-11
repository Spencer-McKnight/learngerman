import type { ReactNode } from "react";
import { TabBar } from "@/components/tab-bar";

/** The three calm home surfaces share the bottom tab bar; the session
 *  player and placement flow run full-screen without it. */
export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="flex flex-1 flex-col pb-24">{children}</div>
      <TabBar />
    </>
  );
}
