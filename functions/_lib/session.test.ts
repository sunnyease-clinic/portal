import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

describe("portal session", () => {
  it("signs and verifies patient sessions", async () => {
    const token = await signSession({ scope: "patient", cloudId: "a".repeat(64) }, "test-secret-at-least-32-characters", 60);
    const session = await verifySession(token, "test-secret-at-least-32-characters");
    expect(session?.scope).toBe("patient");
    if (session?.scope === "patient") expect(session.cloudId).toBe("a".repeat(64));
  });

  it("rejects a modified token", async () => {
    const token = await signSession({ scope: "share", shareId: "12345678-1234-1234-1234-123456789abc" }, "test-secret-at-least-32-characters", 60);
    const [header, body, signature] = token.split(".");
    const changed = signature[0] === "a" ? "b" : "a";
    expect(await verifySession(`${header}.${body}.${changed}${signature.slice(1)}`, "test-secret-at-least-32-characters")).toBeNull();
  });
});
