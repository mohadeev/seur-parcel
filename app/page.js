'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL

// IndexedDB Utility
class SeurDB {
  constructor() {
    this.dbName = 'SeurDeliveryDB';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('routes')) {
          const routesStore = db.createObjectStore('routes', { keyPath: 'id' });
          routesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos', { keyPath: 'id' });
        }
      };
    });
  }

  // In your SeurDB class, add deliveryStatus to saveRoute
async saveRoute(routeData) {
  if (!this.db) await this.init();
  
  return new Promise((resolve, reject) => {
    const transaction = this.db.transaction(['routes'], 'readwrite');
    const store = transaction.objectStore('routes');
    
    const request = store.put({
      ...routeData,
      deliveryStatus: routeData.deliveryStatus || {}, // ✅ Add delivery status
      createdAt: new Date().toISOString()
    });

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

  async getRoute(routeId) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['routes'], 'readonly');
      const store = transaction.objectStore('routes');
      
      const request = store.get(routeId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllRoutes() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['routes'], 'readonly');
      const store = transaction.objectStore('routes');
      const index = store.index('createdAt');
      
      const request = index.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRoute(routeId) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['routes'], 'readwrite');
      const store = transaction.objectStore('routes');
      
      const request = store.delete(routeId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async savePhotos(photos) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['photos'], 'readwrite');
      const store = transaction.objectStore('photos');
      
      const request = store.put({
        id: 'current_photos',
        photos: photos,
        updatedAt: new Date().toISOString()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPhotos() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['photos'], 'readonly');
      const store = transaction.objectStore('photos');
      
      const request = store.get('current_photos');
      
      request.onsuccess = () => resolve(request.result?.photos || []);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['routes', 'photos'], 'readwrite');
      
      transaction.objectStore('routes').clear();
      transaction.objectStore('photos').clear();
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
  
}

const seurDB = new SeurDB();

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  )
}

const RouteMap = dynamic(() => import('./components/RouteMap'), {
  ssr: false,
  loading: () => <div className="h-64 md:h-96 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">Loading map...</div>
});

