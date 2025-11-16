// app/api/ocr-process-order/route.js
import { NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';

export async function POST(request) {
  try {
    const { labelPhoto } = await request.json();

    if (!labelPhoto) {
      return NextResponse.json({ 
        success: false, 
        error: 'No label photo provided' 
      });
    }

    // Step 1: Extract text from image using Tesseract.js (FREE)
    console.log("Starting OCR text extraction...");
    
    const { data: { text } } = await Tesseract.recognize(
      labelPhoto,
      'eng+spa', // English + Spanish
      { 
        logger: m => console.log(m) 
      }
    );

    console.log("OCR Extracted Text:", text);

    if (!text || text.trim().length < 10) {
      return NextResponse.json({ 
        success: false, 
        error: 'No readable text found in image' 
      });
    }

    // Step 2: Send extracted text to OpenAI for structured processing
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
            content: `Extract delivery information from this OCR text: ${text}`
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
        delivery,
        ocrText: text // Include raw OCR text for debugging
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: "No structured data found",
        ocrText: text,
        raw: content 
      });
    }

  } catch (error) {
    console.error('OCR Processing error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}