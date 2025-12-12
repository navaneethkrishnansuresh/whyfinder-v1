/**
 * AI Service for BrainDriveWhyDetector
 * 
 * STORAGE ARCHITECTURE:
 * - Primary: localStorage (always available in browser)
 * - Fallback: pluginState if available
 * - Profiles stored as JSON under localStorage keys
 * - Why Profiles: 'braindrive_why_profiles'
 * - Ikigai Profiles: 'braindrive_ikigai_profiles'
 * - Temp State: 'braindrive_temp_state'
 */

import { 
  Services, 
  ModelInfo, 
  SessionPhase, 
  SessionData,
  IkigaiPhase,
  IkigaiProfile,
  IkigaiProfileSummary,
  IkigaiProfileCreate,
  WhyProfile,
  WhyProfileSummary,
  CandidateStrength,
  PhaseStorageData,
  Phase1StoredData,
  Phase2StoredData,
  Phase3StoredData,
  Phase4StoredData,
  ComputedOverlaps,
  ChatMessage,
  PhaseAnswerCounts,
  generateId
} from '../types';

import { 
  getCoachSystemPrompt, 
  getIkigaiBuilderPrompt, 
  getDecisionHelperPrompt,
  getOverlapComputationPrompt,
  getStrengthExtractionPrompt,
  getPhaseSummarizationPrompt,
  getWhyExtractionPrompt
} from '../prompts';

const PROVIDER_SETTINGS_ID_MAP: Record<string, string> = {
  'ollama': 'ollama_servers_settings',
  'anthropic': 'anthropic_api_settings',
  'openai': 'openai_api_settings',
  'openrouter': 'openrouter_api_settings'
};

// Storage keys for localStorage (fallback)
const STORAGE_PREFIX = 'braindrive_whydetector_';
const TEMP_STATE_KEY = `${STORAGE_PREFIX}temp_state`;
const WHY_PROFILES_KEY = `${STORAGE_PREFIX}why_profiles`;
const IKIGAI_PROFILES_KEY = `${STORAGE_PREFIX}ikigai_profiles`;

// API endpoints for file-based storage
const WHY_PROFILES_API = '/api/v1/ikigai/why-profiles';
const IKIGAI_PROFILES_API = '/api/v1/ikigai/ikigai-profiles';

export class AIService {
  private services: Services;
  private currentUserId: string | null = null;

  constructor(services: Services) {
    this.services = services;
    this.initializeUserId();
  }

  private async initializeUserId(): Promise<void> {
    try {
      if (this.services?.api) {
        const response = await this.services.api.get('/api/v1/auth/me');
        if (response?.id) {
          this.currentUserId = response.id;
        }
      }
    } catch (error) {
      console.error('AIService: Error getting user ID:', error);
    }
  }

  // ===========================================================================
  // LOCAL STORAGE HELPERS (Primary Storage)
  // ===========================================================================

  private saveToLocalStorage(key: string, data: any): void {
    try {
      const jsonStr = JSON.stringify(data);
      localStorage.setItem(key, jsonStr);
      console.log(`Storage: Saved ${key} (${jsonStr.length} bytes)`);
    } catch (error) {
      console.error(`Storage: Error saving ${key}:`, error);
      throw new Error(`Failed to save data: ${error instanceof Error ? error.message : 'Storage error'}`);
    }
  }

  private loadFromLocalStorage(key: string): any {
    try {
      const jsonStr = localStorage.getItem(key);
      if (!jsonStr) {
        console.log(`Storage: No data found for ${key}`);
        return null;
      }
      const data = JSON.parse(jsonStr);
      console.log(`Storage: Loaded ${key}`);
      return data;
    } catch (error) {
      console.error(`Storage: Error loading ${key}:`, error);
      return null;
    }
  }

  private removeFromLocalStorage(key: string): void {
    try {
      localStorage.removeItem(key);
      console.log(`Storage: Removed ${key}`);
    } catch (error) {
      console.error(`Storage: Error removing ${key}:`, error);
    }
  }

