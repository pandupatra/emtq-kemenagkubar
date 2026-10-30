export type Profile = {
  id: string;
  username: string;
  district: string | null;
  role: "admin" | "district";
  active: boolean;
};
export type Category = { id: string; name: string };
export type Person = {
  id: string;
  name: string;
  district: string;
  birth: string;
  gender: string;
  entries: string[];
  status: string;
  note: string;
};
export type Session = {
  id: string;
  category_id: string;
  open: boolean;
};
export type Package = {
  id: string;
  category_id: string;
  code: string;
  surah: string;
  verses: string;
};
export type Result = {
  id: string;
  person_id: string;
  session_id: string;
  package_id: string;
  name: string;
  district: string;
  category: string;
  code: string;
  surah: string;
  verses: string;
  gender: string;
  created_at: string;
  cancelled: boolean;
  reason: string;
};
export type Log = { id: string; message: string; created_at: string };
export type Data = {
  profile: Profile;
  profiles: Profile[];
  categories: Category[];
  people: Person[];
  sessions: Session[];
  packages: Package[];
  results: Result[];
  logs: Log[];
};
