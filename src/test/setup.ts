/**
 * Vitest 测试环境设置文件
 * 配置全局测试环境、Mock和工具函数（按职责拆分）
 */

import "@testing-library/jest-dom/vitest";

import "./setup.console";

import "./setup.base-mocks";
import "./setup.fetch";
import "./setup.next";
import "./setup.icons";
import "./setup.constants-and-i18n";
import "./setup.env";
import "./setup.browser-apis";
import "./setup.hooks";

export {
  triggerAll,
  triggerVisible,
  setIntersectionAutoVisibleAll,
} from "./setup.intersection-observer";
