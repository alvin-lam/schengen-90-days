# Roadmap

Planned work for the Schengen 90/180 Calculator, in suggested order.

## Owner tasks

These need the site owner's accounts or approval.

- [ ] **Confirm the GitHub Pages source.** Settings > Pages should publish from `prod`, so changes go live only after a merge is approved.
- [ ] **Submit the sitemap to search engines.** Add the site to [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters), then submit `https://90days.alltripsconsidered.com/sitemap.xml`.
- [ ] **Delete finished branches on GitHub.** Remove merged branches such as `restructure-data` at the repository's Branches page.

## Features

- [ ] **Import a saved record.** Let visitors load a JSON export back into the calculator, so trips survive clearing the browser or switching phones. This is the most important gap, since trips are otherwise stored only in one browser.
- [ ] **"Still in Schengen" option.** A checkbox on a trip that counts up to today and updates daily, so travelers in Europe do not have to guess a departure date.

## Quality and operations

- [ ] **Automatic test runs.** A GitHub Actions check that runs `node --test tests/calc.test.js` on every push, so a broken change is caught before it reaches `prod`.
- [ ] **Privacy-friendly visitor statistics.** Consider a cookie-free tool such as Plausible or GoatCounter to see how many people use the site and which features they use. Update `privacy.html` first to explain what is collected.

## Recurring

- [ ] **Review the Schengen rules every few months.** Check the member list (Cyprus is working toward joining), the Entry/Exit System, and related rules. Update `js/countries.js` if membership changes, and update the "Rules last checked" date in the footer of `index.html`.

## Done

- [x] Privacy page (`privacy.html`), linked from the footer
- [x] "Rules last checked" note explaining which countries are not included and the Entry/Exit System
