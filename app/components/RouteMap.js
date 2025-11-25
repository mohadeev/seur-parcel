'use client';
import { useEffect, useRef, useState } from 'react';

// Google Maps component
const RouteMap = ({ stops, onFocusChange }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [directionsService, setDirectionsService] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [focusedSegment, setFocusedSegment] = useState(null);

  // Initialize Google Maps
  useEffect(() => {
    if (typeof window === 'undefined' || !window.google || !stops || stops.length === 0) return;

    const initMap = () => {
      const google = window.google;
      
      // Create map
      const mapInstance = new google.maps.Map(mapRef.current, {
        zoom: 12,
        center: { lat: stops[0].lat, lng: stops[0].lng },
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

      // Cleanup function
      return () => {
        if (directionsRendererInstance) {
          directionsRendererInstance.setMap(null);
        }
        markers.forEach(marker => marker.setMap(null));
      };
    };

    initMap();
  }, [stops]);

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
        
        // Fit map to show entire route
        const bounds = new google.maps.LatLngBounds();
        result.routes[0].legs.forEach(leg => {
          bounds.extend(leg.start_location);
          bounds.extend(leg.end_location);
        });
        mapInstance.fitBounds(bounds, { padding: 50 });
      } else {
        console.error('Error drawing route:', status);
        // Fallback: just show markers without route
        const bounds = new google.maps.LatLngBounds();
        stops.forEach(stop => bounds.extend({ lat: stop.lat, lng: stop.lng }));
        mapInstance.fitBounds(bounds, { padding: 50 });
      }
    });
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

  // Focus on segment function
  const focusOnSegment = (segmentIndex) => {
    if (!map || !stops || stops.length < 2 || segmentIndex >= stops.length - 1) return;

    const startStop = stops[segmentIndex];
    const endStop = stops[segmentIndex + 1];

    // Clear existing route and markers
    if (directionsRenderer) {
      directionsRenderer.setMap(null);
    }
    markers.forEach(marker => marker.setMap(null));

    // Create new directions renderer for focused segment
    const google = window.google;
    const focusedDirectionsRenderer = new google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: '#EF4444',
        strokeWeight: 6,
        strokeOpacity: 0.9
      }
    });

    // Request directions for focused segment
    if (directionsService) {
      const request = {
        origin: { lat: startStop.lat, lng: startStop.lng },
        destination: { lat: endStop.lat, lng: endStop.lng },
        travelMode: google.maps.TravelMode.DRIVING
      };

      directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          focusedDirectionsRenderer.setDirections(result);
          
          // Fit map to show the segment
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: startStop.lat, lng: startStop.lng });
          bounds.extend({ lat: endStop.lat, lng: endStop.lng });
          map.fitBounds(bounds, { padding: 50 });
        }
      });
    }

    setFocusedSegment(segmentIndex);
    if (onFocusChange) {
      onFocusChange(segmentIndex);
    }
  };

  // Reset focus function
  const resetFocus = () => {
    if (!map || !stops || stops.length === 0) return;

    // Reinitialize the full route
    markers.forEach(marker => marker.setMap(null));
    
    if (directionsRenderer) {
      directionsRenderer.setMap(null);
    }

    // Recreate everything
    const google = window.google;
    const newDirectionsRenderer = new google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#10B981',
        strokeWeight: 5,
        strokeOpacity: 0.8
      }
    });

    drawRoute(map, directionsService, newDirectionsRenderer, stops);
    addCustomMarkers(map, stops);

    setFocusedSegment(null);
    if (onFocusChange) {
      onFocusChange(null);
    }
  };

  // Expose functions to parent
  useEffect(() => {
    if (map) {
      window.focusOnSegment = focusOnSegment;
      window.resetMapFocus = resetFocus;
    }
  }, [map, stops, directionsService]);

  return (
    <div 
      ref={mapRef} 
      style={{ 
        height: '100%', 
        width: '100%', 
        cursor: 'pointer',
        borderRadius: '8px'
      }} 
    />
  );
};

// Load Google Maps script
const GoogleMapsWrapper = (props) => {
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google) {
      setGoogleMapsLoaded(true);
      return;
    }

    // Load Google Maps script
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