import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { chatApi } from '../api/client';

const GREETING = {
  role: 'bot',
  text: "Hi! I'm the SafePay Assistant. Ask me about payments, transaction statuses, fraud, or security.",
  suggestions: ['How do I make a payment?', 'What does FLAGGED mean?', 'Is SafePay secure?'],
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open]);

  async function send(text) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setBusy(true);
    try {
      const res = await chatApi.send(msg);
      setMessages(m => [...m, { role: 'bot', text: res.reply, suggestions: res.suggestions }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'bot', text: 'Sorry, I had trouble reaching the assistant.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <div style={panel}>
          <div style={header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bot size={18} color="#6366f1" />
              <strong style={{ color: '#fff', fontSize: 14 }}>SafePay Assistant</strong>
              <span style={{ fontSize: 10, color: '#22c55e' }}>● offline · private</span>
            </div>
            <X size={18} color="#9ca3af" style={{ cursor: 'pointer' }} onClick={() => setOpen(false)} />
          </div>
          <div style={body}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={m.role === 'user' ? bubbleUser : bubbleBot}>{m.text}</div>
                {m.suggestions && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {m.suggestions.map(s => (
                      <button key={s} onClick={() => send(s)} style={chip}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <form onSubmit={e => { e.preventDefault(); send(); }} style={inputRow}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask a question…"
              style={chatInput} />
            <button type="submit" disabled={busy} style={sendBtn}><Send size={16} /></button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} style={fab} aria-label="Open assistant">
        {open ? <X size={22} color="#fff" /> : <MessageCircle size={22} color="#fff" />}
      </button>
    </>
  );
}

const fab = { position: 'fixed', bottom: 24, right: 24, width: 54, height: 54, borderRadius: '50%', background: '#6366f1', border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const panel = { position: 'fixed', bottom: 90, right: 24, width: 360, height: 480, background: '#111114', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' };
const header = { padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const body = { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 };
const bubbleBot = { background: 'rgba(255,255,255,0.05)', color: '#e5e7eb', padding: '10px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.45 };
const bubbleUser = { background: '#6366f1', color: '#fff', padding: '10px 12px', borderRadius: 12, fontSize: 13 };
const chip = { background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 999, padding: '5px 10px', fontSize: 11, cursor: 'pointer' };
const inputRow = { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid rgba(255,255,255,0.06)' };
const chatInput = { flex: 1, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, outline: 'none' };
const sendBtn = { width: 40, borderRadius: 8, background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
