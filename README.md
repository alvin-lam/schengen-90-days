# Schengen 90/180 Calculator

A small static web app that counts how many days a traveler spent in the Schengen Area during the 180 days ending on a chosen date (today by default).

## Features

- Add any number of trips, each with a Schengen country, an entry date, and a departure date. The country list shows the English name, the native name, and the flag, for example "Germany | Deutschland | 🇩🇪".
- Running total of days in the Schengen Area, shown in color:
  - **Green** ✅: 0 to 45 days
  - **Yellow** ⚠️: 46 to 60 days
  - **Red** ‼️: 61 to 90 days
  - **Black** ⛔️: 91 days or more, with a notice to contact a local immigration lawyer who knows Schengen overstay laws
- Entry and departure days both count. Overlapping trips are counted once.
- Pick a future check date to plan an upcoming trip.
- Trips are saved in the browser with `localStorage`. Nothing is sent to a server.

## Running

No build step is needed. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

## Tests

```bash
node --test tests/calc.test.js
```

This tool provides general information only and is not legal advice.
