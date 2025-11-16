import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { addresses, depot } = await request.json();

    // Geocode all addresses using Mapbox
    const geocodedDeliveries = await Promise.all(
      addresses.map(async (delivery) => {
        try {
          const geocodeResponse = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(delivery.address)}.json?access_token=${process.env.MAPBOX_ACCESS_TOKEN}&limit=1&country=ES&proximity=${depot.lng},${depot.lat}`
          );

          if (!geocodeResponse.ok) {
            throw new Error('Mapbox API error');
          }

          const geocodeData = await geocodeResponse.json();
          
          if (geocodeData.features && geocodeData.features.length > 0) {
            const [lng, lat] = geocodeData.features[0].center;
            const placeName = geocodeData.features[0].place_name;
            
            return {
              ...delivery,
              lat,
              lng,
              placeName
            };
          } else {
            throw new Error('No coordinates found for address');
          }
        } catch (error) {
          console.error(`Geocoding error for ${delivery.address}:`, error);
          // Return delivery without coordinates if geocoding fails
          return {
            ...delivery,
            lat: null,
            lng: null,
            placeName: delivery.address,
            error: 'Geocoding failed'
          };
        }
      })
    );

    return NextResponse.json({ 
      success: true, 
      deliveries: geocodedDeliveries 
    });

  } catch (error) {
    console.error('Geocoding API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}