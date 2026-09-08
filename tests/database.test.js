import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("database enforces tenant isolation, ownership and valid records", async () => {
  const db = new PGlite();
  const alice = "00000000-0000-4000-8000-000000000001";
  const bob = "00000000-0000-4000-8000-000000000002";
  const id = "00000000-0000-4000-8000-000000000003";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('${alice}'),('${bob}');`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20260908140215_paddock_workspace.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false);`,
    );
    const payload = {
      number: "14",
      model: "Porsche",
      driver: "Alex",
      status: "Ready",
      fuel: 60,
    };
    await db.query(
      "insert into public.paddock_records(id,owner_id,kind,payload) values ($1,$2,$3,$4)",
      [id, alice, "cars", payload],
    );
    assert.equal(
      (await db.query("select * from public.paddock_records")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("update public.paddock_records set owner_id=$1 where id=$2", [
        bob,
        id,
      ]),
      /row-level security/,
    );
    await assert.rejects(
      db.query("update public.paddock_records set payload=$1 where id=$2", [
        { ...payload, fuel: -1 },
        id,
      ]),
      /valid_fuel/,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${bob}',false);`);
    assert.equal(
      (await db.query("select * from public.paddock_records")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("delete from public.paddock_records returning id")).rows
        .length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "update public.paddock_records set payload=payload returning id",
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into public.paddock_records(owner_id,kind,payload) values ($1,$2,$3)",
        [alice, "cars", payload],
      ),
      /row-level security/,
    );
    await db.exec("reset role; set role anon;");
    await assert.rejects(
      db.query("select * from public.paddock_records"),
      /permission denied/,
    );
    await db.exec(
      `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false);`,
    );
    assert.equal(
      (await db.query("delete from public.paddock_records returning id")).rows
        .length,
      1,
    );
  } finally {
    await db.close();
  }
});
