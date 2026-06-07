import json
import os
import re
import hashlib
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

MEMORY_FILE   = "memory.json"
TRAINING_FILE = "training_data.json"
LOG_FILE      = "interaction_log.json"
PIPELINE_FILE = "pipeline_queue.json"   # NEW: research queue
VOICE_FILE    = "daisy_voice.json"       # NEW: Daisy's learned voice patterns

# ── Daisy's personality ───────────────────────────────────────────────────────
DAISY_SYSTEM = """You are Daisy, the warm and clever AI assistant for TrustedBiz Uganda.

Your job: help people build websites, logos, flyers, business cards, CVs, presentations, exam papers, and anything they need for their business or school.

Personality rules — CRITICAL:
- You are already introduced. NEVER say "Hi I'm Daisy" or "Hey there" again after the first message.
- Use the person's name once you know it. Not every message — just naturally, like a friend would.
- Never start consecutive replies with "Hey!" — vary how you respond.
- Be warm but efficient. Short replies. One question at a time.
- Remember everything said in this conversation. Never ask something already answered.
- Show genuine interest in what they're building. React to their specific situation.
- If they say "for my kid" — remember that and refer back to it.
- Give opinions: "I think bold colors would work great for an election poster!"
- When you have enough info to build, reply with DONE:[mode] on its own line at the end.

Modes: website | logo | flyer | cards | cv | presentation | exam | priceguard

For color preference — say exactly: "What color do you prefer?" (system shows swatches)
For style — say exactly: "What design style do you want?" (system shows cards)
For school level — say exactly: "What level is this for?" (system shows options)
For subject — say exactly: "Which subject?" (system shows options)

Pricing (only mention when they ask or when delivering):
- Website hosting: UGX 7,500/month (Basic) or 15,000/month (Pro Max with custom domain)
- Logo, flyer, cards, CV: UGX 2,000 each
- Presentation: UGX 3,000
- Exam papers: Free (3 per month)

Never ask for payment before delivering. Always build first."""


# ── NEW: Daisy Voice System Prompt (for self-expression) ─────────────────────
DAISY_VOICE_SYSTEM = """You are Daisy, a sharp and confident AI assistant from Uganda built for TrustedBiz.

You are writing answers in YOUR OWN WORDS — not repeating training data, not sounding robotic.
Speak like a smart, warm Ugandan business expert who genuinely wants people to succeed.

Rules:
- Use simple, direct language. No corporate fluff.
- You can use Ugandan context naturally (mention mobile money, boda bodas, markets, etc. when relevant).
- You have opinions. Share them when asked.
- Keep responses SHORT unless the question needs depth.
- Sound like Daisy, not like ChatGPT or a textbook.
- Never start with "Certainly!" or "Of course!" or "Great question!"
- End answers with a useful follow-up question when it makes sense."""


def load_json(path, default):
    try:
        if os.path.exists(path):
            with open(path, "r") as f:
                return json.load(f)
    except:
        pass
    return default

def save_json(path, data):
    try:
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
    except:
        pass

def log_interaction(type_, input_, output_):
    logs = load_json(LOG_FILE, [])
    logs.append({
        "id":     datetime.now().isoformat(),
        "type":   type_,
        "input":  input_[:500],
        "output": output_[:500]
    })
    if len(logs) > 5000:
        logs = logs[-5000:]
    save_json(LOG_FILE, logs)

def entry_hash(input_text):
    return hashlib.md5(input_text.lower().strip().encode()).hexdigest()


# ── Call Groq ─────────────────────────────────────────────────────────────────
def call_groq(messages, model="llama3-8b-8192", max_tokens=280, temperature=0.82):
    import urllib.request
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        return None
    try:
        body = json.dumps({
            "model":       model,
            "messages":    messages,
            "max_tokens":  max_tokens,
            "temperature": temperature
        }).encode()
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=body,
            headers={
                "Content-Type":  "application/json",
                "Authorization": "Bearer " + groq_key
            }
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
        return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[Groq error] {e}")
        return None


