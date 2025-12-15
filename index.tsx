import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createIcons, Video, Aperture, Zap, Palette, Code, Sliders, Image as ImageIcon, Crosshair, ChevronDown, Download, Upload, Sun, Moon, Key, Box, Move, X, Eye, Monitor, Film, Layers } from 'lucide';
import { DEFAULT_PARAMS, ControlMode, SceneParams, LightSettings, GeneratedShot } from './types';
import { KELVIN_COLORS, GEL_PRESETS, LENS_OPTIONS, ANGLE_OPTIONS, SHOT_OPTIONS, STYLE_OPTIONS } from './constants';
import { generateImageFromScene } from './services/falService';
import { generateImageWithGemini } from './services/geminiService';

// --- State Management ---
let state = {
  ...DEFAULT_PARAMS,
  mode: ControlMode.ORBIT,
  activeLight: 'key' as 'key' | 'fill', 
  isGenerating: false,
  falApiKey: '',
  gallery: [] as GeneratedShot[],
  viewingShotId: null as string | null, // For Lightbox
  isGalleryOpen: true, // Track gallery visibility
};

// --- DOM Elements References ---
const els: Record<string, HTMLElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = {};

// --- Three.js Globals ---
let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer;
let orbitControls: OrbitControls, transformControl: TransformControls;
let keyLight: THREE.SpotLight, keyLightMesh: THREE.Mesh;
let fillLight: THREE.SpotLight, fillLightMesh: THREE.Mesh;
let subjectGroup: THREE.Group;
let grid: THREE.GridHelper;
let floor: THREE.Mesh;
const gltfLoader = new GLTFLoader();

// --- Lighting Presets ---
// Rotated 180 degrees (Negate X and Z)
const LIGHTING_PRESETS = {
  'Rembrandt': { keyPos: { x: -2.5, y: 2.5, z: -2.5 }, fillPos: { x: 2, y: 1, z: -1.5 }, fillInt: 0.2 },
  'Split': { keyPos: { x: -4, y: 1.5, z: 0 }, fillPos: { x: 4, y: 1.5, z: 0 }, fillInt: 0.1 },
  'Butterfly': { keyPos: { x: 0, y: 4, z: -3 }, fillPos: { x: 0, y: 0, z: -3 }, fillInt: 0.4 },
};

// --- Helpers ---
function clamp(x: number, min: number, max: number) {
    return Math.min(Math.max(x, min), max);
}

// Tanner Helland's algorithm for Kelvin to RGB
function kelvinToRgb(kelvin: number) {
    let temp = kelvin / 100;
    let r, g, b;

    if (temp <= 66) {
        r = 255;
        g = temp;
        g = 99.4708025861 * Math.log(g) - 161.1195681661;
        
        if (temp <= 19) {
            b = 0;
        } else {
            b = temp - 10;
            b = 138.5177312231 * Math.log(b) - 305.0447927307;
        }
    } else {
        r = temp - 60;
        r = 329.698727446 * Math.pow(r, -0.1332047592);
        
        g = temp - 60;
        g = 288.1221695283 * Math.pow(g, -0.0755148492);
        
        b = 255;
    }

    return new THREE.Color(
        clamp(r, 0, 255) / 255,
        clamp(g, 0, 255) / 255,
        clamp(b, 0, 255) / 255
    );
}

