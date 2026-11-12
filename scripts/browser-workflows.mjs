import { createServer } from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

export default async function verifyBrowser({
  connection,
  database,
  admin,
  district,
  db,
}) {
  const category = (
    await db.query(
      "insert into public.categories(name) values('QA UI Tartil') returning id",
    )
  ).rows[0].id;
  const session = (
    await db.query(
      "insert into public.sessions(category_id,open) values($1,true) returning id",
      [category],
    )
  ).rows[0].id;
  const person = (
    await db.query(
      "insert into public.people(name,district,birth,gender,entries,session_open) values('QA UI Participant','MELAK','2000-01-01','Putra',$1,true) returning id",
      [[category]],
    )
  ).rows[0].id;
  await db.query(
    "insert into public.packages(category_id,surah,verses) values($1,'QA UI Al-Fatihah','1-7'),($1,'QA UI Al-Baqarah','1-5')",
    [category],
  );
  const pool = new pg.Pool({ ...connection, database, max: 5 });
  const tables = new Set([
    "profiles",
    "people",
    "categories",
    "sessions",
    "packages",
    "results",
    "logs",
    "final_participants",
    "final_sessions",
    "final_packages",
    "final_results",
  ]);
  const server = createServer(async (req, res) => {
    const client = await pool.connect();
    try {
      const actor = req.headers["x-fixture-actor"];
      if (![admin, district].includes(actor))
        throw Error("Unknown fixture actor");
      const url = new URL(req.url, "http://localhost");
      await client.query("begin");
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
        actor,
      ]);
      await client.query("set local role authenticated");
      let data;
      if (req.method === "POST") {
        let body = "";
        for await (const chunk of req) body += chunk;
        const args = JSON.parse(body),
          rpc = url.pathname.split("/").at(-1);
        if (rpc === "delete_final_draw_history")
          data = (
            await client.query(
              "select public.delete_final_draw_history($1) result",
              [args.result_ids],
            )
          ).rows[0].result;
        else if (rpc === "maqro_final_action")
          data = (
            await client.query(
              "select public.maqro_final_action($1,$2) result",
              [args.action, args.payload],
            )
          ).rows[0].result;
        else if (rpc === "maqro_action")
          data = (
            await client.query("select public.maqro_action($1,$2) result", [
              args.action,
              args.payload,
            ])
          ).rows[0].result;
        else if (rpc === "edit_maqro")
          data = (
            await client.query("select public.edit_maqro($1) result", [
              args.payload,
            ])
          ).rows[0].result;
        else if (rpc === "delete_draw_history")
          data = (
            await client.query("select public.delete_draw_history($1) result", [
              args.result_ids,
            ])
          ).rows[0].result;
        else if (rpc === "delete_participant")
          data = (
            await client.query("select public.delete_participant($1) result", [
              args.participant_id,
            ])
          ).rows[0].result;
        else throw Error("Unsupported fixture RPC");
      } else {
        const table = url.pathname.split("/").at(-1);
        if (!tables.has(table)) throw Error("Unsupported fixture table");
        const params = [],
          where = [];
        for (const key of ["id", "district", "category_id", "person_id"]) {
          const value = url.searchParams.get(key);
          if (value?.startsWith("eq.")) {
            params.push(value.slice(3));
            where.push(`"${key}"=$${params.length}`);
          }
        }
        const rows = (
          await client.query(
            `select * from public."${table}"${where.length ? " where " + where.join(" and ") : ""} order by ${["logs", "results"].includes(table) ? "created_at desc, id" : "id"}`,
            params,
          )
        ).rows;
        const offset = Number(url.searchParams.get("offset") || 0),
          limit = Number(url.searchParams.get("limit") || 500);
        data = rows.slice(offset, offset + limit);
        res.setHeader(
          "content-range",
          `${offset}-${offset + data.length - 1}/${rows.length}`,
        );
        if (req.headers.accept?.includes("vnd.pgrst.object"))
          data = data[0] ?? null;
      }
      await client.query("commit");
      res.writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "content-range",
      });
      res.end(JSON.stringify(data));
    } catch (error) {
      console.error("Fixture API error:", error.message);
      await client.query("rollback");
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: error.message }));
    } finally {
      client.release();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const config = {
    category,
    admin,
    district,
    person,
    session,
    bridge: `http://127.0.0.1:${server.address().port}`,
    app: process.env.MAQRO_TEST_APP_URL || "http://localhost:3000",
  };
  fs.mkdirSync("output/playwright", { recursive: true });
  const codefile = path.resolve("output/playwright/current-workflows.js");
  fs.writeFileSync(
    codefile,
    `async page => (${browserFlow.toString()})(page,${JSON.stringify(config)})`,
  );
  const cli = path.resolve("node_modules/@playwright/cli/playwright-cli.js");
  const cliSession = `qa-${database.slice(-8)}`;
  const run = (args) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [cli, `-s=${cliSession}`, ...args],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      child.on("error", reject);
      child.on("close", (code) =>
        code === 0 && !output.includes("### Error")
          ? resolve(output)
          : reject(Error(output)),
      );
    });
  try {
    await run(["open", "about:blank"]);
    const output = await run(["run-code", `--filename=${codefile}`]);
    fs.writeFileSync("output/playwright/current-workflows-result.txt", output);
    if (!output.includes("browserWorkflows"))
      throw Error(
        "Browser workflow did not finish; inspect output/playwright/current-workflows-result.txt",
      );
    console.log(output.split("### Ran Playwright code")[0].trim());
  } finally {
    await run(["close"]).catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
}

