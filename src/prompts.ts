/**
 * BrainDriveWhyDetector System Prompts
 * With 4 Ikigai phases and proper enforcement
 */

import { 
  SessionPhase, 
  SessionData, 
  IkigaiPhase,
  IkigaiProfile,
  WhyProfile,
  PhaseStorageData,
  PhaseAnswerCounts,
  MIN_ANSWERS_PER_PHASE,
  WHY_FINDER_TOTAL_EXCHANGES
} from './types';

// Import prompt files as raw text
// @ts-ignore
import BASE_PROMPT from './prompts/base.txt';
// @ts-ignore
import PHASE_INTRO from './prompts/phase_intro.txt';
// @ts-ignore
import PHASE_ENERGY from './prompts/phase_energy.txt';
// @ts-ignore
import PHASE_STORIES from './prompts/phase_stories.txt';
// @ts-ignore
import PHASE_YOUR_WHY from './prompts/phase_your_why.txt';

// Ikigai prompts - now 4 separate phases
// @ts-ignore
import IKIGAI_BASE from './prompts/ikigai_base.txt';
// @ts-ignore
import IKIGAI_PHASE1_LOVE from './prompts/ikigai_phase1_love.txt';
// @ts-ignore
import IKIGAI_PHASE2_GOOD_AT from './prompts/ikigai_phase2_good_at.txt';
// @ts-ignore
import IKIGAI_PHASE3_WORLD from './prompts/ikigai_phase3_world.txt';
// @ts-ignore
import IKIGAI_PHASE4_PAID from './prompts/ikigai_phase4_paid.txt';
// @ts-ignore
import IKIGAI_OVERLAPS from './prompts/ikigai_overlaps.txt';
// @ts-ignore
import PHASE_SUMMARIZE from './prompts/phase_summarize.txt';
// @ts-ignore
import DECISION_HELPER from './prompts/decision_helper.txt';

// ============================================================================
// STATIC MESSAGES
// ============================================================================

export const INITIAL_GREETING = `Hey! I'm here to help you discover your Why - your core purpose.

We'll have a focused conversation (exactly 12 exchanges) exploring:
- What energizes you vs what drains you
- Meaningful moments and stories from your life
- Patterns that reveal what truly matters to you

At the end, I'll synthesize everything into your personal Why statement.

Let's start: **What do you do right now, and what made you curious about finding your why?**`;

export const CRISIS_RESPONSE = `Hey, it sounds like you're going through something really heavy right now.

I'm just a coaching tool for self-discovery. I'm not equipped to help with what you're describing.

Please reach out to someone who can actually support you:
- 988 (call or text) in the US - Suicide and Crisis Lifeline
- Crisis Text Line - text HOME to 741741

You matter. Take care of yourself first. I'll be here when you're ready.`;

// Why Finder completion messages
export const WHY_COMPLETE_SAVE_PROMPT = `Would you like to save this Why Profile?

Saving allows you to:
• Use it as a foundation for building your Ikigai Profile
• Reference it later for decision-making
• Track how your Why evolves over time

⚠️ **Important:** If you plan to use the Ikigai Builder or Decision Helper, you **must** save your Why Profile first. These features require a saved profile to work.

Enter a name for your profile and click "Save Why Profile".`;

export const WHY_SAVED_PROCEED_PROMPT = `✅ **Why Profile saved!**

You can now use this profile to build your Ikigai. Click "🎯 Ikigai" in the header to start!`;

// Ikigai Builder messages
export const IKIGAI_REQUIRES_WHY_PROFILE = `⚠️ **Why Profile Required**

To build your Ikigai profile, you first need to complete a Why Finder session and save a Why Profile.

The Ikigai Builder uses your Why Profile as the foundation for exploring:
• What you love
• What you're good at
• What the world needs
• What you can be paid for

**Start a Why Discovery first!**`;

export const IKIGAI_SELECT_WHY_PROFILE = `**Select a Why Profile**

Please select a Why Profile from the dropdown to use as the foundation for your Ikigai Builder.

Your Why Profile contains insights about what you love and what you're good at, which helps us start strong.`;

export const IKIGAI_ANALYZING_WHY = `**Analyzing your Why Profile...**

Let me see what we already know about you from your Why Finder session.`;

