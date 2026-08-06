import { describe, expect, it, vi } from "vitest";
const {
  classifyCommand,
  collectLefthookRunStrings,
  collectReachableSubcommands,
  collectWorkflowRunStrings,
  reportLaneFindings,
} = require("../../../scripts/quality/checks/subcommand-lanes.js");
const {
  scanShellCommands,
} = require("../../../scripts/quality/checks/shell-command-scan.js");

/**
 * The reconciler's whole value is that it does not fail open. Everything below
 * separates "a lane runs it" from "some text says its name". The second half
 * of the list came out of an adversarial review that turned the first version
 * green six different ways without wiring a single lane.
 */

const PACKAGE_SCRIPTS = {
  "content:check": "node scripts/starter-checks.js translations",
  "type-check": "next typegen && tsc --noEmit",
  run: "node scripts/starter-checks.js brand",
};

function classify(shell: string) {
  return scanShellCommands(shell).commands.map((tokens: string[]) =>
    classifyCommand(tokens, PACKAGE_SCRIPTS),
  );
}

/** Subcommands a snippet actually reaches — the thing the gate counts. */
function subcommands(shell: string) {
  return classify(shell)
    .map((result: { subcommand?: string }) => result.subcommand)
    .filter(Boolean);
}

/** Everything the scanner or classifier refused to decide. */
function undecidable(shell: string) {
  const scan = scanShellCommands(shell);
  return [
    ...scan.undecidable,
    ...scan.commands
      .map((tokens: string[]) => classifyCommand(tokens, PACKAGE_SCRIPTS))
      .map((result: { undecidable?: string }) => result.undecidable)
      .filter(Boolean),
  ];
}

const CALL = "node scripts/starter-checks.js brand";

