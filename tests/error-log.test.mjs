import assert from "node:assert/strict";
import test from "node:test";
import { rapikanError, abaikanErrorBrowser } from "../src/lib/error-log.ts";

test("rapikanError: potong panjang, buang query string, default aman", () => {
  const r = rapikanError({ sumber: "browser", pesan: "x".repeat(900), stack: "s".repeat(9000), path: "/premium/sukses?order_id=SJLPT-123#a" });
  assert.equal(r.pesan.length, 500);
  assert.equal(r.stack.length, 4000);
  assert.equal(r.path, "/premium/sukses");
  assert.equal(rapikanError({ sumber: "server", pesan: "   " }).pesan, "(tanpa pesan)");
  assert.equal(rapikanError({ sumber: "aneh", pesan: "a" }).sumber, "browser");
  assert.equal(rapikanError({ sumber: "server", pesan: "a" }).path, null);
});

test("abaikanErrorBrowser: ekstensi, Script error, ResizeObserver, abort", () => {
  assert.equal(abaikanErrorBrowser("boom", "chrome-extension://abc/x.js"), true);
  assert.equal(abaikanErrorBrowser("Script error."), true);
  assert.equal(abaikanErrorBrowser("ResizeObserver loop completed with undelivered notifications."), true);
  assert.equal(abaikanErrorBrowser("AbortError: signal is aborted"), true);
  assert.equal(abaikanErrorBrowser("TypeError: Cannot read properties of undefined", "https://jlpt-solver.vercel.app/_next/x.js"), false);
});
