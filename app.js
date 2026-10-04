"use strict";

/* =========================================================================
   Weather Dashboard - vanilla JS
   Backend = two simple Open-Meteo endpoints (no API key, no signup):
     1. Geocoding : city name            -> latitude / longitude
     2. Forecast  : latitude / longitude -> current + daily weather
   ========================================================================= */

/* ---------- Config ---------- */
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const STORAGE_KEY = "weather-recent";

/* WMO weather codes -> { cat, text }. `cat` picks an animated SVG icon below.
   (https://open-meteo.com/en/docs) */
const WEATHER_CODES = {
  0:  { cat: "sun",     text: "Clear sky" },
  1:  { cat: "partly",  text: "Mainly clear" },
  2:  { cat: "partly",  text: "Partly cloudy" },
  3:  { cat: "cloud",   text: "Overcast" },
  45: { cat: "fog",     text: "Fog" },
  48: { cat: "fog",     text: "Rime fog" },
  51: { cat: "drizzle", text: "Light drizzle" },
  53: { cat: "drizzle", text: "Drizzle" },
  55: { cat: "drizzle", text: "Heavy drizzle" },
  56: { cat: "drizzle", text: "Freezing drizzle" },
  57: { cat: "drizzle", text: "Freezing drizzle" },
  61: { cat: "rain",    text: "Light rain" },
  63: { cat: "rain",    text: "Rain" },
  65: { cat: "rain",    text: "Heavy rain" },
  66: { cat: "rain",    text: "Freezing rain" },
  67: { cat: "rain",    text: "Freezing rain" },
  71: { cat: "snow",    text: "Light snow" },
  73: { cat: "snow",    text: "Snow" },
  75: { cat: "snow",    text: "Heavy snow" },
  77: { cat: "snow",    text: "Snow grains" },
  80: { cat: "rain",    text: "Light showers" },
  81: { cat: "rain",    text: "Showers" },
  82: { cat: "rain",    text: "Violent showers" },
  85: { cat: "snow",    text: "Snow showers" },
  86: { cat: "snow",    text: "Heavy snow showers" },
  95: { cat: "thunder", text: "Thunderstorm" },
  96: { cat: "thunder", text: "Thunderstorm + hail" },
  99: { cat: "thunder", text: "Thunderstorm + hail" },
};
const describe = (code) => WEATHER_CODES[code] || { cat: "cloud", text: "Unknown" };

/* =========================================================================
   Animated SVG weather icons (pure inline SVG + SMIL animation, no deps).
   iconSVG(cat) returns an <svg> string; scales to its container via CSS.
   ========================================================================= */

/* Reusable fluffy cloud built from circles + a base pill */
const CLOUD = (fill = "#aebbe0") => `
  <g fill="${fill}">
    <circle cx="24" cy="40" r="9"/>
    <circle cx="37" cy="37" r="12"/>
    <circle cx="47" cy="41" r="8"/>
    <rect x="23" y="42" width="26" height="9" rx="4.5"/>
  </g>`;

/* Wrap any element group in a slow left-right drift */
const drift = (inner, dur = "6s") => `
  <g>${inner}
    <animateTransform attributeName="transform" type="translate"
      values="-1.5 0; 1.5 0; -1.5 0" dur="${dur}" repeatCount="indefinite"/>
  </g>`;

/* 8 sun rays in a group that rotates forever */
const SUN_RAYS = `
  <g stroke="#ffd166" stroke-width="3" stroke-linecap="round">
    <animateTransform attributeName="transform" type="rotate"
      from="0 32 32" to="360 32 32" dur="22s" repeatCount="indefinite"/>
    ${[0, 45, 90, 135, 180, 225, 270, 315]
      .map((a) => `<line x1="32" y1="3" x2="32" y2="10" transform="rotate(${a} 32 32)"/>`)
      .join("")}
  </g>`;

/* Falling precipitation generator (staggered drops / flakes) */
const precip = (n, make) =>
  Array.from({ length: n }, (_, i) => make(24 + i * 8, (i * (1.1 / n)).toFixed(2))).join("");