// --- Initialization ---
function init() {
  const root = document.getElementById('root');
  if (!root) return;

  // 1. Render UI Structure (Modern Floating Layout)
  root.innerHTML = `
    <div id="canvas-container"></div>
    
    <!-- UI Layer -->
    <div id="ui-layer" class="p-4 h-full flex flex-col justify-between pointer-events-none">
      
      <!-- Top Bar -->
      <header class="flex items-center justify-between mb-4 pointer-events-auto">
        <div class="glass-panel px-4 py-2 rounded-full flex items-center space-x-3">
            <div class="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <i data-lucide="aperture" class="w-5 h-5 text-white"></i>
            </div>
            <div>
                <h1 class="font-bold text-sm text-white tracking-wide">Fibo Bridge</h1>
                <p class="text-[10px] text-zinc-400 font-medium">VIRTUAL CINEMATOGRAPHER</p>
            </div>
        </div>

        <div class="glass-panel p-1.5 rounded-full flex items-center space-x-2">
           <button id="btn-export" class="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="Save Scene">
              <i data-lucide="download" class="w-4 h-4"></i>
           </button>
           <button id="btn-import" class="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="Load Scene">
              <i data-lucide="upload" class="w-4 h-4"></i>
           </button>
           <input type="file" id="file-input" class="hidden" accept=".json" />
        </div>
      </header>

      <!-- Main Layout: Sidebar & Content -->
      <div class="flex-1 flex gap-4 overflow-hidden relative">
        
        <!-- Left Sidebar: Controls -->
        <div class="w-80 glass-panel rounded-2xl flex flex-col overflow-hidden pointer-events-auto animate-in slide-in-from-left duration-500">
           <div class="flex-1 overflow-y-auto custom-scroll p-4 space-y-6">
              
              <!-- Subject Section -->
              <div class="space-y-3">
                  <div class="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      <span class="flex items-center"><i data-lucide="layers" class="w-3 h-3 mr-2"></i>Subject</span>
                      <select id="input-model" class="bg-transparent border-none text-indigo-400 text-xs font-bold cursor-pointer focus:ring-0 text-right">
                          <option value="Mannequin">Mannequin</option>
                          <option value="Dragon">Dragon</option>
                          <option value="Car">Car</option>
                          <option value="Helmet">Helmet</option>
                          <option value="BoomBox">BoomBox</option>
                          <option value="Geometric">Geometric</option>
                          <option value="Cube">Cube</option>
                      </select>
                  </div>
                  <textarea id="input-subject" class="input-field w-full rounded-xl p-3 text-xs font-medium resize-none h-20 placeholder-zinc-600" placeholder="Describe your subject..."></textarea>
                  
                  <div class="grid grid-cols-2 gap-2" id="style-container">
                      <!-- Style buttons injected here -->
                  </div>
              </div>

              <div class="h-px bg-white/5"></div>

              <!-- Camera Section -->
              <div class="space-y-3">
                  <div class="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center">
                      <i data-lucide="video" class="w-3 h-3 mr-2"></i> Camera
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                     <div class="space-y-1">
                        <label class="text-[10px] text-zinc-500 font-bold">LENS</label>
                        <select id="input-lens" class="input-field w-full rounded-lg p-2 text-xs font-mono"></select>
                     </div>
                     <div class="space-y-1">
                        <label class="text-[10px] text-zinc-500 font-bold">ANGLE</label>
                        <select id="input-angle" class="input-field w-full rounded-lg p-2 text-xs font-mono"></select>
                     </div>
                     <div class="col-span-2 space-y-1">
                        <label class="text-[10px] text-zinc-500 font-bold">SHOT SIZE</label>
                        <select id="input-shot" class="input-field w-full rounded-lg p-2 text-xs font-mono"></select>
                     </div>
                  </div>
              </div>

              <div class="h-px bg-white/5"></div>

              <!-- Lighting Section -->
              <div class="space-y-4">
                  <div class="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      <span class="flex items-center"><i data-lucide="zap" class="w-3 h-3 mr-2"></i> Lighting</span>
                      <select id="preset-select" class="bg-zinc-800/50 border border-zinc-700 text-[10px] text-zinc-300 rounded px-2 py-0.5">
                         <option value="">Presets</option>
                         <option value="Rembrandt">Rembrandt</option>
                         <option value="Split">Split</option>
                         <option value="Butterfly">Butterfly</option>
                      </select>
                  </div>

                  <!-- Move Tools -->
                  <div class="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5">
                      <button id="btn-move-key" class="flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all flex items-center justify-center space-x-1">
                         <span>KEY LIGHT</span>
                      </button>
                      <button id="btn-move-fill" class="flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all flex items-center justify-center space-x-1">
                         <span>FILL LIGHT</span>
                      </button>
                  </div>

                  <!-- Light Params -->
                  <div class="bg-zinc-900/30 rounded-xl p-3 border border-white/5 space-y-4">
                      <div class="flex items-center justify-between pb-2 border-b border-white/5">
                          <div class="flex space-x-2">
                             <button id="tab-key" class="text-[10px] font-bold text-indigo-400 border-b border-indigo-500 pb-0.5">KEY</button>
                             <button id="tab-fill" class="text-[10px] font-bold text-zinc-500 pb-0.5">FILL</button>
                          </div>
                          <div class="flex items-center space-x-2">
                              <span class="text-[9px] text-zinc-500">ON/OFF</span>
                              <input type="checkbox" id="input-enabled" class="accent-indigo-500">
                          </div>
                      </div>

                      <div class="space-y-3">
                          <div>
                             <div class="flex justify-between text-[10px] font-medium text-zinc-400 mb-1.5">
                                <span>Temperature</span>
                                <span id="label-temp" class="text-white font-mono">5600K</span>
                             </div>
                             <input id="input-temp" type="range" min="2000" max="10000" step="100" class="w-full">
                          </div>
                          <div>
                             <div class="flex justify-between text-[10px] font-medium text-zinc-400 mb-1.5">
                                <span>Intensity</span>
                                <span id="label-intensity" class="text-white font-mono">100%</span>
                             </div>
                             <input id="input-intensity" type="range" min="0" max="3" step="0.1" class="w-full">
                          </div>
                          <div>
                             <span class="text-[10px] font-medium text-zinc-400 block mb-2">Gels</span>
                             <div class="grid grid-cols-8 gap-1" id="gel-container"></div>
                          </div>
                      </div>
                  </div>
              </div>

           </div>
           
           <!-- Generate Area -->
           <div class="p-4 bg-[#0f0f11] border-t border-white/5 space-y-3">
              <div class="relative">
                  <i data-lucide="key" class="absolute left-3 top-2.5 w-3 h-3 text-zinc-600"></i>
                  <input type="password" id="input-fal-key" class="input-field w-full rounded-lg py-2 pl-8 pr-3 text-[10px] font-mono placeholder-zinc-600" placeholder="Enter API Key (Gemini or FAL)">
              </div>
              <div class="flex gap-2">
                  <button id="btn-generate-gemini" class="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-900/20 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center font-bold text-xs tracking-wide">
                      <i data-lucide="zap" class="w-3 h-3 mr-1.5"></i> GEMINI
                  </button>
                  <button id="btn-generate-fal" class="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-900/20 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center font-bold text-xs tracking-wide">
                      <i data-lucide="aperture" class="w-3 h-3 mr-1.5"></i> BRIA 2.3 (FIBO)
                  </button>
              </div>
           </div>
        </div>

        <!-- Center Viewport Controls (Floating) -->
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto flex space-x-2">
            <button id="btn-orbit" class="glass-panel px-4 py-2 rounded-full text-xs font-bold text-white flex items-center space-x-2 hover:bg-white/5 transition-colors">
               <i data-lucide="move" class="w-3 h-3"></i>
               <span>Orbit</span>
            </button>
            <div class="glass-panel px-4 py-2 rounded-full text-[10px] font-mono text-zinc-400 flex items-center">
               <span class="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
               LIVE PREVIEW
            </div>
        </div>

      </div>

      <!-- Right Panel / Gallery -->
      <div class="absolute top-20 right-4 bottom-4 w-16 flex flex-col items-center pointer-events-auto space-y-2">
          <button id="btn-gallery-toggle" class="glass-panel p-2 rounded-full mb-2 hover:bg-white/10 transition-colors">
             <i data-lucide="film" class="w-4 h-4 text-zinc-400"></i>
          </button>
          <div id="gallery-container" class="flex-1 w-full flex flex-col space-y-3 overflow-y-auto custom-scroll pb-2 transition-all duration-300 opacity-100">
             <!-- Thumbs go here -->
          </div>
      </div>
    </div>

    <!-- LIGHTBOX / REVIEW MODAL -->
    <div id="lightbox" class="absolute inset-0 z-50 bg-black/80 backdrop-blur-md hidden flex items-center justify-center p-8 opacity-0 transition-opacity duration-300">
        <div class="bg-[#131316] border border-white/10 rounded-2xl shadow-2xl max-w-6xl w-full h-full flex overflow-hidden scale-95 transition-transform duration-300" id="lightbox-content">
            
            <!-- Image Area -->
            <div class="flex-1 bg-black relative flex items-center justify-center group">
                <img id="lightbox-img" class="max-w-full max-h-full object-contain shadow-2xl" src="">
                
                <button id="btn-close-lightbox" class="absolute top-4 right-4 p-2 bg-black/50 hover:bg-white/20 text-white rounded-full backdrop-blur transition-colors">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>

            <!-- Meta Data Sidebar -->
            <div class="w-96 border-l border-white/10 flex flex-col bg-[#131316]">
                <div class="p-6 border-b border-white/5">
                    <h2 class="text-xl font-bold text-white mb-1">Shot Review</h2>
                    <p class="text-xs text-zinc-500 font-mono" id="lightbox-date">--</p>
                </div>
                
                <div class="flex-1 overflow-y-auto p-6 space-y-6">
                    <div>
                        <h3 class="text-xs font-bold text-indigo-400 uppercase mb-2">Subject</h3>
                        <p class="text-sm text-zinc-300 leading-relaxed" id="lightbox-prompt">--</p>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <h3 class="text-xs font-bold text-zinc-500 uppercase mb-1">Engine</h3>
                            <p class="text-sm text-white font-mono" id="lightbox-engine">--</p>
                        </div>
                        <div>
                            <h3 class="text-xs font-bold text-zinc-500 uppercase mb-1">Lens</h3>
                            <p class="text-sm text-white font-mono" id="lightbox-lens">--</p>
                        </div>
                         <div>
                            <h3 class="text-xs font-bold text-zinc-500 uppercase mb-1">Style</h3>
                            <p class="text-sm text-white font-mono" id="lightbox-style">--</p>
                        </div>
                        <div>
                            <h3 class="text-xs font-bold text-zinc-500 uppercase mb-1">Key Light</h3>
                            <p class="text-sm text-white font-mono" id="lightbox-light">--</p>
                        </div>
                    </div>
                    
                    <div class="p-3 bg-zinc-900 rounded-lg border border-white/5">
                        <code class="text-[10px] text-zinc-500 font-mono break-all" id="lightbox-json-preview">
                            // Setup Data
                        </code>
                    </div>
                </div>

                <div class="p-6 border-t border-white/5 space-y-3">
                    <button id="btn-download-img" class="w-full py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-colors flex items-center justify-center">
                        <i data-lucide="download" class="w-4 h-4 mr-2"></i> Download Image
                    </button>
                    <button id="btn-download-json" class="w-full py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-colors flex items-center justify-center">
                        <i data-lucide="code" class="w-4 h-4 mr-2"></i> Download Scene Data
                    </button>
                </div>
            </div>
        </div>
    </div>
  `;

  // 2. Initialize Icons
  createIcons({ icons: { Video, Aperture, Zap, Palette, Code, Sliders, ImageIcon, Crosshair, ChevronDown, Download, Upload, Sun, Moon, Key, Box, Move, X, Eye, Monitor, Film, Layers } });

  // 3. Cache DOM Elements
  els.btnOrbit = document.getElementById('btn-orbit')!;
  els.btnMoveKey = document.getElementById('btn-move-key')!;
  els.btnMoveFill = document.getElementById('btn-move-fill')!;
  
  els.tabKey = document.getElementById('tab-key')!;
  els.tabFill = document.getElementById('tab-fill')!;
  els.inputEnabled = document.getElementById('input-enabled')! as HTMLInputElement;
  els.presetSelect = document.getElementById('preset-select')! as HTMLSelectElement;
  els.btnExport = document.getElementById('btn-export')!;
  els.btnImport = document.getElementById('btn-import')!;
  els.fileInput = document.getElementById('file-input')! as HTMLInputElement;

  els.inputModel = document.getElementById('input-model')! as HTMLSelectElement;
  els.inputSubject = document.getElementById('input-subject')! as HTMLTextAreaElement;
  els.inputLens = document.getElementById('input-lens')! as HTMLSelectElement;
  els.inputAngle = document.getElementById('input-angle')! as HTMLSelectElement;
  els.inputShot = document.getElementById('input-shot')! as HTMLSelectElement;
  els.inputTemp = document.getElementById('input-temp')! as HTMLInputElement;
  els.inputIntensity = document.getElementById('input-intensity')! as HTMLInputElement;
  els.labelTemp = document.getElementById('label-temp')!;
  els.labelIntensity = document.getElementById('label-intensity')!;
  
  els.btnGenerateFal = document.getElementById('btn-generate-fal')!;
  els.btnGenerateGemini = document.getElementById('btn-generate-gemini')!;
  els.inputFalKey = document.getElementById('input-fal-key')! as HTMLInputElement;

  els.btnGalleryToggle = document.getElementById('btn-gallery-toggle')!;
  els.galleryContainer = document.getElementById('gallery-container')!;
  
  // Lightbox Elements
  els.lightbox = document.getElementById('lightbox')!;
  els.lightboxContent = document.getElementById('lightbox-content')!;
  els.btnCloseLightbox = document.getElementById('btn-close-lightbox')!;
  els.lightboxImg = document.getElementById('lightbox-img')! as HTMLImageElement;
  els.lightboxPrompt = document.getElementById('lightbox-prompt')!;
  els.lightboxDate = document.getElementById('lightbox-date')!;
  els.lightboxEngine = document.getElementById('lightbox-engine')!;
  els.lightboxLens = document.getElementById('lightbox-lens')!;
  els.lightboxStyle = document.getElementById('lightbox-style')!;
  els.lightboxLight = document.getElementById('lightbox-light')!;
  els.lightboxJsonPreview = document.getElementById('lightbox-json-preview')!;
  els.btnDownloadImg = document.getElementById('btn-download-img')!;
  els.btnDownloadJson = document.getElementById('btn-download-json')!;

  // 4. Populate Dynamic UI
  LENS_OPTIONS.forEach(opt => els.inputLens.innerHTML += `<option>${opt}</option>`);
  ANGLE_OPTIONS.forEach(opt => els.inputAngle.innerHTML += `<option>${opt}</option>`);
  SHOT_OPTIONS.forEach(opt => els.inputShot.innerHTML += `<option>${opt}</option>`);
  
  const styleContainer = document.getElementById('style-container')!;
  STYLE_OPTIONS.forEach(style => {
    const btn = document.createElement('button');
    btn.className = `px-3 py-2 rounded-lg text-[10px] font-bold border text-center uppercase tracking-wide transition-all style-btn truncate`;
    btn.textContent = style;
    btn.onclick = () => updateState('visualStyle', style);
    styleContainer.appendChild(btn);
  });

  const gelContainer = document.getElementById('gel-container')!;
  GEL_PRESETS.forEach(gel => {
    const btn = document.createElement('button');
    btn.className = 'aspect-square rounded-full border border-transparent hover:scale-110 transition-transform gel-btn shadow-sm';
    btn.style.backgroundColor = gel.hex;
    btn.title = gel.name;
    btn.onclick = () => {
        if (state.activeLight === 'key') updateKeyLight('gel', gel.hex);
        else updateFillLight('gel', gel.hex);
    };
    gelContainer.appendChild(btn);
  });

  // 5. Initialize 3D Scene
  init3D();

  // 6. Bind Events
  bindEvents();

  // 7. Initial Sync
  syncUI();
}

