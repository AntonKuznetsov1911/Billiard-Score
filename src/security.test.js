import { describe, it, expect } from "vitest";
import { validatePublicConfig } from "./securityConfig.js";
import { parseBackup, validateBackupFile, MAX_BACKUP_BYTES } from "./backupImport.js";
import { normalizeData } from "./gameLogic.js";

const publicKey = "sb_publishable_test_only_1234567890";
describe("security boundaries", () => {
  it("allows offline mode and public Supabase configuration", () => {
    expect(() => validatePublicConfig({})).not.toThrow();
    expect(() => validatePublicConfig({ VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: publicKey })).not.toThrow();
  });
  it.each(["http://example.com", "https://user:password@example.com", "https://example.com/?token=private"])("rejects unsafe backend URL %s", (url) => {
    expect(() => validatePublicConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: publicKey })).toThrow();
  });
  it("rejects privileged keys and incomplete configuration", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9." + btoa(JSON.stringify({role:"service_role"})) + ".test";
    expect(() => validatePublicConfig({ VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: token })).toThrow();
    expect(() => validatePublicConfig({ VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "sb_secret_test_only" })).toThrow();
    expect(() => validatePublicConfig({ VITE_SUPABASE_URL: "https://example.supabase.co" })).toThrow();
  });
  it("rejects sensitive VITE variables even with an otherwise valid configuration", () => {
    expect(() => validatePublicConfig({ VITE_ADMIN_PASSWORD: "test-only" })).toThrow();
  });
  it("allows an anon key but rejects an authenticated JWT", () => {
    const token = (role) => "eyJhbGciOiJIUzI1NiJ9." + btoa(JSON.stringify({role})) + ".test";
    expect(() => validatePublicConfig({ VITE_SUPABASE_URL:"https://example.supabase.co", VITE_SUPABASE_ANON_KEY:token("anon") })).not.toThrow();
    expect(() => validatePublicConfig({ VITE_SUPABASE_URL:"https://example.supabase.co", VITE_SUPABASE_ANON_KEY:token("authenticated") })).toThrow();
  });
  it("validates backup extension, MIME, size and structure before replacing data", () => {
    expect(() => validateBackupFile({ name:"backup.json", type:"", size:100 })).not.toThrow();
    for (const file of [
      {name:"backup.html",type:"application/json",size:100},
      {name:"backup.json",type:"text/html",size:100},
      {name:"backup.json",type:"application/json",size:MAX_BACKUP_BYTES+1},
      {name:"backup.json",type:"application/json",size:0}
    ]) expect(() => validateBackupFile(file)).toThrow();
    for (const value of ["null", "[]", "{}", '{"players":[],"matches":"wrong"}']) expect(() => parseBackup(value)).toThrow();
    expect(parseBackup('{"players":[],"matches":[]}')).toEqual({players:[],matches:[]});
  });
  it("removes reserved identifiers from untrusted scores and player lists", () => {
    const raw = JSON.parse('{"players":[{"id":"constructor","name":"bad"},{"id":"p1","name":"Safe"}],"matches":[{"id":"m1","date":"2026-11-06","participants":["p1","__proto__"],"scores":{"p1":8,"constructor":10,"__proto__":12}}]}');
    const normalized = normalizeData(raw);
    expect(normalized.players.map((p)=>p.id)).toEqual(["p1"]);
    expect(normalized.matches[0].participants).toEqual(["p1"]);
    expect(Object.keys(normalized.matches[0].scores)).toEqual(["p1"]);
    expect(Object.getPrototypeOf(normalized.matches[0].scores)).toBe(Object.prototype);
  });
});
