import { GoogleGenerativeAI } from '@google/generative-ai';

class GoogleAIService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    // Initialize immediately with just the API key
    const apiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    }
  }

  // HSN code mapping for common medicine types
  private getDefaultHSN(medicineType: string, scheduleType: string): string {
    const type = medicineType?.toLowerCase() || '';
    const schedule = scheduleType?.toLowerCase() || '';
    
    // Schedule-based HSN codes
    if (schedule === 'h1' || schedule === 'x') {
      return '30049011'; // Narcotic and psychotropic substances
    }
    
    // Type-based HSN codes
    if (type.includes('tablet') || type.includes('capsule')) {
      return '30049099'; // Medicaments in tablet/capsule form
    } else if (type.includes('syrup') || type.includes('liquid') || type.includes('suspension')) {
      return '30049091'; // Liquid medicaments
    } else if (type.includes('injection') || type.includes('vial')) {
      return '30049092'; // Injectable medicaments
    } else if (type.includes('cream') || type.includes('ointment') || type.includes('gel')) {
      return '30049093'; // Topical medicaments
    } else if (type.includes('drops') || type.includes('eye') || type.includes('ear')) {
      return '30049094'; // Ophthalmic/otic preparations
    } else if (type.includes('inhaler') || type.includes('spray')) {
      return '30049095'; // Respiratory preparations
    } else if (type.includes('powder')) {
      return '30049096'; // Medicaments in powder form
    }
    
    // Default HSN for general medicines
    return '30049099';
  }

  async extractMedicineInfo(imageFile: File): Promise<any> {
    if (!this.model) {
      throw new Error('Google AI API key not found. Please add VITE_GOOGLE_AI_API_KEY to your .env file.');
    }

    try {
      // Convert image to base64
      const imageData = await this.fileToGenerativePart(imageFile);
      
      const prompt = `
        Analyze this medicine package/label image and extract the following information in JSON format:
        
        {
          "name": "Full medicine name with dosage",
          "genericName": "Generic/salt name",
          "brandName": "Brand name",
          "dosage": "Dosage strength",
          "medicineType": "Type (Tablet/Capsule/Syrup/etc)",
          "manufacturer": "Manufacturer name",
          "scheduleType": "GENERAL/H/H1/X",
          "hsn": "HSN code",
          "batchNumber": "Batch number",
          "mrp": "Maximum Retail Price (number only)",
          "expiryDate": "Expiry date in YYYY-MM-DD format",
          "confidence": "Confidence score (0-100)"
        }
        
        Only return valid JSON. If any field is not clearly visible, use null for that field.
        For scheduleType, use "GENERAL" if not specified.
        For confidence, provide a score based on how clearly the information is visible.
      `;

      const result = await this.model.generateContent([prompt, imageData]);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON response
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedData = JSON.parse(jsonMatch[0]);
          
          // Auto-generate HSN code if not detected
          if (!parsedData.hsn || parsedData.hsn === null) {
            parsedData.hsn = this.getDefaultHSN(parsedData.medicineType, parsedData.scheduleType);
            parsedData.hsnGenerated = true; // Flag to indicate it was auto-generated
          }
          
          return parsedData;
        }
        throw new Error('No valid JSON found in response');
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        throw new Error('Failed to parse AI response');
      }
    } catch (error) {
      console.error('Error extracting medicine info:', error);
      if (error instanceof Error && error.message.includes('API_KEY')) {
        throw new Error('Invalid API key. Please check your Google AI API key.');
      }
      throw error;
    }
  }

  async processExtractedText(extractedText: string): Promise<any> {
    if (!this.model) {
      throw new Error('Google AI not initialized. Please check your API key.');
    }

    try {
      const prompt = `
        Parse this extracted text from a medicine package and convert it to structured JSON:
        
        "${extractedText}"
        
        Return JSON in this exact format:
        {
          "name": "Full medicine name with dosage",
          "genericName": "Generic/salt name",
          "brandName": "Brand name",
          "dosage": "Dosage strength",
          "medicineType": "Type (Tablet/Capsule/Syrup/etc)",
          "manufacturer": "Manufacturer name",
          "scheduleType": "GENERAL/H/H1/X",
          "hsn": "HSN code",
          "batchNumber": "Batch number",
          "mrp": "Maximum Retail Price (number only)",
          "expiryDate": "Expiry date in YYYY-MM-DD format",
          "confidence": "Confidence score (0-100)"
        }
        
        Only return valid JSON. If any field is not found, use null.
        For scheduleType, use "GENERAL" if not specified.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON response
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedData = JSON.parse(jsonMatch[0]);
          
          // Auto-generate HSN code if not detected
          if (!parsedData.hsn || parsedData.hsn === null) {
            parsedData.hsn = this.getDefaultHSN(parsedData.medicineType, parsedData.scheduleType);
            parsedData.hsnGenerated = true; // Flag to indicate it was auto-generated
          }
          
          return parsedData;
        }
        throw new Error('No valid JSON found in response');
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        throw new Error('Failed to parse AI response');
      }
    } catch (error) {
      console.error('Error processing text:', error);
      throw error;
    }
  }

  private async fileToGenerativePart(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = (reader.result as string).split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Check if API is properly configured
  isConfigured(): boolean {
    return this.model !== null;
  }


  async generateMedicineDescription(medicineData: {
    name?: string;
    genericName?: string;
    brandName?: string;
    dosage?: string;
    medicineType?: string;
    manufacturer?: string;
    scheduleType?: string;
  }): Promise<string> {
    if (!this.model) {
      throw new Error('Google AI not initialized. Please check your API key.');
    }

    try {
      const prompt = `
        Generate a professional, concise description for this medicine based on the provided information:
        
        Medicine Name: ${medicineData.name || 'Not specified'}
        Generic Name: ${medicineData.genericName || 'Not specified'}
        Brand Name: ${medicineData.brandName || 'Not specified'}
        Dosage: ${medicineData.dosage || 'Not specified'}
        Type: ${medicineData.medicineType || 'Not specified'}
        Manufacturer: ${medicineData.manufacturer || 'Not specified'}
        Schedule: ${medicineData.scheduleType || 'GENERAL'}
        
        Write a 2-3 sentence description that includes:
        1. What the medicine is used for (therapeutic use)
        2. How it should be taken/administered
        3. Any important safety notes if it's a scheduled medicine
        
        Keep it professional, informative, and suitable for pharmacy records.
        Return only the description text, no JSON or formatting.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error generating description:', error);
      throw new Error('Failed to generate description');
    }
  }
}

export const googleAIService = new GoogleAIService();