export function getIkigaiAnalysisResult(
  whyProfile: WhyProfile,
  loveCount: number,
  goodAtCount: number
): string {
  const hasEnoughLove = loveCount >= MIN_ANSWERS_PER_PHASE;
  const hasEnoughGoodAt = goodAtCount >= MIN_ANSWERS_PER_PHASE;
  
  if (hasEnoughLove && hasEnoughGoodAt) {
    return `✅ **Great news!**

From your Why Profile "${whyProfile.name}", I found:

**What You Love (${loveCount} items):**
${whyProfile.whatYouLove.map(i => `• ${i}`).join('\n')}

**What You're Good At (${goodAtCount} items):**
${whyProfile.whatYouAreGoodAt.map(i => `• ${i}`).join('\n')}

This covers **Phase 1** and **Phase 2**! Let's move directly to **Phase 3: What the World Needs**.`;
  } else if (hasEnoughLove && !hasEnoughGoodAt) {
    return `📊 **Partial data found**

From your Why Profile "${whyProfile.name}", I found:

**What You Love (${loveCount} items) ✓**
${whyProfile.whatYouLove.map(i => `• ${i}`).join('\n')}

**What You're Good At (${goodAtCount} items) ⚠️ - Need ${MIN_ANSWERS_PER_PHASE - goodAtCount} more**

Phase 1 is covered, but we need to explore Phase 2 (What You're Good At) before moving forward.`;
  } else if (!hasEnoughLove && hasEnoughGoodAt) {
    return `📊 **Partial data found**

From your Why Profile "${whyProfile.name}", I found:

**What You Love (${loveCount} items) ⚠️ - Need ${MIN_ANSWERS_PER_PHASE - loveCount} more**

**What You're Good At (${goodAtCount} items) ✓**
${whyProfile.whatYouAreGoodAt.map(i => `• ${i}`).join('\n')}

Phase 2 is covered, but we need to explore Phase 1 (What You Love) before moving forward.`;
  } else {
    return `📊 **Analysis Complete**

From your Why Profile "${whyProfile.name}", I found some insights but need more detail:

**What You Love (${loveCount} items) ⚠️ - Need ${MIN_ANSWERS_PER_PHASE - loveCount} more**
${loveCount > 0 ? whyProfile.whatYouLove.map(i => `• ${i}`).join('\n') : 'None found yet'}

**What You're Good At (${goodAtCount} items) ⚠️ - Need ${MIN_ANSWERS_PER_PHASE - goodAtCount} more**
${goodAtCount > 0 ? whyProfile.whatYouAreGoodAt.map(i => `• ${i}`).join('\n') : 'None found yet'}

Let's start with **Phase 1: What You Love** to fill in the gaps.`;
  }
}

// Phase intro messages
export const IKIGAI_PHASE1_INTRO = `**Phase 1 of 4: What I Love** ❤️

Let's explore what truly brings you joy and energy.

I need at least ${MIN_ANSWERS_PER_PHASE} specific things you love before we can proceed.

**When you have a completely free day with no obligations, what activities do you naturally gravitate toward?**`;

export const IKIGAI_PHASE2_INTRO = `**Phase 2 of 4: What I'm Good At** 💪

Now let's explore your natural talents and skills - things that come easy to you.

I need at least ${MIN_ANSWERS_PER_PHASE} specific skills before we can proceed.

**What do people usually come to you for help with?**`;

export const IKIGAI_PHASE3_INTRO = `**Phase 3 of 4: What the World Needs** 🌍

Now let's look outward - at problems and causes you care about.

This isn't about your skills or preferences - it's about what's broken in the world that bothers you.

I need at least ${MIN_ANSWERS_PER_PHASE} specific world needs before we can proceed.

**When you look at the world around you, what problems or injustices frustrate you the most?**`;

export const IKIGAI_PHASE4_INTRO = `**Phase 4 of 4: What I Can Be Paid For** 💰

Finally, let's be practical - what can you actually earn money doing?

This is about realistic monetization, not dream jobs.

I need at least ${MIN_ANSWERS_PER_PHASE} items before we can proceed.

**What do you currently get paid for - job, freelance, side gigs, anything?**`;

