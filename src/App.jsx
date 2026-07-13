import { useState, useEffect, useCallback, useRef } from 'react'
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, query, orderBy
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'
import {
  CheckCircle, Camera, Hash, List, ChevronRight, X, Plus, Trash2,
  LogOut, Users, ClipboardList, ShoppingBag, AlertCircle, Eye, EyeOff,
  Package, DollarSign, Edit3, Check, RefreshCw
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const ADMIN_PIN = '2309'

const SHIFTS = [
  { id: 'opening', label: 'פתיחה', time: '08:00', color: 'bg-cyan-500', hour: 8 },
  { id: 'middle',  label: 'אמצע',  time: '12:00', color: 'bg-yellow-400', hour: 12 },
  { id: 'closing', label: 'סגירה', time: '17:00', color: 'bg-indigo-500', hour: 17 },
]

const TASK_TYPES = [
  { id: 'regular', label: 'רגיל',  color: 'bg-green-500',  icon: CheckCircle },
  { id: 'photo',   label: 'צילום', color: 'bg-purple-500', icon: Camera },
  { id: 'number',  label: 'מספר',  color: 'bg-orange-500', icon: Hash },
  { id: 'list',    label: 'רשימה', color: 'bg-red-500',    icon: List },
]

const TYPE_META = Object.fromEntries(TASK_TYPES.map(t => [t.id, t]))

function getCurrentShiftId() {
  const h = new Date().getHours()
  if (h >= 17) return 'closing'
  if (h >= 12) return 'middle'
  return 'opening'
}

// ─── Squircle Task Icon ───────────────────────────────────────────────────────
function TaskIcon({ type }) {
  const meta = TYPE_META[type] || TYPE_META.regular
  const Icon = meta.icon
  return (
    <div className={`w-12 h-12 ${meta.color} rounded-[1.5rem] flex items-center justify-center flex-shrink-0 shadow-sm`}>
      <Icon size={20} color="white" strokeWidth={2.2} />
    </div>
  )
}

// ─── PIN Keypad ───────────────────────────────────────────────────────────────
function PinKeypad({ onSuccess }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const employeesRef = useRef([])

  const refreshEmployees = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'employees'))
      employeesRef.current = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    } catch {
      employeesRef.current = []
    }
  }, [])

  useEffect(() => { refreshEmployees() }, [refreshEmployees])

  const handleDigit = useCallback(async (digit) => {
    setError('')
    const next = pin + digit
    if (next.length === 4) {
      // Stale-closure fix: always fetch fresh employee list on 4th digit
      setLoading(true)
      await refreshEmployees()
      setLoading(false)

      if (next === ADMIN_PIN) {
        onSuccess({ role: 'admin', name: 'מנהל', id: 'admin' })
        return
      }
      const emp = employeesRef.current.find(e => e.pin === next)
      if (emp) {
        onSuccess({ role: 'employee', name: emp.name, id: emp.id })
      } else {
        setError('קוד שגוי, נסה שוב')
        setPin('')
      }
    } else {
      setPin(next)
    }
  }, [pin, refreshEmployees, onSuccess])

  const handleDelete = useCallback(() => {
    setError('')
    setPin(p => p.slice(0, -1))
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-slate-900 px-6">
      <div className="w-full max-w-xs flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 bg-cyan-500 rounded-[2rem] flex items-center justify-center shadow-lg">
            <ClipboardList size={40} color="white" strokeWidth={1.8} />
          </div>
          <h1 className="text-white text-3xl font-bold tracking-wide">Dex</h1>
          <p className="text-slate-400 text-sm">הזן קוד כניסה</p>
        </div>

        <div className="flex gap-4" dir="ltr">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${i < pin.length ? 'bg-cyan-400 scale-110' : 'bg-slate-600'}`} />
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/30 px-4 py-2 rounded-xl w-full justify-center">
            <AlertCircle size={16} />{error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 w-full" dir="ltr">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => {
            if (k === '') return <div key={i} />
            return (
              <button
                key={i}
                onClick={() => k === '⌫' ? handleDelete() : handleDigit(k)}
                disabled={loading || (k !== '⌫' && pin.length >= 4)}
                className={`h-16 rounded-2xl text-2xl font-semibold transition-all active:scale-95 bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-40`}
              >
                {loading && k !== '⌫' ? <RefreshCw size={20} className="animate-spin mx-auto" /> : k}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Employee Manager ─────────────────────────────────────────────────────────
function EmployeeManager({ onBack }) {
  const [employees, setEmployees] = useState([])
  const [newName, setNewName] = useState('')
  const [newPin, setNewPin] = useState('')
  const [pinVisible, setPinVisible] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    return onSnapshot(collection(db, 'employees'), snap => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  const addEmployee = async () => {
    setError('')
    if (!newName.trim()) return setError('הכנס שם עובד')
    if (!/^\d{4}$/.test(newPin)) return setError('PIN חייב להיות 4 ספרות')
    if (newPin === ADMIN_PIN) return setError('PIN זה שמור למנהל')
    const dup = employees.find(e => e.pin === newPin)
    if (dup) return setError(`PIN זה כבר שייך ל-${dup.name}`)
    setSaving(true)
    await addDoc(collection(db, 'employees'), { name: newName.trim(), pin: newPin, createdAt: serverTimestamp() })
    setNewName(''); setNewPin('')
    setSaving(false)
  }

  const deleteEmployee = async (id) => {
    if (!confirm('למחוק עובד זה?')) return
    await deleteDoc(doc(db, 'employees', id))
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl">
          <ChevronRight size={22} className="text-slate-600" />
        </button>
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Users size={20} className="text-cyan-500" /> ניהול עובדים
        </h2>
      </header>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-700 mb-3">הוספת עובד חדש</h3>
          <div className="flex flex-col gap-3">
            <input className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-cyan-400" placeholder="שם העובד" value={newName} onChange={e => setNewName(e.target.value)} />
            <input className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-cyan-400" placeholder="קוד PIN (4 ספרות)" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))} inputMode="numeric" />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button onClick={addEmployee} disabled={saving} className="bg-cyan-500 text-white rounded-xl py-2.5 text-sm font-semibold active:scale-95 transition-transform disabled:opacity-50">
              {saving ? 'שומר...' : '+ הוסף עובד'}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {employees.map(emp => (
            <div key={emp.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-slate-600 font-bold text-sm">{emp.name[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">{emp.name}</p>
                <p className="text-slate-400 text-xs font-mono">PIN: {pinVisible[emp.id] ? emp.pin : '••••'}</p>
              </div>
              <button onClick={() => setPinVisible(v => ({...v,[emp.id]:!v[emp.id]}))} className="p-2 text-slate-400">
                {pinVisible[emp.id] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => deleteEmployee(emp.id)} className="p-2 text-red-400">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {employees.length === 0 && <p className="text-center text-slate-400 text-sm py-8">אין עובדים רשומים עדיין</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Task Editor ──────────────────────────────────────────────────────────────
function TaskEditor({ task, onBack, onSave }) {
  const isEdit = !!task
  const [title, setTitle] = useState(task?.title || '')
  const [type, setType] = useState(task?.type || 'regular')
  const [shift, setShift] = useState(task?.shift || getCurrentShiftId())
  const [expectedNumber, setExpectedNumber] = useState(task?.expectedNumber ?? '')
  const [listItems, setListItems] = useState(task?.listItems || [{ name: '', qty: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setError('')
    if (!title.trim()) return setError('הכנס כותרת למשימה')
    if (type === 'number' && (expectedNumber === '' || isNaN(Number(expectedNumber)))) return setError('הכנס מספר צפוי')
    if (type === 'list' && !listItems.some(it => it.name.trim())) return setError('הוסף לפחות פריט אחד')
    setSaving(true)
    const data = {
      title: title.trim(), type, shift, done: false, note: '', updatedAt: serverTimestamp(),
      ...(type === 'number' ? { expectedNumber: Number(expectedNumber), actualNumber: null } : {}),
      ...(type === 'list' ? { listItems: listItems.filter(it => it.name.trim()).map(it => ({ name: it.name.trim(), qty: it.qty.trim() || '0', done: false })) } : {}),
      ...(type === 'photo' ? { photoUrl: null } : {}),
    }
    if (isEdit) {
      await updateDoc(doc(db, 'tasks', task.id), data)
    } else {
      data.createdAt = serverTimestamp()
      await addDoc(collection(db, 'tasks'), data)
    }
    setSaving(false)
    onSave()
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl"><ChevronRight size={22} className="text-slate-600" /></button>
        <h2 className="text-lg font-bold text-slate-800">{isEdit ? 'עריכת משימה' : 'משימה חדשה'}</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3">
          <label className="text-sm font-semibold text-slate-600">כותרת</label>
          <input className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-cyan-400" placeholder="שם המשימה" value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <label className="text-sm font-semibold text-slate-600 block mb-3">סוג משימה</label>
          <div className="grid grid-cols-2 gap-2">
            {TASK_TYPES.map(t => {
              const Icon = t.icon
              const selected = type === t.id
              return (
                <button key={t.id} onClick={() => setType(t.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${selected ? `border-transparent ${t.color} text-white` : 'border-slate-200 text-slate-600'}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${selected ? 'bg-white/20' : t.color}`}>
                    <Icon size={16} color="white" />
                  </div>
                  <span className="text-sm font-semibold">{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <label className="text-sm font-semibold text-slate-600 block mb-3">משמרת</label>
          <div className="flex gap-2">
            {SHIFTS.map(s => (
              <button key={s.id} onClick={() => setShift(s.id)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${shift === s.id ? `${s.color} text-white` : 'bg-slate-100 text-slate-500'}`}>
                <div>{s.label}</div>
                <div className="text-xs opacity-75">{s.time}</div>
              </button>
            ))}
          </div>
        </div>

        {type === 'number' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <label className="text-sm font-semibold text-slate-600 block mb-2">מספר צפוי</label>
            <input className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 w-full" placeholder="הכנס מספר" value={expectedNumber} onChange={e => setExpectedNumber(e.target.value.replace(/\D/g,''))} inputMode="numeric" />
          </div>
        )}

        {type === 'list' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <label className="text-sm font-semibold text-slate-600 block mb-3">פריטי הרשימה</label>
            <div className="flex flex-col gap-2">
              {listItems.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" placeholder="שם פריט" value={item.name} onChange={e => setListItems(ls => ls.map((l,j) => j===i?{...l,name:e.target.value}:l))} />
                  <input className="w-20 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400 text-center" placeholder="כמות" value={item.qty} onChange={e => setListItems(ls => ls.map((l,j) => j===i?{...l,qty:e.target.value}:l))} inputMode="numeric" />
                  {listItems.length > 1 && <button onClick={() => setListItems(ls => ls.filter((_,j) => j!==i))} className="p-2 text-red-400"><X size={16} /></button>}
                </div>
              ))}
              <button onClick={() => setListItems(ls => [...ls,{name:'',qty:''}])} className="flex items-center gap-1 text-red-500 text-sm font-semibold mt-1">
                <Plus size={16} /> הוסף פריט
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <button onClick={save} disabled={saving} className="bg-cyan-500 text-white rounded-2xl py-3.5 font-semibold active:scale-95 transition-transform disabled:opacity-50 shadow-sm">
          {saving ? 'שומר...' : isEdit ? 'שמור שינויים' : 'צור משימה'}
        </button>
      </div>
    </div>
  )
}

// ─── Note Modal ───────────────────────────────────────────────────────────────
function NoteModal({ task, onClose }) {
  const [note, setNote] = useState(task.note || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await updateDoc(doc(db, 'tasks', task.id), { note, updatedAt: serverTimestamp() })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">הערה / חריג</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
        </div>
        <p className="text-slate-500 text-sm">{task.title}</p>
        <textarea className="border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-cyan-400 min-h-[100px] resize-none" placeholder="תאר את החריג..." value={note} onChange={e => setNote(e.target.value)} autoFocus />
        <button onClick={save} disabled={saving} className="bg-cyan-500 text-white rounded-xl py-3 font-semibold active:scale-95 transition-transform disabled:opacity-50">
          {saving ? 'שומר...' : 'שמור הערה'}
        </button>
      </div>
    </div>
  )
}

// ─── List Task Full Screen ────────────────────────────────────────────────────
function ListTaskScreen({ task, onClose }) {
  const [items, setItems] = useState((task.listItems || []).map(it => ({...it})))
  const [saving, setSaving] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', qty: '' })

  const save = async () => {
    setSaving(true)
    await updateDoc(doc(db, 'tasks', task.id), {
      listItems: items,
      done: items.every(it => it.done),
      updatedAt: serverTimestamp()
    })
    setSaving(false)
    onClose()
  }

  const addItem = () => {
    if (!newItem.name.trim()) return
    setItems(ls => [...ls, { name: newItem.name.trim(), qty: newItem.qty || '0', done: false }])
    setNewItem({ name: '', qty: '' })
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <header className="bg-red-500 px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={onClose} className="p-2 bg-white/20 rounded-xl"><X size={20} color="white" /></button>
        <div className="flex-1">
          <h2 className="text-white font-bold text-lg">{task.title}</h2>
          <p className="text-red-100 text-xs">{items.filter(i=>i.done).length}/{items.length} פריטים</p>
        </div>
        <button onClick={save} disabled={saving} className="bg-white text-red-500 rounded-xl px-4 py-2 text-sm font-bold active:scale-95">
          {saving ? '...' : 'שמור'}
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} onClick={() => setItems(ls => ls.map((l,j) => j===i?{...l,done:!l.done}:l))}
            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${item.done ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-green-500 border-green-500' : 'border-slate-300'}`}>
              {item.done && <Check size={14} color="white" strokeWidth={3} />}
            </div>
            <span className={`flex-1 font-medium ${item.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.name}</span>
            <span className="text-slate-500 text-sm font-mono bg-slate-100 px-2 py-1 rounded-lg">{item.qty}</span>
          </div>
        ))}
        <div className="bg-slate-50 rounded-2xl p-3 border-2 border-dashed border-slate-200 flex gap-2 mt-2">
          <input className="flex-1 bg-transparent text-sm outline-none placeholder-slate-400" placeholder="פריט חדש..." value={newItem.name} onChange={e => setNewItem(n=>({...n,name:e.target.value}))} onKeyDown={e => e.key==='Enter'&&addItem()} />
          <input className="w-16 bg-transparent text-sm outline-none text-center placeholder-slate-400" placeholder="כמות" value={newItem.qty} onChange={e => setNewItem(n=>({...n,qty:e.target.value}))} inputMode="numeric" />
          <button onClick={addItem} className="p-1.5 bg-red-500 rounded-xl"><Plus size={16} color="white" /></button>
        </div>
      </div>
    </div>
  )
}

// ─── Smart Cash Modal ─────────────────────────────────────────────────────────
function CashModal({ tasks, onClose }) {
  const numberTasks = tasks.filter(t => t.type==='number' && t.actualNumber != null)
  const listTasks   = tasks.filter(t => t.type==='list' && t.listItems?.length)
  const totalCash = numberTasks.reduce((s,t) => s + (Number(t.actualNumber)||0), 0)
  const inventoryMap = {}
  listTasks.forEach(t => (t.listItems||[]).forEach(it => {
    inventoryMap[it.name] = (inventoryMap[it.name]||0) + (Number(it.qty)||0)
  }))

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl max-h-[80dvh] flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <ShoppingBag size={20} className="text-cyan-500" /> קופה חכמה
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={18} className="text-cyan-600" />
              <span className="font-semibold text-cyan-700">מזומן מצטבר (ספירות מספר)</span>
            </div>
            <p className="text-3xl font-bold text-cyan-800">{totalCash.toLocaleString()}</p>
            {numberTasks.length === 0 && <p className="text-cyan-500 text-sm mt-1">אין ספירות מספר</p>}
            {numberTasks.map(t => (
              <div key={t.id} className="flex justify-between text-sm text-cyan-600 mt-1">
                <span>{t.title}</span><span className="font-mono">{Number(t.actualNumber).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package size={18} className="text-red-600" />
              <span className="font-semibold text-red-700">מלאי מצטבר (רשימות)</span>
            </div>
            {Object.keys(inventoryMap).length === 0 && <p className="text-red-400 text-sm">אין רשימות מלאי</p>}
            {Object.entries(inventoryMap).map(([name,qty]) => (
              <div key={name} className="flex justify-between text-sm text-red-700 py-1 border-b border-red-100 last:border-0">
                <span>{name}</span><span className="font-mono font-semibold">{qty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, isAdmin, onDelete, onEdit }) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [numberInput, setNumberInput] = useState(task.actualNumber ?? '')
  const [numError, setNumError] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const markDone   = () => updateDoc(doc(db,'tasks',task.id), { done: true,  updatedAt: serverTimestamp() })
  const markUndone = () => updateDoc(doc(db,'tasks',task.id), { done: false, updatedAt: serverTimestamp() })

  const submitNumber = async () => {
    const val = Number(numberInput)
    if (val !== task.expectedNumber) { setNumError(true); return }
    setNumError(false)
    await updateDoc(doc(db,'tasks',task.id), { actualNumber: val, done: true, updatedAt: serverTimestamp() })
  }

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const storageRef = ref(storage, `tasks/${task.id}/${Date.now()}_${file.name}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      await updateDoc(doc(db,'tasks',task.id), { photoUrl: url, done: true, updatedAt: serverTimestamp() })
    } catch { alert('שגיאה בהעלאת התמונה') }
    setUploading(false)
  }

  return (
    <>
      <div className={`bg-white rounded-2xl shadow-sm border transition-all ${task.done ? 'border-green-200 opacity-90' : 'border-slate-100'}`}>
        <div className="flex items-start gap-3 p-4">
          <TaskIcon type={task.type} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className={`font-semibold text-sm leading-snug ${task.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</h4>
              {isAdmin && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={onEdit}   className="p-1.5 text-slate-400 hover:text-slate-600"><Edit3 size={14} /></button>
                  <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              )}
            </div>

            {task.done && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full mt-1">
                <Check size={10} strokeWidth={3} /> הושלם
              </span>
            )}

            {task.note && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1 mt-1.5 line-clamp-2">📝 {task.note}</p>
            )}

            {!task.done && (
              <div className="mt-3">
                {task.type === 'regular' && (
                  <button onClick={markDone} className="bg-green-500 text-white text-xs px-4 py-2 rounded-xl font-semibold active:scale-95 transition-transform">✓ בוצע</button>
                )}
                {task.type === 'photo' && (
                  <div className="flex flex-col gap-2">
                    {task.photoUrl && <img src={task.photoUrl} className="w-full max-h-40 object-cover rounded-xl" alt="צילום" />}
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="bg-purple-500 text-white text-xs px-4 py-2 rounded-xl font-semibold active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-1.5">
                      <Camera size={14} /> {uploading ? 'מעלה...' : 'צלם תמונה'}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                  </div>
                )}
                {task.type === 'number' && (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        className={`flex-1 border rounded-xl px-3 py-2 text-sm outline-none ${numError ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-orange-400'}`}
                        placeholder="הכנס מספר" value={numberInput}
                        onChange={e => { setNumberInput(e.target.value.replace(/\D/g,'')); setNumError(false) }}
                        inputMode="numeric"
                      />
                      <button onClick={submitNumber} className="bg-orange-500 text-white text-xs px-4 py-2 rounded-xl font-semibold active:scale-95 transition-transform">אישור</button>
                    </div>
                    {numError && (
                      <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">
                        <AlertCircle size={14} /> טעות בספירה, בצע ספירה חוזרת
                      </div>
                    )}
                  </div>
                )}
                {task.type === 'list' && (
                  <button onClick={() => setListOpen(true)} className="bg-red-500 text-white text-xs px-4 py-2 rounded-xl font-semibold active:scale-95 transition-transform flex items-center gap-1.5">
                    <List size={14} /> מלא רשימה
                  </button>
                )}
              </div>
            )}

            {task.done && isAdmin && (
              <button onClick={markUndone} className="mt-2 text-xs text-slate-400 hover:text-slate-600 underline">בטל סימון</button>
            )}
          </div>
        </div>
        <div className="border-t border-slate-50 px-4 py-2 flex justify-end">
          <button onClick={() => setNoteOpen(true)} className="text-xs text-slate-400 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
            <Edit3 size={12} /> הערות
            {task.note && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />}
          </button>
        </div>
      </div>
      {noteOpen && <NoteModal task={task} onClose={() => setNoteOpen(false)} />}
      {listOpen  && <ListTaskScreen task={task} onClose={() => setListOpen(false)} />}
    </>
  )
}

// ─── Shift Tabs ───────────────────────────────────────────────────────────────
function ShiftTabs({ active, onChange }) {
  return (
    <div className="flex gap-1 bg-white border-b border-slate-200 px-3 pt-2 flex-shrink-0">
      {SHIFTS.map(s => (
        <button key={s.id} onClick={() => onChange(s.id)}
          className={`flex-1 py-2 rounded-t-xl text-sm font-semibold transition-all ${active===s.id ? `${s.color} text-white shadow-sm` : 'text-slate-500'}`}>
          <div>{s.label}</div>
          <div className="text-xs opacity-75">{s.time}</div>
        </button>
      ))}
    </div>
  )
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard({ user, onLogout }) {
  const [tasks, setTasks] = useState([])
  const [shift, setShift] = useState(getCurrentShiftId())
  const [screen, setScreen] = useState('main')
  const [editingTask, setEditingTask] = useState(null)

  useEffect(() => {
    return onSnapshot(query(collection(db,'tasks'), orderBy('createdAt','desc')), snap => {
      setTasks(snap.docs.map(d => ({id:d.id,...d.data()})))
    })
  }, [])

  const deleteTask = async (id) => {
    if (!confirm('למחוק משימה זו?')) return
    await deleteDoc(doc(db,'tasks',id))
  }

  const shiftTasks = tasks.filter(t => t.shift === shift)

  if (screen === 'employees') return <EmployeeManager onBack={() => setScreen('main')} />
  if (screen === 'newTask')   return <TaskEditor onBack={() => setScreen('main')} onSave={() => setScreen('main')} />
  if (screen === 'editTask')  return <TaskEditor task={editingTask} onBack={() => setScreen('main')} onSave={() => setScreen('main')} />

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1">
          <h1 className="font-bold text-slate-800 text-lg">Dex</h1>
          <p className="text-xs text-slate-400">לוח ניהול</p>
        </div>
        <button onClick={() => setScreen('employees')} className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl">
          <Users size={20} className="text-slate-600" />
        </button>
        <button onClick={() => setScreen('newTask')} className="bg-cyan-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition-transform">
          <Plus size={16} /> משימה
        </button>
        <button onClick={onLogout} className="p-2.5 text-slate-400 hover:text-slate-600"><LogOut size={18} /></button>
      </header>

      <ShiftTabs active={shift} onChange={setShift} />

      <div className="bg-white border-b border-slate-100 px-4 py-2 flex gap-4 flex-shrink-0">
        <span className="text-xs text-slate-500">{shiftTasks.length} משימות</span>
        <span className="text-xs text-green-600">{shiftTasks.filter(t=>t.done).length} הושלמו</span>
        <span className="text-xs text-slate-400">{shiftTasks.filter(t=>!t.done).length} נותרו</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {shiftTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <ClipboardList size={40} className="mb-3 opacity-30" />
            <p className="text-sm">אין משימות במשמרת זו</p>
            <button onClick={() => setScreen('newTask')} className="mt-3 text-cyan-500 text-sm font-semibold">+ הוסף משימה</button>
          </div>
        )}
        {shiftTasks.map(task => (
          <TaskCard key={task.id} task={task} isAdmin
            onDelete={() => deleteTask(task.id)}
            onEdit={() => { setEditingTask(task); setScreen('editTask') }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Employee Dashboard ───────────────────────────────────────────────────────
function EmployeeDashboard({ user, onLogout }) {
  const [tasks, setTasks] = useState([])
  const [shift, setShift] = useState(getCurrentShiftId())
  const [cashOpen, setCashOpen] = useState(false)

  useEffect(() => {
    return onSnapshot(query(collection(db,'tasks'), orderBy('createdAt','asc')), snap => {
      setTasks(snap.docs.map(d => ({id:d.id,...d.data()})))
    })
  }, [])

  const shiftTasks = tasks.filter(t => t.shift === shift)
  const done  = shiftTasks.filter(t => t.done).length
  const total = shiftTasks.length
  const progress = total ? Math.round((done/total)*100) : 0

  return (
    <>
      <div className="flex flex-col h-[100dvh] bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="flex-1">
            <h1 className="font-bold text-slate-800 text-lg">שלום, {user.name}</h1>
            <p className="text-xs text-slate-400">{done}/{total} משימות הושלמו</p>
          </div>
          <button onClick={() => setCashOpen(true)} className="bg-cyan-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition-transform">
            <ShoppingBag size={16} /> קופה
          </button>
          <button onClick={onLogout} className="p-2.5 text-slate-400 hover:text-slate-600"><LogOut size={18} /></button>
        </header>

        {total > 0 && (
          <div className="bg-white px-4 py-2 border-b border-slate-100 flex-shrink-0">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>התקדמות</span><span>{progress}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-400 rounded-full transition-all duration-500" style={{width:`${progress}%`}} />
            </div>
          </div>
        )}

        <ShiftTabs active={shift} onChange={setShift} />

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {shiftTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <CheckCircle size={40} className="mb-3 opacity-30" />
              <p className="text-sm">אין משימות במשמרת זו</p>
            </div>
          )}
          {shiftTasks.map(task => (
            <TaskCard key={task.id} task={task} isAdmin={false} />
          ))}
        </div>
      </div>
      {cashOpen && <CashModal tasks={tasks} onClose={() => setCashOpen(false)} />}
    </>
  )
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState(null)

  const handleLogin  = useCallback(user => setCurrentUser(user), [])
  const handleLogout = useCallback(() => setCurrentUser(null), [])

  if (!currentUser)                return <PinKeypad onSuccess={handleLogin} />
  if (currentUser.role === 'admin') return <AdminDashboard   user={currentUser} onLogout={handleLogout} />
  return                                   <EmployeeDashboard user={currentUser} onLogout={handleLogout} />
}
