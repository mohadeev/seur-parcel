// app/api/process-order-photos/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { pdaDeliveries, photoData, matchingInstruction, labelPhoto, parcelPhoto } = await request.json();

    // If we have PDA data and photo data, do matching
    if (pdaDeliveries && photoData) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            // In the API route, update the system prompt for matching:
{
  role: "system",
  content: `You are an expert at matching delivery data. You will receive:
1. PDA delivery list (from the system)
2. Photo-extracted data (from label photos)

Your task: Match each PDA delivery with its corresponding photo data and return a combined JSON array.

CRITICAL: You MUST include the full photo data (labelPhoto, labelPreview, parcelPhoto, parcelPreview) for matched deliveries.

Return format:
[
  {
    "clientName": "from PDA",
    "address": "from PDA", 
    "phoneNumber": "from PDA",
    "barcode": "from PDA", 
    "sender": "from PDA",
    "weight": "from PDA",
    // PHOTO DATA - INCLUDE THESE FOR MATCHED DELIVERIES
    "photoSetId": "from photo data",
    "labelPhoto": "from photo data", 
    "labelPreview": "from photo data",
    "parcelPhoto": "from photo data",
    "parcelPreview": "from photo data",
    "ocrText": "from photo data",
    "ocrConfidence": "from photo data",
    "matchConfidence": "high/medium/low",
    "source": "photo-matched/pda-only"
  }
]

IMPORTANT: Copy the exact photo data values from the photoData input. Do not modify them.`
},
   {
  role: "user",
  content: `PDA Deliveries: ${JSON.stringify(pdaDeliveries, null, 2)}

Photo Data (include ALL photo fields in your response): ${JSON.stringify(photoData, null, 2)}

Match the deliveries and return the combined JSON array with ALL photo data included.`
}
          ],
          max_tokens: 4000,
          temperature: 0.1
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'OpenAI API error');
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const combinedDeliveries = JSON.parse(jsonMatch[0]);
        return NextResponse.json({ 
          success: true, 
          combinedDeliveries 
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          error: "No combined data found",
          raw: content 
        });
      }
    }

    // Original photo processing functionality (for backward compatibility)
    if (labelPhoto && parcelPhoto) {
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
        return NextResponse.json({ success: true, delivery });
      } else {
        return NextResponse.json({ success: false, error: "No data found", raw: content });
      }
    }

    return NextResponse.json({ 
      success: false, 
      error: "No valid data provided for processing" 
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}