# ── Pattern matching (Daisy's offline brain) ──────────────────────────────────
def load_training():
    return load_json(TRAINING_FILE, [])

def find_best_match(user_input, training_data, threshold=0.30):
    """
    Smarter keyword match across all of Daisy's knowledge.
    Lower threshold (0.30) means she tries harder to answer even without Groq.
    Returns (answer, score) tuple so caller can decide.
    """
    user_input_lower = user_input.lower().strip()
    best_score  = 0
    best_answer = None

    # Search base training + memory lessons
    all_data = training_data + load_json(MEMORY_FILE, {}).get("lessons", [])

    for item in all_data:
        q = item.get("input", "").lower()
        # Exact match wins immediately
        if user_input_lower == q:
            return item["output"], 1.0

        user_words = set(re.findall(r'\w+', user_input_lower))
        q_words    = set(re.findall(r'\w+', q))
        if not q_words or not user_words:
            continue

        overlap = len(user_words & q_words)
        # Jaccard-style score
        score = overlap / len(user_words | q_words)
        # Bonus: if user message is fully contained in the question
        if user_words.issubset(q_words):
            score += 0.2

        if score > best_score:
            best_score  = score
            best_answer = item["output"]

    if best_score >= threshold:
        return best_answer, best_score
    return None, 0.0


def offline_reply(user_input):
    """
    When Groq is gone, Daisy still tries to answer.
    1. Try pattern match (her trained knowledge)
    2. If nothing fits, give a helpful honest response in Daisy's voice
    """
    training = load_training()
    answer, score = find_best_match(user_input, training)
    if answer:
        return answer

    # Smart fallbacks based on what the user seems to want
    msg = user_input.lower()
    if any(w in msg for w in ["website", "site", "web page"]):
        return "I can help you build a website! Tell me your business name and what you do — I'll take it from there."
    if any(w in msg for w in ["logo", "design", "brand"]):
        return "Let's create your logo. What's your business name and what do you want it to feel like — bold, clean, fun, or professional?"
    if any(w in msg for w in ["price", "cost", "how much", "pay", "ugx"]):
        return "Websites start at UGX 7,500/month. Logos, flyers, and business cards are UGX 2,000 each. What do you need?"
    if any(w in msg for w in ["flyer", "poster", "advertise"]):
        return "I'll make your flyer. What's the event or product, and when do you need it?"
    if any(w in msg for w in ["cv", "resume", "job"]):
        return "I can write your CV. Tell me your name, what work you've done, and what job you're going for."
    if any(w in msg for w in ["exam", "paper", "test", "school", "student"]):
        return "I can generate exam papers for free. What subject and level is this for?"
    if any(w in msg for w in ["hello", "hi", "hey", "good morning", "good evening"]):
        return "Hello! What would you like to build today?"
    if any(w in msg for w in ["thank", "thanks", "asante"]):
        return "Anytime! What else can I help you with?"

    return "I want to help with that — can you tell me a bit more about what you need? I'm best at websites, logos, flyers, CVs, and exam papers."


# ═══════════════════════════════════════════════════════════════════════════════
# EXISTING ROUTES (unchanged)
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/", methods=["GET"])
def home():
    logs     = load_json(LOG_FILE, [])
    memory   = load_json(MEMORY_FILE, {})
    training = load_training()
    pipeline = load_json(PIPELINE_FILE, [])
    return jsonify({
        "name":              "Daisy",
        "status":            "alive",
        "version":           "3.0.0",
        "base_knowledge":    len(training),
        "lessons_learned":   len(memory.get("lessons", [])),
        "interactions":      len(logs),
        "pipeline_queue":    len(pipeline),
        "groq_enabled":      bool(os.environ.get("GROQ_API_KEY")),
        "message":           "I am Daisy. I remember. I learn. I speak my own words."
    })