const drops = (color, n) =>
  precip(n, (x, begin) => `
    <line x1="${x}" y1="50" x2="${x}" y2="56" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0">
      <animate attributeName="opacity" values="0;1;0" dur="1.1s" begin="${begin}s" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" type="translate" values="0 -5; 0 8" dur="1.1s" begin="${begin}s" repeatCount="indefinite"/>
    </line>`);

const flakes = (n) =>
  precip(n, (x, begin) => `
    <circle cx="${x}" cy="50" r="2.4" fill="#eaf6ff" opacity="0">
      <animate attributeName="cy" values="50;61" dur="2.4s" begin="${begin}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="${begin}s" repeatCount="indefinite"/>
    </circle>`);

const ICONS = {
  sun: () => `${SUN_RAYS}<circle cx="32" cy="32" r="11" fill="#ffd166"/>`,
  partly: () => `
    <circle cx="25" cy="24" r="9" fill="#ffd166"/>
    ${drift(CLOUD())}`,
  cloud: () => drift(CLOUD()),
  fog: () => `
    ${drift(CLOUD())}
    <g stroke="#dbe7f5" stroke-width="3" stroke-linecap="round">
      <line x1="18" y1="54" x2="46" y2="54">
        <animateTransform attributeName="transform" type="translate" values="-2 0;2 0;-2 0" dur="4s" repeatCount="indefinite"/>
      </line>
      <line x1="21" y1="60" x2="43" y2="60">
        <animateTransform attributeName="transform" type="translate" values="2 0;-2 0;2 0" dur="5s" repeatCount="indefinite"/>
      </line>
    </g>`,
  drizzle: () => `${drift(CLOUD())}${drops("#9bd6ff", 3)}`,
  rain: () => `${drift(CLOUD())}${drops("#6fc3ff", 4)}`,
  snow: () => `${drift(CLOUD())}${flakes(4)}`,
  thunder: () => `
    ${drift(CLOUD("#9aa6c8"))}
    <polygon points="31,44 25,56 31,56 27,64 40,50 33,50 37,44" fill="#ffd166">
      <animate attributeName="opacity" values="1;0.25;1;0.6;1" dur="1.8s" repeatCount="indefinite"/>
    </polygon>`,
};

function iconSVG(cat) {
  const build = ICONS[cat] || ICONS.cloud;
  return `<svg viewBox="0 0 64 64" class="wx wx--${cat}" role="img" xmlns="http://www.w3.org/2000/svg">${build()}</svg>`;
}

/* ---------- DOM references ---------- */
const dom = {
  bg: document.getElementById("bg"),
  sky: document.getElementById("sky"),
  form: document.getElementById("search-form"),
  input: document.getElementById("search-input"),
  homeForm: document.getElementById("home-form"),
  homeInput: document.getElementById("home-input"),
  geoChip: document.getElementById("geo-chip"),
  unitC: document.getElementById("unit-c"),
  unitF: document.getElementById("unit-f"),
  recent: document.getElementById("recent"),
  loader: document.getElementById("loader"),
  error: document.getElementById("error"),
  home: document.getElementById("home"),
  dashboard: document.getElementById("dashboard"),
  // results fields
  date: document.getElementById("date"),
  headline: document.getElementById("headline"),
  edCountry: document.getElementById("ed-country"),
  curIcon: document.getElementById("cur-icon"),
  curTemp: document.getElementById("cur-temp"),
  curDesc: document.getElementById("cur-desc"),
  feels: document.getElementById("feels"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  precip: document.getElementById("precip"),
  precipSide: document.getElementById("precip-side"),
  windSide: document.getElementById("wind-side"),
  spark: document.getElementById("spark"),
  chart: document.getElementById("chart"),
  aboutCity: document.getElementById("about-city"),
  aboutText: document.getElementById("about-text"),
  frameTemp: document.getElementById("frame-temp"),
  frameCity: document.getElementById("frame-city"),
  frameYear: document.getElementById("frame-year"),
  forecastGrid: document.getElementById("forecast-grid"),
  cardTemplate: document.getElementById("forecast-card"),
};

/* ---------- App state ---------- */
const state = {
  unit: "celsius",      // "celsius" | "fahrenheit"
  lastData: null,       // cached last successful response (for unit re-render)
  lastPlace: "",        // label of last location
  lastCoords: null,     // { lat, lon } of last location (for unit re-fetch)
};

/* =========================================================================
   API service - the "backend". Each function does one thing and throws a
   friendly Error on failure so the caller's try/catch can show a message.
   ========================================================================= */

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Service error (${res.status}). Please try again.`);
  return res.json();
}

/** City name -> { lat, lon, label } */
async function geocode(city) {
  const url = `${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const data = await getJSON(url);
  if (!data.results || data.results.length === 0) {
    throw new Error(`Couldn't find "${city}". Check the spelling and try again.`);
  }
  const place = data.results[0];
  const label = [place.name, place.admin1, place.country]
    .filter(Boolean)
    .join(", ");
  return { lat: place.latitude, lon: place.longitude, label };
}

/** lat/lon -> raw forecast payload (current + 5-day daily) */
async function getForecast(lat, lon, unit) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: unit,
    wind_speed_unit: unit === "fahrenheit" ? "mph" : "kmh",
    timezone: "auto",
    forecast_days: 5,
  });
  return getJSON(`${FORECAST_URL}?${params}`);
}