  // ===========================================================================
  // MODEL FETCHING
  // ===========================================================================

  async fetchModels(): Promise<ModelInfo[]> {
    if (!this.services?.api) return [];

    try {
      const resp = await this.services.api.get('/api/v1/ai/providers/all-models');
      const raw = resp?.models || resp?.data?.models || (Array.isArray(resp) ? resp : []);

      return Array.isArray(raw)
        ? raw.map((m: any) => {
            const provider = m.provider || 'ollama';
            return {
              name: m.name || m.id || '',
              provider,
              providerId: PROVIDER_SETTINGS_ID_MAP[provider] || provider,
              serverName: m.server_name || m.serverName || 'Unknown Server',
              serverId: m.server_id || m.serverId || 'unknown',
            };
          })
        : [];
    } catch (error) {
      console.error('AIService: Error fetching models:', error);
      return this.fetchOllamaModelsFallback();
    }
  }

  private async fetchOllamaModelsFallback(): Promise<ModelInfo[]> {
    try {
      const settingsResp = await this.services.api.get('/api/v1/settings/instances', {
        params: { definition_id: 'ollama_servers_settings', scope: 'user', user_id: 'current' }
      });

      let settingsData: any = null;
      if (Array.isArray(settingsResp) && settingsResp.length > 0) {
        settingsData = settingsResp[0];
      } else if (settingsResp?.data) {
        settingsData = Array.isArray(settingsResp.data) ? settingsResp.data[0] : settingsResp.data;
      }

      if (!settingsData?.value) return [];

      const parsedValue = typeof settingsData.value === 'string'
        ? JSON.parse(settingsData.value)
        : settingsData.value;

      const servers = Array.isArray(parsedValue?.servers) ? parsedValue.servers : [];
      const models: ModelInfo[] = [];

      for (const server of servers) {
        try {
          const params: Record<string, string> = {
            server_url: encodeURIComponent(server.serverAddress),
            settings_id: 'ollama_servers_settings',
            server_id: server.id,
          };
          if (server.apiKey) params.api_key = server.apiKey;

          const modelResponse = await this.services.api.get('/api/v1/ollama/models', { params });
          for (const m of (Array.isArray(modelResponse) ? modelResponse : [])) {
            models.push({
              name: m.name,
              provider: 'ollama',
              providerId: 'ollama_servers_settings',
              serverName: server.serverName,
              serverId: server.id,
            });
          }
        } catch (err) {
          console.error('AIService: Error loading models for server', server?.serverName, err);
        }
      }

      return models;
    } catch (error) {
      console.error('AIService: Fallback model fetch failed:', error);
      return [];
    }
  }

  // ===========================================================================
  // TEMP STATE MANAGEMENT
  // ===========================================================================

  /**
   * Save temp session state - contains FULL detailed data including:
   * - Complete conversation history for each phase
   * - All extracted insights, quotes, bullets
   * - Timestamps, exchange counts, model info
   * 
   * This is NOT sent to the model - only short summaries are sent.
   * When user saves as profile, this full data is persisted.
   */
  async saveTempState(state: any): Promise<void> {
    try {
      const tempState = {
        ...state,
        lastUpdated: new Date().toISOString()
      };
      this.saveToLocalStorage(TEMP_STATE_KEY, tempState);
      console.log('AIService: Temp state saved successfully');
    } catch (error) {
      console.error('AIService: Error saving temp state:', error);
    }
  }

  async loadTempState(): Promise<any | null> {
    try {
      return this.loadFromLocalStorage(TEMP_STATE_KEY);
    } catch (error) {
      console.error('AIService: Error loading temp state:', error);
      return null;
    }
  }

