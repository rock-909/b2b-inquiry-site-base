---
name: derive-site
description: Prepare or verify a B2B inquiry site derived from this repository. Use when copying, forking, rebranding, handing off, or checking a derived site before launch. Keeps tracked docs, rules, and project skills aligned while separating local proof from real provider and owner approval.
---

# Derive Site

Read `docs/派生项目交接.md` first. It is the checklist source; do not copy its checklist into this skill.

Then:

1. Record the source SHA and target repository/branch. Do not copy `.env*`, credentials, provider records, DNS, or GitHub settings as if they were tracked project state.
2. Replace the real site facts in config, static content, messages, assets, legal text, and offering pages.
3. Reconcile `README.md`, current docs, `AGENTS.md` / `CLAUDE.md`, applicable `.claude/rules/*.md`, and project-local skills with the derived runtime paths and commands.
4. Run the narrow checks for changed behavior, then the repository gates in their documented order. Next build, Cloudflare/OpenNext build, and Playwright webServer share `.next` and must stay serial.
5. Leave Airtable, Resend, deployment, domain, inbox receipt, and Owner items unchecked until the corresponding external evidence exists. `pnpm release:verify` is not launch approval.

Finish with four short lists: changed, verified, external work still blocked, and Owner decisions still open.
