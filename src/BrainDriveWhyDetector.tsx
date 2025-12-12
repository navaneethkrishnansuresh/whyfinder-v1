/**
 * BrainDriveWhyDetector
 * Find Your Why - Multi-agent coaching flow
 * With Why Profiles, Ikigai Builder (4 phases), and Decision Helper
 */

import React, { Component } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import './BrainDriveWhyDetector.css';
import {
  BrainDriveWhyDetectorProps,
  BrainDriveWhyDetectorState,
  ChatMessage,
  ModelInfo,
  SessionData,
  SessionMode,
  SessionPhase,
  IkigaiPhase,
  IkigaiProfile,
  IkigaiProfileCreate,
  WhyProfile,
  PhaseStorageData,
  Phase1StoredData,
  Phase2StoredData,
  Phase3StoredData,
  Phase4StoredData,
  PhaseAnswerCounts,
  AutoFilledPhases,
  generateId,
  createEmptyPhaseStorage,
  INITIAL_SESSION_DATA,
  INITIAL_PHASE_COUNTS,
  INITIAL_AUTO_FILLED,
  WHY_FINDER_TOTAL_EXCHANGES,
  MIN_ANSWERS_PER_PHASE,
  IKIGAI_PHASE_ORDER,
  IKIGAI_PHASE_LABELS,
  hasEnoughAnswers,
  hasEnoughForPhase,
  getNextPhase,
  isIkigaiReadyToSave
} from './types';

import { AIService } from './services';
import { 
  INITIAL_GREETING, 
  WHY_COMPLETE_SAVE_PROMPT,
  WHY_SAVED_PROCEED_PROMPT,
  IKIGAI_REQUIRES_WHY_PROFILE,
  IKIGAI_SELECT_WHY_PROFILE,
  IKIGAI_ANALYZING_WHY,
  getIkigaiAnalysisResult,
  IKIGAI_PHASE1_INTRO,
  IKIGAI_PHASE2_INTRO,
  IKIGAI_PHASE3_INTRO,
  IKIGAI_PHASE4_INTRO,
  IKIGAI_COMPLETE_MESSAGE,
  DECISION_HELPER_INTRO,
  NO_IKIGAI_PROFILE_MESSAGE
} from './prompts';

function stripTrailingQuestions(response: string): string {
  if (!response || !/YOUR WHY IS:/i.test(response)) return response;
  const lines = response.split('\n');
  const filtered = lines.filter((line, i) => {
    const trimmed = line.trim();
    if (i >= lines.length - 3 && trimmed.endsWith('?') && trimmed.length < 100) return false;
    return true;
  });
  return filtered.join('\n').trim();
}

/**
 * HARD ENFORCEMENT: Strip out any premature Why statement from model response.
 * If model tries to give Why before exchange 12, we remove it and keep only questions.
 * Returns { cleanedContent, hadPrematureWhy }
 */
function enforceNoEarlyWhy(response: string, exchangeCount: number, totalExchanges: number): { cleanedContent: string; hadPrematureWhy: boolean } {
  // Check for various Why statement formats
  const hasWhyStatement = /YOUR WHY IS:?/i.test(response) || 
                          /\*\*YOUR WHY[:\s]/i.test(response) ||
                          /Your Why[:\s]/i.test(response);
  
  // If it's exchange 12+, allow the Why
  if (exchangeCount >= totalExchanges) {
    return { cleanedContent: response, hadPrematureWhy: false };
  }
  
  // If no Why statement, nothing to strip
  if (!hasWhyStatement) {
    return { cleanedContent: response, hadPrematureWhy: false };
  }
  
  // PREMATURE WHY DETECTED - Strip it out
  console.warn(`PREMATURE WHY DETECTED at exchange ${exchangeCount}/${totalExchanges} - stripping`);
  
  // Find where the Why section starts and remove everything from there
  const whyIndex = response.search(/\*?\*?YOUR WHY[:\s]/i);
  if (whyIndex > 0) {
    let cleaned = response.substring(0, whyIndex).trim();
    
    // If we stripped too much, add a fallback question
    if (cleaned.length < 50) {
      cleaned = "I'm still learning about you. Tell me more about a time when you felt completely in your element - what were you doing and why did it matter to you?";
    }
    
    // Make sure it ends with a question
    if (!cleaned.endsWith('?')) {
      cleaned += "\n\nWhat else would you like to share about this?";
    }
    
    return { cleanedContent: cleaned, hadPrematureWhy: true };
  }
  
  // Fallback - return a generic follow-up question
  return { 
    cleanedContent: "That's really interesting. Can you tell me more about a specific moment when you felt most alive and engaged? What were you doing?",
    hadPrematureWhy: true 
  };
}


class BrainDriveWhyDetector extends Component<BrainDriveWhyDetectorProps, BrainDriveWhyDetectorState> {
  private aiService: AIService | null = null;
  private abortController: AbortController | null = null;
  private themeChangeListener: ((theme: string) => void) | null = null;
  private chatEndRef: React.RefObject<HTMLDivElement>;
  private inputRef: React.RefObject<HTMLTextAreaElement>;

  constructor(props: BrainDriveWhyDetectorProps) {
    super(props);
    this.chatEndRef = React.createRef();
    this.inputRef = React.createRef();
    
    this.state = {
      messages: [],
      inputText: '',
      isLoading: false,
      error: '',
      currentTheme: 'light',
      isStreaming: false,
      isInitializing: true,
      selectedModel: null,
      models: [],
      isLoadingModels: true,
      sessionStarted: false,
      currentPhase: 'intro',
      sessionData: { ...INITIAL_SESSION_DATA },
      whyFinderExchangeCount: 0,
      sessionMode: 'why_finder',
      whyProfiles: [],
      selectedWhyProfileId: null,
      ikigaiProfiles: [],
      selectedIkigaiProfileId: null,
      currentIkigaiPhase: 'phase1_love',
      phaseAnswerCounts: { ...INITIAL_PHASE_COUNTS },
      phaseStorage: createEmptyPhaseStorage(),
      showBuildIkigaiPrompt: false,
      showSaveWhyPrompt: false,
      isIkigaiComplete: false,
      autoFilledPhases: { ...INITIAL_AUTO_FILLED },
      profileName: '',
      whyProfileName: '',
      whyFinderSessionId: null
    };
  }

  async componentDidMount() {
    this.aiService = new AIService(this.props.services);
    this.initializeTheme();
    await this.loadModels();
    await this.loadProfiles();
    
    // ALWAYS clear temp state on page load to ensure fresh session
    // This prevents any context bleeding from previous runs
    await this.clearTempState();
    
    this.setState({ isInitializing: false }, () => {
      // Always start fresh
      this.autoStartSession();
    });
  }

  private autoStartSession = async () => {
    const { models } = this.state;
    if (models.length > 0) {
      // Generate unique session ID to prevent any backend caching
      const newSessionId = generateId('why_session');
      
      this.setState({
        sessionStarted: true,
        selectedModel: models[0],
        currentPhase: 'intro',
        sessionMode: 'why_finder',
        messages: [],
        sessionData: { ...INITIAL_SESSION_DATA },
        whyFinderExchangeCount: 0,
        whyFinderSessionId: newSessionId
      }, () => this.sendCoachMessage('START_SESSION'));
    }
  };

  componentWillUnmount() {
    if (this.themeChangeListener && this.props.services?.theme) {
      this.props.services.theme.removeThemeChangeListener(this.themeChangeListener);
    }
    if (this.abortController) this.abortController.abort();
  }

  componentDidUpdate(_: BrainDriveWhyDetectorProps, prevState: BrainDriveWhyDetectorState) {
    if (this.state.messages.length !== prevState.messages.length) this.scrollToBottom();
  }

  private initializeTheme() {
    if (this.props.services?.theme) {
      const theme = this.props.services.theme.getCurrentTheme();
      this.setState({ currentTheme: theme });
      this.themeChangeListener = (newTheme: string) => this.setState({ currentTheme: newTheme });
      this.props.services.theme.addThemeChangeListener(this.themeChangeListener);
    }
  }

  private async loadModels() {
    if (!this.aiService) {
      this.setState({ isLoadingModels: false, error: 'Service not initialized' });
      return;
    }
    try {
      const models = await this.aiService.fetchModels();
      this.setState({
        models,
        selectedModel: models.length > 0 ? models[0] : null,
        isLoadingModels: false,
        error: models.length === 0 ? 'No AI models available. Please configure a model provider.' : ''
      });
    } catch (error) {
      this.setState({ isLoadingModels: false, error: 'Failed to load AI models' });
    }
  }

