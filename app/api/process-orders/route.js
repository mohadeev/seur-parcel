import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ 
        success: false, 
        error: 'No PDA list image provided' 
      }, { status: 400 });
    }

    console.log("Starting SERVER-SIDE PDA list extraction...");

    // Step 1: Extract text from PDA list image using OCR.Space FREE API
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const formData = new FormData();
    formData.append('base64Image', `data:image/jpeg;base64,${base64Data}`);
    formData.append('apikey', 'helloworld'); // FREE public key
    formData.append('language', 'eng');
    formData.append('OCREngine', '2');
    formData.append('isTable', 'true'); // Important for tabular data
    formData.append('detectOrientation', 'true');

    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    if (!ocrResponse.ok) {
      throw new Error(`OCR.Space API error: ${ocrResponse.status}`);
    }

    const ocrData = await ocrResponse.json();
    
    if (!ocrData.ParsedResults || !ocrData.ParsedResults[0]) {
      return NextResponse.json({ 
        success: false, 
        error: 'No text found in PDA list image',
        raw: ocrData
      });
    }

    const extractedText = ocrData.ParsedResults[0].ParsedText;
    console.log("PDA List OCR Text:", extractedText);

    if (!extractedText || extractedText.trim().length < 10) {
      return NextResponse.json({ 
        success: false, 
        error: 'No readable text found in PDA list'
      });
    }

    // Step 2: Send extracted text to OpenAI for structured parsing
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
            content: `You are an expert at parsing delivery PDA lists. Extract ALL delivery entries and return ONLY a JSON array of objects with: clientName, address, phoneNumber, barcode, sender, weight.

IMPORTANT RULES:
- Extract EVERY delivery entry you find
- Look for tabular data, lists, or multiple entries
- If phone number is missing, use null
- If barcode is missing, use null  
- Clean and normalize all text
- Focus on Spanish/European formats
- Return ONLY the JSON array, no other text

CRITICAL: Return ALL entries as a JSON array.

Example output:
[
  {
    "clientName": "ZABALA SL DESGUACES",
    "address": "POL IND BEOTIBAR 18, 20491 BELAUNTZA", 
    "phoneNumber": "943671790",
    "barcode": "0002482951",
    "sender": "NORAUTO ESPANA",
    "weight": "54.47 Kgs"
  },
  {
    "clientName": "OTRA EMPRESA SL",
    "address": "CALLE MAYOR 123, 20001 DONOSTIA",
    "phoneNumber": "943123456",
    "barcode": "0002482952", 
    "sender": "AMAZON ESPAÑA",
    "weight": "2.5 kg"
  }
]`
          },
          {
            role: "user",
            content: `Extract ALL delivery entries from this PDA list OCR text: ${extractedText}`
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices[0].message.content;
    
    console.log("OpenAI PDA List Response:", content);

    try {
      const parsedData = JSON.parse(content);
      const deliveries = Array.isArray(parsedData) ? parsedData : 
                        (parsedData.deliveries || parsedData.data || [parsedData]);

      if (!Array.isArray(deliveries) || deliveries.length === 0) {
        throw new Error("No delivery entries found in parsed data");
      }

      // Validate and clean each delivery
      const cleanedDeliveries = deliveries.map((delivery, index) => ({
        clientName: delivery.clientName || `Client ${index + 1}`,
        address: delivery.address || 'Address not found',
        phoneNumber: delivery.phoneNumber || null,
        barcode: delivery.barcode || null,
        sender: delivery.sender || null,
        weight: delivery.weight || null,
        source: 'pda-system',
        extractedAt: new Date().toISOString()
      }));

      console.log(`✅ Successfully extracted ${cleanedDeliveries.length} deliveries from PDA list`);

      return NextResponse.json({ 
        success: true, 
        deliveries: cleanedDeliveries,
        extractedCount: cleanedDeliveries.length,
        ocrText: extractedText // For debugging
      });

    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      return NextResponse.json({ 
        success: false, 
        error: "Failed to parse delivery data from PDA list",
        rawResponse: content,
        ocrText: extractedText
      });
    }

  } catch (error) {
    console.error('PDA List processing error:', error);
    return NextResponse.json({ 
      success: false, 
      error: `PDA list processing failed: ${error.message}` 
    }, { status: 500 });
  }
}