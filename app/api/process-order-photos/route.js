// app/api/process-order-photos/route.js
import { NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';

export async function POST(request) {
  try {
    const { labelPhoto, pdaDeliveries, photoData } = await request.json();

    // If we have PDA data and photo data, do matching (existing functionality)
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
            {
              role: "system",
              content: `You are an expert at matching delivery data. You will receive:
1. PDA delivery list (from the system)
2. Photo-extracted data (from label photos)

Your task: Match each PDA delivery with its corresponding photo data and return a combined JSON array.

Return format:
[
  {
    "clientName": "from PDA",
    "address": "from PDA", 
    "phoneNumber": "from PDA",
    "barcode": "from PDA",
    "sender": "from PDA",
    "weight": "from PDA",
    "photoSetId": "from photo data if matched",
    "labelPhoto": "from photo data if matched",
    "labelPreview": "from photo data if matched", 
    "matchConfidence": "high/medium/low",
    "source": "photo-matched/pda-only"
  }
]

Match based on: client name, address, phone number, barcode. Use fuzzy matching for names.`
            },
            {
              role: "user",
              content: `PDA Deliveries: ${JSON.stringify(pdaDeliveries, null, 2)}

Photo Data: ${JSON.stringify(photoData, null, 2)}

Please match and combine these datasets. Return ONLY the JSON array.`
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

    // SERVER-SIDE OCR PROCESSING - LABEL ONLY (NO PARCEL PHOTO)
    if (labelPhoto) {
      // Extract text from LABEL image using Tesseract.js
      const { data: { text, confidence } } = await Tesseract.recognize(
        labelPhoto,
        'eng+spa',
        { 
          logger: progress => {
            if (progress.status === 'recognizing text') {
              console.log(`Server OCR Progress: ${Math.round(progress.progress * 100)}%`);
            }
          }
        }
      );

      if (!text || text.trim().length < 10) {
        return NextResponse.json({ 
          success: false, 
          error: 'No readable text found in label image' 
        });
      }

      // Send extracted text to OpenAI for structured processing
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert at parsing delivery label information. Extract the delivery details from the provided OCR text and return ONLY a JSON object with: clientName, address, phoneNumber, barcode, sender, weight. If any field is not found, return null for that field.

IMPORTANT: Focus on Spanish/European address formats. Look for patterns like:
- POL IND (Industrial Park)
- CP (Postal Code) 
- Spanish phone numbers (9 digits)
- Barcodes and reference numbers

Example output:
{
  "clientName": "ZABALA SL DESGUACES",
  "address": "POL IND BEOTIBAR 18, 20491 BELAUNTZA",
  "phoneNumber": "943671790",
  "barcode": "0002482951",
  "sender": "NORAUTO ESPANA",
  "weight": "54.47 Kgs"
}`
            },
            {
              role: "user",
              content: `Extract delivery information from this LABEL OCR text: ${text}`
            }
          ],
          max_tokens: 1000,
          temperature: 0.1
        }),
      });

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.json();
        throw new Error(errorData.error?.message || 'OpenAI API error');
      }

      const openaiData = await openaiResponse.json();
      const content = openaiData.choices[0].message.content;
      
      const jsonMatch = content.match(/\{.*\}/s);
      if (jsonMatch) {
        const delivery = JSON.parse(jsonMatch[0]);
        
        return NextResponse.json({ 
          success: true, 
          delivery,
          ocrText: text,
          ocrConfidence: confidence
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          error: "No structured data found",
          ocrText: text,
          raw: content 
        });
      }
    }

    // REMOVED: Original image processing with both label and parcel photos
    // Only label photo processing is needed

    return NextResponse.json({ 
      success: false, 
      error: "No label photo provided for processing" 
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}