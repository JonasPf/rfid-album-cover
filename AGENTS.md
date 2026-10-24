# RFID Album Cover — Agent Guide

A static, client-only web app (TypeScript, Vite, Svelte, pdf-lib) that turns album covers from iTunes search, uploaded images or emoji into an A4 PDF of exact-size stickers for ISO RFID cards. There is no backend and nothing persists between sessions, and it is hosted on GitHub Pages. See [`specs/index.html`](specs/index.html).

## Build, run, lint, test

Workflows are driven through `task` (`Taskfile.yml`). Install the Playwright browsers once with `npx playwright install`.

| Task      | Command      | Notes                                                                                                        |
| --------- | ------------ | ------------------------------------------------------------------------------------------------------------ |
| **Build** | `task build` | Type-checks and builds the static site into `dist/`                                                          |
| **Run**   | `task run`   | Vite dev server                                                                                              |
| **Lint**  | `task lint`  | ESLint, Prettier check, svelte-check                                                                         |
| **Test**  | `task test`  | Vitest unit tests                                                                                            |
| **E2E**   | `task e2e`   | Playwright against a production build, plus one check on a fresh dev server; iTunes is stubbed with fixtures |
| **Check** | `task check` | Runs build, lint, test, e2e; fails if any fail                                                               |
| **Spec**  | `task spec`  | Serves `./specs` at http://localhost:8000 (not part of `check`)                                              |

### Layout

- `src/lib/`: framework-free logic — geometry, text fitting, crop maths, iTunes client, PDF builder. Unit-tested next to the code (`*.test.ts`).
- `src/components/`, `src/App.svelte`: the Svelte UI.
- `e2e/`: Playwright tests, one file per feature; `testing/pdf-inspect.ts` reads back the generated PDF.
- `fixtures/`: iTunes responses and images for tests (`node scripts/make-fixtures.ts` regenerates the images).
- `scripts/emoji-assets.ts`: Vite plugin that builds `emoji/` (index and Noto SVGs) from npm packages, served from memory by the dev server and written to `dist/` on build. Unit-tested next to it.

### Before committing

After every change, and **before committing**, these must all run successfully:

```sh
task check
```

Do not commit if any of them fail. Fix the change (or the tests) until all
of them pass.

**Never skip, disable, or exit tests early to make a run pass.** Do not add
skips, `t.Skip`, `xfail`, `.only`/`.skip`, early returns, commented-out
assertions, or loosened checks to get green. A test must be free to fail when
there is a legitimate reason — a failing test is signal, not an obstacle.
Investigate and fix the underlying cause (in the code or, if the test itself is
genuinely wrong, in the test with a clear reason) rather than suppressing it.

## Develop with TDD

Use test-driven development. Before changing behavior, write a test that
captures the intended behavior and watch it fail (red), then make the change to
turn it green, then refactor while keeping it green. Because every `AC-*` in
`specs/` must be covered by a Playwright e2e test that names its ID, new or
changed acceptance criteria should get their tests written first.

## Keep specs and code in sync

The specification in [`specs/`](specs/index.html) and the code are two views of
the same system and must not diverge. **Every change to behavior must be
reflected in the specs in the same change** — update the relevant spec
document(s) alongside the code, including the acceptance criteria (`AC-*`) and
the e2e tests that reference them.

**The spec has priority unless explicitly stated otherwise.** When the code and
the spec disagree, treat the spec as the source of truth and bring the code into
line with it — unless the task explicitly says the spec is wrong and should be
changed to match new intent. In that case, change the spec first, then make the
code conform.
