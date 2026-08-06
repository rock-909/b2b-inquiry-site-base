import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("Utils", () => {
  describe("cn function", () => {
    it("should merge class names correctly", () => {
      const result = cn("px-2 py-1", "bg-red-500");
      expect(result).toBe("px-2 py-1 bg-red-500");
    });

    it("should handle conflicting Tailwind classes", () => {
      const result = cn("px-2 px-4", "py-1 py-2");
      expect(result).toBe("px-4 py-2");
    });

    it("should handle conditional classes", () => {
      const isActive = true;
      const result = cn("base-class", isActive && "active-class");
      expect(result).toBe("base-class active-class");
    });

    it("should handle false conditional classes", () => {
      const isActive = false;
      const result = cn("base-class", isActive && "active-class");
      expect(result).toBe("base-class");
    });

    it("should handle arrays of classes", () => {
      const result = cn(["px-2", "py-1"], ["bg-red-500", "text-white"]);
      expect(result).toBe("px-2 py-1 bg-red-500 text-white");
    });

    it("should handle objects with boolean values", () => {
      const result = cn({
        "px-2": true,
        "py-1": true,
        "bg-red-500": false,
        "text-white": true,
      });
      expect(result).toBe("px-2 py-1 text-white");
    });

    it("should handle empty inputs", () => {
      const result = cn();
      expect(result).toBe("");
    });

    it("should handle null and undefined inputs", () => {
      const result = cn("px-2", null, undefined, "py-1");
      expect(result).toBe("px-2 py-1");
    });

    it("should handle complex mixed inputs", () => {
      const result = cn(
        "px-2 py-1",
        { "bg-red-500": true, "text-white": false },
        ["border", "rounded"],
        null,
        undefined,
        "hover:bg-red-600",
      );
      expect(result).toBe(
        "px-2 py-1 bg-red-500 border rounded hover:bg-red-600",
      );
    });

    it("should resolve Tailwind conflicts correctly", () => {
      const result = cn("p-2 p-4", "m-1 m-2", "text-lg text-sm");
      expect(result).toBe("p-4 m-2 text-sm");
    });

    it("should handle responsive classes", () => {
      const result = cn("text-sm md:text-lg lg:text-xl");
      expect(result).toBe("text-sm md:text-lg lg:text-xl");
    });

    it("should handle state variants", () => {
      const result = cn("bg-blue-500 hover:bg-blue-600 focus:bg-blue-700");
      expect(result).toBe("bg-blue-500 hover:bg-blue-600 focus:bg-blue-700");
    });
  });
});
