import { describe, expect, it } from "vitest";

import {
  closeTextTab,
  detectProjectFileType,
  findFirstTextPath,
  isPreviewableFileType,
  isTextFileType,
} from "./workspace";

describe("workspace helpers", () => {
  it("classifies paper project file types", () => {
    expect(detectProjectFileType("sections/introduction.tex")).toBe("latex");
    expect(detectProjectFileType("refs/references.bib")).toBe("bib");
    expect(detectProjectFileType("assets/figure.svg")).toBe("image");
    expect(detectProjectFileType("build/main.pdf")).toBe("pdf");
    expect(detectProjectFileType("data/table.csv")).toBe("csv");
  });

  it("marks text and previewable file types correctly", () => {
    expect(isTextFileType("latex")).toBe(true);
    expect(isTextFileType("image")).toBe(false);
    expect(isPreviewableFileType("pdf")).toBe(true);
    expect(isPreviewableFileType("json")).toBe(false);
  });

  it("finds the first text file in tree order", () => {
    expect(
      findFirstTextPath([
        {
          id: "assets",
          name: "assets",
          kind: "directory",
          path: "assets",
          children: [
            {
              id: "assets/figure.svg",
              name: "figure.svg",
              kind: "asset",
              path: "assets/figure.svg",
              fileType: "image",
              isPreviewable: true,
              isText: false,
            },
          ],
        },
        {
          id: "main.tex",
          name: "main.tex",
          kind: "file",
          path: "main.tex",
          fileType: "latex",
          isText: true,
          isPreviewable: false,
        },
      ]),
    ).toBe("main.tex");
  });

  it("keeps tab state stable when closing the active tab", () => {
    expect(closeTextTab(["a.tex", "b.tex", "c.tex"], "b.tex", "b.tex")).toEqual({
      openTabs: ["a.tex", "c.tex"],
      activePath: "c.tex",
    });
    expect(closeTextTab(["a.tex"], "a.tex", "a.tex")).toEqual({
      openTabs: [],
      activePath: "",
    });
  });
});
