import { describe, expect, it } from "vitest";

import { generateShareLink, parseProjectReference, parseShareLink } from "./share";

const PROJECT_ID = "d32d4ce6-2e6d-4a55-a4e4-ae25607cba37";

describe("share links", () => {
  it("generates a join url from the collab server base url", () => {
    expect(generateShareLink(PROJECT_ID, "https://viewerleaf.example.com")).toBe(
      `https://viewerleaf.example.com/join/${PROJECT_ID}?role=viewer`,
    );
  });

  it("parses a full share link", () => {
    expect(parseShareLink(`https://viewerleaf.example.com/join/${PROJECT_ID}?role=commenter`)).toEqual({
      projectId: PROJECT_ID,
      httpBaseUrl: "https://viewerleaf.example.com",
      wsBaseUrl: "wss://viewerleaf.example.com",
      role: "commenter",
    });
  });

  it("accepts either a project id or a full share link", () => {
    expect(parseProjectReference(PROJECT_ID)).toEqual({ projectId: PROJECT_ID });
    expect(parseProjectReference(`https://viewerleaf.example.com/join/${PROJECT_ID}`)).toEqual({
      projectId: PROJECT_ID,
      httpBaseUrl: "https://viewerleaf.example.com",
      wsBaseUrl: "wss://viewerleaf.example.com",
    });
  });

  it("rejects invalid share inputs", () => {
    expect(parseShareLink("https://viewerleaf.example.com/join/not-a-project")).toBeNull();
    expect(parseProjectReference("not-a-project")).toBeNull();
  });
});