/** Full lookup by city name */
async function lookupByCity(city) {
  const { lat, lon, label } = await geocode(city);
  const data = await getForecast(lat, lon, state.unit);
  return { data, label, lat, lon };
}

/* =========================================================================
   UI rendering
   ========================================================================= */

function render(data, label) {
  state.lastData = data;
  state.lastPlace = label;

  const deg = "°";
  const unitSymbol = state.unit === "fahrenheit" ? "°F" : "°C";
  const windUnit = state.unit === "fahrenheit" ? "mph" : "km/h";
  const cur = data.current;
  const info = describe(cur.weather_code);
  const rainProb = data.daily.precipitation_probability_max?.[0] ?? 0;
  const city = label.split(",")[0];
  const region = label.split(",").slice(1).join(",").trim();

  // ---- left panel ----
  dom.curTemp.textContent = `${Math.round(cur.temperature_2m)}${deg}`;
  dom.curIcon.innerHTML = iconSVG(info.cat);
  dom.precipSide.textContent = `${rainProb}%`;
  dom.windSide.textContent = `${Math.round(cur.wind_speed_10m)} ${windUnit}`;
  dom.feels.textContent = `${Math.round(cur.apparent_temperature)}${deg}`;
  dom.humidity.textContent = `${cur.relative_humidity_2m}%`;
  dom.wind.textContent = `${Math.round(cur.wind_speed_10m)} ${windUnit}`;
  dom.precip.textContent = `${rainProb}%`;
  dom.aboutCity.textContent = city;
  dom.aboutText.textContent = describeSentence(info, cur, rainProb, windUnit);
  drawSpark(data.daily.temperature_2m_max);

  // ---- editorial main ----
  dom.edCountry.textContent = region || "Current Weather";
  dom.headline.innerHTML = HEADLINES[info.cat] || info.text;
  dom.date.textContent = formatDateTime(cur.time, label);
  dom.curDesc.textContent = describeSentence(info, cur, rainProb, windUnit);

  // ---- forecast strip + chart ----
  renderForecast(data.daily, deg);
  drawChart(data.daily.temperature_2m_max);

  // ---- frame labels ----
  dom.frameTemp.textContent = `${Math.round(cur.temperature_2m)}${unitSymbol}`;
  dom.frameCity.textContent = `${city} Weather`;

  // theme
  applyTheme(info.cat, cur.is_day === 1);
  showOnly(dom.dashboard);
}

/* A natural-language summary sentence for the paragraph areas */
function describeSentence(info, cur, rainProb, windUnit) {
  return `${info.text} with a ${rainProb}% chance of rain. ` +
    `Winds around ${Math.round(cur.wind_speed_10m)} ${windUnit}, ` +
    `feeling like ${Math.round(cur.apparent_temperature)}°, humidity at ${cur.relative_humidity_2m}%.`;
}