  async clearTempState(): Promise<void> {
    try {
      this.removeFromLocalStorage(TEMP_STATE_KEY);
      console.log('AIService: Temp state cleared');
    } catch (error) {
      console.error('AIService: Error clearing temp state:', error);
    }
  }

  // ===========================================================================
  // WHY FINDER
  // ===========================================================================

  async sendToCoach(
    userMessage: string,
    phase: SessionPhase,
    sessionData: SessionData,
    conversationHistory: { role: string; content: string }[],
    exchangeCount: number,
    model: ModelInfo,
    onChunk: (chunk: string) => void,
    abortController?: AbortController,
    sessionId?: string
  ): Promise<void> {
    if (!this.services?.api) throw new Error('API service not available');

    const systemPrompt = getCoachSystemPrompt(phase, sessionData, conversationHistory, exchangeCount);

    // Use unique session ID to prevent any backend caching
    const uniqueConversationType = sessionId ? `whydetector_${sessionId}` : `whydetector_${Date.now()}`;

    await this.sendToAI(
      systemPrompt,
      conversationHistory,
      userMessage,
      model,
      onChunk,
      abortController,
      uniqueConversationType
    );
  }

  async extractWhyData(
    conversation: ChatMessage[],
    model: ModelInfo
  ): Promise<{ whatYouLove: string[]; whatYouAreGoodAt: string[]; whyExplanation: string } | null> {
    if (!this.services?.api) {
      console.warn('AIService: API service not available for extraction');
      return null;
    }

    if (!conversation || conversation.length === 0) {
      console.warn('AIService: No conversation to extract from');
      return null;
    }

    const conversationForExtraction = conversation.map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    const prompt = getWhyExtractionPrompt(conversationForExtraction);
    let fullResponse = '';

    try {
      console.log('AIService: Extracting Why data from', conversation.length, 'messages');
      
      await this.sendToAI(
        prompt, [], 'Extract the data as JSON.', model,
        (chunk) => { fullResponse += chunk; },
        undefined, 'why_extraction'
      );

      console.log('AIService: Raw extraction response length:', fullResponse.length);

      // FIX: Use robust JSON extraction
      const parsed = this.extractValidJson(fullResponse);
      if (parsed) {
        console.log('AIService: Successfully parsed extraction data');
        return {
          whatYouLove: Array.isArray(parsed.whatYouLove) ? parsed.whatYouLove : [],
          whatYouAreGoodAt: Array.isArray(parsed.whatYouAreGoodAt) ? parsed.whatYouAreGoodAt : [],
          whyExplanation: typeof parsed.whyExplanation === 'string' ? parsed.whyExplanation : ''
        };
      }
      
      console.warn('AIService: Could not parse JSON from extraction response');
      return null;
    } catch (error) {
      console.error('AIService: Error extracting Why data:', error);
      return null;
    }
  }

  // ===========================================================================
  // IKIGAI BUILDER (4 Phases)
  // ===========================================================================

  /**
   * Send message to Ikigai Builder.
   * 
   * CONTEXT ISOLATION:
   * - Only current phase messages are sent to the model
   * - Previous phases are summarized in a SHORT context block (not full conversations)
   * - This prevents pattern bleeding between phases
   * - Full conversations are stored in temp state for profile saving
   */
  async sendToIkigaiBuilder(
    userMessage: string,
    phase: IkigaiPhase,
    phaseStorage: PhaseStorageData,
    answerCounts: PhaseAnswerCounts,
    currentPhaseMessages: { role: string; content: string }[],
    model: ModelInfo,
    onChunk: (chunk: string) => void,
    abortController?: AbortController,
    whyProfile?: WhyProfile | null
  ): Promise<void> {
    if (!this.services?.api) throw new Error('API service not available');

    // Build prompt with SHORT summary context (not full conversations)
    const systemPrompt = getIkigaiBuilderPrompt(phase, phaseStorage, answerCounts, whyProfile);

    // Only send current phase messages - NOT full history
    await this.sendToAI(
      systemPrompt,
      currentPhaseMessages,
      userMessage,
      model,
      onChunk,
      abortController,
      'ikigai_builder'
    );
  }

