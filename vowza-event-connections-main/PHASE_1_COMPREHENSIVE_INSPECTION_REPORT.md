# PHASE 1: Comprehensive Vowza Planner Architecture Inspection

**Date:** July 22, 2026  
**Status:** Inspection Complete (No Changes Made)  
**Scope:** Complete analysis of current Vowza AI Planner system  

---

## TABLE OF CONTENTS

1. Current Architecture Overview
2. What Already Works
3. What Is Missing
4. Root Causes of Generic/Chatbot Behavior
5. Database Data Available
6. Vendor Retrieval Flow
7. Package Retrieval Flow
8. Conversation/Memory Flow
9. Security Analysis
10. Proposed Vowza AI Architecture
11. Exact Files Requiring Changes
12. Database/RPC Changes Required
13. Implementation Phases
14. Demo Scenario Test Plan
15. Risks & Protection Measures

---

## 1. CURRENT ARCHITECTURE

### 1.1 Frontend Layer

**Main Component:** `src/pages/AIPlanner.tsx` (500+ LOC)

**Responsibilities:**
- Renders chat UI with message bubbles, typing indicators, streaming cursor
- Manages sidebar conversation history with pinning, archiving, favoriting
- Handles voice input via Web Speech API (English-IN)
- Displays markdown messages and "AIResponseCards" (structured responses)
- Supports message editing, copying, sharing, reactions (like/dislike)
- Shows context pills at top (event type, city, budget, guests)
- Renders 6 starter prompt buttons
- Scroll management and quick-jump-to-bottom button

**Key State Variables:**
```typescript
messages:        ChatMessage[]       // full conversation history
isStreaming:     boolean             // actively receiving AI response
streamingText:   string              // accumulated text during streaming
context:         PlannerContext      // parsed event context (see below)
conversationId:  string | null       // Supabase conversation row ID
conversations:   ConversationRow[]   // list of saved conversations
```

**Starter Prompts:**
```
1. 💒 Plan my wedding
2. 💰 Budget breakdown
3. 📋 Full event plan
4. 🎯 Recommend vendors
5. 📅 Event timeline
6. ⚠️ Risk analysis
```

### 1.2 Chat Hook: `src/components/ai/useAIChat.ts`

**Responsibilities:**
- Manages conversation persistence (Supabase database)
- Handles user authentication check on mount
- Restores conversation history for authenticated users
- Implements conversation CRUD (create, read, update, delete)
- Implements the `send()` function that orchestrates the entire message flow
- Handles message deduplication to prevent duplicate API calls
- Implements navigation shortcuts (e.g., "take me to dashboard")
- Manages sessionStorage for unauthenticated users

**Key Functions:**
```typescript
send(userText)              // Main message handler
loadConversation(conv)      // Switch to saved conversation
editAndResend(msgId, text)  // Edit + regenerate message
regenerateLastResponse()    // Retry last AI response
clearChat()                 // New conversation
loadMessages(convId)        // Restore history from DB
saveMessage()               // Persist message to DB
```

**Context Persistence:**
- Saves to Supabase `conversations` table (user_id, title, context_summary)
- Restores context_summary on mount
- Also uses sessionStorage as fallback for unauthenticated users

### 1.3 LLM Layer: `src/lib/llm.ts` (400+ LOC)

**Responsibilities:**
- Main entry point: `sendMessage(opts: SendOptions): Promise<SendResult>`
- Implements dual-mode LLM strategy:
  - Mode 1: Supabase Edge Function proxy → Groq (production)
  - Mode 2: Deterministic VEDA engine (fallback, zero-cost)
- Handles vendor database retrieval (RAG) before LLM responds
- Streams responses using NDJSON (newline-delimited JSON)
- Detects vendor requests explicitly ("show me photographers")
- Falls back to VEDA deterministic responses if retrieval fails

**System Prompt:** 1,200+ word prompt defining Vowza Planner personality and rules

**Critical Logic:**
```
1. Parse message intent (via orchestrate())
2. Extract context (via processMessage())
3. Check if category list request → retrieve active categories
4. Check if explicit vendor request → retrieve + display vendors
5. Check if generic vendor discovery language → retrieve vendors
6. If vendor retrieval succeeds → show vendor cards
7. If vendor retrieval fails → use VEDA deterministic response
8. Otherwise → try Groq Edge Function (if configured)
9. Fallback → VEDA deterministic engine
```

### 1.4 AI Orchestrator: `src/lib/aiOrchestrator.ts` (400+ LOC)

**Responsibilities:**
- Analyzes every user message to determine intent
- Decides if database retrieval is needed
- Extracts searchable parameters (city, budget, profession)
- Builds optimized database queries
- Determines response strategy

**Intent Classification:**
```typescript
type Intent =
  | 'find_vendors'         // "show photographers"
  | 'plan_event'           // "plan my wedding"
  | 'budget_breakdown'     // "budget breakdown"
  | 'timeline'             // "create timeline"
  | 'checklist'            // "what do I need"
  | 'food_plan'            // "help plan food"
  | 'weather_advice'       // "best month"
  | 'risk_analysis'        // "what could go wrong"
  | 'success_score'        // "score my plan"
  | 'negotiation'          // "help negotiate"
  | 'comparison'           // "compare vendors"
  | 'general_question'     // "what is..."
  | 'context_update'       // "change city"
  | 'follow_up'            // "tell me more"
  | 'greeting'             // "hi"
  | 'clarification'        // answering AI question
```

**Key Extraction Functions:**
```typescript
classifyIntent(message, ctx, history)   // Determine intent
extractCity(text)                       // Parse city name
extractBudget(text)                     // Parse budget amount
detectProfessions(text)                 // Find vendor categories
nextSoftFollowUp(ctx)                   // Ask ONE natural follow-up (not blocking)
```

