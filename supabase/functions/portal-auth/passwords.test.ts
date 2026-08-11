import { describe, expect, it } from "vitest";
import { hashPassword, sha256Hex, verifyLegacyPassword, verifyPbkdf2, verifyTempPassword } from "./passwords";

describe("password compatibility", () => {
  it("hashes and verifies PBKDF2 passwords", async () => {
    const stored = await hashPassword("patient-password", 100_000);
    expect(await verifyPbkdf2("patient-password", stored)).toBe(true);
    expect(await verifyPbkdf2("wrong-password", stored)).toBe(false);
  });

  it("verifies existing custom and temporary password formats", async () => {
    const legacy = await sha256Hex("salt123456");
    expect(await verifyLegacyPassword("123456", legacy, "salt")).toBe(true);
    const temporary = await sha256Hex("4321_clinic-secret");
    expect(await verifyTempPassword("4321", temporary, "clinic-secret")).toBe(true);
  });
});
