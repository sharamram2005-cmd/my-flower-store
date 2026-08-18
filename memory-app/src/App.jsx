import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Menu, X, Search, Mic, Plus, Settings, Sun, Moon, Lock, LockKeyhole,
  UserRound, KeyRound, Phone, Mail, MapPin, CreditCard, BookMarked,
  Trash2, Copy, Check, ChevronRight, SquarePen, LayoutGrid, Eye, EyeOff,
} from 'lucide-react';
import BusinessTable from './BusinessTable.jsx';

function BrainLogo({ size = 72 }) {
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0 blur-2xl bg-[#7e14ff]/40 rounded-full scale-150" />
      <span className="relative select-none" style={{ fontSize: size * 0.72, lineHeight: 1 }}>🧠</span>
    </div>
  );
}

// --- Constants ---
const STORAGE_KEY = 'memoryAppData_v1'; // מפתח לשמירה ב-localStorage

function defaultData() {
  return {
    memories: [], // { id, subject, content, createdAt }
    identity: { firstName: '', lastName: '', phone: '', address: '' },
    pin: null, // קוד בן 4 ספרות לנעילת האפליקציה, או null אם אין נעילה
    theme: 'dark', // 'dark' | 'light'
  };
}

// זיהוי קטגוריה לפי מילות מפתח בנושא, כדי לבחור אייקון מתאים
function getCategoryIcon(subject) {
  const s = subject || '';
  if (/סיסמ/.test(s)) return KeyRound;
  if (/טלפון|נייד/.test(s)) return Phone;
  if (/ת\.?\s?ז|תעודת זהות/.test(s)) return CreditCard;
  if (/מייל|אימייל|דוא"?ל/.test(s)) return Mail;
  if (/כתובת/.test(s)) return MapPin;
  if (/משתמש|יוזר/.test(s)) return UserRound;
  if (/קוד/.test(s)) return LockKeyhole;
  return BookMarked;
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function App() {
  // --- Initial Data Loading ---
  const loadInitialData = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...defaultData(), ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load data from localStorage', e);
    }
    return defaultData();
  };

  const initialData = loadInitialData();

  // --- State ---
  const [memories, setMemories] = useState(initialData.memories);
  const [identity, setIdentity] = useState(initialData.identity);
  const [pin, setPin] = useState(initialData.pin);
  const [themeMode, setThemeMode] = useState(initialData.theme);

  const [locked, setLocked] = useState(!!initialData.pin);
  const [lockInput, setLockInput] = useState('');
  const [lockError, setLockError] = useState('');
  const [showLockInput, setShowLockInput] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [businessTableOpen, setBusinessTableOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'subjectSearch' | 'generalSearch' | 'pin' | 'identity' | 'detail'
  const [selectedMemoryId, setSelectedMemoryId] = useState(null);

  const [composerStage, setComposerStage] = useState('subject'); // 'subject' | 'content'
  const [pendingSubject, setPendingSubject] = useState('');
  const [composerValue, setComposerValue] = useState('');
  const composerRef = useRef(null);

  const [toast, setToast] = useState('');
  const [micListening, setMicListening] = useState(false);

  // --- Auto-Save Effect ---
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ memories, identity, pin, theme: themeMode }));
    } catch (e) {
      console.error('Failed to save data to localStorage', e);
    }
  }, [memories, identity, pin, themeMode]);

  // --- Toast helper ---
  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(''), 2200);
  };

  // --- Theme tokens ---
  const isLight = themeMode === 'light';
  const t = {
    frameBg: isLight ? 'bg-white' : 'bg-gradient-to-b from-[#0d0b1a] via-[#0a0912] to-black',
    text: isLight ? 'text-gray-900' : 'text-white',
    muted: isLight ? 'text-gray-500' : 'text-gray-400',
    subtle: isLight ? 'text-gray-400' : 'text-gray-500',
    panel: isLight ? 'bg-white' : 'bg-[#15131f]',
    panelBorder: isLight ? 'border-gray-200' : 'border-white/10',
    row: isLight ? 'hover:bg-gray-100' : 'hover:bg-white/5',
    input: isLight ? 'bg-gray-100 text-gray-900 placeholder-gray-400 border-gray-200' : 'bg-white/5 text-white placeholder-gray-500 border-white/10',
    pillBg: isLight ? 'bg-gray-100 border-gray-200' : 'bg-white/5 border-white/10',
    iconBtn: isLight ? 'bg-gray-100 hover:bg-gray-200 text-black' : 'bg-white/10 hover:bg-white/20 text-white',
    iconColor: isLight ? 'text-black' : 'text-white',
    iconCircleBg: isLight ? 'bg-gray-100' : 'bg-white/10',
    accentBg: 'bg-[#7e14ff]',
    scrim: 'bg-black/60',
  };

  // --- Memory CRUD ---
  const addMemory = (subject, content) => {
    const newMemory = { id: crypto.randomUUID(), subject: subject.trim(), content: content.trim(), createdAt: Date.now() };
    setMemories((prev) => [newMemory, ...prev]);
    showToast('נשמר בהצלחה');
  };

  const deleteMemory = (id) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    if (selectedMemoryId === id) {
      setSelectedMemoryId(null);
      setActiveModal(null);
    }
  };

  const sortedMemories = useMemo(
    () => [...memories].sort((a, b) => b.createdAt - a.createdAt),
    [memories]
  );

  // --- Composer handlers ---
  const resetComposer = () => {
    setComposerStage('subject');
    setPendingSubject('');
    setComposerValue('');
  };

  const handleComposerSubmit = () => {
    const value = composerValue.trim();
    if (!value) return;
    if (composerStage === 'subject') {
      setPendingSubject(value);
      setComposerValue('');
      setComposerStage('content');
      composerRef.current?.focus();
    } else {
      addMemory(pendingSubject, value);
      resetComposer();
      composerRef.current?.focus();
    }
  };

  const handleComposerKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleComposerSubmit();
    } else if (e.key === 'Escape' && composerStage === 'content') {
      resetComposer();
    }
  };

  const handleMic = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('זיהוי קול אינו נתמך בדפדפן הזה');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setMicListening(true);
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || '';
      setComposerValue((prev) => (prev ? `${prev} ${text}` : text));
    };
    recognition.onerror = () => showToast('לא הצלחתי לזהות, נסה שוב');
    recognition.onend = () => setMicListening(false);
    recognition.start();
  };

  // --- Lock screen handlers ---
  const handleUnlock = () => {
    if (lockInput === pin) {
      setLocked(false);
      setLockInput('');
      setLockError('');
    } else {
      setLockError('קוד שגוי, נסה שוב');
      setLockInput('');
    }
  };

  // --- Derived: selected memory for detail modal ---
  const selectedMemory = memories.find((m) => m.id === selectedMemoryId) || null;

  const renderMemoryRow = (mem, opts = {}) => {
    const Icon = getCategoryIcon(mem.subject);
    return (
      <div
        key={mem.id}
        className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors ${t.row} ${opts.bordered ? `border ${t.panelBorder}` : ''}`}
        onClick={() => {
          setSelectedMemoryId(mem.id);
          setActiveModal('detail');
        }}
      >
        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${t.iconCircleBg}`}>
          <Icon size={18} className={t.iconColor} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-medium truncate ${t.text}`}>{mem.subject}</div>
          <div className={`text-xs truncate ${t.muted}`}>{mem.content}</div>
        </div>
        <ChevronRight size={16} className={t.subtle} />
      </div>
    );
  };

  // =========================================================================
  // LOCK SCREEN
  // =========================================================================
  if (locked) {
    return (
      <div className={`h-[100dvh] w-full flex items-center justify-center ${isLight ? 'bg-gray-100' : 'bg-black'} p-4`} dir="rtl">
        <div className={`relative w-full max-w-[430px] h-[820px] max-h-[92vh] rounded-[2.5rem] overflow-hidden shadow-2xl ${t.frameBg} flex flex-col items-center justify-center px-8`}>
          <div className="mb-6">
            <BrainLogo size={88} />
          </div>
          <h1 className={`text-lg font-bold mb-1 ${t.text}`}>Bob נעול</h1>
          <p className={`text-sm mb-6 ${t.muted}`}>הזן את הקוד בן 4 הספרות כדי להיכנס</p>
          <div className="w-full relative">
            <input
              type={showLockInput ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoFocus
              value={lockInput}
              onChange={(e) => setLockInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              className={`w-full text-center text-2xl tracking-[1em] py-4 rounded-xl border outline-none ${t.input}`}
              placeholder="----"
            />
            <button
              onClick={() => setShowLockInput((v) => !v)}
              className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.muted}`}
            >
              {showLockInput ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {lockError && <p className="text-red-400 text-sm mt-3">{lockError}</p>}
          <button
            onClick={handleUnlock}
            className={`w-full mt-6 py-3 rounded-xl font-medium text-white ${t.accentBg} hover:opacity-90 transition-opacity`}
          >
            פתח
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN APP
  // =========================================================================
  return (
    <div className={`h-[100dvh] w-full flex items-center justify-center ${isLight ? 'bg-gray-100' : 'bg-black'} p-0 sm:p-4`} dir="rtl">
      <div className={`relative w-full max-w-[430px] h-[100dvh] sm:h-[820px] sm:max-h-[92vh] sm:rounded-[2.5rem] overflow-hidden shadow-2xl ${t.frameBg} ${t.text} flex flex-col`}>

        {/* ================= HOME SCREEN ================= */}
        <div className="relative flex flex-col h-full">
          {/* Header */}
          <div className="relative flex flex-col items-center pt-10 pb-4 px-4">
            <button
              onClick={() => setMenuOpen(true)}
              className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${t.iconBtn}`}
              title="תפריט"
            >
              <Menu size={20} />
            </button>
            <div className="mb-3">
              <BrainLogo size={72} />
            </div>
            <h1 className={`text-lg font-bold text-center px-6 ${t.text}`}>מה תרצה להזכיר לי היום?</h1>
          </div>

          {/* Feed of saved memories */}
          <div className="flex-1 overflow-y-auto px-4 pb-2 flex flex-col gap-2">
            {sortedMemories.length === 0 ? (
              <div className={`flex-1 flex items-center justify-center text-sm ${t.subtle}`}>
                עדיין לא שמרת שום דבר
              </div>
            ) : (
              sortedMemories.map((mem) => renderMemoryRow(mem))
            )}
          </div>

          {/* Composer */}
          <div className="px-4 pb-8 pt-2">
            {composerStage === 'content' && (
              <div className={`mb-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border ${t.pillBg} ${t.muted}`}>
                <span>נושא: {pendingSubject}</span>
                <button onClick={resetComposer} className="hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            )}
            <div className={`flex items-center gap-2 rounded-full border px-2 py-2 ${t.pillBg}`}>
              <button
                onClick={handleMic}
                className={`shrink-0 p-2 rounded-full transition-colors ${micListening ? 'text-[#7e14ff] animate-pulse' : t.muted}`}
                title="הקלטה קולית"
              >
                <Mic size={20} />
              </button>
              <div className={`w-px h-6 ${t.divider}`} />
              <input
                ref={composerRef}
                type="text"
                value={composerValue}
                onChange={(e) => setComposerValue(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={composerStage === 'subject' ? 'על מה תרצה שאזכיר לך? (לדוגמה: סיסמה לאינסטגרם)' : 'עכשיו כתוב את התוכן (לדוגמה: הסיסמה עצמה)'}
                className={`flex-1 min-w-0 bg-transparent outline-none px-2 text-sm ${t.text} placeholder:${t.subtle}`}
              />
              <button
                onClick={handleComposerSubmit}
                className={`shrink-0 p-2 rounded-full text-white ${t.accentBg} hover:opacity-90 transition-opacity`}
                title={composerStage === 'subject' ? 'הבא' : 'שמור'}
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* ================= MENU SCREEN ================= */}
        {menuOpen && (
          <div className={`absolute inset-0 z-30 flex flex-col ${t.frameBg}`}>
            <div className="flex items-center justify-between px-4 pt-6 pb-4">
              <div className="flex items-center gap-2">
                <BrainLogo size={30} />
                <span className={`font-bold ${t.text}`}>Bob</span>
              </div>
              <button onClick={() => setMenuOpen(false)} className={`p-2 rounded-full ${t.iconBtn}`}>
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-1">
              <button
                onClick={() => { setMenuOpen(false); resetComposer(); setTimeout(() => composerRef.current?.focus(), 50); }}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${t.row}`}
              >
                <SquarePen size={18} className={t.iconColor} />
                <span className={`text-sm ${t.text}`}>להזכיר משהו חדש</span>
              </button>

              <button
                onClick={() => setActiveModal('subjectSearch')}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${t.row}`}
              >
                <Search size={18} className={t.iconColor} />
                <span className={`text-sm ${t.text}`}>חיפוש מידע לפי נושא</span>
              </button>

              <button
                onClick={() => setActiveModal('generalSearch')}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${t.row}`}
              >
                <LayoutGrid size={18} className={t.iconColor} />
                <span className={`text-sm ${t.text}`}>חיפוש מידע כללי</span>
              </button>

              <button
                onClick={() => { setMenuOpen(false); setBusinessTableOpen(true); }}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${t.row}`}
              >
                <Plus size={18} className={t.iconColor} />
                <span className={`text-sm ${t.text}`}>פתח טבלת אקסל עסקית</span>
              </button>

              <div className={`text-xs mt-4 mb-1 px-3 ${t.subtle}`}>אחרונים שנשמרו</div>
              {sortedMemories.length === 0 ? (
                <div className={`px-3 py-2 text-sm ${t.subtle}`}>אין עדיין זיכרונות שמורים</div>
              ) : (
                sortedMemories.map((mem) => renderMemoryRow(mem))
              )}

              <div className="flex justify-end px-1 pt-3">
                <button
                  onClick={() => setSettingsOpen(true)}
                  className={`p-3 rounded-full ${t.iconBtn}`}
                  title="הגדרות"
                >
                  <Settings size={20} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= SETTINGS SHEET ================= */}
        {settingsOpen && (
          <div className="absolute inset-0 z-40 flex items-end">
            <div className={`absolute inset-0 ${t.scrim}`} onClick={() => setSettingsOpen(false)} />
            <div className={`relative w-full rounded-t-3xl border-t ${t.panelBorder} ${t.panel} px-4 pt-5 pb-8 flex flex-col gap-1`}>
              <button
                onClick={() => setThemeMode((m) => (m === 'light' ? 'dark' : 'light'))}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${t.row}`}
              >
                {isLight ? <Moon size={18} className={t.iconColor} /> : <Sun size={18} className={t.iconColor} />}
                <span className={`text-sm ${t.text}`}>בהירות המסך</span>
              </button>

              <button
                onClick={() => setActiveModal('pin')}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${t.row}`}
              >
                <Lock size={18} className={t.iconColor} />
                <span className={`text-sm ${t.text}`}>{pin ? 'שינוי קוד לאפליקציה' : 'יצירת קוד לאפליקציה'}</span>
              </button>

              <button
                onClick={() => setActiveModal('identity')}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${t.row}`}
              >
                <UserRound size={18} className={t.iconColor} />
                <span className={`text-sm ${t.text}`}>הזהות שלי</span>
              </button>

              <div className="flex justify-center pt-4">
                <button
                  onClick={() => setSettingsOpen(false)}
                  className={`p-2 rounded-full ${t.iconBtn}`}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= BUSINESS TABLE (טבלת אקסל עסקית) ================= */}
        {businessTableOpen && <BusinessTable onClose={() => setBusinessTableOpen(false)} />}

        {/* ================= SEARCH MODALS ================= */}
        {(activeModal === 'subjectSearch' || activeModal === 'generalSearch') && (
          <SearchModal
            mode={activeModal}
            t={t}
            memories={sortedMemories}
            onClose={() => setActiveModal(null)}
            onSelect={(id) => { setSelectedMemoryId(id); setActiveModal('detail'); }}
            renderRow={renderMemoryRow}
          />
        )}

        {/* ================= DETAIL MODAL ================= */}
        {activeModal === 'detail' && selectedMemory && (
          <DetailModal
            t={t}
            memory={selectedMemory}
            onClose={() => { setActiveModal(null); setSelectedMemoryId(null); }}
            onDelete={() => deleteMemory(selectedMemory.id)}
            onCopy={() => {
              navigator.clipboard?.writeText(selectedMemory.content);
              showToast('הועתק ללוח');
            }}
          />
        )}

        {/* ================= PIN MODAL ================= */}
        {activeModal === 'pin' && (
          <PinModal
            t={t}
            currentPin={pin}
            onClose={() => setActiveModal(null)}
            onSave={(newPin) => { setPin(newPin); setActiveModal(null); showToast(newPin ? 'הקוד נשמר' : 'הנעילה בוטלה'); }}
          />
        )}

        {/* ================= IDENTITY MODAL ================= */}
        {activeModal === 'identity' && (
          <IdentityModal
            t={t}
            identity={identity}
            onClose={() => setActiveModal(null)}
            onSave={(next) => { setIdentity(next); setActiveModal(null); showToast('הפרטים נשמרו'); }}
          />
        )}

        {/* ================= TOAST ================= */}
        {toast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
            <div className={`px-4 py-2 rounded-full text-sm shadow-lg ${isLight ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
              {toast}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function ModalShell({ t, title, onClose, children }) {
  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className={`absolute inset-0 ${t.scrim}`} onClick={onClose} />
      <div className={`relative w-full sm:max-w-sm max-h-[85%] rounded-t-3xl sm:rounded-3xl border ${t.panelBorder} ${t.panel} flex flex-col`}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className={`font-bold text-sm ${t.text}`}>{title}</h3>
          <button onClick={onClose} className={`p-1.5 rounded-full ${t.iconBtn}`}>
            <X size={16} />
          </button>
        </div>
        <div className="px-4 pb-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function SearchModal({ mode, t, memories, onClose, onSelect, renderRow }) {
  const [query, setQuery] = useState('');
  const isSubjectMode = mode === 'subjectSearch';

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return memories.filter((m) => {
      const subjectMatch = m.subject.toLowerCase().includes(q);
      if (isSubjectMode) return subjectMatch;
      return subjectMatch || m.content.toLowerCase().includes(q);
    });
  }, [memories, query, isSubjectMode]);

  return (
    <ModalShell t={t} title={isSubjectMode ? 'חיפוש מידע לפי נושא' : 'חיפוש מידע כללי'} onClose={onClose}>
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={isSubjectMode ? 'לדוגמה: אינסטגרם' : 'לדוגמה: סיסמה, טלפון, קוד...'}
        className={`w-full px-3 py-2.5 rounded-xl border outline-none text-sm mb-3 ${t.input}`}
      />
      <div className="flex flex-col gap-1">
        {query.trim() === '' ? (
          <div className={`text-sm text-center py-6 ${t.subtle}`}>התחל להקליד כדי לחפש</div>
        ) : results.length === 0 ? (
          <div className={`text-sm text-center py-6 ${t.subtle}`}>לא נמצאו תוצאות</div>
        ) : (
          results.map((mem) => (
            <div key={mem.id} onClick={() => onSelect(mem.id)}>
              {renderRow(mem)}
            </div>
          ))
        )}
      </div>
    </ModalShell>
  );
}

function DetailModal({ t, memory, onClose, onDelete, onCopy }) {
  const Icon = getCategoryIcon(memory.subject);
  return (
    <ModalShell t={t} title="פרטי הזיכרון" onClose={onClose}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center ${t.accentBg}`}>
          <Icon size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <div className={`font-bold ${t.text}`}>{memory.subject}</div>
          <div className={`text-xs ${t.subtle}`}>{formatTime(memory.createdAt)}</div>
        </div>
      </div>
      <div className={`p-3 rounded-xl border font-mono text-sm break-all mb-4 ${t.input}`}>
        {memory.content}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCopy}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white ${t.accentBg} hover:opacity-90 transition-opacity`}
        >
          <Copy size={16} />
          העתק
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <Trash2 size={16} />
          מחק
        </button>
      </div>
    </ModalShell>
  );
}

function PinModal({ t, currentPin, onClose, onSave }) {
  const [step, setStep] = useState('first'); // 'first' | 'confirm'
  const [firstValue, setFirstValue] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleDigits = (setter) => (e) => setter(e.target.value.replace(/\D/g, '').slice(0, 4));

  const handleContinue = () => {
    if (firstValue.length !== 4) {
      setError('הקוד חייב להכיל 4 ספרות');
      return;
    }
    setError('');
    setStep('confirm');
  };

  const handleConfirm = () => {
    if (value !== firstValue) {
      setError('הקודים לא תואמים, נסה שוב');
      setFirstValue('');
      setValue('');
      setStep('first');
      return;
    }
    onSave(firstValue);
  };

  return (
    <ModalShell t={t} title="נעילת האפליקציה" onClose={onClose}>
      <p className={`text-xs mb-4 ${t.subtle}`}>
        הקוד נשמר במכשיר שלך בלבד (גרסת בטא ללא הצפנה) ולא נשלח לשום שרת.
      </p>

      {step === 'first' ? (
        <>
          <label className={`text-sm block mb-2 ${t.text}`}>בחר קוד בן 4 ספרות</label>
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={firstValue}
            onChange={handleDigits(setFirstValue)}
            onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
            className={`w-full text-center text-2xl tracking-[0.8em] py-3 rounded-xl border outline-none mb-2 ${t.input}`}
            placeholder="----"
          />
          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
          <button
            onClick={handleContinue}
            className={`w-full py-2.5 rounded-xl text-sm font-medium text-white ${t.accentBg} hover:opacity-90 transition-opacity mt-2`}
          >
            המשך
          </button>
        </>
      ) : (
        <>
          <label className={`text-sm block mb-2 ${t.text}`}>אשר את הקוד</label>
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={value}
            onChange={handleDigits(setValue)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            className={`w-full text-center text-2xl tracking-[0.8em] py-3 rounded-xl border outline-none mb-2 ${t.input}`}
            placeholder="----"
          />
          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
          <button
            onClick={handleConfirm}
            className={`w-full py-2.5 rounded-xl text-sm font-medium text-white ${t.accentBg} hover:opacity-90 transition-opacity mt-2`}
          >
            שמור
          </button>
        </>
      )}

      {currentPin && (
        <button
          onClick={() => onSave(null)}
          className="w-full py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors mt-3"
        >
          בטל נעילה
        </button>
      )}
    </ModalShell>
  );
}

function IdentityModal({ t, identity, onClose, onSave }) {
  const [form, setForm] = useState(identity);

  const field = (key, label, placeholder, type = 'text') => (
    <div className="mb-3">
      <label className={`text-xs block mb-1 ${t.muted}`}>{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 rounded-xl border outline-none text-sm ${t.input}`}
      />
    </div>
  );

  return (
    <ModalShell t={t} title="הזהות שלי" onClose={onClose}>
      <p className={`text-xs mb-4 ${t.subtle}`}>כל השדות אופציונליים.</p>
      {field('firstName', 'שם פרטי', 'לדוגמה: שחר')}
      {field('lastName', 'שם משפחה', 'לדוגמה: כהן')}
      {field('phone', 'מספר טלפון', 'לדוגמה: 050-1234567', 'tel')}
      {field('address', 'כתובת', 'לדוגמה: רחוב הפרחים 12, תל אביב')}
      <button
        onClick={() => onSave(form)}
        className={`w-full py-2.5 rounded-xl text-sm font-medium text-white ${t.accentBg} hover:opacity-90 transition-opacity mt-2 flex items-center justify-center gap-2`}
      >
        <Check size={16} />
        שמור
      </button>
    </ModalShell>
  );
}
