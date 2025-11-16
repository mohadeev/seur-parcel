// app/api/process-order-photos/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { labelPhoto, parcelPhoto } = await request.json();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze these two photos of a delivery package. The first is a close-up of the shipping label, the second is a wider shot of the parcel. Extract the delivery information and return ONLY a JSON object with: clientName, address, phoneNumber, barcode, sender, weight. Format: {"clientName": "John Doe", "address": "123 Main St", "phoneNumber": "555-0123", "barcode": "123456789", "sender": "Amazon", "weight": "2.5kg"}`
              },
              {
                type: "image_url",
                image_url: {
                  url: labelPhoto,
                },
              },
              {
                type: "image_url",
                image_url: {
                  url: parcelPhoto,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    const jsonMatch = content.match(/\{.*\}/s);
    if (jsonMatch) {
      const delivery = JSON.parse(jsonMatch[0]);
      console.log("delivery: " , delivery)
      return NextResponse.json({ success: true, delivery });
    } else {
      return NextResponse.json({ success: false, error: "No data found", raw: content });
    }

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}