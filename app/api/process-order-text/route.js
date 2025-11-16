import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { ocrText } = await request.json();

    if (!ocrText) {
      return NextResponse.json({ 
        success: false, 
        error: 'No OCR text provided' 
      }, { status: 400 });
    }

    console.log("Processing OCR text with OpenAI:", ocrText.substring(0, 100) + "...");

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
            content: `You are an expert at parsing Spanish delivery label information. Extract the delivery details from the provided OCR text and return ONLY a JSON object with: clientName, address, phoneNumber, barcode, sender, weight. 

IMPORTANT RULES:
- If any field is not found, return null for that field
- Focus on Spanish/European address formats
- Look for POL IND (Industrial Park), CP (Postal Code)
- Spanish phone numbers are 9 digits
- Clean and normalize all text

CRITICAL: Return ONLY the JSON object, no other text.

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
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log("OpenAI Response:", content);

    try {
      const delivery = JSON.parse(content);
      
      // Validate the response has at least some data
      const hasValidData = Object.values(delivery).some(value => 
        value && value !== null && value !== 'null'
      );

      if (!hasValidData) {
        return NextResponse.json({ 
          success: false, 
          error: "No valid delivery data extracted",
          ocrText: ocrText
        });
      }

      return NextResponse.json({ 
        success: true, 
        delivery,
        ocrText: ocrText // Include for reference
      });

    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      return NextResponse.json({ 
        success: false, 
        error: "Invalid JSON response from AI",
        rawResponse: content,
        ocrText: ocrText
      });
    }

  } catch (error) {
    console.error('OpenAI Processing error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}