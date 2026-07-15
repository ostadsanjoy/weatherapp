const API_KEY = CONFIG.API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5/';
const GEOCODING_BASE_URL = 'https://api.openweathermap.org/geo/1.0/';

const TABS_STORAGE_KEY = 'weatherapp_tabs';
const ACTIVE_STORAGE_KEY = 'weatherapp_active';
const UNIT_STORAGE_KEY = 'weatherapp_unit';
const MAX_TABS = 6;

let currentLocationTimezoneOffsetSeconds = 0;
let currentSunriseUnix = null;
let currentSunsetUnix = null;
let temperatureUnit = localStorage.getItem(UNIT_STORAGE_KEY) === 'F' ? 'F' : 'C';
let cityTabs = [];
let cityCache = {};
let activeCityKey = null;

function loadPersistedTabs() {
    try {
        const stored = JSON.parse(localStorage.getItem(TABS_STORAGE_KEY));
        if (Array.isArray(stored) && stored.length > 0) {
            return stored;
        }
    } catch (e) {
        // ignore malformed storage
    }
    return [{ key: 'London|GB', query: 'London,GB', label: 'London, GB' }];
}

function persistTabs() {
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(cityTabs));
    if (activeCityKey) {
        localStorage.setItem(ACTIVE_STORAGE_KEY, activeCityKey);
    }
}

function toCityLocalDate(unixSeconds, offsetSeconds) {
    const cancelledMs = (unixSeconds * 1000) + (new Date().getTimezoneOffset() * 60000);
    return new Date(cancelledMs + (offsetSeconds * 1000));
}

function degreesToCompass(deg) {
    if (deg === undefined || deg === null) return '--';
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(deg / 22.5) % 16;
    return directions[index];
}

function getWeatherIcon(iconCode) {
    if (!iconCode) return '❓';
    const isNight = iconCode.endsWith('n');
    switch (iconCode.substring(0, 2)) {
        case '01': return isNight ? '🌙' : '☀️';
        case '02': return '🌤️';
        case '03': return '☁️';
        case '04': return '☁️';
        case '09': return '🌧️';
        case '10': return '🌧️';
        case '11': return '⛈️';
        case '13': return '❄️';
        case '50': return '🌫️';
        default: return '❓';
    }
}

function formatTemp(celsius) {
    if (temperatureUnit === 'F') {
        return `${Math.round((celsius * 9 / 5) + 32)}°F`;
    }
    return `${Math.round(celsius)}°`;
}

function updateSunPosition() {
    const marker = document.getElementById('sun-marker');
    if (!marker || currentSunriseUnix === null || currentSunsetUnix === null) return;

    const nowUnix = Date.now() / 1000;
    const daylightSpan = currentSunsetUnix - currentSunriseUnix;
    let percent = ((nowUnix - currentSunriseUnix) / daylightSpan) * 100;
    const isDaytime = percent >= 0 && percent <= 100;
    percent = Math.max(0, Math.min(100, percent));

    marker.style.left = `${percent}%`;
    marker.textContent = isDaytime ? '☀️' : '🌙';
}

function updateDateTime(offsetSeconds = 0) {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const targetMs = utcMs + (offsetSeconds * 1000);
    const targetDate = new Date(targetMs);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    document.getElementById('date-time').textContent = targetDate.toLocaleDateString('en-US', options);
}

setInterval(() => {
    updateDateTime(currentLocationTimezoneOffsetSeconds);
    updateSunPosition();
}, 60000);

const cityInput = document.getElementById('city-input');
const suggestionsContainer = document.getElementById('suggestions-container');
const locationDisplay = document.getElementById('location-display');
const weatherIcon = document.getElementById('weather-icon');
const temperature = document.getElementById('temperature');
const feelsLike = document.getElementById('feels-like');
const condition = document.getElementById('condition');
const humidity = document.getElementById('humidity');
const windSpeed = document.getElementById('wind-speed');
const windDirection = document.getElementById('wind-direction');
const precipitation = document.getElementById('precipitation');
const sunriseTime = document.getElementById('sunrise-time');
const sunsetTime = document.getElementById('sunset-time');
const forecastContainer = document.getElementById('forecast-container');
const hourlyContainer = document.getElementById('hourly-container');
const errorMessage = document.getElementById('error-message');
const cityTabsContainer = document.getElementById('city-tabs');
const unitCBtn = document.getElementById('unit-c-btn');
const unitFBtn = document.getElementById('unit-f-btn');

let debounceTimeout;

