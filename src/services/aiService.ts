/**
 * AI Service for BrainDriveWhyDetector
 * Handles communication with model providers via BrainDrive API bridge
 */

import { 
  Services, 
  ModelInfo, 
  SessionPhase, 
  SessionData
} from '../types';
import { getCoachSystemPrompt } from '../prompts';

// Provider settings ID map (matches BrainDriveChat)
const PROVIDER_SETTINGS_ID_MAP: Record<string, string> = {
  'ollama': 'ollama_servers_settings',
  'anthropic': 'anthropic_api_settings',
  'openai': 'openai_api_settings',
  'openrouter': 'openrouter_api_settings'
};

export class AIService {
  private services: Services;
  private currentUserId: string | null = null;

  constructor(services: Services) {
    this.services = services;
    this.initializeUserId();
  }

  /**
   * Initialize current user ID
   */
  private async initializeUserId(): Promise<void> {
    try {
      if (this.services?.api) {
        const response = await this.services.api.get('/api/v1/auth/me');
        if (response?.id) {
          this.currentUserId = response.id;
        }
      }
    } catch (error) {
      console.error('WhyDetector AIService: Error getting user ID:', error);
    }
  }

  /**
   * Fetch available AI models from all providers
   */
  async fetchModels(): Promise<ModelInfo[]> {
    if (!this.services?.api) {
      console.error('WhyDetector AIService: API service not available');
      return [];
    }

    try {
      const resp = await this.services.api.get('/api/v1/ai/providers/all-models');
      const raw = resp?.models || resp?.data?.models || (Array.isArray(resp) ? resp : []);

      const models: ModelInfo[] = Array.isArray(raw)
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

      console.log(`WhyDetector AIService: Loaded ${models.length} models`);
      return models;
    } catch (error) {
      console.error('WhyDetector AIService: Error fetching models:', error);
      
      // Try fallback to Ollama
      return this.fetchOllamaModelsFallback();
    }
  }

  /**
   * Fallback to fetch Ollama models directly
   */
  private async fetchOllamaModelsFallback(): Promise<ModelInfo[]> {
    try {
      const settingsResp = await this.services.api.get('/api/v1/settings/instances', {
        params: {
          definition_id: 'ollama_servers_settings',
          scope: 'user',
          user_id: 'current',
        },
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
          const serverModels = Array.isArray(modelResponse) ? modelResponse : [];

          for (const m of serverModels) {
            models.push({
              name: m.name,
              provider: 'ollama',
              providerId: 'ollama_servers_settings',
              serverName: server.serverName,
              serverId: server.id,
            });
          }
        } catch (err) {
          console.error('WhyDetector AIService: Error loading models for server', server?.serverName, err);
        }
      }

      return models;
    } catch (error) {
      console.error('WhyDetector AIService: Fallback model fetch failed:', error);
      return [];
    }
  }

