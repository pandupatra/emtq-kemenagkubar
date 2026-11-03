export default function ActionIcon({
  name,
}: {
  name: "refresh" | "sun" | "moon" | "logout" | "close" | "edit" | "eye" | "trash";
}) {
  const shapes = {
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15" />
        <path d="M10 10v7m4-7v7" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    edit: (
      <>
        <path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6Z" />
        <path d="M12 20h9" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3a7 7 0 0 0 11.6-1" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    moon: <path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />,
    logout: (
      <>
        <path d="M10 4H4v16h6M9 12h12m-4-4 4 4-4 4" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[name]}
    </svg>
  );
}
