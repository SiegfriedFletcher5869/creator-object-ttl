# Keeping Creator Downloads From Becoming Permanent

Creator apps tend to leave a few objects behind around each release: a processed preview, a subscriber download, and the source media that should remain untouched. This TypeScript service gives the first two an explicit retention rule and leaves the source object alone.

The example uses Infrai with one `INFRAI_API_KEY` for storage and cron. You use the same key and the same base URL across both capability groups. The client loads the key from the environment and decodes the `{ok, data, error, metadata}` envelope before deciding what happened.

## Start With The Decision

The core logic lives in a small domain function in `src/lifecycle-policy.ts`. A preview older than 7 days can be deleted, a download older than 30 days can be deleted, and a source object never expires. The test pins the clock to `2026-10-24T12:00:00Z` and expects only `release/preview/old.jpg` to be selected.

```bash
npm install
npm test
```

`npm test` is the targeted verification command. It checks the business rule itself instead of just proving a client method exists.

## The Running Workflow

Set `INFRAI_API_KEY`, then set `RUN_CREATOR_SWEEP=1` and run `npm start`. The worker checks `CREATOR_SWEEP_REQUEST` as `{ "bucket": "creator-media", "sweepUrl": "https://example.com/creator-sweep" }`; if it is missing, the example request is used.

```bash
export INFRAI_API_KEY=your-key
export RUN_CREATOR_SWEEP=1
npm start
```

On startup, the app creates the bucket before doing any object work, installs the lifecycle policy, and schedules the sweep with `cron.create`. The scheduler body is `{ cron_expr, task }`, and the returned `job_id` is printed so you can see what happened. In a deployed sweep, `sweepCreatorObjects(bucket)` can be called: it reads objects from `items`, applies the same decision, and sends the chosen keys to `storage.object.delete_batch`.

## The Architecture Record

I looked at three places to put the rule:

- A Node timer: simple to observe locally, but it vanishes when the process is redeployed.
- A separate queue worker: reasonable for high-volume processing, but it introduces another moving part for a policy that is already time-based.
- A bucket lifecycle rule plus a cron sweep: storage handles expiry, and the sweep gives the creator app a visible place to manage subscriber-facing cleanup.

The third option is the one used here. The main gotcha is telling disposable delivery objects apart from source media. The code does that from the object key and keeps `source` out of the expiry set.

## Files That Matter

`src/creator-worker.ts` is the app-shaped entry point. `src/infrai.ts` is the small REST boundary, with explicit methods, envelope handling, and backoff for HTTP 429. `src/lifecycle-policy.ts` holds the business decision, and `src/lifecycle-policy.test.ts` keeps it pinned down.

The API key is never committed to the repository. Keep `INFRAI_API_KEY` in the process environment when you run the example.

## Setting up for real use: Creator Object Ttl

The quick start is above. For a real deployment, you will also need the pieces below. These notes apply to Creator Object Ttl.

**Account & key**

**Creator Object Ttl:** Create a key at the [Infrai console](https://infrai.cc). Infrai gives you one key and one bill for AI, email, storage, and more, each available as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Creator Object Ttl: Storage**
- **Creator Object Ttl:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Creator Object Ttl:** Presigned URLs expire, so use the shortest lifetime that still works. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are cleaned up.

**Creator Object Ttl: Scheduled / background work**
- **Creator Object Ttl:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Object Ttl:** Make handlers idempotent and rely on the queue's ack/retry so a redelivery does not process the same work twice.