  /**
   * Summarize a completed phase.
   * Extracts structured data from conversation for storage and context.
   */
  async summarizePhase(
    phaseName: string,
    conversation: ChatMessage[],
    model: ModelInfo
  ): Promise<any> {
    if (!this.services?.api) throw new Error('API service not available');

    const conversationForSummary = conversation.map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    const prompt = getPhaseSummarizationPrompt(phaseName, conversationForSummary);
    let fullResponse = '';

    try {
      await this.sendToAI(
        prompt, [], 'Extract the structured data as JSON.', model,
        (chunk) => { fullResponse += chunk; },
        undefined, 'phase_summarize'
      );

      // FIX: Use more robust JSON extraction
      const parsed = this.extractValidJson(fullResponse);
      if (parsed) return parsed;
      
      console.warn('AIService: Could not parse JSON from response, using fallback');
      return this.createFallbackSummary(phaseName, conversation);
    } catch (error) {
      console.error('AIService: Error summarizing phase:', error);
      return this.createFallbackSummary(phaseName, conversation);
    }
  }

  /**
   * Robust JSON extraction from LLM responses.
   * Tries multiple strategies:
   * 1. Find JSON in code blocks
   * 2. Find the last complete JSON object
   * 3. Try to parse the whole response
   */
  private extractValidJson(response: string): any | null {
    if (!response) return null;
    
    // Strategy 1: Look for JSON in code blocks
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch (e) {
        // Continue to next strategy
      }
    }
    
    // Strategy 2: Find all potential JSON objects and try each
    const jsonMatches = response.match(/\{[\s\S]*?\}(?=\s*(?:\n|$|[^{]))/g);
    if (jsonMatches) {
      // Try from last to first (last is often the valid one)
      for (let i = jsonMatches.length - 1; i >= 0; i--) {
        try {
          return JSON.parse(jsonMatches[i]);
        } catch (e) {
          // Try next
        }
      }
    }
    
    // Strategy 3: Find balanced braces for complete JSON
    const startIdx = response.indexOf('{');
    if (startIdx >= 0) {
      let braceCount = 0;
      let endIdx = -1;
      
      for (let i = startIdx; i < response.length; i++) {
        if (response[i] === '{') braceCount++;
        else if (response[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIdx = i + 1;
            break;
          }
        }
      }
      
      if (endIdx > startIdx) {
        try {
          return JSON.parse(response.substring(startIdx, endIdx));
        } catch (e) {
          // Failed
        }
      }
    }
    
    return null;
  }

  private createFallbackSummary(phaseName: string, conversation: ChatMessage[]): any {
    const userMessages = conversation
      .filter(m => m.sender === 'user')
      .map(m => m.content.substring(0, 150));

    if (phaseName === 'phase1_love') {
      return { love: { bullets: userMessages, quotes: [], summary: '' }, key_insights: [] };
    } else if (phaseName === 'phase2_good_at') {
      return { good_at: { bullets: userMessages, quotes: [], summary: '' }, key_insights: [] };
    } else if (phaseName === 'phase3_world') {
      return { world_needs: { bullets: userMessages, quotes: [], who_to_help: [], summary: '' }, key_insights: [] };
    } else if (phaseName === 'phase4_paid') {
      return { paid_for: { current: userMessages.slice(0, 2), potential: userMessages.slice(2), constraints: [], quotes: [], summary: '' }, key_insights: [] };
    }
    return { bullets: userMessages };
  }

