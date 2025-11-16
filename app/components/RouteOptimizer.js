'use client';
import { useState } from 'react';

export default function RouteOptimizer({ deliveries, onRouteOptimized }) {
  const [optimizing, setOptimizing] = useState(false);

  const optimizeRoute = async () => {
    if (deliveries.length === 0) return;
    
    setOptimizing(true);
    
    try {
      // Convert addresses to coordinates
      const deliveriesWithCoords = await Promise.all(
        deliveries.map(async (delivery) => {
          const coords = await geocodeAddress(delivery.address);
          return { ...delivery, ...coords };
        })
      );
      
      // Simple route optimization (nearest neighbor algorithm)
      const optimized = nearestNeighbor(deliveriesWithCoords);
      onRouteOptimized(optimized);
      
    } catch (error) {
      console.error('Optimization error:', error);
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="mb-6">
      <button 
        onClick={optimizeRoute}
        disabled={optimizing || deliveries.length === 0}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {optimizing ? 'Optimizing Route...' : 'Optimize Delivery Route'}
      </button>
      <p>{deliveries.length} deliveries ready to optimize</p>
    </div>
  );
}

// Simple optimization algorithm
function nearestNeighbor(deliveries) {
  if (deliveries.length === 0) return [];
  
  const unvisited = [...deliveries];
  const optimized = [unvisited.shift()]; // Start with first delivery
  
  while (unvisited.length > 0) {
    const last = optimized[optimized.length - 1];
    let nearestIndex = 0;
    let shortestDistance = calculateDistance(last, unvisited[0]);
    
    for (let i = 1; i < unvisited.length; i++) {
      const distance = calculateDistance(last, unvisited[i]);
      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestIndex = i;
      }
    }
    
    optimized.push(unvisited.splice(nearestIndex, 1)[0]);
  }
  
  return optimized;
}

function calculateDistance(point1, point2) {
  // Simple distance calculation (Haversine would be better)
  const dx = point1.lat - point2.lat;
  const dy = point1.lng - point2.lng;
  return Math.sqrt(dx * dx + dy * dy);
}