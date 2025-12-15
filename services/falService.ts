import { SceneParams } from "../types";
import { GEL_PRESETS } from "../constants";

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

export const generateImageFromScene = async (params: SceneParams, apiKey: string): Promise<string> => {
  if (!apiKey) {
      throw new Error("FAL API Key is required.");
  }

  // Construct lighting description
  const keyGel = getGelName(params.keyLight.gel);
  const keyTempDesc = getTempDescription(params.keyLight.colorTemp);

  let lightingDesc = `Key Light: ${keyTempDesc} (${params.keyLight.colorTemp}K) with ${keyGel} gel, positioned at [x:${params.keyLight.position.x.toFixed(1)}, y:${params.keyLight.position.y.toFixed(1)}], intensity ${(params.keyLight.intensity * 100).toFixed(0)}%.`;
  
  if (params.fillLight.enabled) {
    const fillGel = getGelName(params.fillLight.gel);
    const fillTempDesc = getTempDescription(params.fillLight.colorTemp);
    lightingDesc += ` Fill Light: ${fillTempDesc} (${params.fillLight.colorTemp}K) with ${fillGel} gel, positioned at [x:${params.fillLight.position.x.toFixed(1)}, y:${params.fillLight.position.y.toFixed(1)}], intensity ${(params.fillLight.intensity * 100).toFixed(0)}%.`;
  }

  // Bria 2.3 (FIBO) works best with natural language but clear structural cues.
  // Replaced "octane render" with "studio photography" and "masterpiece" for better FIBO adherence.
  const prompt = `
    High-end studio photography, ${params.visualStyle} style.
    Subject: ${params.subjectDescription}.
    Lighting Setup: ${lightingDesc}
    Camera: ${params.shotSize}, ${params.cameraAngle}, ${params.lensType} lens.
    Breathtaking, photorealistic, 8k resolution, highly detailed texture, sharp focus, cinematic lighting.
  `;

  try {
    // BRIA 2.3 is the managed endpoint for Bria's photorealistic (FIBO) model family.
    const response = await fetch("https://fal.run/fal-ai/bria/text-to-image/v2.3", {
      method: "POST",
      headers: {
        "Authorization": `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        aspect_ratio: "16:9", // Bria v2.3 preferred param
        safety_tolerance: "2" // Standard for Bria
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FAL API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (result.images && result.images.length > 0) {
      return result.images[0].url;
    }
    
    throw new Error("No image generated");
  } catch (error) {
    console.error("FAL Generation Error:", error);
    throw error;
  }
};