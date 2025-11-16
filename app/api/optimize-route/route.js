import { NextResponse } from 'next/server';

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
}

// Nearest Neighbor algorithm for route optimization
function optimizeRouteWithNearestNeighbor(depot, deliveries) {
  const unvisited = [...deliveries];
  const optimizedRoute = [];
  
  // Start from depot
  let currentLocation = depot;
  
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let shortestDistance = calculateDistance(
      currentLocation.lat, currentLocation.lng,
      unvisited[0].lat, unvisited[0].lng
    );
    
    // Find nearest unvisited delivery
    for (let i = 1; i < unvisited.length; i++) {
      const distance = calculateDistance(
        currentLocation.lat, currentLocation.lng,
        unvisited[i].lat, unvisited[i].lng
      );
      
      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestIndex = i;
      }
    }
    
    // Add nearest delivery to optimized route
    const nearestDelivery = unvisited[nearestIndex];
    optimizedRoute.push({
      ...nearestDelivery,
      distanceFromPrevious: `${shortestDistance.toFixed(1)} km`,
      driveTimeFromPrevious: `${Math.round(shortestDistance * 2.5)} minutes` // Rough estimate: 2.5 min per km
    });
    
    // Move to the nearest delivery
    currentLocation = nearestDelivery;
    
    // Remove from unvisited
    unvisited.splice(nearestIndex, 1);
  }
  
  return optimizedRoute;
}

// Get driving directions between two points
async function getDrivingDirections(origin, destination) {
  try {
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?access_token=${process.env.MAPBOX_ACCESS_TOKEN}&steps=true&overview=full`
    );

    if (!response.ok) {
      throw new Error('Mapbox Directions API error');
    }

    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      
      // Get the first step as simple directions
      if (leg.steps && leg.steps.length > 0) {
        const firstStep = leg.steps[0];
        return firstStep.maneuver.instruction || `Drive to ${destination.placeName || destination.address}`;
      }
    }
    
    return `Drive to ${destination.placeName || destination.address}`;
  } catch (error) {
    console.error('Directions API error:', error);
    return `Head towards ${destination.placeName || destination.address}`;
  }
}

export async function POST(request) {
  try {
    const { deliveries, depot } = await request.json();

    // Filter out deliveries that failed geocoding
    const validDeliveries = deliveries.filter(d => d.lat && d.lng);

    if (validDeliveries.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No valid deliveries with coordinates' 
      });
    }

    // Optimize route using Nearest Neighbor algorithm
    const optimizedRoute = optimizeRouteWithNearestNeighbor(depot, validDeliveries);

    // Add directions for each stop
    const routeWithDirections = await Promise.all(
      optimizedRoute.map(async (stop, index) => {
        const previousStop = index === 0 ? depot : optimizedRoute[index - 1];
        
        const directions = await getDrivingDirections(previousStop, stop);
        
        return {
          ...stop,
          stopNumber: index + 1,
          directions: directions
        };
      })
    );

    return NextResponse.json({ 
      success: true, 
      route: routeWithDirections 
    });

  } catch (error) {
    console.error('Route optimization error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}