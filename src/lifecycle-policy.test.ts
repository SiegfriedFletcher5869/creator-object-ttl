import test from "node:test";
import assert from "node:assert/strict";
import { objectsToExpire } from "./lifecycle-policy.ts";

test("keeps source media while expiring old previews and downloads", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const objects = [
    { key: "release/preview/old.jpg", createdAt: new Date("2026-10-16T11:00:00Z"), kind: "preview" as const },
    { key: "release/download/new.zip", createdAt: new Date("2026-10-01T12:00:00Z"), kind: "download" as const },
    { key: "release/source/master.mov", createdAt: new Date("2020-01-01T00:00:00Z"), kind: "source" as const }
  ];
  assert.deepEqual(objectsToExpire(objects, now, { previewDays: 7, downloadDays: 30 }), ["release/preview/old.jpg"]);
});
