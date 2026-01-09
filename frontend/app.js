let currentCoords = null
let map, userMarker
let hotelMap, hotelLayer

/* DOM Elements */
const locationBlock = document.getElementById("locationBlock")
const weatherBlock = document.getElementById("weatherBlock")
const hotelsBlock = document.getElementById("hotelsBlock")

/* ===============================
   REVERSE GEOCODING
================================ */
async function getPlaceName(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
    )
    const data = await res.json()

    return {
      city: data.address.city || data.address.town || data.address.village || "",
      county: data.address.county || "",
      state: data.address.state || "",
      country: data.address.country || ""
    }
  } catch {
    return { city: "", county: "", state: "", country: "" }
  }
}

/* ===============================
   USER LOCATION MAP
================================ */
function showUserMap(lat, lon) {
  if (!map) {
    map = L.map("map").setView([lat, lon], 14)

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap"
    }).addTo(map)
  }

  if (userMarker) map.removeLayer(userMarker)

  userMarker = L.marker([lat, lon])
    .addTo(map)
    .bindPopup("Your Location")
    .openPopup()
}

/* ===============================
   GET LOCATION
================================ */
document.getElementById("getLocationBtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    locationBlock.innerHTML = "<p>Geolocation not supported.</p>"
    return
  }

  navigator.geolocation.getCurrentPosition(async pos => {
    currentCoords = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude
    }

    console.log("Location set:", currentCoords)

    const place = await getPlaceName(
      currentCoords.latitude,
      currentCoords.longitude
    )

    locationBlock.innerHTML = `
      <h3>Location Information</h3>
      <p><strong>City:</strong> ${place.city}</p>
      <p><strong>County:</strong> ${place.county}</p>
      <p><strong>State:</strong> ${place.state}</p>
      <p><strong>Country:</strong> ${place.country}</p>
      <p><strong>Latitude:</strong> ${currentCoords.latitude.toFixed(5)}</p>
      <p><strong>Longitude:</strong> ${currentCoords.longitude.toFixed(5)}</p>
    `

    showUserMap(currentCoords.latitude, currentCoords.longitude)

    document.getElementById("weatherBtn").disabled = false
    document.getElementById("hotelsBtn").disabled = false
  })
})

/* ===============================
   WEATHER
================================ */
document.getElementById("weatherBtn").addEventListener("click", async () => {
  if (!currentCoords) return

  try {
    const res = await fetch(
      `https://geolocate-qy66.onrender.com/api/weather?lat=${currentCoords.latitude}&lon=${currentCoords.longitude}`
    )

    if (!res.ok) throw new Error("Weather backend error")

    const data = await res.json()

    weatherBlock.innerHTML = `
      <h3>Weather Conditions</h3>
      <p><strong>Local Time:</strong> ${data.local_time}</p>
      <p><strong>Temperature:</strong> ${data.temperature} °C</p>
      <p><strong>Min Temperature:</strong> ${data.temp_min} °C</p>
      <p><strong>Max Temperature:</strong> ${data.temp_max} °C</p>
      <p><strong>Humidity:</strong> ${data.humidity}%</p>
      <p><strong>Wind Speed:</strong> ${data.wind_speed} m/s</p>
      <p><strong>Rain Probability:</strong> ${(data.rain_probability * 100).toFixed(0)}%</p>
      <p><strong>Condition:</strong> ${data.condition}</p>
    `
  } catch (err) {
    weatherBlock.innerHTML = "<p>Unable to retrieve weather data.</p>"
    console.error(err)
  }
})

/* ===============================
   HOTELS BUTTON – LEAFLET MAP VIEW
================================ */
const hotelsBtn = document.getElementById("hotelsBtn")
hotelsBtn.addEventListener("click", async () => {
  if (!currentCoords) {
    alert("Please get your location first")
    return
  }

  const userLat = currentCoords.latitude
  const userLon = currentCoords.longitude

  // Initialise hotel map if not already
  if (!hotelMap) {
    hotelMap = L.map("hotelMap").setView([userLat, userLon], 13)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(hotelMap)

    hotelLayer = L.layerGroup().addTo(hotelMap)

    // User location marker
    L.circleMarker([userLat, userLon], {
      radius: 8,
      color: "red",
      fillColor: "#f03",
      fillOpacity: 0.7,
    })
      .addTo(hotelLayer)
      .bindPopup("<strong>Your Location</strong>")
      .openPopup()
  }

  hotelLayer.clearLayers()

  // Show user location again after clearing
  L.circleMarker([userLat, userLon], {
    radius: 8,
    color: "red",
    fillColor: "#f03",
    fillOpacity: 0.7,
  })
    .addTo(hotelLayer)
    .bindPopup("<strong>Your Location</strong>")

  hotelsBlock.innerHTML = "<p>Loading nearby hotels...</p>"

  try {
    const res = await fetch(
      `https://geolocate-qy66.onrender.com/api/hotels?lat=${userLat}&lon=${userLon}`
    )
    const hotels = await res.json()

    if (!Array.isArray(hotels) || hotels.length === 0) {
      hotelsBlock.innerHTML = "<p>No nearby hotels found.</p>"
      return
    }

    hotelsBlock.innerHTML = "" // clear loading message

    hotels.forEach(hotel => {
      if (!hotel.lat || !hotel.lon) return

      // Colour code based on distance
      let color = "yellow" // default far 10-30 km
      const dist = parseFloat(hotel.distance)
      if (dist <= 5) color = "green" // close
      else if (dist <= 10) color = "blue" // moderate

      // Marker
      const marker = L.circleMarker([hotel.lat, hotel.lon], {
        radius: 6,
        color: color,
        fillColor: color,
        fillOpacity: 0.7,
      }).addTo(hotelLayer)

      // Popup with details and directions
      const popupContent = `
        <strong>${hotel.name}</strong><br/>
        <strong>Distance:</strong> ${hotel.distance} km<br/>
        <strong>Services:</strong><br/>
        Wi-Fi: ${hotel.services.wifi}<br/>
        Restaurant: ${hotel.services.restaurant}<br/>
        Parking: ${hotel.services.parking}<br/><br/>
        <a href="https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLon}&destination=${hotel.lat},${hotel.lon}"
           target="_blank">
           Get Directions
        </a>
      `
      marker.bindPopup(popupContent)
    })

    // Auto zoom to show all markers
    hotelMap.fitBounds(hotelLayer.getBounds(), { padding: [50, 50] })
  } catch (err) {
    console.error("Error fetching hotels:", err)
    hotelsBlock.innerHTML = "<p>Error loading hotels.</p>"
  }
})