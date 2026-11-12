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

export type FinalPeopleSort =
  | "name-asc"
  | "name-desc"
  | "number-asc"
  | "number-desc"
  | "session-asc"
  | "session-desc";
export function filterFinalParticipants(
  data: Pick<Data, "people" | "results" | "categories">,
  filters: {
    query: string;
    category: string;
    district: string;
    gender: string;
    status: string;
    sort: FinalPeopleSort;
  },
  displayNumber: (person: Person) => string,
): Person[] {
  const names = new Map(data.categories.map((c) => [c.id, c.name]));
  const drawn = new Set(
    data.results
      .filter((r) => !r.cancelled)
      .map((r) => JSON.stringify([r.person_id, r.category])),
  );
  const search = filters.query.trim().toLocaleLowerCase("id");
  const compare = new Intl.Collator("id", {
    sensitivity: "base",
    numeric: true,
  });
  return data.people
    .filter((p) => {
      if (filters.category && !p.entries.includes(filters.category))
        return false;
      if (filters.district && p.district !== filters.district) return false;
      if (filters.gender && p.gender !== filters.gender) return false;
      if (
        !`${p.name} ${displayNumber(p)} ${p.district}`
          .toLocaleLowerCase("id")
          .includes(search)
      )
        return false;
      if (filters.status === "scheduled")
        return !!p.session_starts_at && !!p.session_ends_at;
      const entries = filters.category ? [filters.category] : p.entries;
      const hasDrawn = entries.some((id) =>
        drawn.has(JSON.stringify([p.id, names.get(id)])),
      );
      return (
        !filters.status || (filters.status === "drawn" ? hasDrawn : !hasDrawn)
      );
    })
    .sort((a, b) => {
      const byName =
        compare.compare(a.name, b.name) || compare.compare(a.id, b.id);
      if (filters.sort.startsWith("session-")) {
        const startA = Date.parse(a.session_starts_at || ""),
          startB = Date.parse(b.session_starts_at || "");
        const validA = Number.isFinite(startA),
          validB = Number.isFinite(startB);
        if (validA !== validB) return validA ? -1 : 1;
        if (!validA) return byName;
        return (
          (filters.sort === "session-asc"
            ? startA - startB
            : startB - startA) || byName
        );
      }
      if (filters.sort.startsWith("number-")) {
        const byNumber = compare.compare(displayNumber(a), displayNumber(b));
        return (filters.sort === "number-asc" ? byNumber : -byNumber) || byName;
      }
      return filters.sort === "name-desc" ? -byName : byName;
    });
}
