// lib/ocr.js - Client-side OCR utility
export class ClientSideOCR {
  static async extractTextFromImage(imageData) {
    // Import Tesseract dynamically (client-side only)
    const Tesseract = (await import('tesseract.js')).default;
    
    try {
      console.log("Starting client-side OCR...");
      
      const { data } = await Tesseract.recognize(
        imageData,
        'eng+spa',
        {
          logger: progress => {
            if (progress.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(progress.progress * 100)}%`);
            }
          }
        }
      );
      
      console.log("OCR Result:", data.text);
      return {
        text: data.text,
        confidence: data.confidence
      };
    } catch (error) {
      console.error("OCR Error:", error);
      throw new Error(`OCR failed: ${error.message}`);
    }
  }
}