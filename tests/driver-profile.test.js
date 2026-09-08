import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { validateDriverProfile } from "../src/driver-profile.js";

test("profile inputs are bounded and links canonical and private", () => {
  const base = {
    display_name: " Driver ",
    psn_id: "driver_7",
    gt7_profile_url: "",
  };
  assert.equal(validateDriverProfile(base).visibility, "private");
  assert.equal(validateDriverProfile(base).display_name, "Driver");
  assert.throws(() => validateDriverProfile({ ...base, display_name: " " }));
  assert.throws(() => validateDriverProfile({ ...base, psn_id: "invalid id" }));
  assert.throws(() =>
    validateDriverProfile({
      ...base,
      gt7_profile_url: "https://evil.example/profile",
    }),
  );
});

test("private profiles reject anonymous access, cross-account CRUD and public visibility", async () => {
  const db = new PGlite();
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('${a}'),('${b}');`);
    await db.exec(
      await readFile(
        "supabase/migrations/20260908205300_private_driver_profiles.sql",
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        "supabase/migrations/20260908153234_gt7_telemetry.sql",
        "utf8",
      ),
    );
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`,
    );
    await db.query(
      "insert into driver_profiles(owner_id,display_name) values ($1,$2)",
      [a, "Alice"],
    );
    await db.query(
      "insert into gt7_sessions(id,owner_id,payload) values ($1,$1,'{}')",
      [a],
    );
    assert.equal(
      (await db.query("select visibility from driver_profiles")).rows[0]
        .visibility,
      "private",
    );
    await assert.rejects(
      db.query("update driver_profiles set visibility='public'"),
      /check constraint/,
    );
    await assert.rejects(
      db.query("update driver_profiles set owner_id=$1", [b]),
      /row-level security/,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    assert.equal(
      (await db.query("select * from driver_profiles")).rows.length,
      0,
    );
    assert.equal((await db.query("select * from gt7_sessions")).rows.length, 0);
    assert.equal(
      (await db.query("update gt7_sessions set payload='{}' returning *")).rows
        .length,
      0,
    );
    assert.equal(
      (await db.query("delete from gt7_sessions returning *")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into gt7_sessions(id,owner_id,payload) values ($1,$2,'{}')",
        [b, a],
      ),
      /row-level security/,
    );
    assert.equal(
      (
        await db.query(
          "update driver_profiles set display_name='Hacked' returning *",
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await db.query("delete from driver_profiles returning *")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into driver_profiles(owner_id,display_name) values ($1,$2)",
        [a, "Spoof"],
      ),
      /row-level security/,
    );
    await db.query(
      "insert into driver_profiles(owner_id,display_name) values ($1,$2)",
      [b, "Bob"],
    );
    assert.equal(
      (await db.query("select display_name from driver_profiles")).rows[0]
        .display_name,
      "Bob",
    );
    await db.exec("reset role; set role anon;");
    await assert.rejects(
      db.query("select * from driver_profiles"),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        "insert into driver_profiles(owner_id,display_name) values ($1,$2)",
        [a, "Anon"],
      ),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
