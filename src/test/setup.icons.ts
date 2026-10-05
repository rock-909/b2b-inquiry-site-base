import React from "react";
import { vi } from "vitest";

// Mock lucide-react icons - 返回真正的React元素而不是字符串
vi.mock("lucide-react", async () => {
  // 在 factory 内定义 MockIcon，避免 Vitest v4 hoist 导致的未定义错误
  const MockIcon = ({ className, ...props }: any) =>
    React.createElement("svg", {
      className: className || "",
      "data-testid": "mock-icon",
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
    });

  // Keep this list minimal: only icons imported by production code.
  // Update it when a new icon import appears.
  const iconNames = [
    "Check",
    "ChevronDown",
    "Globe",
    "Menu",
    "Monitor",
    "Moon",
    "Sun",
    "X",
    "XIcon",
  ] as const;

  const exports: Record<string, unknown> = {
    __esModule: true,
    default: MockIcon,
  };

  for (const iconName of iconNames) {
    exports[iconName] = MockIcon;
  }

  return exports;
});
