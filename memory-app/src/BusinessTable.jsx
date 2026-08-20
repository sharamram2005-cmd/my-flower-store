import React, { useEffect, useState } from 'react';
import {
  ArrowRight, Plus, X, PlusCircle, Check, Tag, Trash2,
  HelpCircle, Eye, EyeOff, HandCoins, Lock,
} from 'lucide-react';

// טבלת ניהול מכירות עסקית — "אפליקציה" נפרדת בתוך Bob, עם השמירה שלה בנפרד (localStorage לעת עתה, ניתן לחבר Firebase בהמשך).
const STORAGE_KEY = 'bobBusinessTableData_v1';
const TAB_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#f59e0b', '#06b6d4'];

function createEmptyRow() {
  return { id: crypto.randomUUID(), product: '', cost: '', addition: '', secret: '', showSecret: false, date: '', isSettled: false };
}

function createEmptyPriceRow() {
  return { id: crypto.randomUUID(), name: '', costPrice: '', sellPrice: '', breakEvenQty: '' };
}

function defaultData() {
  const firstTabId = crypto.randomUUID();
  return {
    tabs: [{ id: firstTabId, name: 'כללי', color: TAB_COLORS[0] }],
    tableData: { [firstTabId]: Array.from({ length: 6 }, () => createEmptyRow()) },
    priceList: { [firstTabId]: [createEmptyPriceRow(), createEmptyPriceRow(), createEmptyPriceRow()] },
    activeTabId: firstTabId,
    showSecrets: false,
  };
}

// מחלצת את המספר הראשון מתוך טקסט חופשי (כולל מינוס), לצורך חישובים
function parseNumber(val) {
  if (!val) return 0;
  const strVal = String(val);
  const match = strVal.match(/-?\d+(\.\d+)?-?/);
  if (!match) return 0;
  const numStr = match[0];
  const isNegative = numStr.includes('-');
  const num = parseFloat(numStr.replace(/-/g, ''));
  return isNegative ? -num : num;
}

function getFinalCost(cost, addition) {
  return parseNumber(cost) + parseNumber(addition);
}

function getColorClass(val) {
  const num = parseNumber(val);
  if (num > 0) return 'text-[#4CAF50]';
  if (num < 0) return 'text-[#F44336]';
  return 'text-gray-300';
}

