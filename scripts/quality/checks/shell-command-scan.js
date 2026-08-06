/**
 * Splits a shell snippet into commands, or says it cannot.
 *
 * This exists because the lane reconciler kept being talked past. Three rounds
 * of adversarial review each found another character that made plain text read
 * as a command: a `;` inside quotes, a `#` inside quotes, a heredoc body, a
 * quote that spans two lines, `\"`, a redirection target. Patching them one at
 * a time was losing; this file implements the tokenizing rules instead.
 *
 * What it models, following the shell:
 *
 * - Single quotes are literal to the closing quote, newlines included.
 * - Double quotes end at an unescaped `"`; `\` escapes `"`, `\`, `$` and a
 *   newline. Newlines inside quotes are data, not command separators — a quote
 *   opened on one line stays open on the next.
 * - `\` outside quotes escapes the next character; at end of line it joins the
 *   lines.
 * - `#` opens a comment only at a word boundary outside quotes.
 * - Heredocs are detected during the scan, so `"<<EOF"` inside a string is not
 *   one. The delimiter may be quoted, escaped or numeric. The body ends at a
 *   line equal to the delimiter — exactly, at column 0, with `<<-` stripping
 *   leading tabs only, the way bash does it.
 * - Redirections (`>`, `>>`, `>&`, `>|`, `<`, `<&`, `<>`, with an optional fd
 *   number) consume their target word. `printf x >&node foo` writes to a file
 *   named `node`; the old splitter read `node` as an executor.
 * - `&&`, `||`, `;`, `|`, `&`, newline, and the grouping characters separate
 *   commands.
 *
 * What it refuses to model, returning `undecidable` so the caller can fail
 * loudly rather than guess: command substitution (`$(...)`, backticks) and any
 * command whose executor comes from a variable. Both put a real call in a place
 * this scanner cannot resolve, and a silent "no command here" is how a missing
 * lane reads as a covered one.
 */

// Substitutions naming this are reported instead of guessed at. Passed in by
// the caller would be tidier, but it is the one thing this scanner has to know
// about its only consumer, and threading it through every helper is worse.
const SCANNED_SCRIPT_NAME = "starter-checks";
const UNQUOTED_ESCAPABLE_IN_DOUBLE = new Set(['"', "\\", "$", "`", "\n"]);
const REDIRECTION_OPERATOR = /^(?:>>|>&|>\||<&|<>|>|<)/u;
const HEREDOC_OPERATOR = /^<<(-?)/u;

/**
 * `<<EOF`, `<<-'EOF'`, `<<"EOF"`, `<<\EOF`, `<<123`. The delimiter is the next
 * word; quoting only decides whether the body is expanded, which does not
 * matter here, so the quotes and backslashes are stripped off the name.
 */
function readHeredocDelimiter(text, start) {
  let index = start;
  while (index < text.length && (text[index] === " " || text[index] === "\t")) {
    index += 1;
  }

  let delimiter = "";
  let quote = null;
  while (index < text.length) {
    const char = text[index];
    if (quote !== null) {
      if (char === quote) quote = null;
      else delimiter += char;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "\\" && index + 1 < text.length) {
      index += 1;
      delimiter += text[index];
    } else if (/[\s;|&<>()]/u.test(char)) {
      break;
    } else {
      delimiter += char;
    }
    index += 1;
  }

  return { delimiter, end: index };
}

/** State shared by the character loop; grouped so the loop stays readable. */
function createScanState() {
  return {
    commands: [],
    undecidable: [],
    tokens: [],
    current: "",
    started: false,
    quote: null,
    operator: null,
    pendingRedirectTarget: false,
    heredocs: [],
    skipToLineEnd: false,
  };
}

function endToken(state) {
  if (!state.started) return;
  if (state.pendingRedirectTarget) {
    // The word after a redirection operator is a file, not a command word.
    state.pendingRedirectTarget = false;
  } else {
    state.tokens.push(state.current);
  }
  state.current = "";
  state.started = false;
}

