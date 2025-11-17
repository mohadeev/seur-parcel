'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react'
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

  async saveRoute(routeData) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['routes'], 'readwrite');
      const store = transaction.objectStore('routes');
      
      const request = store.put({
        ...routeData,
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
  const [currentStep, setCurrentStep] = useState('photo-capture');
  const [focusedSegment, setFocusedSegment] = useState(null);
  const [activeTab, setActiveTab] = useState('route');
  const [clickedStop, setClickedStop] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [showRoutesList, setShowRoutesList] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [currentOrderPhotos, setCurrentOrderPhotos] = useState({ label: null, parcel: null });
  const [photoStep, setPhotoStep] = useState('label');
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
          setCurrentStep('complete'); // Force complete step for saved routes
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
          setCurrentStep('complete');
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  loadData();
}, [dbReady, routeId]); // Remove optimizedRoute.length dependency
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
      setCurrentStep('complete'); // Always set to complete for loaded routes
      router.push(`/?route=${routeId}`);
    }
    setShowRoutesList(false);
  } catch (error) {
    console.error('Error loading route:', error);
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
const handlePhotoCapture = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = () => {
    const originalData = reader.result;
    
    // Create resized versions for preview
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
        preview: previewData,
        timestamp: new Date().toISOString(),
        type: photoStep
      };

      if (photoStep === 'label') {
        setCurrentOrderPhotos(prev => ({ ...prev, label: photoData }));
        setPhotoStep('parcel');
      } else {
        // Both photos captured, add to collection and PROCESS IMMEDIATELY via server
        setCurrentOrderPhotos(prev => ({ ...prev, parcel: photoData }));
        
        const orderPhotos = {
          id: Date.now(),
          label: currentOrderPhotos.label,
          parcel: photoData,
          processed: false,
          processing: false
        };
        
        setCapturedPhotos(prev => [...prev, orderPhotos]);
        
        // PROCESS THIS SINGLE ORDER IMMEDIATELY via server
        processSinglePhotoOrder(orderPhotos, file);
        
        setCurrentOrderPhotos({ label: null, parcel: null });
        setPhotoStep('label');
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


  // Combine REAL AI photo data with PDA list data
 // Combine REAL AI photo data with PDA list data
// Combine REAL AI photo data with PDA list data
const combinePhotoDataWithPDA = (pdaDeliveries, photoData) => {
  return pdaDeliveries.map(pdaDelivery => {
    // Find matching photo data using name similarity (80% match)
    const matchingPhoto = photoData.find(photoItem => {
      const extracted = photoItem.extractedData;
      
      if (!extracted || !extracted.clientName) return false;

      // Convert both names to lowercase for comparison
      const photoName = extracted.clientName.toLowerCase().trim();
      const pdaName = pdaDelivery.clientName.toLowerCase().trim();
      
      // Calculate name similarity
      const similarity = calculateNameSimilarity(photoName, pdaName);
      
      console.log(`Name matching: "${photoName}" vs "${pdaName}" - Similarity: ${similarity}%`);
      
      // Match if similarity is 80% or higher
      return similarity >= 80;
    });

    if (matchingPhoto) {
      // Combine PDA data with photo data - ALWAYS include photos
      return {
        ...pdaDelivery, // Keep all PDA data
        // ALWAYS include photo data
        photoSetId: matchingPhoto.photoSetId,
        labelPhoto: matchingPhoto.labelPhoto,
        labelPreview: matchingPhoto.labelPreview,
        parcelPhoto: matchingPhoto.parcelPhoto,
        parcelPreview: matchingPhoto.parcelPreview,
        originalPhotos: matchingPhoto.originalPhotos,
        ocrText: matchingPhoto.ocrText,
        ocrConfidence: matchingPhoto.ocrConfidence,
        // Enhance with any additional data from label
        ...(matchingPhoto.extractedData && {
          enhancedAddress: matchingPhoto.extractedData.address || pdaDelivery.address,
          enhancedPhone: matchingPhoto.extractedData.phoneNumber || pdaDelivery.phoneNumber,
          enhancedName: matchingPhoto.extractedData.clientName || pdaDelivery.clientName,
          enhancedBarcode: matchingPhoto.extractedData.barcode || pdaDelivery.barcode,
          enhancedSender: matchingPhoto.extractedData.sender || pdaDelivery.sender,
          enhancedWeight: matchingPhoto.extractedData.weight || pdaDelivery.weight,
        }),
        source: 'photo-enhanced',
        matchConfidence: calculateNameSimilarity(
          matchingPhoto.extractedData.clientName.toLowerCase().trim(),
          pdaDelivery.clientName.toLowerCase().trim()
        )
      };
    }

    // Return original PDA data if no photo match found
    return {
      ...pdaDelivery,
      source: 'pda-only'
    };
  });
};

// Add this helper function for name similarity calculation
const calculateNameSimilarity = (str1, str2) => {
  // Remove common company suffixes and clean the strings
  const cleanStr1 = str1.replace(/\b(sl|s|l|sa|s\.a|company|corp|inc|llc)\b/gi, '').trim();
  const cleanStr2 = str2.replace(/\b(sl|s|l|sa|s\.a|company|corp|inc|llc)\b/gi, '').trim();
  
  // If one string contains the other, it's a high match
  if (cleanStr1.includes(cleanStr2) || cleanStr2.includes(cleanStr1)) {
    return 100;
  }
  
  // Calculate Levenshtein distance-based similarity
  const distance = levenshteinDistance(cleanStr1, cleanStr2);
  const maxLength = Math.max(cleanStr1.length, cleanStr2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return Math.round(similarity);
};

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
  const addressesMatch = (addr1, addr2) => {
    const cleanAddr1 = addr1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanAddr2 = addr2.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanAddr1.includes(cleanAddr2) || cleanAddr2.includes(cleanAddr1);
  };

  const phonesMatch = (phone1, phone2) => {
    const cleanPhone1 = phone1.replace(/\D/g, '');
    const cleanPhone2 = phone2.replace(/\D/g, '');
    return cleanPhone1 === cleanPhone2;
  };

  const namesMatch = (name1, name2) => {
    const cleanName1 = name1.toLowerCase().replace(/[^a-z]/g, '');
    const cleanName2 = name2.toLowerCase().replace(/[^a-z]/g, '');
    return cleanName1.includes(cleanName2) || cleanName2.includes(cleanName1);
  };

  const barcodesMatch = (barcode1, barcode2) => {
    return barcode1.toString() === barcode2.toString();
  };

  // Handle PDA/list upload and match with photos
 // Handle PDA/list upload and match with photos
// Handle PDA/list upload - SERVER-SIDE processing
// Handle PDA/list upload - SERVER-SIDE processing with PHOTO DATA
const handlePDAUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  setProcessing(true);
  setCurrentStep('upload');
  
  try {
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('pdaImage', file);

    // Prepare photo metadata (extracted data only, no binary images)
    const photoDataForServer = capturedPhotos.map(photoSet => ({
      photoSetId: photoSet.id,
      extractedData: photoSet.extractedData,
      ocrText: photoSet.ocrText,
      ocrConfidence: photoSet.ocrConfidence
    }));

    // Add photo metadata to FormData
    formData.append('photoData', JSON.stringify(photoDataForServer));

    console.log(`Sending ${photoDataForServer.length} photo sets to server for matching`);

    // Send to HEROKU SERVER for PDA list extraction with PHOTO MATCHING
    const response = await fetch(`${SERVER_URL}/api/process-orders`, {
      method: 'POST',
      body: formData, // No Content-Type header for FormData
    });

    const data = await response.json();
    
    if (data.success) {
      // Client-side - Add photo binary data back to matched deliveries
      const deliveriesWithPhotos = data.deliveries.map(delivery => {
        if (delivery.source === 'photo-enhanced' && delivery.photoSetId) {
          const originalPhotoSet = capturedPhotos.find(ps => ps.id === delivery.photoSetId);
          if (originalPhotoSet) {
            return {
              ...delivery,
              // Add binary photo data for display
              labelPhoto: originalPhotoSet.label?.data,
              labelPreview: originalPhotoSet.label?.preview,
              parcelPhoto: originalPhotoSet.parcel?.data,
              parcelPreview: originalPhotoSet.parcel?.preview,
              originalPhotos: originalPhotoSet
            };
          }
        }
        return delivery;
      });

      setDeliveries(deliveriesWithPhotos);
      
      const matchedCount = data.matchedCount || 0;
      const deliveriesWithBinaryPhotos = deliveriesWithPhotos.filter(d => d.labelPhoto).length;
      
      alert(`✅ HEROKU SERVER: Processed ${data.extractedCount} PDA orders, ${matchedCount} matched with ${data.photoCount} photos! ${deliveriesWithBinaryPhotos} stops will show photos. Now geocoding addresses...`);
      
      await geocodeAddresses(deliveriesWithPhotos);
    } else {
      alert('❌ HEROKU SERVER PDA Processing Error: ' + data.error);
      setCurrentStep('upload');
    }
    
  } catch (error) {
    alert('Error uploading PDA list: ' + error.message);
    setCurrentStep('upload');
  } finally {
    setProcessing(false);
  }
};

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
      matchConfidence: delivery.matchConfidence,
      enhancedAddress: delivery.enhancedAddress,
      photoAddress: delivery.photoAddress,
      // DO NOT send binary image data
      // photoSetId: delivery.photoSetId, // Keep this to match later
      // ocrText: delivery.ocrText, // Too large
      // ocrConfidence: delivery.ocrConfidence,
      // labelPhoto: delivery.labelPhoto, // REMOVE - too large
      // labelPreview: delivery.labelPreview, // REMOVE
      // parcelPhoto: delivery.parcelPhoto, // REMOVE - too large
      // parcelPreview: delivery.parcelPreview, // REMOVE
      // originalPhotos: delivery.originalPhotos // REMOVE - too large
    }));

    console.log("Sending clean deliveries for geocoding:", cleanDeliveriesForGeocoding.length);
    
    const response = await fetch(SERVER_URL+'/api/geocode-addresses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        addresses: cleanDeliveriesForGeocoding, // Send clean data without images
        depot: seurDepot
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      // RECOMBINE geocoded data with original photo data
      const deliveriesWithPhotos = data.deliveries.map((geocodedDelivery, index) => {
        const originalDelivery = deliveriesToGeocode[index];
        return {
          ...geocodedDelivery, // Geocoded data (lat, lng, placeName, etc.)
          // PRESERVE ALL original data including photos
          clientName: originalDelivery.clientName,
          address: originalDelivery.address,
          phoneNumber: originalDelivery.phoneNumber,
          barcode: originalDelivery.barcode,
          sender: originalDelivery.sender,
          weight: originalDelivery.weight,
          // PRESERVE PHOTO DATA from original
          photoSetId: originalDelivery.photoSetId,
          labelPhoto: originalDelivery.labelPhoto,
          labelPreview: originalDelivery.labelPreview,
          parcelPhoto: originalDelivery.parcelPhoto,
          parcelPreview: originalDelivery.parcelPreview,
          originalPhotos: originalDelivery.originalPhotos,
          ocrText: originalDelivery.ocrText,
          ocrConfidence: originalDelivery.ocrConfidence,
          source: originalDelivery.source,
          matchConfidence: originalDelivery.matchConfidence,
          enhancedAddress: originalDelivery.enhancedAddress,
          photoAddress: originalDelivery.photoAddress
        };
      });
      
      setGeocodedDeliveries(deliveriesWithPhotos);
      
      const successfulGeocodes = deliveriesWithPhotos.filter(d => d.lat && d.lng).length;
      const photosCount = deliveriesWithPhotos.filter(d => d.labelPhoto).length;
      
      alert(`✅ Geocoded ${successfulGeocodes}/${deliveriesWithPhotos.length} addresses! ${photosCount} stops have photos. Now optimizing route...`);
      
      await optimizeRoute(deliveriesWithPhotos);
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
      matchConfidence: delivery.matchConfidence,
      enhancedAddress: delivery.enhancedAddress,
      photoAddress: delivery.photoAddress,
      lat: delivery.lat,
      lng: delivery.lng,
      placeName: delivery.placeName,
      // DO NOT send binary image data
      // photoSetId: delivery.photoSetId,
      // ocrText: delivery.ocrText,
      // ocrConfidence: delivery.ocrConfidence,
      // labelPhoto: delivery.labelPhoto, // REMOVE - too large
      // labelPreview: delivery.labelPreview, // REMOVE
      // parcelPhoto: delivery.parcelPhoto, // REMOVE - too large
      // parcelPreview: delivery.parcelPreview, // REMOVE
      // originalPhotos: delivery.originalPhotos // REMOVE - too large
    }));

    console.log("Sending clean deliveries for optimization:", cleanDeliveriesForOptimization.length);
    
    const response = await fetch(SERVER_URL+'/api/optimize-route', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        deliveries: cleanDeliveriesForOptimization, // Send clean data without images
        depot: seurDepot
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      // RECOMBINE optimized data with original photo data
      const routeWithPhotos = data.route.map((optimizedStop, index) => {
        const originalDelivery = deliveriesWithCoords[index];
        return {
          ...optimizedStop, // Optimized route data
          // PRESERVE ALL original data including photos
          clientName: originalDelivery.clientName,
          address: originalDelivery.address,
          phoneNumber: originalDelivery.phoneNumber,
          barcode: originalDelivery.barcode,
          sender: originalDelivery.sender,
          weight: originalDelivery.weight,
          // PRESERVE PHOTO DATA
          photoSetId: originalDelivery.photoSetId,
          labelPhoto: originalDelivery.labelPhoto,
          labelPreview: originalDelivery.labelPreview,
          parcelPhoto: originalDelivery.parcelPhoto,
          parcelPreview: originalDelivery.parcelPreview,
          originalPhotos: originalDelivery.originalPhotos,
          ocrText: originalDelivery.ocrText,
          ocrConfidence: originalDelivery.ocrConfidence,
          source: originalDelivery.source,
          matchConfidence: originalDelivery.matchConfidence,
          enhancedAddress: originalDelivery.enhancedAddress,
          photoAddress: originalDelivery.photoAddress
        };
      });
      
      setOptimizedRoute(routeWithPhotos);
      setCurrentStep('complete');
      
      const photosCount = routeWithPhotos.filter(stop => stop.labelPhoto).length;
      alert(`✅ Route optimized successfully! ${photosCount}/${routeWithPhotos.length} stops have photos visible.`);
    } else {
      alert('❌ Optimization error: ' + data.error);
    }
    
  } catch (error) {
    alert('Optimization error: ' + error.message);
  } finally {
    setProcessing(false);
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
    }
  };

  // Handle Google Maps button click
  const handleGoogleMapsClick = (stop, event) => {
    event.stopPropagation();
    
    if (!userLocation && !isGettingLocation) {
      getUserLocation();
    } else if (userLocation) {
      openGoogleMapsDirections(stop);
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
  // If we have an optimized route, we're always complete
  if (optimizedRoute.length > 0 && step === 'complete') {
    return 'current';
  }
  
  if (step === currentStep) return 'current';
  if (
    (step === 'photo-capture' && currentStep !== 'photo-capture') ||
    (step === 'processing-photos' && currentStep === 'upload') ||
    (step === 'processing-photos' && currentStep === 'geocoding') ||
    (step === 'processing-photos' && currentStep === 'optimizing') ||
    (step === 'processing-photos' && currentStep === 'complete') ||
    (step === 'upload' && currentStep === 'geocoding') ||
    (step === 'upload' && currentStep === 'optimizing') ||
    (step === 'upload' && currentStep === 'complete') ||
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
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between space-x-2 md:space-x-0 overflow-x-auto pb-2 md:pb-0">
            {['photo-capture', 'processing-photos', 'upload', 'geocoding', 'optimizing', 'complete'].map((step, index) => (
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
                  {step === 'photo-capture' && 'Take Photos'}
                  {step === 'processing-photos' && 'AI Process'}
                  {step === 'upload' && 'Match PDA'}
                  {step === 'geocoding' && 'Geocode'}
                  {step === 'optimizing' && 'Optimize'}
                  {step === 'complete' && 'Complete'}
                </div>
                {index < 5 && (
                  <div className={`w-4 md:w-12 h-1 mx-2 md:mx-2 ${
                    getStepStatus(step) === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Photo Capture Section */}
        {currentStep === 'photo-capture' && !optimizedRoute.length && (
          <div className="mb-6 md:mb-8 p-4 md:p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-gray-900">
              {photoStep === 'label' ? '📋 Capture Label Photo' : '📦 Capture Parcel Photo'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <div className="text-3xl md:text-4xl mb-3">📋</div>
                <div className="font-semibold mb-2 text-gray-900">Label Photo</div>
                <div className="text-gray-600 text-sm mb-4">
                  Close-up of shipping label with address and details
                </div>
                <div className={`text-xs px-3 py-1 rounded-full ${
                  currentOrderPhotos.label ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {currentOrderPhotos.label ? '✓ Captured' : 'Pending'}
                </div>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <div className="text-3xl md:text-4xl mb-3">📦</div>
                <div className="font-semibold mb-2 text-gray-900">Parcel Photo</div>
                <div className="text-gray-600 text-sm mb-4">
                  Far shot to recognize the parcel
                </div>
                <div className={`text-xs px-3 py-1 rounded-full ${
                  currentOrderPhotos.parcel ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {currentOrderPhotos.parcel ? '✓ Captured' : 'Pending'}
                </div>
              </div>
            </div>

            <div className="text-center">
              <input 
                type="file" 
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
                id="photo-capture"
              />
              <label 
                htmlFor="photo-capture"
                className="cursor-pointer inline-block bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
              >
                {photoStep === 'label' ? '📷 Take Label Photo' : '📷 Take Parcel Photo'}
              </label>
              
              <div className="mt-4 text-sm text-gray-600">
                {photoStep === 'label' 
                  ? 'Take a clear photo of the shipping label' 
                  : 'Take a photo of the whole parcel for recognition'}
              </div>
            </div>

            {/* Captured Photos Preview */}
{capturedPhotos.length > 0 && (
  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
    <h3 className="font-semibold mb-3 text-gray-900">
      Captured Orders: {capturedPhotos.length}
      <span className="text-sm font-normal text-gray-600 ml-2">
        (Processing automatically via OpenAI...)
      </span>
    </h3>
    <div className="space-y-4">
      {capturedPhotos.map((photoSet, index) => (
        <div key={photoSet.id} className="p-4 bg-white rounded-lg border border-gray-200">
          <div className="flex items-start justify-between">
            {/* Photo Previews */}
            <div className="flex items-center space-x-4">
              <div className="text-sm font-medium text-gray-900">Order {index + 1}</div>
              <div className="flex space-x-3">
                {photoSet.label?.preview && (
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Label</div>
                    <img 
                      src={photoSet.label.preview} 
                      alt="Label preview" 
                      className="w-12 h-12 object-cover rounded border"
                    />
                  </div>
                )}
                {photoSet.parcel?.preview && (
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Parcel</div>
                    <img 
                      src={photoSet.parcel.preview} 
                      alt="Parcel preview" 
                      className="w-12 h-12 object-cover rounded border"
                    />
                  </div>
                )}
              </div>
              
              {/* Processing Status */}
              {photoSet.processing && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-blue-600">Processing via OpenAI...</span>
                </div>
              )}
            </div>

{/* Extracted Data Display */}
<div className="flex-1 ml-4">
  {photoSet.processed && photoSet.extractedData ? (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-green-800">
          ✅ Processed via Server
        </div>
        <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
          Server Processing
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        {photoSet.extractedData.clientName && (
          <div><span className="font-medium text-gray-700">Name:</span> {photoSet.extractedData.clientName}</div>
        )}
        {photoSet.extractedData.address && (
          <div><span className="font-medium text-gray-700">Address:</span> {photoSet.extractedData.address}</div>
        )}
        {photoSet.extractedData.phoneNumber && (
          <div><span className="font-medium text-gray-700">Phone:</span> {photoSet.extractedData.phoneNumber}</div>
        )}
        {photoSet.extractedData.barcode && (
          <div><span className="font-medium text-gray-700">Barcode:</span> {photoSet.extractedData.barcode}</div>
        )}
        {photoSet.extractedData.sender && (
          <div><span className="font-medium text-gray-700">Sender:</span> {photoSet.extractedData.sender}</div>
        )}
        {photoSet.extractedData.weight && (
          <div><span className="font-medium text-gray-700">Weight:</span> {photoSet.extractedData.weight}</div>
        )}
      </div>
    </div>
  ) : photoSet.processed && photoSet.error ? (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
      <div className="text-xs text-red-700">
        ❌ Server Processing Failed: {photoSet.error}
      </div>
    </div>
  ) : photoSet.processing ? (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <div className="text-xs text-blue-700">
        🔍 Processing via Server + OpenAI...
      </div>
    </div>
  ) : (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
      <div className="text-xs text-yellow-700">
        ⏳ Waiting to process...
      </div>
    </div>
  )}
</div>

            <button
              onClick={() => removePhotoSet(photoSet.id)}
              className="text-red-500 hover:text-red-700 text-sm font-medium ml-4"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
    
    {/* Show continue button when we have processed photos */}
    {capturedPhotos.some(ps => ps.processed) && (
      <div className="mt-4">
        <button
          onClick={() => setCurrentStep('upload')}
          className="bg-black text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
        >
          Continue to PDA Upload ({capturedPhotos.filter(ps => ps.processed).length} orders ready)
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

        {/* PDA/List Upload Section - FOR MATCHING WITH PHOTOS */}
        {currentStep === 'upload' && !optimizedRoute.length && (
          <div className="mb-6 md:mb-8 p-4 md:p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-gray-900">
              📄 Upload PDA List to Match with {capturedPhotos.length} Photos
            </h2>
            
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="text-blue-500">ℹ️</div>
                <div className="text-sm text-blue-700">
                  We found {capturedPhotos.length} orders from photos. Now upload your PDA/delivery list to match with system data.
                </div>
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 md:p-8 text-center hover:border-gray-400 transition-colors">
              <input 
                type="file" 
                accept="image/*"
                onChange={handlePDAUpload}
                disabled={processing}
                className="hidden"
                id="pda-upload"
              />
              <label 
                htmlFor="pda-upload"
                className="cursor-pointer block"
              >
                <div className="text-3xl md:text-4xl mb-3 md:mb-4">📱</div>
                <div className="text-base md:text-lg font-semibold mb-2 text-gray-900">
                  {processing ? 'Matching with photos...' : 'Upload PDA/Delivery List'}
                </div>
                <div className="text-gray-600 text-xs md:text-sm mb-4">
                  We'll match your {capturedPhotos.length} captured photos with the system delivery list
                </div>
                <button 
                  disabled={processing}
                  className="bg-black text-white px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400 disabled:text-gray-200 transition-colors text-sm md:text-base w-full md:w-auto"
                >
                  {processing ? 'Processing...' : 'Upload PDA List'}
                </button>
              </label>
            </div>
            
            {/* Show photo previews that will be matched */}
            {capturedPhotos.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-3 text-gray-900">
                  Photos to be matched ({capturedPhotos.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {capturedPhotos.slice(0, 4).map((photoSet, index) => (
                    <div key={photoSet.id} className="text-center">
                      <div className="text-xs text-gray-500 mb-1">Order {index + 1}</div>
                      <div className="flex space-x-1 justify-center">
                        {photoSet.label?.preview && (
                          <img 
                            src={photoSet.label.preview} 
                            alt="Label" 
                            className="w-8 h-8 object-cover rounded border"
                          />
                        )}
                        {photoSet.parcel?.preview && (
                          <img 
                            src={photoSet.parcel.preview} 
                            alt="Parcel" 
                            className="w-8 h-8 object-cover rounded border"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                  {capturedPhotos.length > 4 && (
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">And {capturedPhotos.length - 4} more...</div>
                      <div className="w-16 h-8 bg-gray-200 rounded flex items-center justify-center">
                        <span className="text-xs text-gray-600">+{capturedPhotos.length - 4}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
{processing && currentStep === 'upload' && (
  <div className="mb-4 md:mb-6 p-3 md:p-4 bg-purple-50 rounded-lg border border-purple-200">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2 md:space-x-3">
        <div className="w-2 h-2 md:w-3 md:h-3 bg-purple-500 rounded-full animate-pulse"></div>
        <div className="text-purple-900 text-sm md:text-base">
          🖥️ SERVER processing PDA list...
        </div>
      </div>
      <div className="text-xs md:text-sm text-purple-700">
        Server-side extraction
      </div>
    </div>
    <div className="mt-2 text-xs text-purple-600">
      Using FREE OCR + AI on server to extract delivery data
    </div>
  </div>
)}
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

            {/* ALWAYS Show photo previews - Remove the clickedStop condition */}
            {(stop.labelPreview || stop.parcelPreview) && (
              <div className="mb-3">
                <div className="text-xs md:text-sm text-gray-600 mb-2">Package Photos</div>
                <div className="flex space-x-3">
                  {stop.labelPreview && (
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">Label</div>
                      <img 
                        src={stop.labelPreview} 
                        alt="Label" 
                        className="w-12 h-12 object-cover rounded border shadow-sm"
                      />
                    </div>
                  )}
                  {stop.parcelPreview && (
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">Parcel</div>
                      <img 
                        src={stop.parcelPreview} 
                        alt="Parcel" 
                        className="w-12 h-12 object-cover rounded border shadow-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Google Maps Button - ONLY SHOWS WHEN STOP IS CLICKED/FOCUSED */}
            {clickedStop === index && (
              <div className="mt-4">
                {/* Show full-size images between Get Directions and the actual directions */}
                {(stop.labelPhoto || stop.parcelPhoto) && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs md:text-sm text-gray-600 mb-2 font-semibold">Package Images</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {stop.labelPhoto && (
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Shipping Label</div>
                          <img 
                            src={stop.labelPhoto} 
                            alt="Shipping Label" 
                            className="w-full max-w-[200px] mx-auto h-auto object-contain rounded border shadow-sm"
                          />
                        </div>
                      )}
                      {stop.parcelPhoto && (
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Parcel View</div>
                          <img 
                            src={stop.parcelPhoto} 
                            alt="Parcel" 
                            className="w-full max-w-[200px] mx-auto h-auto object-contain rounded border shadow-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
    </main>
  );
}