function setLoadingState() {
    locationDisplay.textContent = 'Loading...';
    weatherIcon.textContent = '';
    weatherIcon.className = 'weather-icon relative';
    temperature.textContent = '--°';
    feelsLike.textContent = '--°';
    condition.textContent = 'Fetching data...';
    condition.classList.add('loading-text');
    humidity.textContent = '--%';
    windSpeed.textContent = '-- km/h';
    windDirection.textContent = '--';
    precipitation.textContent = '-- mm';
    sunriseTime.textContent = '--:--';
    sunsetTime.textContent = '--:--';
    forecastContainer.innerHTML = '<p class="text-center text-teal-200 loading-text">Loading forecast...</p>';
    hourlyContainer.innerHTML = '<p class="text-center text-teal-200 loading-text px-2">Loading...</p>';
    errorMessage.classList.add('hidden');
}

function setErrorState(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    currentLocationTimezoneOffsetSeconds = 0;
    updateDateTime(currentLocationTimezoneOffsetSeconds);

    locationDisplay.textContent = 'City, Country';
    weatherIcon.textContent = '';
    weatherIcon.className = 'weather-icon relative';
    temperature.textContent = '--°';
    feelsLike.textContent = '--°';
    condition.textContent = 'Error';
    condition.classList.remove('loading-text');
    humidity.textContent = '--%';
    windSpeed.textContent = '-- km/h';
    windDirection.textContent = '--';
    precipitation.textContent = '-- mm';
    sunriseTime.textContent = '--:--';
    sunsetTime.textContent = '--:--';
    currentSunriseUnix = null;
    currentSunsetUnix = null;
    const marker = document.getElementById('sun-marker');
    if (marker) {
        marker.style.left = '0%';
        marker.textContent = '☀️';
    }
    forecastContainer.innerHTML = '<p class="text-center text-red-300">Failed to load forecast.</p>';
    hourlyContainer.innerHTML = '<p class="text-center text-red-300 px-2">Failed to load.</p>';
}

function renderWeatherUI(currentWeatherData, forecastData) {
    currentLocationTimezoneOffsetSeconds = currentWeatherData.timezone;
    updateDateTime(currentLocationTimezoneOffsetSeconds);

    locationDisplay.textContent = `${currentWeatherData.name}, ${currentWeatherData.sys.country}`;
    condition.classList.remove('loading-text');
    errorMessage.classList.add('hidden');

    const iconEmoji = getWeatherIcon(currentWeatherData.weather[0].icon);
    weatherIcon.textContent = iconEmoji;

    weatherIcon.className = 'weather-icon relative';
    if (iconEmoji === '☀️') {
        weatherIcon.classList.add('sunny');
    } else if (iconEmoji === '🌙') {
        weatherIcon.classList.add('moony');
    } else if (iconEmoji === '🌤️' || iconEmoji === '☁️') {
        weatherIcon.classList.add('cloudy');
    } else if (iconEmoji === '🌧️') {
        weatherIcon.classList.add('rainy');
    } else if (iconEmoji === '❄️') {
        weatherIcon.classList.add('snowy');
    }

    temperature.textContent = formatTemp(currentWeatherData.main.temp);
    feelsLike.textContent = formatTemp(currentWeatherData.main.feels_like);
    condition.textContent = currentWeatherData.weather[0].description;
    humidity.textContent = `${currentWeatherData.main.humidity}%`;
    windSpeed.textContent = `${(currentWeatherData.wind.speed * 3.6).toFixed(1)} km/h`;
    windDirection.textContent = degreesToCompass(currentWeatherData.wind.deg);
    const precipitationValue = (currentWeatherData.rain && currentWeatherData.rain['1h'] !== undefined) ? currentWeatherData.rain['1h'] :
                             (currentWeatherData.snow && currentWeatherData.snow['1h'] !== undefined) ? currentWeatherData.snow['1h'] : 0;
    precipitation.textContent = `${precipitationValue.toFixed(1)} mm`;

    const sunriseLocal = toCityLocalDate(currentWeatherData.sys.sunrise, currentWeatherData.timezone);
    const sunsetLocal = toCityLocalDate(currentWeatherData.sys.sunset, currentWeatherData.timezone);
    const sunTimeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    sunriseTime.textContent = sunriseLocal.toLocaleTimeString('en-US', sunTimeOptions);
    sunsetTime.textContent = sunsetLocal.toLocaleTimeString('en-US', sunTimeOptions);

    currentSunriseUnix = currentWeatherData.sys.sunrise;
    currentSunsetUnix = currentWeatherData.sys.sunset;
    updateSunPosition();

    forecastContainer.innerHTML = '';
    hourlyContainer.innerHTML = '';
    const dailyForecasts = {};

    forecastData.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateKey = date.toISOString().split('T')[0];

        if (!dailyForecasts[dateKey]) {
            dailyForecasts[dateKey] = {
                day: day,
                minTemp: item.main.temp,
                maxTemp: item.main.temp,
                conditions: [],
                icons: []
            };
        }
        dailyForecasts[dateKey].minTemp = Math.min(dailyForecasts[dateKey].minTemp, item.main.temp_min);
        dailyForecasts[dateKey].maxTemp = Math.max(dailyForecasts[dateKey].maxTemp, item.main.temp_max);
        dailyForecasts[dateKey].conditions.push(item.weather[0].description);
        dailyForecasts[dateKey].icons.push(item.weather[0].icon);
    });

    const nowReference = currentWeatherData.dt;
    const cityOffset = currentWeatherData.timezone;

    const hourlyItems = forecastData.list
        .filter(item => item.dt >= nowReference)
        .slice(0, 8); // 8 slots x 3 hours = next 24 hours

    if (hourlyItems.length === 0) {
        hourlyContainer.innerHTML = '<p class="text-teal-200 text-sm px-2">No hourly data available.</p>';
    } else {
        hourlyItems.forEach((item, index) => {
            const localTime = toCityLocalDate(item.dt, cityOffset);
            const timeLabel = index === 0
                ? 'Now'
                : localTime.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

            const hourlyItem = document.createElement('div');
            hourlyItem.className = 'hourly-item';
            hourlyItem.innerHTML = `
                <p class="hourly-time">${timeLabel}</p>
                <span class="hourly-icon">${getWeatherIcon(item.weather[0].icon)}</span>
                <p class="hourly-temp">${formatTemp(item.main.temp)}</p>
            `;
            hourlyContainer.appendChild(hourlyItem);
        });
    }

    const forecastDays = Object.keys(dailyForecasts)
        .sort()
        .slice(0, 5);

    forecastDays.forEach(dateKey => {
        const dayData = dailyForecasts[dateKey];
        const displayDay = dayData.day;

        const mostFrequentIcon = dayData.icons.reduce((a, b, i, arr) =>
            (arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b), dayData.icons[0]);

        const forecastItem = document.createElement('div');
        forecastItem.className = 'forecast-item p-5 rounded-lg flex items-center justify-between shadow-lg';
        forecastItem.innerHTML = `
            <p class="font-medium text-xl">${displayDay}</p>
            <span class="text-4xl">${getWeatherIcon(mostFrequentIcon)}</span>
            <p class="text-xl">${formatTemp(dayData.maxTemp)} / ${formatTemp(dayData.minTemp)}</p>
        `;
        forecastContainer.appendChild(forecastItem);
    });
}

