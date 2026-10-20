import { describe, expect, it } from "vitest";
import { loadClientMessages } from "@/lib/i18n/client-messages";

describe("client message scoping", () => {
  it("loads only site-wide client provider namespaces", async () => {
    const scoped = await loadClientMessages("en");

    // 全站客户端小岛需要的命名空间。
    for (const namespace of [
      "accessibility",
      "cookie",
      "errors",
      "navigation",
      "theme",
    ]) {
      expect(scoped, namespace).toHaveProperty(namespace);
    }
    // 真实存在但只在服务端或单页用到的命名空间不能进入全站客户端 payload。
    for (const namespace of [
      "inquiry",
      "contact",
      "home",
      "footer",
      "emailTemplates",
    ]) {
      expect(scoped, namespace).not.toHaveProperty(namespace);
    }
  });
});
