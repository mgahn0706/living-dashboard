import { useState, useEffect } from "react";

const recommendations = [
  {
    id: 1,
    rank: "#1",
    type: "MODIFY FILTER",
    title: "Filter Revenue by Product Category 'Devices'",
    description: "Focus on revenue won for the Devices product category in the donut chart.",
    targetChart: "Revenue by Product Category",
    impact: "High",
    confidence: 94,
    impactDelta: "+23% clarity",
    category: "filter",
    color: "#6EE7B7",
    accentColor: "#10B981",
  },
  {
    id: 2,
    rank: "#2",
    type: "MODIFY FILTER",
    title: "Filter Products by Category 'Devices' and Status 'Won'",
    description: "Show only won deals in the Devices category for product revenue analysis.",
    targetChart: "Won vs Lost by Industry",
    impact: "Medium",
    confidence: 81,
    impactDelta: "+15% focus",
    category: "filter",
    color: "#93C5FD",
    accentColor: "#3B82F6",
  },
  {
    id: 3,
    rank: "#3",
    type: "MODIFY FILTER",
    title: "Filter Revenue by Segment for Devices and Status Won",
    description: "Drill into won Devices revenue broken down by Enterprise, Mid-Market, and SMB.",
    targetChart: "Revenue by Segment",
    impact: "Medium",
    confidence: 76,
    impactDelta: "+12% precision",
    category: "filter",
    color: "#FCD34D",
    accentColor: "#F59E0B",
  },
];

const chatMessages = [
  { role: "user", time: "03:24 PM", text: "How much revenue is won by the Devices category?" },
  {
    role: "assistant",
    time: "03:24 PM",
    text: "I recommend filtering relevant views to show revenue won specifically for the Devices product category. This will highlight the revenue contribution from Devices and support your request accurately.",
  },
];