function renderTabs() {
    cityTabsContainer.innerHTML = '';

    cityTabs.forEach(tab => {
        const tabEl = document.createElement('div');
        tabEl.className = 'city-tab' + (tab.key === activeCityKey ? ' active' : '');
        tabEl.innerHTML = `<span class="tab-label">${tab.label}</span>${cityTabs.length > 1 ? '<span class="close-tab">✕</span>' : ''}`;

        tabEl.querySelector('.tab-label').addEventListener('click', () => switchToCity(tab.key));

        const closeBtn = tabEl.querySelector('.close-tab');
        if (closeBtn) {
            closeBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                closeTab(tab.key);
            });
        }
        cityTabsContainer.appendChild(tabEl);
    });

    if (cityTabs.length < MAX_TABS) {
        const addTabEl = document.createElement('div');
        addTabEl.className = 'city-tab add-tab';
        addTabEl.innerHTML = '<span>+ Add City</span>';
        addTabEl.addEventListener('click', () => {
            cityInput.value = '';
            suggestionsContainer.innerHTML = '';
            errorMessage.classList.add('hidden');
            cityInput.focus();
        });
        cityTabsContainer.appendChild(addTabEl);
    }
}

function switchToCity(key) {
    activeCityKey = key;
    persistTabs();
    renderTabs();

    const cached = cityCache[key];
    if (cached) {
        renderWeatherUI(cached.currentWeatherData, cached.forecastData);
    } else {
        const tab = cityTabs.find(t => t.key === key);
        if (tab) {
            fetchWeatherData(tab.query, key, tab.label);
        }
    }
}

function closeTab(key) {
    if (cityTabs.length <= 1) return;

    cityTabs = cityTabs.filter(t => t.key !== key);
    delete cityCache[key];

    if (activeCityKey === key) {
        const nextTab = cityTabs[0];
        switchToCity(nextTab.key);
    } else {
        persistTabs();
        renderTabs();
    }
}

async function getCitySuggestions(query) {
    if (query.length < 3) {
        suggestionsContainer.innerHTML = '';
        return;
    }

    try {
        const response = await fetch(`${GEOCODING_BASE_URL}direct?q=${encodeURIComponent(query)}&limit=20&appid=${API_KEY}`);
        if (!response.ok) {
            throw new Error(`Error fetching city suggestions: ${response.statusText}`);
        }
        const data = await response.json();
        displaySuggestions(data);
    } catch (error) {
        console.error('Error getting city suggestions:', error);
        suggestionsContainer.innerHTML = '';
    }
}

