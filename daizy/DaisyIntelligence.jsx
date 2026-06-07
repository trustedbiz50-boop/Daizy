import { useState, useEffect, useCallback } from "react";

const DAISY_URL = "https://daizy-l1aq.onrender.com"; // change to your URL

const tabs = ["Brain", "Research", "Pipeline", "Speak", "Promote"];

const categoryOptions = [
  "general", "business", "website", "marketing", "pricing",
  "uganda", "education", "tech", "design", "finance"
];

function Badge({ children, color = "emerald" }) {
  const colors = {
    emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    amber:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
    red:     "bg-red-500/20 text-red-300 border-red-500/30",
    sky:     "bg-sky-500/20 text-sky-300 border-sky-500/30",
    violet:  "bg-violet-500/20 text-violet-300 border-violet-500/30",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-mono ${colors[color]}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-zinc-500 text-xs uppercase tracking-widest font-mono">{label}</span>
      <span className={`text-3xl font-black ${accent || "text-white"}`}>{value ?? "—"}</span>
      {sub && <span className="text-zinc-600 text-xs">{sub}</span>}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center gap-2 text-zinc-400 text-sm">
      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      Working...
    </div>
  );
}

function LessonCard({ lesson, index, onPromote }) {
  const sourceColors = { manual: "violet", research: "sky", pipeline: "sky", autoscan: "amber", chat: "emerald", voice: "emerald" };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2 flex-wrap">
          <Badge color={sourceColors[lesson.source] || "emerald"}>{lesson.source || "unknown"}</Badge>
          {lesson.category && <Badge color="violet">{lesson.category}</Badge>}
        </div>
        {onPromote && (
          <button
            onClick={() => onPromote(index)}
            className="text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded px-2 py-0.5 shrink-0"
          >
            ↑ Promote
          </button>
        )}
      </div>
      <p className="text-zinc-300 text-sm font-medium">Q: {lesson.input}</p>
      <p className="text-zinc-500 text-sm">A: {lesson.output}</p>
      {lesson.taught_at && (
        <p className="text-zinc-700 text-xs font-mono">{new Date(lesson.taught_at).toLocaleString()}</p>
      )}
    </div>
  );
}