**Context Summary for LLM:**
```
[CURRENT EVENT CONTEXT: Event: Wedding | City: Hyderabad | Budget: ₹5L | Guests: 300]
```

### 1.5 RAG Retriever: `src/lib/ragRetriever.ts` (300+ LOC)

**Responsibilities:**
- Retrieves real vendor data from `provider_profiles` table BEFORE LLM sees the message
- Implements dual search modes:
  - Vector search (if vendor_embeddings exist)
  - SQL fallback (always available)
- Filters vendors by: profession, city, price range, minimum rating
- Ranks vendors by match score, rating, booking count
- Returns empty result if no vendors found (never fabricates)
- Retrieves active marketplace categories from `artist_categories` table

**Critical Functions:**
```typescript
retrieveVendors(msg, context, limit, filters)
  → RAGResult: { vendors, totalFound, searchStatus, queryUsed }

sqlSearch(profession, city, priceMax, minRating, limit)
  → RetrievedVendor[] | []

buildRAGContext(ragResult)
  → Formatted vendor text for display

retrieveActiveMarketplaceCategories()
  → MarketplaceCategory[] (from artist_categories table)
```

**Vendor Retrieval Filters:**
```
- profession (mapped from message keywords)
- city (extracted from "in {city}" syntax or context)
- priceMax (from "under ₹80K" or budget context)
- minRating (default 0, or "highly-rated" → 4.0)
- limit (default 8-12)
```

### 1.6 AI Planner Module: `src/lib/aiPlanner.ts`

**Responsibilities:**
- Implements VEDA (deterministic) response generation
- Handles planning-specific responses (budget, timeline, checklist, food)
- Extracts and updates context from every message
- Detects when vendor search results should not fall through to generic planning
- Provides sensible defaults (₹5L budget, 200 guests, "wedding") to prevent re-asking

**Response Types:**
```typescript
type AIResponse = 
  | { type: 'text', text: string }
  | { type: 'budget_breakdown', data: BudgetPlan }
  | { type: 'timeline', data: EventTimeline }
  | { type: 'checklist', data: ChecklistItem[] }
  | { type: 'vendor_results', data: { vendors: DBVendor[] } }
  | { type: 'question', text: string }
  | { type: 'category_results', data: { categories: MarketplaceCategory[] } }
  | { type: 'food_plan', data: FoodPlan }
```

### 1.7 Conversation Persistence: `src/lib/conversationRepository.ts`

**Database Tables Used:**
```sql
conversations (
  id, user_id, title, context_summary, created_at, updated_at,
  is_pinned, is_archived, is_favorite
)

conversation_messages (
  id, conversation_id, user_id, role, content, response_json,
  created_at
)
```

**Key Functions:**
```typescript
createConversation(userId, firstMsg, context)  // Create new chat
saveMessage(convId, userId, role, content)     // Persist message
loadMessages(convId)                           // Restore history
deleteConversation(convId)                     // Delete chat
updateConversation(convId, {title, ...})       // Metadata updates
renameConversation(convId, title)              // Set title
setConversationPinned(convId, bool)            // Pin/unpin
setConversationArchived(convId, bool)          // Archive/restore
favoriteConversation(convId, bool)             // Favorite toggle
exportConversation(convId)                     // Download as markdown
duplicateConversation(userId, source)          // Clone conversation
```

**Conversation State Management:**
- sessionStorage for unauthenticated users (temporary)
- Supabase for authenticated users (persistent)
- Context restored on mount from Supabase
- New messages automatically saved to DB

---

## 2. WHAT ALREADY WORKS

### ✅ Working Features

1. **Chat UI & UX**
   - ✅ Streaming responses with typing dots
   - ✅ Voice input (Web Speech API)
   - ✅ Message editing and regeneration
   - ✅ Like/dislike reactions
   - ✅ Copy/share functionality
   - ✅ Conversation history sidebar (authenticated users)

2. **Conversation Persistence**
   - ✅ Saves conversations to Supabase
   - ✅ Restores history on mount
   - ✅ Rename, pin, archive, favorite, delete
   - ✅ Export as markdown file
   - ✅ Duplicate conversation
   - ✅ Session storage for anon users

3. **Intent Detection**
   - ✅ Classifies user message intent (find_vendors, plan_event, etc.)
   - ✅ Detects vendor category keywords
   - ✅ Extracts city from message
   - ✅ Extracts budget from message
   - ✅ Detects navigation shortcuts

4. **Real Vendor Database (RAG)**
   - ✅ Retrieves vendors from `provider_profiles` table
   - ✅ Filters by profession, city, price, rating
   - ✅ Ranks by match score + rating
   - ✅ Falls back to SQL if vector search unavailable
   - ✅ Returns empty result honestly (never fabricates)
   - ✅ Deduplicates verified vendors

5. **Context Extraction**
   - ✅ Parses event type (wedding, birthday, etc.)
   - ✅ Parses city (Hyderabad, Mumbai, etc.)
   - ✅ Parses budget (₹5 lakh, ₹100K, etc.)
   - ✅ Parses guest count
   - ✅ Persists context in sessionStorage + Supabase
   - ✅ Displays context pills at top of chat

6. **Fallback Strategy**
   - ✅ Groq Edge Function (production LLM)
   - ✅ VEDA deterministic engine (zero cost, zero latency)
   - ✅ Graceful degradation if Groq unavailable
   - ✅ Handles API key securely (server-side only)