function renderForecast(daily, deg) {
  dom.forecastGrid.replaceChildren();
  daily.time.forEach((isoDate, i) => {
    const col = dom.cardTemplate.content.cloneNode(true);
    const info = describe(daily.weather_code[i]);
    const day = new Date(isoDate + "T00:00").toLocaleDateString(undefined, { weekday: "short" });

    col.querySelector(".fcol__icon").innerHTML = iconSVG(info.cat);
    col.querySelector(".fcol__day").textContent = i === 0 ? "Today" : day;
    col.querySelector(".fcol__hi").textContent = `${Math.round(daily.temperature_2m_max[i])}${deg}`;
    col.querySelector(".fcol__lo").textContent = `${Math.round(daily.temperature_2m_min[i])}${deg}`;

    // amber bar scaled across the 5-day high range
    const highs = daily.temperature_2m_max;
    const min = Math.min(...highs), max = Math.max(...highs);
    const pct = max === min ? 100 : 25 + ((highs[i] - min) / (max - min)) * 75;
    col.querySelector(".fcol__bar-fill").style.width = `${pct}%`;
    dom.forecastGrid.appendChild(col);
  });
}

/* "2026-10-04T14:30" + label -> "Iceland · Sunday, Oct 4, 12:15" */
function formatDateTime(isoLocal, label) {
  const country = (label || "").split(",").pop().trim();
  const d = isoLocal ? new Date(isoLocal) : new Date();
  const day = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const time = isoLocal ? isoLocal.slice(11, 16) : "";
  return [country, `${day}${time ? ", " + time : ""}`].filter(Boolean).join(" · ");
}

/* ---------- Mini sparkline (viewBox 0 0 220 60) ---------- */
function drawSpark(values) {
  const pts = normalizePoints(values, 220, 56, 2);
  dom.spark.innerHTML =
    `<polyline fill="none" stroke="#ff8c42" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
       points="${pts.map((p) => `${p.x},${p.y}`).join(" ")}" />` +
    pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.4" fill="#ffbe7a" />`).join("");
}

/* ---------- Big trend chart (viewBox 0 0 1000 180) ---------- */
function drawChart(values) {
  const w = 1000, h = 180, pad = 26;
  const pts = normalizePoints(values, w, h, pad);
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x},${h} L ${pts[0].x},${h} Z`;
  dom.chart.innerHTML = `
    <defs>
      <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ff8c42" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#ff8c42" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#fill)"/>
    <path d="${line}" fill="none" stroke="#ff8c42" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#0d0e11" stroke="#ffbe7a" stroke-width="2.5"/>`).join("")}`;
}

/* evenly spaced points, y inverted, scaled into [pad, size-pad] */
function normalizePoints(values, w, h, pad) {
  const min = Math.min(...values), max = Math.max(...values);
  const span = max === min ? 1 : max - min;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => ({
    x: pad + i * step,
    y: pad + (1 - (v - min) / span) * (h - pad * 2),
  }));
}

/* Catmull-Rom -> cubic Bezier for a smooth wave */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/* =========================================================================
   Dynamic theme + animated sky.
   Picks a gradient (day/night variant) from the weather category, then
   renders a matching full-screen particle scene (rain, snow, sun, stars…)
   that crossfades smoothly over the previous one.
   ========================================================================= */

