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

export const generateImageWithBria = async (params: SceneParams, apiKey: string): Promise<string> => {
    if (!apiKey) throw new Error("Bria API Key is required.");

    // Construct prompt
    const keyGel = getGelName(params.keyLight.gel);
    const keyTempDesc = getTempDescription(params.keyLight.colorTemp);
    
    let lightingDesc = `Key Light: ${keyTempDesc} (${params.keyLight.colorTemp}K) with ${keyGel} gel, positioned at [x:${params.keyLight.position.x.toFixed(1)}, y:${params.keyLight.position.y.toFixed(1)}], intensity ${(params.keyLight.intensity * 100).toFixed(0)}%.`;
    if (params.fillLight.enabled) {
        const fillGel = getGelName(params.fillLight.gel);
        const fillTempDesc = getTempDescription(params.fillLight.colorTemp);
        lightingDesc += ` Fill Light: ${fillTempDesc} (${params.fillLight.colorTemp}K) with ${fillGel} gel, positioned at [x:${params.fillLight.position.x.toFixed(1)}, y:${params.fillLight.position.y.toFixed(1)}], intensity ${(params.fillLight.intensity * 100).toFixed(0)}%.`;
    }

    const prompt = `High-end studio photography, ${params.visualStyle} style. Subject: ${params.subjectDescription}. Lighting Setup: ${lightingDesc} Camera: ${params.shotSize}, ${params.cameraAngle}, ${params.lensType} lens. Breathtaking, photorealistic, 8k resolution, highly detailed texture, sharp focus, cinematic lighting.`;

    // Call Bria Direct API
    const response = await fetch("https://engine.bria.ai/v1/text-to-image/base/2.3", {
        method: "POST",
        headers: {
            "api_token": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: prompt,
            num_results: 1,
            aspect_ratio: "16:9",
            sync: true
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Bria API Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    
    // Bria API returns { result: [{ url: "..." }] }
    if (data.result && data.result.length > 0) {
        return data.result[0].url;
    }
    throw new Error("No image returned from Bria");
};