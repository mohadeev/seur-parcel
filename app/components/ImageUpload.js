'use client';
import { useState } from 'react';
import Tesseract from 'tesseract.js';

export default function ImageUpload({ onDeliveriesExtracted }) {
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    
    try {
      // Use Tesseract to read text from image
      const { data: { text } } = await Tesseract.recognize(
        file,
        'eng',
        { logger: m => console.log(m) }
      );
      
      // Process the extracted text to find addresses
      const extractedDeliveries = processExtractedText(text);
      onDeliveriesExtracted(extractedDeliveries);
      
    } catch (error) {
      console.error('OCR Error:', error);
    } finally {
      setUploading(false);
    }
  };

  const processExtractedText = (text) => {
    // This function will parse the text and extract:
    // - Client names
    // - Addresses  
    // - Phone numbers
    // You'll need to customize this based on your order format
    
    const deliveries = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (isAddress(line)) {
        deliveries.push({
          address: line,
          clientName: lines[i-1] || 'Unknown', // assuming name is above address
          phone: extractPhone(lines[i+1] || '')
        });
      }
    }
    
    return deliveries;
  };

  return (
    <div className="mb-6">
      <input 
        type="file" 
        accept="image/*"
        onChange={handleImageUpload}
        disabled={uploading}
      />
      {uploading && <p>Reading addresses from image...</p>}
    </div>
  );
}