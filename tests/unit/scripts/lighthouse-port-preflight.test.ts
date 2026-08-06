import { readFileSync } from "node:fs";
import net from "node:net";
import { describe, expect, it } from "vitest";

const {
  findPortHolder,
  isPortTaken,
  measuredPort,
} = require("../../../scripts/lighthouse-preflight.js");

/**
 * 这道预检存在的理由是"查不出来不等于没人占"。上一版用
 * `if lsof -ti:PORT >/dev/null 2>&1` 判断，把 lsof 没装、参数错、权限不足统统
 * 读成"端口空闲"，然后照常开跑，测量的是别人的服务器。
 *
 * 所以下面三条各自守一件事：端口不许有第二个真相源、占用要认出来、查不出来
 * 必须抛而不是当成空闲。
 */

/** 拿一个当前确实空闲的端口，避免测试之间抢固定端口。 */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      if (typeof address === "string" || address === null) {
        reject(new Error("no port assigned"));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

describe("lighthouse 端口预检", () => {
  // 端口曾经写在两个地方：package.json 里的 lsof 参数，和 lighthouserc.js 里的
  // LIGHTHOUSE_PORT。改一处不改另一处，预检查的就是另一个端口。现在预检自己
  // 从 lhci 实际要测的 URL 里读，命令行里不许再出现端口字面量。
  it("takes the port from the config lhci actually measures", () => {
    expect(
      measuredPort({ ci: { collect: { url: ["http://localhost:4999/"] } } }),
    ).toBe(4999);
  });

  it("refuses to guess when the config does not name one port", () => {
    expect(() => measuredPort({ ci: { collect: { url: [] } } })).toThrow(
      /no URLs/u,
    );
    expect(() =>
      measuredPort({
        ci: {
          collect: { url: ["http://localhost:1/", "http://localhost:2/"] },
        },
      }),
    ).toThrow(/more than one port/u);
  });

  it("leaves no second copy of the port in the command that runs it", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    const command = pkg.scripts["website:lighthouse"];

    expect(command).toContain("scripts/lighthouse-preflight.js");
    expect(command).not.toMatch(/\d{4,5}/u);
  });

  it("reports a held port, and reports it free once released", async () => {
    const port = await freePort();
    const holder = net.createServer();

    await new Promise<void>((resolve) => {
      holder.listen({ host: "127.0.0.1", port }, () => resolve());
    });
    await expect(findPortHolder(port)).resolves.toBe("127.0.0.1");

    await new Promise<void>((resolve) => holder.close(() => resolve()));
    await expect(findPortHolder(port)).resolves.toBeNull();
  });

  // `localhost` 解析到 ::1 和 127.0.0.1 两个地址，占住其中一个的服务能应答一部分
  // 客户端、另一个照样空着。只探 IPv4 会把这种占用报成空闲。
  it("finds a holder sitting on the IPv6 loopback", async () => {
    const port = await freePort();
    const holder = net.createServer();

    await new Promise<void>((resolve, reject) => {
      holder.once("error", reject);
      holder.listen({ host: "::1", port }, () => resolve());
    });

    try {
      await expect(findPortHolder(port)).resolves.toBe("::1");
    } finally {
      await new Promise<void>((resolve) => holder.close(() => resolve()));
    }
  });

  // "这个地址不是本机的"只在 ::1 上才等于"没有协议栈、不可能有人占"。放宽到
  // 任意地址就是把查不出来当成空闲——第一版正是这么写的。
  it("rethrows an unbindable address instead of calling the port free", async () => {
    await expect(findPortHolder(4173, ["203.0.113.9"])).rejects.toThrow();
  });

  // 这条是整个改动的核心：一个查不动的探测必须抛出来，不能返回 false。
  // 返回 false 就等于旧版那句 `if lsof ...` —— 门禁静默放行。
  //
  // 两种"查不动"都覆盖：地址根本不是本机的（EADDRNOTAVAIL），和有地址但没权限
  // 绑（EACCES，1 是特权端口）。第一版把 EADDRNOTAVAIL 无条件当成空闲，正是
  // 同一个洞换了个位置——现在它只在 `::1` 上被接受，因为那才真的可能没有协议栈。
  it("throws instead of answering false when the probe itself cannot run", async () => {
    await expect(isPortTaken("203.0.113.9", 4173)).rejects.toThrow();
    await expect(isPortTaken("127.0.0.1", 1)).rejects.toThrow();
  });
});