export const IKIGAI_COMPLETE_MESSAGE = `**🎯 Your Ikigai Profile is Complete!**

Congratulations! You've mapped all four dimensions:
✅ What you love
✅ What you're good at  
✅ What the world needs
✅ What you can be paid for

I've computed your Ikigai overlaps - the sweet spots where these circles intersect.

**Save your profile below to use the Decision Helper!**`;

export const DECISION_HELPER_INTRO = `I'm here to help you think through a decision using your Ikigai profile.

I won't tell you what to do - instead, I'll ask questions to help you see how this decision aligns with what matters to you.

**What decision are you working through right now?**`;

export const NO_IKIGAI_PROFILE_MESSAGE = `You don't have any saved Ikigai profiles yet.

To use the Decision Helper, you need to:
1. Complete a Why Finder conversation and save it
2. Build an Ikigai profile from your Why Profile
3. Save the Ikigai profile

Start with "Why Discovery" first!`;

// ============================================================================
// WHY FINDER PROMPT BUILDER
// ============================================================================

export function getCoachSystemPrompt(
  phase: SessionPhase,
  sessionData: SessionData,
  conversationHistory: { role: string; content: string }[],
  exchangeCount: number
): string {
  const phaseInstructions = getPhaseInstructions(phase);
  const remainingExchanges = WHY_FINDER_TOTAL_EXCHANGES - exchangeCount;
  const isLastExchange = exchangeCount >= WHY_FINDER_TOTAL_EXCHANGES;
  
  let prompt = `${BASE_PROMPT}

═══════════════════════════════════════════════════════════════════
CURRENT SESSION STATUS
═══════════════════════════════════════════════════════════════════

PHASE: ${phase.toUpperCase()}
EXCHANGE: ${exchangeCount} of ${WHY_FINDER_TOTAL_EXCHANGES}
REMAINING: ${remainingExchanges} exchanges

${phaseInstructions}`;

  if (isLastExchange) {
    prompt += `

═══════════════════════════════════════════════════════════════════
*** THIS IS EXCHANGE ${exchangeCount} - DELIVER THE WHY NOW ***
═══════════════════════════════════════════════════════════════════

DO NOT ASK ANY MORE QUESTIONS.

Your response MUST include ALL of these sections:

**SUMMARY OF WHAT I LEARNED:**
• [3-4 bullet points referencing specific things they said]

**THE PATTERNS I SEE:**
• [2-3 patterns connecting their energizers, drainers, and stories]

**YOUR WHY IS:**
To [contribution verb] so that [impact for others]

**WHY THIS FITS YOU:**
[2-3 paragraphs explaining WHY this Why fits them]

**WHAT YOU LOVE (extracted from our conversation):**
• [Item 1]
• [Item 2]
• [Item 3]
• [More if applicable]

**WHAT YOU'RE GOOD AT (extracted from our conversation):**
• [Item 1]
• [Item 2]
• [Item 3]
• [More if applicable]

End with: "Take a moment to reflect on this. Does this resonate with you?"

NO QUESTIONS. This is the final message.`;
  } else {
    // NOT the final exchange - HARD BLOCK on delivering Why
    prompt += `

═══════════════════════════════════════════════════════════════════
█████████████████████████████████████████████████████████████████████
███  CRITICAL: DO NOT GIVE "YOUR WHY IS:" - NOT ALLOWED YET  ███
█████████████████████████████████████████████████████████████████████
═══════════════════════════════════════════════════════════════════

EXCHANGE ${exchangeCount} OF ${WHY_FINDER_TOTAL_EXCHANGES}
YOU MUST ASK ${remainingExchanges} MORE QUESTIONS BEFORE GIVING THE WHY.

ABSOLUTELY FORBIDDEN IN THIS RESPONSE:
- Writing "YOUR WHY IS:" 
- Writing "Your Why is:"
- Giving a why statement
- Summarizing their purpose
- Concluding the session
- Saying "we're done" or "that's all"

YOU MUST DO:
- Ask ONE thoughtful follow-up question
- The question must end with "?"
- Build on what they just shared
- Explore deeper into their stories, energy, or patterns

${exchangeCount <= 3 ? 'Focus on: What brings them energy vs drains them' : ''}
${exchangeCount > 3 && exchangeCount <= 6 ? 'Focus on: Meaningful stories and peak moments' : ''}
${exchangeCount > 6 && exchangeCount <= 9 ? 'Focus on: Patterns connecting their experiences' : ''}
${exchangeCount > 9 ? 'Focus on: Preparing for the final synthesis (but DO NOT give it yet!)' : ''}

YOUR RESPONSE MUST END WITH A QUESTION MARK (?).`;
  }

  return prompt;
}

