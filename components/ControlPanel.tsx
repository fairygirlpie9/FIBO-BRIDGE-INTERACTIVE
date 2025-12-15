import React from 'react';
import { SceneParams, ControlMode } from '../types';
import { GEL_PRESETS, LENS_OPTIONS, ANGLE_OPTIONS, SHOT_OPTIONS, STYLE_OPTIONS } from '../constants';
import { Sliders, Camera, Zap, Palette, Video } from 'lucide-react';

interface ControlPanelProps {
  params: SceneParams;
  setParams: React.Dispatch<React.SetStateAction<SceneParams>>;
  mode: ControlMode;
  setMode: (mode: ControlMode) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  params, 
  setParams, 
  mode, 
  setMode,
  isGenerating,
  onGenerate
}) => {
  
  const handleParamChange = <K extends keyof SceneParams>(key: K, value: SceneParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleLightChange = (key: keyof import('../types').LightSettings, value: any) => {
    setParams(prev => ({
        ...prev,
        keyLight: { ...prev.keyLight, [key]: value }
    }));
  };

  return (
    <div className="h-full overflow-y-auto pr-2 space-y-6 text-sm">
      
      {/* Control Modes */}
      <div className="bg-zinc-900 p-1 rounded-lg flex border border-zinc-800">
        <button 
          onClick={() => setMode(ControlMode.ORBIT)}
          className={`flex-1 py-1.5 px-3 rounded text-center transition-colors ${mode === ControlMode.ORBIT ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Orbit Camera
        </button>
        <button 
          onClick={() => setMode(ControlMode.DRAG_KEY)}
          className={`flex-1 py-1.5 px-3 rounded text-center transition-colors ${mode === ControlMode.DRAG_KEY ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Drag Lights
        </button>
      </div>

      {/* Subject */}
      <section className="space-y-3">
        <div className="flex items-center text-zinc-400 uppercase text-xs font-bold tracking-wider">
          <Video className="w-3 h-3 mr-2" /> Subject Description
        </div>
        <textarea 
          value={params.subjectDescription}
          onChange={(e) => handleParamChange('subjectDescription', e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none h-20"
          placeholder="Describe your subject..."
        />
      </section>

      {/* Visual Style */}
       <section className="space-y-3">
        <div className="flex items-center text-zinc-400 uppercase text-xs font-bold tracking-wider">
          <Palette className="w-3 h-3 mr-2" /> Visual Style
        </div>
        <div className="grid grid-cols-2 gap-2">
            {STYLE_OPTIONS.map(style => (
                <button
                    key={style}
                    onClick={() => handleParamChange('visualStyle', style as any)}
                    className={`px-3 py-2 rounded text-xs border text-left ${
                        params.visualStyle === style 
                        ? 'bg-purple-900/30 border-purple-500 text-purple-200' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                >
                    {style}
                </button>
            ))}
        </div>
      </section>

      {/* Telemetry */}
      <section className="space-y-3">
        <div className="flex items-center text-zinc-400 uppercase text-xs font-bold tracking-wider">
          <Camera className="w-3 h-3 mr-2" /> Camera Telemetry
        </div>
        <div className="grid grid-cols-2 gap-3 bg-zinc-900 p-4 rounded-lg border border-zinc-800">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">ANGLE</label>
            <select 
              value={params.cameraAngle}
              onChange={(e) => handleParamChange('cameraAngle', e.target.value as any)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-zinc-200"
            >
              {ANGLE_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">LENS</label>
            <select 
              value={params.lensType}
              onChange={(e) => handleParamChange('lensType', e.target.value as any)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-zinc-200"
            >
              {LENS_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">SHOT SIZE</label>
            <select 
              value={params.shotSize}
              onChange={(e) => handleParamChange('shotSize', e.target.value as any)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-zinc-200"
            >
               {SHOT_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Lighting */}
      <section className="space-y-4">
        <div className="flex items-center text-zinc-400 uppercase text-xs font-bold tracking-wider">
          <Zap className="w-3 h-3 mr-2" /> Light Source A
        </div>
        
        <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 space-y-4">
            
            {/* Color Temp */}
            <div>
                <div className="flex justify-between mb-2">
                    <label className="text-xs text-zinc-400">Color Temp</label>
                    <span className="text-xs bg-yellow-900/30 text-yellow-500 px-1.5 rounded">{params.keyLight.colorTemp}K</span>
                </div>
                <input 
                    type="range" 
                    min="2000" 
                    max="10000" 
                    step="100"
                    value={params.keyLight.colorTemp}
                    onChange={(e) => handleLightChange('colorTemp', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gradient-to-r from-orange-500 via-white to-blue-500 rounded-full appearance-none cursor-pointer"
                />
            </div>

            {/* Intensity */}
            <div>
                 <div className="flex justify-between mb-2">
                    <label className="text-xs text-zinc-400">Intensity</label>
                    <span className="text-xs text-zinc-300">{(params.keyLight.intensity * 100).toFixed(0)}%</span>
                </div>
                <input 
                    type="range" 
                    min="0" 
                    max="5" 
                    step="0.1"
                    value={params.keyLight.intensity}
                    onChange={(e) => handleLightChange('intensity', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
                />
            </div>

            {/* Gels */}
            <div>
                <label className="block text-xs text-zinc-400 mb-2">GEL / FILTER</label>
                <div className="grid grid-cols-4 gap-2">
                    {GEL_PRESETS.map(gel => (
                        <button
                            key={gel.name}
                            onClick={() => handleLightChange('gel', gel.hex)}
                            className={`h-8 rounded w-full border-2 ${
                                params.keyLight.gel === gel.hex ? 'border-white' : 'border-transparent hover:border-zinc-500'
                            }`}
                            style={{ backgroundColor: gel.hex }}
                            title={gel.name}
                        />
                    ))}
                </div>
            </div>
        </div>
      </section>

      <div className="pb-24">
           {/* Spacer for sticky footer */}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur border-t border-zinc-800">
          <button 
            onClick={onGenerate}
            disabled={isGenerating}
            className={`w-full py-3 rounded-lg font-bold text-white tracking-wide transition-all shadow-lg flex justify-center items-center ${
                isGenerating 
                ? 'bg-zinc-700 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20'
            }`}
          >
            {isGenerating ? (
                <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    DEVELOPING...
                </>
            ) : (
                'GENERATE SHOT'
            )}
          </button>
      </div>

    </div>
  );
};