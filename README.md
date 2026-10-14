# RFID Album Cover

Print album covers as stickers for ISO-size RFID cards (54 × 85.6 mm), such as the cards used with a [Phoniebox](https://phoniebox.de).

Search the iTunes catalogue or upload your own images, crop them, edit the artist and title, and download an A4 PDF with up to 9 stickers per page at exact size. Everything runs in your browser: there is no server and no account, and nothing is saved when you close the tab.

## Printing

1. Click **Download PDF** to save `rfid-cards.pdf`.
2. Print it at **100 % / Actual size**. Turn off "Fit to page" or any scaling.
3. Measure the line at the bottom of the page. It should be exactly 100 mm. If not, check the scaling setting and print again.
4. With a paper trimmer, cut the 4 column lines at the cut marks first. Then cut each strip into stickers along the thin grey lines. The stickers share edges, so each cut separates two rows or columns.

Each sticker is smaller than the card by the **inset** on every side (default 1.5 mm), so small cutting errors don't show at the card's rounded corners. Lower it if you cut precisely; below about 0.9 mm the square corners overhang the card.

## Development

You need Node.js 22 or newer and [Task](https://taskfile.dev). Install the Playwright browsers once with `npx playwright install`.

| Command      | Does                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------- |
| `task build` | Type-check and build the static site into `dist/`                                         |
| `task run`   | Start the Vite dev server                                                                 |
| `task lint`  | ESLint, Prettier check and svelte-check                                                   |
| `task test`  | Unit tests (Vitest)                                                                       |
| `task e2e`   | Playwright tests in Chromium, Firefox and WebKit against `dist/`, plus a dev-server check |
| `task check` | All of the above; run it before every commit                                              |
| `task spec`  | Serve the specification at http://localhost:8000                                          |

The specification lives in [`specs/`](specs/index.html). The e2e tests stub the iTunes API with the files in `fixtures/` and never call Apple; each test names the acceptance criteria (`AC-…`) it covers.

GitHub Actions runs `task check` on every push and deploys `dist/` to GitHub Pages from `main`.

## Licence

The bundled [Inter](https://rsms.me/inter/) font is licensed under the SIL Open Font License; see [`src/assets/fonts/OFL.txt`](src/assets/fonts/OFL.txt).