/* Dark cinematic photos, per weather category + day/night */
const PHOTO = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=2400&q=85`;
const HOME_PHOTO = PHOTO("1601297183305-6df142704ea2"); // bright clear sky
const PHOTOS = {
  sun:     { day: PHOTO("1592210454359-9043f067919b"), night: PHOTO("1419242902214-272b3f66ee7a") }, // clear / starry
  partly:  { day: PHOTO("1501630834273-4b5604d2ee31"), night: PHOTO("1507400492013-162706c8c05e") }, // dramatic / night sky
  cloud:   { day: PHOTO("1594156596782-656c93e4d504"), night: PHOTO("1499956827185-0d63ee78a910") }, // soft grey overcast / overcast dusk
  fog:     { day: PHOTO("1485236715568-ddc5ee6ca227"), night: PHOTO("1487621167305-5d248087c724") }, // misty / foggy dusk
  drizzle: { day: PHOTO("1515694346937-94d85e41e6f0"), night: PHOTO("1534274867514-d5b47ef89ed7") }, // soft rain / night rain
  rain:    { day: PHOTO("1428592953211-077101b2021b"), night: PHOTO("1534274867514-d5b47ef89ed7") }, // rain on glass / night rain
  snow:    { day: PHOTO("1491002052546-bf38f186af56"), night: PHOTO("1457269449834-928af64c684d") }, // snowfall / night snow
  thunder: { day: PHOTO("1605727216801-e27ce1d0cc28"), night: PHOTO("1605727216801-e27ce1d0cc28") }, // storm
};

/* Editorial headlines per weather category (big magazine statement) */
const HEADLINES = {
  sun:     "Clear skies<br><em>all the way</em>",
  partly:  "Sun breaks<br><em>through cloud</em>",
  cloud:   "A blanket<br><em>of cloud</em>",
  fog:     "Fog rolls<br><em>softly in</em>",
  drizzle: "A fine<br><em>drizzle falls</em>",
  rain:    "Rain sweeps<br><em>across the sky</em>",
  snow:    "Snowfall<br><em>settles in</em>",
  thunder: "Storm with<br><em>heavy rain</em>",
};

const rand = (min, max) => min + Math.random() * (max - min);

/* --- Precipitation particle overlays (sit on top of the photo) --- */
const rainBg = (n, speedMin, speedMax) =>
  Array.from({ length: n }, () =>
    `<span class="sky-drop" style="left:${rand(0, 100)}%;
      animation-duration:${rand(speedMin, speedMax).toFixed(2)}s;
      animation-delay:${(-rand(0, 1)).toFixed(2)}s"></span>`
  ).join("");

const snowBg = (n) =>
  Array.from({ length: n }, () =>
    `<span class="sky-flake" style="left:${rand(0, 100)}%;
      --d:${rand(6, 12).toFixed(1)}s;
      animation-delay:${(-rand(0, 10)).toFixed(2)}s;
      --sz:${rand(3, 7).toFixed(1)}px;
      opacity:${rand(0.4, 0.9).toFixed(2)}"></span>`
  ).join("");

const fogBg = () =>
  Array.from({ length: 3 }, (_, i) =>
    `<div class="sky-fog" style="top:${20 + i * 25}%;
      animation-duration:${rand(25, 45).toFixed(0)}s;
      animation-delay:${(-rand(0, 20)).toFixed(0)}s"></div>`
  ).join("");

const flash = () => `<div class="sky-flash"></div>`;

/* Particle overlay for a category (photo supplies sun/clouds/stars) */
function buildScene(cat) {
  switch (cat) {
    case "fog":     return fogBg();
    case "drizzle": return rainBg(40, 0.9, 1.4);
    case "rain":    return rainBg(70, 0.5, 0.9);
    case "snow":    return snowBg(55);
    case "thunder": return rainBg(60, 0.5, 0.8) + flash();
    default:        return ""; // sun / partly / cloud -> photo only
  }
}

/* Crossfade a layer into a container, fading out the previous ones.
   `kind` picks the CSS class pair: "bg" (photo) or "scene" (particles). */
function crossfade(container, layer, kind) {
  const outClass = `${kind}--out`, inClass = `${kind}--in`;
  Array.from(container.children).forEach((old) => {
    if (old.classList.contains(outClass)) return;
    old.classList.add(outClass);
    setTimeout(() => old.remove(), 1300);
  });
  container.appendChild(layer);
  requestAnimationFrame(() => layer.classList.add(inClass));
}

/* Load a photo into the background (preloaded, then crossfaded) */
function setBackground(src) {
  const img = new Image();
  img.onload = () => {
    const layer = document.createElement("div");
    layer.className = "bg__layer";
    layer.style.backgroundImage = `url("${src}")`;
    crossfade(dom.bg, layer, "bg__layer");
  };
  img.src = src;
}

function applyTheme(cat, isDay) {
  document.body.dataset.night = String(!isDay);
  setBackground((PHOTOS[cat] || PHOTOS.cloud)[isDay ? "day" : "night"]);

  const scene = document.createElement("div");
  scene.className = "scene";
  scene.innerHTML = buildScene(cat);
  crossfade(dom.sky, scene, "scene");
}

/* ---------- State / view switching ---------- */
function setView(view) {
  document.body.classList.toggle("is-home", view === "home");
  document.body.classList.toggle("is-result", view === "result");
}