7. **Admin Event Packages (Separate System)**
   - ✅ ADMIN_EVENT_PACKAGES table with Silver/Gold/Platinum tiers
   - ✅ EventPackageSelector component shows packages to customers
   - ✅ Max 2 optional inclusions removal logic enforced
   - ✅ Price snapshots on booking
   - ✅ RLS policies (admin CRUD, customers view published only)

---

## 3. WHAT IS MISSING

### ❌ Missing Event Planning Intelligence

1. **NO Structured Event Context State**
   - ❌ Event context is parsed but NOT retained as structured state
   - ❌ No centralized "planning context" object across turns
   - ❌ User must re-state requirements if they change topic

2. **NO Real-Time Budget Allocation**
   - ❌ AI does not calculate budget breakdown per category
   - ❌ No intelligent allocation based on event type
   - ❌ No recalculation when customer adjusts requirements

3. **NO Event Context Recalculation**
   - User: "I'm planning a wedding for 300 guests. ₹5 lakh budget. Traditional decoration, photography, DJ."
   - AI: Extracts these facts
   - User: "Photography is most important."
   - AI: Does NOT recalculate plan with photography prioritized
   - ❌ Context not updated in real-time

4. **NO Smart Follow-Up Questions**
   - ❌ AI asks generic "What would you like?" instead of context-aware questions
   - ❌ No sensible defaults used (e.g., "assume ₹5L default, generate plan anyway")
   - ❌ Conversation can get stuck asking "What type of event?" indefinitely

5. **NO Real-Time Plan Visualization**
   - ❌ AI does not maintain a live, editable plan state
   - ❌ Customer cannot say "reduce budget to 4L" and see changes immediately
   - ❌ No "what-if" simulation support

6. **NO Admin Event Package Integration in Planning**
   - ❌ AI does not recommend Admin Event Packages when appropriate
   - ❌ No differentiation between vendor packages (individual) vs Admin packages (Silver/Gold/Platinum)
   - ❌ No package comparison within planning flow

7. **NO Trade-Off Engine**
   - ❌ If budget exceeded, AI doesn't offer alternatives
   - ❌ No "reduce decoration by X, keep photography at Y" suggestions
   - ❌ No optimization for customer priorities

8. **NO Vendor Matching During Planning**
   - ❌ Vendors retrieved separately, not connected to planned services
   - ❌ No "for photography, I found 5 vendors under ₹80K" in context of plan
   - ❌ No vendor recommendations tied to budget allocation

9. **NO Context Preservation Across Service Calls**
   - ❌ When switching between vendor search and planning, context is lost
   - ❌ Each message starts fresh (context only persists in sessionStorage, not in LLM system prompt)

---

## 4. ROOT CAUSES OF GENERIC/INCORRECT BEHAVIOR

### Root Cause Analysis

**Why Vowza Planner Behaves Like a Generic Chatbot:**

1. **No Structured Planning State Machine**
   - Current: Message → Intent → Action → Response
   - Problem: Each turn is stateless; context lost between turns
   - Missing: Centralized planning context that persists and drives all decisions

2. **Intent Classification is Too Broad**
   - Current intents: find_vendors, plan_event, general_question
   - Problem: "plan_event" captures wedding planning + birthday planning + corporate, all treated identically
   - Missing: Event-aware intent variants (plan_wedding, plan_corporate, etc.)

3. **No Event-Aware System Prompt Variation**
   - Current: Single system prompt (1,200 words) for ALL interactions
   - Problem: Same prompt tells AI to "ask one question" for both a chatty user and a busy admin
   - Missing: Dynamic system prompt that adapts based on event context

4. **LLM/VEDA Always Treats User as New**
   - Current: Message comes in → build messages list → send to LLM
   - Problem: No "hello" to the LLM reminding it of the 5-turn history and what was already decided
   - Missing: Persistent "planning state brief" sent on every turn

5. **Vendor Search Decoupled from Planning**
   - Current: "Show me photographers" → vendor list
   - Current: "Plan my wedding" → budget breakdown
   - Problem: Never happens: "Plan my wedding with photographers in your budget"
   - Missing: Unified planning + discovery flow

6. **No Budget Optimization Loop**
   - Current: AI generates a budget once, then ignores it
   - Problem: User changes requirement → AI regenerates entire plan from scratch
   - Missing: Budget reallocation engine

7. **Context Extraction Happens, But No Planning**
   - Current: Parse "wedding, 300 guests, Hyderabad, ₹5L" → display as pills
   - Problem: Context pills are decorative; they don't drive the plan
   - Missing: Context → automatically generate plan without asking permission

8. **No Blocking Event Requirements**
   - Current: User says "wedding" → AI says "Got it"
   - Problem: But AI never explicitly constructs the wedding plan unless user says "plan"
   - Missing: Implicit planning trigger on sufficient context

---

## 5. CURRENT DATABASE DATA AVAILABLE TO PLANNER

### 5.1 Provider Profiles (Vendors)

**Table:** `provider_profiles` (Supabase)

**Columns (from ragRetriever.ts):**
```sql
id                    UUID
user_id               UUID (FK users)
profession            VARCHAR
stage_name            VARCHAR
full_name             VARCHAR
bio                   TEXT
city                  VARCHAR
price_min             DECIMAL
price_max             DECIMAL
average_rating        DECIMAL (0-5)
total_reviews         INT
total_bookings        INT
is_published          BOOLEAN
is_verified           BOOLEAN
is_available          BOOLEAN
experience_years      INT
cover_image_url       TEXT (storage URL)
avatar_url            TEXT (storage URL)
```

**RLS Rules:**
- ✅ Customers see published + verified vendors only
- ✅ Vendors see their own profile (full access)
- ✅ Admins see all profiles

