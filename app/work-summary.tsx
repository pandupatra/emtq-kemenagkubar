import type { Data } from "@/lib/types";
import { summarizeParticipants } from "@/lib/dashboard";

type Filter = { district?: string; status?: "drawn" | "not-drawn" };

export default function WorkSummary({
  data,
  openPeople,
}: {
  data: Data;
  openPeople: (filter: Filter) => void;
}) {
  const summary = summarizeParticipants(data);
  const number = new Intl.NumberFormat("id-ID");
  const percent = summary.total
    ? Math.round((summary.drawn / summary.total) * 100)
    : 0;
  return (
    <div className="work-summary">
      <section
        className="panel overview-panel"
        aria-labelledby="overview-title"
      >
        <h2 id="overview-title">Peserta & undian</h2>
        <div className="overview-counts">
          {[
            { label: "Total peserta", value: summary.total, filter: {} },
            {
              label: "Sudah mengundi",
              value: summary.drawn,
              filter: { status: "drawn" as const },
            },
            {
              label: "Belum mengundi",
              value: summary.remaining,
              filter: { status: "not-drawn" as const },
            },
          ].map((item) => (
            <button
              className="overview-count"
              key={item.label}
              onClick={() => openPeople(item.filter)}
            >
              <span>{item.label}</span>
              <strong>{number.format(item.value)}</strong>
              <span className="overview-link">
                Lihat peserta <span aria-hidden="true">→</span>
              </span>
            </button>
          ))}
        </div>
        <div className="overview-progress">
          <p>
            <strong>{percent}%</strong> peserta sudah mengundi
          </p>
          <progress
            max={summary.total || 1}
            value={summary.drawn}
            aria-label="Peserta yang sudah mengundi"
          />
        </div>
        <p className="hint overview-note">
          Peserta dihitung sekali jika memiliki hasil undian aktif pada
          setidaknya satu cabang yang diikuti. Hasil yang dibatalkan tidak
          dihitung.
        </p>
      </section>
      <section
        className="panel district-overview"
        aria-labelledby="district-overview-title"
      >
        <div className="section-head">
          <div>
            <h2 id="district-overview-title">Peserta per kecamatan</h2>
            <p className="hint">
              Bandingkan jumlah peserta dan progres undian setiap kafilah.
            </p>
          </div>
          <button className="btn" onClick={() => openPeople({})}>
            Lihat semua peserta
          </button>
        </div>
        {summary.districts.length ? (
          <div
            className="district-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Rekap peserta per kecamatan"
          >
            <table className="district-overview-table">
              <caption className="sr-only">
                Jumlah peserta, peserta yang sudah mengundi dan belum mengundi
                per kecamatan
              </caption>
              <thead>
                <tr>
                  <th scope="col">Kecamatan</th>
                  <th scope="col" className="numeric">
                    Peserta
                  </th>
                  <th scope="col" className="numeric">
                    Sudah <span>mengundi</span>
                  </th>
                  <th scope="col" className="numeric">
                    Belum <span>mengundi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.districts.map((row) => (
                  <tr key={row.district}>
                    <th scope="row">
                      <button
                        className="district-name"
                        onClick={() => openPeople({ district: row.district })}
                      >
                        {row.district}
                      </button>
                    </th>
                    <td className="numeric">{number.format(row.total)}</td>
                    <td className="numeric">{number.format(row.drawn)}</td>
                    <td className="numeric">
                      {row.remaining ? (
                        <button
                          className="district-remaining"
                          aria-label={`${row.remaining} peserta belum mengundi di ${row.district}`}
                          onClick={() =>
                            openPeople({
                              district: row.district,
                              status: "not-drawn",
                            })
                          }
                        >
                          {number.format(row.remaining)}
                        </button>
                      ) : (
                        "0"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td className="numeric">{number.format(summary.total)}</td>
                  <td className="numeric">{number.format(summary.drawn)}</td>
                  <td className="numeric">
                    {number.format(summary.remaining)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty">
            <h3>Belum ada data peserta</h3>
            <p>
              Tambahkan peserta melalui Daftar peserta untuk mulai memantau
              undian.
            </p>
            <button className="btn" onClick={() => openPeople({})}>
              Buka daftar peserta
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