function showOnly(el) {
  [dom.home, dom.loader, dom.error, dom.dashboard].forEach((n) => {
    n.hidden = n !== el;
  });
}

function showHome() { setView("home"); showOnly(dom.home); }
function showLoading() { setView("result"); showOnly(dom.loader); }

function showError(message) {
  setView("result");
  dom.error.textContent = `⚠️ ${message}`;
  showOnly(dom.error);
}

/* =========================================================================
   Recent searches (localStorage)
   ========================================================================= */

function getRecents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecent(label) {
  const recents = getRecents().filter((c) => c.toLowerCase() !== label.toLowerCase());
  recents.unshift(label);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recents.slice(0, 5)));
  } catch { /* storage unavailable - ignore */ }
  renderRecents();
}

function renderRecents() {
  const recents = getRecents();
  dom.recent.replaceChildren();
  dom.recent.hidden = recents.length === 0;
  recents.forEach((label) => {
    const chip = document.createElement("button");
    chip.className = "recent__chip";
    chip.type = "button";
    chip.textContent = label;
    chip.addEventListener("click", () => search(label));
    dom.recent.appendChild(chip);
  });
}

/* =========================================================================
   Controllers
   ========================================================================= */

async function search(city) {
  const query = city.trim();
  if (!query) {
    // On the landing page, just nudge the big search instead of an error screen.
    if (document.body.classList.contains("is-home")) { dom.homeInput.focus(); return; }
    showError("Please enter a city name to search.");
    return;
  }
  dom.input.value = query;
  dom.homeInput.value = query;
  showLoading();
  try {
    const { data, label, lat, lon } = await lookupByCity(query);
    state.lastCoords = { lat, lon };
    render(data, label);
    saveRecent(label);
  } catch (err) {
    showError(err.message || "Something went wrong. Please try again.");
  }
}

async function searchByCoords(lat, lon) {
  showLoading();
  try {
    const data = await getForecast(lat, lon, state.unit);
    state.lastCoords = { lat, lon };
    render(data, "Your location");
  } catch (err) {
    showError(err.message || "Couldn't load weather for your location.");
  }
}

function useGeolocation() {
  if (!navigator.geolocation) {
    showError("Geolocation isn't supported by your browser.");
    return;
  }
  showLoading();
  navigator.geolocation.getCurrentPosition(
    (pos) => searchByCoords(pos.coords.latitude, pos.coords.longitude),
    () => showError("Location access was denied. Try searching by city instead.")
  );
}

function setUnit(unit) {
  if (unit === state.unit) return;
  state.unit = unit;
  dom.unitC.classList.toggle("is-active", unit === "celsius");
  dom.unitF.classList.toggle("is-active", unit === "fahrenheit");
  dom.unitC.setAttribute("aria-pressed", String(unit === "celsius"));
  dom.unitF.setAttribute("aria-pressed", String(unit === "fahrenheit"));
  // Re-fetch in the new unit (keeps temperature + wind units consistent).
  // Uses stored coordinates so it works for both city and geolocation searches.
  if (state.lastCoords) {
    const { lat, lon } = state.lastCoords;
    const place = state.lastPlace;
    showLoading();
    getForecast(lat, lon, state.unit)
      .then((data) => render(data, place))
      .catch((err) => showError(err.message || "Couldn't switch units. Please try again."));
  }
}

/* ---------- Event listeners ---------- */
dom.form.addEventListener("submit", (e) => { e.preventDefault(); search(dom.input.value); });
dom.homeForm.addEventListener("submit", (e) => { e.preventDefault(); search(dom.homeInput.value); });

dom.geoChip.addEventListener("click", useGeolocation);
dom.unitC.addEventListener("click", () => setUnit("celsius"));
dom.unitF.addEventListener("click", () => setUnit("fahrenheit"));

// Popular-city quick chips (event delegation)
document.querySelector(".chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (chip) search(chip.dataset.city);
});

// Frame label: current year
dom.frameYear.textContent = `Live · ${new Date().getFullYear()}`;

/* ---------- Init ---------- */
setBackground(HOME_PHOTO);   // cinematic hero photo on the landing page
renderRecents();
showHome();