**Vendor Search Capability:**
- ✅ Filter by profession (photographer, decorator, dj, etc.)
- ✅ Filter by city
- ✅ Filter by price_min ≤ customer_budget
- ✅ Filter by average_rating ≥ minimum_rating
- ✅ Sort by rating DESC, bookings DESC, verified DESC

### 5.2 Artist Categories

**Table:** `artist_categories` (Supabase)

**Columns:**
```sql
id                    UUID
name                  VARCHAR (e.g., "Photographer")
profession_type       VARCHAR (e.g., "photographer")
description           TEXT
icon                  VARCHAR (emoji or icon name)
is_active             BOOLEAN
sort_order            INT
```

**Current Usage:**
- ✅ Active categories displayed to users
- ✅ Mapped to vendor profession filter
- ✅ Used in artist marketplace

**Admin Event Packages Usage:**
- ✅ Categories linked via admin_event_package_inclusions
- ✅ Marks mandatory vs optional per package tier

### 5.3 Event Types

**Table:** `event_types` (Supabase)

**Columns:**
```sql
id                    UUID
name                  VARCHAR (Wedding, Birthday, Corporate, etc.)
description           TEXT
icon                  VARCHAR
slug                  VARCHAR
```

**Current Usage:**
- ✅ Browse by Event Type functionality
- ✅ EventPlanning page (/event/:eventId)
- ✅ Linked to Admin Event Packages

**8 Known Event Types:**
1. Wedding
2. Reception
3. Birthday
4. Corporate
5. Festival
6. Engagement
7. Anniversary
8. Religious Ceremony

### 5.4 Admin Event Packages (NEW - Phase 2B)

**Tables:**
```sql
admin_event_packages (
  id, event_type_id, tier, display_name, description,
  base_price, discount_percentage, final_price (GENERATED),
  max_category_selections, max_professionals_per_category,
  is_active, sort_order, created_at, updated_at, created_by
)

admin_event_package_inclusions (
  id, package_id, category_id, is_included, sort_order, created_at
)

admin_event_package_discounts (
  id, package_id, discount_percentage, reason,
  active_from, active_until, created_by, created_at
)

admin_event_package_bookings (
  id, customer_id, package_id, event_date, event_location,
  guest_count, package_price (snapshot), discount_applied (snapshot),
  final_price (snapshot), status, payment_status, created_at, updated_at
)
```

**RLS:**
- ✅ Admin: full CRUD on packages
- ✅ Customers: see is_active=true packages only
- ✅ Vendors: no access

**Tiers (per event type):**
- ✅ Silver
- ✅ Gold
- ✅ Platinum

---

## 6. CURRENT VENDOR RETRIEVAL FLOW

### Vendor Retrieval Happens Here:

**In `src/lib/llm.ts`:**

```typescript
export async function sendMessage(opts: SendOptions): Promise<SendResult> {
  // ... extract context, classify intent ...
  
  // STEP 1: Check for explicit vendor request
  const explicitVendorRequest = /\b(show|find|search|...|photographer|dj|...)\b/i.test(message);
  
  if (explicitVendorRequest) {
    const ragResult = await retrieveVendors(message, updatedContext, 12, {...});
    if (ragResult.vendors.length > 0) {
      // Return vendor list immediately
      return {
        fullText: "I found N vendors...",
        aiResponse: { type: 'vendor_results', data: { vendors } },
        updatedContext
      };
    }
  }
  
  // STEP 2: Check for discovery language ("find", "show", "recommend")
  const hasDiscoveryLanguage = /\b(find|show|search|recommend|...)\b/i.test(message);
  
  if (hasDiscoveryLanguage) {
    const ragResult = await retrieveVendors(message, updatedContext, 8, {...});
    // ... show results if found, otherwise continue planning ...
  }
  
  // STEP 3: If no vendor request, fall through to planning/VEDA
}
```

### Vendor Search Parameters (from `ragRetriever.ts`):

```typescript
async function sqlSearch(
  profession?: string,      // e.g., "photographer"
  city?: string,            // e.g., "Hyderabad"
  priceMax?: number,        // e.g., 80000 (from "under ₹80K")
  minRating = 0,            // e.g., 4.0 (from "highly-rated")
  limit = 8                 // 8-12 results
)
```

### Current Result Format:

```typescript
interface RAGResult {
  vendors: RetrievedVendor[];
  totalFound: number;
  searchMode: 'vector' | 'sql' | 'none';
  searchStatus: 'ok' | 'no_results' | 'not_requested' | 'technical_error';
  queryUsed: string;
  retrievedAt: string;
}

interface RetrievedVendor {
  provider_id: string;
  profession: string;
  stage_name?: string;
  full_name?: string;
  city?: string;
  price_min?: number;
  price_max?: number;
  average_rating: number;
  total_reviews: number;
  total_bookings: number;
  is_verified: boolean;
  is_available: boolean;
  // ... plus optional packages, menu_items, faqs ...
}
```

### Displayed in: `AIResponseCards` Component

- Shows vendor cards in a grid
- Each card has: photo, name, profession, city, price, rating
- "View Profile" / "Hire Now" buttons link to actual Vowza artist pages

### CRITICAL MISSING: Vendor Retrieval is NOT Triggered During Planning

**Current Problem:**
```
User: "I'm planning a wedding for 300 guests, ₹5L budget"
AI: "Got it. Your wedding budget is allocated as follows:
      Photography: ₹70K
      Decoration: ₹100K
      ..."
User: "Find me photographers under ₹80K"
AI: "I found 5 photographers in your budget"
```