// ── BRAIN TAB ─────────────────────────────────────────────────────────────────
function BrainTab({ stats, lessons, onRefresh, loading }) {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  async function runAutoscan() {
    setScanning(true); setScanResult(null);
    try {
      const r = await fetch(`${DAISY_URL}/autoscan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 200 })
      });
      const d = await r.json();
      setScanResult(d);
      onRefresh();
    } catch (e) { setScanResult({ error: e.message }); }
    setScanning(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Base Knowledge" value={stats?.base_knowledge} accent="text-emerald-400" sub="training_data.json" />
        <StatCard label="Learned Lessons" value={stats?.lessons_taught} accent="text-sky-400" sub="memory.json" />
        <StatCard label="Interactions" value={stats?.total_interactions} accent="text-violet-400" />
        <StatCard label="Pipeline Queue" value={stats?.pipeline_queue} accent="text-amber-400" sub="pending topics" />
      </div>

      {/* Lesson sources */}
      {stats?.lessons_by_source && Object.keys(stats.lessons_by_source).length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-xs uppercase tracking-widest font-mono mb-3">Lessons by Source</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.lessons_by_source).map(([src, count]) => (
              <div key={src} className="flex items-center gap-2">
                <Badge color="sky">{src}</Badge>
                <span className="text-white font-mono font-bold text-sm">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-scan */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div>
          <p className="text-white font-semibold">Auto-Scan Conversations</p>
          <p className="text-zinc-500 text-sm">Let Daisy review her own chat history and extract valuable lessons automatically.</p>
        </div>
        <button
          onClick={runAutoscan}
          disabled={scanning}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {scanning ? "Scanning..." : "🔍 Run Auto-Scan"}
        </button>
        {scanResult && !scanResult.error && (
          <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-lg p-3 text-sm text-emerald-300">
            Scanned <b>{scanResult.scanned}</b> conversations → extracted <b>{scanResult.extracted}</b> new lessons. Total: <b>{scanResult.total_lessons}</b>
          </div>
        )}
        {scanResult?.error && (
          <div className="text-red-400 text-sm">{scanResult.error}</div>
        )}
      </div>

      {/* Recent lessons */}
      <div>
        <p className="text-zinc-400 text-sm font-mono uppercase tracking-widest mb-3">Recent Lessons ({lessons.length})</p>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {lessons.length === 0 && <p className="text-zinc-600 text-sm">No custom lessons yet. Use Research or Teach to add them.</p>}
          {[...lessons].reverse().map((l, i) => (
            <LessonCard key={i} lesson={l} index={lessons.length - 1 - i} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── RESEARCH TAB ──────────────────────────────────────────────────────────────
function ResearchTab({ onRefresh }) {
  const [topic, setTopic]         = useState("");
  const [count, setCount]         = useState(10);
  const [category, setCategory]   = useState("general");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);

  async function run() {
    if (!topic.trim()) return;
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${DAISY_URL}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), count, category, save: true })
      });
      const d = await r.json();
      setResult(d);
      onRefresh();
    } catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div>
          <p className="text-white font-semibold text-lg">Research a Topic</p>
          <p className="text-zinc-500 text-sm">Give Daisy a topic and she'll generate Q&A pairs in her voice and save them automatically.</p>
        </div>
        <div className="space-y-3">
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && run()}
            placeholder="e.g. Mobile Money Uganda, How to get business license Uganda, Website pricing..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-sm"
          />
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-zinc-500 text-xs font-mono">Pairs to generate</label>
              <select
                value={count}
                onChange={e => setCount(Number(e.target.value))}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                {[5,10,15,20,25,30].map(n => <option key={n} value={n}>{n} pairs</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-zinc-500 text-xs font-mono">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={run}
            disabled={loading || !topic.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? "Researching..." : "⚡ Research & Train"}
          </button>
        </div>
      </div>

      {loading && <Spinner />}

      {result && !result.error && (
        <div className="space-y-3">
          <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-lg p-3 text-sm text-emerald-300">
            Generated <b>{result.generated}</b> pairs → saved <b>{result.saved}</b> new, skipped <b>{result.skipped_duplicates}</b> duplicates
          </div>
          <p className="text-zinc-400 text-xs font-mono uppercase tracking-widest">Generated Pairs</p>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {(result.pairs || []).map((p, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1">
                <p className="text-zinc-300 text-sm font-medium">Q: {p.input}</p>
                <p className="text-zinc-500 text-sm">A: {p.output}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {result?.error && <div className="text-red-400 text-sm">{result.error}</div>}
    </div>
  );
}

// ── PIPELINE TAB ──────────────────────────────────────────────────────────────
function PipelineTab({ onRefresh }) {
  const [topicsInput, setTopicsInput] = useState("");
  const [count, setCount]             = useState(10);
  const [category, setCategory]       = useState("general");
  const [queue, setQueue]             = useState([]);
  const [adding, setAdding]           = useState(false);
  const [running, setRunning]         = useState(false);
  const [runResult, setRunResult]     = useState(null);

  async function loadQueue() {
    try {
      const r = await fetch(`${DAISY_URL}/pipeline/status`);
      const d = await r.json();
      setQueue(d.queue || []);
    } catch {}
  }

  useEffect(() => { loadQueue(); }, []);

  async function addTopics() {
    const topics = topicsInput.split("\n").map(t => t.trim()).filter(Boolean);
    if (!topics.length) return;
    setAdding(true);
    try {
      await fetch(`${DAISY_URL}/pipeline/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics, count, category })
      });
      setTopicsInput("");
      loadQueue();
      onRefresh();
    } catch {}
    setAdding(false);
  }

  async function runPipeline() {
    setRunning(true); setRunResult(null);
    try {
      const r = await fetch(`${DAISY_URL}/pipeline/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const d = await r.json();
      setRunResult(d);
      loadQueue();
      onRefresh();
    } catch (e) { setRunResult({ error: e.message }); }
    setRunning(false);
  }

  const pending = queue.filter(q => q.status === "pending");
  const done    = queue.filter(q => q.status === "done");

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div>
          <p className="text-white font-semibold text-lg">Batch Research Pipeline</p>
          <p className="text-zinc-500 text-sm">Add multiple topics at once. Run them all in one go to bulk-train Daisy.</p>
        </div>
        <textarea
          value={topicsInput}
          onChange={e => setTopicsInput(e.target.value)}
          placeholder={"One topic per line:\nMobile money Uganda\nHow to register a business Uganda\nSEO for Ugandan websites\nUganda tax basics for small business"}
          rows={5}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-sm font-mono resize-none"
        />
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-xs font-mono">Pairs per topic</label>
            <select
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              {[5,10,15,20].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-xs font-mono">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button
            onClick={addTopics}
            disabled={adding || !topicsInput.trim()}
            className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
          >
            {adding ? "Adding..." : "+ Add to Queue"}
          </button>
        </div>
      </div>

      {/* Queue status */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Pending" value={pending.length} accent="text-amber-400" />
        <StatCard label="Done" value={done.length} accent="text-emerald-400" />
        <StatCard label="Total" value={queue.length} accent="text-white" />
      </div>

      {pending.length > 0 && (
        <button
          onClick={runPipeline}
          disabled={running}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
        >
          {running ? "Running pipeline..." : `⚡ Run Pipeline (${pending.length} topics)`}
        </button>
      )}

      {running && <Spinner />}

      {runResult && !runResult.error && (
        <div className="space-y-2">
          <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-lg p-3 text-sm text-emerald-300">
            Processed <b>{runResult.processed}</b> topics → total lessons now <b>{runResult.total_lessons}</b>
          </div>
          {(runResult.results || []).map((r, i) => (
            <div key={i} className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg ${r.status === "done" ? "bg-emerald-900/20" : "bg-red-900/20"}`}>
              <span className="text-zinc-300">{r.topic}</span>
              <div className="flex items-center gap-2">
                <Badge color={r.status === "done" ? "emerald" : "red"}>{r.status}</Badge>
                {r.saved > 0 && <span className="text-emerald-400 text-xs">+{r.saved}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending queue list */}
      {pending.length > 0 && (
        <div>
          <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-2">Pending Topics</p>
          <div className="space-y-2">
            {pending.map((q, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 flex items-center justify-between">
                <span className="text-zinc-300 text-sm">{q.topic}</span>
                <div className="flex gap-2">
                  <Badge color="amber">pending</Badge>
                  <Badge color="violet">{q.category}</Badge>
                  <span className="text-zinc-600 text-xs">{q.count} pairs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SPEAK TAB ─────────────────────────────────────────────────────────────────
function SpeakTab({ onRefresh }) {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("general");
  const [save, setSave]         = useState(true);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [history, setHistory]   = useState([]);

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`${DAISY_URL}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), category, save })
      });
      const d = await r.json();
      setResult(d);
      if (!d.error) {
        setHistory(h => [{ question: question.trim(), answer: d.answer, saved: d.saved }, ...h.slice(0, 9)]);
        if (save) onRefresh();
        setQuestion("");
      }
    } catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div>
          <p className="text-white font-semibold text-lg">Daisy Speaks Her Own Words</p>
          <p className="text-zinc-500 text-sm">Ask Daisy anything. She responds in her own voice — not pattern matching. Save good answers directly to her training.</p>
        </div>
        <div className="space-y-3">
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Ask Daisy anything in her domain..."
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-sm resize-none"
          />
          <div className="flex items-center gap-4 flex-wrap">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="flex items-center gap-2 text-zinc-400 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={save}
                onChange={e => setSave(e.target.checked)}
                className="accent-emerald-500"
              />
              Save to training
            </label>
            <button
              onClick={ask}
              disabled={loading || !question.trim()}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg transition-colors text-sm"
            >
              {loading ? "Thinking..." : "💬 Ask Daisy"}
            </button>
          </div>
        </div>
      </div>

      {loading && <Spinner />}

      {history.length > 0 && (
        <div className="space-y-3">
          {history.map((h, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge color="violet">Daisy</Badge>
                {h.saved && <Badge color="emerald">saved to training</Badge>}
              </div>
              <p className="text-zinc-400 text-sm font-medium">Q: {h.question}</p>
              <p className="text-white text-sm leading-relaxed">{h.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PROMOTE TAB ───────────────────────────────────────────────────────────────
function PromoteTab({ lessons, onRefresh }) {
  const [selected, setSelected]   = useState([]);
  const [promoting, setPromoting] = useState(false);
  const [result, setResult]       = useState(null);

  function toggle(i) {
    setSelected(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i]);
  }

  function selectAll() {
    setSelected(lessons.map((_, i) => i));
  }

  async function promote(all = false) {
    setPromoting(true); setResult(null);
    try {
      const r = await fetch(`${DAISY_URL}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(all ? { all: true } : { ids: selected })
      });
      const d = await r.json();
      setResult(d);
      setSelected([]);
      onRefresh();
    } catch (e) { setResult({ error: e.message }); }
    setPromoting(false);
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4">
        <p className="text-amber-300 font-semibold">⬆️ Promote to Base Training</p>
        <p className="text-amber-400/70 text-sm">When you promote a lesson, it moves from memory.json into training_data.json — permanently upgrading Daisy's base knowledge. This is how Daisy grows permanently.</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={selectAll}
          className="text-sm text-sky-400 hover:text-sky-300 border border-sky-500/30 rounded-lg px-3 py-1.5 transition-colors"
        >
          Select All ({lessons.length})
        </button>
        <button
          onClick={() => setSelected([])}
          className="text-sm text-zinc-500 hover:text-zinc-400 border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors"
        >
          Clear
        </button>
        {selected.length > 0 && (
          <button
            onClick={() => promote(false)}
            disabled={promoting}
            className="text-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold border border-amber-500 rounded-lg px-4 py-1.5 transition-colors"
          >
            {promoting ? "Promoting..." : `⬆️ Promote Selected (${selected.length})`}
          </button>
        )}
        {lessons.length > 0 && (
          <button
            onClick={() => promote(true)}
            disabled={promoting}
            className="text-sm bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold border border-emerald-600 rounded-lg px-4 py-1.5 transition-colors"
          >
            {promoting ? "Promoting..." : `⬆️ Promote All (${lessons.length})`}
          </button>
        )}
      </div>

      {result && !result.error && (
        <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-lg p-3 text-sm text-emerald-300">
          Promoted <b>{result.promoted}</b> lessons → training now has <b>{result.training_size}</b> entries
        </div>
      )}
      {result?.error && <div className="text-red-400 text-sm">{result.error}</div>}

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {lessons.length === 0 && <p className="text-zinc-600 text-sm">No lessons to promote yet.</p>}
        {lessons.map((l, i) => (
          <div
            key={i}
            onClick={() => toggle(i)}
            className={`cursor-pointer rounded-xl border p-4 space-y-1 transition-all ${
              selected.includes(i)
                ? "border-amber-500 bg-amber-900/20"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selected.includes(i) ? "border-amber-500 bg-amber-500" : "border-zinc-600"}`}>
                {selected.includes(i) && <span className="text-black text-xs font-bold">✓</span>}
              </div>
              <Badge color="sky">{l.source || "unknown"}</Badge>
              {l.category && <Badge color="violet">{l.category}</Badge>}
            </div>
            <p className="text-zinc-300 text-sm font-medium pl-6">Q: {l.input}</p>
            <p className="text-zinc-500 text-sm pl-6">A: {l.output?.slice(0, 120)}{l.output?.length > 120 ? "..." : ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function DaisyIntelligence() {
  const [activeTab, setActiveTab] = useState("Brain");
  const [stats, setStats]         = useState(null);
  const [lessons, setLessons]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [connected, setConnected] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        fetch(`${DAISY_URL}/stats`).then(r => r.json()),
        fetch(`${DAISY_URL}/memory`).then(r => r.json()),
      ]);
      setStats(s);
      setLessons(m.lessons || []);
      setConnected(true);
    } catch {
      setConnected(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-black font-black text-sm">D</div>
              <div>
                <p className="text-white font-bold text-lg leading-none">Daisy Intelligence</p>
                <p className="text-zinc-500 text-xs">TrustedBiz Training Engine</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connected === true && <Badge color="emerald">● Connected</Badge>}
            {connected === false && <Badge color="red">● Offline</Badge>}
            {connected === null && <Badge color="amber">Connecting...</Badge>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-4">
        <div className="max-w-3xl mx-auto flex gap-0">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        ) : connected === false ? (
          <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-6 text-center">
            <p className="text-red-300 font-semibold">Cannot connect to Daisy</p>
            <p className="text-red-400/70 text-sm mt-1">Check that your Render service is running and DAISY_URL is correct.</p>
            <p className="text-zinc-500 text-xs mt-2 font-mono">{DAISY_URL}</p>
          </div>
        ) : (
          <>
            {activeTab === "Brain"    && <BrainTab stats={stats} lessons={lessons} onRefresh={refresh} loading={loading} />}
            {activeTab === "Research" && <ResearchTab onRefresh={refresh} />}
            {activeTab === "Pipeline" && <PipelineTab onRefresh={refresh} />}
            {activeTab === "Speak"    && <SpeakTab onRefresh={refresh} />}
            {activeTab === "Promote"  && <PromoteTab lessons={lessons} onRefresh={refresh} />}
          </>
        )}
      </div>
    </div>
  );
}
