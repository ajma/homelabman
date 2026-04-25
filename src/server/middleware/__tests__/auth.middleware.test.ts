import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticate } from "../auth.middleware.js";

describe("authenticate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows request when jwtVerify succeeds", async () => {
    const request = {
      jwtVerify: vi.fn().mockResolvedValue({ id: "u1", username: "admin" }),
    } as any;
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() } as any;

    await authenticate(request, reply);

    expect(request.jwtVerify).toHaveBeenCalledWith({ onlyCookie: true });
    expect(reply.code).not.toHaveBeenCalled();
  });

  it("sends 401 when jwtVerify throws", async () => {
    const request = {
      jwtVerify: vi.fn().mockRejectedValue(new Error("invalid token")),
    } as any;
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() } as any;

    await authenticate(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "Unauthorized" });
  });
});