describe("subcommand lane reconciler", () => {
  it("counts a real invocation", () => {
    expect(classify("node scripts/starter-checks.js brand")).toEqual([
      { subcommand: "brand" },
    ]);
  });

  it("counts the ./-prefixed spelling used in the deploy workflow", () => {
    expect(
      classify(
        'node ./scripts/starter-checks.js deployed-smoke --base-url "$X"',
      ),
    ).toEqual([{ subcommand: "deployed-smoke" }]);
  });

  it("steps over leading env assignments", () => {
    expect(
      classify("APP_ENV=preview node scripts/starter-checks.js brand"),
    ).toEqual([{ subcommand: "brand" }]);
  });

  // `node --check x.js sub` 只解析文件不执行，`-e` / `-p` 根本不读它。没有一份
  // flag 名单能一直判对，所以带 flag 一律报出来撞红。
  //
  // 断言必须落在"报了什么"上。上一版断言 `[{}]`——那条测试删掉整个 guard 也
  // 照样绿，因为 `--check` 本来就不是已注册的脚本名，两条路都返回空。
  it("refuses to classify a node command carrying flags", () => {
    expect(undecidable("node --check scripts/starter-checks.js brand")).toEqual(
      [
        'node flags before the script path: "--check scripts/starter-checks.js brand"',
      ],
    );
    expect(
      undecidable("node --trace-warnings scripts/starter-checks.js brand"),
    ).toHaveLength(1);
    expect(subcommands("node --check scripts/starter-checks.js brand")).toEqual(
      [],
    );
  });

  // flag 在脚本路径之后是子命令自己的参数，跟 node 无关。
  it("still classifies flags that belong to the subcommand", () => {
    expect(
      undecidable(
        'node ./scripts/starter-checks.js deployed-smoke --base-url "$X"',
      ),
    ).toEqual([]);
  });

  it("does not count a shell comment that spells the whole command", () => {
    expect(classify("# node scripts/starter-checks.js brand")).toEqual([]);
  });

  // 注释里再塞一个 `;`。只写 `echo ok # node ...` 证明不了注释真被剥掉：
  // 首 token 是 echo，整行本来就不计数，把剥注释整个删掉这条也照样绿。
  it("does not count a command hidden behind a trailing comment", () => {
    expect(
      classify("echo ok # harmless; node scripts/starter-checks.js brand"),
    ).toEqual([{}]);
  });

  // 引号里的 `;` `&&` 是字符串内容。按原字符切开的话，一条 echo 就能凭空造出
  // 任意多条车道，步骤退出 0，门变绿。
  it("does not split on separators inside quotes", () => {
    expect(
      classify('echo "harmless; node scripts/starter-checks.js brand"'),
    ).toEqual([{}]);
    expect(
      classify('echo "x && node scripts/starter-checks.js brand"'),
    ).toEqual([{}]);
  });

  // 引号里的 `#` 也是内容：真正的子命令名是 `brand # fake`，它不在注册表里，
  // 会落进 unknown 桶把门撞红——而不是被当成 `brand` 算作已覆盖。
  it("keeps a quoted hash inside the subcommand name", () => {
    expect(
      classify('node scripts/starter-checks.js "brand # fake" || true'),
    ).toEqual([{ subcommand: "brand # fake" }, {}]);
  });

  // 一行开两个 heredoc。只记住第一个 delimiter 的话，第二段正文会被当命令读。
  it("does not count the body of a second heredoc opened on the same line", () => {
    expect(
      classify(
        [
          "cat <<A <<B",
          "payload",
          "A",
          "node scripts/starter-checks.js brand",
          "B",
        ].join("\n"),
      ),
    ).toEqual([{}]);
  });

  // 注释里的 `\` 是注释内容，不续行。拼上去等于把下一行的真调用一起吃掉。
  it("does not let a comment's backslash swallow the next line", () => {
    expect(
      classify("# comment \\\nnode scripts/starter-checks.js brand"),
    ).toEqual([{ subcommand: "brand" }]);
  });

  it("does not count an existence test on the script path", () => {
    expect(classify("if [ ! -f ./scripts/starter-checks.js ]")).toEqual([{}]);
  });

  it("does not count the path appearing inside an echo", () => {
    expect(
      classify("echo Missing ./scripts/starter-checks.js in workflow checkout"),
    ).toEqual([{}]);
  });

  // 这条是审查里最便宜的一种作假：把真调用改成打印同一行字，步骤照样退出 0。
  it("does not count a quoted command printed by echo", () => {
    expect(
      classify('echo "node scripts/starter-checks.js markdown-fences"'),
    ).toEqual([{}]);
  });

  it("does not count a heredoc body", () => {
    expect(
      classify(
        ["cat <<'EOF'", "node scripts/starter-checks.js brand", "EOF"].join(
          "\n",
        ),
      ),
    ).toEqual([{}]);
  });

  it("does not count a branch the operator makes unreachable", () => {
    expect(classify("true || node scripts/starter-checks.js brand")).toEqual([
      {},
    ]);
    expect(classify("false && node scripts/starter-checks.js brand")).toEqual([
      {},
    ]);
  });

  it("joins a continuation line instead of reading the backslash as a subcommand", () => {
    expect(classify("node scripts/starter-checks.js \\\n  brand")).toEqual([
      { subcommand: "brand" },
    ]);
  });

  it("reports no subcommand when only flags follow the path", () => {
    expect(classify("node scripts/starter-checks.js --help")).toEqual([{}]);
  });

  it("follows a package script by name so lanes can be indirect", () => {
    expect(classify("pnpm content:check")).toEqual([
      { packageScript: "content:check" },
    ]);
    expect(classify("pnpm run content:check")).toEqual([
      { packageScript: "content:check" },
    ]);
  });

  it("reads the script name after `run` literally, even when it is `run`", () => {
    expect(classify("pnpm run run")).toEqual([{ packageScript: "run" }]);
  });

  // `pnpm --store-dir content:check --version` 里 content:check 是 flag 的值，
  // 什么都没跑。带值 flag 的名单在 pnpm / npm / yarn 之间不可能同时正确
  // （`-w` 在 pnpm 是布尔、在 npm 带值），判不准就报出来撞红。
  //
  // 同样：断言落在"报了什么"上。断言 `[{}]` 的话，删掉 guard 也不会红——
  // `--store-dir` 本来就不是脚本名。
  it("refuses to classify a runner command carrying flags", () => {
    expect(undecidable("pnpm --store-dir content:check --version")).toEqual([
      'runner flags: "--store-dir content:check --version"',
    ]);
    expect(undecidable("npm --prefix content:check --version")).toHaveLength(1);
    expect(undecidable("pnpm -w content:check")).toHaveLength(1);
    expect(undecidable("pnpm --filter web content:check")).toHaveLength(1);
    expect(undecidable("pnpm run --if-present content:check")).toHaveLength(1);
    expect(classify("pnpm --store-dir content:check --version")).toEqual([
      { undecidable: expect.any(String) },
    ]);
  });

  // `pnpm exec x` 跑的是名叫 x 的可执行文件，不是 package script x。
  it("does not treat an exec'd binary as a package script of the same name", () => {
    expect(classify("pnpm exec content:check")).toEqual([{}]);
    expect(classify("npx content:check")).toEqual([{}]);
  });

  it("still follows a real node call made through exec", () => {
    expect(classify("pnpm exec node scripts/starter-checks.js brand")).toEqual([
      { subcommand: "brand" },
    ]);
  });

  it("ignores runner calls that are not package scripts", () => {
    expect(classify("pnpm exec vitest run tests/unit")).toEqual([{}]);
  });

  // 以下六条是第三轮对抗审查逐条打穿的：每一条都是"纯文本被铸成车道"，
  // 而且都不是靠再补一个特殊字符修的——扫描器改成按 shell 自己的规则读。

  // 引号状态必须跨物理行。上一版每行独立扫描，多行字符串的第二行被当命令。
  it("keeps a quote open across physical lines", () => {
    expect(subcommands(`printf '%s\\n' "harmless\n${CALL}"`)).toEqual([]);
    expect(subcommands(`printf '%s\\n' 'harmless\n${CALL}'`)).toEqual([]);
  });

  // 双引号里的 `\"` 是转义的引号，不闭合字符串。
  it("does not let an escaped quote close a string", () => {
    expect(subcommands(`printf '%s\\n' "harmless \\"; ${CALL}"`)).toEqual([]);
  });

  // bash 要求结束符顶格精确匹配；`<<-` 只剥 tab。用 trim() 的话，缩进一个
  // 空格的假结束行就能提前关掉 heredoc，把正文交给分词器。
  it("closes a heredoc only on an exact terminator", () => {
    expect(subcommands(`cat <<EOF\n  EOF\n${CALL}\nEOF`)).toEqual([]);
    expect(subcommands(`cat <<-EOF\n  EOF\n${CALL}\n\tEOF`)).toEqual([]);
  });

  // 数字、转义、部分引用的 delimiter 都是合法 heredoc。
  it("recognises numeric, escaped and partially quoted delimiters", () => {
    expect(subcommands(`cat <<123\n${CALL}\n123`)).toEqual([]);
    expect(subcommands(`cat <<\\EOF\n${CALL}\nEOF`)).toEqual([]);
    // 反向：部分引用的 delimiter 认不出来的话，真调用会被当成 heredoc 正文吃掉。
    expect(subcommands(`cat <<E"OF"\nbody\nEOF\n${CALL}`)).toEqual(["brand"]);
  });

  // heredoc 必须在扫描时识别，不能对整行跑正则——否则字符串里的 "<<EOF"
  // 会开一个幽灵 heredoc，把后面的真调用整段吞掉。
  it("does not open a heredoc from text inside quotes", () => {
    expect(subcommands(`printf '%s\\n' "<<EOF"\n${CALL}`)).toEqual(["brand"]);
  });

  // `true` 接受参数并返回成功，右边照样不执行。上一版只认裸单 token。
  it("reads the short-circuit guard from the executor, not the whole command", () => {
    expect(subcommands(`true ignored || ${CALL}`)).toEqual([]);
    expect(subcommands(`false ignored && ${CALL}`)).toEqual([]);
  });

  // `printf x >&node ...` 里 node 是重定向目标（一个文件名），不是执行器。
  it("consumes a redirection target instead of reading it as an executor", () => {
    expect(
      subcommands("printf x >&node scripts/starter-checks.js brand"),
    ).toEqual([]);
    expect(
      subcommands("printf x >|node scripts/starter-checks.js brand"),
    ).toEqual([]);
    expect(subcommands("printf x 2> /tmp/log")).toEqual([]);
    // 重定向之后的真调用不受影响。
    expect(subcommands(`echo x > /tmp/f\n${CALL}`)).toEqual(["brand"]);
  });

  // 命令替换是个值。仓库里有十几处普通用法（`$(git rev-parse HEAD^)`），
  // 全部当判不准会让门当场不可用；只有点名这个脚本的才报。
  it("reports only a command substitution that names the checker", () => {
    expect(undecidable("REV=$(git rev-parse HEAD^)")).toEqual([]);
    expect(undecidable(`echo $(${CALL})`)).toHaveLength(1);
    expect(
      undecidable("echo `node scripts/starter-checks.js brand`"),
    ).toHaveLength(1);
  });

  // 执行器来自变量：确实会跑，但跑的是什么运行时才知道。
  it("reports an executor that comes from a variable", () => {
    expect(undecidable("$CMD scripts/starter-checks.js brand")).toEqual([
      'executor comes from a variable: "$CMD scripts/starter-checks.js brand"',
    ]);
  });

  // 分组里的命令确实会跑，上一版整段漏掉。
  it("reads commands inside a subshell or brace group", () => {
    expect(subcommands(`( ${CALL} )`)).toEqual(["brand"]);
    expect(subcommands(`{ ${CALL}; }`)).toEqual(["brand"]);
  });

  it("splits chained commands so a later one is not swallowed", () => {
    expect(
      classify(
        "pnpm type-check && node scripts/starter-checks.js eslint-disable",
      ),
    ).toEqual([
      { packageScript: "type-check" },
      { subcommand: "eslint-disable" },
    ]);
  });
});

