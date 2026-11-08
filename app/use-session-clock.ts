"use client";

import { useEffect, useState } from "react";
import type { Person } from "@/lib/types";

export default function useSessionClock(people?: readonly Person[]) {
  const [revision, tick] = useState(0);
  useEffect(() => {
    const now = Date.now();
    let next = Infinity;
    for (const person of people ?? []) {
      for (const value of [person.session_starts_at, person.session_ends_at]) {
        const boundary = value ? Date.parse(value) : NaN;
        if (boundary > now) next = Math.min(next, boundary);
      }
    }
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(
      () => tick((value) => value + 1),
      Math.min(next - now + 1, 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [people, revision]);
}
