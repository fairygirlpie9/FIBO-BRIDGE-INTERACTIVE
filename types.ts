export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface LightSettings {
  position: Vector3;
  intensity: number;
  colorTemp: number;
  gel: string;
  enabled: boolean;
}

export interface SceneParams {
  subjectDescription: string;
  subjectModel: 'Mannequin' | 'Geometric' | 'Cube' | 'BoomBox' | 'Dragon' | 'Helmet' | 'Car';
  keyLight: LightSettings;
  fillLight: LightSettings;
  cameraAngle: 'Eye Level' | 'High Angle' | 'Low Angle' | 'Dutch Angle';
  lensType: '24mm' | '35mm' | '50mm' | '85mm';
  shotSize: 'Close Up' | 'Medium Shot' | 'Full Shot' | 'Wide Shot';
  visualStyle: 'Cinematic' | 'Film Noir' | 'Cyberpunk' | 'Ethereal' | 'Documentary';
}

export interface GeneratedShot {
  id: string;
  timestamp: number;
  imageUrl: string;
  params: SceneParams;
}

export enum ControlMode {
  ORBIT = 'ORBIT',
  DRAG_KEY = 'DRAG_KEY',
  DRAG_FILL = 'DRAG_FILL',
}

// Rotated lights 180 degrees (x -> -x, z -> -z)
export const DEFAULT_LIGHT: LightSettings = {
  position: { x: -2, y: 2, z: -2 },
  intensity: 1.0,
  colorTemp: 5600,
  gel: '#ffffff',
  enabled: true
};

export const DEFAULT_PARAMS: SceneParams = {
  subjectDescription: "A futuristic cyberpunk detective standing in the rain",
  subjectModel: 'Mannequin',
  keyLight: { ...DEFAULT_LIGHT, position: { x: -2, y: 2.5, z: -2 }, intensity: 1.2 },
  fillLight: { ...DEFAULT_LIGHT, position: { x: 2, y: 1.5, z: -2 }, intensity: 0.3, enabled: true },
  cameraAngle: 'Eye Level',
  lensType: '35mm',
  shotSize: 'Wide Shot',
  visualStyle: 'Cinematic',
};