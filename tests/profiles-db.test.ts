import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

it("reserves usernames atomically, keeps old accounts, and protects private identity fields", async () => {
  const db = new PGlite();
  const a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222",
    c = "33333333-3333-4333-8333-333333333333";
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
    );
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      a,
      "old@example.com",
    ]);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261027090000_account_profiles.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(
      (
        await db.query(
          "select username from account_profiles where user_id=$1",
          [a],
        )
      ).rows,
    ).toEqual([{ username: null }]);
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3::jsonb)",
      [
        b,
        "ada@example.com",
        JSON.stringify({
          username: "ADA_L",
          first_name: "Ada",
          last_name: "Lovelace",
        }),
      ],
    );
    await expect(
      db.query(
        "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3::jsonb)",
        [c, "other@example.com", JSON.stringify({ username: "ada_l" })],
      ),
    ).rejects.toThrow(/unique|duplicate/);
    expect(
      (await db.query("select id from auth.users where id=$1", [c])).rows,
    ).toHaveLength(0);
    await db.exec(`set role anon;`);
    await expect(
      db.query("select * from public.account_profiles"),
    ).rejects.toThrow(/permission/);
    await expect(
      db.query("select public.account_login_email('ada_l')"),
    ).rejects.toThrow(/permission/);
    await db.exec(
      `reset role;select set_config('request.jwt.claim.sub','${b}',false);set role authenticated;`,
    );
    expect(
      (
        await db.query(
          "select username,first_name,last_name from public.account_profiles",
        )
      ).rows,
    ).toEqual([
      { username: "ada_l", first_name: "Ada", last_name: "Lovelace" },
    ]);
    await expect(
      db.query(
        "update public.account_profiles set username='hijacked' where user_id=$1",
        [a],
      ),
    ).rejects.toThrow(/permission/);
    await expect(
      db.query("select public.account_login_email('ada_l')"),
    ).rejects.toThrow(/permission/);
    await db.exec("reset role;set role service_role;");
    expect(
      (await db.query("select public.account_login_email(' ADA_L ') as email"))
        .rows,
    ).toEqual([{ email: "ada@example.com" }]);
    await expect(
      db.query(
        "update public.account_profiles set username='NOT_VALID' where user_id=$1",
        [b],
      ),
    ).rejects.toThrow(/check/);
    await db.exec("reset role;");
    expect(
      (
        await db.query(
          "select public,allowed_mime_types,file_size_limit from storage.buckets where id='profile-avatars'",
        )
      ).rows[0],
    ).toMatchObject({
      public: false,
      allowed_mime_types: ["image/jpeg"],
      file_size_limit: 262144,
    });
    await db.query("delete from auth.users where id=$1", [b]);
    expect(
      (await db.query("select * from account_profiles where user_id=$1", [b]))
        .rows,
    ).toHaveLength(0);
  } finally {
    await db.close();
  }
}, 30000);