  private async loadProfiles() {
    if (!this.aiService) return;
    try {
      const whyProfiles = await this.aiService.loadWhyProfiles();
      const ikigaiProfiles = await this.aiService.loadIkigaiProfiles();
      this.setState({ whyProfiles, ikigaiProfiles });
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  }

  private scrollToBottom() {
    this.chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // ===========================================================================
  // WHY FINDER MESSAGE HANDLING
  // ===========================================================================

  private sendCoachMessage = async (userMessage: string) => {
    const { selectedModel, currentPhase, sessionData, messages, sessionMode, whyFinderExchangeCount } = this.state;
    
    if (!this.aiService || !selectedModel) {
      this.setState({ error: 'No model selected' });
      return;
    }

    if (sessionMode === 'ikigai_builder') return this.sendIkigaiBuilderMessage(userMessage);
    if (sessionMode === 'decision_helper') return this.sendDecisionHelperMessage(userMessage);

    const isSpecialCommand = userMessage === 'START_SESSION';
    let newExchangeCount = whyFinderExchangeCount;
    
    // Create user message object (will be added to state AND context)
    let userMsg: ChatMessage | null = null;
    if (!isSpecialCommand) {
      newExchangeCount = whyFinderExchangeCount + 1;
      userMsg = {
        id: generateId('msg'),
        sender: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
        phase: currentPhase,
        mode: 'why_finder'
      };
    }

    const coachMsgId = generateId('msg');
    const coachMsg: ChatMessage = {
      id: coachMsgId,
      sender: 'coach',
      content: userMessage === 'START_SESSION' ? INITIAL_GREETING : '',
      timestamp: new Date().toISOString(),
      isStreaming: userMessage !== 'START_SESSION',
      phase: currentPhase,
      mode: 'why_finder'
    };

    // FIX: Build the FULL messages array INCLUDING the new user message
    // This ensures the model sees all messages including the one just sent
    const updatedMessages = userMsg 
      ? [...messages, userMsg, coachMsg]
      : [...messages, coachMsg];

    this.setState({
      messages: updatedMessages,
      whyFinderExchangeCount: newExchangeCount,
      isLoading: true,
      isStreaming: userMessage !== 'START_SESSION',
      inputText: ''
    });

    if (userMessage === 'START_SESSION') {
      this.setState({ isLoading: false });
      return;
    }

    this.abortController = new AbortController();

    try {
      // Build context from updatedMessages but EXCLUDE:
      // 1. The streaming coach message placeholder (coachMsgId)
      // 2. The current user message (userMsg.id) - because sendToAI adds it separately
      // This prevents the user message from being sent TWICE to the model
      const contextMessages = updatedMessages.filter(m => 
        m.id !== coachMsgId && (userMsg ? m.id !== userMsg.id : true)
      );
      const context = this.aiService.buildFullContext(contextMessages);

      if ((currentPhase === 'stories' || currentPhase === 'energy_map') && userMessage.length > 50) {
        this.extractAndSaveStrengths(userMessage, currentPhase);
      }

      await this.aiService.sendToCoach(
        userMessage, currentPhase, sessionData, context, newExchangeCount, selectedModel,
        (chunk: string) => {
          this.setState(prev => ({
            messages: prev.messages.map(m => m.id === coachMsgId ? { ...m, content: m.content + chunk } : m)
          }));
        },
        this.abortController,
        this.state.whyFinderSessionId || undefined  // Pass session ID to prevent caching
      );

      // HARD ENFORCEMENT: Process the response after streaming completes
      this.setState(prev => {
        const coachMessage = prev.messages.find(m => m.id === coachMsgId);
        
        // If no coach message found, just update loading states
        if (!coachMessage) {
          return { 
            ...prev,
            isLoading: false, 
            isStreaming: false 
          };
        }
        
        // ENFORCE: Strip premature Why statements (only if NOT at exchange 12)
        const { cleanedContent, hadPrematureWhy } = enforceNoEarlyWhy(
          coachMessage.content, 
          newExchangeCount, 
          WHY_FINDER_TOTAL_EXCHANGES
        );
        
        if (hadPrematureWhy) {
          console.warn(`Blocked premature Why at exchange ${newExchangeCount}`);
        }
        
        // *** HARD STOP: At exchange 12, FORCE COMPLETE regardless of model output ***
        const isExchange12 = newExchangeCount >= WHY_FINDER_TOTAL_EXCHANGES;
        const isComplete = isExchange12; // FORCE STOP AT 12
        
        console.log(`[WHY FINDER] Exchange ${newExchangeCount}: isComplete=${isComplete} (FORCED AT 12)`);
        
        let newSessionData = { ...prev.sessionData };
        
        // Extract ALL sections from the final response
        if (isComplete) {
          // Extract SUMMARY OF WHAT I LEARNED
          const summaryMatch = cleanedContent.match(/SUMMARY OF WHAT I LEARNED:?([\s\S]*?)(?=THE PATTERNS|PATTERNS I SEE|YOUR WHY|$)/i);
          if (summaryMatch) {
            newSessionData.summary = summaryMatch[1].replace(/\*+/g, '').trim().substring(0, 1000);
          }
          
          // Extract PATTERNS I SEE
          const patternsMatch = cleanedContent.match(/(?:THE )?PATTERNS I SEE:?([\s\S]*?)(?=YOUR WHY|$)/i);
          if (patternsMatch) {
            newSessionData.patterns = patternsMatch[1].replace(/\*+/g, '').trim().substring(0, 1000);
          }
          
          // Extract YOUR WHY IS - try multiple patterns
          let whyMatch = cleanedContent.match(/YOUR WHY IS:?\s*\*?\*?\s*([^\n]+)/i);
          if (!whyMatch) whyMatch = cleanedContent.match(/\*\*YOUR WHY[:\s]+\*?\*?\s*([^\n]+)/i);
          if (whyMatch) {
            newSessionData.whyStatement = whyMatch[1].replace(/^\*+|\*+$/g, '').trim();
          }
          
          // Extract WHY THIS FITS YOU
          const explanationMatch = cleanedContent.match(/WHY THIS FITS YOU:?([\s\S]*?)(?=WHAT YOU LOVE|$)/i);
          if (explanationMatch) {
            newSessionData.whyExplanation = explanationMatch[1].replace(/\*+/g, '').trim().substring(0, 1000);
          }
          
          // Extract WHAT YOU LOVE - get full section text
          const loveMatch = cleanedContent.match(/WHAT YOU LOVE[^:]*:?([\s\S]*?)(?=WHAT YOU|$)/i);
          if (loveMatch) {
            const loveItems = loveMatch[1].match(/[•\-\*]\s*([^\n•\-\*]+)/g) || [];
            newSessionData.whatYouLove = loveItems
              .map(item => item.replace(/^[•\-\*\s]+/, '').replace(/\*+/g, '').trim())
              .filter(item => item.length > 3);
          }
          
          // Extract WHAT YOU'RE GOOD AT - handle multiple formats:
          // "WHAT YOU'RE GOOD AT", "WHAT YOU ARE GOOD AT", "What You're Good At"
          const goodAtMatch = cleanedContent.match(/WHAT YOU[''']?RE GOOD AT[^:]*:?([\s\S]*?)$/i) ||
                              cleanedContent.match(/WHAT YOU ARE GOOD AT[^:]*:?([\s\S]*?)$/i) ||
                              cleanedContent.match(/YOUR STRENGTHS[^:]*:?([\s\S]*?)$/i) ||
                              cleanedContent.match(/GOOD AT[^:]*:?([\s\S]*?)$/i);
          if (goodAtMatch) {
            const goodAtItems = goodAtMatch[1].match(/[•\-\*]\s*([^\n•\-\*]+)/g) || [];
            newSessionData.whatYouAreGoodAt = goodAtItems
              .map(item => item.replace(/^[•\-\*\s]+/, '').replace(/\*+/g, '').trim())
              .filter(item => item.length > 3);
            console.log('[WHY FINDER] Found goodAt items:', newSessionData.whatYouAreGoodAt);
          } else {
            console.log('[WHY FINDER] Could not find "What You Are Good At" section');
          }
          
          console.log('[WHY FINDER] Extracted data:', {
            summary: newSessionData.summary?.substring(0, 50) + '...',
            patterns: newSessionData.patterns?.substring(0, 50) + '...',
            whyStatement: newSessionData.whyStatement,
            whyExplanation: newSessionData.whyExplanation?.substring(0, 50) + '...',
            whatYouLove: newSessionData.whatYouLove,
            whatYouAreGoodAt: newSessionData.whatYouAreGoodAt
          });
        }
        
        // Update messages with cleaned content
        const updatedMessages = prev.messages.map(m => {
            if (m.id === coachMsgId) {
            const finalContent = isComplete ? stripTrailingQuestions(cleanedContent) : cleanedContent;
            return { ...m, content: finalContent, isStreaming: false };
            }
            return m;
        });
        
        return {
          ...prev,
          messages: updatedMessages,
          currentPhase: isComplete ? 'completed' as const : prev.currentPhase,
          sessionData: newSessionData,
          showSaveWhyPrompt: isComplete,
          isLoading: false,
          isStreaming: false
        };
      });

      if (newExchangeCount < WHY_FINDER_TOTAL_EXCHANGES) this.analyzeAndUpdatePhase(userMessage);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.setState(prev => ({
          messages: prev.messages.map(m => m.id === coachMsgId ? { ...m, isStreaming: false, content: m.content + ' [Stopped]' } : m),
          isLoading: false,
          isStreaming: false
        }));
      } else {
        this.setState({ error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, isLoading: false, isStreaming: false });
      }
    }
  };

  private async extractAndSaveStrengths(userMessage: string, phase: string) {
    if (!this.aiService || !this.state.selectedModel) return;
    try {
      const strengths = await this.aiService.extractStrengths(userMessage, phase, this.state.selectedModel);
      if (strengths.length > 0) {
        this.setState(prev => ({
          sessionData: { ...prev.sessionData, candidateStrengths: [...prev.sessionData.candidateStrengths, ...strengths] }
        }));
      }
    } catch (error) {
      console.error('Error extracting strengths:', error);
    }
  }

  private analyzeAndUpdatePhase(userMessage: string) {
    const { currentPhase, sessionData, messages, whyFinderExchangeCount } = this.state;
    const userMessagesInPhase = messages.filter(m => m.phase === currentPhase && m.sender === 'user').length;
    
    let newPhase = currentPhase;
    let newSessionData = { ...sessionData };

    if (userMessage.length > 30) {
      if (currentPhase === 'energy_map') {
        if (newSessionData.energizers.length < 3) newSessionData.energizers = [...sessionData.energizers, userMessage.substring(0, 150)];
        else if (newSessionData.drainers.length < 3) newSessionData.drainers = [...sessionData.drainers, userMessage.substring(0, 150)];
      }
      if (currentPhase === 'stories') newSessionData.stories = [...sessionData.stories, userMessage.substring(0, 200)];
    }

    if (whyFinderExchangeCount <= 3) newPhase = 'intro';
    else if (whyFinderExchangeCount <= 6) newPhase = 'energy_map';
    else if (whyFinderExchangeCount <= 10) newPhase = 'stories';
    else newPhase = 'your_why';

    if (newPhase !== currentPhase || JSON.stringify(newSessionData) !== JSON.stringify(sessionData)) {
      this.setState({ currentPhase: newPhase, sessionData: newSessionData });
    }
  }

  // ===========================================================================
  // WHY PROFILE SAVING
  // ===========================================================================

  private handleSaveWhyProfile = async () => {
    const { messages, sessionData, whyFinderExchangeCount, selectedModel, whyProfileName, isLoading } = this.state;
    
    // Prevent double-clicks
    if (isLoading) return;
    
    if (!this.aiService) {
      this.setState({ error: 'Service not initialized. Please refresh the page.' });
      return;
    }
    
    if (!whyProfileName.trim()) {
      this.setState({ error: 'Please enter a name for your Why profile' });
      return;
    }
    
    // Set loading immediately to disable button
    this.setState({ isLoading: true, error: '' });
    
    try {
      // Get the final coach message which contains the verdict
      const finalCoachMessage = messages
        .filter(m => m.mode === 'why_finder' && m.sender === 'coach')
        .pop();
      
      // Extract clean data from the final verdict (or use sessionData as fallback)
      let whatYouLove = this.extractBulletItems(finalCoachMessage?.content || '', 'WHAT YOU LOVE');
      let whatYouAreGoodAt = this.extractBulletItems(finalCoachMessage?.content || '', "WHAT YOU'RE GOOD AT");
      
      // Fallback to session data if extraction failed
      if (whatYouLove.length === 0) whatYouLove = sessionData.whatYouLove || [];
      if (whatYouAreGoodAt.length === 0) whatYouAreGoodAt = sessionData.whatYouAreGoodAt || [];
      
      // Limit to 5 items each for efficiency
      whatYouLove = whatYouLove.slice(0, 5);
      whatYouAreGoodAt = whatYouAreGoodAt.slice(0, 5);
      
      // Create profile with ALL essential verdict data
      const profile: WhyProfile = {
        id: generateId('why'),
        name: whyProfileName.trim(),
        createdAt: new Date().toISOString(),
        
        // Full verdict sections from sessionData (extracted at exchange 12)
        summary: sessionData.summary || '',
        patterns: sessionData.patterns || '',
        whyStatement: sessionData.whyStatement || '',
        whyExplanation: sessionData.whyExplanation || '',
        
        // For Ikigai Builder
        whatYouLove: whatYouLove,
        whatYouAreGoodAt: whatYouAreGoodAt,
        
        // Metadata
        modelUsed: selectedModel?.name || 'unknown',
        exchangeCount: whyFinderExchangeCount
      };
      
      console.log('[WHY FINDER] Saving profile:', {
        summary: profile.summary?.substring(0, 50) + '...',
        patterns: profile.patterns?.substring(0, 50) + '...',
        whyStatement: profile.whyStatement,
        whatYouLove: profile.whatYouLove,
        whatYouAreGoodAt: profile.whatYouAreGoodAt
      });
      
      console.log('Saving lean Why profile:', profile.name);
      await this.aiService.saveWhyProfile(profile);
      console.log('Why profile saved successfully');
      
      const whyProfiles = await this.aiService.loadWhyProfiles();
      
      const confirmMsg: ChatMessage = {
        id: generateId('msg'),
        sender: 'coach',
        content: WHY_SAVED_PROCEED_PROMPT,
        timestamp: new Date().toISOString(),
        phase: 'completed',
        mode: 'why_finder'
      };
      
      this.setState({
        whyProfiles,
        selectedWhyProfileId: profile.id,
        showSaveWhyPrompt: false,
        showBuildIkigaiPrompt: true,
        messages: [...this.state.messages, confirmMsg],
        isLoading: false,
        error: ''
      });
      
    } catch (error) {
      console.error('Error saving Why profile:', error);
      this.setState({ 
        error: `Failed to save Why profile: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        isLoading: false 
      });
    }
  };
  
  // Helper: Extract bullet items from a section
  private extractBulletItems(content: string, sectionName: string): string[] {
    // Handle variations of "WHAT YOU'RE GOOD AT" / "WHAT YOU ARE GOOD AT"
    let searchName = sectionName;
    if (sectionName.toLowerCase().includes("good at")) {
      // Try multiple variations
      const variations = [
        "WHAT YOU'RE GOOD AT",
        "WHAT YOU ARE GOOD AT", 
        "WHAT YOU\\'RE GOOD AT",
        "YOUR STRENGTHS"
      ];
      for (const variant of variations) {
        const regex = new RegExp(`\\*{0,2}${variant}[^:]*:?\\*{0,2}([\\s\\S]*?)(?=\\*{1,2}[A-Z]|$)`, 'i');
        const match = content.match(regex);
        if (match) {
          return this.parseBulletSection(match[1]);
        }
      }
      return [];
    }
    
    // Standard extraction for other sections
    const regex = new RegExp(`\\*{1,2}${searchName}[^:]*:\\*{0,2}([\\s\\S]*?)(?=\\*{1,2}[A-Z]|$)`, 'i');
    const match = content.match(regex);
    if (!match) return [];
    
    return this.parseBulletSection(match[1]);
  }
  
  private parseBulletSection(text: string): string[] {
    const items: string[] = [];
    const lines = text.split('\n');
    for (const line of lines) {
      // Remove bullet markers, asterisks, dashes at start
      let cleaned = line.replace(/^[\s•\-\*]+/, '').trim();
      // Remove any remaining asterisks (markdown bold)
      cleaned = cleaned.replace(/\*+/g, '').trim();
      
      // Skip if:
      // - Empty or too short
      // - Looks like a header (ends with colon, contains all caps section names)
      // - Contains markdown formatting remnants
      const isHeader = cleaned.endsWith(':') || 
                       /^[A-Z\s]{5,}$/.test(cleaned) ||
                       /WHAT YOU|PATTERNS|SUMMARY|WHY THIS/i.test(cleaned);
      
      if (cleaned && cleaned.length > 5 && !isHeader) {
        items.push(cleaned);
      }
    }
    return items;
  }
  
  // Helper: Extract a text section
  private extractSection(content: string, sectionName: string): string {
    const regex = new RegExp(`\\*\\*${sectionName}[^:]*:\\*\\*([\\s\\S]*?)(?=\\*\\*|$)`, 'i');
    const match = content.match(regex);
    if (!match) return '';
    return match[1].trim().replace(/\n+/g, ' ').substring(0, 500);
  }

  private handleSkipSaveWhy = () => {
    this.setState({ showSaveWhyPrompt: false, showBuildIkigaiPrompt: true });
  };

  // ===========================================================================
  // IKIGAI BUILDER (4 Phases)
  // ===========================================================================

  // Minimum message length to count as a meaningful answer
  private static MIN_ANSWER_LENGTH = 15;

  private sendIkigaiBuilderMessage = async (userMessage: string) => {
    const { selectedModel, currentIkigaiPhase, phaseStorage, phaseAnswerCounts, selectedWhyProfileId, whyProfiles, isLoading } = this.state;
    
    // PREVENT RAPID CLICKS - if already loading, ignore
    if (isLoading) {
      console.log('[IKIGAI] Already loading, ignoring message');
      return;
    }
    
    if (!this.aiService || !selectedModel) {
      this.setState({ error: 'No model selected' });
      return;
    }

    const isPhaseStart = userMessage.startsWith('START_PHASE_');
    
    if (isPhaseStart) {
      const phaseIntro = this.getIkigaiPhaseIntroMessage(currentIkigaiPhase);
      const introMsg: ChatMessage = {
        id: generateId('msg'),
        sender: 'coach',
        content: phaseIntro,
        timestamp: new Date().toISOString(),
        phase: currentIkigaiPhase,
        mode: 'ikigai_builder'
      };
      this.setState(prev => ({ messages: [...prev.messages, introMsg] }));
      return;
    }
    
    // CRITICAL: Get fresh messages from state to avoid stale data
    const currentMessages = this.state.messages;
    
    // Create user message
    const userMsg: ChatMessage = {
      id: generateId('msg'),
      sender: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
      phase: currentIkigaiPhase,
      mode: 'ikigai_builder'
    };
    
    // Create placeholder for coach response
    const coachMsgId = generateId('msg');
    const coachMsg: ChatMessage = {
      id: coachMsgId,
      sender: 'coach',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      phase: currentIkigaiPhase,
      mode: 'ikigai_builder'
    };

    // Build context BEFORE setting state to avoid race conditions
    // Include all messages from current phase EXCEPT the new ones we're adding
    const historyMessages = currentMessages
      .filter(m => m.mode === 'ikigai_builder' && m.phase === currentIkigaiPhase)
      .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.content }));
    
    console.log('[IKIGAI] Context being sent to model:', historyMessages.length, 'messages');
    historyMessages.forEach((m, i) => console.log(`  [${i}] ${m.role}: ${m.content.substring(0, 50)}...`));

    // Check if this answer will complete the phase (3rd meaningful answer)
    const trimmedMessage = userMessage.trim().toLowerCase();
    const fillerResponses = ['ok', 'okay', 'yes', 'no', 'maybe', 'sure', 'i guess', 'i think so', 'not sure', 'idk'];
    const isMeaningful = trimmedMessage.length >= BrainDriveWhyDetector.MIN_ANSWER_LENGTH && 
                         !fillerResponses.includes(trimmedMessage);
    
    // Calculate what the new count will be
    let currentCount = 0;
    switch (currentIkigaiPhase) {
      case 'phase1_love': currentCount = phaseAnswerCounts.love; break;
      case 'phase2_good_at': currentCount = phaseAnswerCounts.goodAt; break;
      case 'phase3_world': currentCount = phaseAnswerCounts.worldNeeds; break;
      case 'phase4_paid': currentCount = phaseAnswerCounts.paidFor; break;
    }
    const willCompletePhase = isMeaningful && (currentCount + 1) >= MIN_ANSWERS_PER_PHASE;
    
    console.log(`[IKIGAI] Phase ${currentIkigaiPhase}: count=${currentCount}, willComplete=${willCompletePhase}`);

    // If this will complete the phase, DON'T call the coach - just add message and move on
    if (willCompletePhase) {
      console.log(`[IKIGAI] *** Phase ${currentIkigaiPhase} complete with 3rd answer - skipping coach, moving to next phase ***`);
      
      // Add user message + a "processing" message to show loading state
      const processingMsg: ChatMessage = {
        id: generateId('msg'),
        sender: 'coach',
        content: '✅ Got it! Processing your answers and preparing the next phase...',
        timestamp: new Date().toISOString(),
        phase: currentIkigaiPhase,
        mode: 'ikigai_builder',
        isStreaming: true  // Shows loading indicator
      };
      
      this.setState({
        messages: [...currentMessages, userMsg, processingMsg],
        inputText: '',
        isLoading: true  // Show loading state
      });
      
      // Update counter and trigger phase completion
      this.updatePhaseAnswerCount(userMessage);
      return;
    }

    // NOT completing phase - continue with normal coach conversation
    // Add BOTH messages to state
    const updatedMessages = [...currentMessages, userMsg, coachMsg];
    
    this.setState({
      messages: updatedMessages,
      isLoading: true,
      isStreaming: true,
      inputText: ''
    });

    // COUNT ANSWER IMMEDIATELY when user sends message
    this.updatePhaseAnswerCount(userMessage);

    this.abortController = new AbortController();

    try {
      const whyProfile = selectedWhyProfileId ? whyProfiles.find(p => p.id === selectedWhyProfileId) || null : null;

      await this.aiService.sendToIkigaiBuilder(
        userMessage, currentIkigaiPhase, phaseStorage, phaseAnswerCounts, historyMessages, selectedModel,
        (chunk: string) => {
          this.setState(prev => ({
            messages: prev.messages.map(m => m.id === coachMsgId ? { ...m, content: m.content + chunk } : m)
          }));
        },
        this.abortController,
        whyProfile
      );

      this.setState(prev => ({
        messages: prev.messages.map(m => m.id === coachMsgId ? { ...m, isStreaming: false } : m),
        isLoading: false,
        isStreaming: false
      }));

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.setState(prev => ({
          messages: prev.messages.map(m => m.id === coachMsgId ? { ...m, isStreaming: false, content: m.content + ' [Stopped]' } : m),
          isLoading: false,
          isStreaming: false
        }));
      } else {
        this.setState({ error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, isLoading: false, isStreaming: false });
      }
    }
  };

  private getIkigaiPhaseIntroMessage(phase: IkigaiPhase): string {
    switch (phase) {
      case 'phase1_love': return IKIGAI_PHASE1_INTRO;
      case 'phase2_good_at': return IKIGAI_PHASE2_INTRO;
      case 'phase3_world': return IKIGAI_PHASE3_INTRO;
      case 'phase4_paid': return IKIGAI_PHASE4_INTRO;
      case 'complete': return IKIGAI_COMPLETE_MESSAGE;
      default: return '';
    }
  }

  /**
   * Update phase answer count.
   * Only counts as an answer if the message is meaningful (not just "ok", "yes", etc.)
   */
  private updatePhaseAnswerCount(userMessage: string) {
    const { currentIkigaiPhase, phaseAnswerCounts } = this.state;
    
    // FIX: Only count meaningful answers
    // Check message length and that it's not just filler words
    const trimmedMessage = userMessage.trim().toLowerCase();
    const fillerResponses = ['ok', 'okay', 'yes', 'no', 'maybe', 'sure', 'i guess', 'i think so', 'not sure', 'idk'];
    
    const isMeaningful = trimmedMessage.length >= BrainDriveWhyDetector.MIN_ANSWER_LENGTH && 
                         !fillerResponses.includes(trimmedMessage);
    
    if (!isMeaningful) {
      console.log(`Answer too short or filler: "${userMessage}" - not counting`);
      return; // Don't increment counter for non-meaningful responses
    }
    
    let newCounts = { ...phaseAnswerCounts };
    
    switch (currentIkigaiPhase) {
      case 'phase1_love': newCounts.love++; break;
      case 'phase2_good_at': newCounts.goodAt++; break;
      case 'phase3_world': newCounts.worldNeeds++; break;
      case 'phase4_paid': newCounts.paidFor++; break;
    }
    
    console.log(`Phase ${currentIkigaiPhase} answer count: ${JSON.stringify(newCounts)}`);
    
    this.setState({ phaseAnswerCounts: newCounts }, () => {
      if (hasEnoughAnswers(newCounts, currentIkigaiPhase)) {
        this.checkAndCompletePhase();
      }
    });
  }

  private async checkAndCompletePhase() {
    const { currentIkigaiPhase, messages, selectedModel, phaseStorage, selectedWhyProfileId, whyProfiles } = this.state;
    
    if (!this.aiService || !selectedModel) return;
    
    const phaseMessages = messages.filter(m => m.mode === 'ikigai_builder' && m.phase === currentIkigaiPhase);
    const whyProfile = selectedWhyProfileId ? whyProfiles.find(p => p.id === selectedWhyProfileId) : null;
    
    this.setState({ isLoading: true });
    
    try {
      const summary = await this.aiService.summarizePhase(currentIkigaiPhase, phaseMessages, selectedModel);
      let newStorage = { ...phaseStorage, whyProfileId: selectedWhyProfileId || undefined };
      
      if (currentIkigaiPhase === 'phase1_love') {
        newStorage.phase1 = {
          fullConversation: phaseMessages,
          love: { bullets: summary.love?.bullets || [], quotes: summary.love?.quotes || [], summary: summary.love?.summary || '' },
          keyInsights: summary.key_insights || [],
          contextSummary: summary.context_summary || '',
          completedAt: new Date().toISOString(),
          exchangeCount: phaseMessages.filter(m => m.sender === 'user').length,
          autoFilled: false
        };
        
        // FIX: Check if Phase 2 can be auto-filled from Why Profile
        const canAutoFillPhase2 = whyProfile && whyProfile.whatYouAreGoodAt.length >= MIN_ANSWERS_PER_PHASE;
        
        if (canAutoFillPhase2 && whyProfile) {
          // Auto-fill Phase 2 and skip to Phase 3
          newStorage.phase2 = {
            fullConversation: [],
            goodAt: { 
              bullets: whyProfile.whatYouAreGoodAt, 
              quotes: [], 
              summary: `Auto-filled from Why Profile: ${whyProfile.name}` 
            },
            keyInsights: [],
            contextSummary: '',
            completedAt: new Date().toISOString(),
            exchangeCount: 0,
            autoFilled: true
          };
          
          // Update auto-filled status
          this.setState({ 
            autoFilledPhases: { ...this.state.autoFilledPhases, phase2_good_at: true },
            phaseAnswerCounts: { ...this.state.phaseAnswerCounts, goodAt: whyProfile.whatYouAreGoodAt.length }
          });
          
          // Save and skip to Phase 3
          await this.saveTempState(newStorage);
          this.transitionToNextPhase('phase3_world', newStorage);
        } else {
          // Normal flow - go to Phase 2
          await this.saveTempState(newStorage);
          this.transitionToNextPhase('phase2_good_at', newStorage);
        }
        
      } else if (currentIkigaiPhase === 'phase2_good_at') {
        newStorage.phase2 = {
          fullConversation: phaseMessages,
          goodAt: { bullets: summary.good_at?.bullets || [], quotes: summary.good_at?.quotes || [], summary: summary.good_at?.summary || '' },
          keyInsights: summary.key_insights || [],
          contextSummary: summary.context_summary || '',
          completedAt: new Date().toISOString(),
          exchangeCount: phaseMessages.filter(m => m.sender === 'user').length,
          autoFilled: false
        };
        // Save to temp state
        await this.saveTempState(newStorage);
        this.transitionToNextPhase('phase3_world', newStorage);
        
      } else if (currentIkigaiPhase === 'phase3_world') {
        newStorage.phase3 = {
          fullConversation: phaseMessages,
          worldNeeds: { bullets: summary.world_needs?.bullets || [], quotes: summary.world_needs?.quotes || [], summary: summary.world_needs?.summary || '', whoToHelp: summary.world_needs?.who_to_help || [] },
          keyInsights: summary.key_insights || [],
          contextSummary: summary.context_summary || '',
          completedAt: new Date().toISOString(),
          exchangeCount: phaseMessages.filter(m => m.sender === 'user').length
        };
        // Save to temp state
        await this.saveTempState(newStorage);
        this.transitionToNextPhase('phase4_paid', newStorage);
        
      } else if (currentIkigaiPhase === 'phase4_paid') {
        newStorage.phase4 = {
          fullConversation: phaseMessages,
          paidFor: {
            bullets: [...(summary.paid_for?.current || []), ...(summary.paid_for?.potential || [])],
            quotes: summary.paid_for?.quotes || [],
            summary: summary.paid_for?.summary || '',
            currentPaths: summary.paid_for?.current || [],
            potentialPaths: summary.paid_for?.potential || [],
            constraints: summary.paid_for?.constraints || []
          },
          keyInsights: summary.key_insights || [],
          contextSummary: summary.context_summary || '',
          completedAt: new Date().toISOString(),
          exchangeCount: phaseMessages.filter(m => m.sender === 'user').length
        };
        // Save to temp state before computing overlaps
        await this.saveTempState(newStorage);
        await this.computeAndShowOverlaps(newStorage);
      }
      
    } catch (error) {
      console.error('Error completing phase:', error);
      this.setState({ error: 'Error saving phase data. Please continue.', isLoading: false });
    }
  }

  /**
   * Save current phase data to temp state (via pluginState).
   * This preserves FULL conversation data for later profile saving.
   * 
   * IMPORTANT: Saves ALL state needed to resume session:
   * - sessionMode (why_finder/ikigai_builder/decision_helper)
   * - currentIkigaiPhase (which phase we're on)
   * - phaseStorage (all phase data including conversations)
   * - messages (current conversation)
   * - autoFilledPhases, phaseAnswerCounts, selectedWhyProfileId
   */
  private async saveTempState(storage: PhaseStorageData, currentMessages?: ChatMessage[]) {
    if (!this.aiService) return;
    
    try {
      await this.aiService.saveTempState({
        // Session mode and phase - CRITICAL for recovery
        sessionMode: this.state.sessionMode,
        currentIkigaiPhase: this.state.currentIkigaiPhase,
        
        // Phase storage (conversations, extracted data)
        phaseStorage: storage,
        
        // Current messages in chat
        messages: currentMessages || this.state.messages,
        
        // Counters and flags
        autoFilledPhases: this.state.autoFilledPhases,
        phaseAnswerCounts: this.state.phaseAnswerCounts,
        selectedWhyProfileId: this.state.selectedWhyProfileId,
        
        lastUpdated: new Date().toISOString()
      });
      console.log('Temp state saved successfully');
    } catch (error) {
      console.error('Error saving temp state:', error);
    }
  }

  /**
   * Clear temp state after profile has been saved.
   */
  private async clearTempState() {
    if (!this.aiService) return;
    
    try {
      await this.aiService.clearTempState();
      console.log('Temp state cleared');
    } catch (error) {
      console.error('Error clearing temp state:', error);
    }
  }

  private transitionToNextPhase(nextPhase: IkigaiPhase, newStorage: PhaseStorageData) {
    this.setState({
      phaseStorage: newStorage,
      currentIkigaiPhase: nextPhase,
      messages: this.state.messages.filter(m => m.mode !== 'ikigai_builder'),
      isLoading: false
    }, () => {
      this.sendIkigaiBuilderMessage(`START_PHASE_${nextPhase.toUpperCase()}`);
    });
  }

  private async computeAndShowOverlaps(storageWithPhase4: PhaseStorageData) {
    const { selectedModel, selectedWhyProfileId, whyProfiles, autoFilledPhases } = this.state;
    
    if (!this.aiService || !selectedModel) {
      this.setState({ error: 'No model available to compute overlaps', isLoading: false });
      return;
    }
    
    const whyProfile = selectedWhyProfileId ? whyProfiles.find(p => p.id === selectedWhyProfileId) : null;
    
    const love = storageWithPhase4.phase1?.love.bullets || (autoFilledPhases.phase1_love && whyProfile ? whyProfile.whatYouLove : []);
    const goodAt = storageWithPhase4.phase2?.goodAt.bullets || (autoFilledPhases.phase2_good_at && whyProfile ? whyProfile.whatYouAreGoodAt : []);
    const worldNeeds = storageWithPhase4.phase3?.worldNeeds.bullets || [];
    const paidFor = storageWithPhase4.phase4?.paidFor.bullets || [];
    const whyStatement = whyProfile?.whyStatement || '';
    
    try {
      const overlaps = await this.aiService.computeOverlaps(whyStatement, love, goodAt, worldNeeds, paidFor, selectedModel);
      
      if (overlaps) {
        const finalStorage: PhaseStorageData = { ...storageWithPhase4, overlaps };
        
        // Save final state with overlaps
        await this.saveTempState(finalStorage);
        
        this.setState({
          phaseStorage: finalStorage,
          currentIkigaiPhase: 'complete',
          isIkigaiComplete: true,
          messages: [],
          isLoading: false
        }, () => {
          const completeMsg: ChatMessage = {
            id: generateId('msg'),
            sender: 'coach',
            content: IKIGAI_COMPLETE_MESSAGE + '\n\n' + this.generateIkigaiSummary(finalStorage),
            timestamp: new Date().toISOString(),
            phase: 'complete',
            mode: 'ikigai_builder'
          };
          this.setState(prev => ({ messages: [...prev.messages, completeMsg] }));
        });
      } else {
        // FIX: Handle null overlaps - show error and allow retry
        console.error('computeOverlaps returned null');
        this.setState({ 
          error: 'Failed to compute Ikigai overlaps. Please try saving again.',
          isLoading: false,
          isIkigaiComplete: true,  // Still allow saving even without overlaps
          currentIkigaiPhase: 'complete'
        }, () => {
          // Create overlaps with empty values so user can still save
          const fallbackOverlaps = {
            passion: { bullets: [], summary: 'Could not compute - please add manually' },
            mission: { bullets: [], summary: 'Could not compute - please add manually' },
            profession: { bullets: [], summary: 'Could not compute - please add manually' },
            vocation: { bullets: [], summary: 'Could not compute - please add manually' },
            computedAt: new Date().toISOString()
          };
          const finalStorage: PhaseStorageData = { ...storageWithPhase4, overlaps: fallbackOverlaps };
          this.setState({ phaseStorage: finalStorage });
        });
      }
    } catch (error) {
      console.error('Error computing overlaps:', error);
      this.setState({ error: 'Failed to compute overlaps. You can still save your profile.', isLoading: false });
    }
  }

  private generateIkigaiSummary(storage: PhaseStorageData): string {
    const love = storage.phase1?.love.bullets || [];
    const goodAt = storage.phase2?.goodAt.bullets || [];
    const worldNeeds = storage.phase3?.worldNeeds.bullets || [];
    const paidFor = storage.phase4?.paidFor.bullets || [];
    const overlaps = storage.overlaps;
    
    return `---

**What You Love:** ${love.map(b => `• ${b}`).join('\n')}

**What You're Good At:** ${goodAt.map(b => `• ${b}`).join('\n')}

**What the World Needs:** ${worldNeeds.map(b => `• ${b}`).join('\n')}

**What You Can Be Paid For:** ${paidFor.map(b => `• ${b}`).join('\n')}

---

**Your Ikigai Overlaps:**
🔥 **Passion**: ${overlaps?.passion.summary || '...'}
🌍 **Mission**: ${overlaps?.mission.summary || '...'}
💼 **Profession**: ${overlaps?.profession.summary || '...'}
🎯 **Vocation**: ${overlaps?.vocation.summary || '...'}`;
  }

  // ===========================================================================
  // DECISION HELPER
  // ===========================================================================

  private sendDecisionHelperMessage = async (userMessage: string) => {
    const { selectedModel, selectedIkigaiProfileId, ikigaiProfiles, messages } = this.state;
    
    if (!this.aiService || !selectedModel) {
      this.setState({ error: 'No model selected' });
      return;
    }

    const profile = ikigaiProfiles.find(p => p.id === selectedIkigaiProfileId);
    if (!profile) {
      this.setState({ error: 'Could not load profile' });
      return;
    }

    const isSpecialCommand = userMessage === 'START_DECISION_HELPER';
    
    if (!isSpecialCommand) {
      const userMsg: ChatMessage = { id: generateId('msg'), sender: 'user', content: userMessage, timestamp: new Date().toISOString(), mode: 'decision_helper' };
      this.setState(prev => ({ messages: [...prev.messages, userMsg] }));
    }

    const coachMsgId = generateId('msg');
    const coachMsg: ChatMessage = {
      id: coachMsgId,
      sender: 'coach',
      content: isSpecialCommand ? DECISION_HELPER_INTRO : '',
      timestamp: new Date().toISOString(),
      isStreaming: !isSpecialCommand,
      mode: 'decision_helper'
    };

    this.setState(prev => ({ messages: [...prev.messages, coachMsg], isLoading: true, isStreaming: !isSpecialCommand, inputText: '' }));

    if (isSpecialCommand) {
      this.setState({ isLoading: false });
      return;
    }

    this.abortController = new AbortController();

    try {
      const context = this.aiService.buildFullContext(messages.filter(m => m.mode === 'decision_helper'));

      await this.aiService.sendToDecisionHelper(userMessage, profile, context, selectedModel,
        (chunk: string) => {
          this.setState(prev => ({ messages: prev.messages.map(m => m.id === coachMsgId ? { ...m, content: m.content + chunk } : m) }));
        },
        this.abortController
      );

      this.setState(prev => ({
        messages: prev.messages.map(m => m.id === coachMsgId ? { ...m, isStreaming: false } : m),
        isLoading: false,
        isStreaming: false
      }));

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.setState(prev => ({
          messages: prev.messages.map(m => m.id === coachMsgId ? { ...m, isStreaming: false, content: m.content + ' [Stopped]' } : m),
          isLoading: false,
          isStreaming: false
        }));
      } else {
        this.setState({ error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, isLoading: false, isStreaming: false });
      }
    }
  };

  // ===========================================================================
  // MODE SWITCHING
  // ===========================================================================

  private handleStartIkigaiBuilder = () => {
    const { whyProfiles, selectedWhyProfileId } = this.state;
    
    console.log('Starting Ikigai Builder...');
    console.log('Why profiles available:', whyProfiles.length);
    console.log('Selected Why Profile ID:', selectedWhyProfileId);
    
    if (whyProfiles.length === 0) {
      console.warn('No Why profiles found');
      // Show error as a coach message for better visibility
      const errorMsg: ChatMessage = {
        id: generateId('msg'),
        sender: 'coach',
        content: IKIGAI_REQUIRES_WHY_PROFILE,
        timestamp: new Date().toISOString(),
        mode: 'why_finder'
      };
      this.setState({ 
        error: 'No saved Why Profile found. Complete a Why Discovery first!',
        messages: [...this.state.messages, errorMsg],
        showBuildIkigaiPrompt: false
      });
      return;
    }
    
    if (!selectedWhyProfileId) {
      console.warn('No Why profile selected');
      // Show error as a coach message for better visibility
      const selectMsg: ChatMessage = {
        id: generateId('msg'),
        sender: 'coach',
        content: IKIGAI_SELECT_WHY_PROFILE,
        timestamp: new Date().toISOString(),
        mode: 'why_finder'
      };
      this.setState({ 
        error: 'Please select a Why Profile from the dropdown first.',
        messages: [...this.state.messages, selectMsg],
        showBuildIkigaiPrompt: false
      });
      return;
    }
    
    const whyProfile = whyProfiles.find(p => p.id === selectedWhyProfileId);
    if (!whyProfile) {
      console.warn('Selected Why profile not found in list');
      this.setState({ error: 'Selected Why Profile not found. Please select another one.' });
      return;
    }
    
    console.log('Using Why Profile:', whyProfile.name);
    
    // Analyze Why profile
    const loveCount = whyProfile.whatYouLove.length;
    const goodAtCount = whyProfile.whatYouAreGoodAt.length;
    const hasEnoughLove = loveCount >= MIN_ANSWERS_PER_PHASE;
    const hasEnoughGoodAt = goodAtCount >= MIN_ANSWERS_PER_PHASE;
    
    // Show analysis message
    const analysisResult = getIkigaiAnalysisResult(whyProfile, loveCount, goodAtCount);
    const analysisMsg: ChatMessage = {
      id: generateId('msg'),
      sender: 'coach',
      content: analysisResult,
      timestamp: new Date().toISOString(),
      mode: 'ikigai_builder'
    };
    
    // Determine starting phase and auto-fill
    let startPhase: IkigaiPhase;
    let newCounts = { ...INITIAL_PHASE_COUNTS };
    let newAutoFilled = { ...INITIAL_AUTO_FILLED };
    let newStorage = createEmptyPhaseStorage();
    newStorage.whyProfileId = selectedWhyProfileId;
    
    if (hasEnoughLove && hasEnoughGoodAt) {
      // Both satisfied - skip to Phase 3
      startPhase = 'phase3_world';
      newCounts = { love: loveCount, goodAt: goodAtCount, worldNeeds: 0, paidFor: 0 };
      newAutoFilled = { phase1_love: true, phase2_good_at: true };
      
      newStorage.phase1 = {
        fullConversation: [],
        love: { bullets: whyProfile.whatYouLove, quotes: [], summary: `Auto-filled from Why Profile: ${whyProfile.name}` },
        keyInsights: [],
        contextSummary: '',
        completedAt: new Date().toISOString(),
        exchangeCount: 0,
        autoFilled: true
      };
      newStorage.phase2 = {
        fullConversation: [],
        goodAt: { bullets: whyProfile.whatYouAreGoodAt, quotes: [], summary: `Auto-filled from Why Profile: ${whyProfile.name}` },
        keyInsights: [],
        contextSummary: '',
        completedAt: new Date().toISOString(),
        exchangeCount: 0,
        autoFilled: true
      };
      
    } else if (hasEnoughLove) {
      // Only love satisfied - skip Phase 1
      startPhase = 'phase2_good_at';
      newCounts = { love: loveCount, goodAt: goodAtCount, worldNeeds: 0, paidFor: 0 };
      newAutoFilled = { phase1_love: true, phase2_good_at: false };
      
      newStorage.phase1 = {
        fullConversation: [],
        love: { bullets: whyProfile.whatYouLove, quotes: [], summary: `Auto-filled from Why Profile: ${whyProfile.name}` },
        keyInsights: [],
        contextSummary: '',
        completedAt: new Date().toISOString(),
        exchangeCount: 0,
        autoFilled: true
      };
      
    } else if (hasEnoughGoodAt) {
      // Only good at satisfied - start with Phase 1, but mark goodAt
      startPhase = 'phase1_love';
      newCounts = { love: loveCount, goodAt: goodAtCount, worldNeeds: 0, paidFor: 0 };
      newAutoFilled = { phase1_love: false, phase2_good_at: false }; // Will auto-fill phase2 when we get there
      
    } else {
      // Neither satisfied - start from Phase 1
      startPhase = 'phase1_love';
      newCounts = { love: loveCount, goodAt: goodAtCount, worldNeeds: 0, paidFor: 0 };
    }
    
    this.setState({
      sessionMode: 'ikigai_builder',
      currentIkigaiPhase: startPhase,
      showBuildIkigaiPrompt: false,
      showSaveWhyPrompt: false,
      messages: [analysisMsg],
      phaseStorage: newStorage,
      phaseAnswerCounts: newCounts,
      autoFilledPhases: newAutoFilled
    }, () => {
      setTimeout(() => {
        this.sendIkigaiBuilderMessage(`START_PHASE_${startPhase.toUpperCase()}`);
      }, 500);
    });
  };

  private handleStartDecisionHelper = () => {
    const { ikigaiProfiles, selectedIkigaiProfileId } = this.state;
    
    console.log('Starting Decision Helper...');
    console.log('Ikigai profiles available:', ikigaiProfiles.length);
    console.log('Selected Ikigai Profile ID:', selectedIkigaiProfileId);
    
    if (ikigaiProfiles.length === 0) {
      console.warn('No Ikigai profiles found');
      // Show error as a coach message for better visibility
      const errorMsg: ChatMessage = {
        id: generateId('msg'),
        sender: 'coach',
        content: NO_IKIGAI_PROFILE_MESSAGE,
        timestamp: new Date().toISOString(),
        mode: 'why_finder'
      };
      this.setState({ 
        error: 'No saved Ikigai Profile found. Complete Ikigai Builder first!',
        messages: [...this.state.messages, errorMsg]
      });
      return;
    }
    
    if (!selectedIkigaiProfileId) {
      console.warn('No Ikigai profile selected');
      this.setState({ 
        error: 'Please select an Ikigai profile from the dropdown first.' 
      });
      return;
    }
    
    const profile = ikigaiProfiles.find(p => p.id === selectedIkigaiProfileId);
    if (!profile) {
      console.warn('Selected Ikigai profile not found');
      this.setState({ error: 'Selected Ikigai profile not found. Please select another one.' });
      return;
    }
    
    console.log('Using Ikigai Profile:', profile.name);
    
    this.setState({ sessionMode: 'decision_helper', messages: [], error: '' }, () => {
      this.sendDecisionHelperMessage('START_DECISION_HELPER');
    });
  };

  private handleBackToWhyFinder = async () => {
    // FIX: Clear temp state when starting new session
    await this.clearTempState();
    
    this.setState({
      sessionMode: 'why_finder',
      messages: [],
      currentPhase: 'intro',
      sessionData: { ...INITIAL_SESSION_DATA },
      showBuildIkigaiPrompt: false,
      showSaveWhyPrompt: false,
      whyFinderExchangeCount: 0,
      phaseStorage: createEmptyPhaseStorage(),
      phaseAnswerCounts: { ...INITIAL_PHASE_COUNTS },
      autoFilledPhases: { ...INITIAL_AUTO_FILLED },
      isIkigaiComplete: false
    }, () => this.sendCoachMessage('START_SESSION'));
  };

  private handleWhyProfileSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({ selectedWhyProfileId: e.target.value || null });
  };

  private handleIkigaiProfileSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({ selectedIkigaiProfileId: e.target.value || null });
  };

  private handleSaveIkigaiProfile = async () => {
    const { phaseStorage, profileName, selectedWhyProfileId, whyProfiles, autoFilledPhases, isLoading } = this.state;
    
    // Prevent double-clicks
    if (isLoading) return;
    
    if (!this.aiService) {
      this.setState({ error: 'Service not initialized. Please refresh the page.' });
      return;
    }
    
    if (!profileName.trim()) {
      this.setState({ error: 'Please enter a name for your Ikigai profile' });
      return;
    }
    
    // Set loading immediately to disable button
    this.setState({ isLoading: true, error: '' });
    
    const whyProfile = selectedWhyProfileId ? whyProfiles.find(p => p.id === selectedWhyProfileId) : null;
    
    try {
      console.log('Saving lean Ikigai profile:', profileName.trim());
      
      // Extract key patterns from all phases
      const keyPatterns = this.extractKeyPatterns(phaseStorage);
      
      // Create LEAN profile - no conversation archive, just summaries
      const profile: IkigaiProfileCreate = {
        name: profileName.trim(),
        sourceWhyProfileId: selectedWhyProfileId || undefined,
        whyStatement: whyProfile?.whyStatement || '',
        love: {
          bullets: (phaseStorage.phase1?.love.bullets || whyProfile?.whatYouLove || []).slice(0, 5),
          summary: (phaseStorage.phase1?.love.summary || '').substring(0, 200)
        },
        goodAt: {
          bullets: (phaseStorage.phase2?.goodAt.bullets || whyProfile?.whatYouAreGoodAt || []).slice(0, 5),
          summary: (phaseStorage.phase2?.goodAt.summary || '').substring(0, 200)
        },
        worldNeeds: {
          bullets: (phaseStorage.phase3?.worldNeeds.bullets || []).slice(0, 5),
          summary: (phaseStorage.phase3?.worldNeeds.summary || '').substring(0, 200)
        },
        paidFor: {
          bullets: (phaseStorage.phase4?.paidFor.bullets || []).slice(0, 5),
          summary: (phaseStorage.phase4?.paidFor.summary || '').substring(0, 200)
        },
        overlaps: {
          passion: { 
            bullets: (phaseStorage.overlaps?.passion.bullets || []).slice(0, 3), 
            summary: (phaseStorage.overlaps?.passion.summary || '').substring(0, 200) 
          },
          mission: { 
            bullets: (phaseStorage.overlaps?.mission.bullets || []).slice(0, 3), 
            summary: (phaseStorage.overlaps?.mission.summary || '').substring(0, 200) 
          },
          profession: { 
            bullets: (phaseStorage.overlaps?.profession.bullets || []).slice(0, 3), 
            summary: (phaseStorage.overlaps?.profession.summary || '').substring(0, 200) 
          },
          vocation: { 
            bullets: (phaseStorage.overlaps?.vocation.bullets || []).slice(0, 3), 
            summary: (phaseStorage.overlaps?.vocation.summary || '').substring(0, 200) 
          }
        },
        keyPatterns: keyPatterns.slice(0, 5),
        autoFilledPhases: autoFilledPhases
      };
      
      const savedProfile = await this.aiService.createIkigaiProfile(profile);
      
      if (savedProfile) {
        console.log('Ikigai profile saved successfully:', savedProfile.id);
        const ikigaiProfiles = await this.aiService.loadIkigaiProfiles();
        
        const confirmMsg: ChatMessage = {
          id: generateId('msg'),
          sender: 'coach',
          content: `✅ **Profile "${savedProfile.name}" saved!**\n\nYou can now use the **Decision Helper** to think through decisions!\n\nSelect your profile from the dropdown and click "Decision Helper" to get started.`,
          timestamp: new Date().toISOString(),
          phase: 'complete',
          mode: 'ikigai_builder'
        };
        
        // Clear temp state after successful save
        await this.clearTempState();
        
        this.setState({
          ikigaiProfiles,
          selectedIkigaiProfileId: savedProfile.id,
          phaseStorage: createEmptyPhaseStorage(),
          isIkigaiComplete: false,
          profileName: '',
          messages: [...this.state.messages, confirmMsg],
          isLoading: false,
          error: ''
        });
      } else {
        throw new Error('Profile was not returned after save');
      }
    } catch (error) {
      console.error('Error saving Ikigai profile:', error);
      this.setState({ 
        error: `Failed to save Ikigai profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isLoading: false 
      });
    }
  };
  
  // Helper: Extract key patterns from phase storage
  private extractKeyPatterns(storage: PhaseStorageData): string[] {
    const patterns: string[] = [];
    
    // Collect key insights from each phase
    if (storage.phase1?.keyInsights) patterns.push(...storage.phase1.keyInsights);
    if (storage.phase2?.keyInsights) patterns.push(...storage.phase2.keyInsights);
    if (storage.phase3?.keyInsights) patterns.push(...storage.phase3.keyInsights);
    if (storage.phase4?.keyInsights) patterns.push(...storage.phase4.keyInsights);
    
    // Deduplicate and limit
    return [...new Set(patterns)].slice(0, 5);
  }

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  private handleSendMessage = () => {
    const { inputText, isLoading } = this.state;
    if (!inputText.trim() || isLoading) return;
    this.sendCoachMessage(inputText.trim());
  };

  private handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.handleSendMessage();
    }
  };

  private handleStopGeneration = () => {
    if (this.abortController) this.abortController.abort();
  };

  private handleModelSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = this.state.models.find(m => m.name === e.target.value);
    if (model) this.setState({ selectedModel: model });
  };

  private dismissError = () => this.setState({ error: '' });

  // ===========================================================================
  // RENDER METHODS
  // ===========================================================================

  private renderPhaseTracker() {
    const { sessionMode, whyFinderExchangeCount, currentIkigaiPhase, autoFilledPhases, phaseAnswerCounts } = this.state;
    
    if (sessionMode === 'why_finder') {
      const dots = [];
      for (let i = 0; i < WHY_FINDER_TOTAL_EXCHANGES; i++) {
        const isComplete = i < whyFinderExchangeCount;
        const isCurrent = i === whyFinderExchangeCount;
        dots.push(
          <div key={i} className={`phase-dot ${isComplete ? 'complete' : ''} ${isCurrent ? 'current' : ''}`} title={`Exchange ${i + 1}/${WHY_FINDER_TOTAL_EXCHANGES}`} />
        );
      }
      return (
        <div className="phase-tracker why-finder-tracker">
          <span className="tracker-label">Progress:</span>
          <div className="phase-dots">{dots}</div>
          <span className="tracker-count">{whyFinderExchangeCount}/{WHY_FINDER_TOTAL_EXCHANGES}</span>
        </div>
      );
    }
    
    if (sessionMode === 'ikigai_builder') {
      const phaseIndex = IKIGAI_PHASE_ORDER.indexOf(currentIkigaiPhase);
      
      // 4 dots for 4 phases
      const dots = IKIGAI_PHASE_ORDER.slice(0, 4).map((phase, i) => {
        const isComplete = i < phaseIndex || currentIkigaiPhase === 'complete';
        const isCurrent = phase === currentIkigaiPhase;
        const wasAutoFilled = (phase === 'phase1_love' && autoFilledPhases.phase1_love) || 
                             (phase === 'phase2_good_at' && autoFilledPhases.phase2_good_at);
        
        let count = 0;
        let max = MIN_ANSWERS_PER_PHASE;
        if (phase === 'phase1_love') count = phaseAnswerCounts.love;
        else if (phase === 'phase2_good_at') count = phaseAnswerCounts.goodAt;
        else if (phase === 'phase3_world') count = phaseAnswerCounts.worldNeeds;
        else if (phase === 'phase4_paid') count = phaseAnswerCounts.paidFor;
        
        return (
          <div 
            key={phase} 
            className={`phase-dot ikigai ${isComplete ? 'complete' : ''} ${isCurrent ? 'current' : ''} ${wasAutoFilled ? 'auto-filled' : ''}`}
            title={`${IKIGAI_PHASE_LABELS[phase]}${wasAutoFilled ? ' (Auto-filled)' : ''} (${count}/${max})`}
          />
        );
      });
      
      // Current counts
      let currentCount = 0;
      if (currentIkigaiPhase === 'phase1_love') currentCount = phaseAnswerCounts.love;
      else if (currentIkigaiPhase === 'phase2_good_at') currentCount = phaseAnswerCounts.goodAt;
      else if (currentIkigaiPhase === 'phase3_world') currentCount = phaseAnswerCounts.worldNeeds;
      else if (currentIkigaiPhase === 'phase4_paid') currentCount = phaseAnswerCounts.paidFor;
      
      return (
        <div className="phase-tracker ikigai-tracker">
          <span className="tracker-label">Phase:</span>
          <div className="phase-dots">{dots}</div>
          <span className="tracker-phase-name">
            {currentIkigaiPhase === 'complete' ? '✓ Complete' : `${IKIGAI_PHASE_LABELS[currentIkigaiPhase]} (${currentCount}/${MIN_ANSWERS_PER_PHASE})`}
          </span>
        </div>
      );
    }
    
    return null;
  }

  private renderHeader() {
    const { models, selectedModel, isLoadingModels, sessionMode, whyProfiles, selectedWhyProfileId, ikigaiProfiles, selectedIkigaiProfileId } = this.state;

    const getModeTitle = () => {
      switch (sessionMode) {
        case 'why_finder': return '🧭 Why Discovery';
        case 'ikigai_builder': return '🎯 Ikigai Builder';
        case 'decision_helper': return '🤔 Decision Helper';
        default: return '🧭 Why Discovery';
      }
    };

    return (
      <div className="why-header">
        <div className="header-left">
          <span className="header-title">{getModeTitle()}</span>
          {sessionMode !== 'why_finder' && (
            <button className="btn-back" onClick={this.handleBackToWhyFinder} title="Start new Why Discovery">← New</button>
          )}
        </div>

        <div className="header-center">
          {/* Why Profile Selector */}
          <select 
            className="profile-select"
            value={selectedWhyProfileId || ''}
            onChange={this.handleWhyProfileSelect}
            title="Select Why Profile for Ikigai Builder"
          >
            <option value="">Select Why Profile...</option>
            {whyProfiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (L:{p.whatYouLove.length}/G:{p.whatYouAreGoodAt.length})
              </option>
            ))}
          </select>

          {/* Ikigai Profile Selector */}
          <select
            className="profile-select"
            value={selectedIkigaiProfileId || ''}
            onChange={this.handleIkigaiProfileSelect}
            title="Select Ikigai Profile for Decision Helper"
          >
            <option value="">Select Ikigai Profile...</option>
            {ikigaiProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.name} {p.isComplete ? '✓' : ''}</option>
            ))}
          </select>

          {/* Ikigai Builder Button - DISABLED if no Why profiles */}
          <button
            className="btn-ikigai-builder themed"
            onClick={this.handleStartIkigaiBuilder}
            disabled={whyProfiles.length === 0 || sessionMode === 'ikigai_builder'}
            title={whyProfiles.length === 0 ? 'Complete a Why Discovery first' : 'Start Ikigai Builder'}
          >
            🎯 Ikigai
          </button>

          {/* Decision Helper Button */}
          <button
            className="btn-decision-helper"
            onClick={this.handleStartDecisionHelper}
            disabled={ikigaiProfiles.length === 0 || !selectedIkigaiProfileId}
            title={ikigaiProfiles.length === 0 ? 'Create an Ikigai profile first' : 'Start Decision Helper'}
          >
            Decision Helper
          </button>
        </div>

        <div className="header-right">
          <select className="model-select" value={selectedModel?.name || ''} onChange={this.handleModelSelect} disabled={isLoadingModels}>
            {models.map(m => (<option key={m.name} value={m.name}>{m.name}</option>))}
          </select>
        </div>
      </div>
    );
  }

  private renderMessages() {
    const { messages, showBuildIkigaiPrompt, showSaveWhyPrompt, currentIkigaiPhase, isIkigaiComplete, profileName, whyProfileName, isLoading } = this.state;

    return (
      <div className="why-chat">
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.sender}`}>
            <div className={`message-bubble ${msg.isStreaming ? 'streaming' : ''}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              {msg.isStreaming && <span className="typing-cursor">▋</span>}
            </div>
          </div>
        ))}
        
        {showSaveWhyPrompt && (
          <div className="profile-save-container">
            <div className="profile-save-card themed">
              <h4>💾 Save Your Why Profile</h4>
              <ReactMarkdown>{WHY_COMPLETE_SAVE_PROMPT}</ReactMarkdown>
              <div className="profile-save-form">
                <input 
                  type="text" 
                  className="profile-name-input" 
                  placeholder="e.g., My Why 2025..." 
                  value={whyProfileName} 
                  onChange={e => this.setState({ whyProfileName: e.target.value })}
                  disabled={isLoading}
                />
                <button 
                  className="btn-save-profile themed" 
                  onClick={this.handleSaveWhyProfile} 
                  disabled={!whyProfileName.trim() || isLoading}
                >
                  {isLoading ? '⏳ Saving...' : 'Save Why Profile'}
                </button>
                <button className="btn-skip" onClick={this.handleSkipSaveWhy} disabled={isLoading}>Skip</button>
              </div>
            </div>
          </div>
        )}
        
        {showBuildIkigaiPrompt && (
          <div className="ikigai-prompt-container">
            <div className="ikigai-prompt themed">
              <p>Ready to build your Ikigai profile?</p>
              <button className="btn-build-ikigai themed" onClick={this.handleStartIkigaiBuilder} disabled={this.state.whyProfiles.length === 0}>
                🎯 Build Ikigai Profile
              </button>
            </div>
          </div>
        )}
        
        {isIkigaiComplete && currentIkigaiPhase === 'complete' && (
          <div className="profile-save-container">
            <div className="profile-save-card themed">
              <h4>💾 Save Your Ikigai Profile</h4>
              <p>Save your profile to use Decision Helper.</p>
              <div className="profile-save-form">
                <input 
                  type="text" 
                  className="profile-name-input" 
                  placeholder="e.g., Career 2025..." 
                  value={profileName} 
                  onChange={e => this.setState({ profileName: e.target.value })}
                  disabled={isLoading}
                />
                <button 
                  className="btn-save-profile themed" 
                  onClick={this.handleSaveIkigaiProfile} 
                  disabled={!profileName.trim() || isLoading}
                >
                  {isLoading ? '⏳ Saving...' : 'Save Ikigai Profile'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div ref={this.chatEndRef} />
      </div>
    );
  }

  private renderInput() {
    const { inputText, isLoading, isStreaming, currentPhase, sessionMode, isIkigaiComplete, showSaveWhyPrompt, currentIkigaiPhase, phaseAnswerCounts } = this.state;

    const isWhyFinderComplete = sessionMode === 'why_finder' && currentPhase === 'completed';
    const shouldHideInput = (isWhyFinderComplete && !showSaveWhyPrompt) || isIkigaiComplete;

    if (shouldHideInput) {
      return (
        <div className="why-input">
          <div className="session-complete">
            <span>✅ {sessionMode === 'why_finder' ? 'Why Discovery Complete!' : 'Ikigai Profile Ready!'}</span>
          </div>
        </div>
      );
    }

    // Get current phase answer count
    let currentCount = 0;
    if (currentIkigaiPhase === 'phase1_love') currentCount = phaseAnswerCounts.love;
    else if (currentIkigaiPhase === 'phase2_good_at') currentCount = phaseAnswerCounts.goodAt;
    else if (currentIkigaiPhase === 'phase3_world') currentCount = phaseAnswerCounts.worldNeeds;
    else if (currentIkigaiPhase === 'phase4_paid') currentCount = phaseAnswerCounts.paidFor;

    return (
      <div className="why-input">
        <div className="input-wrapper">
          <textarea
            ref={this.inputRef}
            className="input-textarea"
            value={inputText}
            onChange={e => this.setState({ inputText: e.target.value })}
            onKeyPress={this.handleKeyPress}
            placeholder={this.getInputPlaceholder()}
            disabled={isLoading || showSaveWhyPrompt}
            rows={1}
          />
        </div>
        
        {isStreaming ? (
          <button className="btn-stop" onClick={this.handleStopGeneration}>■</button>
        ) : (
          <button className="btn-send" onClick={this.handleSendMessage} disabled={!inputText.trim() || isLoading || showSaveWhyPrompt}>➤</button>
        )}
      </div>
    );
  }

  private getInputPlaceholder(): string {
    const { sessionMode, currentIkigaiPhase, whyFinderExchangeCount, phaseAnswerCounts } = this.state;
    
    switch (sessionMode) {
      case 'why_finder':
        return `Exchange ${whyFinderExchangeCount + 1}/${WHY_FINDER_TOTAL_EXCHANGES} - Share your thoughts...`;
      case 'ikigai_builder':
        let count = 0;
        if (currentIkigaiPhase === 'phase1_love') count = phaseAnswerCounts.love;
        else if (currentIkigaiPhase === 'phase2_good_at') count = phaseAnswerCounts.goodAt;
        else if (currentIkigaiPhase === 'phase3_world') count = phaseAnswerCounts.worldNeeds;
        else if (currentIkigaiPhase === 'phase4_paid') count = phaseAnswerCounts.paidFor;
        return `${IKIGAI_PHASE_LABELS[currentIkigaiPhase]} (${count}/${MIN_ANSWERS_PER_PHASE}) - Share your answer...`;
      case 'decision_helper':
        return 'What decision are you thinking through?';
      default:
        return 'Share your thoughts...';
    }
  }

  render() {
    const { currentTheme, isInitializing, isLoadingModels, error, models } = this.state;
    const isLoading = isInitializing || isLoadingModels;
    const noModels = !isLoading && models.length === 0;

    return (
      <div className={`why-detector ${currentTheme === 'dark' ? 'dark-theme' : ''}`}>
        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button className="error-dismiss" onClick={this.dismissError}>×</button>
          </div>
        )}

        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Loading models...</p>
          </div>
        ) : noModels ? (
          <div className="loading-container">
            <p>⚠️ No AI models available. Please configure a model provider in Settings.</p>
          </div>
        ) : (
          <div className="why-session">
            {this.renderHeader()}
            {this.renderPhaseTracker()}
            {this.renderMessages()}
            {this.renderInput()}
          </div>
        )}
      </div>
    );
  }
}

export default BrainDriveWhyDetector;