function HomeContent() {
  const [deliveries, setDeliveries] = useState([]);
  const [geocodedDeliveries, setGeocodedDeliveries] = useState([]);
  const [optimizedRoute, setOptimizedRoute] = useState([]);
  const [processing, setProcessing] = useState(false);
const [currentStep, setCurrentStep] = useState('parcel-capture');
  const [focusedSegment, setFocusedSegment] = useState(null);
  const [activeTab, setActiveTab] = useState('route');
  const [clickedStop, setClickedStop] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [showRoutesList, setShowRoutesList] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState({});
  const [editingStop, setEditingStop] = useState(null);
const [editedAddress, setEditedAddress] = useState('');

  const [capturedPhotos, setCapturedPhotos] = useState([]);
const [currentOrderPhotos, setCurrentOrderPhotos] = useState({ 
  barcode: null, 
  parcel: null, 
  label: null 
});const [photoStep, setPhotoStep] = useState('barcode');
  const [selectedImages, setSelectedImages] = useState(null);
  const [labelPhotos, setLabelPhotos] = useState([]);
const [currentLabelPhoto, setCurrentLabelPhoto] = useState(null);
// Image Modal Component
// Image Modal Component - FIXED
// Image Modal Component - HIGH QUALITY
// In your ImageModal component, add handling for unmatched labels
const ImageModal = ({ images, onClose }) => {
  if (!images) return null;

  const hasLabelOnly = images.extractedData && !images.barcodePhoto && !images.parcelPhoto;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-[100000] flex items-center justify-center p-2">
      <div className="bg-white rounded-xl max-w-7xl w-full max-h-[98vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {hasLabelOnly ? 'Shipping Label Details' : 'High Quality Package Photos'}
            </h3>
            {hasLabelOnly && (
              <div className="text-sm text-yellow-600 mt-1">
                ⚠️ No parcel photos available - Label only
              </div>
            )}
            {/* ✅ ADD SENDER INFO IN MODAL */}
            {images.extractedData?.sender && (
              <div className="text-sm text-blue-600 mt-1">
                From: {images.extractedData.sender}
                {images.extractedData.weight && ` • Weight: ${images.extractedData.weight}`}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl bg-gray-100 hover:bg-gray-200 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Show barcode photo only if available */}
            {images.barcodePhoto && (
              <div className="text-center">
                <div className="text-md font-semibold text-gray-700 mb-3">📊 Barcode</div>
                <img 
                  src={images.barcodePhoto} 
                  alt="Barcode" 
                  className="max-w-full max-h-[50vh] w-auto h-auto mx-auto rounded-lg shadow-lg"
                />
              </div>
            )}
            
            {/* Label Photo */}
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-700 mb-4">
                {hasLabelOnly ? '📋 Shipping Label - NO PARCEL MATCH' : '📋 Shipping Label - FULL QUALITY'}
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                {images.labelPhoto ? (
                  <img 
                    src={images.labelPhoto} 
                    alt="Shipping Label" 
                    className="max-w-full max-h-[70vh] w-auto h-auto mx-auto rounded-lg shadow-lg"
                    style={{ imageRendering: 'high-quality' }}
                  />
                ) : (
                  <div className="text-red-500 text-lg py-8">
                    ❌ Full quality label image not available
                  </div>
                )}
              </div>
            </div>
            
            {/* Parcel Photo - Only show if available */}
            {images.parcelPhoto && (
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-700 mb-4">📦 Parcel View - FULL QUALITY</div>
                <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                  <img 
                    src={images.parcelPhoto} 
                    alt="Parcel" 
                    className="max-w-full max-h-[70vh] w-auto h-auto mx-auto rounded-lg shadow-lg"
                    style={{ imageRendering: 'high-quality' }}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Show extracted data for unmatched labels */}
          {hasLabelOnly && images.extractedData && (
            <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-semibold text-yellow-800 mb-2">Extracted Label Data:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><strong>Client:</strong> {images.extractedData.clientName || 'N/A'}</div>
                <div><strong>Address:</strong> {images.extractedData.address || 'N/A'}</div>
                <div><strong>Phone:</strong> {images.extractedData.phoneNumber || 'N/A'}</div>
                <div><strong>Barcode:</strong> {images.extractedData.barcode || 'N/A'}</div>
                {images.extractedData.sender && (
                  <div><strong>Sender:</strong> {images.extractedData.sender}</div>
                )}
                {images.extractedData.weight && (
                  <div><strong>Weight:</strong> {images.extractedData.weight}</div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 text-center shrink-0">
          <button
            onClick={onClose}
            className="bg-black text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors text-lg"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
// Handle photo click to show full size
// Handle photo click to show full size - with better debugging
const handlePhotoClick = (stop) => {
  console.log("=== STOP DATA FOR MODAL ===");
  console.log("Stop object:", stop);
  console.log("Label photo (full):", stop.labelPhoto?.substring(0, 100) + "...");
  console.log("Label preview (small):", stop.labelPreview?.substring(0, 100) + "...");
  console.log("Parcel photo (full):", stop.parcelPhoto?.substring(0, 100) + "...");
  console.log("Parcel preview (small):", stop.parcelPreview?.substring(0, 100) + "...");
  console.log("Original photos:", stop.originalPhotos);
  
  // Try to get the highest quality images available
  const labelPhoto = stop.labelPhoto || 
                    stop.originalPhotos?.label?.data || 
                    stop.labelPreview;
  
  const parcelPhoto = stop.parcelPhoto || 
                     stop.originalPhotos?.parcel?.data || 
                     stop.parcelPreview;

  console.log("Using label photo:", labelPhoto?.substring(0, 100) + "...");
  console.log("Using parcel photo:", parcelPhoto?.substring(0, 100) + "...");
  
  setSelectedImages({
    barcodePhoto: stop.barcodePhoto || stop.barcodePreview,
    parcelPhoto: stop.parcelPhoto || stop.parcelPreview,
    labelPhoto: stop.labelPhoto || stop.labelPreview,
    extractedData: stop.extractedData
  });
};
// Open Google Maps with directions from current location to stop
const handleGoogleMapsDirections = async (stop, stopIndex, event) => {
  event.stopPropagation();
  
  try {
    // Get user's current location first
    setIsGettingLocation(true);
    setLocationError(null);

    const getUserLocation = () => {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
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
            reject(new Error(errorMessage));
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        );
      });
    };

    // Get current location
    const userLocation = await getUserLocation();
    
    // Encode coordinates for Google Maps
    const origin = `${userLocation.lat},${userLocation.lng}`;
    const destination = encodeURIComponent(stop.address);
    
    // Create Google Maps URL with directions
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    
    // Open in new tab
    window.open(googleMapsUrl, '_blank');
    
    setIsGettingLocation(false);
    
  } catch (error) {
    console.error('Error getting location for directions:', error);
    setLocationError(error.message);
    setIsGettingLocation(false);
    
    // Fallback: Open Google Maps with just the destination (no origin)
    const destination = encodeURIComponent(stop.address);
    const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    window.open(fallbackUrl, '_blank');
    
    alert('Using destination only. Please allow location access for better directions.');
  }
};

// Close modal
const handleCloseModal = () => {
  setSelectedImages(null);
};

  const [dbReady, setDbReady] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeId = searchParams.get('route');

  // Fixed SEUR depot location with coordinates
  const seurDepot = {
    name: "SEUR Depot",
    address: "Pasealekua Mateo Errota, 15, Nave P, 20014 Donostia, Gipuzkoa, Spain",
    lat: 43.3023384,
    lng: -1.9451188
  };

  // Initialize DB
  useEffect(() => {
    const initDB = async () => {
      try {
        await seurDB.init();
        setDbReady(true);
      } catch (error) {
        console.error('Failed to initialize DB:', error);
      }
    };
    initDB();
  }, []);

  // Load data from IndexedDB
// Load data from IndexedDB
// Load data from IndexedDB - FIXED
// Load data from IndexedDB - UPDATED to include deliveryStatus
useEffect(() => {
  if (!dbReady) return;

  const loadData = async () => {
    try {
      if (routeId) {
        const routeToLoad = await seurDB.getRoute(parseInt(routeId));
        if (routeToLoad) {
          setDeliveries(routeToLoad.deliveries);
          setGeocodedDeliveries(routeToLoad.geocodedDeliveries);
          setOptimizedRoute(routeToLoad.optimizedRoute);
          if (routeToLoad.photos) {
            setCapturedPhotos(routeToLoad.photos);
          }
          // ✅ LOAD DELIVERY STATUS
          if (routeToLoad.deliveryStatus) {
            setDeliveryStatus(routeToLoad.deliveryStatus);
          }
          setCurrentStep('complete');
        }
      } else {
        // Load current photos
        const savedPhotos = await seurDB.getPhotos();
        setCapturedPhotos(savedPhotos);
        
        // Load recent routes for dropdown
        const allRoutes = await seurDB.getAllRoutes();
        setSavedRoutes(allRoutes);

        // Check if we have any routes with optimized data
        const currentRoute = allRoutes.find(route => 
          route.optimizedRoute && route.optimizedRoute.length > 0
        );
        
        if (currentRoute) {
          setDeliveries(currentRoute.deliveries || []);
          setGeocodedDeliveries(currentRoute.geocodedDeliveries || []);
          setOptimizedRoute(currentRoute.optimizedRoute);
          if (currentRoute.photos) {
            setCapturedPhotos(currentRoute.photos);
          }
          // ✅ LOAD DELIVERY STATUS
          if (currentRoute.deliveryStatus) {
            setDeliveryStatus(currentRoute.deliveryStatus);
          }
          setCurrentStep('complete');
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  loadData();
}, [dbReady, routeId]);

useEffect(() => {
  if (optimizedRoute.length > 0 && currentStep !== 'complete') {
    setCurrentStep('complete');
  }
}, [optimizedRoute.length, currentStep]);

  // Save photos to IndexedDB
  useEffect(() => {
    if (!dbReady) return;

    const saveData = async () => {
      try {
        if (!routeId) {
          await seurDB.savePhotos(capturedPhotos);
        }
      } catch (error) {
        console.error('Error saving photos:', error);
      }
    };

    saveData();
  }, [capturedPhotos, dbReady, routeId]);

  // Clear all saved data
// Clear all saved data - UPDATED
const clearSavedData = async () => {
  setDeliveries([]);
  setGeocodedDeliveries([]);
  setOptimizedRoute([]);
  setCurrentStep('photo-capture'); // Reset to first step
  setClickedStop(null);
  setFocusedSegment(null);
  setCapturedPhotos([]);
  setCurrentOrderPhotos({ label: null, parcel: null });
  setPhotoStep('label');
  setActiveTab('route');
  
  if (dbReady) {
    try {
      await seurDB.clearAll();
      const updatedRoutes = await seurDB.getAllRoutes();
      setSavedRoutes(updatedRoutes);
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  }
  
  router.push('/');
};

  // Create new route
 // Create new route - UPDATED to preserve state
// In createNewRoute, add deliveryStatus
const createNewRoute = async () => {
  if (optimizedRoute.length > 0 && !routeId && dbReady) {
    const routeDate = new Date().toISOString().split('T')[0];
    const routeTime = new Date().toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const newRoute = {
      id: Date.now(),
      date: routeDate,
      time: routeTime,
      stops: optimizedRoute.length,
      deliveries: deliveries,
      geocodedDeliveries: geocodedDeliveries,
      optimizedRoute: optimizedRoute,
      photos: capturedPhotos,
      deliveryStatus: deliveryStatus, // ✅ Save delivery status
      createdAt: new Date().toISOString()
    };
    
    try {
      await seurDB.saveRoute(newRoute);
      const updatedRoutes = await seurDB.getAllRoutes();
      setSavedRoutes(updatedRoutes);
    } catch (error) {
      console.error('Error saving route:', error);
    }
  }
  
  // Reset for new route
  setDeliveries([]);
  setGeocodedDeliveries([]);
  setOptimizedRoute([]);
  setDeliveryStatus({}); // ✅ Reset delivery status
  setCurrentStep('photo-capture');
  setClickedStop(null);
  setFocusedSegment(null);
  setActiveTab('route');
  setCapturedPhotos([]);
  setCurrentOrderPhotos({ label: null, parcel: null });
  setPhotoStep('label');
  router.push('/');
};

  // Load route by ID
  // Load route by ID - UPDATED to restore complete state
// In your loadRoute function, add this:
const loadRoute = async (routeId) => {
  try {
    const route = await seurDB.getRoute(routeId);
    if (route) {
      setDeliveries(route.deliveries);
      setGeocodedDeliveries(route.geocodedDeliveries);
      setOptimizedRoute(route.optimizedRoute);
      if (route.photos) {
        setCapturedPhotos(route.photos);
      }
      // ✅ Load delivery status
      setDeliveryStatus(route.deliveryStatus || {});
      setCurrentStep('complete');
      router.push(`/?route=${routeId}`);
    }
    setShowRoutesList(false);
  } catch (error) {
    console.error('Error loading route:', error);
  }
};

// Mark stop as delivered
// Mark stop as delivered - FIXED to properly find and save route
// Mark stop as delivered - SIMPLE VERSION (just change status)
const markAsDelivered = async (stopIndex) => {
  const newStatus = {
    ...deliveryStatus,
    [stopIndex]: 'delivered'
  };
  
  setDeliveryStatus(newStatus);
  
  // ✅ Save to IndexedDB
  if (dbReady && optimizedRoute.length > 0) {
    try {
      console.log('🔄 Saving delivery status...');
      
      // Get ALL routes to find the current one
      const allRoutes = await seurDB.getAllRoutes();
      
      // Find the current route
      let currentRoute = null;
      
      if (routeId) {
        currentRoute = allRoutes.find(route => route.id === parseInt(routeId));
      } else {
        currentRoute = allRoutes
          .filter(route => route.optimizedRoute && route.optimizedRoute.length > 0)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      }
      
      if (currentRoute) {
        // Update the route with new delivery status
        const updatedRoute = {
          ...currentRoute,
          deliveryStatus: newStatus,
          updatedAt: new Date().toISOString()
        };
        
        await seurDB.saveRoute(updatedRoute);
        console.log('✅ Delivery status saved successfully!');
        
        // Update the saved routes list
        const updatedRoutes = await seurDB.getAllRoutes();
        setSavedRoutes(updatedRoutes);
      }
    } catch (error) {
      console.error('❌ Error saving delivery status:', error);
    }
  }
  
  const stop = optimizedRoute[stopIndex];
  console.log(`✅ Marked as delivered: ${stop.clientName}`);
}; 
// Start editing address for a stop
const startEditingAddress = (stopIndex) => {
  setEditingStop(stopIndex);
  setEditedAddress(optimizedRoute[stopIndex].address);
};

// Cancel editing
const cancelEditing = () => {
  setEditingStop(null);
  setEditedAddress('');
};

// Save edited address and re-geocode
const saveEditedAddress = async (stopIndex) => {
  if (!editedAddress.trim()) {
    alert('Please enter a valid address');
    return;
  }

  setProcessing(true);
  
  try {
    // Update the stop with new address
    const updatedRoute = [...optimizedRoute];
    updatedRoute[stopIndex] = {
      ...updatedRoute[stopIndex],
      address: editedAddress.trim(),
      lat: null, // Clear coordinates to force re-geocoding
      lng: null,
      placeName: null
    };

    setOptimizedRoute(updatedRoute);
    setEditingStop(null);
    setEditedAddress('');

    // Re-geocode just this address
    const geocodedStop = await geocodeSingleAddress(updatedRoute[stopIndex]);
    
    if (geocodedStop.lat && geocodedStop.lng) {
      // Update the route with new coordinates
      const finalUpdatedRoute = [...updatedRoute];
      finalUpdatedRoute[stopIndex] = geocodedStop;
      setOptimizedRoute(finalUpdatedRoute);
      
      // Re-optimize the entire route with the new position
      await reoptimizeRoute(finalUpdatedRoute);
      
      alert(`✅ Address updated and route re-optimized!`);
    } else {
      alert('❌ Could not geocode the new address. Please check the address and try again.');
    }

  } catch (error) {
    console.error('Error updating address:', error);
    alert('❌ Error updating address. Please try again.');
  } finally {
    setProcessing(false);
  }
};

// Geocode single address
// Geocode single address
const geocodeSingleAddress = async (delivery) => {
  try {
    // Create clean version without images
    const cleanDelivery = {
      clientName: delivery.clientName,
      address: delivery.address,
      phoneNumber: delivery.phoneNumber,
      barcode: delivery.barcode,
      sender: delivery.sender,
      weight: delivery.weight,
      source: delivery.source,
      photoSetId: delivery.photoSetId,
    };

    const response = await fetch(SERVER_URL+'/api/geocode-addresses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        addresses: [cleanDelivery], // Send only one address without images
        depot: seurDepot
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
 
    if (data.success && data.deliveries.length > 0) {
      const geocodedDelivery = data.deliveries[0];
      
      // Validate coordinates before returning
      const isValidCoord = geocodedDelivery.lat && 
                          geocodedDelivery.lng && 
                          !isNaN(geocodedDelivery.lat) && 
                          !isNaN(geocodedDelivery.lng);
      
      if (isValidCoord) {
        return {
          ...delivery,
          lat: geocodedDelivery.lat,
          lng: geocodedDelivery.lng,
          placeName: geocodedDelivery.placeName
        };
      } else {
        throw new Error('Invalid coordinates received from geocoding');
      }
    } else {
      throw new Error('Geocoding failed');
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    return delivery;
  }
};

// Re-optimize the entire route
const reoptimizeRoute = async (deliveriesWithCoords) => {
  const validDeliveries = deliveriesWithCoords.filter(d => d.lat && d.lng);
  
  if (validDeliveries.length === 0) return;

  try {
    // Create clean version for optimization
    const cleanDeliveriesForOptimization = validDeliveries.map(delivery => ({
      clientName: delivery.clientName,
      address: delivery.address,
      phoneNumber: delivery.phoneNumber,
      barcode: delivery.barcode,
      sender: delivery.sender,
      weight: delivery.weight,
      source: delivery.source,
      photoSetId: delivery.photoSetId,
      lat: delivery.lat,
      lng: delivery.lng,
      placeName: delivery.placeName,
    }));

    const response = await fetch(SERVER_URL+'/api/optimize-route', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        deliveries: cleanDeliveriesForOptimization,
        depot: seurDepot
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      // Recombine optimized data with ALL image data
      const routeWithPhotos = data.route.map((optimizedStop, index) => {
        const originalDeliveryWithPhotos = validDeliveries.find(d => 
          d.photoSetId === optimizedStop.photoSetId
        ) || validDeliveries[index];
        
        return {
          ...optimizedStop,
          barcodePhoto: originalDeliveryWithPhotos?.barcodePhoto,
          barcodePreview: originalDeliveryWithPhotos?.barcodePreview,
          parcelPhoto: originalDeliveryWithPhotos?.parcelPhoto,
          parcelPreview: originalDeliveryWithPhotos?.parcelPreview,
          labelPhoto: originalDeliveryWithPhotos?.labelPhoto,
          labelPreview: originalDeliveryWithPhotos?.labelPreview,
          originalPhotos: originalDeliveryWithPhotos?.originalPhotos,
          extractedData: originalDeliveryWithPhotos?.extractedData,
          photoSetId: originalDeliveryWithPhotos?.photoSetId,
          allBarcodes: originalDeliveryWithPhotos?.allBarcodes,
          matchedBarcode: originalDeliveryWithPhotos?.matchedBarcode
        };
      });
      
      setOptimizedRoute(routeWithPhotos);
      console.log('✅ Route re-optimized with new address!');
    }
  } catch (error) {
    console.error('Re-optimization error:', error);
  }
};

// Preserve state when we have optimized route but no route ID
useEffect(() => {
  if (optimizedRoute.length > 0 && !routeId && currentStep !== 'complete') {
    setCurrentStep('complete');
  }
}, [optimizedRoute.length, routeId, currentStep]);
  // Delete route
  const deleteRoute = async (routeId, event) => {
    event.stopPropagation();
    try {
      await seurDB.deleteRoute(routeId);
      const updatedRoutes = await seurDB.getAllRoutes();
      setSavedRoutes(updatedRoutes);
      
      if (routeId && routeId.toString() === routeId) {
        setDeliveries([]);
        setGeocodedDeliveries([]);
        setOptimizedRoute([]);
        setCurrentStep('photo-capture');
        router.push('/');
      }
    } catch (error) {
      console.error('Error deleting route:', error);
    }
  };

  // Handle photo capture
// Handle photo capture - PROCESS IMMEDIATELY without binary storage
// Handle photo capture - PROCESS IMMEDIATELY via server
// Handle photo capture - STORE ORIGINAL QUALITY
// Handle photo capture - PROPERLY STORE FULL QUALITY
// Handle photo capture - BOTH photos but only process label
// Handle photo capture - 3 STEP PROCESS
const handlePhotoCapture = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = () => {
    const originalData = reader.result;
    
    // Create preview
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 50;
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);
      const previewData = canvas.toDataURL('image/jpeg', 0.8);

      const photoData = {
        id: Date.now(),
        data: originalData,
        preview: previewData,
        timestamp: new Date().toISOString(),
        type: photoStep,
        file: file
      };

      console.log(`📸 Captured ${photoStep} photo`);

      if (photoStep === 'barcode') {
        setCurrentOrderPhotos(prev => ({ ...prev, barcode: photoData }));
        setPhotoStep('parcel');
      } else if (photoStep === 'parcel') {
        setCurrentOrderPhotos(prev => ({ ...prev, parcel: photoData }));
        setPhotoStep('label');
      } else {
        // All 3 photos captured
        setCurrentOrderPhotos(prev => ({ ...prev, label: photoData }));
        
        const orderPhotos = {
          id: Date.now(),
          barcode: currentOrderPhotos.barcode, // Barcode photo
          parcel: currentOrderPhotos.parcel,   // Parcel photo  
          label: photoData,                    // Label photo
          processed: false,
          processing: false
        };
        
        setCapturedPhotos(prev => [...prev, orderPhotos]);
        
        // PROCESS ONLY THE LABEL FILE with AI (for delivery data)
        processSinglePhotoOrder(orderPhotos, photoData.file);
        
        setCurrentOrderPhotos({ barcode: null, parcel: null, label: null });
        setPhotoStep('barcode'); // Reset to first step
      }
    };
    img.src = originalData;
  };
  reader.readAsDataURL(file);
};
// Process single photo order (LABEL ONLY)
// Process single photo order (LABEL ONLY) - No binary storage
// Process single photo order using server endpoint
const processSinglePhotoOrder = async (photoSet, labelFile) => {
  if (!labelFile) return;
  
  // Set this photo set as processing
  setCapturedPhotos(prev => 
    prev.map(ps => ps.id === photoSet.id ? { ...ps, processing: true } : ps)
  );

  try {
    console.log("Processing single photo set via server:", photoSet.id);

    // Create FormData for file upload to server
    const formData = new FormData();
    formData.append('labelImage', labelFile);

    // Send to server for processing
    const response = await fetch(`${SERVER_URL}/api/process-single-photo`, {
      method: 'POST',
      body: formData, // No Content-Type header for FormData
    });

    const data = await response.json();
    
    if (data.success && data.delivery) {
      console.log("Server extracted data:", data.delivery);
      
      // Update this single photo set with extracted data
      const updatedPhotoSet = {
        ...photoSet,
        extractedData: data.delivery,
        processed: true,
        processing: false,
        serverProcessed: true // Flag for server processing
      };
      
      setCapturedPhotos(prev => 
        prev.map(ps => ps.id === photoSet.id ? updatedPhotoSet : ps)
      );
      
      console.log(`✅ Single order processed successfully via server!`);
      
    } else {
      throw new Error(data.error || 'Server processing failed');
    }

  } catch (error) {
    console.error("Server photo processing failed:", error);
    
    // Mark as processed but failed
    const updatedPhotoSet = {
      ...photoSet,
      processed: true,
      processing: false,
      error: error.message,
      serverProcessed: true
    };
    
    setCapturedPhotos(prev => 
      prev.map(ps => ps.id === photoSet.id ? updatedPhotoSet : ps)
    );
    
    console.error(`❌ Failed to process order: ${error.message}`);
  }
};

  // Process captured photos with AI and then request PDA upload
  // In your processCapturedPhotos function, update the API call:

// Process captured photos with FREE OCR + OpenAI
// In your processCapturedPhotos function, update to use client-side OCR:

// Process captured photos with FREE Client-side OCR + OpenAI
// Process captured photos with SERVER-SIDE OCR + OpenAI
// Process captured photos with CLIENT-SIDE OCR + Server AI
// Remove captured parcel
const removeParcel = (parcelId) => {
  setCapturedPhotos(prev => prev.filter(parcelSet => parcelSet.id !== parcelId));
};
const testImageQuality = () => {
  if (optimizedRoute.length > 0) {
    const firstStop = optimizedRoute[0];
    if (firstStop.labelPhoto) {
      const img = new Image();
      img.onload = () => {
        console.log("✅ Full quality image dimensions:", img.naturalWidth, "x", img.naturalHeight);
      };
      img.onerror = () => {
        console.log("❌ Full quality image failed to load");
      };
      img.src = firstStop.labelPhoto;
    }
  }
};
  // Combine REAL AI photo data with PDA list data
 // Combine REAL AI photo data with PDA list data
// Combine REAL AI photo data with PDA list data


// Add this helper function for name similarity calculation
 
// Levenshtein distance calculation
const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  
  // Initialize matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};
  // Helper functions for matching REAL data
  

  

  

  

  // Handle PDA/list upload and match with photos
 // Handle PDA/list upload and match with photos
// Handle PDA/list upload - SERVER-SIDE processing
// Handle PDA/list upload - SERVER-SIDE processing with PHOTO DATA
 

const geocodeAddresses = async (deliveriesToGeocode) => {
  if (deliveriesToGeocode.length === 0) return;
  
  setProcessing(true);
  setCurrentStep('geocoding');
  
  try {
    // Create a clean version WITHOUT binary image data for geocoding
    const cleanDeliveriesForGeocoding = deliveriesToGeocode.map(delivery => ({
      // Only send essential data needed for geocoding
      clientName: delivery.clientName,
      address: delivery.address,
      phoneNumber: delivery.phoneNumber,
      barcode: delivery.barcode,
      sender: delivery.sender,
      weight: delivery.weight,
      source: delivery.source,
      photoSetId: delivery.photoSetId,
      // NO IMAGE DATA - this is what's causing the payload too large error
    }));

    console.log("Sending clean deliveries for geocoding (NO IMAGES):", cleanDeliveriesForGeocoding.length);
    
    const response = await fetch(SERVER_URL+'/api/geocode-addresses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        addresses: cleanDeliveriesForGeocoding,
        depot: seurDepot
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      // ✅ CRITICAL FIX: RECOMBINE geocoded data with ALL image data
      const deliveriesWithPhotos = data.deliveries.map((geocodedDelivery, index) => {
        const originalDelivery = deliveriesToGeocode[index];
        
        console.log("🔍 Restoring ALL images for:", originalDelivery.clientName);
        
        return {
          ...geocodedDelivery, // Geocoded data from server
          // ✅ RESTORE ALL IMAGE DATA (but don't send to server)
          barcodePhoto: originalDelivery.barcodePhoto,
          barcodePreview: originalDelivery.barcodePreview,
          parcelPhoto: originalDelivery.parcelPhoto, 
          parcelPreview: originalDelivery.parcelPreview,
          labelPhoto: originalDelivery.labelPhoto,
          labelPreview: originalDelivery.labelPreview,
          originalPhotos: originalDelivery.originalPhotos,
          extractedData: originalDelivery.extractedData,
          photoSetId: originalDelivery.photoSetId,
          source: originalDelivery.source,
          allBarcodes: originalDelivery.allBarcodes,
          matchedBarcode: originalDelivery.matchedBarcode
        };
      });
      
      setGeocodedDeliveries(deliveriesWithPhotos);
      
      const successfulGeocodes = deliveriesWithPhotos.filter(d => d.lat && d.lng).length;
      const photosCount = deliveriesWithPhotos.filter(d => d.labelPhoto).length;
      
      console.log("✅ Final geocoded deliveries with images restored");
      
      alert(`✅ Geocoded ${successfulGeocodes}/${deliveriesWithPhotos.length} addresses! ${photosCount} stops have photos. Now optimizing route...`);
      
      await optimizeRoute(deliveriesWithPhotos);
    } else {
      alert('❌ Geocoding error: ' + data.error);
    }
    
  } catch (error) {
    console.error('Geocoding error:', error);
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
    // Create clean version WITHOUT binary image data for optimization
    const cleanDeliveriesForOptimization = deliveriesWithCoords.map(delivery => ({
      // Only send essential data needed for optimization
      clientName: delivery.clientName,
      address: delivery.address,
      phoneNumber: delivery.phoneNumber,
      barcode: delivery.barcode,
      sender: delivery.sender,
      weight: delivery.weight,
      source: delivery.source,
      photoSetId: delivery.photoSetId,
      lat: delivery.lat,
      lng: delivery.lng,
      placeName: delivery.placeName,
    }));

    console.log(`🔄 Optimizing ${cleanDeliveriesForOptimization.length} stops...`);
    
    const response = await fetch(SERVER_URL+'/api/optimize-route', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        deliveries: cleanDeliveriesForOptimization,
        depot: seurDepot
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      // ✅ CRITICAL FIX: RECOMBINE optimized data with ALL image data
      const routeWithPhotos = data.route.map((optimizedStop, index) => {
        // Find the original delivery with ALL images that matches this optimized stop
        const originalDeliveryWithPhotos = deliveriesWithCoords.find(d => 
          d.photoSetId === optimizedStop.photoSetId
        ) || deliveriesWithCoords[index];
        
        console.log("🖼️ Adding ALL images to optimized stop:", optimizedStop.clientName, {
          hasBarcodePhoto: !!originalDeliveryWithPhotos?.barcodePhoto,
          hasParcelPhoto: !!originalDeliveryWithPhotos?.parcelPhoto,
          hasLabelPhoto: !!originalDeliveryWithPhotos?.labelPhoto
        });
        
        return {
          ...optimizedStop, // Optimized route data from server
          // ✅ RESTORE ALL IMAGE DATA
          barcodePhoto: originalDeliveryWithPhotos?.barcodePhoto,
          barcodePreview: originalDeliveryWithPhotos?.barcodePreview,
          parcelPhoto: originalDeliveryWithPhotos?.parcelPhoto,
          parcelPreview: originalDeliveryWithPhotos?.parcelPreview,
          labelPhoto: originalDeliveryWithPhotos?.labelPhoto,
          labelPreview: originalDeliveryWithPhotos?.labelPreview,
          originalPhotos: originalDeliveryWithPhotos?.originalPhotos,
          extractedData: originalDeliveryWithPhotos?.extractedData,
          photoSetId: originalDeliveryWithPhotos?.photoSetId,
          allBarcodes: originalDeliveryWithPhotos?.allBarcodes,
          matchedBarcode: originalDeliveryWithPhotos?.matchedBarcode
        };
      });
      
      setOptimizedRoute(routeWithPhotos);
      setCurrentStep('complete');
      
      const totalDistance = calculateTotalDistance(routeWithPhotos);
      const photosCount = routeWithPhotos.filter(stop => stop.labelPhoto).length;
      
      console.log("✅ Final optimized route with ALL images:", routeWithPhotos.map(stop => ({
        stop: stop.stopNumber,
        clientName: stop.clientName,
        hasBarcodePhoto: !!stop.barcodePhoto,
        hasParcelPhoto: !!stop.parcelPhoto,
        hasLabelPhoto: !!stop.labelPhoto
      })));
      
      alert(`✅ Route optimized with ${data.optimizedCount} stops! Total distance: ${totalDistance}. ${photosCount} stops have photos.`);
    } else {
      alert('❌ Optimization error: ' + data.error);
    }
    
  } catch (error) {
    alert('Optimization error: ' + error.message);
  } finally {
    setProcessing(false);
  }
};

// Helper function to calculate total route distance
const calculateTotalDistance = (route) => {
  let totalMeters = 0;
  route.forEach(stop => {
    // Extract numeric distance from string like "1.2 km" or "500 m"
    const distanceText = stop.distanceFromPrevious;
    if (distanceText && distanceText !== '0 km') {
      if (distanceText.includes('km')) {
        totalMeters += parseFloat(distanceText) * 1000;
      } else if (distanceText.includes('m')) {
        totalMeters += parseInt(distanceText);
      }
    }
  });
  
  if (totalMeters < 1000) {
    return `${Math.round(totalMeters)} m`;
  } else {
    return `${(totalMeters / 1000).toFixed(1)} km`;
  }
}; 

// Handle parcel capture (barcode + parcel photos)
// Handle parcel capture (barcode + parcel photos)
const handleParcelCapture = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = () => {
    const originalData = reader.result;
    
    // Create preview
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 50;
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);
      const previewData = canvas.toDataURL('image/jpeg', 0.8);

      const photoData = {
        id: Date.now(),
        data: originalData,
        preview: previewData,
        timestamp: new Date().toISOString(),
        type: photoStep,
        file: file
      };

      console.log(`📸 Captured ${photoStep} photo for parcel`);

      if (photoStep === 'barcode') {
        setCurrentOrderPhotos(prev => ({ ...prev, barcode: photoData }));
        setPhotoStep('parcel');
      } else {
        // Both parcel photos captured
        setCurrentOrderPhotos(prev => ({ ...prev, parcel: photoData }));
        
        const parcelSet = {
          id: Date.now(),
          barcode: currentOrderPhotos.barcode,
          parcel: photoData,
          barcodeProcessed: false,
          processing: false
        };
        
        setCapturedPhotos(prev => [...prev, parcelSet]);
        
        // PROCESS THE BARCODE with AI
        processBarcodePhoto(parcelSet, currentOrderPhotos.barcode.file);
        
        setCurrentOrderPhotos({ barcode: null, parcel: null });
        setPhotoStep('barcode'); // Reset to first step
      }
    };
    img.src = originalData;
  };
  reader.readAsDataURL(file);
};

// Handle label capture
const handleLabelCapture = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = () => {
    const originalData = reader.result;
    
    // Create preview
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 50;
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);
      const previewData = canvas.toDataURL('image/jpeg', 0.8);

      const labelData = {
        id: Date.now(),
        data: originalData,
        preview: previewData,
        timestamp: new Date().toISOString(),
        file: file,
        processing: false,
        processed: false
      };
      
      setLabelPhotos(prev => [...prev, labelData]);
      
      // Process the label with AI
      processLabelPhoto(labelData, file);
    };
    img.src = originalData;
  };
  reader.readAsDataURL(file);
};

// Process label photo with AI
const processLabelPhoto = async (labelData, labelFile) => {
  // Set this label as processing
  setLabelPhotos(prev => 
    prev.map(label => label.id === labelData.id ? { ...label, processing: true } : label)
  );

  try {
    console.log("Processing label photo via server:", labelData.id);

    // Create FormData for file upload to server
    const formData = new FormData();
    formData.append('labelImage', labelFile);

    // Send to server for processing
    const response = await fetch(`${SERVER_URL}/api/process-single-photo`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    
    if (data.success && data.delivery) {
      console.log("Server extracted data from label:", data.delivery);
      
      // Update this label with extracted data
      const updatedLabel = {
        ...labelData,
        extractedData: data.delivery,
        processed: true,
        processing: false
      };
      
      setLabelPhotos(prev => 
        prev.map(label => label.id === labelData.id ? updatedLabel : label)
      );
      
      console.log(`✅ Label processed successfully via server!`);
      
    } else {
      throw new Error(data.error || 'Server processing failed');
    }

  } catch (error) {
    console.error("Server label processing failed:", error);
    
    // Mark as processed but failed
    const updatedLabel = {
      ...labelData,
      processed: true,
      processing: false,
      error: error.message
    };
    
    setLabelPhotos(prev => 
      prev.map(label => label.id === labelData.id ? updatedLabel : label)
    );
    
    console.error(`❌ Failed to process label: ${error.message}`);
  }
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
  const destination = encodeURIComponent(delivery.address);
  
  // Open Google Maps with only destination (no origin)
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
  
  window.open(googleMapsUrl, '_blank');
};

  // Handle stop click
// Handle stop click - ONLY when clicking on name/address, not photos
const handleStopClick = (stopIndex, event) => {
  // Check if the click was on a photo element
  const isPhotoClick = event.target.closest('img') || 
                      event.target.closest('.text-center') || 
                      event.target.closest('.flex.space-x-3');
  
  // Only focus if NOT clicking on photos
  if (!isPhotoClick && typeof window !== 'undefined' && window.focusOnSegment) {
    window.focusOnSegment(stopIndex);
    setActiveTab('map');
    setClickedStop(stopIndex);
  }
};

  // Handle Google Maps button click
  const handleGoogleMapsClick = (stop, event) => {
  event.stopPropagation();
  
  // Just open Google Maps directly to the destination
  openGoogleMapsDirections(stop);
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
  // If we have an optimized route, we're always complete
  if (optimizedRoute.length > 0 && step === 'complete') {
    return 'current';
  }
  
  if (step === currentStep) return 'current';
  if (
    (step === 'photo-capture' && currentStep !== 'photo-capture') ||
    (step === 'processing-photos' && currentStep === 'geocoding') ||
    (step === 'processing-photos' && currentStep === 'optimizing') ||
    (step === 'processing-photos' && currentStep === 'complete') ||
    (step === 'geocoding' && currentStep === 'optimizing') ||
    (step === 'geocoding' && currentStep === 'complete') ||
    (step === 'optimizing' && currentStep === 'complete')
  ) return 'completed';
  return 'pending';
};

  // Get current route name for display
  const getCurrentRouteName = () => {
    if (routeId) {
      const route = savedRoutes.find(r => r.id.toString() === routeId);
      return route ? `Route from ${route.date}` : 'Current Route';
    }
    return 'Current Route';
  };

  // Remove captured photo set
  const removePhotoSet = (photoSetId) => {
    setCapturedPhotos(prev => prev.filter(photoSet => photoSet.id !== photoSetId));
  };

  // Match parcels with labels using barcode
// Match parcels with labels using barcode
// Match parcels with labels using MULTIPLE barcodes
// Match parcels with labels using MULTIPLE barcodes - FIXED IMAGE PROPAGATION
// Enhanced match function that includes unmatched labels
const matchParcelsWithLabels = async () => {
  setProcessing(true);
  
  // Process: Match each parcel with its label using ANY of the barcodes
  const matchedDeliveries = capturedPhotos.map(parcelSet => {
    // Get all barcodes from this parcel
    const parcelBarcodes = parcelSet.barcodes || [parcelSet.barcodeFromAI].filter(Boolean);
    
    console.log(`🔍 Matching parcel ${parcelSet.id} with barcodes:`, parcelBarcodes);

    // Find matching label by ANY of the barcodes
    let matchingLabel = null;
    let matchedBarcode = null;

    for (const barcode of parcelBarcodes) {
      matchingLabel = labelPhotos.find(label => {
        const labelBarcode = label.extractedData?.barcode;
        const isMatch = labelBarcode && barcode && labelBarcode === barcode;
        
        if (isMatch) {
          console.log(`✅ MATCH FOUND: Parcel barcode "${barcode}" = Label barcode "${labelBarcode}"`);
          matchedBarcode = barcode;
        }
        
        return isMatch;
      });
      
      if (matchingLabel) break; // Stop at first match
    }
    
    if (matchingLabel) {
      console.log(`✅ FINAL MATCH: Parcel ${parcelSet.id} with Label ${matchingLabel.id} using barcode: ${matchedBarcode}`);
    } else {
      console.log(`❌ NO MATCH: Parcel ${parcelSet.id} - Tried barcodes:`, parcelBarcodes);
    }

    // ✅ CRITICAL FIX: Preserve ALL image data
    return {
      ...(matchingLabel?.extractedData || {
        clientName: 'Unknown Client',
        address: 'Address not matched',
        source: 'unmatched'
      }),
      // ✅ PRESERVE PARCEL IMAGES
      barcodePhoto: parcelSet.barcode?.data,
      barcodePreview: parcelSet.barcode?.preview,
      parcelPhoto: parcelSet.parcel?.data,
      parcelPreview: parcelSet.parcel?.preview,
      
      // ✅ PRESERVE LABEL IMAGES
      labelPhoto: matchingLabel?.data,
      labelPreview: matchingLabel?.preview,
      
      // ✅ PRESERVE ORIGINAL DATA
      originalPhotos: parcelSet,
      extractedData: matchingLabel?.extractedData,
      photoSetId: parcelSet.id,
      barcodeNumber: matchedBarcode || parcelBarcodes[0],
      allBarcodes: parcelBarcodes,
      matchedBarcode: matchedBarcode,
      source: matchingLabel ? 'matched' : 'parcel-only',
      matchStatus: matchingLabel ? 'matched' : 'unmatched'
    };
  });

  // ✅ ADD UNMATCHED LABELS AS SEPARATE DELIVERIES
  const unmatchedLabels = labelPhotos.filter(label => {
    // Check if this label was used in any match
    return !matchedDeliveries.some(delivery => 
      delivery.extractedData?.barcode === label.extractedData?.barcode
    );
  });

  // Create deliveries for unmatched labels
  const unmatchedLabelDeliveries = unmatchedLabels.map(label => ({
    ...(label.extractedData || {
      clientName: 'Unknown Client',
      address: 'Address from label',
      source: 'label-only'
    }),
    // Label data only (no parcel photos)
    labelPhoto: label.data,
    labelPreview: label.preview,
    extractedData: label.extractedData,
    photoSetId: `label-${label.id}`,
    barcodeNumber: label.extractedData?.barcode,
    source: 'label-only',
    matchStatus: 'unmatched',
    hasNoParcel: true,
    labelOnly: true
  }));

  // Combine matched deliveries with unmatched labels
  const allDeliveries = [...matchedDeliveries, ...unmatchedLabelDeliveries];

  const matchedCount = matchedDeliveries.filter(d => d.source === 'matched').length;
  const unmatchedCount = unmatchedLabelDeliveries.length;
  
  console.log(`📊 Matching Results: ${matchedCount}/${capturedPhotos.length} parcels matched, ${unmatchedCount} unmatched labels`);
  
  // Debug: Check if images are preserved
  console.log('🖼️ Image Preservation Check:', allDeliveries.map(d => ({
    client: d.clientName,
    source: d.source,
    hasBarcodePhoto: !!d.barcodePhoto,
    hasParcelPhoto: !!d.parcelPhoto, 
    hasLabelPhoto: !!d.labelPhoto,
    matchStatus: d.matchStatus
  })));
  
  setDeliveries(allDeliveries);
  await geocodeAddresses(allDeliveries);
  setProcessing(false);
};


// Process barcode photo with AI
// Process barcode photo with QuaggaJS (FREE barcode detection)
// Process barcode photo with ChatGPT (multiple barcodes detection)

// Add this function for bulk refetch
const refetchAllIncompleteData = async () => {
  const incompleteStops = optimizedRoute.filter((stop, index) => 
    needsDataRefetch(stop) && deliveryStatus[index] !== 'delivered'
  );

  if (incompleteStops.length === 0) {
    alert('No stops with incomplete data found.');
    return;
  }

  setProcessing(true);
  
  try {
    console.log(`📡 Refetching data for ${incompleteStops.length} stops...`);
    let successCount = 0;
    
    for (const stop of incompleteStops) {
      const stopIndex = optimizedRoute.findIndex(s => s === stop);
      
      // Your refetch logic here (similar to individual refetch)
      // This would be a more complex implementation for bulk operations
    }
    
    alert(`✅ Successfully refetched data for ${successCount} out of ${incompleteStops.length} stops`);
    
  } catch (error) {
    console.error('Error during bulk refetch:', error);
    alert('❌ Error refetching data. Please try again.');
  } finally {
    setProcessing(false);
  }
};

// Detect MULTIPLE barcodes with ChatGPT
// Process barcode photo with ChatGPT (multiple barcodes detection)
const processBarcodePhoto = async (parcelSet, barcodeFile) => {
  try {
    console.log("Processing barcode image with ChatGPT for multiple barcodes:", parcelSet.id);

    // Set this photo set as processing
    setCapturedPhotos(prev => 
      prev.map(ps => ps.id === parcelSet.id ? { ...ps, processing: true } : ps)
    );

    // Process with ChatGPT to detect ALL barcodes
    const barcodes = await detectMultipleBarcodesWithChatGPT(barcodeFile);
    
    if (barcodes && barcodes.length > 0) {
      console.log("ChatGPT detected barcodes:", barcodes);
      
      // Update parcel set with ALL detected barcodes
      const updatedParcelSet = {
        ...parcelSet,
        barcodes: barcodes, // Store array of all barcodes
        barcodeFromAI: barcodes[0], // Keep first one as primary for display
        barcodeProcessed: true,
        processing: false
      };
      
      setCapturedPhotos(prev => 
        prev.map(ps => ps.id === parcelSet.id ? updatedParcelSet : ps)
      );
      
      console.log(`✅ ${barcodes.length} barcodes extracted:`, barcodes);
      
    } else {
      throw new Error('No barcodes detected in image');
    }

  } catch (error) {
    console.error("Barcode processing failed:", error);
    
    // Mark as processed but failed
    const updatedParcelSet = {
      ...parcelSet,
      barcodeProcessed: true,
      processing: false,
      barcodeError: error.message
    };
    
    setCapturedPhotos(prev => 
      prev.map(ps => ps.id === parcelSet.id ? updatedParcelSet : ps)
    );
    
    console.error(`❌ Failed to extract barcodes: ${error.message}`);
  }
};

// Detect MULTIPLE barcodes with ChatGPT
const detectMultipleBarcodesWithChatGPT = async (barcodeFile) => {
  try {
    console.log("Sending barcode image to ChatGPT for multiple barcode detection...");

    // Create FormData for file upload to server
    const formData = new FormData();
    formData.append('barcodeImage', barcodeFile);

    // Send to server for ChatGPT processing
    const response = await fetch(`${SERVER_URL}/api/detect-barcodes`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    
    if (data.success && data.barcodes && data.barcodes.length > 0) {
      console.log("ChatGPT detected barcodes:", data.barcodes);
      return data.barcodes;
    } else {
      throw new Error(data.error || 'No barcodes detected');
    }

  } catch (error) {
    console.error("ChatGPT barcode detection failed:", error);
    throw new Error(`Barcode detection failed: ${error.message}`);
  }
};


// Remove captured label
const removeLabel = (labelId) => {
  setLabelPhotos(prev => prev.filter(label => label.id !== labelId));
}; 
// Add this function to refetch data for a specific stop
const refetchStopData = async (stopIndex) => {
  const stop = optimizedRoute[stopIndex];
  
  setProcessing(true);
  
  try {
    console.log(`🔄 Refetching data for: ${stop.clientName}`);
    
    // Check what data is missing and needs refetching
    const needsLabelData = !stop.extractedData || !stop.extractedData.clientName || !stop.extractedData.address;
    const needsBarcodeData = stop.labelPhoto && !stop.extractedData?.barcode;
    
    if (!stop.labelPhoto) {
      alert('❌ No label photo available to refetch data from.');
      return;
    }

    // Convert label photo to file for processing
    const response = await fetch(stop.labelPhoto);
    const blob = await response.blob();
    const file = new File([blob], `label-${stopIndex}.jpg`, { type: 'image/jpeg' });

    // Process the label with AI again
    const formData = new FormData();
    formData.append('labelImage', file);

    const apiResponse = await fetch(`${SERVER_URL}/api/process-single-photo`, {
      method: 'POST',
      body: formData,
    });

    const data = await apiResponse.json();
    
    if (data.success && data.delivery) {
      console.log("✅ Refetched data:", data.delivery);
      
      // Update the stop with new data
      const updatedRoute = [...optimizedRoute];
      updatedRoute[stopIndex] = {
        ...updatedRoute[stopIndex],
        extractedData: {
          ...updatedRoute[stopIndex].extractedData, // Keep existing data
          ...data.delivery // Override with new data
        },
        clientName: data.delivery.clientName || updatedRoute[stopIndex].clientName,
        address: data.delivery.address || updatedRoute[stopIndex].address,
        phoneNumber: data.delivery.phoneNumber || updatedRoute[stopIndex].phoneNumber,
        barcodeNumber: data.delivery.barcode || updatedRoute[stopIndex].barcodeNumber,
        sender: data.delivery.sender || updatedRoute[stopIndex].sender,
        weight: data.delivery.weight || updatedRoute[stopIndex].weight,
        dataRefetched: true
      };

      setOptimizedRoute(updatedRoute);
      
      alert(`✅ Successfully refetched data for ${data.delivery.clientName || stop.clientName}`);
      
    } else {
      throw new Error(data.error || 'Data refetch failed');
    }

  } catch (error) {
    console.error('Error refetching stop data:', error);
    alert('❌ Error refetching data. Please try again.');
  } finally {
    setProcessing(false);
  }
};

// Helper function to check if a stop needs data refetching
const needsDataRefetch = (stop) => {
  return (
    // Check if critical data is missing
    (!stop.extractedData || 
     !stop.extractedData.clientName || 
     !stop.extractedData.address ||
     stop.clientName === 'Unknown Client' ||
     stop.address === 'Address not matched' ||
     stop.address === 'Address from label') &&
    // But has a label photo to refetch from
    stop.labelPhoto
  );
};

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
            <div className="flex items-center space-x-2">
              {savedRoutes.length > 0 && (
                <button
                  onClick={() => setShowRoutesList(!showRoutesList)}
                  className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors hidden sm:flex items-center space-x-2"
                >
                  <span>📋</span>
                  <span>Routes ({savedRoutes.length})</span>
                </button>
              )}
              {optimizedRoute.length > 0 && (
                <button
                  onClick={createNewRoute}
                  className="bg-black text-white w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors shadow-lg"
                  title="Create New Route"
                >
                  <span className="text-xl">+</span>
                </button>
              )}
              <div className="text-right hidden sm:block">
                <div className="text-xs md:text-sm text-gray-600">Starting from</div>
                <div className="font-semibold text-gray-900 text-sm md:text-base truncate max-w-[120px] md:max-w-none">
                  {seurDepot.name}
                </div>
              </div>
            </div>
          </div>
          
          {/* Mobile route actions */}
          <div className="flex items-center justify-between mt-3 sm:hidden">
            <div className="text-left">
              <div className="text-xs text-gray-600">Starting from</div>
              <div className="font-semibold text-gray-900 text-sm truncate">
                {seurDepot.name}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {savedRoutes.length > 0 && (
                <button
                  onClick={() => setShowRoutesList(!showRoutesList)}
                  className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors flex items-center space-x-1"
                >
                  <span>📋</span>
                  <span>Routes</span>
                </button>
              )}
              {optimizedRoute.length > 0 && (
                <button
                  onClick={createNewRoute}
                  className="bg-black text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors shadow-lg"
                  title="Create New Route"
                >
                  <span className="text-xl">+</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Saved Routes List Modal */}
      {showRoutesList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Saved Routes</h3>
                <button
                  onClick={() => setShowRoutesList(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {savedRoutes.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No saved routes yet
                </div>
              ) : (
                savedRoutes.map((route) => (
                  <div
                    key={route.id}
                    onClick={() => loadRoute(route.id)}
                    className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">
                          Route from {route.date}
                        </div>
                        <div className="text-sm text-gray-600">
                          {route.time} • {route.stops} stops
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => deleteRoute(route.id, e)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Delete Route"
                        >
                          🗑️
                        </button>
                        <span className="text-gray-400">→</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowRoutesList(false)}
                className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-3 md:px-4 py-4 md:py-8">
        
{/* Route Indicator */}
  {/* Route Indicator */}
  {optimizedRoute.length > 0 && (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-sm text-blue-700">
            📋 {optimizedRoute.length} deliveries in {getCurrentRouteName()}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={createNewRoute}
            className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 transition-colors flex items-center space-x-1"
          >
            <span>+</span>
            <span>New Route</span>
          </button>
          <button
            onClick={clearSavedData}
            className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors"
          >
            Clear Data
          </button>
        </div>
      </div>
    </div>
  )}

  {/* ADD THE COMPLETE INDICATOR RIGHT HERE */}
  {optimizedRoute.length > 0 && currentStep === 'complete' && (
    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-sm text-green-700">
            ✅ Route Complete - Ready for Delivery!
          </span>
        </div>
        <div className="text-xs text-green-600">
          {optimizedRoute.length} stops optimized
        </div>
      </div>
    </div>
  )}

        {/* Progress Steps - Mobile Horizontal Scroll */}
{/* Progress Steps - Mobile Horizontal Scroll */}
<div className="mb-6 md:mb-8">
  <div className="flex items-center justify-between space-x-2 md:space-x-0 overflow-x-auto pb-2 md:pb-0">
    {['parcel-capture', 'label-capture', 'geocoding', 'optimizing', 'complete'].map((step, index) => (
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
          {step === 'parcel-capture' && 'Capture Parcels'}
          {step === 'label-capture' && 'Capture Labels'}
          {step === 'geocoding' && 'Geocode'}
          {step === 'optimizing' && 'Optimize'}
          {step === 'complete' && 'Complete'}
        </div>
        {index < 4 && (
          <div className={`w-4 md:w-12 h-1 mx-2 md:mx-2 ${
            getStepStatus(step) === 'completed' ? 'bg-green-500' : 'bg-gray-200'
          }`} />
        )}
      </div>
    ))}
  </div>
</div>

        {/* Photo Capture Section */}
        {/* Photo Capture Section */}
{/* Parcel Capture Step */}
{/* Parcel Capture Step */}
{/* Parcel Capture Step - ADD THIS BEFORE LABEL CAPTURE */}
{currentStep === 'parcel-capture' && !optimizedRoute.length && (
  <div className="mb-6 md:mb-8 p-4 md:p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
    <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-gray-900">
      📦 Capture Parcel Photos (Barcode + Parcel)
    </h2>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
      {/* Barcode Photo */}
      <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        photoStep === 'barcode' ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
      }`}>
        <div className="text-3xl md:text-4xl mb-3">📊</div>
        <div className="font-semibold mb-2 text-gray-900">Barcode Photo</div>
        <div className="text-gray-600 text-sm mb-4">
          Close-up of barcode on parcel
        </div>
        <div className={`text-xs px-3 py-1 rounded-full ${
          currentOrderPhotos.barcode ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {currentOrderPhotos.barcode ? '✓ Captured' : 'Step 1'}
        </div>
      </div>

      {/* Parcel Photo */}
      <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        photoStep === 'parcel' ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
      }`}>
        <div className="text-3xl md:text-4xl mb-3">📦</div>
        <div className="font-semibold mb-2 text-gray-900">Parcel Photo</div>
        <div className="text-gray-600 text-sm mb-4">
          Far shot to recognize parcel
        </div>
        <div className={`text-xs px-3 py-1 rounded-full ${
          currentOrderPhotos.parcel ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {currentOrderPhotos.parcel ? '✓ Captured' : 'Step 2'}
        </div>
      </div>
    </div>

    <div className="text-center">
      <input 
        type="file" 
        accept="image/*"
        capture="environment"
        onChange={handleParcelCapture}
        className="hidden"
        id="parcel-capture"
      />
      <label 
        htmlFor="parcel-capture"
        className="cursor-pointer inline-block bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
      >
        {photoStep === 'barcode' ? '📷 Take Barcode Photo' : '📷 Take Parcel Photo'}
      </label>
      
      <div className="mt-4 text-sm text-gray-600">
        {photoStep === 'barcode' ? 'Take a clear photo of the barcode on the parcel' : 'Take a photo of the whole parcel for visual reference'}
      </div>
    </div>

    {/* Captured Parcels Preview */}
  {/* Captured Parcels Preview */}

{/* Captured Parcels Preview */}
{/* Captured Parcels Preview */}
{capturedPhotos.length > 0 && (
  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
    <h3 className="font-semibold mb-3 text-gray-900">
      Captured Parcels: {capturedPhotos.length}
    </h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {capturedPhotos.map((photoSet, index) => (
        <div key={photoSet.id} className="text-center p-3 bg-white rounded border relative">
          {/* Remove Button */}
          <button
            onClick={() => removeParcel(photoSet.id)}
            className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
            title="Remove Parcel"
          >
            ✕
          </button>
          
          <div className="text-sm font-medium text-gray-900 mb-2">Parcel {index + 1}</div>
          <div className="flex justify-center space-x-2">
            {photoSet.barcode?.preview && (
              <img src={photoSet.barcode.preview} alt="Barcode" className="w-8 h-8 object-cover rounded border"/>
            )}
            {photoSet.parcel?.preview && (
              <img src={photoSet.parcel.preview} alt="Parcel" className="w-8 h-8 object-cover rounded border"/>
            )}
          </div>
          
          {/* Show barcode processing status */}
          {photoSet.barcodeProcessed && photoSet.barcodes && (
            <div className="text-xs mt-1">
              <div className="text-green-600">
                {photoSet.barcodes.length} barcode(s)
              </div>
              {photoSet.barcodes.slice(0, 2).map((barcode, i) => (
                <div key={i} className="text-gray-600 truncate" title={barcode}>
                  {barcode}
                </div>
              ))}
              {photoSet.barcodes.length > 2 && (
                <div className="text-gray-500">+{photoSet.barcodes.length - 2} more</div>
              )}
            </div>
          )}
          {photoSet.processing && (
            <div className="text-xs text-blue-600 mt-1">Detecting barcodes...</div>
          )}
          {photoSet.barcodeError && (
            <div className="text-xs text-red-600 mt-1">Barcode error</div>
          )}
        </div>
      ))}
    </div>
    
    {/* ✅✅✅ ADD BACK THE CONTINUE BUTTON ✅✅✅ */}
    <div className="mt-4">
      <button
        onClick={() => setCurrentStep('label-capture')}
        className="bg-black text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
      >
        Continue to Label Capture ({capturedPhotos.length} parcels ready)
      </button>
    </div>
    {/* ✅✅✅ ADD BACK THE CONTINUE BUTTON ✅✅✅ */}
    
  </div>
)}
  </div>
)}

{/* Label Capture Step - THIS COMES AFTER PARCEL CAPTURE */}
{currentStep === 'label-capture' && !optimizedRoute.length && (
  <div className="mb-6 md:mb-8 p-4 md:p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
    <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-gray-900">
      📋 Capture Label Photos
    </h2>
    
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors mb-6">
      <div className="text-4xl md:text-6xl mb-4">📋</div>
      <div className="font-semibold mb-2 text-gray-900 text-lg">Shipping Labels</div>
      <div className="text-gray-600 text-sm mb-4 max-w-md mx-auto">
        Take photos of shipping labels. We'll match them with parcels using barcode numbers.
      </div>
    </div>

    <div className="text-center">
      <input 
        type="file" 
        accept="image/*"
        capture="environment"
        onChange={handleLabelCapture}
        className="hidden"
        id="label-capture"
      />
      <label 
        htmlFor="label-capture"
        className="cursor-pointer inline-block bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
      >
        📷 Capture Label Photo
      </label>
      
      <div className="mt-4 text-sm text-gray-600">
        AI will extract delivery data and barcode from each label
      </div>
    </div>

    {/* Captured Labels Preview */}
   {/* Captured Labels Preview */}
{labelPhotos.length > 0 && (
  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
    <h3 className="font-semibold mb-3 text-gray-900">
      Captured Labels: {labelPhotos.length}
      <span className="text-sm font-normal text-gray-600 ml-2">
        (Processing automatically...)
      </span>
    </h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {labelPhotos.map((label, index) => (
        <div key={label.id} className="text-center p-3 bg-white rounded border relative">
          {/* Remove Button */}
          <button
            onClick={() => removeLabel(label.id)}
            className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
            title="Remove Label"
          >
            ✕
          </button>
          
          <div className="text-sm font-medium text-gray-900 mb-2">Label {index + 1}</div>
          {label.preview && (
            <img src={label.preview} alt="Label" className="w-12 h-12 object-cover rounded border mx-auto"/>
          )}
          {label.processing && (
            <div className="text-xs text-blue-600 mt-1">Processing...</div>
          )}
          {label.extractedData && (
            <div className="text-xs text-green-600 mt-1">✓ Processed</div>
          )}
          {label.extractedData?.barcode && (
            <div className="text-xs text-gray-600 mt-1">Barcode: {label.extractedData.barcode}</div>
          )}
        </div>
      ))}
    </div>
    
    {labelPhotos.some(label => label.processed) && (
      <div className="mt-4">
        <button
          onClick={matchParcelsWithLabels}
          className="bg-black text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
        >
          Match & Continue ({labelPhotos.filter(l => l.processed).length} labels processed)
        </button>
      </div>
    )}
  </div>
)}
  </div>
)}

        {/* Processing Photos Status */}
{/* Processing Photos Status */}
{/* Processing Photos Status */}
{processing && currentStep === 'processing-photos' && (
  <div className="mb-4 md:mb-6 p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2 md:space-x-3">
        <div className="w-2 h-2 md:w-3 md:h-3 bg-black rounded-full animate-pulse"></div>
        <div className="text-gray-900 text-sm md:text-base">
          🔍 FREE Client-side OCR processing {capturedPhotos.length} photos...
        </div>
      </div>
      <div className="text-xs md:text-sm text-gray-600">
        Using Tesseract.js (FREE) in browser
      </div>
    </div>
  </div>
)}

        

        {/* Processing Status */}
        {processing && (currentStep === 'geocoding' || currentStep === 'optimizing') && (
          <div className="mb-4 md:mb-6 p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 md:space-x-3">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-black rounded-full animate-pulse"></div>
                <div className="text-gray-900 text-sm md:text-base">
                  {currentStep === 'geocoding' && '📍 Getting coordinates from Mapbox...'}
                  {currentStep === 'optimizing' && '🗺️ Optimizing route with Mapbox...'}
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
{/* Optimized Route with Map */}
{(optimizedRoute.length > 0 || currentStep === 'complete') && (
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
      {/* 🔄 ADD BULK RETRY BUTTON HERE - RIGHT BEFORE THE ROUTE LIST */}
  {optimizedRoute.some(stop => stop.matchStatus === 'unmatched' && stop.labelOnly) && (
    <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg mx-4 mt-4">
      <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
        <div className="text-sm text-orange-700">
          ⚠️ {optimizedRoute.filter(stop => stop.matchStatus === 'unmatched' && stop.labelOnly).length} unmatched labels found
        </div>
        <div className="flex space-x-2">
          <button
            onClick={retryAllUnmatched}
            disabled={processing}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {processing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Retry All Matching</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )}
     <div className="max-h-[50vh] md:max-h-[600px] overflow-y-auto">
  {optimizedRoute
    .map((stop, index) => ({ stop, index }))
    .sort((a, b) => {
      // Sort: delivered orders go to bottom, active orders stay in original order
      const aDelivered = deliveryStatus[a.index] === 'delivered';
      const bDelivered = deliveryStatus[b.index] === 'delivered';
      
      if (aDelivered && !bDelivered) return 1; // a (delivered) goes after b (active)
      if (!aDelivered && bDelivered) return -1; // a (active) goes before b (delivered)
      return a.index - b.index; // Keep original order for same status
    })
    .map(({ stop, index }) => {
  const isDelivered = deliveryStatus[index] === 'delivered';
  const isUnmatched = stop.matchStatus === 'unmatched' && stop.labelOnly;
  const hasNoParcel = stop.hasNoParcel; 



  
  return (
    <div 
      key={index}
      className={`p-4 md:p-6 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-all ${
        clickedStop === index 
          ? 'border-2 border-black bg-gray-50' 
          : 'border-0'
      } ${isDelivered ? 'bg-green-50 opacity-75' : ''} ${
        isUnmatched ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''
      }`}
    >
      {/* Delivery Status Header */}
   {/* Delivery Status Header */}
{/* Delivery Status Header */}
<div className="flex justify-between items-start mb-3">
  <div className="flex items-center">
    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center font-semibold text-xs md:text-sm mr-2 md:mr-3 ${
      isDelivered ? 'bg-green-500 text-white' : 
      isUnmatched ? 'bg-yellow-500 text-white' : 
      'bg-black text-white'
    }`}>
      {isDelivered ? '✓' : 
       isUnmatched ? '❓' : 
       stop.stopNumber}
    </div>
    <div className="min-w-0 flex-1">
      <div className={`font-semibold text-base md:text-lg truncate ${
        isDelivered ? 'text-green-700 line-through' : 
        isUnmatched ? 'text-yellow-700' : 
        'text-gray-900'
      }`}>
        {stop.clientName}
        {isUnmatched && (
          <span className="text-xs text-yellow-600 ml-2">(No Parcel Match)</span>
        )}
        {/* Show data quality indicator */}
        {needsDataRefetch(stop) && (
          <span className="text-xs text-red-600 ml-2">(Incomplete Data)</span>
        )}
        {stop.dataRefetched && (
          <span className="text-xs text-green-600 ml-2">(Data Updated)</span>
        )}
      </div>
      <div className="text-xs md:text-sm text-gray-600 truncate">{stop.phoneNumber}</div>
      
      {/* ✅ BARCODE DISPLAY - Show for all stops */}
      {(stop.barcodeNumber || stop.extractedData?.barcode) && (
        <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full mt-1 inline-block">
          🏷️ Barcode: {stop.barcodeNumber || stop.extractedData?.barcode}
        </div>
      )}
      
      {stop.sender && (
        <div className="text-xs text-blue-600 truncate mt-1">
          From: {stop.sender}
        </div>
      )}
    </div>
  </div>
  <div className="text-right flex-shrink-0 ml-2">
    <div className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full whitespace-nowrap">
      📍 {stop.distanceFromPrevious}
    </div>
    <div className="text-xs text-gray-500 mt-1 whitespace-nowrap">{stop.driveTimeFromPrevious}</div>
    
    {/* Button Group - Stack vertically on small screens */}
{/* Button Group - Stack vertically on small screens */}
<div className="flex flex-col space-y-1 mt-2">
  {/* 🗺️ GOOGLE MAPS DIRECTIONS BUTTON - Show for all stops */}
  {!isDelivered && (
    <button
      onClick={(e) => handleGoogleMapsDirections(stop, index, e)}
      className="bg-blue-500 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors flex items-center space-x-1 whitespace-nowrap"
      title="Open Google Maps directions to this stop"
    >
      <span>🗺️</span>
      <span>Directions</span>
    </button>
  )}
  
  {/* ✏️ EDIT ADDRESS BUTTON - Show for all active stops */}
  {!isDelivered && (
    <button
      onClick={() => startEditingAddress(index)}
      disabled={processing || editingStop !== null}
      className="bg-purple-500 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 whitespace-nowrap"
      title="Edit delivery address"
    >
      <span>✏️</span>
      <span>Edit Address</span>
    </button>
  )}
  
  {/* 🔄 REFETCH DATA BUTTON - Show for stops with incomplete data */}
  {needsDataRefetch(stop) && !isDelivered && (
    <button
      onClick={() => refetchStopData(index)}
      disabled={processing}
      className="bg-blue-500 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 whitespace-nowrap"
      title="Refetch address and client data from label"
    >
      <span>📡</span>
      <span>Refetch Data</span>
    </button>
  )}
  
  {/* 🔄 RETRY MATCH BUTTON - Show for unmatched labels */}
  {isUnmatched && !isDelivered && (
    <button
      onClick={() => retryMatching(index)}
      disabled={processing}
      className="bg-orange-500 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 whitespace-nowrap"
      title="Try to match this label with available parcels"
    >
      <span>🔄</span>
      <span>Retry Match</span>
    </button>
  )}
  
  {/* ✅ DELIVERY STATUS BUTTON - Only show for matched stops */}
  {!isDelivered && !isUnmatched ? (
    <button
      onClick={() => markAsDelivered(index)}
      className="bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-green-600 transition-colors whitespace-nowrap"
    >
      Mark Delivered
    </button>
  ) : isDelivered ? (
    <div className="text-green-600 font-semibold text-sm whitespace-nowrap">
      ✅ Delivered
    </div>
  ) : (
    <div className="text-yellow-600 font-semibold text-sm whitespace-nowrap">
      ⚠️ No Parcel
    </div>
  )}
</div>
  </div>
</div>
      
     {/* Address Section - Editable */}
<div className="mb-3 md:mb-4">
  <div className="text-xs md:text-sm text-gray-600 mb-1 flex justify-between items-center">
    <span>Address</span>
    {!isDelivered && (
      <button
        onClick={() => startEditingAddress(index)}
        className="text-blue-500 hover:text-blue-700 text-xs font-semibold flex items-center space-x-1"
        title="Edit address"
      >
        <span>✏️</span>
        <span>Edit</span>
      </button>
    )}
  </div>
  
  {editingStop === index ? (
    // Editing mode
    <div className="space-y-2">
      <textarea
        value={editedAddress}
        onChange={(e) => setEditedAddress(e.target.value)}
        className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-900 resize-none"
        rows="3"
        placeholder="Enter new address..."
      />
      <div className="flex space-x-2">
        <button
          onClick={() => saveEditedAddress(index)}
          disabled={processing}
          className="bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center space-x-1"
        >
          <span>💾</span>
          <span>Save</span>
        </button>
        <button
          onClick={cancelEditing}
          className="bg-gray-500 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-gray-600 transition-colors flex items-center space-x-1"
        >
          <span>❌</span>
          <span>Cancel</span>
        </button>
      </div>
    </div>
  ) : (
    // Display mode
    <div className={`text-gray-900 text-sm md:text-base break-words ${
      isDelivered ? 'line-through' : ''
    }`}>
      {stop.address}
      {stop.placeName && stop.placeName !== stop.address && (
        <div className="text-xs text-green-600 mt-1">
          📍 {stop.placeName}
        </div>
      )}
      {(!stop.lat || !stop.lng) && (
        <div className="text-xs text-red-600 mt-1">
          ⚠️ Could not geocode this address
        </div>
      )}
    </div>
  )}
</div>

      {/* Photos section - Show label photo even for unmatched stops */}
      {(stop.barcodePreview || stop.parcelPreview || stop.labelPreview) && (
        <div className="mb-3">
          <div className="text-xs md:text-sm text-gray-600 mb-2">
            {isUnmatched ? 'Label Photo (No Parcel Match)' : 'Package Photos'}
          </div>
          <div className="flex space-x-2">
            {stop.barcodePreview && (
              <div 
                className="text-center cursor-pointer transform hover:scale-105 transition-transform duration-200"
                onClick={() => handlePhotoClick(stop)}
              >
                <div className="text-xs text-gray-500 mb-1">📊 Barcode</div>
                <img 
                  src={stop.barcodePreview} 
                  alt="Barcode" 
                  className="w-10 h-10 object-cover rounded border shadow-sm"
                />
                {/* Show barcode number under preview */}
                {stop.barcodeNumber && (
                  <div className="text-xs text-purple-600 mt-1 truncate" title={stop.barcodeNumber}>
                    {stop.barcodeNumber}
                  </div>
                )}
              </div>
            )}
            {stop.parcelPreview && (
              <div 
                className="text-center cursor-pointer transform hover:scale-105 transition-transform duration-200"
                onClick={() => handlePhotoClick(stop)}
              >
                <div className="text-xs text-gray-500 mb-1">📦 Parcel</div>
                <img 
                  src={stop.parcelPreview} 
                  alt="Parcel" 
                  className="w-10 h-10 object-cover rounded border shadow-sm"
                />
              </div>
            )}
            {stop.labelPreview && (
              <div 
                className="text-center cursor-pointer transform hover:scale-105 transition-transform duration-200"
                onClick={() => handlePhotoClick(stop)}
              >
                <div className="text-xs text-gray-500 mb-1">
                  {isUnmatched ? '📋 Label Only' : '📋 Label'}
                </div>
                <img 
                  src={stop.labelPreview} 
                  alt="Label" 
                  className="w-10 h-10 object-cover rounded border shadow-sm"
                />
                {/* Show label barcode under preview */}
                {stop.extractedData?.barcode && (
                  <div className="text-xs text-blue-600 mt-1 truncate" title={stop.extractedData.barcode}>
                    {stop.extractedData.barcode}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="text-xs text-blue-600 mt-1 text-center">Click any photo to enlarge</div>
        </div>
      )}

      {/* Show message for unmatched labels without photos */}
      {isUnmatched && !stop.labelPreview && (
        <div className="mb-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="text-xs text-yellow-700">
            ⚠️ This label didn't match any parcel barcode. Only address data is available.
          </div>
          {stop.extractedData && (
            <div className="text-xs text-gray-600 mt-2">
              <div><strong>Extracted from label:</strong></div>
              <div>Client: {stop.extractedData.clientName}</div>
              <div>Address: {stop.extractedData.address}</div>
              {stop.extractedData.phoneNumber && (
                <div>Phone: {stop.extractedData.phoneNumber}</div>
              )}
              {stop.extractedData.barcode && (
                <div className="text-purple-600 font-semibold">Barcode: {stop.extractedData.barcode}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Google Maps Button - Show for all stops */}
      {clickedStop === index && (
        <div className="mt-4">
          {/* Show full-size images */}
          {(stop.labelPhoto || stop.parcelPhoto) && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-xs md:text-sm text-gray-600 mb-2 font-semibold">
                {isUnmatched ? 'Label Image' : 'Package Images'}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {stop.labelPhoto && (
                  <div 
                    className="text-center cursor-pointer transform hover:scale-105 transition-transform duration-200"
                    onClick={() => handlePhotoClick(stop)}
                  >
                    <div className="text-xs text-gray-500 mb-1">
                      {isUnmatched ? 'Shipping Label (No Parcel)' : 'Shipping Label'}
                    </div>
                    <img 
                      src={stop.labelPhoto} 
                      alt="Shipping Label" 
                      className="w-full max-w-[200px] mx-auto h-auto object-contain rounded border shadow-sm"
                    />
                    {/* Show barcode in focused view */}
                    {stop.extractedData?.barcode && (
                      <div className="text-sm text-purple-600 font-semibold mt-2">
                        🏷️ Barcode: {stop.extractedData.barcode}
                      </div>
                    )}
                    <div className="text-xs text-blue-600 mt-1">Click to enlarge</div>
                  </div>
                )}
                {stop.parcelPhoto && (
                  <div 
                    className="text-center cursor-pointer transform hover:scale-105 transition-transform duration-200"
                    onClick={() => handlePhotoClick(stop)}
                  >
                    <div className="text-xs text-gray-500 mb-1">Parcel View</div>
                    <img 
                      src={stop.parcelPhoto} 
                      alt="Parcel" 
                      className="w-full max-w-[200px] mx-auto h-auto object-contain rounded border shadow-sm"
                    />
                    {/* Show parcel barcode in focused view */}
                    {stop.barcodeNumber && (
                      <div className="text-sm text-purple-600 font-semibold mt-2">
                        🏷️ Parcel Barcode: {stop.barcodeNumber}
                      </div>
                    )}
                    <div className="text-xs text-blue-600 mt-1">Click to enlarge</div>
                  </div>
                )}
              </div>
              
              {/* Barcode Summary */}
              {(stop.barcodeNumber || stop.extractedData?.barcode) && (
                <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-sm text-purple-700 font-semibold mb-2">📦 Barcode Information</div>
                  <div className="text-xs text-gray-700 space-y-1">
                    {stop.barcodeNumber && (
                      <div><strong>Parcel Barcode:</strong> {stop.barcodeNumber}</div>
                    )}
                    {stop.extractedData?.barcode && stop.extractedData.barcode !== stop.barcodeNumber && (
                      <div><strong>Label Barcode:</strong> {stop.extractedData.barcode}</div>
                    )}
                    {stop.allBarcodes && stop.allBarcodes.length > 1 && (
                      <div><strong>All Detected Barcodes:</strong> {stop.allBarcodes.join(', ')}</div>
                    )}
                    {stop.matchedBarcode && (
                      <div className="text-green-600 font-semibold">
                        ✅ Matched with: {stop.matchedBarcode}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sender Info in Focused View */}
          {stop.sender && (
            <div className="mb-3 p-3 bg-blue-50 rounded-lg">
              <div className="text-xs md:text-sm text-gray-600 mb-1 font-semibold">Sender Information</div>
              <div className="text-sm text-blue-700">{stop.sender}</div>
              {stop.weight && (
                <div className="text-xs text-gray-600 mt-1">Weight: {stop.weight}</div>
              )}
            </div>
          )}

          {/* Show unmatched warning in focused view */}
          {isUnmatched && (
            <div className="mb-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-sm text-yellow-700 font-semibold">⚠️ No Parcel Match</div>
              <div className="text-xs text-yellow-600 mt-1">
                This shipping label didn't match any captured parcel barcode.
                {stop.extractedData?.barcode && (
                  <div className="text-purple-600 font-semibold mt-1">
                    Label Barcode: {stop.extractedData.barcode}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Google Maps Directions Buttons */}
          {!userLocation && !isGettingLocation && (
            <button
              onClick={(e) => handleGoogleMapsClick(stop, e)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors w-full flex items-center justify-center space-x-2"
            >
              <span>🗺️</span>
              <span>Get Directions</span>
            </button>
          )}

          {isGettingLocation && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-blue-700">Getting your location...</span>
              </div>
            </div>
          )}

          {locationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 mb-2">{locationError}</p>
              <button
                onClick={(e) => handleGoogleMapsClick(stop, e)}
                className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors w-full"
              >
                🔄 Try Again
              </button>
            </div>
          )}

          {userLocation && (
            <button
              onClick={(e) => openGoogleMapsDirections(stop)}
              className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors w-full flex items-center justify-center space-x-2"
            >
              <span>🗺️</span>
              <span>Open Google Maps</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
})}
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
       {!optimizedRoute.length && currentStep === 'photo-capture' && capturedPhotos.length === 0 && (
  <div className="text-center py-12 md:py-16">
    <div className="text-4xl md:text-6xl mb-4">📸</div>
    <h3 className="text-xl md:text-2xl font-semibold mb-2 text-gray-900">Start by Capturing Photos</h3>
    <p className="text-gray-600 max-w-md mx-auto text-sm md:text-base px-4">
      Take two photos for each order: one of the label and one of the parcel
    </p>
  </div>
)}
      </div>

      {/* Mobile Bottom Navigation */}
      {optimizedRoute.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 shadow-lg">
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

      {/* Add padding for mobile bottom nav */}
      {optimizedRoute.length > 0 && (
        <div className="lg:hidden h-20"></div>
      )}
      <ImageModal 
      images={selectedImages} 
      onClose={handleCloseModal} 
    />
    </main>
  );
}