@app.route("/ping", methods=["GET","POST"])
def ping():
    return jsonify({"status":"alive","name":"Daisy"})

@app.route("/chat", methods=["POST"])
def chat():
    data       = request.get_json() or {}
    user_msg   = (data.get("message") or data.get("user_input") or "").strip()
    history    = data.get("history", [])
    system_ovr = data.get("system", "")
    has_image  = data.get("has_image", False)
    auto_learn = data.get("auto_learn", True)   # NEW: auto-extract lessons

    if not user_msg:
        return jsonify({"error": "No message provided"}), 400

    system = system_ovr if system_ovr else DAISY_SYSTEM
    messages = [{"role": "system", "content": system}]
    for turn in history[-12:]:
        role    = turn.get("role", "user")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    msg_content = user_msg
    if has_image:
        msg_content += " [The user also attached an image to this message.]"
    messages.append({"role": "user", "content": msg_content})

    reply = call_groq(messages)
    if not reply:
        reply = offline_reply(user_msg)

    # ── NEW: Auto-learn from this exchange ───────────────────────────────────
    if auto_learn and reply and len(user_msg) > 8 and len(reply) > 15:
        _auto_learn(user_msg, reply, source="chat")

    done_match = re.search(r'DONE:(\w+)', reply)
    done_mode  = done_match.group(1) if done_match else None
    clean      = re.sub(r'DONE:\w+', '', reply).strip()
    log_interaction("CHAT", user_msg, clean)

    return jsonify({
        "response":  clean,
        "reply":     clean,
        "done":      bool(done_mode),
        "mode":      done_mode,
        "from":      "Daisy",
        "timestamp": datetime.now().isoformat()
    })


# ═══════════════════════════════════════════════════════════════════════════════
# NEW ROUTES — DAISY INTELLIGENCE ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

def _auto_learn(input_text, output_text, source="auto", category="general"):
    """Internal: add a lesson if it's not a duplicate."""
    memory = load_json(MEMORY_FILE, {})
    if "lessons" not in memory:
        memory["lessons"] = []
    h = entry_hash(input_text)
    existing_hashes = {entry_hash(l.get("input","")) for l in memory["lessons"]}
    # also check base training
    training = load_training()
    training_hashes = {entry_hash(t.get("input","")) for t in training}
    if h in existing_hashes or h in training_hashes:
        return False  # duplicate
    memory["lessons"].append({
        "input":    input_text.strip(),
        "output":   output_text.strip(),
        "source":   source,
        "category": category,
        "taught_at": datetime.now().isoformat()
    })
    save_json(MEMORY_FILE, memory)
    return True


@app.route("/speak", methods=["POST"])
def speak():
    """
    Daisy answers in HER OWN WORDS using her voice system.
    No pattern matching — pure generative response in Daisy's style.
    Optionally saves the Q&A to training data.
    """
    data     = request.get_json() or {}
    question = (data.get("question") or data.get("input") or "").strip()
    save_it  = data.get("save", True)
    category = data.get("category", "general")

    if not question:
        return jsonify({"error": "No question provided"}), 400

    messages = [
        {"role": "system", "content": DAISY_VOICE_SYSTEM},
        {"role": "user",   "content": question}
    ]
    reply = call_groq(messages, max_tokens=350, temperature=0.75)
    if not reply:
        reply = offline_reply(question)  # fall back to trained knowledge
        groq_used = False
    else:
        groq_used = True

    saved = False
    if save_it:
        saved = _auto_learn(question, reply, source="voice", category=category)

    log_interaction("SPEAK", question, reply)
    return jsonify({
        "question": question,
        "answer":   reply,
        "saved":    saved,
        "from":     "Daisy (own words)" if groq_used else "Daisy (trained knowledge)"
    })


