# Schengen 90/180 Calculator

A free web app from [All Trips Considered](https://alltripsconsidered.com) that counts how many days a traveler has spent in the Schengen Area during the 180 days ending on a chosen date. Everything runs in the browser, and trips are never sent to a server.

Live site: https://90days.alltripsconsidered.com/

![Schengen 90/180 Calculator link preview](docs/icons/og-image.png)

## Features

### Counting days
- Add any number of trips, each with a Schengen country, an entry date, and a departure date.
- The country list shows all 29 Schengen countries with the English name, native name, and flag, for example "Germany | Deutschland | 🇩🇪".
- Entry and departure days both count as full days. Overlapping trips are counted once.
- The check date defaults to today and moves to the next day at midnight while the page is open. Pick another date to plan an upcoming trip, and it stays put. A check date that can't be used (a year outside 1900 to 2999) shows a message, and the totals count to today until it is fixed.
- Picking an entry date fills an empty departure date with the same day. A trip missing a date, or with a date that can't be used, shows a message and counts no days until it is fixed.
- The running total is shown in color with a status emoji:

  | Days used | Color | Emoji |
  |---|---|---|
  | 0 to 45 | Green | ✅ |
  | 46 to 60 | Yellow | ⚠️ |
  | 61 to 90 | Red | ‼️ |
  | 91 or more | Black | ⛔️ |

- At 91 days or more, a notice asks the visitor to contact a local immigration lawyer who knows Schengen overstay laws.

### Map
- A map of the Schengen Area shades each country in the visitor's trips. Luxembourg, Liechtenstein, and Malta also get dots, since they are too small to see.
- **Download** saves the map as JPG, PNG, or SVG, with the titles at the top and the site address at the bottom.
- **Share** opens the phone's share sheet with the map image attached. Browsers that cannot share files get a menu instead: Bluesky, Facebook, Instagram, LinkedIn, Pinterest, Reddit, Threads, WhatsApp, X, and Copy link. Instagram does not accept posts from websites, so that option saves the image and copies the caption.

### Export
- **Download** in the Export section saves the trips and totals as CSV (spreadsheet), JSON (data), or TXT (plain text). The file is created in the browser and never uploaded.

### Dates, times, and numbers
- The page shows dates, times, and numbers in the visitor's device format (language and region), including the 12 or 24 hour clock and local digits.
- The TXT export uses the same device formats, with the export time in the device's time zone.
- Saved data, CSV, JSON, and file names always use `YYYY-MM-DD` so spreadsheets and other programs read them reliably.
- Day counting never depends on the time zone. Only today's date does, so the default check date follows the device's own calendar.
- Trips added in one tab show up in any other open tab right away, so one tab never overwrites another. While a date is half typed, the other tab's changes are merged in and the list redraws once typing ends.

### Appearance
- The button in the upper right corner opens the Appearance panel.
- **Mode:** Auto (default, follows the device), Light, or Dark.
- **Color:** Europe (default) or a scheme based on any Schengen country's flag. It recolors the buttons, links, map shading, and browser toolbar. Button colors keep white text at a 4.5:1 contrast or better in both light and dark mode. The green, yellow, red, and black status colors never change.

### App and offline use
- The site can be installed as a home screen app. Chrome, Edge, and Android show an Install button. iPhone and iPad show the Share > Add to Home Screen steps.
- The Add to Home Screen banner has a **Close** button that hides it for 24 hours.
- The installed app works offline.
- Browsers that cannot save files, such as the built-in browsers in Instagram, Facebook, TikTok, and LinkedIn, show a note beside each Download button. Tapping Download there opens the Add to Home Screen banner with steps for that browser, for example opening the page in Safari or Chrome first.
- Desktop and phone layouts are both supported, along with a back to top button and keyboard navigation for all menus.

### Footer
- Notes on how days are counted and that the tool is not legal advice.
- **Rules last checked:** the date the Schengen rules were last reviewed, why Cyprus, Ireland, and the microstates (Andorra, Monaco, San Marino, Vatican City) are not in the country list, and a note about the EU Entry/Exit System.
- A link to the privacy page and the copyright line for All Trips Considered.
- **Travel Tools** links to the other All Trips Considered tools: Jet Lag & Recovery, My Maps, Point Calculator, Schengen 90/180 (this site, highlighted), and Trip Finder. They appear as buttons on wider screens and as a list on phones.

## Privacy

Trips, the chosen mode, and the color scheme are saved only in the visitor's browser (`localStorage`). Nothing is uploaded: exported and downloaded files are created on the device, and sharing sends only what the visitor chooses to share. The full policy is in [`docs/privacy.html`](docs/privacy.html), linked from the page footer.

## Project structure

Everything the site serves lives in `docs/`, which GitHub Pages publishes. Development files stay at the repository root and are not published.

```
docs/index.html               The page, including the inline Europe map
docs/privacy.html             Privacy page, linked from the footer
docs/css/style.css            All styles, with light and dark color tokens
docs/css/privacy.css          Styles for the privacy page
docs/js/countries.js          The one list of Schengen countries: codes, names, flags, colors
docs/js/calc.js               Day counting rules, status levels, saved-data upgrades
docs/js/export.js             CSV, JSON, and TXT export
docs/js/app.js                Page behavior: trips, map, downloads, sharing, menus
docs/js/theme.js              Auto, Light, and Dark mode (loaded in <head>)
docs/js/scheme.js             Applies the flag color schemes (loaded in <head>)
docs/js/device.js             Detects in-app browsers and whether files can be saved
docs/js/install.js            Add to Home Screen prompt and service worker setup
docs/sw.js                    Service worker for offline use (must stay at the top of docs/)
docs/manifest.webmanifest     App name, colors, and icons for installing
docs/icons/                   App icons, browser tab icons (tabicon-32.png and tabicon-192.png, the All Trips Considered artwork) and the share image (og-image.png)
docs/favicon.ico              Favicon: the app icon
docs/fonts/                   Instrument Serif (self-hosted) and its license
docs/CNAME                    Custom domain for GitHub Pages
docs/robots.txt               Search engine crawling rules
docs/sitemap.xml              Sitemap for search engines
README.md                     This file
tools/build-map.js            Rebuilds the map from Natural Earth data
tools/europe-map.svg          The map that build-map.js generates
tools/package.json            Dependencies for the map builder
qa/run.js                     QC runner: logic tests, static audit, and browser tests
qa/unit.test.js               Day counting, saved data, and export tests (no dependencies)
qa/audit.js                   Checks files, cache list, CSP, map, and search data against each other
qa/browser.test.js            Playwright tests of the real page, including offline and phone widths
.claude/agents/qc-bug-hunter.md   QC & Bug Hunter: on-demand Claude Code agent that runs seven checks and writes a report
.github/workflows/qc.yml      Runs QC on every pull request to prod
```

### Saved data

Trips are saved in the browser under the key `schengen-90-180-trips`:

```json
{ "version": 2,
  "trips": [{ "id": "t1abc", "country": "DE", "entry": "2026-06-01", "exit": "2026-06-10" }] }
```

Countries are stored by ISO code, never by name. Older saves (version 1, a plain list with English country names) are upgraded automatically the first time a visitor opens the new version.

## Run locally

No build step is needed. Serve the `docs/` folder with a local server rather than opening `index.html` directly, because the service worker (offline support) and installing only work over HTTP:

```bash
python3 -m http.server 8000 --directory docs
```

Open http://localhost:8000.

## Quality checks

Run every check before opening a pull request:

```bash
node qa/run.js
```

- **Logic tests** cover day counting, status levels, saved-data upgrades, and exports. They run in five time zones, because a count must never depend on the device's zone.
- **Static audit** checks that every linked file exists, the `sw.js` cache list and version are current, the CSP matches on both pages and in the README, no forbidden HTML sinks are used, and every country has a map shape.
- **Browser tests** drive the page in headless Chromium: adding and removing trips, status changes, saved data, downloads, menus, themes, phone widths, in-app browsers, and offline use. Any console error or CSP violation fails a test.

The browser tests need Playwright once: `cd qa && npm install && npx playwright install chromium`. Use `node qa/run.js --quick` to skip them. The same checks run on every pull request to `prod`.

In Claude Code, ask for a QC pass to run the **QC & Bug Hunter** agent (`.claude/agents/qc-bug-hunter.md`). It runs the suite, then works through seven checks: display and accessibility, day counting, Schengen rule changes, saved data and exports, offline and security, edge cases, and whether this README matches the behavior. It never edits files. Its report opens with a tl;dr of what is working, what is not, and what you need to do, then a "Fix these first" list and one section per check. Each finding has a severity, a confidence level, steps, expected and actual results, and a screenshot or source. The report is published as a private "Schengen Calculator QC Report" page, in the same layout as the Points Calculator QC Report. Name checks by number to run only those, for example "QC checks 2 and 3".

## Making changes

### Changing the saved-data format
If the saved format changes again, raise `DATA_VERSION` in `docs/js/calc.js` and extend `upgradeSaved` so existing trips carry over.

### Adding or removing a Schengen country
Edit `docs/js/countries.js`, which holds the code, names, flag, and colors in one place. Then rebuild the map. Never change an existing country's code, since saved trips use it.

### Rebuilding the map
Run the map builder in `tools/`:

```bash
cd tools && npm install && node build-map.js
```

Then replace the SVG between the `MAP START` and `MAP END` comments in `docs/index.html` with `tools/europe-map.svg`.

### Reviewing the Schengen rules
When membership or related rules change, update `docs/js/countries.js` and the "Rules last checked" date in the footer of `docs/index.html`.

### Search engines
The title, description, canonical address, share tags (Open Graph and X), share image (`docs/icons/og-image.png`, 1200 × 630), and structured data are in the `<head>` of `docs/index.html`. The main page describes the organization, the site, and the app with its feature list. Keep that list in step with new features. Keep titles under about 60 characters so search results do not cut them off.

After a change worth re-indexing, update these dates:
- `lastmod` in `docs/sitemap.xml` for each page that changed.
- `dateModified` in that page's structured data.
- The visible "Last updated" date in `docs/privacy.html`, if its text changed.

### Releasing an update
When any file the offline app caches changes, increase the version number in the `CACHE` name at the top of `docs/sw.js`. If you add a new file that the app needs offline, add it to the `SHELL` list in the same file. Installed apps then fetch the new files on their next visit while online.

## Security

- **Content-Security-Policy** in a `<meta>` tag on both pages: scripts, styles, fonts, and data load only from this site. Images also allow `data:` and `blob:` (map downloads). There are no inline scripts or styles, no `eval`, and no third-party requests.
- **Trusted Types** are enforced, so the browser blocks `innerHTML` and similar HTML string sinks. Build interface with `textContent` and `createElement`. The only allowed policy is `schengen-sw`, in `docs/js/install.js`, and it creates exactly one URL: `sw.js`.
- **Fonts are self-hosted** in `docs/fonts/`. Downloaded SVG maps embed the font, so they make no outside requests either.
- **Checked input:** saved trips are checked when they load. Unknown countries, any date not in `YYYY-MM-DD` form, and years outside 1900 to 2999 are cleared so the visitor can pick again, and a trip whose departure comes before its entry is flagged and counts no days. Country lookups ignore built-in names such as `__proto__`.
- Keep the policy in the two `<meta>` tags and in the Cloudflare rule the same. If a change needs a new source (for example analytics), add it to all three.

### Headers to set in Cloudflare

GitHub Pages cannot send custom headers, so they are set with a Cloudflare Transform Rule (Rules > Transform Rules > Modify Response Header) for `90days.alltripsconsidered.com`:

- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'; trusted-types schengen-sw; upgrade-insecure-requests; frame-ancestors 'none'`
- `Strict-Transport-Security: max-age=7776000` (90 days, no `includeSubDomains` or `preload` yet)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

## Deployment

GitHub Pages publishes the `/docs` folder of the `prod` branch (Settings > Pages > Deploy from a branch). `docs/CNAME` sets the custom domain, and Cloudflare provides DNS. `prod` is the default branch. Changes reach it only through an approved pull request, and the site updates a few minutes after a merge.

To help search engines find the site, submit `https://90days.alltripsconsidered.com/sitemap.xml` in [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters).

## Roadmap

### Owner tasks
These need the site owner's accounts or approval.

- [ ] **Submit the sitemap to search engines.** Add the site to Google Search Console and Bing Webmaster Tools, then submit the sitemap (see Deployment).

### Features
- [ ] **Import a saved record.** Let visitors load a JSON export back into the calculator, so trips survive clearing the browser or switching phones. This is the most important gap, since trips are otherwise stored only in one browser.
- [ ] **"Still in Schengen" option.** A checkbox on a trip that counts up to today and updates daily, so travelers in Europe do not have to guess a departure date.

### Quality and operations
- [ ] **Privacy-friendly visitor statistics.** Consider a cookie-free tool such as Plausible or GoatCounter to see how many people use the site and which features they use. Update `docs/privacy.html` first to explain what is collected.

### Recurring
- [ ] **Review the Schengen rules every few months.** Check the member list (Cyprus is working toward joining), the Entry/Exit System, and related rules. See "Reviewing the Schengen rules" under Making changes.

### Considered and set aside
- **Sign in with Apple or Google, with iCloud or Google Drive sync.** Reviewed in November 2026 and not pursued for now. Google Drive sync would need a Google Cloud project and Google's review of the app's name and logo, and sign-in does not work in in-app browsers. iCloud sync would need the Apple Developer Program ($99 per year) and CloudKit JS, which gets limited support for the web. Either would also replace the "no accounts" promise in the privacy page. If cloud storage comes up again, the simplest path is Import plus the phone's own Save to Files, which already reaches iCloud Drive and Google Drive with no sign-in.

### Done
- [x] Privacy page, linked from the footer
- [x] Dates, times, and numbers shown in the device's own format
- [x] One shared country list and versioned saved data with automatic upgrades
- [x] "Rules last checked" note explaining which countries are not included and the Entry/Exit System
- [x] Travel Tools links to the other All Trips Considered tools
- [x] Search and sharing properties refreshed on both pages
- [x] Add to Home Screen banner: Close hides it for 24 hours
- [x] Security hardening: self-hosted fonts, strict Content-Security-Policy with Trusted Types, no inline code or HTML strings

## Disclaimer

This tool provides general information only and is not legal advice. Official border authorities make the final determination of a traveler's permitted stay.

## Credits and licenses

- **Font:** Instrument Serif, self-hosted under the SIL Open Font License (`docs/fonts/OFL.txt`).
- **Map data:** Natural Earth (public domain), through the `world-atlas` package, used only by `tools/build-map.js`.

<p align="center">
  <img src="docs/icons/icon-512.png" alt="Schengen 90/180 Calculator app icon" width="96" height="96">
</p>

<p align="center">© 2026 All Trips Considered. All rights reserved.</p>
