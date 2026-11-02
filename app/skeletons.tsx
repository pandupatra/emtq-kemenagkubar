import type { ReactNode } from "react";

function Bar({
  wide = false,
  tall = false,
}: {
  wide?: boolean;
  tall?: boolean;
}) {
  return (
    <span
      className={`skeleton-bar${wide ? " skeleton-wide" : ""}${tall ? " skeleton-tall" : ""}`}
    />
  );
}

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="skeleton-region" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function LoginSkeleton() {
  return (
    <Frame label="Memeriksa sesi dan memuat ruang kerja">
      <div className="form-stack skeleton-login">
        <div className="skeleton-field">
          <Bar />
          <Bar wide tall />
        </div>
        <div className="skeleton-field">
          <Bar />
          <Bar wide tall />
        </div>
        <Bar wide tall />
      </div>
    </Frame>
  );
}

export function ReceiptSkeleton({
  label = "Memuat bukti hasil undian",
}: {
  label?: string;
}) {
  return (
    <Frame label={label}>
      <div className="receipt skeleton-receipt">
        <div className="receipt-head">
          <div className="skeleton-field">
            <Bar tall />
            <Bar wide />
          </div>
          <Bar />
        </div>
        <div className="skeleton-details">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i}>
              <Bar />
              <Bar wide />
            </div>
          ))}
        </div>
        <div className="skeleton-result">
          <Bar />
          <Bar wide tall />
          <Bar />
          <Bar />
        </div>
        <Bar wide />
      </div>
    </Frame>
  );
}

function Rows() {
  return (
    <section className="panel skeleton-rows">
      {Array.from({ length: 4 }, (_, i) => (
        <div className="skeleton-row" key={i}>
          <div className="skeleton-field">
            <Bar tall />
            <Bar wide />
          </div>
          <Bar wide tall />
          <Bar tall />
        </div>
      ))}
    </section>
  );
}

export function WorkspaceSkeleton({ page }: { page: string }) {
  const label = "Memuat data ruang kerja";
  if (page === "sessions") {
    const columns = ["Cabang", "Paket", "Status", "Tindakan"];
    return (
      <Frame label="Memuat cabang dan sesi">
        <section className="panel data-panel">
          <table className="table sessions-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>
                    <Bar wide />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map((row) => (
                <tr key={row}>
                  {columns.map((column, index) => (
                    <td data-label={column} key={column}>
                      <Bar wide tall={index >= 3} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </Frame>
    );
  }
  if (page === "receipt") return <ReceiptSkeleton />;
  if (page === "dashboard")
    return (
      <Frame label={label}>
        <div className="work-summary">
          <section className="panel overview-panel">
            <Bar tall />
            <div className="overview-counts">
              {[0, 1, 2].map((item) => (
                <div className="overview-count skeleton-field" key={item}>
                  <Bar />
                  <Bar tall />
                  <Bar />
                </div>
              ))}
            </div>
            <Bar wide />
          </section>
          <section className="panel">
            <Bar tall />
            {[0, 1, 2, 3, 4].map((row) => (
              <div className="skeleton-row" key={row}>
                <Bar wide />
                <Bar />
                <Bar />
              </div>
            ))}
          </section>
        </div>
      </Frame>
    );
  if (page === "bank")
    return (
      <Frame label="Memuat bank maqro">
        <div className="cardgrid">
          {Array.from({ length: 6 }, (_, i) => (
            <section className="panel skeleton-field" key={i}>
              <Bar tall />
              <Bar />
              <div className="skeleton-task">
                <Bar />
                <Bar wide />
                <Bar />
              </div>
            </section>
          ))}
        </div>
      </Frame>
    );
  if (page === "logs")
    return (
      <Frame label="Memuat catatan aktivitas">
        <section className="panel">
          <Bar tall />
          {Array.from({ length: 5 }, (_, i) => (
            <div className="log-item skeleton-field" key={i}>
              <Bar wide />
              <Bar />
            </div>
          ))}
        </section>
      </Frame>
    );
  if (page === "draw")
    return (
      <Frame label="Memuat peserta undian">
        <div className="draw-layout">
          <div className="skeleton-steps">
            {[0, 1, 2, 3].map((i) => (
              <Bar key={i} />
            ))}
          </div>
          <div className="filters">
            {[0, 1, 2].map((i) => (
              <div className="field skeleton-field" key={i}>
                <Bar />
                <Bar wide tall />
              </div>
            ))}
          </div>
          <Rows />
        </div>
      </Frame>
    );
  return (
    <Frame
      label={
        page === "people"
          ? "Memuat daftar peserta"
          : page === "accounts"
            ? "Memuat akun kecamatan"
            : "Memuat hasil undian"
      }
    >
      {page === "people" ? (
        <div className="filters">
          {[0].map((i) => (
            <div className="field skeleton-field" key={i}>
              <Bar />
              <Bar wide tall />
            </div>
          ))}
        </div>
      ) : null}
      <Rows />
    </Frame>
  );
}
