# 🌤️ Weather App

A clean, responsive weather app built with vanilla HTML, CSS, and JavaScript. Search any city to see current conditions, a 5-day forecast, and local time — no framework, no build step, no backend.

![Made with](https://img.shields.io/badge/stack-HTML%20%7C%20CSS%20%7C%20JS-blue)
![API](https://img.shields.io/badge/API-OpenWeatherMap-orange)

---

## Features

- 🔍 City search with de-duplicated autocomplete suggestions
- 🌡️ Current temperature, condition, humidity, wind speed, and precipitation
- 📅 5-day forecast with animated weather icons
- 🕐 Local time display for the searched city, based on its timezone offset
- 🎨 Smooth condition-based icon animations (sun spin, cloud float, rain/snow fall)
- 📱 Responsive layout — works on desktop and mobile

---

## Demo

Open `weatherapp.html` in a browser after setup (see below), search a city like `London` or `Mumbai`, and pick a match from the suggestions dropdown.

---

## Setup

### 1. Get a free API key

1. Sign up at [openweathermap.org](https://openweathermap.org/)
2. Go to **My Account → API Keys**
3. Copy your key — note it can take a few minutes to activate after creation

### 2. Add your API key

Copy the example config and add your real key to it:

```bash
cp config.example.js config.js
```

Then open `config.js` and paste in your key:

```js
const CONFIG = {
    API_KEY: 'your_real_key_here'
};
```

> `config.js` is git-ignored, so your key never gets committed. Never put a real key in `config.example.js`.

### 3. Run the app

No build step needed — just open `weatherapp.html` directly in a browser.

> **Tip:** To avoid CORS quirks with some browsers, serve it locally instead:
> ```bash
> npx serve .
> # or
> python3 -m http.server 8080
> ```
> Then visit `http://localhost:8080/weatherapp.html`

---

## File Structure

```
├── weatherapp.html     # Main HTML file
├── style.css            # Styles and animations
├── script.js            # App logic and API calls
├── config.example.js    # Template for your API key (safe to commit)
├── config.js            # Your real API key (git-ignored, create this yourself)
├── .gitignore
└── README.md
```

---

## How it works

- **Search** — as you type (3+ characters), the app debounces requests to OpenWeatherMap's Geocoding API and shows up to 5 unique city matches.
- **Weather data** — selecting a city (or hitting Search/Enter) fetches current conditions and a 5-day/3-hour forecast, which is grouped client-side into daily min/max summaries.
- **Local time** — each city's UTC offset is used to keep the displayed date/time accurate to that location, updating every minute.

---

## ⚠️ Keep your API key private

**Never commit a real API key to a public repository.** This project keeps secrets out of git via:

- `config.js` holding the real key, listed in `.gitignore`
- `config.example.js` as a placeholder template that's safe to share

If a real key is ever accidentally committed, treat it as compromised — regenerate it from your OpenWeatherMap account rather than just removing it from a later commit (it will still exist in git history).

---

## API Used

- [OpenWeatherMap Current Weather API](https://openweathermap.org/current)
- [OpenWeatherMap 5-Day Forecast API](https://openweathermap.org/forecast5)
- [OpenWeatherMap Geocoding API](https://openweathermap.org/api/geocoding-api)

---

## Known limitations

- Free-tier OpenWeatherMap keys are rate-limited; heavy search typing can hit that limit.
- The Geocoding API occasionally returns near-duplicate entries for the same place; the app de-duplicates by name/state/country before displaying suggestions.