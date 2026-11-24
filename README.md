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
- The installed app works offline.
- Desktop and phone layouts are both supported, along with a back to top button and keyboard navigation for all menus.

## Saved data

Trips are saved in the browser under the key `schengen-90-180-trips`:

```json
{ "version": 2,
  "trips": [{ "id": "t1abc", "country": "DE", "entry": "2026-06-01", "exit": "2026-06-10" }] }
```

Countries are stored by ISO code, never by name. Older saves (version 1, a plain list with English country names) are upgraded automatically the first time a visitor opens the new version. If the format changes again, raise `DATA_VERSION` in `js/calc.js` and extend `upgradeSaved` so existing trips carry over.

## Privacy

Trips, the chosen mode, and the color scheme are saved only in the visitor's browser (`localStorage`). Nothing is uploaded. Exported and downloaded files are created on the device. Sharing sends only what the visitor chooses to share.

## Project layout

```
index.html             The page, including the inline Europe map
css/style.css          All styles, with light and dark color tokens
js/countries.js        The one list of Schengen countries: codes, names, flags, colors
js/calc.js             Day counting rules, status levels, saved-data upgrades
js/export.js           CSV, JSON, and TXT export
js/app.js              Page behavior: trips, map, downloads, sharing, menus
js/theme.js            Auto, Light, and Dark mode (loaded in <head>)
js/scheme.js           Applies the flag color schemes (loaded in <head>)
js/install.js          Add to Home Screen prompt and service worker setup
sw.js                  Service worker for offline use (must stay at the root)
manifest.webmanifest   App name, colors, and icons for installing
icons/, favicon.ico    App icons and favicons
tests/calc.test.js     Unit tests
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

## Tests

```bash
node --test tests/calc.test.js
```

The tests cover the 180-day window, the status levels, overlapping trips, every export format, and checks that every Schengen country appears on the map and has a color scheme.

## Publishing

The site is hosted on GitHub Pages at the custom domain in `CNAME`. Pages publishes from the `claude/peaceful-rubin-dyhyh5` branch, so pushing to that branch updates the live site, usually within a few minutes.

When changing any file the offline app uses, increase the version number in the `CACHE` name at the top of `sw.js`. Installed apps then fetch the new files on their next visit while online.

## Maintenance notes

- **Adding or removing a Schengen country:** edit `js/countries.js` (code, names, flag, and colors in one place), then rebuild the map. The tests fail if a country is missing from the map, has no colors, or has a bad code. Never change an existing country's code, since saved trips use it.
- **Rebuilding the map:**

  ```bash
  cd tools && npm install && node build-map.js
  ```

  Then replace the SVG between the `MAP START` and `MAP END` comments in `index.html` with `tools/europe-map.svg`.
- **Search engines:** the page title, description, canonical address, share image (`icons/og-image.png`, 1200 × 630), and structured data are in the `<head>` of `index.html`. Update `lastmod` in `sitemap.xml` after major changes.
- **Map data:** Natural Earth (public domain), through the `world-atlas` package.

## Disclaimer

This tool provides general information only and is not legal advice. Official border authorities make the final determination of a traveler's permitted stay.

© All Trips Considered. All rights reserved.
