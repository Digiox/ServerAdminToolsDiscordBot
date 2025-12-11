import { describe, it, expect } from "vitest";
import { normalizeBody, extractToken } from "../src/utils/http";
import { EventBatchBody } from "../src/types/events";

function mockReq(auth?: string) {
  return { headers: auth ? { authorization: auth } : {} } as any;
}

describe("normalizeBody", () => {
  it("parses JSON string", () => {
    const body = '{"events":[]}';
    const res = normalizeBody(body);
    expect(res).toEqual({ events: [] });
  });

  it("returns object as-is", () => {
    const obj = { events: [] } as EventBatchBody;
    const res = normalizeBody(obj);
    expect(res).toBe(obj);
  });

  it("returns null on invalid", () => {
    const res = normalizeBody("not json");
    expect(res).toBeNull();
  });
});

describe("extractToken", () => {
  it("extracts bearer token", () => {
    const req = mockReq("Bearer abc");
    const token = extractToken(req, {} as EventBatchBody);
    expect(token).toBe("abc");
  });

  it("falls back to body token", () => {
    const req = mockReq();
    const token = extractToken(req, { token: "xyz" } as EventBatchBody);
    expect(token).toBe("xyz");
  });

  it("returns null when missing", () => {
    const req = mockReq();
    const token = extractToken(req, {} as EventBatchBody);
    expect(token).toBeNull();
  });
});