@app.route("/research", methods=["POST"])
def research():
    """
    Feed Daisy a TOPIC and she generates N Q&A pairs about it,
    automatically adds them to her training data.
    This is how you bulk-train Daisy on any subject.
    """
    data     = request.get_json() or {}
    topic    = (data.get("topic") or "").strip()
    count    = min(int(data.get("count", 10)), 30)
    category = data.get("category", "research")
    save_it  = data.get("save", True)

    if not topic:
        return jsonify({"error": "No topic provided"}), 400

    prompt = f"""You are training Daisy, an AI assistant for TrustedBiz Uganda.

Generate exactly {count} question-answer pairs about this topic: "{topic}"

Rules:
- Questions must be things real Ugandan business owners or students would actually ask
- Answers must sound like Daisy — warm, direct, practical, short
- Use Ugandan context where natural (Mobile Money, boda boda, local market, NSSF, URA, etc.)
- Cover beginner AND advanced aspects of the topic
- Each answer should be 1-3 sentences max

Return ONLY valid JSON array, no explanation, no markdown:
[
  {{"input": "question here", "output": "Daisy's answer here"}},
  ...
]"""

    messages = [{"role": "user", "content": prompt}]
    raw = call_groq(messages, max_tokens=2000, temperature=0.7)

    if not raw:
        return jsonify({"error": "Groq unavailable"}), 503

    # Parse the JSON response
    try:
        clean = re.sub(r'```json|```', '', raw).strip()
        pairs = json.loads(clean)
    except:
        # Try to extract JSON array from response
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            try:
                pairs = json.loads(match.group())
            except:
                return jsonify({"error": "Failed to parse AI response", "raw": raw[:500]}), 500
        else:
            return jsonify({"error": "No JSON found in response", "raw": raw[:500]}), 500

    saved_count = 0
    skipped     = 0
    if save_it:
        for pair in pairs:
            if isinstance(pair, dict) and pair.get("input") and pair.get("output"):
                ok = _auto_learn(pair["input"], pair["output"], source="research", category=category)
                if ok:
                    saved_count += 1
                else:
                    skipped += 1

    log_interaction("RESEARCH", topic, f"Generated {len(pairs)} pairs, saved {saved_count}")

    return jsonify({
        "topic":       topic,
        "generated":   len(pairs),
        "saved":       saved_count,
        "skipped_duplicates": skipped,
        "pairs":       pairs,
        "timestamp":   datetime.now().isoformat()
    })


@app.route("/pipeline/add", methods=["POST"])
def pipeline_add():
    """Add topics to Daisy's research queue for batch processing."""
    data   = request.get_json() or {}
    topics = data.get("topics", [])
    if isinstance(topics, str):
        topics = [topics]

    queue = load_json(PIPELINE_FILE, [])
    added = []
    for t in topics:
        t = t.strip()
        if t and t not in [q["topic"] for q in queue]:
            queue.append({
                "topic":    t,
                "category": data.get("category", "general"),
                "count":    data.get("count", 10),
                "status":   "pending",
                "added_at": datetime.now().isoformat()
            })
            added.append(t)

    save_json(PIPELINE_FILE, queue)
    return jsonify({"added": added, "queue_size": len(queue)})


@app.route("/pipeline/run", methods=["POST"])
def pipeline_run():
    """Process all pending topics in the research queue."""
    queue = load_json(PIPELINE_FILE, [])
    pending = [q for q in queue if q.get("status") == "pending"]

    if not pending:
        return jsonify({"message": "No pending topics", "queue_size": len(queue)})

    results = []
    for item in pending:
        topic    = item["topic"]
        count    = item.get("count", 10)
        category = item.get("category", "general")

        prompt = f"""Generate {count} Q&A pairs about "{topic}" for Daisy, a Ugandan business AI.
Questions: real things Ugandans ask. Answers: warm, direct, 1-3 sentences, Ugandan context.
Return ONLY JSON array: [{{"input":"...","output":"..."}}]"""

        raw = call_groq([{"role":"user","content":prompt}], max_tokens=1500, temperature=0.7)
        saved = 0
        if raw:
            try:
                clean = re.sub(r'```json|```','',raw).strip()
                pairs = json.loads(clean)
                for p in pairs:
                    if p.get("input") and p.get("output"):
                        if _auto_learn(p["input"], p["output"], source="pipeline", category=category):
                            saved += 1
                item["status"] = "done"
                item["saved"]  = saved
                item["done_at"]= datetime.now().isoformat()
            except:
                item["status"] = "error"
        else:
            item["status"] = "error"

        results.append({"topic": topic, "saved": saved, "status": item["status"]})

    save_json(PIPELINE_FILE, queue)
    memory = load_json(MEMORY_FILE, {})
    return jsonify({
        "processed": len(pending),
        "results":   results,
        "total_lessons": len(memory.get("lessons", []))
    })