export default function BusinessTable({ onClose }) {
  const loadInitialData = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...defaultData(), ...JSON.parse(saved) };
    } catch (e) {
      console.error('Failed to load business table data from localStorage', e);
    }
    return defaultData();
  };

  const initialData = loadInitialData();

  const [tabs, setTabs] = useState(initialData.tabs);
  const [activeTabId, setActiveTabId] = useState(initialData.activeTabId || initialData.tabs[0]?.id);
  const [tableData, setTableData] = useState(initialData.tableData);
  const [priceList, setPriceList] = useState(initialData.priceList);
  const [showSecrets, setShowSecrets] = useState(initialData.showSecrets);

  const [isAddingTab, setIsAddingTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [dateModal, setDateModal] = useState({ isOpen: false, rowId: null, value: '' });
  const [isPriceListOpen, setIsPriceListOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [isExplanationModalOpen, setIsExplanationModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, tableData, priceList, activeTabId, showSecrets }));
    } catch (e) {
      console.error('Failed to save business table data to localStorage', e);
    }
  }, [tabs, tableData, priceList, activeTabId, showSecrets]);

  // --- Row handlers ---
  const handleCellChange = (rowId, field, value) => {
    setTableData((prev) => ({
      ...prev,
      [activeTabId]: (prev[activeTabId] || []).map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    }));
  };

  const handleToggleSettled = (rowId) => {
    setTableData((prev) => ({
      ...prev,
      [activeTabId]: (prev[activeTabId] || []).map((row) => (row.id === rowId ? { ...row, isSettled: !row.isSettled } : row)),
    }));
  };

  const handleToggleShowSecret = (rowId) => {
    setTableData((prev) => ({
      ...prev,
      [activeTabId]: (prev[activeTabId] || []).map((row) => (row.id === rowId ? { ...row, showSecret: !row.showSecret } : row)),
    }));
  };

  const handleAddRow = () => {
    setTableData((prev) => ({ ...prev, [activeTabId]: [...(prev[activeTabId] || []), createEmptyRow()] }));
  };

  // --- Tab handlers ---
  const handleAddTab = (e) => {
    e.preventDefault();
    if (!newTabName.trim()) return;
    const newTabId = crypto.randomUUID();
    const nextColor = TAB_COLORS[tabs.length % TAB_COLORS.length];
    setTabs([...tabs, { id: newTabId, name: newTabName.trim(), color: nextColor }]);
    setTableData((prev) => ({ ...prev, [newTabId]: Array.from({ length: 6 }, () => createEmptyRow()) }));
    setPriceList((prev) => ({ ...prev, [newTabId]: [createEmptyPriceRow(), createEmptyPriceRow(), createEmptyPriceRow()] }));
    setActiveTabId(newTabId);
    setNewTabName('');
    setIsAddingTab(false);
  };

  const handleDeleteTab = (tabId) => {
    if (tabs.length <= 1) return;
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    setTableData((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    setPriceList((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    if (activeTabId === tabId) {
      setActiveTabId(remaining[0].id);
    }
  };

  const handleSaveDate = () => {
    if (dateModal.rowId) handleCellChange(dateModal.rowId, 'date', dateModal.value);
    setDateModal({ isOpen: false, rowId: null, value: '' });
  };

  // --- Price list handlers ---
  const handleAddPriceListRow = () => {
    setPriceList((prev) => ({ ...prev, [activeTabId]: [...(prev[activeTabId] || []), createEmptyPriceRow()] }));
  };

  const handlePriceListChange = (id, field, value) => {
    setPriceList((prev) => ({
      ...prev,
      [activeTabId]: (prev[activeTabId] || []).map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const handleRemovePriceListRow = (id) => {
    setPriceList((prev) => ({ ...prev, [activeTabId]: (prev[activeTabId] || []).filter((item) => item.id !== id) }));
  };

  // --- Calculations ---
  const currentRows = tableData[activeTabId] || [];

  const totalKupa = currentRows.reduce((sum, row) => {
    if (!row.isSettled) return sum;
    const secretAmount = showSecrets ? parseNumber(row.secret) : 0;
    return sum + getFinalCost(row.cost, row.addition) + secretAmount;
  }, 0);

  // חובות: כל סכום חיובי בעלות / תוספת / סודי הופך לשורת חוב נפרדת, עם התיאור כפי שהוקלד באותה משבצת
  const debtItems = [];
  currentRows.forEach((row) => {
    const fields = [
      { key: 'cost', text: row.cost },
      { key: 'addition', text: row.addition },
      { key: 'secret', text: row.secret },
    ];
    fields.forEach((f) => {
      const amount = parseNumber(f.text);
      if (amount > 0) {
        debtItems.push({ id: `${row.id}-${f.key}`, description: f.text, amount });
      }
    });
  });
  const totalDebts = debtItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="absolute inset-0 z-[45] bg-[#1e1e1e] text-white flex flex-col" dir="rtl">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] shrink-0">
        <button onClick={onClose} className="p-2 rounded-full bg-[#2a2a2a] hover:bg-[#3a3a3a] transition-colors" title="חזרה">
          <ArrowRight size={20} />
        </button>
        <span className="font-bold">ניהול מכירות</span>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Header area */}
        <div className="flex flex-col md:flex-row border-b border-[#333333]">
          {/* Kupa + action buttons */}
          <div className="w-full md:w-1/2 flex items-center justify-between gap-2 p-4 md:px-6 border-b md:border-b-0 md:border-l border-[#333333] flex-wrap">
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs mb-1">סה"כ קופה ({tabs.find((t) => t.id === activeTabId)?.name || ''})</span>
              <span className={`text-4xl md:text-5xl font-bold tracking-tight ${getColorClass(totalKupa)}`}>
                {totalKupa.toLocaleString('he-IL')}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsPriceListOpen(true)}
                className="flex flex-col items-center justify-center p-2.5 bg-[#252525] hover:bg-[#333] border border-[#444] rounded-xl transition-all text-gray-300 shadow-sm shrink-0"
                title="מחירון מוצרים"
              >
                <Tag size={18} className="text-[#3b82f6] mb-0.5" />
                <span className="text-[10px] font-medium">מחירון</span>
              </button>
              <button
                onClick={() => setShowSecrets((v) => !v)}
                className={`flex flex-col items-center justify-center p-2.5 border rounded-xl transition-all shadow-sm shrink-0 ${showSecrets ? 'bg-[#7e14ff]/20 border-[#7e14ff] text-[#c9a6ff]' : 'bg-[#252525] hover:bg-[#333] border-[#444] text-gray-300'}`}
                title="הצג/הסתר סודיים"
              >
                {showSecrets ? <Eye size={18} className="mb-0.5" /> : <EyeOff size={18} className="mb-0.5" />}
                <span className="text-[10px] font-medium">סודיים</span>
              </button>
              <button
                onClick={() => setIsDebtModalOpen(true)}
                className="flex flex-col items-center justify-center p-2.5 bg-[#1b2e1b] hover:bg-[#213a21] border border-[#2f5a2f] rounded-xl transition-all text-[#4CAF50] shadow-sm shrink-0"
                title="חובות"
              >
                <HandCoins size={18} className="mb-0.5" />
                <span className="text-[10px] font-medium">חובות</span>
              </button>
              <button
                onClick={() => setIsExplanationModalOpen(true)}
                className="flex items-center justify-center w-9 h-9 bg-[#252525] hover:bg-[#333] border border-[#444] rounded-xl transition-all text-gray-300 shadow-sm shrink-0"
                title="הסבר"
              >
                <HelpCircle size={18} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="w-full md:w-1/2 flex flex-col p-4 md:p-6 gap-3 max-h-48 md:max-h-64 overflow-y-auto items-start">
            {isAddingTab ? (
              <form onSubmit={handleAddTab} className="flex items-center gap-2 bg-[#2a2a2a] p-1 rounded-lg border border-[#444] w-full max-w-[250px]">
                <input
                  type="text"
                  autoFocus
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  placeholder="שם נושא..."
                  className="bg-transparent outline-none px-3 py-2 w-full text-sm"
                />
                <button type="submit" className="p-2 bg-[#3a3a3a] rounded hover:bg-[#4a4a4a] text-green-400">
                  <Plus size={18} />
                </button>
                <button type="button" onClick={() => setIsAddingTab(false)} className="p-2 bg-[#3a3a3a] rounded hover:bg-[#4a4a4a] text-red-400">
                  <X size={18} />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setIsAddingTab(true)}
                className="w-full max-w-[250px] flex items-center gap-2 px-4 py-2 bg-[#333333] hover:bg-[#444444] rounded-xl transition-colors text-gray-300 shrink-0"
              >
                <Plus size={20} />
                <span>נושא חדש...</span>
              </button>
            )}

            <div className="flex flex-col gap-2 w-full max-w-[250px]">
              {tabs.map((tab) => {
                const inactiveColor = tab.color + '40';
                return (
                  <div key={tab.id} className="flex items-center gap-1.5 w-full">
                    <button
                      onClick={() => setActiveTabId(tab.id)}
                      style={{
                        backgroundColor: activeTabId === tab.id ? tab.color : inactiveColor,
                        border: activeTabId === tab.id ? '2px solid white' : '2px solid transparent',
                        color: '#ffffff',
                      }}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all text-right flex items-center justify-between shrink-0 hover:opacity-100 ${activeTabId === tab.id ? 'shadow-md opacity-100 scale-105' : 'opacity-80'}`}
                    >
                      {tab.name}
                    </button>
                    {tabs.length > 1 && (
                      <button
                        onClick={() => handleDeleteTab(tab.id)}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                        title="מחק נושא"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="p-4 md:p-8 overflow-x-auto">
          <div className="w-full min-w-[900px] border border-[#111] rounded-lg overflow-hidden bg-[#222]">
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_130px_80px] bg-[#2a2a2a] border-b border-[#111]">
              {['מוצר', 'עלות', 'תוספת', 'עלות סופית', 'תאריך', 'שולם?'].map((header, idx) => (
                <div key={idx} className="p-3 text-center font-medium text-gray-300 text-sm border-l last:border-l-0 border-[#111]">
                  {header}
                </div>
              ))}
            </div>

            <div className="flex flex-col">
              {currentRows.map((row) => {
                const rowFinalCost = getFinalCost(row.cost, row.addition);
                const showSecretRow = showSecrets && row.showSecret;
                return (
                  <div key={row.id} className="flex flex-col border-b border-[#111] last:border-b-0">
                    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_130px_80px] hover:bg-[#252525] transition-colors">
                      <div className="border-l border-[#111] flex items-center">
                        <input
                          type="text"
                          value={row.product}
                          onChange={(e) => handleCellChange(row.id, 'product', e.target.value)}
                          className="w-full h-full min-h-[48px] bg-transparent text-center outline-none px-2 focus:bg-[#333] transition-colors"
                          placeholder=""
                        />
                        {showSecrets && (
                          <button
                            onClick={() => handleToggleShowSecret(row.id)}
                            title="מספר סודי"
                            className={`shrink-0 p-1.5 mr-1 rounded-full transition-colors ${row.showSecret ? 'text-[#c9a6ff] bg-[#7e14ff]/20' : 'text-gray-600 hover:text-gray-400'}`}
                          >
                            <Lock size={14} />
                          </button>
                        )}
                      </div>

                      <div className="border-l border-[#111]">
                        <input
                          type="text"
                          dir="auto"
                          value={row.cost}
                          onChange={(e) => handleCellChange(row.id, 'cost', e.target.value)}
                          className={`w-full h-full min-h-[48px] bg-transparent text-center outline-none px-2 font-mono focus:bg-[#333] transition-colors ${getColorClass(row.cost)}`}
                        />
                      </div>

                      <div className="border-l border-[#111]">
                        <input
                          type="text"
                          dir="auto"
                          value={row.addition}
                          onChange={(e) => handleCellChange(row.id, 'addition', e.target.value)}
                          className={`w-full h-full min-h-[48px] bg-transparent text-center outline-none px-2 font-mono focus:bg-[#333] transition-colors ${getColorClass(row.addition)}`}
                        />
                      </div>

                      <div className={`border-l border-[#111] flex items-center justify-center p-2 font-mono font-bold bg-[#1a1a1a] transition-opacity ${!row.isSettled ? 'opacity-40' : 'opacity-100'} ${getColorClass(rowFinalCost)}`}>
                        <span>{rowFinalCost !== 0 || row.cost || row.addition ? rowFinalCost : ''}</span>
                      </div>

                      <div className="border-l border-[#111]">
                        <button
                          onClick={() => setDateModal({ isOpen: true, rowId: row.id, value: row.date })}
                          className="w-full h-full min-h-[48px] bg-transparent text-center outline-none px-2 text-sm text-gray-400 hover:bg-[#333] transition-colors flex items-center justify-center gap-2"
                        >
                          <span>{row.date || '---'}</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-center p-2 bg-[#1a1a1a]">
                        <button
                          onClick={() => handleToggleSettled(row.id)}
                          title={row.isSettled ? 'בטל והסר מהקופה' : 'סמן כשולם והוסף לקופה'}
                          className={`h-8 w-8 rounded-full flex items-center justify-center transition-all shrink-0 ${row.isSettled ? 'bg-[#4CAF50]/20 text-[#4CAF50] hover:bg-[#4CAF50]/30' : 'bg-[#333] text-gray-500 hover:bg-[#444]'}`}
                        >
                          <Check size={18} strokeWidth={row.isSettled ? 3 : 2} />
                        </button>
                      </div>
                    </div>

                    {showSecretRow && (
                      <div className="bg-[#181820] px-3 py-1.5 flex items-center gap-2 border-t border-[#111]">
                        <Lock size={12} className="text-[#c9a6ff] shrink-0" />
                        <span className="text-[11px] text-gray-500 shrink-0">מספר סודי:</span>
                        <input
                          type="text"
                          dir="auto"
                          value={row.secret}
                          onChange={(e) => handleCellChange(row.id, 'secret', e.target.value)}
                          className={`flex-1 bg-transparent outline-none text-sm font-mono px-1 ${getColorClass(row.secret)}`}
                          placeholder="לדוגמה: 100 שח נוסף"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 mb-8 flex justify-center">
            <button
              onClick={handleAddRow}
              className="flex items-center gap-2 px-5 py-3 text-sm text-gray-300 hover:text-white bg-[#2a2a2a] hover:bg-[#333] rounded-xl transition-colors border border-[#444] shadow-sm"
            >
              <PlusCircle size={18} />
              <span>הוסף שורה חדשה</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date modal */}
      {dateModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#222] border border-[#333] rounded-xl p-6 shadow-2xl w-full max-w-sm">
            <h3 className="text-white mb-4 text-center text-lg font-medium">הזן תאריך</h3>
            <input
              type="text"
              autoFocus
              dir="rtl"
              value={dateModal.value}
              onChange={(e) => setDateModal({ ...dateModal, value: e.target.value })}
              placeholder="לדוגמה: 15/08/2024 או 'אתמול'"
              className="w-full bg-[#111] border border-[#444] rounded-lg p-3 text-white text-center outline-none focus:border-[#4CAF50] transition-colors mb-6"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveDate();
                if (e.key === 'Escape') setDateModal({ isOpen: false, rowId: null, value: '' });
              }}
            />
            <div className="flex gap-3">
              <button onClick={handleSaveDate} className="flex-1 bg-[#4CAF50] text-white py-2.5 rounded-lg hover:bg-[#45a049] transition-colors font-medium">
                שמור
              </button>
              <button
                onClick={() => setDateModal({ isOpen: false, rowId: null, value: '' })}
                className="flex-1 bg-[#333] text-gray-300 py-2.5 rounded-lg hover:bg-[#444] transition-colors font-medium"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price list modal */}
      {isPriceListOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-[#222] border border-[#333] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-[#333]">
              <div className="flex items-center gap-3">
                <Tag className="text-[#3b82f6]" size={20} />
                <h3 className="text-white text-lg font-medium">מחירון מוצרים</h3>
              </div>
              <button onClick={() => setIsPriceListOpen(false)} className="text-gray-400 hover:text-white bg-[#333] hover:bg-[#444] p-1.5 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 sm:p-5">
              <div className="border border-[#111] rounded-lg overflow-hidden bg-[#1a1a1a]">
                <div className="hidden md:grid md:grid-cols-[1fr_1fr_1fr_50px] bg-[#2a2a2a] border-b border-[#111]">
                  <div className="p-3 text-center text-sm font-medium text-gray-300 border-l border-[#111]">שם המוצר</div>
                  <div className="p-3 text-center text-sm font-bold text-[#F44336] bg-[#F44336]/10 border-l border-[#111]">עולה לי (עלות)</div>
                  <div className="p-3 text-center text-sm font-bold text-[#4CAF50] bg-[#4CAF50]/10 border-l border-[#111]">מחיר מכירה</div>
                  <div></div>
                </div>
                <div className="flex flex-col">
                  {(priceList[activeTabId] || []).map((item) => (
                    <div key={item.id} className="border-b-4 md:border-b border-[#111] last:border-b-0">
                      <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_50px] hover:bg-[#252525] transition-colors relative">
                        <div className="col-span-2 md:col-span-1 border-b md:border-b-0 border-[#111]">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handlePriceListChange(item.id, 'name', e.target.value)}
                            className="w-full h-full min-h-[45px] bg-transparent text-center outline-none px-2 focus:bg-[#333] font-medium md:font-normal"
                            placeholder="שם המוצר..."
                          />
                        </div>
                        <div className="col-span-1 border-l border-[#111] bg-[#F44336]/5">
                          <input
                            type="text"
                            dir="ltr"
                            value={item.costPrice}
                            onChange={(e) => handlePriceListChange(item.id, 'costPrice', e.target.value)}
                            className="w-full h-full min-h-[45px] bg-transparent text-center outline-none px-2 text-[#F44336] font-bold focus:bg-[#F44336]/20 font-mono transition-colors"
                            placeholder="עלות (₪)"
                          />
                        </div>
                        <div className="col-span-1 border-l border-[#111] bg-[#4CAF50]/5">
                          <input
                            type="text"
                            dir="ltr"
                            value={item.sellPrice}
                            onChange={(e) => handlePriceListChange(item.id, 'sellPrice', e.target.value)}
                            className="w-full h-full min-h-[45px] bg-transparent text-center outline-none px-2 text-[#4CAF50] font-bold focus:bg-[#4CAF50]/20 font-mono transition-colors"
                            placeholder="מכירה (₪)"
                          />
                        </div>
                        <div className="absolute top-1 left-1 md:relative md:top-0 md:left-0 col-span-2 md:col-span-1 flex items-center justify-center pointer-events-none md:pointer-events-auto">
                          <button
                            onClick={() => handleRemovePriceListRow(item.id)}
                            className="flex items-center justify-center p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors pointer-events-auto"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* כותרת מודגשת: כמה יחידות מהמוצר הזה צריך למכור כדי לא להפסיד */}
                      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#241f0a] border-t border-[#111]">
                        <span className="text-xs font-bold text-amber-400 shrink-0">כמה צריך למכור כדי לא להפסיד:</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            dir="ltr"
                            value={item.breakEvenQty || ''}
                            onChange={(e) => handlePriceListChange(item.id, 'breakEvenQty', e.target.value)}
                            placeholder="0"
                            className="w-16 text-center bg-transparent outline-none text-amber-300 placeholder:text-gray-600 placeholder:font-normal font-extrabold text-lg font-mono border-b border-amber-500/40 focus:border-amber-400 transition-colors"
                          />
                          <span className="text-xs text-gray-500">יח'</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 border-t border-[#333] flex flex-col sm:flex-row justify-between items-center gap-3 bg-[#222] rounded-b-xl">
              <button
                onClick={handleAddPriceListRow}
                className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2 text-sm text-gray-300 bg-[#2a2a2a] hover:bg-[#333] rounded-lg transition-colors border border-[#444]"
              >
                <PlusCircle size={16} />
                <span>הוסף מוצר למחירון</span>
              </button>
              <button
                onClick={() => setIsPriceListOpen(false)}
                className="w-full sm:w-auto px-6 py-2 bg-[#4CAF50] text-white font-medium rounded-lg hover:bg-[#45a049] transition-colors"
              >
                סגור ושמור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debt modal */}
      {isDebtModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-black border border-[#333] rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-[#333]">
              <div className="flex items-center gap-3">
                <HandCoins className="text-[#4CAF50]" size={20} />
                <h3 className="text-white text-lg font-medium">חובות</h3>
              </div>
              <button onClick={() => setIsDebtModalOpen(false)} className="text-gray-400 hover:text-white bg-[#222] hover:bg-[#333] p-1.5 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-2">
              {debtItems.length === 0 ? (
                <div className="text-center text-sm text-gray-500 py-8">אין כרגע חובות פתוחים בנושא הזה</div>
              ) : (
                debtItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-[#242b24] rounded-lg px-4 py-3">
                    <span className="text-white text-sm">{item.description}</span>
                    <span className="text-[#4CAF50] font-mono font-bold">{item.amount.toLocaleString('he-IL')}</span>
                  </div>
                ))
              )}
            </div>
            {debtItems.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-[#333]">
                <div className="flex items-center justify-between bg-[#242b24] rounded-lg px-4 py-3">
                  <span className="text-white text-sm font-bold">סה"כ חובות</span>
                  <span className="text-[#4CAF50] font-mono font-bold text-lg">{totalDebts.toLocaleString('he-IL')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Explanation modal */}
      {isExplanationModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-[#222] border border-[#333] rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-[#333]">
              <div className="flex items-center gap-3">
                <HelpCircle className="text-[#3b82f6]" size={20} />
                <h3 className="text-white text-lg font-medium">איך החישוב עובד</h3>
              </div>
              <button onClick={() => setIsExplanationModalOpen(false)} className="text-gray-400 hover:text-white bg-[#333] hover:bg-[#444] p-1.5 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3 text-sm text-gray-300 leading-relaxed">
              <p><strong className="text-white">עלות סופית</strong> — סכום עמודות "עלות" ו"תוספת" באותה שורה. אפשר להקליד טקסט חופשי (למשל "50 שח מפרחים") — המערכת שולפת מתוכו את המספר.</p>
              <p><strong className="text-white">שולם ✓</strong> — מסמן שורה כשולמה, ורק אז היא נכנסת לחישוב "סה"כ קופה".</p>
              <p><strong className="text-white">מספר סודי</strong> — סכום נוסף וחבוי, לא מוצג ולא נספר בקופה כשמצב "סודיים" כבוי (מצב מותאם להראות ללקוח). כשמדליקים אותו, הסכומים הסודיים גלויים ונכנסים לחישוב הקופה.</p>
              <p><strong className="text-white">חובות</strong> — כל סכום חיובי שהקלדת בעלות, תוספת או סודי מרוכז כאן כשורת חוב, עם התיאור המדויק שכתבת באותה משבצת.</p>
              <p><strong className="text-white">מחירון</strong> — טבלת עזר נפרדת לכל נושא, לתיעוד מחיר עלות ומחיר מכירה של מוצרים, לא משפיעה על חישובי הקופה.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