function displaySuggestions(cities) {
    suggestionsContainer.innerHTML = '';

    if (cities.length === 0) {
        return;
    }

    const seen = new Set();
    const uniqueCities = [];
    for (const city of cities) {
        const key = [city.name, city.state || '', city.country || ''].join('|').toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            uniqueCities.push(city);
        }
    }
    const citiesToShow = uniqueCities.slice(0, 5);

    citiesToShow.forEach(city => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';
        let displayName = city.name;
        if (city.state) {
            displayName += `, ${city.state}`;
        }
        if (city.country) {
            displayName += `, ${city.country}`;
        }
        suggestionItem.textContent = displayName;

        suggestionItem.addEventListener('click', () => {
            cityInput.value = displayName;
            suggestionsContainer.innerHTML = '';
            searchCity(displayName);
        });
        suggestionsContainer.appendChild(suggestionItem);
    });
}

async function fetchWeatherData(query, presetKey = null, presetLabel = null) {
    setLoadingState();

    try {
        const currentWeatherResponse = await fetch(`${BASE_URL}weather?q=${encodeURIComponent(query)}&appid=${API_KEY}&units=metric`);
        if (!currentWeatherResponse.ok) {
            if (currentWeatherResponse.status === 404) {
                throw new Error('City not found. Please check the spelling.');
            }
            throw new Error(`Error fetching current weather: ${currentWeatherResponse.statusText}`);
        }
        const currentWeatherData = await currentWeatherResponse.json();

        const forecastResponse = await fetch(`${BASE_URL}forecast?q=${encodeURIComponent(query)}&appid=${API_KEY}&units=metric`);
        if (!forecastResponse.ok) {
            throw new Error(`Error fetching forecast: ${forecastResponse.statusText}`);
        }
        const forecastData = await forecastResponse.json();

        const key = presetKey || `${currentWeatherData.name}|${currentWeatherData.sys.country}`;
        const label = presetLabel || `${currentWeatherData.name}, ${currentWeatherData.sys.country}`;

        cityCache[key] = { currentWeatherData, forecastData };

        if (!cityTabs.find(t => t.key === key)) {
            if (cityTabs.length >= MAX_TABS) {
                const removed = cityTabs.shift();
                delete cityCache[removed.key];
            }
            cityTabs.push({ key, query: `${currentWeatherData.name},${currentWeatherData.sys.country}`, label });
        }

        activeCityKey = key;
        persistTabs();
        renderTabs();
        renderWeatherUI(currentWeatherData, forecastData);
        cityInput.value = '';
        suggestionsContainer.innerHTML = '';

    } catch (error) {
        console.error('Error fetching weather data:', error);
        setErrorState(error.message);
    }
}

function searchCity(city) {
    fetchWeatherData(city);
}

function setTemperatureUnit(unit) {
    if (unit === temperatureUnit) return;
    temperatureUnit = unit;
    localStorage.setItem(UNIT_STORAGE_KEY, unit);

    unitCBtn.classList.toggle('active', unit === 'C');
    unitFBtn.classList.toggle('active', unit === 'F');

    const cached = activeCityKey && cityCache[activeCityKey];
    if (cached) {
        renderWeatherUI(cached.currentWeatherData, cached.forecastData);
    }
}

unitCBtn.addEventListener('click', () => setTemperatureUnit('C'));
unitFBtn.addEventListener('click', () => setTemperatureUnit('F'));

cityInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        getCitySuggestions(cityInput.value.trim());
    }, 300);
});

cityInput.addEventListener('blur', () => {
    setTimeout(() => {
        suggestionsContainer.innerHTML = '';
    }, 150);
});

document.getElementById('search-button').addEventListener('click', () => {
    const cityInputValue = cityInput.value.trim();
    if (cityInputValue) {
        searchCity(cityInputValue);
        suggestionsContainer.innerHTML = '';
    } else {
        errorMessage.textContent = 'Please enter a city name.';
        errorMessage.classList.remove('hidden');
    }
});

document.getElementById('city-input').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        document.getElementById('search-button').click();
    }
});

// --- Init ---
unitCBtn.classList.toggle('active', temperatureUnit === 'C');
unitFBtn.classList.toggle('active', temperatureUnit === 'F');

cityTabs = loadPersistedTabs();
const storedActiveKey = localStorage.getItem(ACTIVE_STORAGE_KEY);
activeCityKey = cityTabs.find(t => t.key === storedActiveKey) ? storedActiveKey : cityTabs[0].key;

renderTabs();
updateDateTime(currentLocationTimezoneOffsetSeconds);

const initialTab = cityTabs.find(t => t.key === activeCityKey);
fetchWeatherData(initialTab.query, initialTab.key, initialTab.label);