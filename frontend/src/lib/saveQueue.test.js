import test from "node:test";
import assert from "node:assert/strict";
import { createSaveQueue } from "./saveQueue.js";

const defer = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

test("an edit typed during an in-flight save is persisted", async () => {
  let draft = "a";
  const sent = [];
  const gates = [];
  const q = createSaveQueue({
    getPayload: () => draft,
    save: (p) => {
      sent.push(p);
      const d = defer();
      gates.push(d);
      return d.promise;
    },
  });
  q.markDirty();
  const first = q.flush();
  await tick(); // first save is now in flight
  draft = "ab";
  q.markDirty();
  assert.equal(q.flush(), first, "concurrent flush joins the running one");
  gates[0].resolve();
  await tick();
  assert.equal(q.isDirty(), true, "still dirty until the second save resolves");
  gates[1].resolve();
  assert.deepEqual(await first, { ok: true });
  assert.deepEqual(sent, ["a", "ab"]);
  assert.equal(q.isDirty(), false);
});

test("saved status is reported only after the latest version is saved", async () => {
  let draft = "a";
  const gates = [];
  const status = [];
  const q = createSaveQueue({
    getPayload: () => draft,
    save: () => {
      const d = defer();
      gates.push(d);
      return d.promise;
    },
    onStatus: (s) => status.push(s),
  });
  q.markDirty();
  const flushed = q.flush();
  await tick();
  draft = "b";
  q.markDirty();
  gates[0].resolve();
  await tick();
  assert.deepEqual(status, ["saving"]);
  gates[1].resolve();
  await flushed;
  assert.deepEqual(status, ["saving", "saved"]);
});

test("a failed save stays dirty and a later flush retries", async () => {
  let fail = true;
  const q = createSaveQueue({
    getPayload: () => "x",
    save: async () => {
      if (fail) throw new Error("boom");
    },
  });
  q.markDirty();
  const failed = await q.flush();
  assert.equal(failed.ok, false);
  assert.equal(q.isDirty(), true);
  fail = false;
  assert.deepEqual(await q.flush(), { ok: true });
  assert.equal(q.isDirty(), false);
});

test("a null payload flush does not wedge later saves", async () => {
  let payload = null;
  const sent = [];
  const status = [];
  const q = createSaveQueue({
    getPayload: () => payload,
    save: async (p) => {
      sent.push(p);
    },
    onStatus: (s) => status.push(s),
  });
  q.markDirty();
  assert.deepEqual(await q.flush(), { ok: true });
  assert.deepEqual(sent, []);
  assert.equal(q.isSaving(), false);
  assert.ok(!status.includes("saved"), "nothing was saved, so do not claim saved");

  payload = "hello";
  q.markDirty();
  assert.deepEqual(await q.flush(), { ok: true });
  assert.deepEqual(sent, ["hello"]);
  assert.equal(q.isDirty(), false);
});
