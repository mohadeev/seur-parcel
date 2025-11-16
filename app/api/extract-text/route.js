import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ 
        success: false, 
        error: 'No image provided' 
      }, { status: 400 });
    }

    console.log("Starting OCR.Space FREE API...");

    // Remove data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    // OCR.Space FREE API (25,000 requests per day free)
    const formData = new FormData();
    formData.append('base64Image', `data:image/jpeg;base64,${base64Data}`);
    formData.append('apikey', 'helloworld'); // FREE public key
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2'); // Engine 2 is more accurate

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
        error: 'No text found in image',
        raw: ocrData
      });
    }

    const text = ocrData.ParsedResults[0].ParsedText;
    const confidence = ocrData.ParsedResults[0].TextOrientation || 'Unknown';

    console.log("OCR.Space extracted text:", text);
    console.log("OCR.Space confidence:", confidence);

    if (!text || text.trim().length < 5) {
      return NextResponse.json({ 
        success: false, 
        error: 'No readable text found in image'
      });
    }

    // Clean the text
    const cleanedText = text
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return NextResponse.json({ 
      success: true, 
      text: cleanedText,
      confidence: confidence,
      provider: 'ocr-space-free'
    });

  } catch (error) {
    console.error('OCR.Space API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: `OCR processing failed: ${error.message}` 
    }, { status: 500 });
  }
}