**Desired (Missing):**
```
User: "I'm planning a wedding for 300 guests, ₹5L budget"
AI: "Based on your ₹5L budget, I recommend:
      Photography: ₹70K — I found 8 verified photographers
      Decoration: ₹100K — I found 12 verified decorators
      ..."
```

---

## 7. CURRENT PACKAGE RETRIEVAL FLOW

### Two Separate Package Systems

**A. Vendor Packages** (individual vendor-created):
- Located in `provider_packages` table (vendor can set their own package name/price/description)
- Managed by vendor in `/vendor/packages` admin panel
- Not currently integrated into Planner

**B. Admin Event Packages** (NEW - Phase 2B):
- Located in `admin_event_packages` table (Silver/Gold/Platinum tiers only)
- Managed by Vowza Admin at `/admin/event-packages`
- Shown to customers on `/event/:eventId` (Browse by Event Type)
- Integrated into EventPackageSelector component
- **Currently NOT integrated into Planner**

### Current Admin Event Package Flow

```
Customer browses "/event/:eventId" (e.g., Wedding)
    ↓
EventPlanning.tsx renders EventPackageSelector
    ↓
EventPackageSelector.tsx queries useEventPackagesByEventType()
    ↓
Hook queries admin_event_packages WHERE event_type_id = id AND is_active = true
    ↓
3 cards displayed (Silver, Gold, Platinum)
    ↓
Customer clicks card → modal opens
    ↓
Shows package details:
  - Tier badge + display_name
  - Base price + discount % + final_price
  - Mandatory inclusions (green, cannot remove)
  - Optional inclusions (amber, can remove max 2)
  ↓
Customer customizes optional inclusions (max 2 removals)
    ↓
Customer enters: event_date, location, guest_count
    ↓
Click "Book Package Now"
    ↓
Creates admin_event_package_bookings row
    ↓
Booking confirmed
```

### CRITICAL MISSING: Packages NOT in Planner Context

**Current Problem:**
- Admin packages exist but Planner doesn't know about them
- Customer cannot say "show me wedding packages"
- Planner cannot recommend Silver vs Gold vs Platinum
- Planner cannot integrate packages into budget breakdown

---

## 8. CURRENT CONVERSATION/MEMORY FLOW

### How State Persists Across Turns

**Unauthenticated Users:**
```
Browser → sessionStorage (temporary, lost on refresh)
  ├─ vowza_ai_context: { eventType, city, budget, guestCount, ... }
  └─ vowza_ai_conv_id: null (no DB persistence)
```

**Authenticated Users:**
```
Browser → Supabase database
  ├─ conversations table
  │   └─ context_summary: { eventType, city, budget, ... }
  ├─ conversation_messages table
  │   └─ role: 'user' | 'assistant'
  │   └─ content: message text
  │   └─ response_json: structured response metadata
  └─ sessionStorage (cache for current turn)
```

### Context Persistence Steps

**On Mount:**
1. Check Supabase for user profile
2. Query `conversations` table for this user
3. Get stored conversation_id from sessionStorage
4. If exists: load `context_summary` from conversation row
5. Set `contextRef.current = context_summary`
6. Render context pills (event type, city, budget, guests)

**On New Message:**
1. Parse message for event context (city, budget, guests, event type)
2. Merge parsed context into `contextRef`
3. Update sessionStorage
4. Send to AI (via sendMessage)
5. Save message to DB

**Response Handling:**
```typescript
await sendMessage({
  message: userText,
  history: messagesRef.current,  // Last 20 turns
  context: contextRef.current,   // Current planning context
  onChunk: (delta) => { ... }    // Stream handler
}).then(res => {
  // res.updatedContext ← AI may have extracted MORE context
  contextRef.current = res.updatedContext;
  setContext(res.updatedContext);
  
  // Save to DB
  if (currentConvId && user) {
    updateConversation(convId, { context_summary: res.updatedContext });
  }
});
```

### Current Context Struct

```typescript
interface PlannerContext {
  eventType?: 'wedding' | 'birthday' | 'corporate' | ...
  city?: string
  budget?: number
  guestCount?: number
  eventDate?: string
  durationDays?: number
  religion?: string
  venueType?: 'indoor' | 'outdoor' | 'both'
  luxuryLevel?: 'budget' | 'standard' | 'premium' | 'luxury'
  theme?: string
  colorPalette?: string
  foodPreference?: 'veg' | 'non-veg' | 'both'
  // ... 10+ other fields
}
```

### PROBLEM: Context Not Used for Decision-Making

**Current:**
- Context extracted ✅
- Context persisted ✅
- Context displayed ✅
- **Context NOT used to drive planning decisions** ❌

**What's Missing:**
- No "IF context.budget > 500000 AND context.guestCount > 200 THEN recommend Platinum package"
- No automatic plan generation when sufficient context detected
- No budget reallocation when context changes
- No intelligent follow-up questions based on what's already known

---

## 9. SECURITY ANALYSIS

### Current Security Measures

**✅ Good:**
1. Groq API key stays server-side (VITE_GROQ_API_KEY never in browser)
2. Edge Function validates auth token before accepting messages
3. Supabase RLS enforces vendor visibility rules
4. No vendor data fabricated (only real DB vendors shown)

**⚠️ Areas to Monitor:**

1. **Prompt Injection:** LLM sees user messages directly. Could a user craft a message that makes AI bypass rules?
   - Current mitigation: System prompt includes "RULES" section
   - Needed: Sanitize user message before feeding to LLM

2. **Context Injection:** Admin event package data could be crafted maliciously
   - Current mitigation: RLS policies prevent unauthorized edits
   - Needed: Never trust client-side package data; always re-fetch from DB

