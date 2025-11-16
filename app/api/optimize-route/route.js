import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { deliveries, depot } = await request.json();

    // Filter out deliveries that failed geocoding
    const validDeliveries = deliveries.filter(d => d.lat && d.lng);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `IMPORTANT: Use CHAIN OPTIMIZATION with REAL COORDINATES. 
            
            Start from SEUR depot: "${depot.address}" at coordinates (${depot.lat}, ${depot.lng})
            
            Deliveries with coordinates:
            ${JSON.stringify(validDeliveries.map(d => ({
              clientName: d.clientName,
              address: d.address, 
              lat: d.lat,
              lng: d.lng,
              placeName: d.placeName
            })))}
            
            Chain logic using coordinates:
            1. Find closest delivery to SEUR depot coordinates → Go there first
            2. From that location's coordinates, find closest remaining delivery → Go there next  
            3. Continue chain: always pick the closest delivery to your current coordinates
            4. Repeat until all deliveries are done
            
            Return ONLY a JSON array showing the chain-optimized route with real directions.
            
            Format: [
              {
                "stopNumber": 1,
                "clientName": "John Doe", 
                "address": "123 Main St", 
                "phoneNumber": "555-0123",
                "lat": 43.301234,
                "lng": -1.945678,
                "distanceFromPrevious": "1.2 km", 
                "driveTimeFromPrevious": "5 minutes",
                "directions": "Head east from SEUR depot, turn left on Main St"
              },
              ...
            ]`
          }
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\[.*\]/s);
    
    if (jsonMatch) {
      const optimizedRoute = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ success: true, route: optimizedRoute });
    } else {
      return NextResponse.json({ success: false, error: "Could not optimize route", raw: content });
    }

  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}