function bindEvents() {
  // Inputs
  els.inputSubject.addEventListener('input', (e) => updateState('subjectDescription', (e.target as HTMLTextAreaElement).value));
  els.inputModel.addEventListener('change', (e) => updateState('subjectModel', (e.target as HTMLSelectElement).value));
  els.inputLens.addEventListener('change', (e) => updateState('lensType', (e.target as HTMLSelectElement).value));
  els.inputAngle.addEventListener('change', (e) => updateState('cameraAngle', (e.target as HTMLSelectElement).value));
  els.inputShot.addEventListener('change', (e) => updateState('shotSize', (e.target as HTMLSelectElement).value));
  els.inputFalKey.addEventListener('input', (e) => updateState('falApiKey', (e.target as HTMLInputElement).value));

  // Lighting Controls
  els.tabKey.addEventListener('click', () => updateState('activeLight', 'key'));
  els.tabFill.addEventListener('click', () => updateState('activeLight', 'fill'));

  els.inputEnabled.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      if (state.activeLight === 'key') updateKeyLight('enabled', checked);
      else updateFillLight('enabled', checked);
  });

  els.inputTemp.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      if (state.activeLight === 'key') updateKeyLight('colorTemp', val);
      else updateFillLight('colorTemp', val);
  });

  els.inputIntensity.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (state.activeLight === 'key') updateKeyLight('intensity', val);
      else updateFillLight('intensity', val);
  });

  els.presetSelect.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      if (!val) return;
      const preset = (LIGHTING_PRESETS as any)[val];
      if (preset) {
          updateKeyLight('position', preset.keyPos);
          updateFillLight('position', preset.fillPos);
          updateFillLight('intensity', preset.fillInt);
      }
      (e.target as HTMLSelectElement).value = ''; // Reset select
  });

  // Tools
  els.btnMoveKey.addEventListener('click', () => updateState('mode', ControlMode.DRAG_KEY));
  els.btnMoveFill.addEventListener('click', () => updateState('mode', ControlMode.DRAG_FILL));
  els.btnOrbit.addEventListener('click', () => updateState('mode', ControlMode.ORBIT));

  // Generation
  els.btnGenerateFal.addEventListener('click', () => handleGeneration('BRIA'));
  els.btnGenerateGemini.addEventListener('click', () => handleGeneration('GEMINI'));

  // Top Bar Actions
  els.btnGalleryToggle.addEventListener('click', () => {
      state.isGalleryOpen = !state.isGalleryOpen;
      syncUI(true);
  });

  els.btnExport.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = `fibo-scene-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  });

  els.btnImport.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              if (typeof ev.target?.result === 'string') {
                  const loaded = JSON.parse(ev.target.result);
                  state = { ...state, ...loaded };
                  updateSubjectModel();
                  update3DFromState();
                  syncUI();
              }
          } catch (err) {
              console.error(err);
              alert("Invalid JSON file");
          }
      };
      reader.readAsText(file);
      (e.target as HTMLInputElement).value = '';
  });

  // Lightbox
  els.btnCloseLightbox.addEventListener('click', closeLightbox);
  els.btnDownloadImg.addEventListener('click', downloadImage);
  els.btnDownloadJson.addEventListener('click', downloadJson);
}

// --- 3D Logic ---
function init3D() {
  const container = document.getElementById('canvas-container')!;
  
  // Renderer
  // preserveDrawingBuffer required to capture canvas for generation reference
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();
  // Using a gradient-ish fog for softer look
  scene.fog = new THREE.FogExp2('#1a1a20', 0.02);

  // Camera - Rotated 180 degrees (Z = -8 instead of 8)
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 2, -8); 

  // Controls
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.target.set(0, 1.2, 0);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.05;
  orbitControls.maxPolarAngle = Math.PI / 1.8;

  transformControl = new TransformControls(camera, renderer.domElement);
  transformControl.addEventListener('dragging-changed', (event) => {
    orbitControls.enabled = !event.value;
  });
  
  transformControl.addEventListener('change', () => {
    if (state.mode === ControlMode.DRAG_KEY && keyLightMesh && keyLight) {
       keyLight.position.copy(keyLightMesh.position);
       state.keyLight.position = { x: keyLightMesh.position.x, y: keyLightMesh.position.y, z: keyLightMesh.position.z };
    } else if (state.mode === ControlMode.DRAG_FILL && fillLightMesh && fillLight) {
       fillLight.position.copy(fillLightMesh.position);
       state.fillLight.position = { x: fillLightMesh.position.x, y: fillLightMesh.position.y, z: fillLightMesh.position.z };
    }
    syncUI(true); 
  });
  
  scene.add(transformControl);

  // --- STUDIO ENVIRONMENT ---
  // Soft cyclorama
  const cycGeo = new THREE.CylinderGeometry(12, 12, 8, 64, 1, true, 0, Math.PI);
  const cycMat = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a20, 
      side: THREE.BackSide, 
      roughness: 0.8 
  });
  const cyc = new THREE.Mesh(cycGeo, cycMat);
  cyc.position.set(0, 4, 0);
  cyc.rotation.y = -Math.PI / 2;
  scene.add(cyc);
  
  // Floor
  const floorGeo = new THREE.PlaneGeometry(30, 30);
  const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0x151518, 
      roughness: 0.5, 
      metalness: 0.1 
  });
  floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // --- LIGHTS ---

  // Key Light
  keyLight = new THREE.SpotLight(0xffffff, 1);
  keyLight.angle = 0.5;
  keyLight.penumbra = 0.5; // Softer edges
  keyLight.decay = 2;
  keyLight.distance = 20;
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0001;
  scene.add(keyLight);

  keyLightMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 }));
  scene.add(keyLightMesh);

  // Fill Light
  fillLight = new THREE.SpotLight(0xffffff, 0.5);
  fillLight.angle = 0.8;
  fillLight.penumbra = 1; // Very soft fill
  fillLight.decay = 2;
  fillLight.distance = 20;
  fillLight.castShadow = false;
  scene.add(fillLight);

  fillLightMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffaa00, wireframe: true, transparent: true, opacity: 0.5 }));
  scene.add(fillLightMesh);

  // --- SUBJECT ---
  subjectGroup = new THREE.Group();
  scene.add(subjectGroup);
  updateSubjectModel();

  // Subtle Grid
  grid = new THREE.GridHelper(20, 20, 0x333333, 0x111111);
  grid.position.y = 0.01; // Avoid Z-fighting
  grid.material.transparent = true;
  grid.material.opacity = 0.2;
  scene.add(grid);

  // Ambient Light for base visibility
  const ambient = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambient);

  update3DFromState();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
}

function updateSubjectModel() {
    while(subjectGroup.children.length > 0){ 
        subjectGroup.remove(subjectGroup.children[0]); 
    }

    const material = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.3, metalness: 0.2 });

    const loadGLB = (url: string, scaleFactor: number = 1.0, rotationY: number = 0, forceScale: boolean = false, yOffset: number = 0) => {
        gltfLoader.load(
            url,
            (gltf) => {
                 // Clear again just in case async race condition
                 while(subjectGroup.children.length > 0) subjectGroup.remove(subjectGroup.children[0]);

                 const model = gltf.scene;
                 
                 // Enable shadows
                 model.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                 });
                 
                 if (!forceScale) {
                    // Normalize Scale & Position
                    const box = new THREE.Box3().setFromObject(model);
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    
                    // Target height approx 3 units
                    const scale = 3.0 / maxDim;
                    model.scale.setScalar(scale * scaleFactor);
                 } else {
                    model.scale.setScalar(scaleFactor);
                 }
                 
                 // Apply Rotation
                 model.rotation.y = rotationY;

                 // Re-center geometry
                 const newBox = new THREE.Box3().setFromObject(model);
                 const center = newBox.getCenter(new THREE.Vector3());
                 
                 model.position.x = -center.x; // Center on origin
                 model.position.z = -center.z;
                 model.position.y = -newBox.min.y + yOffset; // Sit exactly on floor + offset

                 subjectGroup.add(model);
            },
            undefined,
            (err) => {
                console.error("Failed to load model", err);
                // Fallback to basic geo if fail
                const cube = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), material);
                cube.position.y = 0.5;
                subjectGroup.add(cube);
                
                // Add text label for error
                console.warn(`Could not load ${url}. Falling back to cube.`);
            }
        )
    };

    if (state.subjectModel === 'Mannequin') {
        // Force scale 1.0 (approx 1.7-1.8m real world size for this asset) to match camera targeting
        loadGLB('https://raw.githubusercontent.com/gdquest-demos/godot-3d-mannequin/master/godot-csharp/assets/3d/mannequiny/mannequiny-0.3.0.glb', 1.0, Math.PI, true);
    } else if (state.subjectModel === 'Cube') {
         const cube = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), material);
         cube.position.y = 0.75;
         cube.castShadow = true; 
         cube.receiveShadow = true;
         subjectGroup.add(cube);
    } else if (state.subjectModel === 'Dragon') {
         // Updated to correct Khronos Sample GLB, raised 0.05 to avoid floor glitching
         loadGLB('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/DragonAttenuation/glTF-Binary/DragonAttenuation.glb', 1.0, Math.PI, false, 0.05);
    } else if (state.subjectModel === 'Helmet') {
        // Rotated 180
        loadGLB('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb', 1.0, Math.PI);
    } else if (state.subjectModel === 'Car') {
        // Rotated 90 (PI/2)
        loadGLB('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ToyCar/glTF-Binary/ToyCar.glb', 1.0, Math.PI / 2);
    } else if (state.subjectModel === 'BoomBox') {
         // Add a simple podium/stand
         const stand = new THREE.Mesh(
             new THREE.CylinderGeometry(0.3, 0.4, 1.0, 32),
             new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.5 })
         );
         stand.position.y = 0.5;
         stand.castShadow = true; 
         stand.receiveShadow = true;
         subjectGroup.add(stand);

         // Rotated 180
         loadGLB('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BoomBox/glTF-Binary/BoomBox.glb', 1.0, Math.PI);

    } else if (state.subjectModel === 'Geometric') {
        const cube = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), material);
        cube.position.set(-0.4, 0.25, 0.2);
        cube.rotation.y = Math.PI / 4;
        cube.castShadow = true; cube.receiveShadow = true;
        subjectGroup.add(cube);
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 32), material);
        sphere.position.set(0.4, 0.3, -0.2);
        sphere.castShadow = true; sphere.receiveShadow = true;
        subjectGroup.add(sphere);
        const tall = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 32), material);
        tall.position.set(0, 0.75, 0);
        tall.castShadow = true; tall.receiveShadow = true;
        subjectGroup.add(tall);
    }
}

function animate() {
  requestAnimationFrame(animate);
  orbitControls.update();
  
  // Dynamic Light Targeting based on shot size to ensure face is lit in closeups
  let lightTargetY = 1.0;
  if (state.shotSize === 'Close Up') lightTargetY = 1.6;
  else if (state.shotSize === 'Medium Shot') lightTargetY = 1.3;

  if (keyLight) {
      keyLight.target.position.set(0, lightTargetY, 0); 
      keyLight.target.updateMatrixWorld();
  }
  if (fillLight) {
      fillLight.target.position.set(0, lightTargetY, 0);
      fillLight.target.updateMatrixWorld();
  }

  renderer.render(scene, camera);
}

// --- Logic ---

function updateState(key: string, value: any) {
  state = { ...state, [key]: value };
  if (key === 'subjectModel') updateSubjectModel();
  syncUI();
  update3DFromState();
}

function updateKeyLight(key: keyof LightSettings, value: any) {
  state.keyLight = { ...state.keyLight, [key]: value };
  syncUI();
  update3DFromState();
}

function updateFillLight(key: keyof LightSettings, value: any) {
  state.fillLight = { ...state.fillLight, [key]: value };
  syncUI();
  update3DFromState();
}

function update3DFromState() {
  if (!keyLight) return;

  // Helper to blend Kelvin and Gel
  const getLightColor = (temp: number, gelHex: string) => {
     const tempColor = kelvinToRgb(temp);
     const gelColor = new THREE.Color(gelHex);
     
     // Blend strategy: Multiply the kelvin tint with the gel. 
     // If gel is white (neutral), result is pure kelvin.
     // If gel is red, kelvin provides warmth/coolness underlying the red.
     return new THREE.Color().setRGB(
        tempColor.r * gelColor.r,
        tempColor.g * gelColor.g,
        tempColor.b * gelColor.b
     );
  }

  // Key Light
  const k = state.keyLight;
  const finalKeyColor = getLightColor(k.colorTemp, k.gel);

  keyLightMesh.position.set(k.position.x, k.position.y, k.position.z);
  keyLight.position.copy(keyLightMesh.position);
  keyLight.intensity = k.enabled ? k.intensity * 80 : 0;
  keyLight.color.copy(finalKeyColor);
  (keyLightMesh.material as THREE.MeshBasicMaterial).color.copy(finalKeyColor);
  keyLightMesh.visible = k.enabled;

  // Camera Target Logic based on Shot Size (Fixes 85mm cutting off head)
  let targetY = 1.0; // Default (waist/chest for Wide/Full)
  if (state.shotSize === 'Close Up') targetY = 1.65; // Face height
  else if (state.shotSize === 'Medium Shot') targetY = 1.3; // Chest/Shoulders
  else targetY = 0.9; // Center of mass for full body

  const target = new THREE.Vector3(0, targetY, 0); 
  
  // Camera Position Logic
  let dist = 4.0;
  if (state.shotSize === 'Close Up') dist = 2.0;
  else if (state.shotSize === 'Medium Shot') dist = 3.5;
  else if (state.shotSize === 'Full Shot') dist = 5.5;
  else if (state.shotSize === 'Wide Shot') dist = 8.0;

  const azimuth = orbitControls.getAzimuthalAngle();
  let phi = Math.PI / 2 - 0.1;

  if (state.cameraAngle === 'High Angle') phi = Math.PI / 3.5;
  else if (state.cameraAngle === 'Low Angle') phi = Math.PI / 1.7;
  else if (state.cameraAngle === 'Eye Level') phi = Math.PI / 2;

  const x = target.x + dist * Math.sin(phi) * Math.sin(azimuth);
  const y = target.y + dist * Math.cos(phi);
  const z = target.z + dist * Math.sin(phi) * Math.cos(azimuth);

  camera.position.set(x, y, z);
  orbitControls.target.copy(target);
  
  let fov = 45;
  if (state.lensType === '24mm') fov = 74;
  if (state.lensType === '35mm') fov = 54;
  if (state.lensType === '50mm') fov = 40;
  if (state.lensType === '85mm') fov = 24;
  camera.fov = fov;
  camera.updateProjectionMatrix();

  // Styles (Softened for new UI)
  if (state.visualStyle === 'Film Noir') {
      renderer.toneMappingExposure = 0.8;
      scene.background = new THREE.Color('#000000');
      scene.fog = new THREE.FogExp2('#000000', 0.05);
  } else if (state.visualStyle === 'Cyberpunk') {
      renderer.toneMappingExposure = 1.2;
      scene.background = new THREE.Color('#0b0214');
      scene.fog = new THREE.FogExp2('#0b0214', 0.03);
  } else if (state.visualStyle === 'Ethereal') {
      renderer.toneMappingExposure = 1.3;
      scene.background = new THREE.Color('#d1d5db');
      scene.fog = new THREE.FogExp2('#d1d5db', 0.04);
  } else {
      renderer.toneMappingExposure = 1.0;
      scene.background = new THREE.Color('#1a1a20');
      scene.fog = new THREE.FogExp2('#1a1a20', 0.02);
  }
}

function syncUI(skip3D = false) {
  // Inputs
  (els.inputSubject as HTMLTextAreaElement).value = state.subjectDescription;
  (els.inputModel as HTMLSelectElement).value = state.subjectModel;
  (els.inputLens as HTMLSelectElement).value = state.lensType;
  (els.inputAngle as HTMLSelectElement).value = state.cameraAngle;
  (els.inputShot as HTMLSelectElement).value = state.shotSize;
  (els.inputFalKey as HTMLInputElement).value = state.falApiKey;

  // Active Light UI
  const activeL = state.activeLight === 'key' ? state.keyLight : state.fillLight;
  (els.inputTemp as HTMLInputElement).value = activeL.colorTemp.toString();
  (els.inputIntensity as HTMLInputElement).value = activeL.intensity.toString();
  (els.inputEnabled as HTMLInputElement).checked = activeL.enabled;
  
  els.labelTemp.textContent = `${activeL.colorTemp}K`;
  els.labelIntensity.textContent = `${Math.round(activeL.intensity * 100)}%`;

  // Tabs style update
  if (state.activeLight === 'key') {
      els.tabKey.className = "text-[10px] font-bold text-indigo-400 border-b-2 border-indigo-500 pb-0.5 transition-colors";
      els.tabFill.className = "text-[10px] font-bold text-zinc-500 pb-0.5 hover:text-zinc-300 transition-colors";
  } else {
      els.tabKey.className = "text-[10px] font-bold text-zinc-500 pb-0.5 hover:text-zinc-300 transition-colors";
      els.tabFill.className = "text-[10px] font-bold text-indigo-400 border-b-2 border-indigo-500 pb-0.5 transition-colors";
  }

  // Move Buttons State
  const activeBtnClass = "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30";
  const inactiveBtnClass = "text-zinc-400 hover:text-white hover:bg-white/5";

  els.btnMoveKey.className = `flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center space-x-1 ${state.mode === ControlMode.DRAG_KEY ? activeBtnClass : inactiveBtnClass}`;
  els.btnMoveFill.className = `flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center space-x-1 ${state.mode === ControlMode.DRAG_FILL ? activeBtnClass : inactiveBtnClass}`;

  // Style Buttons
  document.querySelectorAll('.style-btn').forEach((btn: any) => {
    const isSelected = btn.textContent === state.visualStyle;
    btn.className = `px-3 py-2 rounded-lg text-[10px] font-bold border text-center uppercase tracking-wide transition-all style-btn truncate ${isSelected ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200' : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-600'}`;
  });

  // Gel Buttons
  document.querySelectorAll('.gel-btn').forEach((btn: any) => {
    const currentGel = state.activeLight === 'key' ? state.keyLight.gel : state.fillLight.gel;
    const isSelected = btn.style.backgroundColor === hexToRgb(currentGel);
    if (isSelected) {
        btn.classList.add('ring-2', 'ring-white', 'scale-110');
        btn.classList.remove('border-transparent');
    } else {
        btn.classList.remove('ring-2', 'ring-white', 'scale-110');
        btn.classList.add('border-transparent');
    }
  });

  // Transform Controls Logic
  if (transformControl) {
    if (state.mode === ControlMode.DRAG_KEY) {
        transformControl.enabled = true;
        transformControl.visible = true;
        transformControl.attach(keyLightMesh);
    } else if (state.mode === ControlMode.DRAG_FILL) {
        transformControl.enabled = true;
        transformControl.visible = true;
        transformControl.attach(fillLightMesh);
    } else {
        transformControl.enabled = false;
        transformControl.visible = false;
        transformControl.detach();
    }
  }

  // Gallery toggle state
  if (state.isGalleryOpen) {
      els.galleryContainer.classList.remove('hidden');
      els.galleryContainer.style.opacity = '1';
      els.btnGalleryToggle.querySelector('svg')?.classList.add('text-indigo-400');
  } else {
      els.galleryContainer.style.opacity = '0';
      setTimeout(() => els.galleryContainer.classList.add('hidden'), 300); // Wait for fade out
      els.btnGalleryToggle.querySelector('svg')?.classList.remove('text-indigo-400');
  }

  if (!skip3D) update3DFromState();
}

async function handleGeneration(engine: string) {
    if (state.isGenerating) return;
    
    // Check key based on engine
    if (!state.falApiKey) {
        alert("Please enter an API Key.");
        return;
    }

    const btn = engine === 'BRIA' ? els.btnGenerateFal : els.btnGenerateGemini;
    const originalText = btn.innerHTML;
    state.isGenerating = true;
    btn.innerHTML = `<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>`;

    try {
        let imageUrl = "";
        
        // 1. Hide Helpers for "Clean Plate" capture
        // We only want to send the subject and lighting to the AI, not the UI gizmos.
        const wasGridVisible = grid.visible;
        const wasKeyMeshVisible = keyLightMesh.visible;
        const wasFillMeshVisible = fillLightMesh.visible;
        
        // We detach transform control to hide it cleanly
        const wasTransformEnabled = transformControl.enabled;
        
        grid.visible = false;
        keyLightMesh.visible = false;
        fillLightMesh.visible = false;
        transformControl.enabled = false;
        if (transformControl.object) transformControl.visible = false;

        // Force a render to update the buffer
        renderer.render(scene, camera);
        
        // Capture the "Clean Plate"
        const canvas = renderer.domElement;
        const referenceImage = canvas.toDataURL('image/jpeg', 0.9);

        // 2. Restore Helpers
        grid.visible = wasGridVisible;
        keyLightMesh.visible = state.keyLight.enabled;
        fillLightMesh.visible = state.fillLight.enabled;
        transformControl.enabled = wasTransformEnabled;
        if (transformControl.object) transformControl.visible = true;

        if (engine === 'BRIA') {
            imageUrl = await generateImageFromScene(state, state.falApiKey);
        } else {
            // Send the clean plate to Gemini as a composition reference
            // Pass the API key entered in the UI
            imageUrl = await generateImageWithGemini(state, referenceImage, state.falApiKey);
        }
        
        const shot: GeneratedShot = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            imageUrl,
            params: JSON.parse(JSON.stringify(state)) // Deep copy
        };
        
        state.gallery.unshift(shot);
        renderGallery();
        openLightbox(shot);

    } catch (e: any) {
        console.error(e);
        alert(`Error: ${e.message}`);
    } finally {
        state.isGenerating = false;
        btn.innerHTML = originalText;
    }
}

function renderGallery() {
    els.galleryContainer.innerHTML = '';
    state.gallery.forEach(shot => {
        const btn = document.createElement('button');
        btn.className = "w-12 h-12 rounded-lg border border-white/10 overflow-hidden bg-black hover:ring-2 hover:ring-indigo-500 transition-all flex-shrink-0";
        btn.innerHTML = `<img src="${shot.imageUrl}" class="w-full h-full object-cover">`;
        btn.onclick = () => openLightbox(shot);
        els.galleryContainer.appendChild(btn);
    });
}

function openLightbox(shot: GeneratedShot) {
    state.viewingShotId = shot.id;
    (els.lightboxImg as HTMLImageElement).src = shot.imageUrl;
    els.lightboxPrompt.textContent = shot.params.subjectDescription;
    els.lightboxDate.textContent = new Date(shot.timestamp).toLocaleString();
    els.lightboxEngine.textContent = (shot.params as any).falApiKey ? 'BRIA' : 'GEMINI'; // Approximation
    els.lightboxLens.textContent = shot.params.lensType;
    els.lightboxStyle.textContent = shot.params.visualStyle;
    els.lightboxLight.textContent = `${shot.params.keyLight.colorTemp}K`;
    
    els.lightboxJsonPreview.textContent = JSON.stringify({
        camera: shot.params.cameraAngle,
        shot: shot.params.shotSize,
        lights: {
            key: shot.params.keyLight,
            fill: shot.params.fillLight
        }
    }, null, 2);

    els.lightbox.classList.remove('hidden');
    // Simple fade in
    requestAnimationFrame(() => {
        els.lightbox.classList.remove('opacity-0');
        els.lightboxContent.classList.remove('scale-95');
    });
}

function closeLightbox() {
    state.viewingShotId = null;
    els.lightbox.classList.add('opacity-0');
    els.lightboxContent.classList.add('scale-95');
    setTimeout(() => {
        els.lightbox.classList.add('hidden');
    }, 300);
}

function downloadImage() {
    if (!state.viewingShotId) return;
    const shot = state.gallery.find(s => s.id === state.viewingShotId);
    if (!shot) return;
    
    const a = document.createElement('a');
    a.href = shot.imageUrl;
    a.download = `fibo-shot-${shot.id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function downloadJson() {
    if (!state.viewingShotId) return;
    const shot = state.gallery.find(s => s.id === state.viewingShotId);
    if (!shot) return;
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(shot.params, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `fibo-scene-${shot.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function hexToRgb(hex: string) { return hex; }

init();