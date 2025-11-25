'use client';
import { useEffect, useRef, useState } from 'react';

// Google Maps component with user location
const RouteMap = ({ stops, onFocusChange }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [directionsService, setDirectionsService] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [focusedSegment, setFocusedSegment] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [userMarker, setUserMarker] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // Get user's current location with explicit permission request
  const requestLocationPermission = () => {
    if (typeof window === 'undefined') return;

    setIsRequestingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setIsRequestingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLoc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setUserLocation(userLoc);
        setIsRequestingLocation(false);
        console.log('📍 GPS Location acquired:', userLoc);
        
        // Update map if it exists
        if (map && userLoc) {
          addUserLocationMarker(map, userLoc);
          // Re-fit map to include user location
          const bounds = new google.maps.LatLngBounds();
          stops.forEach(stop => bounds.extend({ lat: stop.lat, lng: stop.lng }));
          bounds.extend(new google.maps.LatLng(userLoc.lat, userLoc.lng));
          map.fitBounds(bounds, { padding: 50 });
        }
      },
      (error) => {
        setIsRequestingLocation(false);
        let errorMessage = 'Unable to get your location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please allow location access to see your position on the map.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
          default:
            errorMessage = 'An unknown error occurred.';
            break;
        }
        
        setLocationError(errorMessage);
        console.error('Location error:', error);
      },
      {
        enableHighAccuracy: true, // Use GPS if available
        timeout: 15000, // 15 seconds timeout
        maximumAge: 60000 // Accept cached position up to 1 minute old
      }
    );
  };

  // Auto-request location when component mounts
  useEffect(() => {
    requestLocationPermission();
  }, []);

  // Initialize Google Maps
  useEffect(() => {
    if (typeof window === 'undefined' || !window.google || !stops || stops.length === 0) return;

    const initMap = () => {
      const google = window.google;
      
      // Determine center based on user location or first stop
      const center = userLocation || { lat: stops[0].lat, lng: stops[0].lng };
      
      // Create map
      const mapInstance = new google.maps.Map(mapRef.current, {
        zoom: 12,
        center: center,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_BOTTOM,
        },
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "on" }]
          }
        ]
      });

      // Initialize directions service and renderer
      const directionsServiceInstance = new google.maps.DirectionsService();
      const directionsRendererInstance = new google.maps.DirectionsRenderer({
        map: mapInstance,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#10B981',
          strokeWeight: 5,
          strokeOpacity: 0.8
        }
      });

      setMap(mapInstance);
      setDirectionsService(directionsServiceInstance);
      setDirectionsRenderer(directionsRendererInstance);

      // Draw the route
      drawRoute(mapInstance, directionsServiceInstance, directionsRendererInstance, stops);

      // Add custom markers
      addCustomMarkers(mapInstance, stops);

      // Add user location marker if available
      if (userLocation) {
        addUserLocationMarker(mapInstance, userLocation);
      }

      // Cleanup function
      return () => {
        if (directionsRendererInstance) {
          directionsRendererInstance.setMap(null);
        }
        markers.forEach(marker => marker.setMap(null));
        if (userMarker) {
          userMarker.setMap(null);
        }
      };
    };

    initMap();
  }, [stops, userLocation]);

  // Add user location marker with GPS accuracy
  const addUserLocationMarker = (mapInstance, location) => {
    const google = window.google;
    
    // Clear existing user marker
    if (userMarker) {
      userMarker.setMap(null);
    }

    const userLocationMarker = new google.maps.Marker({
      position: location,
      map: mapInstance,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#3B82F6', // Blue color
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3,
        scale: 10
      },
      title: `Your GPS Location\nLat: ${location.lat.toFixed(6)}\nLng: ${location.lng.toFixed(6)}\nAccuracy: ${location.accuracy ? location.accuracy.toFixed(0) + 'm' : 'Unknown'}`,
      zIndex: 1000 // Ensure it appears above other markers
    });

    // Add accuracy circle (only if accuracy data is available)
    if (location.accuracy) {
      const accuracyCircle = new google.maps.Circle({
        strokeColor: '#3B82F6',
        strokeOpacity: 0.6,
        strokeWeight: 1,
        fillColor: '#3B82F6',
        fillOpacity: 0.2,
        map: mapInstance,
        center: location,
        radius: location.accuracy, // Actual GPS accuracy radius
        zIndex: 1
      });
    }

    // Add pulsing effect circle
    const pulseCircle = new google.maps.Circle({
      strokeColor: '#3B82F6',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#3B82F6',
      fillOpacity: 0.1,
      map: mapInstance,
      center: location,
      radius: 500, // 500m radius for visual effect
      zIndex: 1
    });

    // Add info window with detailed location info
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 12px; min-width: 200px;">
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <div style="width: 12px; height: 12px; background: #3B82F6; border-radius: 50%; margin-right: 8px;"></div>
            <strong style="color: #3B82F6;">📍 Your GPS Location</strong>
          </div>
          <div style="font-size: 12px; color: #6B7280;">
            <div><strong>Latitude:</strong> ${location.lat.toFixed(6)}</div>
            <div><strong>Longitude:</strong> ${location.lng.toFixed(6)}</div>
            ${location.accuracy ? `<div><strong>Accuracy:</strong> ±${location.accuracy.toFixed(0)} meters</div>` : ''}
            <div style="margin-top: 8px; font-style: italic;">Actual GPS position</div>
          </div>
        </div>
      `
    });

    // Auto-open info window when location is first acquired
    setTimeout(() => {
      infoWindow.open(mapInstance, userLocationMarker);
    }, 1000);

    userLocationMarker.addListener('click', () => {
      infoWindow.open(mapInstance, userLocationMarker);
    });

    setUserMarker(userLocationMarker);

    return userLocationMarker;
  };

  // Draw route using Google Directions API
  const drawRoute = (mapInstance, directionsService, directionsRenderer, stops) => {
    if (stops.length < 2) return;

    const waypoints = stops.slice(1, -1).map(stop => ({
      location: { lat: stop.lat, lng: stop.lng },
      stopover: true
    }));

    const request = {
      origin: { lat: stops[0].lat, lng: stops[0].lng },
      destination: { lat: stops[stops.length - 1].lat, lng: stops[stops.length - 1].lng },
      waypoints: waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: true
    };

    directionsService.route(request, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK) {
        directionsRenderer.setDirections(result);
        
        // Fit map to show entire route + user location if available
        const bounds = new google.maps.LatLngBounds();
        
        // Add route bounds
        result.routes[0].legs.forEach(leg => {
          bounds.extend(leg.start_location);
          bounds.extend(leg.end_location);
        });
        
        // Add user location to bounds if available
        if (userLocation) {
          bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng));
        }
        
        mapInstance.fitBounds(bounds, { padding: 50 });
      } else {
        console.error('Error drawing route:', status);
        // Fallback: just show markers without route
        const bounds = new google.maps.LatLngBounds();
        stops.forEach(stop => bounds.extend({ lat: stop.lat, lng: stop.lng }));
        if (userLocation) {
          bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng));
        }
        mapInstance.fitBounds(bounds, { padding: 50 });
      }
    });
  };

  // Add custom markers (keep your existing function)
  const addCustomMarkers = (mapInstance, stops) => {
    const google = window.google;
    const newMarkers = [];

    stops.forEach((stop, index) => {
      let backgroundColor = '#000000';
      let textColor = '#FFFFFF';
      let labelText = stop.stopNumber?.toString() || (index + 1).toString();
      
      if (stop.type === 'depot') {
        backgroundColor = '#EF4444';
        labelText = '🏁';
      }

      const marker = new google.maps.Marker({
        position: { lat: stop.lat, lng: stop.lng },
        map: mapInstance,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: backgroundColor,
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          scale: 15
        },
        label: {
          text: labelText,
          color: textColor,
          fontSize: '12px',
          fontWeight: 'bold'
        },
        title: stop.type === 'depot' ? stop.name : `${stop.clientName} - ${stop.address}`
      });

      // Add click listener
      marker.addListener('click', () => {
        const infoWindow = new google.maps.InfoWindow({
          content: createInfoWindowContent(stop)
        });
        infoWindow.open(mapInstance, marker);
      });

      newMarkers.push(marker);
    });

    setMarkers(newMarkers);
  };

  // Create info window content (keep your existing function)
  const createInfoWindowContent = (stop) => {
    if (stop.type === 'depot') {
      return `
        <div style="padding: 12px; max-width: 250px;">
          <strong style="color: #EF4444;">🏁 ${stop.name}</strong><br/>
          <small style="color: #6B7280;">${stop.address}</small>
        </div>
      `;
    } else {
      return `
        <div style="padding: 12px; max-width: 250px;">
          <strong style="color: #10B981;">🛑 Stop ${stop.stopNumber}: ${stop.clientName}</strong><br/>
          <div style="color: #6B7280; margin-top: 4px;">
            📞 ${stop.phoneNumber || 'N/A'}<br/>
            📍 ${stop.address}<br/>
            ${stop.distanceFromPrevious ? `<div style="margin-top: 4px; color: #3B82F6;">📏 ${stop.distanceFromPrevious} from previous</div>` : ''}
          </div>
        </div>
      `;
    }
  };

  // Refresh location function
  const refreshLocation = () => {
    requestLocationPermission();
  };

  return (
    <div className="relative h-full w-full">
      <div 
        ref={mapRef} 
        style={{ 
          height: '100%', 
          width: '100%', 
          cursor: 'pointer',
          borderRadius: '8px'
        }} 
      />
      
      {/* Location control panel */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800">Your Location</h3>
          <button
            onClick={refreshLocation}
            disabled={isRequestingLocation}
            className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRequestingLocation ? '🔄' : '↻'}
          </button>
        </div>
        
        {isRequestingLocation && (
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-blue-600">Requesting GPS location...</span>
          </div>
        )}
        
        {userLocation && !isRequestingLocation && (
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-xs font-medium text-gray-700">GPS Location Active</span>
            </div>
            <div className="text-xs text-gray-600">
              <div>Lat: {userLocation.lat.toFixed(6)}</div>
              <div>Lng: {userLocation.lng.toFixed(6)}</div>
              {userLocation.accuracy && (
                <div>Accuracy: ±{userLocation.accuracy.toFixed(0)}m</div>
              )}
            </div>
          </div>
        )}
        
        {locationError && !isRequestingLocation && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-xs font-medium text-red-600">Location Error</span>
            </div>
            <p className="text-xs text-red-500">{locationError}</p>
            <button
              onClick={requestLocationPermission}
              className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 w-full"
            >
              Try Again
            </button>
          </div>
        )}
        
        {!userLocation && !locationError && !isRequestingLocation && (
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span className="text-xs text-gray-500">Click to enable location</span>
            <button
              onClick={requestLocationPermission}
              className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 ml-auto"
            >
              Enable
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Load Google Maps script (keep your existing wrapper)
const GoogleMapsWrapper = (props) => {
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  useEffect(() => {
    if (window.google) {
      setGoogleMapsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=geometry,places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleMapsLoaded(true);
    script.onerror = () => console.error('Error loading Google Maps');
    
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  if (!googleMapsLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600">Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  return <RouteMap {...props} />;
};

export default GoogleMapsWrapper;