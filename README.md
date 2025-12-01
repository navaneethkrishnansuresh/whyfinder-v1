# BrainDrive WhyDetector Plugin

A guided AI coaching experience to help users discover their personal "Why" - their core purpose and what truly drives them.

## Overview

This plugin implements a multi-phase coaching flow based on Simon Sinek's "Find Your Why" methodology. It uses BrainDrive's AI providers (Ollama, Anthropic, OpenAI, OpenRouter) to guide users through structured self-reflection.

## Changes Made from Plugin Template

This plugin was built from scratch following BrainDrive plugin patterns. Key files created:

### Source Files (`src/`)

| File | Purpose |
|------|---------|
| `index.tsx` | Module Federation entry point |
| `BrainDriveWhyDetector.tsx` | Main React component (600+ lines) |
| `BrainDriveWhyDetector.css` | Modern styling with light/dark theme support |
| `types.ts` | TypeScript interfaces and type definitions |
| `prompts.ts` | AI system prompts for Coach and Quality Checker agents |
| `services/aiService.ts` | AI provider communication service |
| `services/index.ts` | Service exports |

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | NPM dependencies and scripts |
| `webpack.config.js` | Module Federation configuration |
| `tsconfig.json` | TypeScript compiler settings |
| `lifecycle_manager.py` | BrainDrive plugin installation handler |

## System Prompts

### Coach Agent Prompt

The Coach agent uses a phase-aware system prompt that:

1. **Sets personality**: Warm, curious, patient - not clinical or interrogative
2. **Follows [Acknowledge] + [Build] + [Question] rhythm**:
   - Acknowledge what user said
   - Build with insight or connection
   - Ask a deeper follow-up question
3. **Phase-specific guidance**: Each phase has different goals and requirements
4. **Session data context**: Includes collected energizers, drainers, stories, patterns

### Quality Checker Agent Prompt

The Quality Checker audits coaching quality and returns structured JSON:

```json
{
  "passed": boolean,
  "score": number (0-100),
  "issues": [
    {
      "type": "depth|warmth|synthesis|coverage|pacing",
      "severity": "high|medium|low",
      "description": "specific issue",
      "suggestion": "how to fix"
    }
  ],
  "recommendations": ["list of suggestions"],
  "readyToTransition": boolean
}
```

## Guardrails

### Technical Guardrails

1. **JSON validation for checker**: Strict parsing with regex extraction
2. **Phase constraints**: Cannot transition until requirements met
3. **Length control**: Max 1024 tokens per coach response
4. **Error handling**: Graceful failures with user-friendly messages

### Safety Guardrails

1. **Crisis detection**: Keywords like "suicide", "self harm", etc. trigger safe response
2. **Crisis response**: Provides mental health resources, pauses coaching
3. **Disclaimer**: Clear statement that this is not therapy
4. **Tone rules**: No diagnosing, no medical language

## Session Phases

| Phase | Description | Requirements |
|-------|-------------|--------------|
| `intro` | Welcome and framing | 2 messages |
| `snapshot` | Current situation overview | 4 messages, role identified |
| `energy_map` | Energizers and drainers | 3+ energizers, 3+ drainers |
| `deep_stories` | Narrative exploration | 2+ stories with emotional depth |
| `patterns` | Pattern recognition | 1+ confirmed pattern |
| `statement` | Why statement drafting | Statement created |
| `action` | Action planning | 2+ action items |
| `completed` | Session summary | - |

## Data Structures

### SessionData

```typescript
interface SessionData {
  snapshot: PersonalSnapshot | null;
  energizers: EnergyItem[];
  drainers: EnergyItem[];
  stories: Story[];
  patterns: Pattern[];
  themes: string[];
  whyStatement: string;
  whyDrafts: string[];
  actionItems: ActionItem[];
}
```

### EnergyItem

```typescript
interface EnergyItem {
  id: string;
  description: string;
  type: 'energizer' | 'drainer';
  rootCause?: string;
  followUps: string[];
  depth: number;
}
```

## How It Works

### User Flow

1. User opens plugin → Welcome screen with journey overview
2. Clicks "Start My Why Session" → Model selected, session begins
3. Coach sends initial greeting with framing
4. User answers questions through each phase
5. Coach guides with [Acknowledge] + [Build] + [Question]
6. Phase transitions happen automatically when requirements met
7. Session completes with summary of findings

### AI Communication

1. Uses BrainDrive's `/api/v1/ai/providers/chat` endpoint
2. Supports streaming responses via `postStreaming`
3. Falls back to non-streaming if unavailable
4. Model selection from all available providers

### State Management

- Session data persisted via `pluginState` service bridge
- Messages stored in component state
- Phase transitions tracked with message counts
- Auto-restore on page refresh

## Known Limitations

1. **Model quality**: Small models (<7B) may miss instructions
2. **JSON from checker**: May fail with less capable models
3. **Session restore**: Only restores latest incomplete session
4. **No cross-device sync**: Sessions stored locally

## Future Enhancements

- [ ] AI Memory integration for cross-session history
- [ ] Export session as PDF/markdown
- [ ] Multi-model support (different models for coach/checker)
- [ ] Session history browser
- [ ] Event Bridge integration for cross-plugin communication

## License

MIT License - Part of BrainDrive open source ecosystem.

## Credits

- Based on Simon Sinek's "Find Your Why" methodology
- Built for BrainDrive community
- Uses BrainDrive Plugin Template patterns


