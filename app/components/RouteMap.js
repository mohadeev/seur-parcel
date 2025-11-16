'use client';
import { useEffect, useRef, useState } from 'react';

const RouteMap = ({ stops, onFocusChange }) => {
  const mapRef = useRef(null);
  const [focusedSegment, setFocusedSegment] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [routeLine, setRouteLine] = useState(null);
  const [markers, setMarkers] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !stops || stops.length === 0) return;

    const initMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      // Fix for default markers in Next.js
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });

      // Create map
      const map = L.map('map', {
        zoomControl: false,
        attributionControl: false
      }).setView([stops[0].lat, stops[0].lng], 13);
      
      mapRef.current = map;
      setMapInstance(map);

      // Add light tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 20
      }).addTo(map);

      // Add zoom control to bottom right
      L.control.zoom({
        position: 'bottomright'
      }).addTo(map);

      // Create route line coordinates
      const routeCoordinates = stops.map(stop => [stop.lat, stop.lng]);

      // Draw main route line
      const mainRouteLine = L.polyline(routeCoordinates, {
        color: '#10B981',
        weight: 5,
        opacity: 0.8,
        lineJoin: 'round'
      }).addTo(map);
      setRouteLine(mainRouteLine);

      // Add markers for each stop - NO SHADOWS
      const markersArray = stops.map((stop, index) => {
        let backgroundColor = '#000000';
        let textColor = '#FFFFFF';
        let iconHtml = stop.stopNumber;
        
        if (stop.type === 'depot') {
          backgroundColor = '#EF4444';
          textColor = '#FFFFFF';
          iconHtml = '🏁';
        }

        const customIcon = L.divIcon({
          html: `
            <div style="
              background-color: ${backgroundColor};
              color: ${textColor};
              width: 36px;
              height: 36px;
              border-radius: 50%;
              border: 3px solid #FFFFFF;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 14px;
            ">
              ${iconHtml}
            </div>
          `,
          className: 'custom-marker',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const marker = L.marker([stop.lat, stop.lng], { icon: customIcon }).addTo(map);
        
        // Popup with stop info
        let popupContent = '';
        if (stop.type === 'depot') {
          popupContent = `
            <div style="padding: 12px; background: white; color: #1F2937; border-radius: 8px; max-width: 250px; border: 1px solid #E5E7EB;">
              <strong style="color: #EF4444;">🏁 ${stop.name}</strong><br/>
              <small style="color: #6B7280;">${stop.address}</small>
            </div>
          `;
        } else {
          popupContent = `
            <div style="padding: 12px; background: white; color: #1F2937; border-radius: 8px; max-width: 250px; border: 1px solid #E5E7EB;">
              <strong style="color: #10B981;">🛑 Stop ${stop.stopNumber}: ${stop.clientName}</strong><br/>
              <div style="color: #6B7280; margin-top: 4px;">
                📞 ${stop.phoneNumber}<br/>
                📍 ${stop.address}<br/>
                ${stop.distanceFromPrevious ? `<div style="margin-top: 4px; color: #3B82F6;">📏 ${stop.distanceFromPrevious} from previous</div>` : ''}
              </div>
            </div>
          `;
        }
        
        marker.bindPopup(popupContent);
        return marker;
      });

      setMarkers(markersArray);

      // Fit map to show all markers
      map.fitBounds(mainRouteLine.getBounds(), { padding: [20, 20] });

      // Add click event to map to reset focus
      map.on('click', () => {
        resetFocus();
      });

      // Cleanup function
      return () => {
        map.remove();
      };
    };

    initMap();
  }, [stops]);

  // Function to focus on a specific segment
  const focusOnSegment = (segmentIndex) => {
    if (!mapInstance || !routeLine || stops.length < 2) return;

    // Hide all markers and route line
    markers.forEach(marker => marker.remove());
    routeLine.remove();

    // Show only the focused segment (from previous stop to current stop)
    const startIndex = segmentIndex === 0 ? 0 : segmentIndex;
    const endIndex = segmentIndex + 1;
    
    const segmentCoordinates = [
      stops[startIndex],
      stops[endIndex]
    ].map(stop => [stop.lat, stop.lng]);

    // Draw focused segment with different style
    const focusedLine = L.polyline(segmentCoordinates, {
      color: '#EF4444',
      weight: 6,
      opacity: 0.9,
      lineJoin: 'round'
    }).addTo(mapInstance);

    // Show only the two relevant markers - NO SHADOWS
    [startIndex, endIndex].forEach(index => {
      const stop = stops[index];
      let backgroundColor = index === 0 && stop.type === 'depot' ? '#EF4444' : '#000000';
      let textColor = '#FFFFFF';
      let iconHtml = index === endIndex ? segmentIndex + 1 : (index === 0 ? '🏁' : index);

      const customIcon = L.divIcon({
        html: `
          <div style="
            background-color: ${backgroundColor};
            color: ${textColor};
            width: 42px;
            height: 42px;
            border-radius: 50%;
            border: 3px solid #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
          ">
            ${iconHtml}
          </div>
        `,
        className: 'custom-marker',
        iconSize: [42, 42],
        iconAnchor: [21, 21]
      });

      const marker = L.marker([stop.lat, stop.lng], { icon: customIcon }).addTo(mapInstance);
      
      let popupContent = '';
      if (stop.type === 'depot') {
        popupContent = `
          <div style="padding: 12px; background: white; color: #1F2937; border-radius: 8px; border: 1px solid #E5E7EB;">
            <strong style="color: #EF4444;">🏁 ${stop.name}</strong><br/>
            <small style="color: #6B7280;">${stop.address}</small>
          </div>
        `;
      } else {
        popupContent = `
          <div style="padding: 12px; background: white; color: #1F2937; border-radius: 8px; border: 1px solid #E5E7EB;">
            <strong style="color: #10B981;">🛑 Stop ${stop.stopNumber}: ${stop.clientName}</strong><br/>
            <div style="color: #6B7280; margin-top: 4px;">
              📞 ${stop.phoneNumber}<br/>
              📍 ${stop.address}<br/>
              ${stop.distanceFromPrevious ? `<div style="margin-top: 4px; color: #3B82F6;">📏 ${stop.distanceFromPrevious} from previous</div>` : ''}
            </div>
          </div>
        `;
      }
      
      marker.bindPopup(popupContent);
    });

    // Fit map to show only the focused segment
    const segmentBounds = L.latLngBounds(segmentCoordinates);
    mapInstance.fitBounds(segmentBounds, { padding: [50, 50] });

    setFocusedSegment(segmentIndex);
    if (onFocusChange) {
      onFocusChange(segmentIndex);
    }
  };

  // Function to reset focus and show everything
  const resetFocus = () => {
    if (!mapInstance || !stops || stops.length === 0) return;

    // Clear existing map elements
    mapInstance.eachLayer((layer) => {
      if (layer instanceof L.Polyline || layer instanceof L.Marker) {
        mapInstance.removeLayer(layer);
      }
    });

    // Recreate the full route
    const routeCoordinates = stops.map(stop => [stop.lat, stop.lng]);
    
    // Redraw main route line
    const mainRouteLine = L.polyline(routeCoordinates, {
      color: '#10B981',
      weight: 5,
      opacity: 0.8,
      lineJoin: 'round'
    }).addTo(mapInstance);

    // Redraw all markers - NO SHADOWS
    const markersArray = stops.map((stop, index) => {
      let backgroundColor = '#000000';
      let textColor = '#FFFFFF';
      let iconHtml = stop.stopNumber;
      
      if (stop.type === 'depot') {
        backgroundColor = '#EF4444';
        textColor = '#FFFFFF';
        iconHtml = '🏁';
      }

      const customIcon = L.divIcon({
        html: `
          <div style="
            background-color: ${backgroundColor};
            color: ${textColor};
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 3px solid #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
          ">
            ${iconHtml}
          </div>
        `,
        className: 'custom-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([stop.lat, stop.lng], { icon: customIcon }).addTo(mapInstance);
      
      let popupContent = '';
      if (stop.type === 'depot') {
        popupContent = `
          <div style="padding: 12px; background: white; color: #1F2937; border-radius: 8px; border: 1px solid #E5E7EB;">
            <strong style="color: #EF4444;">🏁 ${stop.name}</strong><br/>
            <small style="color: #6B7280;">${stop.address}</small>
          </div>
        `;
      } else {
        popupContent = `
          <div style="padding: 12px; background: white; color: #1F2937; border-radius: 8px; border: 1px solid #E5E7EB;">
            <strong style="color: #10B981;">🛑 Stop ${stop.stopNumber}: ${stop.clientName}</strong><br/>
            <div style="color: #6B7280; margin-top: 4px;">
              📞 ${stop.phoneNumber}<br/>
              📍 ${stop.address}<br/>
              ${stop.distanceFromPrevious ? `<div style="margin-top: 4px; color: #3B82F6;">📏 ${stop.distanceFromPrevious} from previous</div>` : ''}
            </div>
          </div>
        `;
      }
      
      marker.bindPopup(popupContent);
      return marker;
    });

    // Fit map to show all markers
    mapInstance.fitBounds(mainRouteLine.getBounds(), { padding: [20, 20] });

    setFocusedSegment(null);
    if (onFocusChange) {
      onFocusChange(null);
    }
  };

  // Expose functions to parent
  useEffect(() => {
    if (mapInstance) {
      window.focusOnSegment = focusOnSegment;
      window.resetMapFocus = resetFocus;
    }
  }, [mapInstance, stops]);

  return <div id="map" style={{ height: '100%', width: '100%', cursor: 'pointer' }} />;
};

export default RouteMap;