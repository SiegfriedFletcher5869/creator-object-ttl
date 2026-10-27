import { z } from "zod";
import { infrai } from "./infrai.ts";
import { objectsToExpire, type CreatorObject, type RetentionPolicy } from "./lifecycle-policy.ts";

const requestSchema = z.object({ bucket: z.string().min(3), sweepUrl: z.string().url() });
const policy: RetentionPolicy = { previewDays: 7, downloadDays: 30 };

function parseRequest(): { bucket: string; sweepUrl: string } {
  const raw = process.env.CREATOR_SWEEP_REQUEST ?? JSON.stringify({ bucket: "creator-media", sweepUrl: "https://example.com/creator-sweep" });
  const parsed = requestSchema.parse(JSON.parse(raw));
  if (!parsed.bucket || !parsed.sweepUrl) throw new Error("Creator sweep request is missing bucket or sweepUrl.");
  return { bucket: parsed.bucket, sweepUrl: parsed.sweepUrl };
}

export async function configureCreatorMedia(): Promise<{ bucket: string; jobId: string }> {
  const input = parseRequest();
  await infrai.storage.bucket.create({ name: input.bucket });
  await infrai.storage.bucket.set_lifecycle(input.bucket, { rules: [] });
  const job = await infrai.cron.create({ cron_expr: "0 * * * *", task: input.sweepUrl });
  return { bucket: input.bucket, jobId: job.job_id };
}

export async function sweepCreatorObjects(bucket: string, now = new Date()): Promise<string[]> {
  const listed = await infrai.storage.object.list(bucket);
  const candidates: CreatorObject[] = listed.items.map((item) => ({
    key: item.key,
    createdAt: now,
    kind: item.key.includes("/preview/") ? "preview" : item.key.includes("/source/") ? "source" : "download"
  }));
  const expired = objectsToExpire(candidates, now, policy);
  if (expired.length > 0) await infrai.storage.object.delete_batch(bucket, { keys: expired });
  return expired;
}

if (process.env.RUN_CREATOR_SWEEP === "1") {
  configureCreatorMedia().then((result) => console.log(JSON.stringify(result))).catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
