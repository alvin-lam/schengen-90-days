# Schengen 90/180 Calculator

**Live site:** https://90days.alltripsconsidered.com

A free web app from [All Trips Considered](https://alltripsconsidered.com) that counts how many days a traveler has spent in the Schengen Area during the 180 days ending on a chosen date. Everything runs in the browser. Trips are never sent to a server.

## Features

### Counting days
- Add any number of trips, each with a Schengen country, an entry date, and a departure date.
- The country list shows all 29 Schengen countries with the English name, native name, and flag, for example "Germany | Deutschland | 🇩🇪".
- Entry and departure days both count as full days. Overlapping trips are counted once.
- The check date defaults to today. Pick a future date to plan an upcoming trip.
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

### Appearance
- The button in the upper right corner opens the Appearance panel.
- **Mode:** Auto (default, follows the device), Light, or Dark.
- **Color:** Europe (default) or a scheme based on any Schengen country's flag. It recolors the buttons, links, map shading, and browser toolbar. The green, yellow, red, and black status colors never change.

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
- **Travel Tools** links to the other All Trips Considered tools: Jet Lag & Recovery, My Maps, Point Calculator, Schengen 90/180 (this site, highlighted), and Trip Finder. Buttons on wider screens, a list on phones.

## Saved data

Trips are saved in the browser under the key `schengen-90-180-trips`:

```json
{ "version": 2,
  "trips": [{ "id": "t1abc", "country": "DE", "entry": "2026-06-01", "exit": "2026-06-10" }] }
```

Countries are stored by ISO code, never by name. Older saves (version 1, a plain list with English country names) are upgraded automatically the first time a visitor opens the new version. If the format changes again, raise `DATA_VERSION` in `js/calc.js` and extend `upgradeSaved` so existing trips carry over.

## Dates, times, and numbers

The page shows dates, times, and numbers in the visitor's device format (language and region), including the 12 or 24 hour clock and local digits. The TXT export uses the same device formats, with the export time in the device's time zone. Saved data, CSV, JSON, and file names always use `YYYY-MM-DD` so spreadsheets and other programs read them reliably. Day counting never depends on the time zone.

## Security

- **Content-Security-Policy** in a `<meta>` tag on both pages: scripts, styles, fonts, and data load only from this site; images also allow `data:` and `blob:` (map downloads). No inline scripts or styles, no `eval`, and no third-party requests.
- **Trusted Types** are enforced, so the browser blocks `innerHTML` and similar HTML string sinks. Build interface with `textContent` and `createElement`. The only policy allowed is `schengen-sw`, in `js/install.js`, and it creates exactly one URL: `sw.js`.
- **Fonts are self-hosted** in `fonts/` (Instrument Serif, SIL Open Font License in `fonts/OFL.txt`). Downloaded SVG maps embed the font, so they make no outside requests either.
- **`_headers`** holds the full header set: the policy plus `frame-ancestors 'none'`, HSTS (90 days, no `includeSubDomains` or `preload` yet), `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and cross-origin isolation headers, with cache rules. Cloudflare Pages and Netlify read it; **GitHub Pages does not**, so while the site is on GitHub Pages, set the same headers with a Cloudflare Transform Rule.
- Keep the policy in the two `<meta>` tags and in `_headers` the same. If a change needs a new source (for example analytics), add it to all three.

## Privacy

See [`privacy.html`](privacy.html), linked from the page footer. Trips, the chosen mode, and the color scheme are saved only in the visitor's browser (`localStorage`). Nothing is uploaded. Exported and downloaded files are created on the device. Sharing sends only what the visitor chooses to share.

## Project layout

```
index.html             The page, including the inline Europe map
privacy.html           Privacy page, linked from the footer
css/style.css          All styles, with light and dark color tokens
js/countries.js        The one list of Schengen countries: codes, names, flags, colors
js/calc.js             Day counting rules, status levels, saved-data upgrades
js/export.js           CSV, JSON, and TXT export
js/app.js              Page behavior: trips, map, downloads, sharing, menus
js/theme.js            Auto, Light, and Dark mode (loaded in <head>)
js/scheme.js           Applies the flag color schemes (loaded in <head>)
js/device.js           Detects in-app browsers and whether files can be saved
js/install.js          Add to Home Screen prompt and service worker setup
sw.js                  Service worker for offline use (must stay at the root)
manifest.webmanifest   App name, colors, and icons for installing
icons/, favicon.ico    App icons and favicons
fonts/                 Instrument Serif (self-hosted) and its license
_headers               Security and cache headers (Cloudflare Pages, Netlify)
tools/build-map.js     Rebuilds the map from Natural Earth data
CNAME                  Custom domain for GitHub Pages
robots.txt, sitemap.xml  Search engine crawling and sitemap
```

## Running locally

No build step is needed. Serve the folder and open it in a browser:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000. Use a local server rather than opening `index.html` directly, so offline support and installing work.

## Publishing

The site is hosted on GitHub Pages at the custom domain in `CNAME`.

### Branches

| Branch | Purpose |
|---|---|
| `claude/peaceful-rubin-dyhyh5` | Working branch. All changes are pushed here first. |
| `prod` | Production and the repository's default branch. Changes reach it only when the site owner approves a merge. |

Workflow:

1. Make and test changes on `claude/peaceful-rubin-dyhyh5` (or a short-lived feature branch merged into it), then push.
2. Merge into `prod` only when the site owner explicitly asks. Keep it a fast-forward merge so `prod` never has commits of its own.
3. GitHub Pages should publish from `prod` (Settings > Pages > Build and deployment). The live site then updates a few minutes after `prod` changes.

When changing any file the offline app uses, increase the version number in the `CACHE` name at the top of `sw.js`. Installed apps then fetch the new files on their next visit while online.

## Maintenance notes

- **Adding or removing a Schengen country:** edit `js/countries.js` (code, names, flag, and colors in one place), then rebuild the map. Never change an existing country's code, since saved trips use it.
- **Rebuilding the map:**

  ```bash
  cd tools && npm install && node build-map.js
  ```

  Then replace the SVG between the `MAP START` and `MAP END` comments in `index.html` with `tools/europe-map.svg`.
- **Search engines:** the title, description, canonical address, share tags (Open Graph and X), share image (`icons/og-image.png`, 1200 × 630), and structured data are in the `<head>` of `index.html`. The main page describes the organization, the site, and the app with its feature list; keep that list in step with new features. Keep titles under about 60 characters so search results do not cut them off. After a change worth re-indexing, update `lastmod` in `sitemap.xml` for each page that changed, `dateModified` in that page's structured data, and the visible "Last updated" date on the privacy page if its text changed.
- **Map data:** Natural Earth (public domain), through the `world-atlas` package.

## Roadmap

Planned work for the Schengen 90/180 Calculator, in suggested order.

### Owner tasks

These need the site owner's accounts or approval.

- [ ] **Confirm the GitHub Pages source.** Settings > Pages should publish from `prod`, so changes go live only after a merge is approved.
- [ ] **Submit the sitemap to search engines.** Add the site to [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters), then submit `https://90days.alltripsconsidered.com/sitemap.xml`.

### Features

- [ ] **Import a saved record.** Let visitors load a JSON export back into the calculator, so trips survive clearing the browser or switching phones. This is the most important gap, since trips are otherwise stored only in one browser.
- [ ] **"Still in Schengen" option.** A checkbox on a trip that counts up to today and updates daily, so travelers in Europe do not have to guess a departure date.

### Quality and operations

- [ ] **Privacy-friendly visitor statistics.** Consider a cookie-free tool such as Plausible or GoatCounter to see how many people use the site and which features they use. Update `privacy.html` first to explain what is collected.

### Recurring

- [ ] **Review the Schengen rules every few months.** Check the member list (Cyprus is working toward joining), the Entry/Exit System, and related rules. Update `js/countries.js` if membership changes, and update the "Rules last checked" date in the footer of `index.html`.

### Considered and set aside

- **Sign in with Apple or Google, with iCloud or Google Drive sync.** Reviewed in November 2026 and not pursued for now. Google Drive sync would need a Google Cloud project and Google's review of the app's name and logo, and sign-in does not work in in-app browsers. iCloud sync would need the Apple Developer Program ($99 per year) and CloudKit JS, which gets limited support for the web. Either would also replace the "no accounts" promise in the privacy page. If cloud storage comes up again, the simplest path is Import plus the phone's own Save to Files, which already reaches iCloud Drive and Google Drive with no sign-in.

### Done

- [x] Privacy page (`privacy.html`), linked from the footer
- [x] Dates, times, and numbers shown in the device's own format
- [x] Fields and buttons aligned at every screen width, and an Add to Home Screen reminder where downloads are blocked
- [x] One shared country list (`js/countries.js`) and versioned saved data with automatic upgrades
- [x] Old feature branches deleted on GitHub; only `claude/peaceful-rubin-dyhyh5` and `prod` remain
- [x] "Rules last checked" note explaining which countries are not included and the Entry/Exit System
- [x] Travel Tools links to the other All Trips Considered tools: buttons on desktop, a list on phones
- [x] Search and sharing properties refreshed on both pages (title, description, share tags, structured data with feature list, topic, and modified dates)
- [x] Add to Home Screen banner: Close hides it for 24 hours
- [x] Security hardening: self-hosted fonts, strict Content-Security-Policy with Trusted Types, no inline code or HTML strings, `_headers` file

## Disclaimer

This tool provides general information only and is not legal advice. Official border authorities make the final determination of a traveler's permitted stay.

© All Trips Considered. All rights reserved.