describe("lane collection reads command positions, not any key named run", () => {
  it("reads workflow step commands", () => {
    expect(
      collectWorkflowRunStrings({
        jobs: { quality: { steps: [{ run: "node x.js brand" }] } },
      }),
    ).toEqual(["node x.js brand"]);
  });

  // 顶层 env 里放一个叫 run 的变量什么都不会执行，早先的版本把它当命令。
  it("ignores a `run` key that is not a step command", () => {
    expect(
      collectWorkflowRunStrings({
        env: { run: "node x.js brand" },
        jobs: {
          quality: {
            env: { run: "node x.js brand" },
            steps: [
              { uses: "actions/checkout@v4", with: { run: "node x.js" } },
            ],
          },
        },
      }),
    ).toEqual([]);
  });

  it("ignores a step whose condition can never be true", () => {
    expect(
      collectWorkflowRunStrings({
        jobs: {
          quality: {
            steps: [
              { if: "${{ false }}", run: "node x.js brand" },
              { if: false, run: "node x.js translations" },
            ],
          },
        },
      }),
    ).toEqual([]);
  });

  it("keeps a step whose condition is a real expression", () => {
    expect(
      collectWorkflowRunStrings({
        jobs: {
          quality: {
            steps: [
              {
                if: "${{ inputs.environment == 'production' }}",
                run: "node x",
              },
            ],
          },
        },
      }),
    ).toEqual(["node x"]);
  });

  it("reads lefthook hook commands", () => {
    expect(
      collectLefthookRunStrings({
        "pre-push": {
          parallel: true,
          commands: { lint: { run: "pnpm lint" } },
        },
      }),
    ).toEqual(["pnpm lint"]);
  });
});