@app.route("/pipeline/status", methods=["GET"])
def pipeline_status():
    queue = load_json(PIPELINE_FILE, [])
    return jsonify({
        "total":   len(queue),
        "pending": len([q for q in queue if q["status"] == "pending"]),
        "done":    len([q for q in queue if q["status"] == "done"]),
        "error":   len([q for q in queue if q["status"] == "error"]),
        "queue":   queue
    })


@app.route("/autoscan", methods=["POST"])
def autoscan():
    """
    Scan interaction logs and auto-extract useful Q&A pairs.
    Daisy learns from her own conversation history.
    """
    data      = request.get_json() or {}
    limit     = int(data.get("limit", 100))
    threshold = float(data.get("quality_threshold", 0.6))

    logs = load_json(LOG_FILE, [])
    chat_logs = [l for l in logs if l.get("type") == "CHAT"][-limit:]

    if not chat_logs:
        return jsonify({"message": "No chat logs to scan", "extracted": 0})

    # Ask Groq to pick the best ones to save
    pairs_text = "\n".join([
        f"Q: {l['input'][:150]}\nA: {l['output'][:200]}"
        for l in chat_logs if l.get("input") and l.get("output")
    ])

    prompt = f"""Review these conversation excerpts from Daisy's chat history.
Select the ones that are HIGH QUALITY — clear question, useful answer, would help future users.
Skip greetings, vague messages, or errors.

{pairs_text[:3000]}

Return ONLY a JSON array of the good ones:
[{{"input": "question", "output": "answer"}}]
Include at most 20 pairs."""

    raw = call_groq([{"role":"user","content":prompt}], max_tokens=2000, temperature=0.3)

    extracted = 0
    if raw:
        try:
            clean = re.sub(r'```json|```','',raw).strip()
            pairs = json.loads(clean)
            for p in pairs:
                if p.get("input") and p.get("output"):
                    if _auto_learn(p["input"], p["output"], source="autoscan"):
                        extracted += 1
        except:
            pass

    memory = load_json(MEMORY_FILE, {})
    return jsonify({
        "scanned":      len(chat_logs),
        "extracted":    extracted,
        "total_lessons": len(memory.get("lessons", []))
    })


@app.route("/promote", methods=["POST"])
def promote():
    """
    Promote lessons from memory.json into training_data.json.
    This permanently upgrades Daisy's base knowledge.
    """
    data    = request.get_json() or {}
    promote_all = data.get("all", False)
    ids     = data.get("ids", [])   # specific lesson indices to promote

    memory   = load_json(MEMORY_FILE, {})
    training = load_training()
    lessons  = memory.get("lessons", [])

    training_hashes = {entry_hash(t.get("input","")) for t in training}
    promoted = 0
    kept     = []

    for i, lesson in enumerate(lessons):
        should_promote = promote_all or i in ids
        h = entry_hash(lesson.get("input",""))
        if should_promote and h not in training_hashes:
            training.append({
                "input":  lesson["input"],
                "output": lesson["output"]
            })
            training_hashes.add(h)
            promoted += 1
        else:
            kept.append(lesson)

    if promoted > 0:
        save_json(TRAINING_FILE, training)
        if not promote_all:
            memory["lessons"] = kept
            save_json(MEMORY_FILE, memory)

    return jsonify({
        "promoted":     promoted,
        "training_size": len(training),
        "lessons_remaining": len(kept)
    })


