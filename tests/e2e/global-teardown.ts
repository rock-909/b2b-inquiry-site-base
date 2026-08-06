import type { FullConfig } from "@playwright/test";
import { cleanupTestEnvironment } from "./test-environment-setup";

async function globalTeardown(_config: FullConfig) {
  console.log("🧹 Starting global teardown for Playwright tests...");

  try {
    // Perform any global cleanup tasks here
    // For example: cleanup test data, close connections, etc.

    // 清理测试环境
    cleanupTestEnvironment();

    console.log("✅ Global teardown completed");
  } catch (error) {
    console.error("❌ Global teardown failed:", error);
    throw error;
  }
}

export default globalTeardown;
