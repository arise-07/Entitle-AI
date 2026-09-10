import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND = 'http://localhost:8000';

const BotIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="5" />
    <path d="M9 10v.01M15 10v.01M9 15c1 1 5 1 6 0" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c1.5-4 4.5-6 7-6s5.5 2 7 6" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
  </svg>
);

const MoneyIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const DocIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
  </svg>
);

const PenIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m17 3 4 4L7 21H3v-4Z" />
  </svg>
);

const INITIAL_MESSAGE = {
  type: 'bot',
  text: "Welcome to **ENTITLE AI** 🎯\n\nPlease choose your preferred language.\nதயவுசெய்து உங்கள் மொழியை தேர்வு செய்யுங்கள்.",
  options: [
    { label: '🇬🇧 English', value: 'english' },
    { label: '🇮🇳 தமிழ்', value: 'tamil' }
  ],
  schemes: null,
};

export default function App() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({});
  const [step, setStep] = useState('language');
  const [history, setHistory] = useState([]);
  const [language, setLanguage] = useState('english');

  // REF to always get latest language value
  const languageRef = useRef('english');
  const bottomRef = useRef(null);

  // keep ref in sync
  const setLang = (lang) => {
    setLanguage(lang);
    languageRef.current = lang;
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const addBot = (text, options = null, schemes = null) => {
    setMessages(prev => [...prev, { type: 'bot', text, options, schemes }]);
  };

  const extractProfile = (message, currentProfile) => {
    const updated = { ...currentProfile };
    const lower = message.toLowerCase();

    if (!updated.age) {
      const ageMatch = message.match(/\d+/);
      if (ageMatch) updated.age = ageMatch[0];
    } else if (!updated.occupation) {
      if (lower.includes('student')) updated.occupation = 'student';
      else if (lower.includes('farm')) updated.occupation = 'farmer';
      else if (lower.includes('entrepreneur') || lower.includes('business')) updated.occupation = 'entrepreneur';
      else if (lower.includes('home') || lower.includes('housewife')) updated.occupation = 'homemaker';
      else if (lower.includes('unemploy')) updated.occupation = 'unemployed';
      else if (lower.includes('senior') || lower.includes('retired')) updated.occupation = 'senior';
      else if (lower.includes('employ')) updated.occupation = 'employed';
      else updated.occupation = lower;
    } else if (!updated.income) {
      updated.income = lower;
    } else if (!updated.category) {
      if (lower.includes('general')) updated.category = 'general';
      else if (lower.includes('obc')) updated.category = 'obc';
      else if (lower.includes('sc')) updated.category = 'sc';
      else if (lower.includes('st')) updated.category = 'st';
      else updated.category = lower;
    } else if (!updated.gender) {
      if (lower.includes('female') || lower.includes('woman') || lower.includes('girl')) updated.gender = 'female';
      else if (lower.includes('male') || lower.includes('man') || lower.includes('boy')) updated.gender = 'male';
      else updated.gender = lower;
    }

    return updated;
  };

  const isProfileComplete = (p) => p.age && p.occupation && p.income && p.category && p.gender;

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;

    // always read from ref — never stale
    const activeLang = languageRef.current;

    // RESTART
    if (text === 'RESTART') {
      setProfile({});
      setStep('language');
      setLang('english');
      setHistory([]);
      setMessages([INITIAL_MESSAGE]);
      setInput('');
      return;
    }

    // LANGUAGE SELECTION
    if (step === 'language') {
      const selectedLang = text.toLowerCase();
      setLang(selectedLang);
      setStep('collecting');
      setMessages(prev => [...prev,
        { type: 'user', text: selectedLang === 'tamil' ? '🇮🇳 தமிழ்' : '🇬🇧 English' }
      ]);
      setTimeout(() => {
        addBot(
          selectedLang === 'tamil'
            ? "வணக்கம்! 👋 நான் **ENTITLE AI** — உங்கள் அரசு திட்ட உதவியாளர்.\n\nசில கேள்விகள் கேட்கிறேன், நீங்கள் தகுதியான திட்டங்களை கண்டுபிடிப்போம்.\n\nதொடங்குவோம் — உங்கள் **வயது** என்ன?"
            : "Hey! 👋 I'm **ENTITLE AI** — your personal government scheme finder.\n\nI'll ask a few quick questions to find all schemes you're eligible for.\n\nLet's start — what's your **age**?",
          null,
          null
        );
      }, 600);
      return;
    }

    setMessages(prev => [...prev, { type: 'user', text }]);
    setInput('');
    setLoading(true);

    const updatedProfile = extractProfile(text, profile);
    setProfile(updatedProfile);

    const currentStep = isProfileComplete(updatedProfile) && step === 'collecting'
      ? 'complete'
      : step;

    const newHistory = [...history, { role: 'user', text }];
    setHistory(newHistory);

    try {
      const res = await axios.post(`${BACKEND}/api/chat`, {
        message: text,
        profile: updatedProfile,
        step: currentStep,
        history: newHistory,
        language: activeLang,
      });

      const { message: botMsg, options, schemes, done } = res.data;

      addBot(botMsg, options, schemes);
      setHistory(prev => [...prev, { role: 'bot', text: botMsg }]);

      if (done || currentStep === 'complete') setStep('followup');

    } catch (err) {
      addBot(activeLang === 'tamil'
        ? 'பிழை ஏற்பட்டது. Backend இயங்குகிறதா என சரிபார்க்கவும்.'
        : 'Something went wrong. Check if backend is running.'
      );
    }

    setLoading(false);
  };

  const renderText = (text) => {
    return text.split('\n').map((line, i, arr) => (
      <span key={i}>
        {line.split('**').map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
        )}
        {i < arr.length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <div className="header-left">
          <div className="h-avatar"><BotIcon /></div>
          <div>
            <div className="h-name">ENTITLE AI</div>
            <div className="h-status">
              <span className="dot" />
              {language === 'tamil' ? 'அரசு திட்ட உதவியாளர்' : 'Government Scheme Finder'}
            </div>
          </div>
        </div>
        <div className="h-right">
          <span className="h-badge">🇮🇳 India</span>
          <span className="h-poweredby">by Primus Tech Labs</span>
        </div>
      </header>

      {/* MESSAGES */}
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`row ${msg.type}`}>
            {msg.type === 'bot' && <div className="avatar bot-av"><BotIcon /></div>}
            <div className="msg-wrap">
              <div className={`bubble ${msg.type}`}>
                {renderText(msg.text)}
              </div>

              {/* OPTION BUTTONS */}
              {msg.options && i === messages.length - 1 && (
                <div className="options">
                  {msg.options.map((opt, j) => (
                    <button
                      key={j}
                      className="opt-btn"
                      onClick={() => sendMessage(opt.value)}
                      disabled={loading}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* SCHEME CARDS */}
              {msg.schemes && (
                <div className="cards">
                  {msg.schemes.map(s => (
                    <div key={s.id} className="card">
                      <div className="card-top">
                        <h3>{s.name}</h3>
                        <span className="tag">{s.category.replace('_', ' ')}</span>
                      </div>
                      <div className="benefit"><MoneyIcon /> {s.benefit}</div>
                      <div className="detail">
                        <strong><CheckIcon /> {language === 'tamil' ? 'தகுதி' : 'Eligibility'}</strong>
                        <ul>{s.eligibility.map((e, j) => <li key={j}>{e}</li>)}</ul>
                      </div>
                      <div className="detail">
                        <strong><DocIcon /> {language === 'tamil' ? 'ஆவணங்கள்' : 'Documents'}</strong>
                        <ul>{s.documents.map((d, j) => <li key={j}>{d}</li>)}</ul>
                      </div>
                      <div className="detail">
                        <strong><PenIcon /> {language === 'tamil' ? 'விண்ணப்பிக்கும் முறை' : 'How to Apply'}</strong>
                        <p>{s.howToApply}</p>
                      </div>
                      <a href={s.link} target="_blank" rel="noopener noreferrer" className="apply-btn">
                        {language === 'tamil' ? 'அதிகாரப்பூர்வ இணையதளம் →' : 'Visit Official Website →'}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {msg.type === 'user' && <div className="avatar user-av"><UserIcon /></div>}
          </div>
        ))}

        {/* TYPING INDICATOR */}
        {loading && (
          <div className="row bot">
            <div className="avatar bot-av"><BotIcon /></div>
            <div className="bubble bot typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* INPUT BAR */}
      <div className="input-bar">
        <input
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          placeholder={language === 'tamil' ? 'உங்கள் பதிலை தட்டச்சு செய்யுங்கள்...' : 'Type your answer or click an option...'}
          disabled={loading}
          autoFocus
        />
        <button
          className="send-btn"
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}