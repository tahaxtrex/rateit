# RATEIT

**You are a senior full-stack engineer and startup architect.
Your task is to design and implement a production-ready MVP web application.**

### 🧠 Project Idea (Context)

Build an **AI-powered university insights platform** targeted at **underrepresented / developing markets** (e.g. Morocco,), where official rankings do NOT reflect real student life.

The platform allows **students and alumni** to:

- Submit **structured, and unstructured anonymous feedback** about universities
- Ask an **AI assistant** questions like:
    - “What is student life like at University X?”
    - “Are dorms good?”
    - “What is the cost of living like?”
    - “What is the academic workload like?”
    - “What is the social life like?”
    - "can i change my schedule?"
    - “How is food, lifestyle, social life?”
- Receive **balanced, synthesized answers** generated from real student feedback (not single opinions).

This is **NOT** e-commerce, NOT professor-rating, and NOT a generic forum.

---

### 🎯 Core Goals

1. Provide **realistic, crowd-sourced insights** about universities
2. Avoid ML fine-tuning or expensive AI infrastructure
3. Be **scalable, fast, and cheap**
4. Be suitable for early-stage founders with **web dev skills only**

---

### 🧱 Functional Requirements

### 1. User Feedback System

- Users can submit feedback **anonymously**
- Feedback could be structured or unstructured but should have obligatory fields with categories:
    - University name
    - Category (Dorms, Food, Academics, Social Life, Admin, Cost of Living, etc.)
    - Rating (1–5)
    - full uni overview
- Store feedback in a database

### 2. Content Moderation & Quality Control

Implement **automated filtering**:

- Detect & reject:
    - Hate speech
    - Profanity
    - Off-topic content
    - Personal attacks
    - names of people
- Detect **outliers**:
    - Very extreme opinions that contradict the majority
- Flag (not delete) suspicious feedback

No human moderation needed initially.

---

### 🤖 AI System (IMPORTANT)

### AI Constraints

- **NO fine-tuning**
- **NO training**
- Use **Gemini AI API**
- Treat the AI as a **reasoning + summarization layer**

### Architecture (MANDATORY)

Use **RAG-style design**, not raw prompting:

1. Store user feedback in the database
2. Pre-aggregate data:
    - Per university
    - Per category
    - Compute:
        - Average rating
        - Common themes
        - Frequency of complaints/praise
3. When a user asks a question:
    - Retrieve relevant chunks
    - Pass **summarized statistics + representative samples** to Gemini
    - Ask Gemini to:
        - Generate a **balanced response**
        - Explicitly mention diversity of opinions
        - Down-weight rare/extreme cases

⚠️ The AI must **never scan the entire database live**.

---

### 🧠 AI Prompting Rules

When querying Gemini:

gemeni should always sound friendly and helpful, as if it was a normal conversation with a chill friend.

- Always include:
    - Aggregated stats
    - Category breakdown
- Force neutral language:
    - “Most students report…”
    - “Some students mention…”
    - “A minority experienced…”
- The AI must NEVER:
    - State opinions as facts
    - Name individuals
    - Encourage harassment

---

### 🖥️ Tech Stack (You Decide, but keep it simple)

- Frontend: Reactjs
- Backend: Node.js / API routes
- Database: PostgreSQL on RDB aws
- AI: Gemini API
- Hosting: AWS servicese

No overengineering.

---

### 🚀 Performance & Scaling

- Cache AI responses per university
- Re-generate summaries periodically (cron/job)
- Use pagination for feedback
- Optimize for **low-cost operation**

---

### 🔐 Legal & Ethical Constraints

- Add disclaimer:
    
    > “AI-generated summaries based on user-submitted experiences.”
    > 

---


### 🧭 Final Instruction

Build this as a **serious MVP**, not a demo.

Focus on:

- Correct architecture
- Clean separation of concerns
- Real-world constraints
- Founder-friendly maintainability