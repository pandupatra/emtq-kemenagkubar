import Workspace from "./workspace";
import InitialPageLoader from "./initial-page-loader";
export default function Page() {
  return (
    <InitialPageLoader>
      <Workspace
        configured={Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        )}
      />
    </InitialPageLoader>
  );
}
