import type { Data, Person, Session, Package, Result } from "./types";

export type Finalist = Pick<
  Person,
  "session_open" | "session_starts_at" | "session_ends_at"
> & {
  id: string;
  category_id: string;
};
export type FinalData = {
  final_participants: Finalist[];
  final_sessions: Session[];
  final_packages: Package[];
  final_results: Result[];
};

export function finalPeople(people: Person[], finalists: Finalist[]): Person[] {
  const entries = new Map(finalists.map((p) => [p.id, p]));
  return people.flatMap((p) => {
    const finalist = entries.get(p.id);
    return finalist
      ? [{ ...p, ...finalist, entries: [finalist.category_id] }]
      : [];
  });
}

export function finalExportData(base: Data, final: FinalData): Data {
  return {
    ...base,
    people: finalPeople(base.people, final.final_participants),
    sessions: final.final_sessions,
    packages: final.final_packages,
    results: final.final_results,
  };
}