3. **Vendor Impersonation:** Could someone craft a fake vendor card?
   - Current mitigation: Only real vendors from DB are shown
   - Needed: Always validate provider_id against Supabase

### Recommended Additions

- Sanitize user messages before LLM
- Rate-limit message sending per user
- Log suspicious prompts (very long, repeated commands, etc.)
- Never show vendor contact info that could be forged

---

## 10. PROPOSED VOWZA AI ARCHITECTURE

### 10.1 New Planning State Machine

```
INPUT MESSAGE
    ↓
INTENT DETECTION (existing)
    ↓
CONTEXT EXTRACTION (existing)
    ↓
┌─────────────────────────────────────────────────┐
│ NEW: PLANNING STATE MANAGER                      │
├─────────────────────────────────────────────────┤
│ • Check: Do we have MINIMUM context?             │
│   (event_type + ONE of: city, budget, guests)   │
│ • If YES: Enter PLANNING MODE                    │
│   - Generate complete event plan                 │
│   - Allocate budget per category                 │
│   - Recommend vendors for each category          │
│   - Show Admin Event Packages if applicable      │
│ • If NO: Ask ONE focused question                │
│   (never re-ask something we already know)       │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ NEW: UNIFIED DISCOVERY + PLANNING LOOP           │
├─────────────────────────────────────────────────┤
│ • If user says "find vendors" → RAG query       │
│   Show results in context of planned budget     │
│ • If user says "adjust budget" → recalculate   │
│ • If user says "prioritize X" → re-rank vendors│
│ • If user says "what if..." → simulate change  │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ NEW: ADMIN EVENT PACKAGE INTEGRATION             │
├─────────────────────────────────────────────────┤
│ • When event_type known: check for packages     │
│ • If packages exist: recommend tier              │
│   "For your ₹5L budget, Gold is recommended"   │
│ • Show package + vendors side-by-side           │
│ • Support package customization in flow         │
└─────────────────────────────────────────────────┘
    ↓
RESPONSE GENERATION (enhanced)
    ↓
STREAM + PERSIST
```

### 10.2 New System Prompt Structure

**Instead of:**
- Single 1,200-word prompt for all scenarios

**New:**
- Dynamic system prompt built per turn
- Includes:
  - Base Vowza Planner rules
  - Current planning context
  - Relevant budget allocations
  - Recommended next action
  - Current packages (if available)

Example:
```
You are Vowza Planner.

CURRENT EVENT CONTEXT:
- Event: Wedding
- Location: Hyderabad
- Budget: ₹5,00,000
- Guests: 300

BUDGET ALLOCATION:
- Photography: ₹70,000 (PRIORITY: HIGH)
- Decoration: ₹1,00,000
- Catering: ₹1,80,000
- DJ: ₹25,000
- Makeup: ₹30,000
- Contingency: ₹45,000

AVAILABLE PACKAGES:
- Silver Wedding Package: ₹50,000
- Gold Wedding Package: ₹80,000
- Platinum Wedding Package: ₹1,50,000

USER'S NEXT ACTION:
User is asking about vendors OR trying to adjust budget.
Provide SPECIFIC recommendations tied to the plan above.
Never ask generic questions we've already answered.
```

### 10.3 New Budget Allocation Engine

```typescript
interface BudgetAllocation {
  category: string;           // Photography, Catering, etc.
  basePercentage: number;     // 14% for photography
  allocatedAmount: number;    // ₹70,000
  minAmount: number;          // ₹50,000
  maxAmount: number;          // ₹100,000
  canAdjust: boolean;         // true
  vendors: DBVendor[];        // Real vendors in this budget
  packages: AdminEventPackage[]; // Matching packages (if any)
}

class EventBudgetPlanner {
  allocate(eventType, budget, guestCount): BudgetAllocation[]
  // Intelligently splits budget based on event type + guest count
  
  rebalance(allocations, newBudget): BudgetAllocation[]
  // Recalculates when customer adjusts total budget
  
  prioritize(allocations, priorities): BudgetAllocation[]
  // Re-ranks vendors/packages based on customer priorities
}
```

### 10.4 New Trade-Off Engine

```typescript
interface BudgetOptimization {
  currentTotal: number;
  targetTotal: number;
  gap: number;
  options: TradeOffOption[];
}

interface TradeOffOption {
  name: string;              // "Reduce decoration"
  saves: number;             // ₹40,000
  impact: string;            // "Guests will still enjoy"
  alternative: string;       // "Choose simpler venue decor"
  priority: 'low' | 'medium' | 'high'; // Can safely reduce?
}

// If budget exceeded:
const gap = planTotal - customerBudget;
const options = generateTradeOffs(allocations, gap);
// Display: "Your plan exceeds budget by ₹80,000. Here are options..."
// - Option A: Reduce decoration by ₹40,000
// - Option B: Choose Silver DJ package instead of premium
// - Option C: Combination of A + B
```

### 10.5 New Package Integration

```typescript
class AdminEventPackageMatcher {
  recommendPackage(
    eventType: string,
    budget: number,
    guestCount: number
  ): AdminEventPackage | null
  // Returns best-fit tier (Silver/Gold/Platinum)
  
  comparePackages(
    packages: AdminEventPackage[],
    context: PlannerContext
  ): PackageComparison
  // Compares tiers with customer's priorities
  
  integratePackageIntoPlan(
    plan: EventPlan,
    selectedPackage: AdminEventPackage,
    customizations: string[] // removed inclusions
  ): EventPlan
  // Merges package into overall plan
}
```

---

## 11. EXACT FILES THAT WOULD NEED CHANGES

