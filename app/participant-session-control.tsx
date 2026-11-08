import type { Person } from "@/lib/types";
import { participantSessionLabel } from "@/lib/participant-session";

export default function ParticipantSessionControl({
  person,
  busy,
  onConfigure,
}: {
  person: Person;
  busy: boolean;
  onConfigure?: () => void;
}) {
  const [status, ...details] = participantSessionLabel(person).split(" · ");
  return (
    <div className="participant-session-control">
      <div className="participant-session-summary" role="status">
        <span className="participant-session-state">{status}</span>
        <span className="participant-session-detail">
          {details.join(" · ")}
        </span>
      </div>
      {onConfigure ? (
        <button
          type="button"
          className="btn participant-session-button"
          disabled={busy}
          aria-label={`Atur sesi ${person.name}`}
          onClick={onConfigure}
        >
          Atur sesi
        </button>
      ) : null}
    </div>
  );
}
