import { describe, expect, it } from "vitest";

import { formatDuration } from "./format";

describe("formatDuration", () => {
  it("uses Chinese units when Chinese is selected", () => {
    expect(formatDuration(45, "zh-CN")).toBe("45分钟");
    expect(formatDuration(120, "zh-CN")).toBe("2小时");
    expect(formatDuration(150, "zh-CN")).toBe("2小时 30分钟");
  });
  it("drops zero parts", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(150)).toBe("2h 30m");
  });
});
