#!/usr/bin/env node
/**
 * Refuse to start a Lighthouse run on a port something else already holds.
 *
 * `next start` cannot fall back to another port in production, and lhci only
 * warns when its own server fails to come up — then measures whatever else
 * answers. The result is a full report about a foreign server, labelled as this
 * site. `lighthouserc.js` explains why the port cannot be made collision-proof
 * by binding tricks; this is the preflight it points at.
 *
 * Two things it deliberately does NOT do:
 *
 * - It does not shell out to `lsof`. The first version did, as
 *   `if lsof -ti:PORT >/dev/null 2>&1; then ... fi`, which reads every non-zero
 *   exit as "port is free": no `lsof` on PATH (127), a bad flag, a permission
 *   error — all of them silently continued into the measurement, and `2>&1`
 *   swallowed the reason. Binding the port ourselves needs no external tool and
 *   has no exit code to misread.
 * - It does not know its own port number. The port lives in `lighthouserc.js`
 *   and is read back out of the URLs lhci is actually told to measure, so the
 *   check cannot drift away from the thing it is checking.
 *
 * Anything it cannot decide is an error, not a pass.
 */

const net = require("node:net");

// `localhost` resolves to both, and a listener on either one can answer some
// clients while leaving the other free — so a single probe is not an answer.
const IPV6_LOOPBACK = "::1";
const LOOPBACK_HOSTS = ["127.0.0.1", IPV6_LOOPBACK];

// Only ever accepted for the IPv6 loopback, and only there: on a machine with
// IPv6 switched off, `::1` is not a local address at all, and nothing can be
// listening on a stack that does not exist. For any other host the same codes
// mean "that address is not mine to bind" — which is a failed check, not an
// empty port. Treating them as "free" everywhere is exactly the shape of the
// `lsof` bug this file replaced.
const ABSENT_STACK_CODES = new Set(["EADDRNOTAVAIL", "EAFNOSUPPORT"]);

/** The port lhci is configured to measure. Throws if the config cannot say. */
function measuredPort(config = require("../lighthouserc.js")) {
  const urls = config?.ci?.collect?.url;

  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error("lighthouserc.js lists no URLs to measure");
  }

  const ports = new Set(urls.map((url) => new URL(url).port));

  if (ports.size !== 1) {
    throw new Error(
      `lighthouserc.js measures more than one port (${[...ports].join(", ")}), so there is no single port to check`,
    );
  }

  const [port] = ports;
  const parsed = Number(port);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`lighthouserc.js measures a URL with no usable port`);
  }

  return parsed;
}

/**
 * True when `host:port` is already taken, false when it is free.
 *
 * Rejects on anything else. "I could not find out" must not collapse into
 * "nobody is there" — that collapse is the whole reason this file exists.
 */
function isPortTaken(host, port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(true);
        return;
      }
      reject(error);
    });

    server.listen({ host, port, exclusive: true }, () => {
      server.close(() => resolve(false));
    });
  });
}

/**
 * The first loopback address already holding the port, or null if all free.
 *
 * `hosts` is a parameter only so the tests can prove the two things that are
 * otherwise unreachable: that a probe failure on a non-`::1` address is
 * rethrown rather than read as free, and that the IPv6 loopback is probed at
 * all. Production always passes the default.
 */
async function findPortHolder(port, hosts = LOOPBACK_HOSTS) {
  for (const host of hosts) {
    try {
      if (await isPortTaken(host, port)) return host;
    } catch (error) {
      if (host === IPV6_LOOPBACK && ABSENT_STACK_CODES.has(error.code)) {
        continue;
      }
      throw error;
    }
  }

  return null;
}

async function main() {
  const port = measuredPort();
  const holder = await findPortHolder(port);

  if (holder) {
    console.error(
      `✗ 端口 ${port} 已被占用（${holder}）。Lighthouse 会静默测量占用者的服务器并把结果当成本站的，先关掉再跑。`,
    );
    process.exit(1);
  }

  console.log(`lighthouse 预检通过：端口 ${port} 空闲`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      `✗ 无法确认端口是否空闲：${error.message}。查不出来不等于没人占，先修好这个检查再跑测量。`,
    );
    process.exit(1);
  });
}

module.exports = { measuredPort, isPortTaken, findPortHolder };