function getPhaseInstructions(phase: SessionPhase): string {
  switch (phase) {
    case 'intro': return PHASE_INTRO;
    case 'energy_map': return PHASE_ENERGY;
    case 'stories': return PHASE_STORIES;
    case 'your_why': return PHASE_YOUR_WHY;
    case 'completed': return 'Session complete.';
    default: return '';
  }
}

// ============================================================================
// IKIGAI BUILDER PROMPT BUILDER (4 Phases)
// ============================================================================

export function getIkigaiBuilderPrompt(
  phase: IkigaiPhase,
  phaseStorage: PhaseStorageData,
  answerCounts: PhaseAnswerCounts,
  whyProfile?: WhyProfile | null
): string {
  const phasePrompt = getIkigaiPhasePrompt(phase);
  const needsMore = getAnswersNeededMessage(phase, answerCounts);
  const contextSummary = buildContextSummary(phaseStorage, whyProfile);
  
  let prompt = `${IKIGAI_BASE}

═══════════════════════════════════════════════════════════════════
CURRENT PHASE: ${phase.toUpperCase()}
${needsMore}
═══════════════════════════════════════════════════════════════════

${phasePrompt}

═══════════════════════════════════════════════════════════════════
CONTEXT FROM PREVIOUS PHASES
═══════════════════════════════════════════════════════════════════

${contextSummary}

═══════════════════════════════════════════════════════════════════
RULES: Stay in your phase. Do NOT ask about forbidden topics.
Need at least ${MIN_ANSWERS_PER_PHASE} answers to complete this phase.
═══════════════════════════════════════════════════════════════════`;

  return prompt;
}

function getIkigaiPhasePrompt(phase: IkigaiPhase): string {
  switch (phase) {
    case 'phase1_love': return IKIGAI_PHASE1_LOVE;
    case 'phase2_good_at': return IKIGAI_PHASE2_GOOD_AT;
    case 'phase3_world': return IKIGAI_PHASE3_WORLD;
    case 'phase4_paid': return IKIGAI_PHASE4_PAID;
    case 'complete': return 'All phases complete. Profile ready to save.';
    default: return '';
  }
}

function getAnswersNeededMessage(phase: IkigaiPhase, counts: PhaseAnswerCounts): string {
  const needed = (count: number) => Math.max(0, MIN_ANSWERS_PER_PHASE - count);
  
  switch (phase) {
    case 'phase1_love':
      return `LOVE: ${counts.love}/${MIN_ANSWERS_PER_PHASE} (need ${needed(counts.love)} more)`;
    case 'phase2_good_at':
      return `GOOD AT: ${counts.goodAt}/${MIN_ANSWERS_PER_PHASE} (need ${needed(counts.goodAt)} more)`;
    case 'phase3_world':
      return `WORLD NEEDS: ${counts.worldNeeds}/${MIN_ANSWERS_PER_PHASE} (need ${needed(counts.worldNeeds)} more)`;
    case 'phase4_paid':
      return `PAID FOR: ${counts.paidFor}/${MIN_ANSWERS_PER_PHASE} (need ${needed(counts.paidFor)} more)`;
    default:
      return '';
  }
}

function buildContextSummary(storage: PhaseStorageData, whyProfile?: WhyProfile | null): string {
  let context = '';
  
  const whyStatement = whyProfile?.whyStatement || 'Not specified';
  context += `WHY STATEMENT: "${whyStatement}"\n`;
  
  if (storage.phase1) {
    context += `\nPHASE 1 COMPLETE - LOVE: ${storage.phase1.love.bullets.slice(0, 3).join(', ')}`;
  } else if (whyProfile?.whatYouLove?.length) {
    context += `\nFROM WHY PROFILE - LOVE: ${whyProfile.whatYouLove.slice(0, 3).join(', ')}`;
  }
  
  if (storage.phase2) {
    context += `\nPHASE 2 COMPLETE - GOOD AT: ${storage.phase2.goodAt.bullets.slice(0, 3).join(', ')}`;
  } else if (whyProfile?.whatYouAreGoodAt?.length) {
    context += `\nFROM WHY PROFILE - GOOD AT: ${whyProfile.whatYouAreGoodAt.slice(0, 3).join(', ')}`;
  }
  
  if (storage.phase3) {
    context += `\nPHASE 3 COMPLETE - WORLD NEEDS: ${storage.phase3.worldNeeds.bullets.slice(0, 3).join(', ')}`;
  }
  
  return context;
}

