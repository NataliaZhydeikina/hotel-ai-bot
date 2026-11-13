import { useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  BedDouble,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Hotel,
  MapPin,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  Users,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const samples = [
  "Find a boutique hotel in Haarlem for two adults, June 12–15, 2027. Breakfast is a must, free cancellation would be nice, and we need parking.",
  "I need a family-friendly place in Lisbon next weekend for 2 adults and 2 kids. A pool would be great.",
  "Looking for a pet-friendly hotel in Copenhagen from August 4 to August 8, 2027.",
];

const emptyState = {
  destination: null,
  check_in: null,
  check_out: null,
  guests: 2,
  filters: [],
};

function formatDate(value) {
  if (!value) return "Not set";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I can help shape your hotel search. Tell me where and when you’re going, who’s coming, and what matters most.",
    },
  ]);
  const [state, setState] = useState(emptyState);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const listRef = useRef(null);

  const canApply = Boolean(state.destination && state.check_in && state.check_out);
  const groupedFilters = useMemo(
    () => ({
      must: state.filters.filter((filter) => filter.priority === "must"),
      nice: state.filters.filter((filter) => filter.priority === "nice"),
    }),
    [state.filters],
  );

  async function sendMessage(text = draft) {
    const message = text.trim();
    if (!message || busy) return;
    setError("");
    setApplied(false);
    setDraft("");
    const currentMessages = [...messages, { role: "user", content: message }];
    setMessages(currentMessages);
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          state,
          history: messages.slice(-10),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || `The assistant returned an error (${response.status}).`);
      }
      setState(payload.state);
      setEstimate(payload.estimate);
      setMessages((items) => [...items, { role: "assistant", content: payload.assistant_message }]);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }));
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Could not reach the assistant. Check that the backend is running."
          : requestError.message,
      );
    } finally {
      setBusy(false);
    }
  }

  function applyFilters() {
    if (!canApply) return;
    setApplied(true);
  }

  function resetSearch() {
    setState(emptyState);
    setMessages([messages[0]]);
    setError("");
    setApplied(false);
    setEstimate(null);
  }

  return (
    <main className="app-shell min-h-screen">
      <header className="topbar">
        <a className="brand" href="#" aria-label="WinWin home">
          <span className="brand-mark"><Hotel size={19} strokeWidth={2.2} /></span>
          <span>winwin<span className="brand-dot">.</span></span>
        </a>
        <div className="topbar-right">
          <span className="secure-label"><span className="status-dot" /> AI search assistant</span>
          <button className="icon-button" onClick={resetSearch} title="Start a new search" aria-label="Start a new search">
            <RotateCcw size={16} />
          </button>
          <div className="avatar" aria-label="Guest profile">G</div>
        </div>
      </header>

      <div className="workspace">
        <section className="chat-column" aria-label="Hotel search chat">
          <div className="chat-heading">
            <div className="eyebrow"><Sparkles size={13} /> YOUR TRIP, YOUR WAY</div>
            <h1>Find a stay that feels <span>just right.</span></h1>
            <p>Tell us what you’re looking for. We’ll shape the search together.</p>
          </div>

          <div className="conversation" ref={listRef} aria-live="polite">
            {messages.map((item, index) => (
              <article className={`message-row ${item.role}`} key={`${item.role}-${index}`}>
                {item.role === "assistant" ? (
                  <div className="assistant-avatar"><Sparkles size={15} /></div>
                ) : null}
                <div className={`message-bubble ${item.role}`}>{item.content}</div>
              </article>
            ))}
            {busy ? (
              <div className="message-row assistant">
                <div className="assistant-avatar"><Sparkles size={15} /></div>
                <div className="message-bubble assistant typing"><i /><i /><i /></div>
              </div>
            ) : null}
          </div>

          {error ? <div className="error-banner" role="alert">{error}</div> : null}

          <div className="composer-wrap">
            <div className="composer">
              <textarea
                rows="1"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Describe your ideal hotel stay..."
                aria-label="Describe your hotel search"
                disabled={busy}
              />
              <button
                className="send-button"
                onClick={() => sendMessage()}
                disabled={busy || !draft.trim()}
                aria-label="Send message"
              >
                <ArrowUp size={18} />
              </button>
            </div>
            <div className="composer-foot"><span>Enter to send <span className="keycap">↵</span></span><span>AI can make mistakes. Review details before booking.</span></div>
          </div>

          <div className="samples">
            <span className="sample-label">TRY AN EXAMPLE</span>
            <div className="sample-buttons">
              {samples.map((sample, index) => (
                <button key={sample} className="sample-chip" onClick={() => sendMessage(sample)} disabled={busy}>
                  {index === 0 ? <MapPin size={13} /> : index === 1 ? <Users size={13} /> : <Compass size={13} />}
                  <span>{index === 0 ? "Haarlem getaway" : index === 1 ? "Family in Lisbon" : "Pet-friendly stay"}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="search-panel" aria-label="Current search details">
          <div className="panel-title-row">
            <div>
              <div className="eyebrow">LIVE SEARCH</div>
              <h2>Your search</h2>
            </div>
            <span className="live-badge"><span /> LIVE</span>
          </div>
          <div className="panel-divider" />

          <div className={`destination-card ${state.destination ? "filled" : ""}`}>
            <div className="field-icon"><MapPin size={16} /></div>
            <div className="field-content">
              <span className="field-label">DESTINATION</span>
              <strong>{state.destination || "Where to?"}</strong>
            </div>
          </div>

          <div className="detail-grid">
            <div className="detail-card">
              <div className="detail-icon"><span className="calendar-icon">12</span></div>
              <span className="field-label">CHECK-IN</span>
              <strong>{formatDate(state.check_in)}</strong>
            </div>
            <div className="detail-card">
              <div className="detail-icon"><span className="calendar-icon">15</span></div>
              <span className="field-label">CHECK-OUT</span>
              <strong>{formatDate(state.check_out)}</strong>
            </div>
          </div>

          <div className="guest-row">
            <div className="field-icon"><Users size={16} /></div>
            <div className="field-content">
              <span className="field-label">GUESTS</span>
              <strong>{state.guests} {state.guests === 1 ? "guest" : "guests"}</strong>
            </div>
            <BedDouble className="row-trailing-icon" size={16} />
          </div>

          <div className="filters-heading">
            <div>
              <span className="field-label">PREFERENCES</span>
              <strong>What matters to you</strong>
            </div>
            <SlidersHorizontal size={15} />
          </div>
          <div className="filter-groups">
            {groupedFilters.must.length > 0 ? (
              <div className="filter-group">
                <span className="priority-label required">MUST-HAVE</span>
                {groupedFilters.must.map((filter, index) => <span className="filter-pill required" key={`${filter.label}-${index}`}>{filter.label}</span>)}
              </div>
            ) : null}
            {groupedFilters.nice.length > 0 ? (
              <div className="filter-group">
                <span className="priority-label preferred">NICE-TO-HAVE</span>
                {groupedFilters.nice.map((filter, index) => <span className="filter-pill" key={`${filter.label}-${index}`}>{filter.label}</span>)}
              </div>
            ) : null}
            {state.filters.length === 0 ? <p className="empty-filters">Your preferences will show up here as we chat.</p> : null}
          </div>

          <div className="estimate-card">
            <div className="estimate-icon"><Hotel size={15} /></div>
            <div>
              <strong>{estimate?.count !== null && estimate?.count !== undefined ? `About ${estimate.count} possible stays` : "A great stay starts here"}</strong>
              <p>{estimate?.label || "Add a destination and dates to build your search."} {estimate ? "Illustrative estimate, not live inventory." : ""}</p>
            </div>
          </div>

          <button className="apply-button" onClick={applyFilters} disabled={!canApply}>
            {applied ? <><Check size={16} /> Filters applied</> : <>Apply filters <ArrowUp size={16} className="apply-arrow" /></>}
          </button>
          {applied ? <p className="applied-note" role="status">Search preferences are ready. Live booking results are not connected in this demo.</p> : null}

          <button className="json-toggle" onClick={() => setShowJson((shown) => !shown)} aria-expanded={showJson}>
            <span><span className="json-indicator">{"{}"}</span> Structured search data</span>
            <ChevronDown size={15} className={showJson ? "rotated" : ""} />
          </button>
          {showJson ? <pre className="json-view">{JSON.stringify(state, null, 2)}</pre> : null}

          <div className="help-note"><CircleHelp size={14} /><span>Your search details update as you chat with the assistant.</span></div>
        </aside>
      </div>
    </main>
  );
}

export default App;
