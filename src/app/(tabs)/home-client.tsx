"use client";

import type { ReactNode } from "react";
import { AmbientParticles } from "@/components/particles";

export function HomeClient({ children }: { children: ReactNode }) {
  return (
    <>
      <AmbientParticles />
      {children}
    </>
  );
}