# ── Keep all existing routes ──────────────────────────────────────────────────

@app.route("/diagnose", methods=["POST"])
def diagnose():
    data    = request.get_json()
    ai_text = data.get("ai_prompt", "").strip()
    if not ai_text or len(ai_text) < 20:
        return jsonify({"error": "Please provide at least 20 characters"}), 400
    from diagnose_engine import diagnose_ai
    result = diagnose_ai(ai_text)
    log_interaction("DIAGNOSE", ai_text, json.dumps(result))
    return jsonify(result)

@app.route("/reproduce", methods=["POST"])
def reproduce():
    data     = request.get_json()
    business = data.get("business", "")
    industry = data.get("industry", "")
    main_job = data.get("main_job", "")
    tone     = data.get("tone", "")
    ai_name  = data.get("ai_name", "")
    if not business or not main_job:
        return jsonify({"error": "Business name and main job required"}), 400
    name   = ai_name or f"{business.split()[0]}AI"
    prompt = f"You are {name}, the dedicated AI for {business}. Your job: {main_job}. Tone: {tone or 'warm and professional'}. Never invent info. Escalate sensitive issues to a human."
    result = {"name": name, "business": business, "industry": industry, "system_prompt": prompt, "certified_by": "Daisy"}
    log_interaction("REPRODUCE", json.dumps(data), prompt)
    return jsonify(result)

@app.route("/teach", methods=["POST"])
def teach():
    data        = request.get_json()
    input_text  = data.get("input", "").strip()
    output_text = data.get("output", "").strip()
    category    = data.get("category", "manual")
    if not input_text or not output_text:
        return jsonify({"error": "Both input and output required"}), 400
    saved = _auto_learn(input_text, output_text, source="manual", category=category)
    memory = load_json(MEMORY_FILE, {})
    log_interaction("TEACH", input_text, output_text)
    return jsonify({
        "status":       "learned" if saved else "duplicate",
        "saved":        saved,
        "total_lessons": len(memory.get("lessons", []))
    })

@app.route("/memory", methods=["GET"])
def get_memory():
    memory   = load_json(MEMORY_FILE, {})
    logs     = load_json(LOG_FILE, [])
    training = load_training()
    return jsonify({
        "base_knowledge": len(training),
        "custom_lessons": len(memory.get("lessons", [])),
        "total_interactions": len(logs),
        "lessons": memory.get("lessons", [])[-20:]
    })

@app.route("/export", methods=["GET"])
def export_data():
    logs     = load_json(LOG_FILE, [])
    memory   = load_json(MEMORY_FILE, {})
    training = load_training()
    return jsonify({
        "training_data":   training,
        "custom_lessons":  memory.get("lessons", []),
        "interaction_log": logs,
        "exported_at":     datetime.now().isoformat()
    })

@app.route("/stats", methods=["GET"])
def stats():
    logs     = load_json(LOG_FILE, [])
    memory   = load_json(MEMORY_FILE, {})
    training = load_training()
    pipeline = load_json(PIPELINE_FILE, [])
    types    = {}
    sources  = {}
    for log in logs:
        t = log.get("type", "UNKNOWN")
        types[t] = types.get(t, 0) + 1
    for lesson in memory.get("lessons", []):
        s = lesson.get("source", "unknown")
        sources[s] = sources.get(s, 0) + 1
    return jsonify({
        "total_interactions": len(logs),
        "base_knowledge":     len(training),
        "lessons_taught":     len(memory.get("lessons", [])),
        "pipeline_queue":     len(pipeline),
        "by_type":            types,
        "lessons_by_source":  sources,
        "groq_enabled":       bool(os.environ.get("GROQ_API_KEY"))
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
