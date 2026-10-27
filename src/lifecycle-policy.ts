export type CreatorObject = { key: string; createdAt: Date; kind: "preview" | "download" | "source" };

export type RetentionPolicy = { previewDays: number; downloadDays: number };

export function objectsToExpire(objects: CreatorObject[], now: Date, policy: RetentionPolicy): string[] {
  return objects.filter((object) => {
    const ageDays = (now.getTime() - object.createdAt.getTime()) / 86_400_000;
    const limit = object.kind === "preview" ? policy.previewDays : object.kind === "download" ? policy.downloadDays : Infinity;
    return ageDays >= limit;
  }).map((object) => object.key);
}
