import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

/**
 * Available Gemini models
 */
export const GEMINI_MODELS = {
  FLASH: 'gemini-2.5-flash',
  PRO: 'gemini-2.5-pro',
  FLASH_LITE: 'gemini-2.5-flash-lite',
};

/**
 * Analyzes a WhatsApp message to extract 311 service request information
 * @param {string} messageText - The incoming message text
 * @param {string} modelName - The Gemini model to use (optional, defaults to gemini-2.0-flash-exp)
 * @returns {Promise<Object|null>} Analysis result with requestType, location, details, confidence
 */
export async function analyzeMessageWithGemini(messageText, modelName = GEMINI_MODELS.FLASH) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    console.log(`🤖 Using model: ${modelName}`);

    const prompt = `You are an AI assistant helping to parse San Francisco 311 service requests from WhatsApp messages.

Analyze the following message and extract:
1. Request Type (e.g., "Abandoned Vehicle", "Pothole or Street Defect", "Graffiti", "Streetlight Repair", "Illegal Dumping", "Damaged Street Sign", etc.)
2. Location (full address or intersection in San Francisco)
3. Details (vehicle info, description of damage, etc.)
4. Confidence (0-1 scale, how confident you are this is a valid 311 request)

Common SF 311 Request Types:
- Abandoned Vehicle
- Pothole or Street Defect
- Graffiti
- Streetlight Repair
- Illegal Dumping
- Damaged Street Sign
- Tree Maintenance
- Sidewalk Repair
- Parking Meter Issue
- Public Restroom Issue

Message: "${messageText}"

Respond ONLY with valid JSON in this exact format:
{
  "requestType": "request type here",
  "location": "full location in San Francisco",
  "details": "extracted details",
  "confidence": 0.95
}

If this doesn't appear to be a 311 service request, return confidence below 0.7 and make your best guess.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ No JSON found in Gemini response:', text);
      return null;
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Validate the response structure
    if (!analysis.requestType || !analysis.location || analysis.confidence === undefined) {
      console.error('❌ Invalid analysis structure:', analysis);
      return null;
    }

    return analysis;
  } catch (error) {
    console.error('❌ Error analyzing message with Gemini:', error);
    return null;
  }
}
