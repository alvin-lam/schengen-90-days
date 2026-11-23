# Schengen 90/180 Calculator

A small static web app that counts how many days a traveler spent in the Schengen Area during the 180 days ending on a chosen date (today by default).

## Features

- Running total of days in the Schengen Area, shown in color:
  - **Green** ✅: 0 to 45 days
  - **Yellow** ⚠️: 46 to 60 days
  - **Red** ‼️: 61 to 90 days
  - **Black** ⛔️: 91 days or more, with a notice to contact a local immigration lawyer who knows Schengen overstay laws
- Entry and departure days both count. Overlapping trips are counted once.
- Pick a future check date to plan an upcoming trip.
- Pick a color scheme from any Schengen country's flag with the palette button in the upper right corner.
- Switch between light and dark mode with the button in the upper right corner. The page follows the device setting until a visitor picks one.
- A map of the Schengen Area shades each country you add to a trip in Europe blue. Download the map as PNG, JPG, or SVG.
- Export your record as CSV (spreadsheet), JSON (data), or TXT (plain text). The file is created in the browser and never uploaded.
- Trips are saved in the browser with `localStorage`. Nothing is sent to a server.
- Installable as a home screen app. Chrome, Edge, and Android show an Install button. iPhone and iPad show the Share > Add to Home Screen steps. The installed app also works offline.

## Running

No build step is needed. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

## Map

The Europe map is inline SVG built from Natural Earth data (via the `world-atlas` package). To rebuild it:

```bash
cd tools && npm install && node build-map.js
```

Then replace the SVG between the `MAP START` and `MAP END` comments in `index.html` with `tools/europe-map.svg`.

## Tests

```bash
node --test tests/calc.test.js
```

This tool provides general information only and is not legal advice.
