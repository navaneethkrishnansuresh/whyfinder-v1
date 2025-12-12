# BrainDrive Why Detector + Ikigai Builder + Decision Helper

## Complete Technical & Conceptual Documentation

**Version:** 1.0.0 (Extended)  
**Last Updated:** December 2024  
**Author:** BrainDrive Community

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Theoretical Foundation](#2-theoretical-foundation)
3. [Architecture Overview](#3-architecture-overview)
4. [Why Finder Module](#4-why-finder-module)
5. [Ikigai Builder Module](#5-ikigai-builder-module)
6. [Decision Helper Module](#6-decision-helper-module)
7. [Data Models & Storage](#7-data-models--storage)
8. [Quality Checker System](#8-quality-checker-system)
9. [AI Prompt Engineering](#9-ai-prompt-engineering)
10. [API Reference](#10-api-reference)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Flow Diagrams](#12-flow-diagrams)
13. [Changes from Previous Version](#13-changes-from-previous-version)
14. [Troubleshooting & FAQ](#14-troubleshooting--faq)

---

## 1. Executive Summary

### 1.1 What is This Plugin?

The **BrainDrive Why Detector** is a multi-agent AI coaching system that helps users discover their core purpose ("Why") and map it into a structured **Ikigai profile**. It consists of three interconnected modules:

```
┌─────────────────────────────────────────────────────────────────┐
│                    BrainDrive Why Detector                       │
├─────────────────┬─────────────────────┬─────────────────────────┤
│   WHY FINDER    │   IKIGAI BUILDER    │   DECISION HELPER       │
│                 │                     │                         │
│ Discover your   │ Map Why into 4      │ Use Ikigai profile to   │
│ core purpose    │ Ikigai circles      │ evaluate decisions      │
│                 │                     │                         │
│ 12 questions    │ 3 phases (A,B,C)    │ Socratic questioning    │
│ Energy mapping  │ Overlap computation │ Alignment analysis      │
│ Story mining    │ Profile saving      │ No direct advice        │
└─────────────────┴─────────────────────┴─────────────────────────┘
```

### 1.2 The Three Modes

| Mode | Purpose | Output |
|------|---------|--------|
| **Why Finder** | Discover your core purpose through guided conversation | A "Why statement" in format: "To [contribution] so that [impact]" |
| **Ikigai Builder** | Map your Why into the 4-circle Ikigai framework | A complete IkigaiProfile with overlaps |
| **Decision Helper** | Use your Ikigai profile to think through decisions | Clarity on how decisions align with your values |

### 1.3 Key Design Principles

1. **Reflection Tool, Not Oracle** - The system never tells users what to do
2. **Socratic Method** - All guidance comes through thoughtful questions
3. **Minimum Viable Depth** - Quality gates ensure conversations aren't shallow
4. **Persistent Profiles** - Users can save multiple Ikigai profiles for different life phases

---

## 2. Theoretical Foundation

### 2.1 Simon Sinek's "Start With Why"

The Why Finder is based on Simon Sinek's Golden Circle model:

```
           ┌─────────────────┐
           │      WHY        │  ← Purpose, cause, belief
           │   ┌─────────┐   │
           │   │  HOW    │   │  ← Process, values, strengths
           │   │ ┌─────┐ │   │
           │   │ │WHAT │ │   │  ← Products, services, actions
           │   │ └─────┘ │   │
           │   └─────────┘   │
           └─────────────────┘
```

**Key Insight:** Most people know WHAT they do and HOW they do it, but few can articulate WHY they do it. The Why Finder reverses this by starting from the inside out.

**Why Statement Format:**
```
"To [CONTRIBUTION] so that [IMPACT]"

Examples:
- "To inspire people to do what inspires them so that together we can change our world"
- "To challenge the status quo so that individuals feel empowered to create"
- "To connect ideas and people so that innovation flourishes"
```

### 2.2 The Western Ikigai Framework

The Ikigai Builder uses the **Western 4-circle model** (career-oriented), distinct from the traditional Japanese concept:

```
                    What you LOVE
                         ○
                        /|\
                       / | \
                      /  |  \
            PASSION  /   |   \  MISSION
                    /    |    \
                   /     |     \
    What you're   ○──────┼──────○  What the world
    GOOD AT        \     |     /   NEEDS
                    \    |    /
                     \   |   /
           PROFESSION \  |  / VOCATION
                       \ | /
                        \|/
                         ○
                  What you can be
                    PAID FOR
```

**The Four Circles:**

| Circle | Question | Focus |
|--------|----------|-------|
| **Love** | What do you love? | Activities that energize you, things you'd do even without pay |
| **Good At** | What are you good at? | Skills, talents, strengths others recognize in you |
| **World Needs** | What does the world need? | Problems you care about, causes that pull you |
| **Paid For** | What can you be paid for? | Realistic monetization paths, current and potential |

**The Four Overlaps:**

| Overlap | Formula | Description |
|---------|---------|-------------|
| **Passion** | Love ∩ Good At | What you enjoy AND excel at |
| **Mission** | Love ∩ World Needs | What you enjoy AND the world needs |
| **Profession** | Good At ∩ Paid For | What you excel at AND can earn from |
| **Vocation** | World Needs ∩ Paid For | What the world needs AND will pay for |

**The Center (Ikigai):** The intersection of all four circles represents your Ikigai - work that is fulfilling, impactful, profitable, and plays to your strengths.

### 2.3 Socratic Method in Decision Helper

The Decision Helper employs the **Socratic method** - teaching through questions rather than direct instruction:

```
┌────────────────────────────────────────────────────────┐
│              SOCRATIC QUESTIONING FLOW                  │
├────────────────────────────────────────────────────────┤
│                                                        │
│  User presents decision                                │
│         ↓                                              │
│  Helper asks alignment questions per circle            │
│         ↓                                              │
│  User reflects and answers                             │
│         ↓                                              │
│  Helper reflects back patterns/misalignments           │
│         ↓                                              │
│  "What feels more right to you now and why?"           │
│         ↓                                              │
│  User makes their own decision                         │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Core Principle:** The helper illuminates; the user decides.

---

## 3. Architecture Overview

### 3.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    BrainDriveWhyDetector.tsx                     │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐    │    │
│  │  │   Header    │ │   Chat UI   │ │      Input Area         │    │    │
│  │  │ - Profile   │ │ - Messages  │ │ - Text input            │    │    │
│  │  │   dropdown  │ │ - Streaming │ │ - Send/Stop buttons     │    │    │
│  │  │ - Decision  │ │ - Prompts   │ │ - Profile name input    │    │    │
│  │  │   Helper    │ │             │ │   (in summary phase)    │    │    │
│  │  └─────────────┘ └─────────────┘ └─────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         AIService.ts                             │    │
│  │  - sendToCoach()         - fetchIkigaiProfiles()                │    │
│  │  - sendToIkigaiBuilder() - createIkigaiProfile()                │    │
│  │  - sendToDecisionHelper()- extractStrengths()                   │    │
│  │  - computeOverlaps()     - updateIkigaiProfile()                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │ HTTP/SSE
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (FastAPI)                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    /api/v1/ikigai/* endpoints                    │    │
│  │  POST /sessions          GET /profiles                          │    │
│  │  PUT /sessions/{id}      POST /profiles                         │    │
│  │  POST /sessions/{id}/strengths   PUT /profiles/{id}             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    /api/v1/ai/providers/chat                     │    │
│  │  - Routes to configured AI provider (Ollama, OpenAI, etc.)      │    │
│  │  - Supports streaming (SSE)                                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         SQLite Database                          │    │
│  │  - why_finder_sessions table                                    │    │
│  │  - ikigai_profiles table                                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 File Structure

```
BrainDriveWhyDetector/v1.0.0/
├── dist/                          # Built output (served by backend)
│   ├── remoteEntry.js             # Module Federation entry
│   ├── main.js                    # Main bundle
│   └── ...
├── src/
│   ├── BrainDriveWhyDetector.tsx  # Main React component
│   ├── BrainDriveWhyDetector.css  # Styles
│   ├── types.ts                   # TypeScript type definitions
│   ├── index.tsx                  # Entry point for Module Federation
│   ├── declarations.d.ts          # TypeScript declarations for .txt imports
│   ├── prompts.ts                 # Prompt builder functions
│   ├── prompts/                   # Raw prompt text files
│   │   ├── base.txt               # Base Why Finder prompt
│   │   ├── phase_intro.txt        # Introduction phase
│   │   ├── phase_energy.txt       # Energy mapping phase
│   │   ├── phase_stories.txt      # Story mining phase
│   │   ├── phase_your_why.txt     # Why synthesis phase
│   │   ├── ikigai_base.txt        # Base Ikigai Builder prompt
│   │   ├── ikigai_phase_a.txt     # Phase A: Love + Good At
│   │   ├── ikigai_phase_b.txt     # Phase B: World Needs
│   │   ├── ikigai_phase_c.txt     # Phase C: Paid For
│   │   ├── ikigai_overlaps.txt    # Overlap computation prompt
│   │   └── decision_helper.txt    # Decision Helper prompt
│   └── services/
│       ├── index.ts               # Service exports
│       └── aiService.ts           # AI communication service
├── package.json
├── tsconfig.json
├── webpack.config.js
├── README.md
└── DOCUMENTATION.md               # This file
```

### 3.3 State Management

The plugin uses React class component state with the following structure:

```typescript
interface BrainDriveWhyDetectorState {
  // UI State
  currentTheme: string;           // 'light' | 'dark'
  isInitializing: boolean;        // Initial load
  isLoading: boolean;             // Waiting for AI response
  isStreaming: boolean;           // AI response streaming
  error: string;                  // Error message to display
  
  // Model State
  models: ModelInfo[];            // Available AI models
  selectedModel: ModelInfo | null;
  isLoadingModels: boolean;
  
  // Chat State
  messages: ChatMessage[];        // Conversation history
  inputText: string;              // Current input
  
  // Session State
  sessionStarted: boolean;
  currentPhase: SessionPhase;     // Why Finder phase
  sessionData: SessionData;       // Collected data
  
  // Mode State
  sessionMode: SessionMode;       // 'why_finder' | 'ikigai_builder' | 'decision_helper'
  
  // Ikigai State
  ikigaiProfiles: IkigaiProfileSummary[];  // User's saved profiles
  selectedProfileId: string | null;         // For Decision Helper
  currentIkigaiPhase: IkigaiPhase;          // Ikigai Builder phase
  ikigaiData: IkigaiBuilderData;            // Data being built
  showBuildIkigaiPrompt: boolean;           // Show CTA after Why Finder
  
  // Session Tracking
  whyFinderSessionId: string | null;        // For linking to Ikigai profile
}
```

---

## 4. Why Finder Module

### 4.1 Overview

The Why Finder guides users through a structured conversation to discover their core purpose. It uses a **multi-phase approach** with built-in quality checks.

### 4.2 The Five Phases

```
┌──────────────────────────────────────────────────────────────────┐
│                     WHY FINDER PHASES                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 1: INTRO (3+ exchanges)                                   │
│  ├── Goal: Understand who they are and why they came             │
│  ├── Quality: Don't accept surface-level answers                 │
│  └── Transition: After 3+ meaningful exchanges                   │
│                        ↓                                         │
│  PHASE 2: ENERGY MAP (4+ exchanges)                              │
│  ├── Goal: Find what energizes and drains them                   │
│  ├── Quality: Need SPECIFIC examples, not generalities           │
│  ├── Extracts: energizers[], drainers[]                          │
│  └── Transition: After 4+ exchanges with real depth              │
│                        ↓                                         │
│  PHASE 3: STORIES (3+ exchanges)                                 │
│  ├── Goal: Get 1-2 specific stories with emotional depth         │
│  ├── Quality: Stories need details, emotions, meaning            │
│  ├── Extracts: stories[], candidateStrengths[]                   │
│  └── Transition: After 3+ stories with emotional core            │
│                        ↓                                         │
│  PHASE 4: YOUR WHY (until confirmed)                             │
│  ├── Goal: Synthesize patterns into a Why statement              │
│  ├── Quality: Minimum 10 total exchanges before proposing        │
│  ├── Output: "YOUR WHY IS: To [X] so that [Y]"                   │
│  └── Transition: When user confirms the statement                │
│                        ↓                                         │
│  PHASE 5: COMPLETED                                              │
│  └── Shows "Build Ikigai Profile" prompt                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 Sample Questions by Phase

#### Phase 1: Introduction
```
"What do you do right now, and what made you curious about finding your why?"
"Can you tell me more about that?"
"What specifically prompted this?"
"Help me understand - what does that look like for you?"
```

#### Phase 2: Energy Mapping
```
ENERGIZERS:
"What activities make you lose track of time?"
"When do you feel most alive at work?"
"What tasks would you do even if you weren't paid?"

DRAINERS:
"What tasks make you watch the clock?"
"What leaves you feeling exhausted even when it's not physically hard?"
"What do you procrastinate on even though you know it's important?"

QUALITY PROBES:
"That's interesting - can you give me a specific example?"
"When was a specific time this happened? Walk me through it."
```

#### Phase 3: Stories
```
"Tell me about a time you felt really proud of something you did."
"What's a moment when you felt you were exactly where you should be?"
"Describe a time when work didn't feel like work."

QUALITY PROBES:
"I want to really understand this moment. Can you paint the picture for me?"
"What were you feeling in that moment?"
"Why did this stick with you?"
```

#### Phase 4: Your Why
```
PATTERN REFLECTION:
"I'm noticing a pattern here. In both stories, you mentioned [X]."
"It seems like [Y] really matters to you."

PROPOSAL:
"Based on everything you've shared, I think your Why might be:
To [contribution] so that [impact]."

CONFIRMATION:
"Does this resonate with you?"
"How does that feel?"
```

### 4.4 Quality Checker Logic

The Why Finder implements quality gates through the prompt system and phase transition logic:

```typescript
// Phase transition thresholds
const MIN_INTRO = 3;        // Minimum exchanges in intro phase
const MIN_ENERGY = 4;       // Minimum exchanges in energy phase
const MIN_STORIES = 3;      // Minimum exchanges in stories phase
const MIN_TOTAL_FOR_WHY = 10;  // Minimum total before proposing Why
const FORCE_WHY_AT = 12;    // Force Why statement at exchange 12

// Quality check in prompt
if (phase === 'your_why' && !readyForWhy) {
  prompt += `
*** QUALITY CHECK: NOT READY ***
You only have ${exchangeCount} exchanges. You need at least ${MIN_FOR_WHY_PHASE}.
DO NOT propose a Why statement yet.
Keep asking questions to understand them better.`;
}
```

**Quality Criteria by Phase:**

| Phase | Minimum Exchanges | Quality Criteria |
|-------|-------------------|------------------|
| Intro | 3 | Answers must be specific, not "just curious" |
| Energy | 4 | Need specific examples, not "I like helping people" |
| Stories | 3 | Stories need: specific details, emotional content, meaning |
| Your Why | 10 total | Must have explored all previous phases deeply |

### 4.5 Strength Extraction

During the energy and story phases, the system extracts "strength signals" from user responses:

```typescript
// Trigger patterns for strength extraction
const STRENGTH_PATTERNS = [
  "People always come to me for...",
  "The part I did really well was...",
  "They relied on me for...",
  "I'm naturally good at...",
  "It comes easy to me...",
  "Others struggle with X but I find it simple..."
];

// Extraction process
async extractStrengths(userMessage: string, phase: string): Promise<CandidateStrength[]> {
  // Uses LLM to extract strength signals
  // Returns array of: { text, sourceQuote, phase }
}
```

**Example Extraction:**

User says: *"In that project, people kept coming to me to explain the technical stuff to the clients. I guess I'm good at making complex things simple."*

Extracted strength:
```json
{
  "text": "explaining complex technical concepts in simple terms",
  "sourceQuote": "people kept coming to me to explain the technical stuff to the clients",
  "phase": "stories"
}
```

### 4.6 Session Data Structure

```typescript
interface SessionData {
  energizers: string[];      // Things that energize them (max 3)
  drainers: string[];        // Things that drain them (max 3)
  stories: string[];         // Key stories shared (summaries)
  whyStatement: string;      // Final Why statement
  candidateStrengths: CandidateStrength[];  // Extracted strengths
}
```

---

## 5. Ikigai Builder Module

### 5.1 Overview

The Ikigai Builder takes the output from Why Finder and expands it into a complete 4-circle Ikigai profile. It adds two circles that Why Finder barely touches:
- **What the world needs**
- **What you can be paid for**

### 5.2 The Three Phases

```
┌──────────────────────────────────────────────────────────────────┐
│                    IKIGAI BUILDER PHASES                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE A: Love + Good At (4-8 exchanges)                         │
│  ├── INPUT: Why statement, candidate strengths from Why Finder   │
│  ├── GOAL: Sharpen and expand "What you love" and "What you're   │
│  │         good at" using the existing data                      │
│  ├── OUTPUT: love.bullets[], love.summary                        │
│  │           good_at.bullets[], good_at.summary                  │
│  └── QUALITY: 3+ distinct items per circle                       │
│                        ↓                                         │
│  PHASE B: World Needs (4-8 exchanges)                            │
│  ├── INPUT: None from Why Finder (this is NEW exploration)       │
│  ├── GOAL: Discover causes, problems, contexts they care about   │
│  ├── OUTPUT: world_needs.bullets[], world_needs.summary          │
│  └── QUALITY: 3+ distinct causes/problems                        │
│                        ↓                                         │
│  PHASE C: Paid For (4-8 exchanges)                               │
│  ├── INPUT: Skills identified in previous phases                 │
│  ├── GOAL: Explore realistic monetization paths                  │
│  ├── OUTPUT: paid_for.bullets[], paid_for.summary                │
│  └── QUALITY: 2+ current + 2+ potential paths                    │
│                        ↓                                         │
│  OVERLAP COMPUTATION (automatic)                                 │
│  ├── Uses LLM to compute semantic overlaps                       │
│  └── OUTPUT: passion, mission, profession, vocation              │
│                        ↓                                         │
│  SUMMARY + NAMING                                                │
│  ├── Shows complete profile                                      │
│  ├── User names the profile (e.g., "Career 2025")                │
│  └── Saves to database                                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 5.3 Sample Questions by Phase

#### Phase A: Love + Good At

**Opening (reflecting Why Finder data):**
```
"Based on our previous conversation, here's how I understand what you love doing:
- [bullet from energizers]
- [bullet from stories]

And here are a few things you seem naturally good at:
- [bullet from candidate strengths]
- [inferred from stories]

Let me ask a few questions to sharpen this..."
```

**Love Questions:**
```
"When you look at your recent days, what are the activities you never get bored with, even when you're tired?"
"When was the last time you lost track of time, and what exactly were you doing?"
"If money didn't matter for a year, what parts of your current life would you keep doing anyway?"
"What activities leave you feeling energized rather than drained?"
```

**Good At Questions:**
```
"What do people usually come to you for help with?"
"In your current or past work, what parts feel easy to you that others struggle with?"
"In your friend or peer group, what role do you naturally end up playing?"
"What skills or abilities feel so natural you forget they're special?"
```

#### Phase B: World Needs

**Warmup:**
```
"When you look at the world or your own community, what are the issues that bother you the most?"
"If you could wave a magic wand and fix one problem around you, what would it be and why?"
"Is there a type of person you naturally want to protect or support?"
```

**Drill-down:**
```
"Who is affected the most by that?"
"What part of that problem do you feel most drawn to: supporting people directly, building tools, teaching, organizing, or something else?"
"Does this feel more local to your city, more online, or more global?"
"If you had one day per week to contribute to something meaningful, how would you spend it?"
"When you read the news or scroll social media, what makes you angry or sad?"
```

#### Phase C: Paid For

**Current Reality:**
```
"Right now, what do you already get paid for: job, side work, small gigs, anything?"
"When people or organizations pay you, what exactly are they paying for: technical skills, people skills, creativity, reliability?"
"What's the most money you've ever been paid to do, and did you enjoy it?"
```

**Potential:**
```
"From everything we've discussed so far, what do you think could realistically be something people would pay you for if you built it up more?"
"If you had to earn some money next month using your current abilities, what would be your first two or three options?"
"Are there skills from your 'good at' list that you've seen others get paid for?"
```

**Constraints:**
```
"Are there any hard constraints you need to respect: minimum monthly income, time limits, location, family responsibilities?"
"What's your realistic timeline - do you need income immediately or can you invest time?"
"Are there things you're good at that you absolutely do NOT want to get paid for?"
```

### 5.4 Overlap Computation

The overlaps are computed using an LLM helper, not algorithmic set intersection. This allows for **semantic matching** - finding conceptual overlaps even when exact words don't match.

**Prompt Template:**

```
Given these bullet lists:
- LOVE: ["teaching", "solving puzzles", "creative writing"]
- GOOD AT: ["explaining complex topics", "patience", "storytelling"]
- WORLD NEEDS: ["better education access", "mental health support", "tech literacy"]
- PAID FOR: ["technical writing", "tutoring", "content creation"]

Generate overlaps:

1. PASSION (love ∩ good_at)
   Find activities/themes where what they love meets what they're good at.
   
2. MISSION (love ∩ world_needs)
   Where what they love meets what the world needs.
   
3. PROFESSION (good_at ∩ paid_for)
   Where what they're good at meets what they can be paid for.
   
4. VOCATION (world_needs ∩ paid_for)
   Where what the world needs meets what they can be paid for.
```

**Example Output:**

```json
{
  "passion": {
    "bullets": [
      "Teaching complex topics through storytelling",
      "Creating educational content that simplifies difficult concepts",
      "Patient mentoring that makes learning enjoyable"
    ],
    "summary": "You find joy in making complex things accessible, combining your love of teaching with your natural storytelling ability."
  },
  "mission": {
    "bullets": [
      "Improving educational access through engaging content",
      "Making tech literacy fun and approachable",
      "Supporting mental health through educational resources"
    ],
    "summary": "You could contribute to education and mental health causes by creating content that makes learning feel less overwhelming."
  },
  "profession": {
    "bullets": [
      "Technical writing that explains complex topics clearly",
      "Educational content creation (courses, articles)",
      "Tutoring in areas where you can simplify difficulty"
    ],
    "summary": "Your ability to explain things simply combined with patience makes you well-suited for technical writing and educational content creation."
  },
  "vocation": {
    "bullets": [
      "Creating affordable educational resources",
      "Tech literacy content for underserved communities",
      "Accessible mental health education materials"
    ],
    "summary": "There's demand for accessible educational content, especially in tech and mental health - areas you care about and can monetize."
  }
}
```

### 5.5 Profile Data Structure

```typescript
interface IkigaiBuilderData {
  name: string;                    // User-chosen label
  whyStatement: string;            // From Why Finder
  
  // The Four Circles
  love: IkigaiBucket;              // What you love
  goodAt: IkigaiBucket;            // What you're good at
  worldNeeds: IkigaiBucket;        // What the world needs
  paidFor: IkigaiBucket;           // What you can be paid for
  
  // The Four Overlaps
  overlaps: {
    passion: IkigaiBucket;         // love ∩ good_at
    mission: IkigaiBucket;         // love ∩ world_needs
    profession: IkigaiBucket;      // good_at ∩ paid_for
    vocation: IkigaiBucket;        // world_needs ∩ paid_for
  };
  
  // Progress Tracking
  buildProgress: {
    phaseAComplete: boolean;
    phaseBComplete: boolean;
    phaseCComplete: boolean;
    overlapsComputed: boolean;
  };
}

interface IkigaiBucket {
  bullets: string[];               // 3-10 short items
  summary: string;                 // 1-3 sentence narrative
}
```

---

## 6. Decision Helper Module

### 6.1 Overview

The Decision Helper is a **Socratic coach** that uses the user's saved Ikigai profile as context to help them think through decisions. It **never gives direct advice**.

### 6.2 Entry Requirements

```typescript
// Decision Helper can only be started if:
// 1. User has at least one saved Ikigai profile
// 2. User has selected a profile from the dropdown

if (ikigaiProfiles.length === 0) {
  showError("You don't have any saved Ikigai profiles yet...");
  return;
}

if (!selectedProfileId) {
  showError("Please select an Ikigai profile first.");
  return;
}
```

### 6.3 Question Framework

The helper asks **alignment questions** for each Ikigai circle:

```
┌──────────────────────────────────────────────────────────────────┐
│               DECISION HELPER QUESTION FRAMEWORK                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  USER PRESENTS DECISION                                          │
│  "Should I take this new job offer?"                             │
│                        ↓                                         │
│  LOVE ALIGNMENT                                                  │
│  "How much of your daily time in this role would be spent        │
│   on activities from your 'love' list?"                          │
│  "Which things you love would this let you do more of? Less of?" │
│                        ↓                                         │
│  GOOD AT ALIGNMENT                                               │
│  "Which of your strengths would you use heavily here?"           │
│  "Which would be ignored?"                                       │
│  "Does this play to your natural talents or require new ones?"   │
│                        ↓                                         │
│  WORLD NEEDS ALIGNMENT                                           │
│  "Does this let you contribute to the problems you care about?"  │
│  "Would this bring you closer to or further from your impact?"   │
│                        ↓                                         │
│  PAID FOR ALIGNMENT                                              │
│  "Does this respect your financial needs and constraints?"       │
│  "How does this compare to your current earning potential?"      │
│                        ↓                                         │
│  MISMATCH REFLECTION                                             │
│  "This option seems strong on [X] and [Y], but weak on [Z]       │
│   compared to what you said you care about."                     │
│                        ↓                                         │
│  REFLECTION PROMPT                                               │
│  "Given all this, what feels more right to you right now         │
│   and why?"                                                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 6.4 System Prompt Structure

```
You are an Ikigai-based Socratic decision helper.

USER'S IKIGAI PROFILE: "Career Pivot 2025"

WHY STATEMENT:
"To simplify complexity so that others can learn and grow"

WHAT THEY LOVE:
- Teaching and mentoring
- Solving complex puzzles
- Creative problem-solving
Summary: Activities that combine intellectual challenge with helping others.

WHAT THEY'RE GOOD AT:
- Explaining complex topics simply
- Patient listening
- Breaking down problems
Summary: Natural teacher with strong analytical skills.

WHAT THE WORLD NEEDS (that they care about):
- Better tech education
- Accessible mental health resources
- Climate awareness
Summary: Focused on education and accessibility.

WHAT THEY CAN BE PAID FOR:
- Technical writing
- Course creation
- Consulting
Summary: Multiple paths in education and content.

OVERLAPS:
- Passion: Teaching complex topics through stories
- Mission: Making tech education accessible
- Profession: Technical writing and course creation
- Vocation: Accessible educational content

RULES:
1. Never say "you should" or give direct advice
2. Ask questions that illuminate alignment
3. Reflect mismatches neutrally
4. Always end with "what feels right to you?"
```

### 6.5 Example Conversation

**User:** "I got a job offer from a big tech company. It pays well but it's mostly internal tools work. Should I take it?"

**Helper:** "That's a significant decision. Let me ask a few questions to help you think through it.

Looking at your 'love' list - teaching, solving puzzles, creative problem-solving - how much of your daily work in this role would involve those activities?

And from your 'good at' list, you mentioned explaining complex topics simply. Would this internal tools role let you use that strength, or would it mostly stay unused?"

**User:** "Honestly, probably not much teaching. It's mostly solo coding work. But the pay is really good."

**Helper:** "I hear that - the financial aspect is strong. That aligns with your 'paid for' circle.

At the same time, you mentioned caring about accessible tech education in your 'world needs.' Would this role move you closer to that, or would it be neutral?

And thinking about your Why - 'to simplify complexity so others can learn and grow' - how does internal tools work connect to that purpose?"

**User:** "It doesn't really connect. But the money would let me do more education stuff on the side."

**Helper:** "That's an interesting strategy - using the role as a financial foundation for your real mission.

So you'd have strong alignment on 'paid for' but weaker alignment on 'love,' 'world needs,' and your core Why. The trade-off is stability vs. daily fulfillment.

Given all this, what feels more right to you right now, and why?"

---

## 7. Data Models & Storage

### 7.1 Database Tables

Two new tables were added to the BrainDrive database:

#### why_finder_sessions

```sql
CREATE TABLE why_finder_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) DEFAULT 'in_progress',  -- in_progress, completed, abandoned
    why_statement TEXT,
    candidate_strengths JSON,  -- Array of {text, source_quote, phase}
    energizers JSON,           -- Array of strings
    drainers JSON,             -- Array of strings
    stories JSON,              -- Array of strings
    model_used VARCHAR(255),
    total_exchanges VARCHAR(10) DEFAULT '0',
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_wfs_user_status ON why_finder_sessions(user_id, status);
```

#### ikigai_profiles

```sql
CREATE TABLE ikigai_profiles (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    source_why_session_id VARCHAR(36),
    why_statement TEXT,
    
    -- The four circles (JSON: {bullets: [], summary: ""})
    love JSON,
    good_at JSON,
    world_needs JSON,
    paid_for JSON,
    
    -- Overlaps (JSON: {passion: {}, mission: {}, profession: {}, vocation: {}})
    overlaps JSON,
    
    -- Status
    is_complete BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Build progress (JSON: {phase_a_complete, phase_b_complete, ...})
    build_progress JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (source_why_session_id) REFERENCES why_finder_sessions(id) ON DELETE SET NULL
);

CREATE INDEX idx_ikigai_user_active ON ikigai_profiles(user_id, is_active);
```

### 7.2 JSON Field Structures

#### candidate_strengths (in why_finder_sessions)
```json
[
  {
    "text": "explaining complex topics simply",
    "source_quote": "people kept coming to me to explain things",
    "phase": "stories"
  },
  {
    "text": "creative problem solving",
    "source_quote": "I found an unconventional solution",
    "phase": "energy"
  }
]
```

#### love/good_at/world_needs/paid_for (in ikigai_profiles)
```json
{
  "bullets": [
    "Teaching and mentoring others",
    "Solving complex puzzles",
    "Creative problem-solving"
  ],
  "summary": "Activities that combine intellectual challenge with helping others grow and learn."
}
```

#### overlaps (in ikigai_profiles)
```json
{
  "passion": {
    "bullets": ["Teaching complex topics through stories", "..."],
    "summary": "You find joy in making complex things accessible."
  },
  "mission": {
    "bullets": ["Making tech education accessible", "..."],
    "summary": "You could contribute through educational content."
  },
  "profession": {
    "bullets": ["Technical writing", "Course creation", "..."],
    "summary": "Your explanation skills are marketable."
  },
  "vocation": {
    "bullets": ["Accessible educational content", "..."],
    "summary": "There's demand for accessible education."
  }
}
```

#### build_progress (in ikigai_profiles)
```json
{
  "phase_a_complete": true,
  "phase_b_complete": true,
  "phase_c_complete": true,
  "overlaps_computed": true
}
```

### 7.3 User-Profile Relationship

```
┌─────────────┐       ┌───────────────────────┐
│    User     │       │  WhyFinderSession     │
│             │──1:N──│                       │
│             │       │ - Multiple sessions   │
│             │       │   per user            │
└─────────────┘       └───────────┬───────────┘
      │                           │
      │                           │ 1:N (optional)
      │                           ↓
      │               ┌───────────────────────┐
      │               │    IkigaiProfile      │
      └──────1:N──────│                       │
                      │ - Multiple profiles   │
                      │   per user            │
                      │ - Optionally linked   │
                      │   to a session        │
                      └───────────────────────┘
```

---

## 8. Quality Checker System

### 8.1 Multi-Level Quality Control

The plugin implements quality control at multiple levels:

```
┌────────────────────────────────────────────────────────────────────┐
│                    QUALITY CONTROL LAYERS                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  LAYER 1: PHASE TRANSITION GATES                                   │
│  ├── Minimum exchange counts per phase                             │
│  ├── Must have substantive data before moving on                   │
│  └── Implemented in: analyzeAndUpdatePhase()                       │
│                                                                    │
│  LAYER 2: PROMPT-LEVEL INSTRUCTIONS                                │
│  ├── Quality check instructions embedded in system prompts         │
│  ├── Examples of good vs bad responses                             │
│  └── Implemented in: prompts/*.txt files                           │
│                                                                    │
│  LAYER 3: RUNTIME VALIDATION                                       │
│  ├── Checks bullet counts before phase completion                  │
│  ├── Adds quality reminders to prompts when needed                 │
│  └── Implemented in: buildIkigaiPrompt()                           │
│                                                                    │
│  LAYER 4: FINAL OUTPUT VALIDATION                                  │
│  ├── Ensures Why statement format                                  │
│  ├── Strips questions from final Why delivery                      │
│  └── Implemented in: stripQuestionsFromWhy()                       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 8.2 Phase Transition Logic

```typescript
// Why Finder phase transitions
const MIN_INTRO = 3;
const MIN_ENERGY = 4;
const MIN_STORIES = 3;
const MIN_TOTAL_FOR_WHY = 10;

function analyzeAndUpdatePhase(userMessage: string) {
  const totalUserMessages = messages.filter(m => m.sender === 'user').length;
  const userMessagesInPhase = messages.filter(
    m => m.phase === currentPhase && m.sender === 'user'
  ).length;
  
  let newPhase = currentPhase;
  
  if (currentPhase === 'intro' && userMessagesInPhase >= MIN_INTRO) {
    newPhase = 'energy_map';
  } else if (currentPhase === 'energy_map' && userMessagesInPhase >= MIN_ENERGY) {
    newPhase = 'stories';
  } else if (currentPhase === 'stories' && 
             userMessagesInPhase >= MIN_STORIES && 
             totalUserMessages >= MIN_TOTAL_FOR_WHY) {
    newPhase = 'your_why';
  }
  
  // Update state if phase changed
  if (newPhase !== currentPhase) {
    setState({ currentPhase: newPhase });
  }
}
```

### 8.3 Ikigai Quality Thresholds

```typescript
// Minimum bullets per circle
const QUALITY_THRESHOLDS = {
  love: 3,
  good_at: 3,
  world_needs: 3,
  paid_for: 2  // Lower because monetization is harder to articulate
};

// Check in prompt builder
if (phase === 'phase_a') {
  const loveBullets = ikigaiData.love.bullets.length;
  const goodAtBullets = ikigaiData.goodAt.bullets.length;
  
  if (loveBullets < 3 || goodAtBullets < 3) {
    prompt += `
QUALITY CHECK: Need more items
- Love: ${loveBullets}/3 minimum
- Good At: ${goodAtBullets}/3 minimum
Keep asking questions until both circles have at least 3 items.`;
  }
}
```

### 8.4 Anti-Pattern Detection

The prompts include instructions to reject common low-quality patterns:

```
BAD (too vague):
- "I like helping people" → Ask: "Who specifically? Help with what?"
- "Meetings drain me" → Ask: "Which meetings? What about them?"
- "I want to make an impact" → Ask: "Impact on whom? Through what?"

GOOD (specific):
- "I love helping junior developers debug their code"
- "Status meetings with no agenda drain me"
- "I want to help first-gen college students navigate applications"
```

---

## 9. AI Prompt Engineering

### 9.1 Prompt Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                      PROMPT CONSTRUCTION                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  SYSTEM PROMPT = BASE + PHASE + CONTEXT + QUALITY_CHECK            │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ BASE PROMPT (base.txt / ikigai_base.txt)                 │      │
│  │ - Role definition ("You are a warm, supportive coach")   │      │
│  │ - Critical rules (ask questions, don't lecture)          │      │
│  │ - Response format guidelines                             │      │
│  │ - Good/bad examples                                      │      │
│  └──────────────────────────────────────────────────────────┘      │
│                          +                                         │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ PHASE INSTRUCTIONS (phase_*.txt / ikigai_phase_*.txt)    │      │
│  │ - Phase-specific goals                                   │      │
│  │ - Question types to ask                                  │      │
│  │ - Quality criteria                                       │      │
│  │ - Transition conditions                                  │      │
│  └──────────────────────────────────────────────────────────┘      │
│                          +                                         │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ CONTEXT (dynamically generated)                          │      │
│  │ - Exchange count                                         │      │
│  │ - Session data collected so far                          │      │
│  │ - For Ikigai: bullets collected per circle               │      │
│  │ - For Decision Helper: full profile                      │      │
│  └──────────────────────────────────────────────────────────┘      │
│                          +                                         │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ QUALITY CHECK (conditional)                              │      │
│  │ - Added if thresholds not met                            │      │
│  │ - "You only have X exchanges, need Y"                    │      │
│  │ - "Do NOT propose Why yet"                               │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 9.2 Key Prompt Techniques

#### 1. Explicit Role Framing
```
You are a warm, supportive coach helping someone discover their Why.
You are NOT an oracle. You do NOT tell them what to do.
```

#### 2. Response Format Constraints
```
RESPONSE FORMAT:
- 1-2 sentences acknowledging what they said
- 1 sentence of insight or reflection
- 1 NEW question ending with ?
- Keep it SHORT (3-4 sentences total)
```

#### 3. Anti-Pattern Examples
```
GOOD RESPONSE:
"That sounds meaningful - getting absorbed in solving problems. What was it about that specific challenge that made hours fly by?"

BAD RESPONSE (repeats):
"Tell me more about feeling engaged" (if you already asked this)

BAD RESPONSE (no question):
"You clearly value creative problem-solving."
```

#### 4. Conditional Instructions
```
if (userJustConfirmed && readyForWhy) {
  prompt += `
*** USER CONFIRMED - DELIVER FINAL WHY ***
YOU MUST NOW:
1. Say "YOUR WHY IS: [statement]"
2. Thank them warmly
3. Do NOT ask another question
4. This is the END`;
}
```

#### 5. Force Behaviors at Thresholds
```
const FORCE_WHY_AT = 12;
if (exchangeCount >= FORCE_WHY_AT) {
  instructionReminder = `
[CRITICAL INSTRUCTION - THIS IS EXCHANGE #${exchangeCount}]
YOU MUST NOW DELIVER THE WHY STATEMENT.
DO NOT ASK ANY MORE QUESTIONS. THIS IS THE END.`;
}
```

### 9.3 Conversation History Management

The full conversation history is sent with each request (no compression):

```typescript
buildContext(messages: Array<{ sender: string; content: string }>): 
  { role: string; content: string }[] {
  return messages.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));
}

// Request structure
const messages = [
  { role: 'system', content: systemPrompt },
  ...conversationHistory,                    // Full history
  { role: 'user', content: instructionReminder + userMessage }
];
```

---

## 10. API Reference

### 10.1 Why Finder Session Endpoints

#### Create Session
```http
POST /api/v1/ikigai/sessions
Content-Type: application/json
Authorization: Bearer <token>

{
  "why_statement": null,
  "candidate_strengths": [],
  "energizers": [],
  "drainers": [],
  "stories": [],
  "model_used": "llama3",
  "total_exchanges": "0"
}

Response: 201 Created
{
  "id": "uuid",
  "user_id": "uuid",
  "status": "in_progress",
  "why_statement": null,
  "candidate_strengths": [],
  ...
  "created_at": "2024-12-09T...",
  "updated_at": "2024-12-09T..."
}
```

#### Update Session
```http
PUT /api/v1/ikigai/sessions/{session_id}
Content-Type: application/json

{
  "status": "completed",
  "why_statement": "To simplify complexity so that others can learn",
  "total_exchanges": "12"
}
```

#### Add Strengths
```http
POST /api/v1/ikigai/sessions/{session_id}/strengths
Content-Type: application/json

[
  {
    "text": "explaining complex topics",
    "source_quote": "people always ask me to explain",
    "phase": "stories"
  }
]
```

### 10.2 Ikigai Profile Endpoints

#### List Profiles (Summary)
```http
GET /api/v1/ikigai/profiles
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": "uuid",
    "name": "Career 2025",
    "is_complete": true,
    "is_active": true,
    "created_at": "2024-12-09T..."
  }
]
```

#### Get Full Profile
```http
GET /api/v1/ikigai/profiles/{profile_id}

Response: 200 OK
{
  "id": "uuid",
  "user_id": "uuid",
  "name": "Career 2025",
  "why_statement": "To simplify...",
  "love": {
    "bullets": ["Teaching", "Puzzles", "..."],
    "summary": "..."
  },
  "good_at": {...},
  "world_needs": {...},
  "paid_for": {...},
  "overlaps": {
    "passion": {...},
    "mission": {...},
    "profession": {...},
    "vocation": {...}
  },
  "is_complete": true,
  "is_active": true,
  "build_progress": {
    "phase_a_complete": true,
    "phase_b_complete": true,
    "phase_c_complete": true,
    "overlaps_computed": true
  }
}
```

#### Create Profile
```http
POST /api/v1/ikigai/profiles
Content-Type: application/json

{
  "name": "Career 2025",
  "source_why_session_id": "uuid",
  "why_statement": "To simplify...",
  "love": {"bullets": [...], "summary": "..."},
  "good_at": {...},
  "world_needs": {...},
  "paid_for": {...},
  "overlaps": {...}
}
```

#### Update Profile
```http
PUT /api/v1/ikigai/profiles/{profile_id}
Content-Type: application/json

{
  "name": "Career Pivot 2025",
  "is_complete": true
}
```

#### Delete Profile
```http
DELETE /api/v1/ikigai/profiles/{profile_id}

Response: 204 No Content
```

---

## 11. Frontend Architecture

### 11.1 Component Hierarchy

```
BrainDriveWhyDetector (main component)
├── renderHeader()
│   ├── Mode title ("🧭 Why Discovery" / "🎯 Ikigai Builder" / "🤔 Decision Helper")
│   ├── Back button (when not in Why Finder mode)
│   ├── Profile dropdown (ikigaiProfiles → selectedProfileId)
│   ├── Decision Helper button
│   └── Model selector
│
├── renderMessages()
│   ├── ChatMessage[] (mapped to message bubbles)
│   │   └── ReactMarkdown (renders markdown content)
│   ├── Build Ikigai Prompt (conditional, after Why Finder completes)
│   └── Profile Name Input (conditional, during Ikigai summary phase)
│
└── renderInput()
    ├── Textarea (inputText)
    ├── Send button (or Stop button if streaming)
    └── Session complete message (conditional)
```

### 11.2 Mode State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                     SESSION MODE STATE MACHINE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ┌─────────────────┐                          │
│        START ──────│   WHY FINDER    │                          │
│                    │   (default)     │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│            ┌────────────────┼────────────────┐                  │
│            │                │                │                  │
│            ▼                │                ▼                  │
│  ┌─────────────────┐        │      ┌─────────────────┐          │
│  │ Click "Build    │        │      │ Click "Decision │          │
│  │ Ikigai Profile" │        │      │ Helper" button  │          │
│  └────────┬────────┘        │      └────────┬────────┘          │
│           │                 │               │                   │
│           ▼                 │               ▼                   │
│  ┌─────────────────┐        │      ┌─────────────────┐          │
│  │ IKIGAI BUILDER  │        │      │ DECISION HELPER │          │
│  │ (phase_a →      │        │      │ (requires       │          │
│  │  phase_b →      │        │      │  selected       │          │
│  │  phase_c →      │        │      │  profile)       │          │
│  │  overlaps →     │        │      └────────┬────────┘          │
│  │  summary)       │        │               │                   │
│  └────────┬────────┘        │               │                   │
│           │                 │               │                   │
│           └─────────────────┴───────────────┘                   │
│                             │                                   │
│                             ▼                                   │
│                    ┌─────────────────┐                          │
│                    │  "Back" button  │                          │
│                    │  returns to     │                          │
│                    │  WHY FINDER     │                          │
│                    └─────────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.3 Message Routing

```typescript
// In sendCoachMessage()
if (sessionMode === 'ikigai_builder') {
  return this.sendIkigaiBuilderMessage(userMessage);
} else if (sessionMode === 'decision_helper') {
  return this.sendDecisionHelperMessage(userMessage);
}
// else: Why Finder mode (default)
```

### 11.4 CSS Architecture

```css
/* Theme Variables */
.why-detector {
  --bg-color: #ffffff;
  --paper-bg: #ffffff;
  --text-color: #333333;
  --border-color: rgba(0, 0, 0, 0.2);
  --button-primary-bg: #2196f3;
  /* ... */
}

.why-detector.dark-theme {
  --bg-color: #121a28;
  --paper-bg: #1a2332;
  --text-color: #e0e0e0;
  /* ... */
}

/* Component Styles */
.why-header { /* Header bar */ }
.why-chat { /* Message container */ }
.why-input { /* Input area */ }
.chat-message.user { /* User message bubble */ }
.chat-message.coach { /* AI message bubble */ }

/* Ikigai-specific */
.ikigai-prompt { /* Build Ikigai CTA card */ }
.btn-build-ikigai { /* Purple gradient button */ }
.profile-name-input { /* Name input field */ }
.btn-decision-helper { /* Purple decision helper button */ }
```

---

## 12. Flow Diagrams

### 12.1 Complete User Journey

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        COMPLETE USER JOURNEY                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  USER OPENS PLUGIN                                                      │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────┐                    │
│  │              WHY FINDER SESSION                  │                    │
│  │                                                 │                    │
│  │  1. Introduction (3+ exchanges)                 │                    │
│  │     "What brings you here?"                     │                    │
│  │                    ↓                            │                    │
│  │  2. Energy Mapping (4+ exchanges)               │                    │
│  │     "What energizes/drains you?"                │                    │
│  │     → extracts energizers[], drainers[]         │                    │
│  │     → extracts candidateStrengths[]             │                    │
│  │                    ↓                            │                    │
│  │  3. Stories (3+ exchanges)                      │                    │
│  │     "Tell me about a meaningful moment"         │                    │
│  │     → extracts stories[]                        │                    │
│  │     → extracts more candidateStrengths[]        │                    │
│  │                    ↓                            │                    │
│  │  4. Your Why (until confirmed)                  │                    │
│  │     "YOUR WHY IS: To [X] so that [Y]"           │                    │
│  │                    ↓                            │                    │
│  │  ✅ SESSION COMPLETE                            │                    │
│  │     Shows: "Build Ikigai Profile" prompt        │                    │
│  └─────────────────────────────────────────────────┘                    │
│         │                                                               │
│         │ User clicks "Build Ikigai Profile"                            │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────┐                    │
│  │              IKIGAI BUILDER SESSION              │                    │
│  │                                                 │                    │
│  │  INPUT: whyStatement, candidateStrengths,       │                    │
│  │         energizers, drainers, stories           │                    │
│  │                    ↓                            │                    │
│  │  Phase A: Love + Good At (4-8 exchanges)        │                    │
│  │     "Here's what I learned about what you       │                    │
│  │      love... let me ask more..."                │                    │
│  │     → fills love.bullets[], love.summary        │                    │
│  │     → fills good_at.bullets[], good_at.summary  │                    │
│  │                    ↓                            │                    │
│  │  Phase B: World Needs (4-8 exchanges)           │                    │
│  │     "What problems in the world matter to you?" │                    │
│  │     → fills world_needs.bullets[], summary      │                    │
│  │                    ↓                            │                    │
│  │  Phase C: Paid For (4-8 exchanges)              │                    │
│  │     "What can you realistically be paid for?"   │                    │
│  │     → fills paid_for.bullets[], summary         │                    │
│  │                    ↓                            │                    │
│  │  Overlap Computation (automatic)                │                    │
│  │     → LLM computes passion, mission,            │                    │
│  │       profession, vocation                      │                    │
│  │                    ↓                            │                    │
│  │  Summary + Naming                               │                    │
│  │     "Name your profile: ___________"            │                    │
│  │     User enters: "Career 2025"                  │                    │
│  │                    ↓                            │
│  │  ✅ PROFILE SAVED                               │                    │
│  │     Profile appears in dropdown                 │                    │
│  └─────────────────────────────────────────────────┘                    │
│         │                                                               │
│         │ Later... user has a decision to make                          │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────┐                    │
│  │              DECISION HELPER SESSION             │                    │
│  │                                                 │                    │
│  │  1. User selects profile from dropdown          │                    │
│  │  2. User clicks "Decision Helper"               │                    │
│  │                    ↓                            │                    │
│  │  3. User presents decision                      │                    │
│  │     "Should I take this job offer?"             │                    │
│  │                    ↓                            │                    │
│  │  4. Helper asks alignment questions             │                    │
│  │     - Love alignment                            │                    │
│  │     - Good At alignment                         │                    │
│  │     - World Needs alignment                     │                    │
│  │     - Paid For alignment                        │                    │
│  │                    ↓                            │                    │
│  │  5. Helper reflects patterns/mismatches         │                    │
│  │     "Strong on paid_for, weak on mission"       │                    │
│  │                    ↓                            │                    │
│  │  6. Final reflection prompt                     │                    │
│  │     "What feels right to you now?"              │                    │
│  │                    ↓                            │                    │
│  │  ✅ USER DECIDES (helper doesn't decide)        │                    │
│  └─────────────────────────────────────────────────┘                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATA FLOW                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  USER INPUT                                                             │
│      │                                                                  │
│      ▼                                                                  │
│  ┌──────────────────┐                                                   │
│  │ React Component  │                                                   │
│  │ State            │                                                   │
│  │ - inputText      │                                                   │
│  │ - messages[]     │                                                   │
│  │ - sessionData    │                                                   │
│  │ - ikigaiData     │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────┐      ┌──────────────────┐                         │
│  │ AIService        │──────│ Prompt Builder   │                         │
│  │                  │      │                  │                         │
│  │ - buildContext() │      │ - System prompt  │                         │
│  │ - sendToCoach()  │      │ - Phase instrs   │                         │
│  │ - sendToIkigai() │      │ - Context data   │                         │
│  │ - sendToDecision │      │ - Quality checks │                         │
│  └────────┬─────────┘      └──────────────────┘                         │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────────────────────────────────┐                       │
│  │ BrainDrive API /api/v1/ai/providers/chat     │                       │
│  │                                              │                       │
│  │ Routes to: Ollama / OpenAI / Anthropic / etc │                       │
│  └────────┬─────────────────────────────────────┘                       │
│           │                                                             │
│           │ SSE Stream                                                  │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │ AI Response      │                                                   │
│  │ (streamed)       │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │ Update State     │                                                   │
│  │ - Append to msg  │                                                   │
│  │ - Update phase   │                                                   │
│  │ - Extract data   │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────┐      ┌──────────────────┐                         │
│  │ On Completion    │──────│ Backend API      │                         │
│  │                  │      │                  │                         │
│  │ - Save session   │─────▶│ POST /sessions   │                         │
│  │ - Save profile   │─────▶│ POST /profiles   │                         │
│  │ - Add strengths  │─────▶│ POST /strengths  │                         │
│  └──────────────────┘      └────────┬─────────┘                         │
│                                     │                                   │
│                                     ▼                                   │
│                            ┌──────────────────┐                         │
│                            │ SQLite Database  │                         │
│                            │                  │                         │
│                            │ why_finder_      │                         │
│                            │   sessions       │                         │
│                            │                  │                         │
│                            │ ikigai_profiles  │                         │
│                            └──────────────────┘                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Changes from Previous Version

### 13.1 Summary of Changes

| Area | Previous Version | Extended Version |
|------|------------------|------------------|
| **Modes** | Why Finder only | Why Finder + Ikigai Builder + Decision Helper |
| **Output** | Why statement | Why statement + Full Ikigai profile |
| **Storage** | Session state only | Session state + Database persistence |
| **Profiles** | None | Multiple named profiles per user |
| **Phases** | 5 (intro → completed) | 5 + 5 Ikigai phases |
| **Prompts** | 5 files | 11 files |

### 13.2 Files Added

```
NEW FILES:
├── Backend
│   ├── app/models/ikigai.py              # WhyFinderSession, IkigaiProfile models
│   ├── app/schemas/ikigai.py             # Pydantic schemas
│   ├── app/api/v1/endpoints/ikigai.py    # CRUD endpoints
│   └── migrations/versions/a1b2c3d4...   # Database migration
│
└── Frontend (plugin)
    └── src/prompts/
        ├── ikigai_base.txt
        ├── ikigai_phase_a.txt
        ├── ikigai_phase_b.txt
        ├── ikigai_phase_c.txt
        ├── ikigai_overlaps.txt
        └── decision_helper.txt
```

### 13.3 Files Modified

```
MODIFIED FILES:
├── Backend
│   ├── app/models/__init__.py            # Added imports
│   ├── app/models/relationships.py       # Added User relationships
│   └── app/api/v1/api.py                 # Added ikigai router
│
└── Frontend (plugin)
    ├── src/types.ts                      # Added Ikigai types
    ├── src/prompts.ts                    # Added prompt builders
    ├── src/services/aiService.ts         # Added Ikigai/Decision methods
    ├── src/BrainDriveWhyDetector.tsx     # Added mode handling, UI
    └── src/BrainDriveWhyDetector.css     # Added new styles
```

### 13.4 Why Finder Changes (Minimal)

The core Why Finder experience remains **unchanged**:

✅ Same 12-question flow  
✅ Same phase structure  
✅ Same quality thresholds  
✅ Same Why statement format  

**Only additions:**
1. Strength extraction during story/energy phases (internal, no UX change)
2. "Build Ikigai Profile" prompt shown after completion (optional)
3. Session data can be saved to database (optional)

---

## 14. Troubleshooting & FAQ

### 14.1 Common Issues

#### Q: The UI looks the same as before
**A:** 
1. Rebuild the plugin: `npm run build` in the plugin directory
2. Restart the backend server
3. Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+F5` (Windows)
4. Clear browser cache

#### Q: "No AI models available" error
**A:** Configure an AI provider in BrainDrive Settings (Ollama, OpenAI, etc.)

#### Q: Profile dropdown is empty
**A:** You need to complete at least one Why Finder session AND build an Ikigai profile from it. The dropdown only shows saved profiles.

#### Q: Decision Helper button is disabled
**A:** Either:
1. You have no saved Ikigai profiles (complete one first)
2. No profile is selected in the dropdown (select one)

#### Q: Why statement not appearing
**A:** The AI needs at least 10 exchanges before proposing a Why. Keep answering questions.

#### Q: Ikigai overlaps are empty
**A:** Ensure all 4 circles have at least the minimum bullets (3 for love/good_at/world_needs, 2 for paid_for). The overlap computation runs automatically when Phase C completes.

### 14.2 Debug Mode

To debug AI responses, check the browser console for:
```javascript
console.log(`Phase transition: ${currentPhase} -> ${newPhase}`);
```

To see what's being sent to the AI, check Network tab for `/api/v1/ai/providers/chat` requests.

### 14.3 Database Inspection

To inspect saved data:
```sql
-- View all sessions for a user
SELECT * FROM why_finder_sessions WHERE user_id = 'xxx';

-- View all profiles for a user
SELECT id, name, is_complete, created_at FROM ikigai_profiles WHERE user_id = 'xxx';

-- View full profile
SELECT * FROM ikigai_profiles WHERE id = 'xxx';
```

### 14.4 Reset and Start Fresh

To reset a user's Ikigai data:
```sql
-- Delete all profiles
DELETE FROM ikigai_profiles WHERE user_id = 'xxx';

-- Delete all sessions
DELETE FROM why_finder_sessions WHERE user_id = 'xxx';
```

---

## Appendix A: Complete Type Definitions

```typescript
// Session Modes
type SessionMode = 'why_finder' | 'ikigai_builder' | 'decision_helper';

// Why Finder Phases
type SessionPhase = 'intro' | 'energy_map' | 'stories' | 'your_why' | 'completed';

// Ikigai Builder Phases
type IkigaiPhase = 'phase_a' | 'phase_b' | 'phase_c' | 'overlaps' | 'summary' | 'complete';

// Candidate Strength
interface CandidateStrength {
  text: string;
  sourceQuote: string;
  phase: 'story' | 'energy' | 'other';
}

// Ikigai Bucket (circle or overlap)
interface IkigaiBucket {
  bullets: string[];
  summary: string;
}

// Ikigai Overlaps
interface IkigaiOverlaps {
  mission: IkigaiBucket;    // love ∩ world_needs
  profession: IkigaiBucket; // good_at ∩ paid_for
  vocation: IkigaiBucket;   // world_needs ∩ paid_for
  passion: IkigaiBucket;    // love ∩ good_at
}

// Build Progress
interface BuildProgress {
  phaseAComplete: boolean;
  phaseBComplete: boolean;
  phaseCComplete: boolean;
  overlapsComputed: boolean;
}

// Ikigai Builder Data
interface IkigaiBuilderData {
  name: string;
  whyStatement: string;
  love: IkigaiBucket;
  goodAt: IkigaiBucket;
  worldNeeds: IkigaiBucket;
  paidFor: IkigaiBucket;
  overlaps: IkigaiOverlaps;
  buildProgress: BuildProgress;
}

// Full Ikigai Profile
interface IkigaiProfile extends IkigaiBuilderData {
  id: string;
  userId: string;
  sourceWhySessionId?: string;
  isComplete: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

// Profile Summary (for dropdown)
interface IkigaiProfileSummary {
  id: string;
  name: string;
  isComplete: boolean;
  isActive: boolean;
  createdAt: string;
}

// Session Data (Why Finder)
interface SessionData {
  energizers: string[];
  drainers: string[];
  stories: string[];
  whyStatement: string;
  candidateStrengths: CandidateStrength[];
}

// Chat Message
interface ChatMessage {
  id: string;
  sender: 'user' | 'coach';
  content: string;
  timestamp: string;
  phase?: SessionPhase | IkigaiPhase;
  isStreaming?: boolean;
  mode?: SessionMode;
}
```

---

## Appendix B: Prompt File Contents Summary

| File | Purpose | Key Instructions |
|------|---------|------------------|
| `base.txt` | Why Finder base prompt | Ask questions, don't repeat, keep short |
| `phase_intro.txt` | Introduction phase | Don't accept surface answers |
| `phase_energy.txt` | Energy mapping | Need SPECIFIC examples |
| `phase_stories.txt` | Story mining | Stories need emotion + meaning |
| `phase_your_why.txt` | Why synthesis | Deliver with "YOUR WHY IS:" |
| `ikigai_base.txt` | Ikigai builder base | Not an oracle, Socratic questions |
| `ikigai_phase_a.txt` | Love + Good At | Mirror back, then sharpen |
| `ikigai_phase_b.txt` | World Needs | Often unexplored, be patient |
| `ikigai_phase_c.txt` | Paid For | Realistic paths, not fantasy |
| `ikigai_overlaps.txt` | Overlap computation | Semantic matching, JSON output |
| `decision_helper.txt` | Decision Helper | Never advise, illuminate alignment |

---

## Appendix C: Quality Thresholds Reference

| Threshold | Value | Purpose |
|-----------|-------|---------|
| `MIN_INTRO` | 3 | Exchanges before leaving intro |
| `MIN_ENERGY` | 4 | Exchanges before leaving energy |
| `MIN_STORIES` | 3 | Exchanges before leaving stories |
| `MIN_TOTAL_FOR_WHY` | 10 | Total before proposing Why |
| `FORCE_WHY_AT` | 12 | Force Why statement delivery |
| `love.bullets` | ≥3 | Before completing Phase A |
| `good_at.bullets` | ≥3 | Before completing Phase A |
| `world_needs.bullets` | ≥3 | Before completing Phase B |
| `paid_for.bullets` | ≥2 | Before completing Phase C |

---

*End of Documentation*

**Document Version:** 1.0.0  
**Plugin Version:** 1.0.0 (Extended)  
**Compatible with BrainDrive:** 1.x