// ============================================================================
// OTHER PROMPTS
// ============================================================================

export function getPhaseSummarizationPrompt(
  phaseName: string,
  conversation: { role: string; content: string }[]
): string {
  const conversationText = conversation.map(m => 
    `${m.role === 'user' ? 'USER' : 'COACH'}: ${m.content}`
  ).join('\n\n');
  
  let prompt = PHASE_SUMMARIZE;
  prompt = prompt.replace('{phase_name}', phaseName);
  prompt = prompt.replace('{conversation}', conversationText);
  
  return prompt;
}

export function getWhyExtractionPrompt(conversation: { role: string; content: string }[]): string {
  const conversationText = conversation.map(m => 
    `${m.role === 'user' ? 'USER' : 'COACH'}: ${m.content}`
  ).join('\n\n');
  
  return `Analyze this Why Finder conversation and extract:
1. What the user LOVES (activities, tasks, moments they enjoy)
2. What the user is GOOD AT (skills, talents, abilities)

CONVERSATION:
${conversationText}

Return ONLY valid JSON:
{
  "whatYouLove": ["item 1", "item 2", ...],
  "whatYouAreGoodAt": ["item 1", "item 2", ...],
  "whyExplanation": "detailed explanation"
}

Be specific. Extract at least 3 items for each if the conversation supports it.`;
}

export function getOverlapComputationPrompt(
  whyStatement: string,
  love: string[],
  goodAt: string[],
  worldNeeds: string[],
  paidFor: string[]
): string {
  let prompt = IKIGAI_OVERLAPS;
  prompt = prompt.replace('{why_statement}', whyStatement);
  prompt = prompt.replace('{love_bullets}', JSON.stringify(love));
  prompt = prompt.replace('{good_at_bullets}', JSON.stringify(goodAt));
  prompt = prompt.replace('{world_needs_bullets}', JSON.stringify(worldNeeds));
  prompt = prompt.replace('{paid_for_bullets}', JSON.stringify(paidFor));
  return prompt;
}

export function getDecisionHelperPrompt(
  profile: IkigaiProfile,
  conversationHistory: { role: string; content: string }[]
): string {
  const exchangeCount = conversationHistory.filter(m => m.role === 'user').length;
  
  return `${DECISION_HELPER}

═══════════════════════════════════════════════════════════════════
USER'S IKIGAI PROFILE: "${profile.name}"
═══════════════════════════════════════════════════════════════════

WHY STATEMENT: "${profile.whyStatement || 'Not specified'}"

WHAT THEY LOVE:
${profile.love.bullets.map(b => `• ${b}`).join('\n')}

WHAT THEY'RE GOOD AT:
${profile.goodAt.bullets.map(b => `• ${b}`).join('\n')}

WHAT THE WORLD NEEDS:
${profile.worldNeeds.bullets.map(b => `• ${b}`).join('\n')}

WHAT THEY CAN BE PAID FOR:
${profile.paidFor.bullets.map(b => `• ${b}`).join('\n')}

OVERLAPS:
• Passion: ${profile.overlaps.passion.summary}
• Mission: ${profile.overlaps.mission.summary}
• Profession: ${profile.overlaps.profession.summary}
• Vocation: ${profile.overlaps.vocation.summary}

═══════════════════════════════════════════════════════════════════
EXCHANGES: ${exchangeCount}
═══════════════════════════════════════════════════════════════════

Help them SEE alignment/misalignment. Never tell them what to do.`;
}

export function getStrengthExtractionPrompt(userMessage: string, phase: string): string {
  return `Analyze this message and extract strength signals.

MESSAGE (from ${phase} phase):
"${userMessage}"

Return ONLY JSON array:
[{"text": "strength", "sourceQuote": "quote", "phase": "${phase}"}]

If none found, return: []`;
}