function endCommand(state, nextOperator) {
  endToken(state);
  if (state.tokens.length > 0) {
    const previous = state.commands.at(-1);
    // `true || x` and `false && x` never reach `x`. The guard is read from the
    // executor, not the whole command: `true ignored || x` short-circuits just
    // the same, and matching the literal token `true` missed it.
    const guard = previous?.[0];
    const unreachable =
      (state.operator === "||" && guard === "true") ||
      (state.operator === "&&" && guard === "false");
    if (!unreachable) state.commands.push(state.tokens);
  }
  state.tokens = [];
  state.operator = nextOperator;
}

function take(state, char) {
  state.current += char;
  state.started = true;
}

/** Inside `'...'` everything is literal, newlines included. */
function scanSingleQuoted(state, char) {
  if (char === "'") state.quote = null;
  else take(state, char);
  state.started = true;
}

/** Inside `"..."` only `\` before `" \ $ ` newline` is an escape. */
function scanDoubleQuoted(state, text, index) {
  const char = text[index];
  if (
    char === "\\" &&
    index + 1 < text.length &&
    UNQUOTED_ESCAPABLE_IN_DOUBLE.has(text[index + 1])
  ) {
    // An escaped newline disappears; anything else becomes a literal.
    if (text[index + 1] !== "\n") take(state, text[index + 1]);
    state.started = true;
    return index + 1;
  }
  if (char === '"') {
    state.quote = null;
    state.started = true;
    return index;
  }
  take(state, char);
  return index;
}

/** Consume heredoc bodies queued on the line that just ended. */
function consumeHeredocBodies(state, lines, startLine) {
  let line = startLine;
  while (state.heredocs.length > 0 && line < lines.length) {
    const { delimiter, stripTabs } = state.heredocs[0];
    const body = stripTabs ? lines[line].replace(/^\t+/u, "") : lines[line];
    line += 1;
    // bash matches the delimiter exactly, at column 0. Trimming spaces here is
    // what let `  EOF` close a heredoc early and hand the rest to the tokenizer.
    if (body === delimiter) state.heredocs.shift();
  }
  return line;
}

function isCommandSubstitutionStart(text, index) {
  return (
    text[index] === "`" || (text[index] === "$" && text[index + 1] === "(")
  );
}

/**
 * Read `$(...)` (nesting-aware, so `$((i % 10))` closes correctly) or a
 * backtick pair, and return its body plus where it ends.
 *
 * The body becomes one opaque token: a substitution is a value, and treating
 * every one of them as unreadable would fail the gate on the fifteen ordinary
 * `$(git rev-parse HEAD^)`-style uses this repo already has. Only a body that
 * names the checker script is undecidable — there the scanner genuinely cannot
 * say whether a lane exists, and guessing "no" is how a missing lane reads as
 * a covered one.
 */
function readCommandSubstitution(text, start) {
  if (text[start] === "`") {
    const end = text.indexOf("`", start + 1);
    if (end === -1) return { body: text.slice(start + 1), end: text.length };
    return { body: text.slice(start + 1, end), end: end + 1 };
  }

  let depth = 0;
  let index = start + 1;
  for (; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    else if (text[index] === ")") {
      depth -= 1;
      if (depth === 0)
        return { body: text.slice(start + 2, index), end: index + 1 };
    }
  }
  return { body: text.slice(start + 2), end: text.length };
}

/** A bare fd number in front of a redirection is part of it, not a word. */
function dropFileDescriptorPrefix(state) {
  if (/^\d+$/u.test(state.current)) {
    state.current = "";
    state.started = false;
  }
}

/**
 * `<<WORD` and the redirection operators. Returns the index to continue from,
 * or `null` when the text at `index` is neither.
 */
function scanRedirection(state, line, index) {
  const rest = line.slice(index);
  const heredoc = HEREDOC_OPERATOR.exec(rest);
  if (heredoc) {
    const { delimiter, end } = readHeredocDelimiter(
      line,
      index + heredoc[0].length,
    );
    if (delimiter.length > 0) {
      state.heredocs.push({ delimiter, stripTabs: heredoc[1] === "-" });
    }
    dropFileDescriptorPrefix(state);
    return end;
  }

  const redirection = REDIRECTION_OPERATOR.exec(rest);
  if (!redirection) return null;
  dropFileDescriptorPrefix(state);
  endToken(state);
  state.pendingRedirectTarget = true;
  return index + redirection[0].length;
}

