/**
 * BrainDriveWhyDetector System Prompts
 * Prompts are stored in separate .txt files in /prompts folder for readability
 * This file loads and assembles them for use
 */

import { SessionPhase, SessionData } from './types';

// Import prompt files as raw text
// @ts-ignore - webpack raw-loader
import BASE_PROMPT from './prompts/base.txt';
// @ts-ignore
import PHASE_INTRO from './prompts/phase_intro.txt';
// @ts-ignore
import PHASE_ENERGY from './prompts/phase_energy.txt';
// @ts-ignore
import PHASE_STORIES from './prompts/phase_stories.txt';
// @ts-ignore
import PHASE_YOUR_WHY from './prompts/phase_your_why.txt';

// ============================================================================
// EXPORTS
// ============================================================================

export const INITIAL_GREETING = `Hey! I am here to help you discover your Why, your core purpose.

We will have a quick conversation about what energizes you, what drains you, and find patterns that reveal what matters to you.

So tell me, what do you do right now, and what made you curious about finding your why?`;

export const CRISIS_RESPONSE = `Hey, it sounds like you are going through something really heavy right now.

I am just a coaching tool for self-discovery. I am not equipped to help with what you are describing.

Please reach out to someone who can actually support you:
- 988 (call or text) in the US, Suicide and Crisis Lifeline
- Crisis Text Line, text HOME to 741741

You matter. Take care of yourself first. I will be here when you are ready.`;

// ============================================================================
// MAIN COACH PROMPT BUILDER
// ============================================================================

export function getCoachSystemPrompt(
  phase: SessionPhase,
  sessionData: SessionData,
  conversationHistory: { role: string; content: string }[]
): string {
  return buildCoachPrompt(phase, sessionData, conversationHistory);
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

// Minimum requirements before allowing conclusion
const MIN_EXCHANGES = 10;  // At least 10 back-and-forth exchanges
const MIN_FOR_WHY_PHASE = 10;  // At least 10 exchanges before proposing Why

function buildCoachPrompt(
  phase: SessionPhase,
  sessionData: SessionData,
  conversationHistory: { role: string; content: string }[]
): string {
  
  // Phase instructions
  const phaseInstructions = getPhaseInstructions(phase);
  
  // Count exchanges
  const exchangeCount = conversationHistory.filter(m => m.role === 'user').length;
  
  // Quality check - is there enough information?
  const hasEnoughExchanges = exchangeCount >= MIN_EXCHANGES;
  const readyForWhy = exchangeCount >= MIN_FOR_WHY_PHASE;
  
  // Check if user just confirmed (said yes, that's it, etc.)
  const lastUserMessage = conversationHistory.filter(m => m.role === 'user').pop()?.content?.toLowerCase() || '';
  const confirmationWords = ['yes', 'yeah', 'yep', 'that\'s it', 'thats it', 'feels right', 'that works', 'perfect', 'exactly', 'correct'];
  const userJustConfirmed = phase === 'your_why' && confirmationWords.some(word => lastUserMessage.includes(word)) && lastUserMessage.length < 50;

  // Build prompt
  let prompt = `${BASE_PROMPT}

CURRENT PHASE: ${phase.toUpperCase()}
${phaseInstructions}

CONVERSATION STATUS:
- Exchanges so far: ${exchangeCount}
- Minimum needed: ${MIN_EXCHANGES}
- Ready to conclude: ${readyForWhy ? 'YES' : 'NO - NEED MORE CONVERSATION'}`;

  // Quality gate - prevent early conclusions
  if (phase === 'your_why' && !readyForWhy) {
    prompt += `

*** QUALITY CHECK: NOT READY ***
You only have ${exchangeCount} exchanges. You need at least ${MIN_FOR_WHY_PHASE}.
DO NOT propose a Why statement yet.
Keep asking questions to understand them better.
Ask about:
- Specific moments that mattered to them
- What made those moments meaningful
- What they want their work to feel like`;
  }

  // If user just confirmed AND we have enough data
  if (userJustConfirmed && readyForWhy) {
    prompt += `

*** USER CONFIRMED - DELIVER FINAL WHY ***
The user said "${lastUserMessage}" - they accept the Why statement.
YOU MUST NOW:
1. Say "YOUR WHY IS: [the Why statement you proposed]"
2. Thank them warmly
3. Reference 1-2 specific things they shared
4. Do NOT ask another question
5. This is the END`;
  } else if (userJustConfirmed && !readyForWhy) {
    prompt += `

*** USER SAID YES BUT NOT ENOUGH DATA ***
The user seems to agree, but you only have ${exchangeCount} exchanges.
Say: "I appreciate that resonates, but I want to make sure we capture the full picture. Let me ask one more thing..."
Then ask another question.`;
  }

  return prompt;
}

function getPhaseInstructions(phase: SessionPhase): string {
  switch (phase) {
    case 'intro':
      return PHASE_INTRO;
    case 'energy_map':
      return PHASE_ENERGY;
    case 'stories':
      return PHASE_STORIES;
    case 'your_why':
      return PHASE_YOUR_WHY;
    case 'completed':
      return 'Session complete. Their Why has been found. Celebrate briefly.';
    default:
      return '';
  }
}

// SessionData is now captured via memory compression, not raw data dump
