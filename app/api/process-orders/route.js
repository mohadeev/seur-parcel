import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { imageBase64 } = await request.json();

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
                text: `Extract all delivery information from this image. Return ONLY a JSON array of objects with: clientName, address, phoneNumber. Format: [{"clientName": "John Doe", "address": "123 Main St", "phoneNumber": "555-0123"}, ...]`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64,
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
    
    const jsonMatch = content.match(/\[.*\]/s);
    if (jsonMatch) {
      const deliveries = JSON.parse(jsonMatch[0]);
      console.log("orders" , deliveries)
      return NextResponse.json({ success: true, deliveries });
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