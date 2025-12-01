/**
 * BrainDriveWhyDetector Type Definitions
 * Simplified types matching BrainDriveChat patterns
 */

// Service types from BrainDrive
export interface Services {
  api: ApiService;
  theme: ThemeService;
  settings?: SettingsService;
  pluginState?: PluginStateService;
}

export interface ApiService {
  get: (url: string, options?: any) => Promise<any>;
  post: (url: string, data: any, options?: any) => Promise<any>;
  postStreaming?: (url: string, data: any, onChunk: (chunk: string) => void, options?: any) => Promise<void>;
}

export interface ThemeService {
  getCurrentTheme: () => string;
  addThemeChangeListener: (listener: (theme: string) => void) => void;
  removeThemeChangeListener: (listener: (theme: string) => void) => void;
}

export interface SettingsService {
  getSetting: (key: string) => Promise<any>;
  setSetting: (key: string, value: any) => Promise<void>;
}

export interface PluginStateService {
  save: (data: any) => Promise<void>;
  load: () => Promise<any>;
}

// Props passed to the component by BrainDrive
export interface BrainDriveWhyDetectorProps {
  services: Services;
  moduleId?: string;
  instanceId?: string;
  config?: Record<string, any>;
}

// Component state
export interface BrainDriveWhyDetectorState {
  // UI state
  currentTheme: string;
  isInitializing: boolean;
  isLoading: boolean;
  isStreaming: boolean;
  error: string;
  
  // Model state
  models: ModelInfo[];
  selectedModel: ModelInfo | null;
  isLoadingModels: boolean;
  
  // Chat state
  messages: ChatMessage[];
  inputText: string;
  
  // Session state
  sessionStarted: boolean;
  currentPhase: SessionPhase;
  sessionData: SessionData;
}

// AI Model info (from providers)
export interface ModelInfo {
  name: string;
  provider: string;
  providerId: string;
  serverName: string;
  serverId: string;
}

// Chat message structure
export interface ChatMessage {
  id: string;
  sender: 'user' | 'coach';
  content: string;
  timestamp: string;
  phase?: SessionPhase;
  isStreaming?: boolean;
}

// Session phases - streamlined (5 phases)
export type SessionPhase = 
  | 'intro'
  | 'energy_map'
  | 'stories'
  | 'your_why'  // Combined patterns + statement
  | 'completed';

export const PHASE_ORDER: SessionPhase[] = [
  'intro',
  'energy_map',
  'stories',
  'your_why',
  'completed'
];

export const PHASE_LABELS: Record<SessionPhase, string> = {
  intro: 'Getting Started',
  energy_map: 'Energy',
  stories: 'Stories',
  your_why: 'Your Why',
  completed: 'Complete'
};

// Session data - simplified
export interface SessionData {
  energizers: string[];
  drainers: string[];
  stories: string[];
  whyStatement: string;
}

// Utility functions
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