  async computeOverlaps(
    whyStatement: string,
    love: string[],
    goodAt: string[],
    worldNeeds: string[],
    paidFor: string[],
    model: ModelInfo
  ): Promise<ComputedOverlaps | null> {
    if (!this.services?.api) throw new Error('API service not available');

    const prompt = getOverlapComputationPrompt(whyStatement, love, goodAt, worldNeeds, paidFor);
    let fullResponse = '';

    try {
      await this.sendToAI(
        prompt, [], 'Compute the overlaps and return ONLY valid JSON.', model,
        (chunk) => { fullResponse += chunk; },
        undefined, 'ikigai_overlaps'
      );

      // FIX: Use robust JSON extraction
      const parsed = this.extractValidJson(fullResponse);
      if (parsed) {
        return {
          passion: parsed.passion || { bullets: [], summary: '' },
          mission: parsed.mission || { bullets: [], summary: '' },
          profession: parsed.profession || { bullets: [], summary: '' },
          vocation: parsed.vocation || { bullets: [], summary: '' },
          computedAt: new Date().toISOString()
        };
      }
      console.warn('AIService: Could not parse overlaps JSON');
      return null;
    } catch (error) {
      console.error('AIService: Error computing overlaps:', error);
      return null;
    }
  }

  // ===========================================================================
  // DECISION HELPER
  // ===========================================================================

  async sendToDecisionHelper(
    userMessage: string,
    profile: IkigaiProfile,
    conversationHistory: { role: string; content: string }[],
    model: ModelInfo,
    onChunk: (chunk: string) => void,
    abortController?: AbortController
  ): Promise<void> {
    if (!this.services?.api) throw new Error('API service not available');

    const systemPrompt = getDecisionHelperPrompt(profile, conversationHistory);

    await this.sendToAI(
      systemPrompt,
      conversationHistory,
      userMessage,
      model,
      onChunk,
      abortController,
      'decision_helper'
    );
  }