export default function AIRecommendationsPanel() {
  const [applied, setApplied] = useState({});
  const [dismissed, setDismissed] = useState({});
  const [hoveredId, setHoveredId] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState(chatMessages);
  const [activeTab, setActiveTab] = useState("recommendations");
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    setTimeout(() => setAnimateIn(true), 100);
  }, []);

  const handleApply = (id) => {
    setApplied((prev) => ({ ...prev, [id]: true }));
  };

  const handleDismiss = (id) => {
    setDismissed((prev) => ({ ...prev, [id]: true }));
  };

  const handleSend = () => {
    if (!chatInput.trim()) return;
    setMessages((prev) => [...prev, { role: "user", time: "Now", text: chatInput }]);
    setChatInput("");
  };

  const visibleRecs = recommendations.filter((r) => !dismissed[r.id]);
  const appliedCount = Object.values(applied).filter(Boolean).length;

  return (
    <div
      style={{
        fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
        width: 340,
        height: "100vh",
        background: "#0F1117",
        borderLeft: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        flexDirection: "column",
        color: "#E2E8F0",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(110,231,183,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: "20px 20px 0",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "linear-gradient(135deg, #6EE7B7 0%, #3B82F6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            ✦
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", color: "#F8FAFC" }}>
              AI Recommendations
            </div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>
              {appliedCount} applied · {visibleRecs.length} pending
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <select
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#94A3B8",
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              <option>EN</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0 }}>
          {["recommendations", "chat"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "8px 0",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid #6EE7B7" : "2px solid transparent",
                color: activeTab === tab ? "#6EE7B7" : "#475569",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                transition: "all 0.2s",
              }}
            >
              {tab === "recommendations" ? `Suggestions (${visibleRecs.length})` : "Chat Log"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 0" }}>
        {activeTab === "recommendations" ? (
          <>
            {/* Apply All bar */}
            {visibleRecs.length > 1 && (
              <div
                style={{
                  background: "rgba(110,231,183,0.06)",
                  border: "1px solid rgba(110,231,183,0.15)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
                onClick={() => recommendations.forEach((r) => handleApply(r.id))}
              >
                <span style={{ fontSize: 12, color: "#6EE7B7", fontWeight: 600 }}>
                  ⚡ Apply all {visibleRecs.length} recommendations
                </span>
                <span style={{ fontSize: 11, color: "#475569" }}>1-click →</span>
              </div>
            )}

            {/* Recommendation cards */}
            {visibleRecs.map((rec, idx) => {
              const isApplied = applied[rec.id];
              const isHovered = hoveredId === rec.id;

              return (
                <div
                  key={rec.id}
                  onMouseEnter={() => setHoveredId(rec.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    marginBottom: 12,
                    borderRadius: 14,
                    border: `1px solid ${isApplied ? rec.accentColor + "40" : isHovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
                    background: isApplied
                      ? `linear-gradient(135deg, ${rec.accentColor}08 0%, transparent 100%)`
                      : isHovered
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(255,255,255,0.02)",
                    transition: "all 0.25s ease",
                    overflow: "hidden",
                    opacity: animateIn ? 1 : 0,
                    transform: animateIn ? "translateY(0)" : "translateY(12px)",
                    transitionDelay: `${idx * 80}ms`,
                    position: "relative",
                  }}
                >
                  {/* Rank + type header */}
                  <div
                    style={{
                      padding: "12px 14px 10px",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 7,
                        background: rec.color + "22",
                        color: rec.color,
                        fontSize: 11,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: rec.color,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        background: rec.color + "15",
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      {rec.type}
                    </span>

                    {/* Confidence pill */}
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        color: "#64748B",
                        fontWeight: 600,
                      }}
                    >
                      {rec.confidence}% match
                    </span>
                  </div>

                  {/* Body */}
                  <div style={{ padding: "12px 14px" }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#F1F5F9",
                        lineHeight: 1.4,
                        marginBottom: 6,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {rec.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748B",
                        lineHeight: 1.5,
                        marginBottom: 10,
                      }}
                    >
                      {rec.description}
                    </div>

                    {/* Target chart tag */}
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 6,
                        padding: "3px 8px",
                        marginBottom: 12,
                      }}
                    >
                      <span style={{ fontSize: 10, color: "#6EE7B7" }}>↗</span>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>{rec.targetChart}</span>
                    </div>

                    {/* Confidence bar */}
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          height: 3,
                          borderRadius: 2,
                          background: "rgba(255,255,255,0.06)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${rec.confidence}%`,
                            background: `linear-gradient(90deg, ${rec.accentColor}, ${rec.color})`,
                            borderRadius: 2,
                            transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                            transitionDelay: `${idx * 100 + 300}ms`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    {isApplied ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          color: rec.accentColor,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        <span>✓</span>
                        <span>Applied to dashboard</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => handleApply(rec.id)}
                          style={{
                            flex: 1,
                            padding: "8px 0",
                            borderRadius: 8,
                            border: "none",
                            background: `linear-gradient(135deg, ${rec.accentColor}CC, ${rec.accentColor}99)`,
                            color: "#0F1117",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "opacity 0.2s",
                            letterSpacing: "0.02em",
                          }}
                        >
                          ✓ Apply
                        </button>
                        <button
                          onClick={() => handleDismiss(rec.id)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "transparent",
                            color: "#475569",
                            fontSize: 12,
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {visibleRecs.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "#334155",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
                  All recommendations applied
                </div>
                <div style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>
                  Ask a question to get new insights
                </div>
              </div>
            )}
          </>
        ) : (
          /* Chat tab */
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#334155",
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  {msg.role === "assistant" && (
                    <span style={{ color: "#6EE7B7", fontWeight: 700 }}>✦ ASSISTANT</span>
                  )}
                  <span>{msg.time}</span>
                </div>
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "10px 12px",
                    borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                    background:
                      msg.role === "user"
                        ? "rgba(110,231,183,0.12)"
                        : "rgba(255,255,255,0.04)",
                    border: `1px solid ${msg.role === "user" ? "rgba(110,231,183,0.2)" : "rgba(255,255,255,0.06)"}`,
                    fontSize: 12,
                    color: "#CBD5E1",
                    lineHeight: 1.5,
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat input — always visible */}
      <div
        style={{
          padding: "12px 16px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "#0F1117",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "8px 12px",
          }}
        >
          <span style={{ fontSize: 14, color: "#334155" }}>🎤</span>
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontSize: 12,
              color: "#94A3B8",
              caretColor: "#6EE7B7",
            }}
          />
          <button
            onClick={handleSend}
            style={{
              background: chatInput.trim() ? "linear-gradient(135deg, #6EE7B7, #3B82F6)" : "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: 8,
              padding: "6px 12px",
              color: chatInput.trim() ? "#0F1117" : "#334155",
              fontSize: 11,
              fontWeight: 700,
              cursor: chatInput.trim() ? "pointer" : "default",
              transition: "all 0.2s",
              letterSpacing: "0.04em",
            }}
          >
            Send
          </button>
        </div>
        <div style={{ fontSize: 10, color: "#1E293B", textAlign: "center", marginTop: 8 }}>
          Voice and text both influence recommendations
        </div>
      </div>
    </div>
  );
}
