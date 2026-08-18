/**
 * Maps Module for "Nail Techs Near Me" feature
 * 
 * Initializes a Leaflet.js map to display professional locations visually.
 * This script expects a div with id="map" in the HTML.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Only initialize map if the element exists
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    try {
        initNailTechMap();
    } catch (error) {
        console.error("Failed to initialize maps module:", error);
    }
});

/**
 * Initializes the Leaflet Map for accurate real-time location setting.
 */
async function initNailTechMap() {
    // Default center
    const defaultCenter = [-15.4167, 28.2833];
    const defaultZoom = 13;

    const map = L.map('map', {
        zoomControl: false // Disable default control entirely, we will use our external buttons
    }).setView(defaultCenter, defaultZoom);

    // Add CartoDB Positron tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Custom Pink Heart Marker Icon
    const heartIcon = L.divIcon({
        className: 'custom-heart-marker',
        html: `
            <div style="filter: drop-shadow(0 4px 15px rgba(236, 72, 153, 0.4));">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#ec4899" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
            </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });

    // Single draggable locator marker
    let locatorMarker = L.marker(defaultCenter, {
        icon: heartIcon,
        draggable: true
    }).addTo(map);

    window.mapReference = map;
    window.markerLayer = L.layerGroup().addTo(map);

    locatorMarker.bindPopup("<b>Your Location</b><br>Drag me to set your exact location!").openPopup();

    // Update popup text when dragged
    locatorMarker.on('dragend', function (e) {
        const position = locatorMarker.getLatLng();
        window.currentUserLocation = { lat: position.lat, lng: position.lng };
        locatorMarker.bindPopup(`<b>Location Set!</b><br>Lat: ${position.lat.toFixed(4)}, Lng: ${position.lng.toFixed(4)}`).openPopup();
        map.panTo(position);

        // Trigger auto-refresh of results if in a discovery context
        if (window.loadProfessionals) window.loadProfessionals(document.getElementById('hero-search')?.value || '');
    });

    // Global function to update markers from database results
    window.updateMapMarkers = (profiles) => {
        if (!window.markerLayer) return;
        window.markerLayer.clearLayers();

        profiles.forEach(pro => {
            if (!pro.latitude || !pro.longitude) return;

            L.marker([pro.latitude, pro.longitude], { icon: heartIcon })
                .addTo(window.markerLayer)
                .bindPopup(`
                    <div class="p-6 text-center glass rounded-luxury border border-brand-border">
                        <p class="font-black text-[10px] text-text-main uppercase tracking-widest mb-4">${pro.full_name}</p>
                        <p class="text-[8px] text-brand-gray/40 font-black uppercase tracking-[0.4em] mb-6">${pro.location || 'Professional Sector'}</p>
                        <button onclick="window.openChatModal('${pro.full_name}', '${pro.id}')" 
                            class="bg-brand-pink text-white px-8 py-3 rounded-luxury text-[9px] font-black uppercase tracking-[0.4em] hover:bg-brand-pink/90 transition-all shadow-2xl">
                            Initialize
                        </button>
                    </div>
                `);
        });
    };

    // Handle Real-Time geolocation via browser API
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            const userPos = [position.coords.latitude, position.coords.longitude];
            window.currentUserLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
            map.flyTo(userPos, 14, { animate: true, duration: 1.5 });
            locatorMarker.setLatLng(userPos);
            locatorMarker.bindPopup("<b>We found you!</b><br>Results updated nearby.").openPopup();

            // Trigger refresh
            if (window.loadProfessionals) window.loadProfessionals();
        },
            (err) => {
                console.warn("Geolocation blocked or failed:", err.message);
            }, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });
    }

    // Handle Search Bar Logic Using Nominatim API
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('map-search');

    if (searchBtn && searchInput) {
        const performSearch = () => handleRealSearch(searchInput.value, map, locatorMarker);

        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }

    // Handle Custom Zoom Controls
    const zoomInBtn = document.getElementById('custom-zoom-in');
    const zoomOutBtn = document.getElementById('custom-zoom-out');

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            map.zoomIn();
        });
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            map.zoomOut();
        });
    }
}

/**
 * Uses the free Nominatim OpenStreetMap API to accurately find locations.
 */
async function handleRealSearch(query, map, locatorMarker) {
    if (!query.trim()) return;

    const searchInput = document.getElementById('map-search');
    searchInput.disabled = true;
    searchInput.classList.add('opacity-75');

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
            headers: {
                'Accept-Language': 'en'
            }
        });

        const data = await response.json();

        if (data && data.length > 0) {
            const foundLat = parseFloat(data[0].lat);
            const foundLng = parseFloat(data[0].lon);
            const foundLocation = [foundLat, foundLng];

            map.flyTo(foundLocation, 14, {
                animate: true,
                duration: 1.5
            });

            window.currentUserLocation = { lat: foundLat, lng: foundLng };
            locatorMarker.setLatLng(foundLocation);
            locatorMarker.bindPopup(`<b>${data[0].display_name.split(',')[0]}</b><br>Drag to fine-tune.`).openPopup();

            // Trigger refresh
            if (window.loadProfessionals) window.loadProfessionals();
        } else {
            alert("Sorry, we couldn't find that exact location. Please try a different search term (e.g., 'Lusaka CBD' or 'Manda Hill').");
        }
    } catch (error) {
        console.error("Geocoding error:", error);
        alert("There was an error connecting to the location service. Please try again.");
    } finally {
        searchInput.disabled = false;
        searchInput.classList.remove('opacity-75');
    }
}