  /**
   * Send message to Coach agent and get streaming response
   * No compression - sends full conversation for maximum context
   */
  async sendToCoach(
    userMessage: string,
    phase: SessionPhase,
    sessionData: SessionData,
    conversationHistory: { role: string; content: string }[],
    model: ModelInfo,
    onChunk: (chunk: string) => void,
    abortController?: AbortController
  ): Promise<void> {
    if (!this.services?.api) {
      throw new Error('API service not available');
    }

    // Build system prompt for coach - full conversation is in history
    const systemPrompt = getCoachSystemPrompt(phase, sessionData, conversationHistory);

    // Count exchanges (user messages in history + current one)
    const exchangeCount = conversationHistory.filter(m => m.role === 'user').length + 1;
    const FORCE_WHY_AT = 12;
    const isTimeForWhy = exchangeCount >= FORCE_WHY_AT;

    // Instruction reminder prepended to user message
    let instructionReminder: string;
    
    if (isTimeForWhy) {
      // FORCE WHY - override everything
      instructionReminder = `[CRITICAL INSTRUCTION - THIS IS EXCHANGE #${exchangeCount}]

YOU MUST NOW DELIVER THE WHY STATEMENT WITH DETAILED BREAKDOWN.
DO NOT ASK ANY MORE QUESTIONS. THIS IS THE END.

Analyze the entire conversation and create their Why statement with analysis.

YOUR RESPONSE FORMAT (follow exactly):

**What I Learned About You:**
[2-3 sentences summarizing key insights from conversation]

**The Patterns I See:**
- [Pattern 1: what energizes them]
- [Pattern 2: what they value]
- [Pattern 3: what impact they want]

**YOUR WHY IS:**
To [their contribution/action] so that [the impact/outcome they create for others]

**Why This Fits You:**
[2-3 sentences explaining how this Why connects to specific things they shared]

Thank you for sharing so openly. This Why came from your real experiences and insights.

IMPORTANT: DO NOT ask any questions. No "?" anywhere. This is the final message.

USER'S FINAL MESSAGE:
`;
    } else {
      // Normal flow - ask questions
      instructionReminder = `[INSTRUCTION - Exchange #${exchangeCount} of ${FORCE_WHY_AT}]
Ask ONE new question. Do NOT repeat previous questions. Keep it short.

USER MESSAGE:
`;
    }

    // Build messages array - history already has correct roles ('user' or 'assistant')
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: instructionReminder + userMessage }
    ];

    const requestParams = {
      provider: model.provider || 'ollama',
      settings_id: model.providerId || 'ollama_servers_settings',
      server_id: model.serverId,
      model: model.name,
      messages,
      params: {
        temperature: 0.7,
        max_tokens: 2048  // Allow longer responses
      },
      stream: true,
      user_id: this.currentUserId || 'current',
      conversation_type: 'whydetector'
    };

    try {
      if (typeof this.services.api.postStreaming === 'function') {
        await this.services.api.postStreaming(
          '/api/v1/ai/providers/chat',
          requestParams,
          (chunk: string) => {
            if (abortController?.signal.aborted) return;
            
            // Handle SSE format
            let jsonString = chunk;
            if (chunk.startsWith('data: ')) {
              jsonString = chunk.substring(6);
            }
            
            if (!jsonString.trim() || jsonString.trim() === '[DONE]') return;

            try {
              const data = JSON.parse(jsonString);
              const text = this.extractTextFromResponse(data);
              if (text) {
                onChunk(text);
              }
            } catch (e) {
              // If not JSON, might be plain text
              if (jsonString.trim()) {
                onChunk(jsonString);
              }
            }
          },
          {
            timeout: 120000,
            signal: abortController?.signal
          }
        );
      } else {
        // Fallback to non-streaming
        const response = await this.services.api.post(
          '/api/v1/ai/providers/chat',
          { ...requestParams, stream: false },
          { timeout: 60000 }
        );
        
        const text = this.extractTextFromResponse(response?.data || response);
        if (text) {
          onChunk(text);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error; // Re-throw abort errors
      }
      console.error('WhyDetector AIService: Coach request failed:', error);
      throw error;
    }
  }

  /**
   * Extract text content from various response formats
   */
  private extractTextFromResponse(data: any): string {
    if (!data) return '';

    // Direct text
    if (typeof data === 'string') return data;

    // Standard formats
    if (data.text) return data.text;
    if (data.content) return data.content;
    if (data.response) return data.response;
    if (data.message?.content) return data.message.content;

    // OpenAI/Anthropic format
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    if (data.choices?.[0]?.delta?.content) {
      return data.choices[0].delta.content;
    }

    // Ollama format
    if (data.message?.content) return data.message.content;

    return '';
  }

  /**
   * Build full context from conversation history
   * No compression - sends everything for maximum context
   */
  buildContext(messages: Array<{ sender: string; content: string }>): { role: string; content: string }[] {
    return messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
  }
}

