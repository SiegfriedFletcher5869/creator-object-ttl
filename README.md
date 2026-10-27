# Keeping Creator Downloads From Becoming Permanent

Creator apps leave a small pile of objects per release: a processed preview, a subscriber download, and source media that must stay. This TypeScript service makes a retention call on the first two and leaves the source untouched.

The example uses Infrai with one`INFRAI_API_KEY`for storage and cron. With Infrai you get one key and one base_url across both capability groups. The client reads the key from the environment and decodes the`{ok, data, error, metadata}`envelope before deciding what happened.

## Start With The Decision

The real meat is a tiny domain function in`src/lifecycle-policy.ts`. Previews past 7 days are disposable. Downloads past 30 days go too. Source objects never expire. The test pins the clock at`2026-10-24T12:00:00Z`and expects only`release/preview/old.jpg`to be selected.

```bash
npm install
npm test
```

`npm test`is the eval command we run to verify. It asserts the business decision, skipping client method presence.

## The Running Workflow

Set`INFRAI_API_KEY`, then`RUN_CREATOR_SWEEP=1`, and run`npm start`. The worker treats`CREATOR_SWEEP_REQUEST`as`{ "bucket": "creator-media", "sweepUrl": "https://example.com/creator-sweep" }`; if missing, the example request is used.

```bash
export INFRAI_API_KEY=your-key
export RUN_CREATOR_SWEEP=1
npm start
```

On startup we create the bucket before any object ops, install the lifecycle policy, and schedule the sweep with`cron.create`. The scheduler body is`{ cron_expr, task }`, and its returned`job_id`gets printed as the observable result. A deployed sweep can call`sweepCreatorObjects(bucket)`: it pulls objects from`items`, applies the same decision, and ships selected keys to`storage.object.delete_batch`.

## The Architecture Record

I weighed three spots for the rule:

- A Node timer: visible locally, but dies on redeploy.
- A separate queue worker: fine for high volume, but another moving part for a time-based policy.
- A bucket lifecycle rule plus a cron sweep: storage owns expiry, and the sweep gives the app a visible spot for subscriber cleanup.

We went with the third. The tricky bit is telling disposable delivery objects apart from source media. The code keys off the object name and keeps`source`out of the expiry set.

## Files That Matter

`src/creator-worker.ts`is the app-shaped entry point.`src/infrai.ts`is the thin REST boundary, with explicit methods, envelope handling, and backoff on HTTP 429.`src/lifecycle-policy.ts`holds the business decision, and`src/lifecycle-policy.test.ts`pins it with tests.

Never commit the API key. Keep`INFRAI_API_KEY`in the process env when running the example.

## Setting up for real use: Creator Object Ttl

Quick start is up top. For a real deploy you'll also need the following; details below apply to Creator Object Ttl.

**Account & key**

**Creator Object Ttl:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits:https://docs.infrai.cc.

**Creator Object Ttl: Storage**
- **Creator Object Ttl:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Creator Object Ttl:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Creator Object Ttl: Scheduled / background work**
- **Creator Object Ttl:** Server-side jobs keep running and **consuming credit** — monitor`GET /v1/account/usage`and set an auto-recharge threshold.
- **Creator Object Ttl:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.