describe("the verdict fails closed", () => {
  const quiet = () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    return spy;
  };

  it("passes only when all three buckets are empty", () => {
    const spy = quiet();
    expect(
      reportLaneFindings({ undecidable: [], orphans: [], unknown: [] }),
    ).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  // 这条是整份改动的核心：读不懂的命令不是"干净"，是"没有结论"。
  // 去掉它一次，门就在本该撞红的仓库上放行了。
  it("refuses to pass on an unreadable command alone", () => {
    const spy = quiet();
    expect(
      reportLaneFindings({
        undecidable: ["lefthook.yml: executor comes from a variable"],
        orphans: [],
        unknown: [],
      }),
    ).toBe(false);
    expect(spy.mock.calls[0]?.[0]).toContain("cannot tell what this runs");
    spy.mockRestore();
  });

  it("refuses to pass on an orphan or an unregistered subcommand", () => {
    const spy = quiet();
    expect(
      reportLaneFindings({ undecidable: [], orphans: ["brand"], unknown: [] }),
    ).toBe(false);
    expect(
      reportLaneFindings({ undecidable: [], orphans: [], unknown: ["typo"] }),
    ).toBe(false);
    spy.mockRestore();
  });
});

// pnpm 只在 enable-pre-post-scripts 打开时才跑 pre/post 包裹脚本，pnpm 11 默认
// 关闭，本仓库 .npmrc 也没开。把它们算成车道等于凭空发明覆盖：只写在
// precheck 里的子命令会被判成"有人跑"，而实际上没人跑。
describe("package script traversal", () => {
  const reached = (roots: string[], scripts: Record<string, string>) => [
    ...collectReachableSubcommands(
      roots.map((tokens) => ({ tokens: tokens.split(" "), source: "test" })),
      scripts,
    ).reached,
  ];

  it("follows the script a lane names", () => {
    expect(reached(["pnpm run check"], { check: `${CALL}` })).toEqual([
      "brand",
    ]);
  });

  it("does not treat a pre/post wrapper as a lane pnpm would run", () => {
    expect(
      reached(["pnpm run check"], {
        precheck: `${CALL}`,
        check: "echo real",
        postcheck: "node scripts/starter-checks.js markdown-fences",
      }),
    ).toEqual([]);
  });
});
