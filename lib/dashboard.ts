import type { Data } from "./types";

export function summarizeParticipants(
  data: Pick<Data, "people" | "profiles" | "results" | "categories">,
) {
  const categoryNames = new Map(data.categories.map((c) => [c.id, c.name]));
  const activeDraws = new Set(
    data.results
      .filter((r) => !r.cancelled)
      .map((r) => JSON.stringify([r.person_id, r.category])),
  );
  const districts = new Map<
    string,
    { district: string; total: number; drawn: number; remaining: number }
  >();
  for (const profile of data.profiles) {
    if (profile.role === "district" && profile.district) {
      districts.set(profile.district, {
        district: profile.district,
        total: 0,
        drawn: 0,
        remaining: 0,
      });
    }
  }
  let drawn = 0;
  for (const person of data.people) {
    const hasDrawn = person.entries.some((id) =>
      activeDraws.has(JSON.stringify([person.id, categoryNames.get(id)])),
    );
    const row = districts.get(person.district) ?? {
      district: person.district,
      total: 0,
      drawn: 0,
      remaining: 0,
    };
    row.total += 1;
    row.drawn += Number(hasDrawn);
    row.remaining += Number(!hasDrawn);
    drawn += Number(hasDrawn);
    districts.set(person.district, row);
  }
  return {
    total: data.people.length,
    drawn,
    remaining: data.people.length - drawn,
    districts: [...districts.values()].sort((a, b) =>
      a.district.localeCompare(b.district, "id"),
    ),
  };
}
