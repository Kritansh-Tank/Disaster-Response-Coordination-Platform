const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function extractLocation(description) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Extract all location names from the following disaster description. Return ONLY a JSON array of location strings. If no locations found, return an empty array [].

Description: "${description}"

Example output: ["Manhattan, NYC", "Brooklyn, NY"]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON from response, handling markdown code blocks
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const locations = JSON.parse(cleaned);

    logger.info(`Location extracted from description`, { locations });
    return locations;
  } catch (err) {
    logger.error(`Gemini location extraction error: ${err.message}`);
    return [];
  }
}

async function verifyImage(imageUrl, context = '') {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a disaster image verification expert. Analyze the image at the following URL and determine:
1. Is this image likely authentic or manipulated?
2. Does it show a real disaster scene?
3. What type of disaster does it depict (if any)?
4. Confidence level (high, medium, low)

Image URL: ${imageUrl}
${context ? `Context: ${context}` : ''}

Respond in JSON format:
{
  "is_authentic": true/false,
  "is_disaster": true/false,
  "disaster_type": "type or null",
  "confidence": "high/medium/low",
  "analysis": "brief explanation",
  "verification_status": "verified/fake/unverifiable"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const verification = JSON.parse(cleaned);

    logger.info(`Image verification completed`, { imageUrl, status: verification.verification_status });
    return verification;
  } catch (err) {
    logger.error(`Gemini image verification error: ${err.message}`);
    return {
      is_authentic: null,
      is_disaster: null,
      disaster_type: null,
      confidence: 'low',
      analysis: `Verification failed: ${err.message}`,
      verification_status: 'unverifiable',
    };
  }
}

module.exports = { extractLocation, verifyImage };
