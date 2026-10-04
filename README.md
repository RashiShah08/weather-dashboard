# WeatherDash - Interactive Weather & Forecast Dashboard

A dark, editorial weather dashboard built with **vanilla HTML, CSS, and JavaScript** - no frameworks, no libraries, no build step. Powered by the free [Open-Meteo](https://open-meteo.com/) API (no key required).

![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-f7df1e) ![No dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

## Features

- **City search** - search by name (button or Enter), with popular-city quick chips and recent searches
- **Current conditions** - temperature, condition, feels-like, humidity, wind, and rain probability
- **5-day forecast** - day, high/low, condition icon, plus an amber temperature-trend chart
- **Cinematic backgrounds** - a distinct photo per weather type, with day/night variants that crossfade
- **Animated SVG weather icons** - hand-built, no icon library
- **Live states** - loading skeleton, friendly error handling, empty landing page
- **°C / °F toggle**, **"Use my location"** (geolocation), and **recent searches** (localStorage)
- **Fully responsive** from 375px to widescreen

## Tech

- `index.html` - semantic markup (`<header>`, `<main>`, `<section>`, `<output>`, `<template>`)
- `styles.css` - CSS Grid & Flexbox, custom properties, media queries, transitions
- `app.js` - ES6+ with `fetch` + `async/await`, organized into a small API service, render functions, and controllers

### Backend (API service)

Two simple Open-Meteo endpoints, with every request wrapped in `try/catch`:

1. **Geocoding** - city name → latitude / longitude
2. **Forecast** - coordinates → current conditions + 5-day daily data

## Run it

No build needed - just open the file:

```
open index.html      # macOS
start index.html     # Windows
```

Or serve it locally:

```
python -m http.server 5500
# then visit http://localhost:5500
```

## Credits

- Weather data: [Open-Meteo](https://open-meteo.com/)
- Photography: [Unsplash](https://unsplash.com/)