async function browserFlow(page, cfg) {
  let role = "admin";
  let finalMissing = false;
  const errors = [],
    writes = [],
    requests = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.includes("/auth/") || u.pathname.includes("/rest/"))
      requests.push(r.method() + " " + u.pathname);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const user = () => ({
    id: cfg[role],
    email: `${role === "admin" ? "admin" : "melak"}@accounts.maqro.invalid`,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  });
  const token = () =>
    [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ),
      Buffer.from(
        JSON.stringify({
          sub: cfg[role],
          role: "authenticated",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url"),
      "fixture",
    ].join(".");
  await page.route("**/auth/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/logout")) return route.fulfill({ json: {} });
    if (pathname.endsWith("/token"))
      role = route.request().postDataJSON().email.startsWith("admin@")
        ? "admin"
        : "district";
    return route.fulfill({
      json: pathname.endsWith("/user")
        ? user()
        : {
            access_token: token(),
            refresh_token: "fixture-" + role,
            token_type: "bearer",
            expires_in: 3600,
            user: user(),
          },
    });
  });
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (finalMissing && url.pathname.includes("/final_"))
      return route.fulfill({
        status: 404,
        json: { code: "PGRST205", message: "Final migration not applied" },
      });
    if (request.method() === "POST") writes.push(request.postDataJSON());
    const response = await page.request.fetch(
      cfg.bridge + url.pathname + url.search,
      {
        method: request.method(),
        headers: { ...request.headers(), "x-fixture-actor": cfg[role] },
        data: request.postData() ?? undefined,
      },
    );
    return route.fulfill({ response });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(cfg.app);
  await page.locator(".initial-page-loader").waitFor({ state: "hidden" });
  const login = async (name) => {
    await page.getByLabel("Nama pengguna *", { exact: true }).fill(name);
    await page
      .getByLabel("Kata sandi *", { exact: true })
      .fill("fixture-password");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await page
      .getByRole("button", { name: "Daftar peserta", exact: true })
      .waitFor({ timeout: 10000 })
      .catch(async (error) => {
        throw Error(
          error.message +
            "\n" +
            (await page.locator("#workspace").innerText()) +
            "\nRequests: " +
            JSON.stringify(requests) +
            "\nErrors: " +
            JSON.stringify(errors) +
            "\nInputs: " +
            JSON.stringify(
              await page.locator("form input").evaluateAll((inputs) =>
                inputs.map((i) => ({
                  name: i.name,
                  type: i.type,
                  length: i.value.length,
                  valid: i.validity.valid,
                  message: i.validationMessage,
                })),
              ),
            ),
        );
      });
  };
  await login("melak");
  await page.getByRole("button", { name: "Undian maqro", exact: true }).click();
  await page
    .getByLabel("Cari peserta", { exact: true })
    .fill("QA UI Participant");
  await page
    .getByRole("button", {
      name: "Undi maqro QA UI Participant, QA UI Tartil",
      exact: true,
    })
    .click();
  await page
    .getByRole("heading", { name: "Periksa data undian", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Tetapkan maqro", exact: true })
    .click();
  await page.locator(".receipt").waitFor();
  const receipt = await page.locator(".receipt").innerText();
  if (!receipt.includes("QA UI Participant") || !receipt.includes("QA UI Al-"))
    throw Error("Saved receipt missing");
  await page
    .getByRole("button", { name: "Kembali ke peserta", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Lihat bukti QA UI Participant, QA UI Tartil",
      exact: true,
    })
    .waitFor();
  if (
    writes.filter((w) => w.action === "draw" && w.payload.id === cfg.person)
      .length !== 1
  )
    throw Error("Duplicate browser draw request");
  await page.reload();
  await page.getByRole("button", { name: "Undian maqro", exact: true }).click();
  await page
    .getByLabel("Cari peserta", { exact: true })
    .fill("QA UI Participant");
  await page
    .getByRole("button", {
      name: "Lihat bukti QA UI Participant, QA UI Tartil",
      exact: true,
    })
    .click();
  await page.locator(".receipt").waitFor();
  if ((await page.locator(".receipt").innerText()) !== receipt)
    throw Error("Receipt changed after reload");
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await login("admin");
  await page
    .getByRole("button", { name: "Daftar peserta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Atur sesi QA UI Participant", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Jadwalkan sesi", exact: true })
    .check();
  await page.getByRole("group", { name: "Mulai", exact: true }).waitFor();
  for (const [label, hour] of [
    ["Mulai", "12"],
    ["Selesai", "14"],
  ]) {
    const group = page.getByRole("group", { name: label, exact: true });
    for (const [name, value] of [
      ["Tahun", "2030"],
      ["Bulan", "11"],
      ["Tanggal", "10"],
      ["Jam", hour],
      ["Menit", "00"],
    ]) {
      await group.getByRole("spinbutton", { name, exact: true }).fill(value);
    }
  }
  await page
    .getByRole("button", { name: "Simpan pengaturan", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const savedSchedule = writes.findLast(
    (w) => w.action === "participant-session",
  );
  if (
    savedSchedule?.payload.session_starts_at !== "2030-11-10T04:00:00.000Z" ||
    savedSchedule?.payload.session_ends_at !== "2030-11-10T06:00:00.000Z"
  )
    throw Error("Browser schedule timezone conversion failed");
  await page
    .getByRole("button", { name: "Atur sesi QA UI Participant", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Jadwalkan sesi", exact: true })
    .uncheck();
  await page.getByLabel("Status sesi", { exact: true }).selectOption("false");
  await page
    .getByRole("button", { name: "Simpan pengaturan", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Tambah peserta", exact: true })
    .click();
  await page
    .getByLabel("Nama lengkap *", { exact: true })
    .fill("QA UI Created");
  await page
    .getByLabel("Cabang yang diikuti *", { exact: true })
    .selectOption(cfg.category);
  await page.getByLabel("Kecamatan *", { exact: true }).selectOption("MELAK");
  await page.getByLabel("Tanggal lahir *", { exact: true }).fill("2000-01-01");
  await page.getByRole("button", { name: "Simpan data", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Atur sesi QA UI Created", exact: true })
    .waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel", exact: true }).click();
  const download = await downloadPromise;
  const chunks = [];
  for await (const chunk of await download.createReadStream())
    chunks.push(chunk);
  if (Buffer.concat(chunks).subarray(0, 2).toString() !== "PK")
    throw Error("Invalid XLSX export");
  for (const name of [
    "Cabang & sesi",
    "Bank maqro",
    "Akun kecamatan",
    "Catatan aktivitas",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.locator("#workspace").waitFor();
  }
  await page
    .getByRole("button", { name: "Daftar peserta", exact: true })
    .click();
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw Error(`Page overflow at ${width}`);
    await page.screenshot({
      path: `output/playwright/workflows-${width}.png`,
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  const captureFinal = async (name) => {
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error(name + " overflow " + width);
      await page.screenshot({
        path: "output/playwright/final-" + name + "-" + width + ".png",
        fullPage: true,
      });
    }
  };
  await page.getByRole("button", { name: "Final", exact: true }).click();
  await page
    .getByRole("button", { name: "Pilih finalis", exact: true })
    .click();
  await page.getByLabel("Cabang *", { exact: true }).selectOption(cfg.category);
  await page.getByLabel("Cari peserta terdaftar").fill("QA UI Participant");
  await page
    .getByRole("checkbox", { name: "Pilih QA UI Participant", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Periksa 1 finalis terpilih", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tetapkan finalis", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Atur sesi QA UI Participant", exact: true })
    .click();
  await captureFinal("schedule-dialog");
  await page.getByLabel("Status sesi", { exact: true }).selectOption("true");
  await page
    .getByRole("button", { name: "Simpan pengaturan", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await captureFinal("people");
  const resetFinalFilters = page.getByRole("button", {
    name: "Reset filter & urutan",
    exact: true,
  });
  if (!(await resetFinalFilters.isDisabled()))
    throw Error("Final default filter reset should be disabled");
  await page
    .getByRole("columnheader", { name: "Nama", exact: true })
    .getByRole("button")
    .click();
  if (
    (await page
      .getByRole("columnheader", { name: "Nama", exact: true })
      .getAttribute("aria-sort")) !== "descending"
  )
    throw Error("Final name header sort missing");
  const descendingFinalNames = await page
    .locator('.final-people-table tbody td[data-label="Nama"] strong')
    .allTextContents();
  if (descendingFinalNames[0] !== "QA UI Participant")
    throw Error("Final name sorting did not reorder rows");
  await page
    .getByRole("columnheader", { name: "No. peserta", exact: true })
    .getByRole("button")
    .click();
  if ((await page.locator("#final-sort").inputValue()) !== "number-asc")
    throw Error("Final number header and dropdown disagree");
  await page
    .getByRole("columnheader", { name: "Sesi finalis", exact: true })
    .getByRole("button")
    .click();
  if ((await page.locator("#final-sort").inputValue()) !== "session-asc")
    throw Error("Final session sort missing");
  await page.locator("#final-gender").selectOption("Putri");
  if (await page.locator(".final-people-table").count())
    throw Error("Final gender filter did not narrow results");
  await resetFinalFilters.click();
  await page.locator("#final-draw-status").selectOption("scheduled");
  if (await page.locator(".final-people-table").count())
    throw Error("Final scheduled filter includes manual sessions");
  await resetFinalFilters.click();
  await page.locator("#final-category").selectOption(cfg.category);
  await page.locator("#final-gender").selectOption("Putra");
  await page.locator("#final-draw-status").selectOption("not-drawn");
  if ((await page.locator(".final-people-table tbody tr").count()) !== 1)
    throw Error("Combined Final filters failed");
  await resetFinalFilters.click();
  await page.setViewportSize({ width: 360, height: 1000 });
  await page.locator("#final-sort").selectOption("name-desc");
  if (
    (
      await page
        .locator('.final-people-table tbody td[data-label="Nama"] strong')
        .allTextContents()
    )[0] !== "QA UI Participant"
  )
    throw Error("Mobile Final sorting failed");
  await captureFinal("filters-sorting");
  await resetFinalFilters.click();
  if (
    (await page.locator("#final-sort").inputValue()) !== "name-asc" ||
    (await page.locator(".final-people-table tbody tr").count()) !== 4
  )
    throw Error("Final reset did not restore rows and sorting");

  await page
    .getByRole("button", { name: "Ringkasan kerja", exact: true })
    .click();
  await page.locator(".work-summary").waitFor();
  const finalTotals = await page
    .locator(".overview-count strong")
    .allTextContents();
  if (JSON.stringify(finalTotals) !== JSON.stringify(["4", "2", "2"]))
    throw Error("Final summary counts mixed rounds: " + finalTotals);
  await page
    .getByRole("heading", { name: "Peserta per kecamatan", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Peserta per cabang", exact: true })
    .waitFor();
  if (await page.locator(".final-people-table").count())
    throw Error("Final summary still renders participant list");
  await captureFinal("summary");
  await page
    .locator(".overview-count")
    .filter({ hasText: "Belum mengundi" })
    .click();
  await page.locator("#final-draw-status").waitFor();
  if ((await page.locator("#final-draw-status").inputValue()) !== "not-drawn")
    throw Error("Final summary status filter lost");
  if ((await page.locator(".final-people-table tbody tr").count()) !== 2)
    throw Error("Final remaining filter incorrect");
  await page
    .getByRole("button", { name: "Ringkasan kerja", exact: true })
    .click();
  await page.locator(".district-name").filter({ hasText: "MELAK" }).click();
  if ((await page.locator("#final-district").inputValue()) !== "MELAK")
    throw Error("Final summary district filter lost");
  await page
    .getByRole("button", { name: "Ringkasan kerja", exact: true })
    .click();
  await page.getByRole("button", { name: "Penyisihan", exact: true }).click();
  await page.locator(".work-summary").waitFor();
  const preliminaryTotals = await page
    .locator(".overview-count strong")
    .allTextContents();
  if (preliminaryTotals[0] === "4")
    throw Error("Preliminary summary uses finalist totals");
  await page.getByRole("button", { name: "Final", exact: true }).click();
  await page.locator(".work-summary").waitFor();
  await page.getByRole("button", { name: "Bank maqro", exact: true }).click();
  await page
    .getByRole("button", { name: "Tambah maqro final", exact: true })
    .click();
  await page.getByLabel("Cabang *", { exact: true }).selectOption(cfg.category);
  await page
    .getByLabel("Surah / materi *", { exact: true })
    .fill("QA Final Al-Kahf");
  await page
    .getByLabel("Ayat / rentang materi *", { exact: true })
    .fill("1-10");
  await page
    .getByRole("button", { name: "Simpan maqro final", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Cabang & sesi", exact: true })
    .click();
  await page.locator(".final-sessions-table").waitFor();
  await captureFinal("sessions");
  await page
    .locator(".final-sessions-table tr", { hasText: "QA UI Tartil" })
    .getByRole("button", { name: "Buka undian final", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Buka undian final", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await login("melak");
  await page.getByRole("button", { name: "Undian maqro", exact: true }).click();
  await page.getByRole("button", { name: "Final", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Undi maqro final QA UI Participant, QA UI Tartil",
      exact: true,
    })
    .click();
  await page
    .getByRole("heading", { name: "Periksa data undian final", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Undi maqro final", exact: true })
    .click();
  await page.locator(".receipt").waitFor();
  const finalReceipt = await page.locator(".receipt").innerText();
  if (
    !finalReceipt.includes("Final") ||
    !finalReceipt.includes("QA Final Al-Kahf")
  )
    throw Error("Final receipt missing");
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw Error("Final receipt overflow " + width);
    await page.screenshot({
      path: "output/playwright/final-receipt-" + width + ".png",
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Kembali ke finalis", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Lihat hasil final QA UI Participant, QA UI Tartil",
      exact: true,
    })
    .waitFor();
  await captureFinal("draw-picker");
  await page.getByRole("button", { name: "Penyisihan", exact: true }).click();
  await page
    .getByLabel("Cari peserta", { exact: true })
    .fill("QA UI Participant");
  await page
    .getByRole("button", {
      name: "Lihat bukti QA UI Participant, QA UI Tartil",
      exact: true,
    })
    .click();
  await page.locator(".receipt").waitFor();
  if ((await page.locator(".receipt").innerText()) !== receipt)
    throw Error("Final affected preliminary receipt");
  await page.reload();
  await page.getByRole("button", { name: "Undian maqro", exact: true }).click();
  await page.getByRole("button", { name: "Final", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Lihat hasil final QA UI Participant, QA UI Tartil",
      exact: true,
    })
    .click();
  if ((await page.locator(".receipt").innerText()) !== finalReceipt)
    throw Error("Final receipt changed on reload");

  await page
    .getByRole("button", { name: "Daftar peserta", exact: true })
    .click();
  if (await page.getByRole("button", { name: /Hapus.*histori/ }).count())
    throw Error("District sees Final history deletion controls");
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await login("admin");
  await page
    .getByRole("button", { name: "Daftar peserta", exact: true })
    .click();
  await page.getByRole("button", { name: "Final", exact: true }).click();
  await page
    .getByLabel("Cari finalis", { exact: true })
    .fill("QA UI Participant");
  await page
    .getByRole("button", {
      name: "Hapus histori QA UI Tartil, QA UI Participant",
      exact: true,
    })
    .click();
  const deletesBefore = writes.filter((w) =>
    Array.isArray(w.result_ids),
  ).length;
  await page
    .getByRole("button", { name: "Hapus permanen", exact: true })
    .click();
  if (
    writes.filter((w) => Array.isArray(w.result_ids)).length !== deletesBefore
  )
    throw Error("Deletion bypassed checkbox confirmation");
  await captureFinal("delete-history-dialog");
  await page.getByRole("checkbox", { name: /Saya memahami/ }).check();
  await page
    .getByRole("button", { name: "Hapus permanen", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  if ((await page.locator(".final-people-table tbody tr").count()) !== 1)
    throw Error("History deletion removed finalist");
  await page.getByText("Belum ada hasil undian", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Hapus seluruh histori Final", exact: true })
    .click();
  if (
    !(await page.getByRole("dialog").innerText()).includes(
      "3 hasil undian Final",
    )
  )
    throw Error("Bulk deletion scope incorrectly follows search filter");
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  if (
    writes.filter((w) => Array.isArray(w.result_ids)).length !==
    deletesBefore + 1
  )
    throw Error("Cancel triggered history deletion");
  await page
    .getByRole("button", { name: "Hapus seluruh histori Final", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Saya memahami/ }).check();
  await page
    .getByRole("button", { name: "Hapus permanen", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  if (
    !(await page
      .getByRole("button", { name: "Hapus seluruh histori Final", exact: true })
      .isDisabled())
  )
    throw Error("Bulk-delete button remains enabled for empty history");
  await page
    .getByRole("button", { name: "Reset filter & urutan", exact: true })
    .click();
  if ((await page.locator(".final-people-table tbody tr").count()) !== 4)
    throw Error("Bulk history deletion removed finalists");
  await page.reload();
  await page
    .getByRole("button", { name: "Daftar peserta", exact: true })
    .click();
  await page.getByRole("button", { name: "Final", exact: true }).click();
  if (
    !(await page
      .getByRole("button", { name: "Hapus seluruh histori Final", exact: true })
      .isDisabled())
  )
    throw Error("Deleted history returned after reload");
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await login("melak");
  finalMissing = true;
  await page.reload();
  await page.getByRole("button", { name: "Undian maqro", exact: true }).click();
  await page.getByRole("button", { name: "Final", exact: true }).click();
  await page
    .getByRole("heading", { name: "Babak Final belum diaktifkan", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Penyisihan", exact: true }).click();
  await page
    .getByRole("heading", { name: "Pilih peserta undian", exact: true })
    .waitFor();
  if (errors.length) throw Error(errors.join(";"));
  return {
    browserWorkflows: "PASS",
    flow: "browser → local HTTP → PostgreSQL RPC → receipt → reload",
    pageErrors: 0,
    productionWrites: 0,
  };
}
