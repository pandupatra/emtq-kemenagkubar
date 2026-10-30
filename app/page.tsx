import Workspace from "./workspace";
export default function Page() {
  return (
    <Workspace
      configured={Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      )}
    />
  );
}
