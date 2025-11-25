'use client';
import { useEffect, useRef, useState } from 'react';

// Google Maps component with user location
const RouteMap = ({ stops, onFocusChange }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [focusedSegment, setFocusedSegment] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [userMarker, setUserMarker] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [routePolyline, setRoutePolyline] = useState(null);

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

      setMap(mapInstance);

      // Draw the route using straight lines (no Directions API)
      drawStraightLineRoute(mapInstance, stops);

      // Add custom markers
      addCustomMarkers(mapInstance, stops);

      // Add user location marker if available
      if (userLocation) {
        addUserLocationMarker(mapInstance, userLocation);
      }

      // Cleanup function
      return () => {
        markers.forEach(marker => marker.setMap(null));
        if (userMarker) {
          userMarker.setMap(null);
        }
        if (routePolyline) {
          routePolyline.setMap(null);
        }
      };
    };

    initMap();
  }, [stops, userLocation]);

  // Draw route using straight lines (no Directions API needed)
  const drawStraightLineRoute = (mapInstance, stops) => {
    if (stops.length < 2) return;

    const google = window.google;
    
    // Create a polyline connecting all stops in order
    const routePath = new google.maps.Polyline({
      path: stops.map(stop => ({ lat: stop.lat, lng: stop.lng })),
      geodesic: true,
      strokeColor: '#10B981',
      strokeOpacity: 0.8,
      strokeWeight: 5
    });

    routePath.setMap(mapInstance);
    setRoutePolyline(routePath);

    // Fit map to show all stops
    const bounds = new google.maps.LatLngBounds();
    stops.forEach(stop => bounds.extend({ lat: stop.lat, lng: stop.lng }));
    if (userLocation) {
      bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng));
    }
    mapInstance.fitBounds(bounds, { padding: 50 });
  };

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

  // Add custom markers
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

  // Create info window content
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
    </div>
  );
};

// Load Google Maps script
const GoogleMapsWrapper = (props) => {
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  useEffect(() => {
    if (window.google) {
      setGoogleMapsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=geometry`;
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