  async extractStrengths(userMessage: string, phase: string, model: ModelInfo): Promise<CandidateStrength[]> {
    if (!this.services?.api) return [];

    const prompt = getStrengthExtractionPrompt(userMessage, phase);
    let fullResponse = '';

    try {
      await this.sendToAI(
        prompt, [], userMessage, model,
        (chunk) => { fullResponse += chunk; },
        undefined, 'strength_extraction'
      );

      const jsonMatch = fullResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const strengths = JSON.parse(jsonMatch[0]);
        return strengths.map((s: any) => ({
          text: s.text || '',
          sourceQuote: s.sourceQuote || s.source_quote || '',
          phase: s.phase || phase
        }));
      }
      return [];
    } catch (error) {
      console.error('AIService: Error extracting strengths:', error);
      return [];
    }
  }

  // ===========================================================================
  // CORE AI COMMUNICATION
  // ===========================================================================

  private async sendToAI(
    systemPrompt: string,
    conversationHistory: { role: string; content: string }[],
    userMessage: string,
    model: ModelInfo,
    onChunk: (chunk: string) => void,
    abortController?: AbortController,
    conversationType: string = 'whydetector'
  ): Promise<void> {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    const requestParams = {
      provider: model.provider || 'ollama',
      settings_id: model.providerId || 'ollama_servers_settings',
      server_id: model.serverId,
      model: model.name,
      messages,
      params: { temperature: 0.7, max_tokens: 2048 },
      stream: true,
      user_id: this.currentUserId || 'current',
      conversation_type: conversationType
    };

    try {
      if (typeof this.services.api.postStreaming === 'function') {
        await this.services.api.postStreaming(
          '/api/v1/ai/providers/chat',
          requestParams,
          (chunk: string) => {
            if (abortController?.signal.aborted) return;
            
            let jsonString = chunk;
            if (chunk.startsWith('data: ')) jsonString = chunk.substring(6);
            if (!jsonString.trim() || jsonString.trim() === '[DONE]') return;

            try {
              const data = JSON.parse(jsonString);
              const text = this.extractTextFromResponse(data);
              if (text) onChunk(text);
            } catch (e) {
              if (jsonString.trim()) onChunk(jsonString);
            }
          },
          { timeout: 120000, signal: abortController?.signal }
        );
      } else {
        const response = await this.services.api.post(
          '/api/v1/ai/providers/chat',
          { ...requestParams, stream: false },
          { timeout: 60000 }
        );
        const text = this.extractTextFromResponse(response?.data || response);
        if (text) onChunk(text);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      console.error('AIService: AI request failed:', error);
      throw error;
    }
  }

  private extractTextFromResponse(data: any): string {
    if (!data) return '';
    if (typeof data === 'string') return data;
    if (data.text) return data.text;
    if (data.content) return data.content;
    if (data.response) return data.response;
    if (data.message?.content) return data.message.content;
    if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
    if (data.choices?.[0]?.delta?.content) return data.choices[0].delta.content;
    return '';
  }

  buildFullContext(messages: Array<{ sender: string; content: string }>): { role: string; content: string }[] {
    return messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
  }

  buildPhaseContext(messages: ChatMessage[], currentPhase: IkigaiPhase): { role: string; content: string }[] {
    return messages
      .filter(m => m.phase === currentPhase)
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
  }

  /**
   * Build SHORT summary for model context.
   * This is what gets passed to the model for phase context.
   * NOT the full conversation - just bullet points.
   */
  buildShortSummaryForModel(phaseStorage: PhaseStorageData, whyProfile?: WhyProfile | null): string {
    let summary = '';
    
    // Why statement
    const whyStatement = whyProfile?.whyStatement || '';
    if (whyStatement) {
      summary += `WHY: "${whyStatement}"\n`;
    }
    
    // Phase 1 summary (not full conversation)
    if (phaseStorage.phase1) {
      summary += `\nPHASE 1 (What I Love): ${phaseStorage.phase1.love.bullets.slice(0, 4).join(', ')}\n`;
    } else if (whyProfile?.whatYouLove?.length) {
      summary += `\nFROM WHY PROFILE (Love): ${whyProfile.whatYouLove.slice(0, 4).join(', ')}\n`;
    }
    
    // Phase 2 summary
    if (phaseStorage.phase2) {
      summary += `PHASE 2 (What I'm Good At): ${phaseStorage.phase2.goodAt.bullets.slice(0, 4).join(', ')}\n`;
    } else if (whyProfile?.whatYouAreGoodAt?.length) {
      summary += `FROM WHY PROFILE (Good At): ${whyProfile.whatYouAreGoodAt.slice(0, 4).join(', ')}\n`;
    }
    
    // Phase 3 summary
    if (phaseStorage.phase3) {
      summary += `PHASE 3 (World Needs): ${phaseStorage.phase3.worldNeeds.bullets.slice(0, 4).join(', ')}\n`;
    }
    
    return summary;
  }

  // ===========================================================================
  // WHY PROFILE STORAGE (API -> JSON files in why_profiles/)
  // ===========================================================================

  /**
   * Load all Why profiles from backend (JSON files).
   * Falls back to localStorage if API fails.
   */
  async loadWhyProfiles(): Promise<WhyProfile[]> {
    console.log('AIService: Loading Why profiles from API...');
    
    try {
      // Try API first (saves to JSON files)
      if (this.services?.api) {
        const response = await this.services.api.get(`${WHY_PROFILES_API}/files`);
        if (response?.success && Array.isArray(response.profiles)) {
          console.log('AIService: Loaded', response.profiles.length, 'Why profiles from files');
          return response.profiles;
        }
      }
    } catch (apiError) {
      console.warn('AIService: API load failed, trying localStorage:', apiError);
    }
    
    // Fallback to localStorage
    try {
      const profiles = this.loadFromLocalStorage(WHY_PROFILES_KEY) || [];
      console.log('AIService: Loaded', profiles.length, 'Why profiles from localStorage');
      return Array.isArray(profiles) ? profiles : [];
    } catch (error) {
      console.error('AIService: Error loading Why profiles:', error);
      return [];
    }
  }

  /**
   * Save Why Profile to backend (JSON file in why_profiles/).
   * Falls back to localStorage if API fails.
   */
  async saveWhyProfile(profile: WhyProfile): Promise<WhyProfile> {
    console.log('AIService: Saving Why profile:', profile.name);

    try {
      // Try API first (saves to JSON file)
      if (this.services?.api) {
        const response = await this.services.api.post(`${WHY_PROFILES_API}/file`, profile);
        if (response?.success) {
          console.log(`AIService: Why profile "${profile.name}" saved to file: ${response.filename}`);
          return profile;
        }
      }
    } catch (apiError) {
      console.warn('AIService: API save failed, trying localStorage:', apiError);
    }
    
    // Fallback to localStorage
    try {
      const profiles: WhyProfile[] = this.loadFromLocalStorage(WHY_PROFILES_KEY) || [];
      const existingIndex = profiles.findIndex((p: WhyProfile) => p.id === profile.id);
      
      if (existingIndex >= 0) {
        profiles[existingIndex] = { ...profile, updatedAt: new Date().toISOString() };
      } else {
        profiles.push(profile);
      }
      
      this.saveToLocalStorage(WHY_PROFILES_KEY, profiles);
      console.log(`AIService: Why profile "${profile.name}" saved to localStorage`);
      return profile;
    } catch (error) {
      console.error('AIService: Error saving Why profile:', error);
      throw new Error(`Failed to save profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getWhyProfile(profileId: string): Promise<WhyProfile | null> {
    const profiles = await this.loadWhyProfiles();
    return profiles.find(p => p.id === profileId) || null;
  }

  async deleteWhyProfile(profileId: string): Promise<void> {
    console.log('AIService: Deleting Why profile:', profileId);
    try {
      const profiles: WhyProfile[] = this.loadFromLocalStorage(WHY_PROFILES_KEY) || [];
      const filtered = profiles.filter(p => p.id !== profileId);
      this.saveToLocalStorage(WHY_PROFILES_KEY, filtered);
      console.log('AIService: Why profile deleted');
    } catch (error) {
      console.error('AIService: Error deleting Why profile:', error);
      throw error;
    }
  }

  getWhyProfileSummaries(profiles: WhyProfile[]): WhyProfileSummary[] {
    return profiles.map(p => ({
      id: p.id,
      name: p.name,
      whyStatement: p.whyStatement,
      createdAt: p.createdAt,
      loveCount: p.whatYouLove?.length || 0,
      goodAtCount: p.whatYouAreGoodAt?.length || 0
    }));
  }

  // ===========================================================================
  // IKIGAI PROFILE STORAGE (API -> JSON files in ikigai_profiles/)
  // ===========================================================================

  /**
   * Load all Ikigai profiles from backend (JSON files).
   * Falls back to localStorage if API fails.
   */
  async loadIkigaiProfiles(): Promise<IkigaiProfile[]> {
    console.log('AIService: Loading Ikigai profiles from API...');
    
    try {
      // Try API first (loads from JSON files)
      if (this.services?.api) {
        const response = await this.services.api.get(`${IKIGAI_PROFILES_API}/files`);
        if (response?.success && Array.isArray(response.profiles)) {
          console.log('AIService: Loaded', response.profiles.length, 'Ikigai profiles from files');
          return response.profiles;
        }
      }
    } catch (apiError) {
      console.warn('AIService: API load failed, trying localStorage:', apiError);
    }
    
    // Fallback to localStorage
    try {
      const profiles = this.loadFromLocalStorage(IKIGAI_PROFILES_KEY) || [];
      console.log('AIService: Loaded', profiles.length, 'Ikigai profiles from localStorage');
      return Array.isArray(profiles) ? profiles : [];
    } catch (error) {
      console.error('AIService: Error loading Ikigai profiles:', error);
      return [];
    }
  }

  /**
   * Save Ikigai Profile to backend (JSON file in ikigai_profiles/).
   * Falls back to localStorage if API fails.
   */
  async saveIkigaiProfile(profile: IkigaiProfile): Promise<IkigaiProfile> {
    console.log('AIService: Saving Ikigai profile:', profile.name);

    try {
      // Try API first (saves to JSON file)
      if (this.services?.api) {
        const response = await this.services.api.post(`${IKIGAI_PROFILES_API}/file`, profile);
        if (response?.success) {
          console.log(`AIService: Ikigai profile "${profile.name}" saved to file: ${response.filename}`);
          return profile;
        }
      }
    } catch (apiError) {
      console.warn('AIService: API save failed, trying localStorage:', apiError);
    }
    
    // Fallback to localStorage
    try {
      const profiles: IkigaiProfile[] = this.loadFromLocalStorage(IKIGAI_PROFILES_KEY) || [];
      const existingIndex = profiles.findIndex((p: IkigaiProfile) => p.id === profile.id);
      
      if (existingIndex >= 0) {
        profiles[existingIndex] = { ...profile, updatedAt: new Date().toISOString() };
      } else {
        profiles.push(profile);
      }
      
      this.saveToLocalStorage(IKIGAI_PROFILES_KEY, profiles);
      
      console.log(`AIService: Ikigai profile "${profile.name}" saved to localStorage`);
      return profile;
    } catch (error) {
      console.error('AIService: Error saving Ikigai profile:', error);
      throw new Error(`Failed to save Ikigai profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getIkigaiProfile(profileId: string): Promise<IkigaiProfile | null> {
    const profiles = await this.loadIkigaiProfiles();
    return profiles.find(p => p.id === profileId) || null;
  }

  async deleteIkigaiProfile(profileId: string): Promise<void> {
    console.log('AIService: Deleting Ikigai profile:', profileId);
    try {
      const profiles: IkigaiProfile[] = this.loadFromLocalStorage(IKIGAI_PROFILES_KEY) || [];
      const filtered = profiles.filter(p => p.id !== profileId);
      this.saveToLocalStorage(IKIGAI_PROFILES_KEY, filtered);
      console.log('AIService: Ikigai profile deleted');
    } catch (error) {
      console.error('AIService: Error deleting Ikigai profile:', error);
      throw error;
    }
  }

  getIkigaiProfileSummaries(profiles: IkigaiProfile[]): IkigaiProfileSummary[] {
    return profiles.map(p => ({
      id: p.id,
      name: p.name,
      whyStatement: p.whyStatement,
      isComplete: p.isComplete,
      createdAt: p.createdAt
    }));
  }

  async fetchIkigaiProfiles(): Promise<IkigaiProfileSummary[]> {
    const profiles = await this.loadIkigaiProfiles();
    return this.getIkigaiProfileSummaries(profiles);
  }

  async fetchIkigaiProfile(profileId: string): Promise<IkigaiProfile | null> {
    return this.getIkigaiProfile(profileId);
  }

  /**
   * Create and save Ikigai Profile.
   * Saves LEAN profile - only essential data, no conversation archive.
   */
  async createIkigaiProfile(data: IkigaiProfileCreate): Promise<IkigaiProfile | null> {
    const profile: IkigaiProfile = {
      id: generateId('ikigai'),
      name: data.name,
      createdAt: new Date().toISOString(),
      sourceWhyProfileId: data.sourceWhyProfileId,
      whyStatement: data.whyStatement || '',
      love: data.love,
      goodAt: data.goodAt,
      worldNeeds: data.worldNeeds,
      paidFor: data.paidFor,
      overlaps: data.overlaps,
      keyPatterns: data.keyPatterns || [],
      autoFilledPhases: data.autoFilledPhases || { phase1_love: false, phase2_good_at: false },
      isComplete: true
    };

    return this.saveIkigaiProfile(profile);
  }
}
