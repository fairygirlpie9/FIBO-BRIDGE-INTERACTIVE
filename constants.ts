export const KELVIN_COLORS: Record<number, string> = {
  2000: '#ff8912', // Candle
  3200: '#ffaa5e', // Tungsten
  4500: '#fff3ef', // Fluorescent
  5600: '#ffffff', // Daylight
  6500: '#f0f4ff', // Overcast
  8000: '#dbeaff', // Shade
  10000: '#ccdbff', // Blue Sky
};

export const GEL_PRESETS = [
  { name: 'Neutral', hex: '#ffffff' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Magenta', hex: '#d946ef' },
];

export const LENS_OPTIONS = ['24mm', '35mm', '50mm', '85mm'];
export const ANGLE_OPTIONS = ['Eye Level', 'High Angle', 'Low Angle', 'Dutch Angle'];
export const SHOT_OPTIONS = ['Close Up', 'Medium Shot', 'Full Shot', 'Wide Shot'];
export const STYLE_OPTIONS = ['Cinematic', 'Film Noir', 'Cyberpunk', 'Ethereal', 'Documentary', 'Studio Portrait'];

// Helper to estimate hex from Kelvin for slider visualization
export const kelvinToHex = (kelvin: number): string => {
  // Simplified approximation
  if (kelvin < 4000) return '#ffaa5e';
  if (kelvin < 6000) return '#ffffff';
  return '#ccdbff';
};
