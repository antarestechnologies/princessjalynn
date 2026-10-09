import { randomBytes } from "node:crypto";
import sharp from "sharp";
import type { AppDb } from "@/db/types";
import { addDocument, createPerformer, linkMedia, markVerified } from "./vault";
import type { VaultKeyring } from "./vault-crypto";

/** Test-only helpers. Not imported by application code. */
export function testKeyring(): VaultKeyring {
  return { current: "t1", keys: { t1: randomBytes(32) } };
}

export async function fakeIdImage(): Promise<Buffer> {
  return sharp({ create: { width: 60, height: 40, channels: 3, background: "#777" } })
    .jpeg()
    .toBuffer();
}

export async function makeVerifiedPerformer(
  db: AppDb,
  kr: VaultKeyring,
  adminId: string,
  overrides: { dateOfBirth?: string; stageName?: string } = {},
) {
  const id = await createPerformer(
    db,
    kr,
    { userId: adminId },
    {
      stageName: overrides.stageName ?? "Jalynn",
      pii: {
        legalName: "Test Performer Legal Name",
        aliases: ["TP"],
        dateOfBirth: overrides.dateOfBirth ?? "1995-04-12",
        idType: "drivers_license",
        idNumber: "D1234567",
        idIssuer: "State of Testing",
      },
    },
  );
  const doc = await addDocument(
    db,
    kr,
    { userId: adminId },
    { performerId: id, kind: "id_front", data: await fakeIdImage() },
  );
  if (!doc.ok) throw new Error("doc upload failed: " + doc.error);
  const v = await markVerified(db, kr, { userId: adminId }, id);
  if (!v.ok) throw new Error("verify failed: " + v.error);
  return id;
}

export async function link(
  db: AppDb,
  kr: VaultKeyring,
  adminId: string,
  mediaId: string,
  performerId: string,
  productionDate = "2026-01-15",
) {
  const r = await linkMedia(db, kr, { userId: adminId }, { mediaId, performerId, productionDate });
  if (!r.ok) throw new Error("link failed: " + r.error);
}
