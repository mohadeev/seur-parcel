// app/api/process-order-text/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { ocrText } = await request.json();

    if (!ocrText) {
      return NextResponse.json({ 
        success: false, 
        error: 'No OCR text provided' 
      });
    }

    console.log("Processing OCR text with OpenAI:", ocrText);

    // Send extracted text to OpenAI for structured processing
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
            content: `Extract delivery information from this OCR text: ${ocrText}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
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
      console.log("Structured delivery data:", delivery);
      
      return NextResponse.json({ 
        success: true, 
        delivery
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: "No structured data found",
        raw: content 
      });
    }

  } catch (error) {
    console.error('OpenAI Processing error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}