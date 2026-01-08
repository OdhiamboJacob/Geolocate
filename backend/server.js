import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import axios from 'axios'

dotenv.config()

const app = express()
const PORT = 3000
const OVERPASS_SERVERS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter'
]

app.use(express.json())
app.use(cors())

/* ===============================
   WEATHER API (STABLE & FREE)
================================ */
app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query
  const API_KEY = process.env.OPENWEATHER_API_KEY

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Latitude and Longitude required' })
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'Weather API key not configured' })
  }

  try {
    const current = await axios.get(
      'https://api.openweathermap.org/data/2.5/weather',
      {
        params: {
          lat,
          lon,
          units: 'metric',
          appid: API_KEY
        }
      }
    )

    const forecast = await axios.get(
      'https://api.openweathermap.org/data/2.5/forecast',
      {
        params: {
          lat,
          lon,
          units: 'metric',
          appid: API_KEY
        }
      }
    )

    const today = forecast.data.list[0]

    res.json({
      temperature: current.data.main.temp,
      temp_min: current.data.main.temp_min,
      temp_max: current.data.main.temp_max,
      humidity: current.data.main.humidity,
      wind_speed: current.data.wind.speed,
      condition: current.data.weather[0].description,
      rain_probability: today.pop || 0,
      local_time: new Date(
        (current.data.dt + current.data.timezone) * 1000
      ).toLocaleTimeString()
    })
  } catch (error) {
    console.error('Weather API Error:', error.response?.data || error.message)
    res.status(500).json({ error: 'Weather service unavailable' })
  }
})

/* ===============================
   NEARBY HOTELS (GIS Query)
================================ */

import fetch from 'node-fetch'

/* ===============================
   DISTANCE CALCULATION (Haversine)
================================ */
function calculateDistance (lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2

  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2)
}

/* ===============================
   NEARBY HOTELS – REAL OSM DATA
================================ */
app.get('/api/hotels', async (req, res) => {
  try {
    const { lat, lon } = req.query
    console.log('Received coordinates:', lat, lon)

    if (!lat || !lon)
      return res.status(400).json({ error: 'Coordinates required' })

    const query = `
      [out:json][timeout:25];
      (
        node["tourism"~"hotel|guest_house|hostel"](around:3000,${lat},${lon});
      );
      out body;
    `

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'User-Agent': 'Geolocate-GIS-App'
      },
      body: query
    })

    if (!response.ok) {
      console.error('Overpass HTTP error:', response.status)
      return res.status(500).json({ error: 'Overpass service unavailable' })
    }

    const data = await response.json()
    console.log('Overpass data elements:', data.elements?.length)

    if (!data.elements || data.elements.length === 0) {
      console.warn('No hotels found for location:', lat, lon)
      return res.json([])
    }

    const hotels = data.elements.map(el => ({
      name: el.tags?.name || 'Unnamed Hotel',
      lat: el.lat,
      lon: el.lon,
      distance: calculateDistance(lat, lon, el.lat, el.lon),
      services: {
        wifi: el.tags?.internet_access ? 'Yes' : 'Unknown',
        restaurant: el.tags?.restaurant ? 'Yes' : 'Unknown',
        parking: el.tags?.parking ? 'Yes' : 'Unknown'
      }
    }))

    console.log(`Hotels returned: ${hotels.length}`)
    res.json(hotels)
  } catch (err) {
    console.error('HOTELS API FAILURE:', err)
    res.status(500).json({ error: 'Unable to retrieve nearby hotels' })
  }
})

/* ========================
    health check
======================== */

app.get('/', (req, res) => {
  res.send('Geolocate GIS Backend is running.')
})

// server start
app.listen(PORT, () => {
  console.log(`GIS Server running on http://localhost:${PORT}`)
})