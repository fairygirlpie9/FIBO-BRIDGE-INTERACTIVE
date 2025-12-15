import { GoogleGenAI } from "@google/genai";
import { SceneParams } from "../types";
import { GEL_PRESETS } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getGelName = (hex: string) => {
    const match = GEL_PRESETS.find(g => g.hex.toLowerCase() === hex.toLowerCase());
    return match ? match.name : "Custom Color";
};

const getTempDescription = (kelvin: number) => {
    if (kelvin < 3000) return "Warm Candlelight";
    if (kelvin < 4500) return "Warm White";
    if (kelvin < 6000) return "Neutral Daylight";
    return "Cool Blue";
};

export const generateImageWithGemini = async (params: SceneParams, referenceImageBase64?: string): Promise<string> => {
  // Construct a descriptive prompt for the model
  const keyGel = getGelName(params.keyLight.gel);
  const keyTempDesc = getTempDescription(params.keyLight.colorTemp);
  
  let lightingDesc = `Key Light: ${keyTempDesc} (${params.keyLight.colorTemp}K) with ${keyGel} gel, positioned at [x:${params.keyLight.position.x.toFixed(1)}, y:${params.keyLight.position.y.toFixed(1)}], intensity ${(params.keyLight.intensity * 100).toFixed(0)}%.`;
  
  if (params.fillLight.enabled) {
    const fillGel = getGelName(params.fillLight.gel);
    const fillTempDesc = getTempDescription(params.fillLight.colorTemp);
    lightingDesc += ` Fill Light: ${fillTempDesc} (${params.fillLight.colorTemp}K) with ${fillGel} gel, positioned at [x:${params.fillLight.position.x.toFixed(1)}, y:${params.fillLight.position.y.toFixed(1)}], intensity ${(params.fillLight.intensity * 100).toFixed(0)}%.`;
  }

  const prompt = `
    Generate a high-quality cinematic image based on this scene description and the provided reference image (if available) for composition.
    
    REFERENCE IMAGE INSTRUCTIONS:
    - Strictly follow the camera angle, framing, and perspective of the provided reference image.
    - Keep the subject position exactly as shown in the reference.
    - Use the reference image *only* for structure/layout, not for the visual style or final subject appearance (replace the 3D model with the realistic subject described below).
    
    SCENE DETAILS:
    Subject: ${params.subjectDescription} (Replace the proxy 3D models with this).
    Lighting Setup: ${lightingDesc}
    Camera: ${params.shotSize}, ${params.cameraAngle}, ${params.lensType} lens.
    Visual Style: ${params.visualStyle}.
    
    High fidelity, photorealistic, 8k, highly detailed, sharp focus, octane render.
  `;

  const parts: any[] = [{ text: prompt }];

  if (referenceImageBase64) {
      // Split "data:image/jpeg;base64,..."
      const mimeType = referenceImageBase64.split(';')[0].split(':')[1];
      const data = referenceImageBase64.split(',')[1];
      
      parts.push({
          inlineData: {
              mimeType: mimeType,
              data: data
          }
      });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: parts
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64EncodeString: string = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }
    throw new Error("No image data found in Gemini response.");
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};