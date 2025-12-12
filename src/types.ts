/**
 * BrainDriveWhyDetector Type Definitions
 * With Why Profiles, Ikigai Profiles (4 phases), and proper counter tracking
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
  put?: (url: string, data: any, options?: any) => Promise<any>;
  delete?: (url: string, options?: any) => Promise<any>;
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

// ==============================================================================
// Session Modes
// ==============================================================================

export type SessionMode = 'why_finder' | 'ikigai_builder' | 'decision_helper';

// ==============================================================================
// Why Finder Types
// ==============================================================================

// Component state
export interface BrainDriveWhyDetectorState {
  // UI State
  currentTheme: string;
  isInitializing: boolean;
  isLoading: boolean;
  isStreaming: boolean;
  error: string;
  
  // Model State
  models: ModelInfo[];
  selectedModel: ModelInfo | null;
  isLoadingModels: boolean;
  
  // Chat State
  messages: ChatMessage[];
  inputText: string;
  
  // Session State
  sessionStarted: boolean;
  currentPhase: SessionPhase;
  sessionData: SessionData;
  
  // Why Finder Counter - STRICT 12 exchanges
  whyFinderExchangeCount: number;
  
  // Mode State
  sessionMode: SessionMode;
  
  // Why Profiles (saved permanently)
  whyProfiles: WhyProfile[];
  selectedWhyProfileId: string | null;
  
  // Ikigai State - NOW 4 PHASES
  ikigaiProfiles: IkigaiProfile[];
  selectedIkigaiProfileId: string | null;
  currentIkigaiPhase: IkigaiPhase;
  
  // Phase answer counters for Ikigai - 4 COUNTERS
  phaseAnswerCounts: PhaseAnswerCounts;
  
  // Per-Phase Session Storage (for current session)
  phaseStorage: PhaseStorageData;
  
  // UI Flags
  showBuildIkigaiPrompt: boolean;
  showSaveWhyPrompt: boolean;
  isIkigaiComplete: boolean;
  
  // Auto-fill status
  autoFilledPhases: AutoFilledPhases;
  
  // Profile naming
  profileName: string;
  whyProfileName: string;
  
  // Session Tracking
  whyFinderSessionId: string | null;
}

// Track which phases were auto-filled
export interface AutoFilledPhases {
  phase1_love: boolean;
  phase2_good_at: boolean;
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
  phase?: SessionPhase | IkigaiPhase;
  isStreaming?: boolean;
  mode?: SessionMode;
}

// ==============================================================================
// Why Finder Phases
// ==============================================================================

export type SessionPhase = 
  | 'intro'
  | 'energy_map'
  | 'stories'
  | 'your_why'
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

// Why Finder STRICTLY fixed at 12 exchanges
export const WHY_FINDER_TOTAL_EXCHANGES = 12;

// Session data for Why Finder
export interface SessionData {
  energizers: string[];
  drainers: string[];
  stories: string[];
  summary: string;                // Summary of what I learned
  patterns: string;               // The patterns I see
  whyStatement: string;           // To X so that Y
  whyExplanation: string;         // Why this fits you
  candidateStrengths: CandidateStrength[];
  whatYouLove: string[];
  whatYouAreGoodAt: string[];
}

// ==============================================================================
// Why Profile (Saved Permanently) - LEAN VERSION
// Only stores essential verdict data, no conversation archive
// ==============================================================================

export interface WhyProfile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  
  // Full verdict sections
  summary: string;                // Summary of what I learned
  patterns: string;               // The patterns I see
  whyStatement: string;           // "To X so that Y"
  whyExplanation: string;         // Why this fits you
  
  // For Ikigai Builder auto-fill
  whatYouLove: string[];
  whatYouAreGoodAt: string[];
  
  // Metadata
  modelUsed: string;
  exchangeCount: number;
}

export interface WhyProfileSummary {
  id: string;
  name: string;
  whyStatement: string;
  createdAt: string;
  loveCount: number;
  goodAtCount: number;
}

// ==============================================================================
// Ikigai Phases - NOW 4 SEPARATE PHASES
// ==============================================================================

export type IkigaiPhase = 
  | 'phase1_love'      // What I Love
  | 'phase2_good_at'   // What I'm Good At
  | 'phase3_world'     // What the World Needs
  | 'phase4_paid'      // What I Can Be Paid For
  | 'complete';        // All done, ready to save

export const IKIGAI_PHASE_ORDER: IkigaiPhase[] = [
  'phase1_love',
  'phase2_good_at',
  'phase3_world',
  'phase4_paid',
  'complete'
];

export const IKIGAI_PHASE_LABELS: Record<IkigaiPhase, string> = {
  phase1_love: 'What I Love',
  phase2_good_at: 'What I\'m Good At',
  phase3_world: 'What World Needs',
  phase4_paid: 'What I Can Be Paid For',
  complete: 'Complete'
};

// Minimum answers needed per phase
export const MIN_ANSWERS_PER_PHASE = 3;

// Track answers per phase - NOW 4 COUNTERS
export interface PhaseAnswerCounts {
  love: number;       // Phase 1
  goodAt: number;     // Phase 2
  worldNeeds: number; // Phase 3
  paidFor: number;    // Phase 4
}

export const INITIAL_PHASE_COUNTS: PhaseAnswerCounts = {
  love: 0,
  goodAt: 0,
  worldNeeds: 0,
  paidFor: 0
};

export const INITIAL_AUTO_FILLED: AutoFilledPhases = {
  phase1_love: false,
  phase2_good_at: false
};

// ==============================================================================
// Per-Phase Session Storage
// ==============================================================================

export interface PhaseStorageData {
  whyProfileId?: string;
  whyFinder: WhyFinderStoredData | null;
  
  // Now 4 separate phase storage
  phase1: Phase1StoredData | null;  // Love
  phase2: Phase2StoredData | null;  // Good At
  phase3: Phase3StoredData | null;  // World Needs
  phase4: Phase4StoredData | null;  // Paid For
  
  overlaps: ComputedOverlaps | null;
}

export interface WhyFinderStoredData {
  fullConversation: ChatMessage[];
  whyStatement: string;
  whyExplanation: string;
  energizers: string[];
  drainers: string[];
  stories: string[];
  candidateStrengths: CandidateStrength[];
  whatYouLove: string[];
  whatYouAreGoodAt: string[];
  contextSummary: string;
  completedAt: string;
  exchangeCount: number;
  modelUsed: string;
}

export interface Phase1StoredData {
  fullConversation: ChatMessage[];
  love: ExtractedCircle;
  keyInsights: string[];
  contextSummary: string;
  completedAt: string;
  exchangeCount: number;
  autoFilled: boolean;
}

export interface Phase2StoredData {
  fullConversation: ChatMessage[];
  goodAt: ExtractedCircle;
  keyInsights: string[];
  contextSummary: string;
  completedAt: string;
  exchangeCount: number;
  autoFilled: boolean;
}

export interface Phase3StoredData {
  fullConversation: ChatMessage[];
  worldNeeds: ExtractedCircle & {
    whoToHelp: string[];
  };
  keyInsights: string[];
  contextSummary: string;
  completedAt: string;
  exchangeCount: number;
}

export interface Phase4StoredData {
  fullConversation: ChatMessage[];
  paidFor: ExtractedCircle & {
    currentPaths: string[];
    potentialPaths: string[];
    constraints: string[];
  };
  keyInsights: string[];
  contextSummary: string;
  completedAt: string;
  exchangeCount: number;
}

export interface ExtractedCircle {
  bullets: string[];
  quotes: string[];
  summary: string;
}

export interface ComputedOverlaps {
  passion: IkigaiBucket;
  mission: IkigaiBucket;
  profession: IkigaiBucket;
  vocation: IkigaiBucket;
  computedAt: string;
}

// ==============================================================================
// Candidate Strength
// ==============================================================================

export interface CandidateStrength {
  text: string;
  sourceQuote: string;
  phase: 'story' | 'energy' | 'other';
}

// ==============================================================================
// Ikigai Bucket
// ==============================================================================

export interface IkigaiBucket {
  bullets: string[];
  summary: string;
}

// ==============================================================================
// Ikigai Profile (Saved Permanently) - LEAN VERSION
// Only stores essential summaries, no conversation archive
// ==============================================================================

export interface IkigaiProfile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  
  sourceWhyProfileId?: string;
  whyStatement: string;
  
  // 4 Ikigai circles - each with bullets (3-5 items) and summary (2 sentences)
  love: IkigaiBucket;
  goodAt: IkigaiBucket;
  worldNeeds: IkigaiBucket;
  paidFor: IkigaiBucket;
  
  // 4 Ikigai overlaps - each with 2 sentence summary
  overlaps: IkigaiOverlaps;
  
  // Patterns and insights (for Decision Helper context)
  keyPatterns: string[];          // 3-5 cross-cutting patterns
  
  // Metadata (minimal)
  autoFilledPhases: AutoFilledPhases;
  isComplete: boolean;
}

export interface IkigaiOverlaps {
  mission: IkigaiBucket;
  profession: IkigaiBucket;
  vocation: IkigaiBucket;
  passion: IkigaiBucket;
}

export interface IkigaiProfileSummary {
  id: string;
  name: string;
  whyStatement: string;
  isComplete: boolean;
  createdAt: string;
}

export interface IkigaiProfileCreate {
  name: string;
  sourceWhyProfileId?: string;
  whyStatement?: string;
  love: IkigaiBucket;
  goodAt: IkigaiBucket;
  worldNeeds: IkigaiBucket;
  paidFor: IkigaiBucket;
  overlaps: IkigaiOverlaps;
  keyPatterns?: string[];
  autoFilledPhases?: AutoFilledPhases;
}

// ==============================================================================
// Utility Functions
// ==============================================================================

export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function createEmptyPhaseStorage(): PhaseStorageData {
  return {
    whyFinder: null,
    phase1: null,
    phase2: null,
    phase3: null,
    phase4: null,
    overlaps: null
  };
}

export const INITIAL_SESSION_DATA: SessionData = {
  energizers: [],
  drainers: [],
  stories: [],
  summary: '',
  patterns: '',
  whyStatement: '',
  whyExplanation: '',
  candidateStrengths: [],
  whatYouLove: [],
  whatYouAreGoodAt: []
};

// Check if Why profile has enough data for a specific phase
export function hasEnoughForPhase(profile: WhyProfile, phase: 'love' | 'goodAt'): boolean {
  if (phase === 'love') {
    return profile.whatYouLove.length >= MIN_ANSWERS_PER_PHASE;
  }
  return profile.whatYouAreGoodAt.length >= MIN_ANSWERS_PER_PHASE;
}

// Get phase index for dot tracker (0-based)
export function getIkigaiPhaseIndex(phase: IkigaiPhase): number {
  return IKIGAI_PHASE_ORDER.indexOf(phase);
}

// Check if all phases are complete
export function isIkigaiReadyToSave(storage: PhaseStorageData): boolean {
  return !!(
    storage.whyProfileId &&
    storage.phase1 &&
    storage.phase2 &&
    storage.phase3 &&
    storage.phase4 &&
    storage.overlaps
  );
}

// Check if phase has enough answers
export function hasEnoughAnswers(counts: PhaseAnswerCounts, phase: IkigaiPhase): boolean {
  switch (phase) {
    case 'phase1_love':
      return counts.love >= MIN_ANSWERS_PER_PHASE;
    case 'phase2_good_at':
      return counts.goodAt >= MIN_ANSWERS_PER_PHASE;
    case 'phase3_world':
      return counts.worldNeeds >= MIN_ANSWERS_PER_PHASE;
    case 'phase4_paid':
      return counts.paidFor >= MIN_ANSWERS_PER_PHASE;
    default:
      return true;
  }
}

// Get next phase
export function getNextPhase(current: IkigaiPhase): IkigaiPhase {
  const index = IKIGAI_PHASE_ORDER.indexOf(current);
  if (index >= 0 && index < IKIGAI_PHASE_ORDER.length - 1) {
    return IKIGAI_PHASE_ORDER[index + 1];
  }
  return 'complete';
}
