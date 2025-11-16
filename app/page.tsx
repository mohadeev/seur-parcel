'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const RouteMap = dynamic(() => import('./components/RouteMap'), {
  ssr: false,
  loading: () => <div className="h-64 md:h-96 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">Loading map...</div>
});

export default function Home() {
  const [deliveries, setDeliveries] = useState([]);
  const [geocodedDeliveries, setGeocodedDeliveries] = useState([]);
  const [optimizedRoute, setOptimizedRoute] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState('upload');
  const [focusedSegment, setFocusedSegment] = useState(null);
  const [activeTab, setActiveTab] = useState('route');
  const [clickedStop, setClickedStop] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Fixed SEUR depot location with coordinates
  const seurDepot = {
    name: "SEUR Depot",
    address: "Pasealekua Mateo Errota, 15, Nave P, 20014 Donostia, Gipuzkoa, Spain",
    lat: 43.3023384,
    lng: -1.9451188
  };

  // Get user's current location
  const getUserLocation = () => {
    setIsGettingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsGettingLocation(false);
      },
      (error) => {
        let errorMessage = 'Unable to get your location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please allow location access to get directions.';
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
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  // Open Google Maps with directions
  const openGoogleMapsDirections = (delivery) => {
    if (!userLocation) {
      alert('Please allow location access first to get directions');
      return;
    }

    const destination = encodeURIComponent(delivery.address);
    const origin = `${userLocation.lat},${userLocation.lng}`;
    
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    
    window.open(googleMapsUrl, '_blank');
  };

  // Handle stop click
  const handleStopClick = (stopIndex) => {
    if (typeof window !== 'undefined' && window.focusOnSegment) {
      window.focusOnSegment(stopIndex);
      setActiveTab('map');
      setClickedStop(stopIndex);
      
      // Get user location when a stop is clicked
      if (!userLocation && !isGettingLocation) {
        getUserLocation();
      }
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setProcessing(true);
    setCurrentStep('upload');
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        
        const response = await fetch('/api/process-orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            imageBase64: base64 
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          setDeliveries(data.deliveries);
          
          // Automatically start geocoding
          await geocodeAddresses(data.deliveries);
        } else {
          alert('❌ Error: ' + data.error);
        }
      };
      
      reader.readAsDataURL(file);
      
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const geocodeAddresses = async (deliveriesToGeocode) => {
    if (deliveriesToGeocode.length === 0) return;
    
    setProcessing(true);
    setCurrentStep('geocoding');
    
    try {
      const response = await fetch('/api/geocode-addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          addresses: deliveriesToGeocode,
          depot: seurDepot
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setGeocodedDeliveries(data.deliveries);
        
        // Automatically start route optimization
        await optimizeRoute(data.deliveries);
      } else {
        alert('❌ Geocoding error: ' + data.error);
      }
      
    } catch (error) {
      alert('Geocoding error: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const optimizeRoute = async (deliveriesWithCoords) => {
    if (deliveriesWithCoords.length === 0) return;
    
    setProcessing(true);
    setCurrentStep('optimizing');
    
    try {
      const response = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          deliveries: deliveriesWithCoords,
          depot: seurDepot
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setOptimizedRoute(data.route);
        setCurrentStep('complete');
      } else {
        alert('❌ Optimization error: ' + data.error);
      }
      
    } catch (error) {
      alert('Optimization error: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  // Handle focus change from map
  const handleFocusChange = (segmentIndex) => {
    setFocusedSegment(segmentIndex);
  };

  // Prepare map data
  const mapStops = optimizedRoute.length > 0 ? [
    { ...seurDepot, stopNumber: 0, type: 'depot' },
    ...optimizedRoute.map((stop, index) => ({
      ...stop,
      stopNumber: index + 1,
      type: 'delivery'
    }))
  ] : [];

  const getStepStatus = (step) => {
    if (step === currentStep) return 'current';
    if (
      (step === 'upload' && currentStep !== 'upload') ||
      (step === 'geocoding' && currentStep === 'optimizing') ||
      (step === 'geocoding' && currentStep === 'complete') ||
      (step === 'optimizing' && currentStep === 'complete')
    ) return 'completed';
    return 'pending';
  };

  const selectedDelivery = clickedStop !== null ? optimizedRoute[clickedStop] : null;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Header - Mobile Optimized */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-black rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm md:text-lg">🚚</span>
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-gray-900">SEUR Route</h1>
                <p className="text-gray-600 text-xs md:text-sm hidden sm:block">Intelligent delivery routing</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs md:text-sm text-gray-600">Starting from</div>
              <div className="font-semibold text-gray-900 text-sm md:text-base truncate max-w-[120px] md:max-w-none">
                {seurDepot.name}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-3 md:px-4 py-4 md:py-8">
        {/* Progress Steps - Mobile Horizontal Scroll */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between space-x-2 md:space-x-0 overflow-x-auto pb-2 md:pb-0">
            {['upload', 'geocoding', 'optimizing', 'complete'].map((step, index) => (
              <div key={step} className="flex items-center flex-shrink-0">
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 ${
                  getStepStatus(step) === 'completed' ? 'bg-green-500 border-green-500 text-white' :
                  getStepStatus(step) === 'current' ? 'bg-black border-black text-white' :
                  'bg-gray-100 border-gray-300 text-gray-400'
                }`}>
                  {getStepStatus(step) === 'completed' ? '✓' : index + 1}
                </div>
                <div className={`ml-2 text-xs md:text-sm ${
                  getStepStatus(step) === 'current' ? 'text-gray-900 font-semibold' : 'text-gray-600'
                } hidden sm:block`}>
                  {step === 'upload' && 'Upload'}
                  {step === 'geocoding' && 'Geocode'}
                  {step === 'optimizing' && 'Optimize'}
                  {step === 'complete' && 'Complete'}
                </div>
                {index < 3 && (
                  <div className={`w-4 md:w-20 h-1 mx-2 md:mx-4 ${
                    getStepStatus(step) === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Upload Section */}
        {!optimizedRoute.length && (
          <div className="mb-6 md:mb-8 p-4 md:p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-gray-900">📸 Upload Delivery Orders</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 md:p-8 text-center hover:border-gray-400 transition-colors">
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageUpload}
                disabled={processing}
                className="hidden"
                id="file-upload"
              />
              <label 
                htmlFor="file-upload"
                className="cursor-pointer block"
              >
                <div className="text-3xl md:text-4xl mb-3 md:mb-4">📱</div>
                <div className="text-base md:text-lg font-semibold mb-2 text-gray-900">
                  {processing ? 'Processing...' : 'Take Photo of Orders'}
                </div>
                <div className="text-gray-600 text-xs md:text-sm mb-4">
                  Upload screenshot or photo of delivery list
                </div>
                <button 
                  disabled={processing}
                  className="bg-black text-white px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400 disabled:text-gray-200 transition-colors text-sm md:text-base w-full md:w-auto"
                >
                  {processing ? 'Processing...' : 'Choose File'}
                </button>
              </label>
            </div>
            {processing && currentStep === 'upload' && (
              <div className="mt-3 md:mt-4 p-3 bg-gray-50 rounded-lg text-center">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-3 h-3 bg-black rounded-full animate-pulse"></div>
                  <div className="text-xs md:text-sm text-gray-600">AI is processing your orders...</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Processing Status */}
        {processing && currentStep !== 'upload' && (
          <div className="mb-4 md:mb-6 p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 md:space-x-3">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-black rounded-full animate-pulse"></div>
                <div className="text-gray-900 text-sm md:text-base">
                  {currentStep === 'geocoding' && '📍 Getting coordinates...'}
                  {currentStep === 'optimizing' && '🤖 Optimizing route...'}
                </div>
              </div>
              <div className="text-xs md:text-sm text-gray-600">
                {geocodedDeliveries.filter(d => d.lat && d.lng).length} addresses
              </div>
            </div>
          </div>
        )}

        {/* Mobile Tabs for Route/Map */}
        {optimizedRoute.length > 0 && (
          <div className="block lg:hidden mb-4">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('route')}
                className={`flex-1 py-3 px-4 text-center font-semibold text-sm ${
                  activeTab === 'route' 
                    ? 'text-black border-b-2 border-black' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📋 Route ({optimizedRoute.length})
              </button>
              <button
                onClick={() => setActiveTab('map')}
                className={`flex-1 py-3 px-4 text-center font-semibold text-sm ${
                  activeTab === 'map' 
                    ? 'text-black border-b-2 border-black' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🗺️ Map
              </button>
            </div>
          </div>
        )}

        {/* Optimized Route with Map */}
        {optimizedRoute.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Route List - Hidden on mobile when map is active */}
            <div className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${
              activeTab === 'map' ? 'hidden lg:block' : 'block'
            }`}>
              <div className="p-4 md:p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg md:text-xl font-semibold text-gray-900">Delivery Route</h2>
                  {focusedSegment !== null && (
                    <button 
                      onClick={() => {
                        window.resetMapFocus && window.resetMapFocus();
                        setClickedStop(null);
                      }}
                      className="bg-black text-white px-3 py-1 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-semibold hover:bg-gray-800 transition-colors"
                    >
                      Show Full
                    </button>
                  )}
                </div>
                <div className="mt-1 md:mt-2 text-xs md:text-sm text-gray-600">
                  {optimizedRoute.length} stops • Chain optimized
                </div>
              </div>
              
              <div className="max-h-[50vh] md:max-h-[600px] overflow-y-auto">
                {optimizedRoute.map((stop, index) => (
                  <div 
                    key={index}
                    className={`p-4 md:p-6 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-all cursor-pointer ${
                      clickedStop === index 
                        ? 'border-2 border-black bg-gray-50' 
                        : 'border-0'
                    }`}
                    onClick={() => handleStopClick(index)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center">
                        <div className="w-6 h-6 md:w-8 md:h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold text-xs md:text-sm mr-2 md:mr-3">
                          {stop.stopNumber}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-base md:text-lg text-gray-900 truncate">{stop.clientName}</div>
                          <div className="text-xs md:text-sm text-gray-600 truncate">{stop.phoneNumber}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full whitespace-nowrap">
                          📍 {stop.distanceFromPrevious}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 whitespace-nowrap">{stop.driveTimeFromPrevious}</div>
                      </div>
                    </div>
                    
                    <div className="mb-3 md:mb-4">
                      <div className="text-xs md:text-sm text-gray-600 mb-1">Address</div>
                      <div className="text-gray-900 text-sm md:text-base break-words">{stop.address}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Map - Hidden on mobile when route is active */}
            <div className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${
              activeTab === 'route' ? 'hidden lg:block' : 'block'
            }`}>
              <div className="p-4 md:p-6 border-b border-gray-200">
                <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                  {focusedSegment !== null ? 'Focused Segment' : 'Route Map'}
                </h2>
                {focusedSegment !== null && (
                  <div className="mt-1 md:mt-2 text-xs md:text-sm text-gray-600">
                    {focusedSegment === 0 ? 'Depot to Stop 1' : `Stop ${focusedSegment} to ${focusedSegment + 1}`}
                  </div>
                )}
              </div>
              <div className="h-[50vh] md:h-[600px]">
                <RouteMap stops={mapStops} onFocusChange={handleFocusChange} />
              </div>
              <div className="p-3 md:p-4 border-t border-gray-200">
                <div className="flex items-center justify-center space-x-4 md:space-x-6 text-xs md:text-sm text-gray-600 flex-wrap gap-2">
                  <div className="flex items-center">
                    <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full mr-1 md:mr-2"></div>
                    <span>Depot</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 md:w-3 md:h-3 bg-black rounded-full mr-1 md:mr-2"></div>
                    <span>Stops</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 md:w-6 h-1 bg-green-500 mr-1 md:mr-2"></div>
                    <span>Route</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!optimizedRoute.length && !processing && (
          <div className="text-center py-12 md:py-16">
            <div className="text-4xl md:text-6xl mb-4">🚚</div>
            <h3 className="text-xl md:text-2xl font-semibold mb-2 text-gray-900">Ready to Optimize</h3>
            <p className="text-gray-600 max-w-md mx-auto text-sm md:text-base px-4">
              Upload a photo of your delivery orders to get started with AI-powered route optimization
            </p>
          </div>
        )}
      </div>

      {/* Google Maps Navigation Section - Fixed at bottom of entire page */}
      {selectedDelivery && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="max-w-6xl mx-auto p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-lg">
                🚗 Navigate to Stop {selectedDelivery.stopNumber}
              </h3>
              <button 
                onClick={() => setClickedStop(null)}
                className="text-gray-500 hover:text-gray-700 text-lg p-1"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <div className="font-semibold text-gray-900">{selectedDelivery.clientName}</div>
              <div className="text-sm text-gray-600">{selectedDelivery.address}</div>
              <div className="text-xs text-gray-500 mt-1">{selectedDelivery.phoneNumber}</div>
            </div>

            {!userLocation && !isGettingLocation && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 mb-2">
                  Allow location access to get directions from your current position
                </p>
                <button
                  onClick={getUserLocation}
                  className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-600 transition-colors w-full"
                >
                  📍 Allow Location Access
                </button>
              </div>
            )}

            {isGettingLocation && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-blue-700">Getting your location...</span>
                </div>
              </div>
            )}

            {locationError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{locationError}</p>
                <button
                  onClick={getUserLocation}
                  className="mt-2 bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors w-full"
                >
                  🔄 Try Again
                </button>
              </div>
            )}

            {userLocation && (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-700">Location access granted</span>
                  </div>
                </div>
                <button
                  onClick={() => openGoogleMapsDirections(selectedDelivery)}
                  className="bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors w-full flex items-center justify-center space-x-2"
                >
                  <span>🗺️</span>
                  <span>Open Google Maps Directions</span>
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Opens Google Maps with directions from your current location
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      {optimizedRoute.length > 0 && !selectedDelivery && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 shadow-lg z-40">
          <div className="flex justify-between items-center max-w-md mx-auto">
            <button
              onClick={() => setActiveTab('route')}
              className={`flex flex-col items-center px-4 py-2 rounded-lg ${
                activeTab === 'route' ? 'text-black bg-gray-100' : 'text-gray-500'
              }`}
            >
              <span className="text-lg">📋</span>
              <span className="text-xs mt-1">Route</span>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`flex flex-col items-center px-4 py-2 rounded-lg ${
                activeTab === 'map' ? 'text-black bg-gray-100' : 'text-gray-500'
              }`}
            >
              <span className="text-lg">🗺️</span>
              <span className="text-xs mt-1">Map</span>
            </button>
            {focusedSegment !== null && (
              <button 
                onClick={() => {
                  window.resetMapFocus && window.resetMapFocus();
                  setClickedStop(null);
                }}
                className="flex flex-col items-center px-4 py-2 rounded-lg text-gray-500 hover:text-black"
              >
                <span className="text-lg">🔍</span>
                <span className="text-xs mt-1">Reset</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add padding for mobile bottom nav when navigation panel is NOT showing */}
      {optimizedRoute.length > 0 && !selectedDelivery && (
        <div className="lg:hidden h-20"></div>
      )}

      {/* Add padding for mobile when navigation panel IS showing */}
      {selectedDelivery && (
        <div className="h-40 md:h-48"></div>
      )}
    </main>
  );
}