/**
 * `&&`, `||`, `;`, `|`, `&` and the grouping characters. Returns the index to
 * continue from, or `null` when the character separates nothing.
 *
 * Grouping characters separate commands, but the commands inside them still
 * run, so the scan carries on rather than discarding what follows.
 */
function scanSeparator(state, line, index) {
  const pair = line.slice(index, index + 2);
  if (pair === "&&" || pair === "||") {
    endCommand(state, pair);
    return index + 2;
  }
  const char = line[index];
  if (char === ";" || char === "|" || char === "&") {
    endCommand(state, char);
    return index + 1;
  }
  if (char === "(" || char === ")" || char === "{" || char === "}") {
    endCommand(state, null);
    return index + 1;
  }
  return null;
}

/**
 * Quoting, escapes and command substitution — everything that decides whether
 * the following characters are syntax or data.
 *
 * Returns the index to continue from, `CONTINUES_NEXT_LINE` for a trailing
 * backslash, or `null` when nothing here applies.
 */
const CONTINUES_NEXT_LINE = -1;

function scanQuoting(state, line, index) {
  const char = line[index];

  if (state.quote === "'") {
    scanSingleQuoted(state, char);
    return index + 1;
  }
  if (state.quote === '"') return scanDoubleQuoted(state, line, index) + 1;
  if (char === "\\") {
    if (index + 1 === line.length) return CONTINUES_NEXT_LINE;
    take(state, line[index + 1]);
    return index + 2;
  }
  if (char === "'" || char === '"') {
    state.quote = char;
    state.started = true;
    return index + 1;
  }
  if (isCommandSubstitutionStart(line, index)) {
    const { body, end } = readCommandSubstitution(line, index);
    if (body.includes(SCANNED_SCRIPT_NAME)) {
      state.undecidable.push(
        `command substitution runs ${SCANNED_SCRIPT_NAME}: ${JSON.stringify(line.trim())}`,
      );
    }
    take(state, body);
    return end;
  }
  return null;
}

/** Scan one physical line. Returns true when a trailing `\` joins the next. */
function scanLine(state, line) {
  let index = 0;

  while (index < line.length) {
    const char = line[index];

    const afterQuoting = scanQuoting(state, line, index);
    if (afterQuoting === CONTINUES_NEXT_LINE) return true;
    if (afterQuoting !== null) {
      index = afterQuoting;
      continue;
    }
    if (char === "#" && !state.started) break;

    const afterRedirection = scanRedirection(state, line, index);
    if (afterRedirection !== null) {
      index = afterRedirection;
      continue;
    }
    const afterSeparator = scanSeparator(state, line, index);
    if (afterSeparator !== null) {
      index = afterSeparator;
      continue;
    }
    if (char === " " || char === "\t") {
      endToken(state);
      index += 1;
      continue;
    }

    take(state, char);
    index += 1;
  }

  return false;
}

/**
 * Scan one shell snippet.
 *
 * Returns `{ commands, undecidable }`. `commands` is one token array per simple
 * command. `undecidable` lists constructs the caller must treat as a failure
 * rather than as an absence.
 */
function scanShellCommands(text) {
  const state = createScanState();
  const lines = text.split("\n");
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const continued = scanLine(state, lines[lineIndex]);
    lineIndex += 1;

    if (state.quote !== null) {
      // A quote left open at end of line swallows the newline as data.
      take(state, "\n");
      continue;
    }
    if (continued) continue;

    endCommand(state, null);
    lineIndex = consumeHeredocBodies(state, lines, lineIndex);
  }

  endCommand(state, null);
  // A quote never closed means the rest of the snippet was data. Nothing was
  // lost that could have been a call, so this stays a miss, not a failure.
  return { commands: state.commands, undecidable: state.undecidable };
}

module.exports = { scanShellCommands };