### 11.1 New Files to Create

```
src/lib/eventBudgetPlanner.ts          (NEW - Budget allocation)
src/lib/tradeOffEngine.ts              (NEW - Budget optimization)
src/lib/planningStateMachine.ts        (NEW - State machine)
src/lib/packageMatcher.ts              (NEW - Admin package integration)
src/hooks/useEventPlan.ts              (NEW - Plan state hook)
src/components/ai/PlanningCards.tsx    (NEW - Display plan + vendors)
src/components/ai/TradeOffModal.tsx    (NEW - Budget trade-off UI)
src/components/ai/PackageComparison.tsx(NEW - Package tier display)
```

### 11.2 Existing Files to Modify

```
src/lib/llm.ts                         (MODIFY - Route to planning state machine)
src/lib/aiOrchestrator.ts              (MODIFY - Add planning state detection)
src/lib/aiPlanner.ts                   (MODIFY - Integrate budget planner)
src/lib/ragRetriever.ts                (MODIFY - Link vendors to budget allocations)
src/components/ai/useAIChat.ts         (MODIFY - Pass plan state to sendMessage)
src/lib/aiPlannerTypes.ts              (MODIFY - Add BudgetAllocation, TradeOff types)
src/pages/AIPlanner.tsx                (MODIFY - Display plan cards)
```

### 11.3 Files NOT to Touch

```
✓ src/api/*
✓ src/contexts/AuthContext.tsx
✓ src/contexts/CartContext.tsx
✓ src/pages/EventPlanning.tsx           (admin packages already there)
✓ src/pages/admin/AdminEventPackages.tsx
✓ src/hooks/useEventPackages.ts
✓ src/components/EventPackageSelector.tsx
✓ Authentication + Authorization
✓ Browse Artists
✓ Vendor packages (vendor-created)
✓ Existing booking system
```

---

## 12. DATABASE/RPC CHANGES REQUIRED

### 12.1 New RPC Functions Needed

```sql
-- NEW: Get best-fit Admin Event Package for customer context
CREATE OR REPLACE FUNCTION match_admin_event_package(
  p_event_type_id UUID,
  p_budget INT,
  p_guest_count INT
) RETURNS admin_event_packages AS $$
-- Returns Silver/Gold/Platinum tier recommendation
$$;

-- EXISTING: search_vendors_sql already handles vendor retrieval
-- EXISTING: retrieveActiveMarketplaceCategories already gets categories
```

### 12.2 Existing Tables to Query (No Schema Changes Needed)

```
✓ provider_profiles (vendors)
✓ artist_categories (categories)
✓ event_types (Wedding, Birthday, etc.)
✓ admin_event_packages (NEW - already created in Phase 2B)
✓ admin_event_package_inclusions (NEW - already created)
✓ admin_event_package_bookings (NEW - already created)
✓ conversations (existing)
✓ conversation_messages (existing)
```

### 12.3 NO Schema Migrations Required

- ✅ Admin Event Packages tables already exist
- ✅ Event types already exist
- ✅ Provider profiles already exist
- ✅ Artist categories already exist

---

## 13. IMPLEMENTATION PHASES

### Phase 2A: Foundation (Planning State Machine)
1. Create `eventBudgetPlanner.ts` (budget allocation logic)
2. Update `aiOrchestrator.ts` to detect planning state
3. Update `llm.ts` to route to planning state machine
4. Test: User provides event + budget → system generates plan

### Phase 2B: Vendor Integration
1. Update `ragRetriever.ts` to link vendors to budget allocations
2. Create `PackageComparison.tsx` component
3. Update `useAIChat.ts` to pass plan state
4. Test: Plan shows recommended vendors for each category

### Phase 2C: Admin Packages Integration
1. Create `packageMatcher.ts` (match Silver/Gold/Platinum)
2. Integrate into planning flow
3. Update response cards to show packages alongside vendors
4. Test: Wedding plan recommends Gold package at ₹80K

### Phase 2D: Trade-Off Engine
1. Create `tradeOffEngine.ts` (budget optimization)
2. Create `TradeOffModal.tsx` UI
3. Detect budget overages, show alternatives
4. Test: User changes budget → system recalculates

### Phase 2E: What-If Simulation
1. Extend planning state to support "what-if" tracking
2. Allow customer to ask "what if I add 100 guests?"
3. Recalculate all budgets without modifying plan
4. Test: User asks "what if..." → see impact

### Phase 2F: Polish & Optimization
1. Refine system prompt
2. Add soft follow-up questions
3. Optimize performance
4. Test: Demo scenario works end-to-end

---

## 14. EXACT DEMO SCENARIO TEST PLAN

### Demo Flow (Must Work End-to-End)

**Turn 1: Customer describes event**
```
User: "I'm planning a wedding in Hyderabad for 300 guests. 
       My budget is ₹5 lakh. I want traditional decoration, 
       good food, photography and DJ."

Expected AI Response:
✅ Extracts: event=wedding, city=Hyderabad, guests=300, budget=₹5L
✅ Detects: required services (decoration, catering, photography, dj)
✅ Generates: Complete wedding plan with:
   - Budget breakdown (photography ₹70K, decoration ₹100K, etc.)
   - 5 real photographers under ₹70K (from DB)
   - 3 real decorators under ₹100K (from DB)
   - Best-fit Admin Package recommendation (likely Gold ₹80K)
   - Timeline (6 months before → event day)
   - Checklist (what to book when)
✅ Displays: Plan cards + vendor cards + package recommendation
```

