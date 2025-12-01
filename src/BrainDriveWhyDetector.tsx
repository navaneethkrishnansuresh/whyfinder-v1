/**
 * BrainDriveWhyDetector
 * Find Your Why - Multi-agent coaching flow
 * UI styled to match BrainDriveChat
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
  generateId
} from './types';

/**
 * Strip questions from Why response - Why should not have questions
 */
function stripQuestionsFromWhy(response: string): string {
  if (!response) return response;
  
  // Only process if this is a Why response
  if (!/YOUR WHY IS:/i.test(response)) {
    return response;
  }
  
  // Remove any sentences ending with ?
  // Split by sentences, filter out questions, rejoin
  const sentences = response.split(/(?<=[.!?])\s+/);
  const nonQuestions = sentences.filter(s => !s.trim().endsWith('?'));
  
  return nonQuestions.join(' ').trim();
}
import { AIService } from './services';
import { INITIAL_GREETING } from './prompts';

// Initial session data
const INITIAL_SESSION_DATA: SessionData = {
  energizers: [],
  drainers: [],
  stories: [],
  whyStatement: ''
};


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
      selectedModel: null,
      models: [],
      isLoadingModels: true,
      isStreaming: false,
      isInitializing: true,
      sessionStarted: false,
      currentPhase: 'intro',
      sessionData: { ...INITIAL_SESSION_DATA }
    };
  }

  async componentDidMount() {
    this.aiService = new AIService(this.props.services);
    this.initializeTheme();
    await this.loadModels();
    
    // Auto-start session immediately (no welcome screen)
    this.setState({ isInitializing: false }, () => {
      this.autoStartSession();
    });
  }

  private autoStartSession = async () => {
    const { models } = this.state;
    
    if (models.length > 0) {
      this.setState({
        sessionStarted: true,
        selectedModel: models[0],
        currentPhase: 'intro',
        messages: [],
        sessionData: { ...INITIAL_SESSION_DATA }
      }, () => {
        // Send initial greeting
        this.sendCoachMessage('START_SESSION');
      });
    }
  };

  componentWillUnmount() {
    if (this.themeChangeListener && this.props.services?.theme) {
      this.props.services.theme.removeThemeChangeListener(this.themeChangeListener);
    }
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  componentDidUpdate(_prevProps: BrainDriveWhyDetectorProps, prevState: BrainDriveWhyDetectorState) {
    if (this.state.messages.length !== prevState.messages.length) {
      this.scrollToBottom();
    }
  }

  private initializeTheme() {
    if (this.props.services?.theme) {
      const theme = this.props.services.theme.getCurrentTheme();
      this.setState({ currentTheme: theme });
      
      this.themeChangeListener = (newTheme: string) => {
        this.setState({ currentTheme: newTheme });
      };
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
      this.setState({
        isLoadingModels: false,
        error: 'Failed to load AI models'
      });
    }
  }

  private scrollToBottom() {
    this.chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  private sendCoachMessage = async (userMessage: string) => {
    const { selectedModel, currentPhase, sessionData, messages } = this.state;
    
    if (!this.aiService || !selectedModel) {
      this.setState({ error: 'No model selected' });
      return;
    }

    // Add user message (if not a special command)
    const isSpecialCommand = userMessage === 'START_SESSION';
    
    if (!isSpecialCommand) {
      const userMsg: ChatMessage = {
        id: generateId('msg'),
        sender: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
        phase: currentPhase
      };
      this.setState(prev => ({ messages: [...prev.messages, userMsg] }));
    }

    // Create coach message placeholder
    const coachMsgId = generateId('msg');
    const coachMsg: ChatMessage = {
      id: coachMsgId,
      sender: 'coach',
      content: userMessage === 'START_SESSION' ? INITIAL_GREETING : '',
      timestamp: new Date().toISOString(),
      isStreaming: userMessage !== 'START_SESSION',
      phase: currentPhase
    };

    this.setState(prev => ({
      messages: [...prev.messages, coachMsg],
      isLoading: true,
      isStreaming: userMessage !== 'START_SESSION',
      inputText: ''
    }));

    // If START_SESSION, just show greeting
    if (userMessage === 'START_SESSION') {
      this.setState({ isLoading: false });
      return;
    }

    // Send to AI
    this.abortController = new AbortController();

    try {
      // Build full context - no compression, send everything
      const context = this.aiService.buildContext(messages);

      await this.aiService.sendToCoach(
        userMessage,
        currentPhase,
        sessionData,
        context,
        selectedModel,
        (chunk: string) => {
          // Stream chunks as-is (no cleaning during streaming)
          this.setState(prev => ({
            messages: prev.messages.map(m =>
              m.id === coachMsgId ? { ...m, content: m.content + chunk } : m
            )
          }));
        },
        this.abortController
      );

      // Finalize and check for Why statement
      this.setState(prev => {
        const coachMessage = prev.messages.find(m => m.id === coachMsgId);
        const hasWhyStatement = coachMessage?.content && /YOUR WHY IS:/i.test(coachMessage.content);
        
        // Only mark complete if Why statement was delivered
        const newPhase = hasWhyStatement ? 'completed' : prev.currentPhase;
        
        return {
          messages: prev.messages.map(m => {
            if (m.id === coachMsgId) {
              // If Why detected, strip any questions
              const cleanedContent = hasWhyStatement 
                ? stripQuestionsFromWhy(m.content) 
                : m.content;
              return { ...m, content: cleanedContent, isStreaming: false };
            }
            return m;
          }),
          currentPhase: newPhase,
          isLoading: false,
          isStreaming: false
        };
      });

      // Only analyze phase if not completed
      const { currentPhase: finalPhase } = this.state;
      if (finalPhase !== 'completed') {
        this.analyzeAndUpdatePhase(userMessage);
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.setState(prev => ({
          messages: prev.messages.map(m =>
            m.id === coachMsgId ? { ...m, isStreaming: false, content: m.content + ' [Stopped]' } : m
          ),
          isLoading: false,
          isStreaming: false
        }));
      } else {
        this.setState({
          error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isLoading: false,
          isStreaming: false
        });
      }
    }
  };

  private analyzeAndUpdatePhase(userMessage: string) {
    const { currentPhase, sessionData, messages } = this.state;
    
    // Count total user messages and messages in current phase
    const totalUserMessages = messages.filter(m => m.sender === 'user').length;
    const userMessagesInPhase = messages.filter(m => m.phase === currentPhase && m.sender === 'user').length;
    
    let newPhase = currentPhase;
    let newSessionData = { ...sessionData };

    // Extract meaningful data from user responses
    if (userMessage.length > 30) {
      if (currentPhase === 'energy_map') {
        if (newSessionData.energizers.length < 3) {
          newSessionData.energizers = [...sessionData.energizers, userMessage.substring(0, 150)];
        } else if (newSessionData.drainers.length < 3) {
          newSessionData.drainers = [...sessionData.drainers, userMessage.substring(0, 150)];
        }
      }

      if (currentPhase === 'stories') {
        newSessionData.stories = [...sessionData.stories, userMessage.substring(0, 200)];
      }
    }

    // Phase transitions with quality gates
    // Minimum exchanges per phase to ensure depth
    const MIN_INTRO = 3;
    const MIN_ENERGY = 4;
    const MIN_STORIES = 3;
    const MIN_TOTAL_FOR_WHY = 10;  // Must have at least 10 total exchanges before Why phase
    
    if (currentPhase === 'intro' && userMessagesInPhase >= MIN_INTRO) {
      newPhase = 'energy_map';
    } else if (currentPhase === 'energy_map' && userMessagesInPhase >= MIN_ENERGY) {
      newPhase = 'stories';
    } else if (currentPhase === 'stories' && userMessagesInPhase >= MIN_STORIES && totalUserMessages >= MIN_TOTAL_FOR_WHY) {
      // Only move to your_why if we have enough total exchanges
      newPhase = 'your_why';
    } else if (currentPhase === 'your_why' && userMessagesInPhase >= 3) {
      newPhase = 'completed';
    }

    if (newPhase !== currentPhase || JSON.stringify(newSessionData) !== JSON.stringify(sessionData)) {
      console.log(`Phase transition: ${currentPhase} -> ${newPhase}`);
      this.setState({ currentPhase: newPhase, sessionData: newSessionData });
    }
  }

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
    if (this.abortController) {
      this.abortController.abort();
    }
  };

  private handleModelSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = this.state.models.find(m => m.name === e.target.value);
    if (model) {
      this.setState({ selectedModel: model });
    }
  };

  private dismissError = () => {
    this.setState({ error: '' });
  };

  private handleNewSession = () => {
    this.setState({
      messages: [],
      currentPhase: 'intro',
      sessionData: { ...INITIAL_SESSION_DATA }
    }, () => {
      this.sendCoachMessage('START_SESSION');
    });
  };

  // ============================================================================
  // RENDER METHODS
  // ============================================================================

  private renderHeader() {
    const { models, selectedModel, isLoadingModels } = this.state;

    return (
      <div className="why-header">
        <div className="header-left">
          <span className="header-title">🧭 Why Discovery</span>
        </div>

        <div className="header-right">
          <select 
            className="model-select"
            value={selectedModel?.name || ''}
            onChange={this.handleModelSelect}
            disabled={isLoadingModels}
          >
            {models.map(m => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  private renderMessages() {
    const { messages, isStreaming } = this.state;

    return (
      <div className="why-chat">
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.sender}`}>
            <div className={`message-bubble ${msg.isStreaming ? 'streaming' : ''}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.content}
              </ReactMarkdown>
              {msg.isStreaming && <span className="typing-cursor">▋</span>}
            </div>
          </div>
        ))}
        <div ref={this.chatEndRef} />
      </div>
    );
  }

  private renderInput() {
    const { inputText, isLoading, isStreaming, currentPhase } = this.state;
    const isCompleted = currentPhase === 'completed';

    if (isCompleted) {
      return (
        <div className="why-input">
          <div className="session-complete">
            <span>✅ Session Complete</span>
            <button className="btn-secondary" onClick={this.handleNewSession}>
              Start New Session
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="why-input">
        <div className="input-wrapper">
          <textarea
            ref={this.inputRef}
            className="input-textarea"
            value={inputText}
            onChange={e => this.setState({ inputText: e.target.value })}
            onKeyPress={this.handleKeyPress}
            placeholder="Share your thoughts..."
            disabled={isLoading}
            rows={1}
          />
        </div>
        
        {isStreaming ? (
          <button className="btn-stop" onClick={this.handleStopGeneration}>■</button>
        ) : (
          <button 
            className="btn-send" 
            onClick={this.handleSendMessage}
            disabled={!inputText.trim() || isLoading}
          >
            ➤
          </button>
        )}
      </div>
    );
  }

  // Session summary is now handled by the AI's final message
  // No need for a separate raw data dump

  render() {
    const { currentTheme, isInitializing, isLoadingModels, error, sessionStarted, models } = this.state;
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
            {this.renderMessages()}
            {this.renderInput()}
          </div>
        )}
      </div>
    );
  }
}

export default BrainDriveWhyDetector;