**Turn 2: Customer reprioritizes**
```
User: "Photography is the most important."

Expected AI Response:
✅ Recalculates: photography budget → ₹90K (from ₹70K)
✅ Rebalances: decoration → ₹85K, other categories adjusted
✅ Re-retrieves: top 8 photographers under ₹90K (ranked by rating)
✅ Re-shows: new vendors + updated budget breakdown
✅ Does NOT ask: "What type of event?" or other known questions
✅ Suggests: "Photography budget increased to ₹90K. 
             Consider Gold package (₹80K) for enhanced features."
```

**Turn 3: Customer removes DJ**
```
User: "Remove DJ and put that money into decoration."

Expected AI Response:
✅ Removes: DJ from required services
✅ Reallocates: DJ budget ₹25K → decoration ₹110K
✅ New total: ₹475K (saved ₹25K)
✅ Re-shows: updated budget breakdown
✅ Updates: decoration vendor recommendations (now ₹110K budget)
✅ Acknowledges: "Done. Decoration budget increased to ₹110K. 
                 I found 12 decorators in this range."
```

**Turn 4: Filter photographers by budget**
```
User: "Show me photographers under ₹80,000."

Expected AI Response:
✅ Retrieves: photographers where price_min ≤ ₹80,000
✅ Filters: already in Hyderabad (known from context)
✅ Ranks: by rating + total_bookings
✅ Shows: 6-8 vendor cards with real data
✅ None fabricated: every card has real provider_id from DB
```

**Turn 5: Recommendation & comparison**
```
User: "Which photographer is best for my wedding?"

Expected AI Response:
✅ Analyzes: context (traditional wedding, 300 guests, ₹80K budget)
✅ Recommends: "Photographer X is best because:
              - 4.8★ rating (120+ reviews)
              - Specializes in traditional weddings
              - ₹75K within your budget
              - 1,200+ weddings shot
              - Based in Hyderabad
              [View Profile] [Book Now]"
✅ Explains: WHY this photographer, not generic text
```

**Turn 6: Booking**
```
User: "Book this photographer."

Expected AI Response:
✅ Does NOT auto-book: says "Great choice! 
   You can now book via their profile on Vowza."
✅ Initiates: existing Vowza booking flow (NO new booking system)
✅ Links: to /artist/{provider_id} with pre-filled event context
```

---

## 15. RISKS & THINGS THAT MUST NOT BE TOUCHED

### 🚨 High-Risk Areas (Do NOT Break)

1. **Authentication & Authorization**
   - ✗ DO NOT modify AuthContext
   - ✗ DO NOT change RLS policies
   - ✗ DO NOT expose service-role keys

2. **Existing Booking System**
   - ✗ DO NOT modify event_bookings table
   - ✗ DO NOT change booking flow
   - ✗ DO NOT modify payment integration

3. **Vendor Packages**
   - ✗ DO NOT merge vendor packages with Admin packages
   - ✗ DO NOT modify vendor_packages table
   - ✗ DO NOT change vendor package CRUD

4. **Admin Event Packages (Phase 2B)**
   - ✗ DO NOT modify the 4 tables already created
   - ✗ DO NOT change RLS policies
   - ✗ DO NOT modify AdminEventPackages.tsx UI

5. **Browse Artists & Categories**
   - ✗ DO NOT modify Browse Artists functionality
   - ✗ DO NOT change CategoryPage
   - ✗ DO NOT alter category filtering

6. **Homepage & Promotions**
   - ✗ DO NOT modify Index.tsx
   - ✗ DO NOT change promotional materials
   - ✗ DO NOT alter Hero section

### ✅ Safe to Modify

- ✅ LLM system prompt
- ✅ Orchestrator intent classification
- ✅ Context extraction
- ✅ Vendor retrieval logic
- ✅ Response generation
- ✅ Chat UI/UX (new cards, layouts)
- ✅ Planning state (new files)

### 📋 Required Verification After Each Phase

1. **npm run build** → 0 errors
2. **Vendor packages still work** (test /vendor/packages)
3. **Browse Artists still works** (test /artists)
4. **Admin Event Packages still work** (test EventPackageSelector)
5. **Existing bookings still work** (test /my-bookings)
6. **Auth still works** (test login/logout)

---

## SUMMARY: WHY CURRENT PLANNER IS GENERIC

| Issue | Current Behavior | Root Cause | Missing Component |
|-------|-----------------|-----------|------------------|
| Re-asks known info | "What's your budget?" (already stated) | No memory of stated context | Persistent context in system prompt |
| No budget allocation | Generic "good budget" text | No budget engine | EventBudgetPlanner |
| Vendors & plan separate | "Here are 5 vendors" OR "Your plan is..." | Vendor search decoupled | Integrated discovery |
| No real-time recalculation | Regenerates entire plan | No update engine | PlanningStateMachine |
| No trade-offs | "Budget exceeded, sorry" | No optimization | TradeOffEngine |
| Admin packages not mentioned | Packages exist in DB but AI doesn't know | No integration | PackageMatcher |
| Chatbot-like responses | "What would you like?" | No context-driven decisions | StateMachine → auto-plan |

---

## NEXT STEPS

**After User Approves This Inspection:**

1. User confirms architecture is understood
2. User approves proposed implementation phases
3. Move to **PHASE 2A: Implement Planning State Machine**
4. Create `eventBudgetPlanner.ts` with intelligent budget allocation
5. Update llm.ts to use new state machine
6. Test with demo scenario
7. Iterate through phases 2B-2F

**DO NOT:**
- ✗ Start coding before user approval
- ✗ Modify database schemas
- ✗ Break existing features
- ✗ Deploy automatically

---

**Inspection Complete**  
**Status:** Ready for User Review & Approval  
**No Changes Made to Codebase**
