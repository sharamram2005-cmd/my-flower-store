import React, { useState, useEffect } from 'react';
import { Plus, X, PlusCircle, Check, Tag, Trash2 } from 'lucide-react';

export default function App() {
  // --- Constants ---
  const TAB_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#f59e0b', '#06b6d4'];
  const STORAGE_KEY = 'salesManagerData_v1'; // מפתח לשמירה ב-localStorage

  // --- Helper Functions for Init ---
  // יצירת שורה ריקה חדשה
  function createEmptyRow() {
    return { id: crypto.randomUUID(), product: '', cost: '', addition: '', date: '', isSettled: false };
  }

  // --- Initial Data Loading ---
  // פונקציה שטוענת את הנתונים מהזיכרון המקומי, או מחזירה נתוני ברירת מחדל אם אין
  const loadInitialData = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load data from localStorage", e);
    }

    // נתוני ברירת מחדל להתחלה נקייה
    return {
      tabs: [{ id: '1', name: 'כללי', color: TAB_COLORS[0] }],
      tableData: { '1': Array.from({ length: 8 }, () => createEmptyRow()) },
      priceList: {
        '1': [
          { id: crypto.randomUUID(), name: '', costPrice: '', sellPrice: '' },
          { id: crypto.randomUUID(), name: '', costPrice: '', sellPrice: '' },
          { id: crypto.randomUUID(), name: '', costPrice: '', sellPrice: '' }
        ]
      }
    };
  };

  const initialData = loadInitialData();

  // --- State Management ---
  const [tabs, setTabs] = useState(initialData.tabs);
  const [activeTabId, setActiveTabId] = useState(initialData.tabs[0]?.id || '1');
  const [tableData, setTableData] = useState(initialData.tableData);
  const [priceList, setPriceList] = useState(initialData.priceList);

  // מצבים זמניים לממשק משתמש (UI States - לא צריכים להישמר)
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [dateModal, setDateModal] = useState({ isOpen: false, rowId: null, value: '' });
  const [isPriceListOpen, setIsPriceListOpen] = useState(false);

  // --- Auto-Save Effect ---
  // שומר את הנתונים ל-localStorage בכל פעם ש-tabs, tableData או priceList משתנים
  useEffect(() => {
    try {
      const dataToSave = { tabs, tableData, priceList };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.error("Failed to save data to localStorage", e);
    }
  }, [tabs, tableData, priceList]);


  // --- Helper Functions ---

  // פונקציית עזר להמרת טקסט למספר (מחלצת את המספר הראשון מתוך הטקסט, כולל מינוס)
  const parseNumber = (val) => {
    if (!val) return 0;
    const strVal = String(val);

    // מחפש מספר בתוך הטקסט (יכול להיות עם מינוס לפני או אחרי, בגלל כיווניות בעברית)
    const match = strVal.match(/-?\d+(\.\d+)?-?/);
    if (match) {
      const numStr = match[0];
      const isNegative = numStr.includes('-');
      const num = parseFloat(numStr.replace(/-/g, '')); // מנקה את המינוס כדי להמיר למספר
      return isNegative ? -num : num;
    }
    return 0;
  };

  // חישוב עלות סופית לשורה בודדת
  const getFinalCost = (cost, addition) => {
    return parseNumber(cost) + parseNumber(addition);
  };

  // פונקציה לקביעת צבע המספר (ירוק לחיובי, אדום לשלילי)
  const getColorClass = (val) => {
    const num = parseNumber(val);
    if (num > 0) return 'text-[#4CAF50]'; // ירוק כמו בתמונה
    if (num < 0) return 'text-[#F44336]'; // אדום
    return 'text-gray-300';
  };

  // --- Event Handlers ---

  // שינוי ערך בתא בטבלה
  const handleCellChange = (rowId, field, value) => {
    setTableData(prevData => {
      const currentRows = prevData[activeTabId] || [];
      const updatedRows = currentRows.map(row => {
        if (row.id === rowId) {
          return { ...row, [field]: value };
        }
        return row;
      });
      return { ...prevData, [activeTabId]: updatedRows };
    });
  };

  // שינוי סטטוס תשלום/קבלה של שורה
  const handleToggleSettled = (rowId) => {
    setTableData(prevData => {
      const currentRows = prevData[activeTabId] || [];
      const updatedRows = currentRows.map(row => {
        if (row.id === rowId) {
          return { ...row, isSettled: !row.isSettled };
        }
        return row;
      });
      return { ...prevData, [activeTabId]: updatedRows };
    });
  };

  // הוספת שורה חדשה לטבלה הנוכחית
  const handleAddRow = () => {
    setTableData(prevData => ({
      ...prevData,
      [activeTabId]: [...(prevData[activeTabId] || []), createEmptyRow()]
    }));
  };

  // הוספת כרטיסיה חדשה
  const handleAddTab = (e) => {
    e.preventDefault();
    if (newTabName.trim()) {
      const newTabId = crypto.randomUUID();
      const nextColor = TAB_COLORS[tabs.length % TAB_COLORS.length];

      setTabs([...tabs, { id: newTabId, name: newTabName.trim(), color: nextColor }]);
      setTableData(prev => ({ ...prev, [newTabId]: Array.from({ length: 8 }, () => createEmptyRow()) }));
      setPriceList(prev => ({
        ...prev,
        [newTabId]: [
          { id: crypto.randomUUID(), name: '', costPrice: '', sellPrice: '' },
          { id: crypto.randomUUID(), name: '', costPrice: '', sellPrice: '' },
          { id: crypto.randomUUID(), name: '', costPrice: '', sellPrice: '' }
        ]
      }));

      setActiveTabId(newTabId);
      setNewTabName('');
      setIsAddingTab(false);
    }
  };

  // שמירת תאריך מהחלונית
  const handleSaveDate = () => {
    if (dateModal.rowId) {
      handleCellChange(dateModal.rowId, 'date', dateModal.value);
    }
    setDateModal({ isOpen: false, rowId: null, value: '' });
  };

  // --- Price List Handlers ---
  const handleAddPriceListRow = () => {
    setPriceList(prev => ({
      ...prev,
      [activeTabId]: [...(prev[activeTabId] || []), { id: crypto.randomUUID(), name: '', costPrice: '', sellPrice: '' }]
    }));
  };

  const handlePriceListChange = (id, field, value) => {
    setPriceList(prev => ({
      ...prev,
      [activeTabId]: (prev[activeTabId] || []).map(item => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    }));
  };

  const handleRemovePriceListRow = (id) => {
    setPriceList(prev => ({
      ...prev,
      [activeTabId]: (prev[activeTabId] || []).filter(item => item.id !== id)
    }));
  };


  // --- Calculations ---

  const currentRows = tableData[activeTabId] || [];

  // חישוב הקופה (סך הכל) של הכרטיסיה הנוכחית - רק עבור שורות שסומנו כשולמו
  const totalKupa = currentRows.reduce((sum, row) => {
    if (row.isSettled) {
      return sum + getFinalCost(row.cost, row.addition);
    }
    return sum;
  }, 0);

  return (
    <div dir="rtl" className="min-h-screen bg-[#1e1e1e] text-white font-sans flex flex-col">

      {/* --- Top Header Area --- */}
      <div className="flex flex-col md:flex-row min-h-[8rem] border-b border-[#333333]">

        {/* Left Side - Kupa (Total) */}
        <div className="w-full md:w-1/2 flex items-center justify-between p-6 md:px-8 border-b md:border-b-0 md:border-l border-[#333333]">
          <div className="flex flex-col">
            <span className="text-gray-400 text-sm mb-1">סה"כ קופה ({tabs.find(t => t.id === activeTabId)?.name || ''})</span>
            <span className={`text-5xl md:text-6xl font-bold tracking-tight ${getColorClass(totalKupa)}`}>
              {totalKupa.toLocaleString('he-IL')}
            </span>
          </div>

          {/* Price List Button */}
          <button
            onClick={() => setIsPriceListOpen(true)}
            className="flex flex-col items-center justify-center p-3 bg-[#252525] hover:bg-[#333] border border-[#444] rounded-xl transition-all text-gray-300 shadow-sm shrink-0"
            title="מחירון מוצרים"
          >
            <Tag size={22} className="text-[#3b82f6] mb-1" />
            <span className="text-[11px] font-medium">מחירון</span>
          </button>
        </div>

        {/* Right Side - Tabs & Add Subject */}
        <div className="w-full md:w-1/2 flex flex-col p-4 md:p-6 gap-3 max-h-48 md:max-h-64 overflow-y-auto items-start">

          {/* Add Tab Button / Input */}
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
              title="הוסף נושא חדש"
            >
              <Plus size={20} />
              <span>נושא חדש...</span>
            </button>
          )}

          {/* Tab List */}
          <div className="flex flex-col gap-2 w-full max-w-[250px]">
            {tabs.map(tab => {
              const inactiveColor = tab.color + '40';

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  style={{
                    backgroundColor: activeTabId === tab.id ? tab.color : inactiveColor,
                    border: activeTabId === tab.id ? '2px solid white' : '2px solid transparent',
                    color: '#ffffff'
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all text-right w-full flex items-center justify-between shrink-0 hover:opacity-100 ${
                    activeTabId === tab.id
                      ? 'shadow-md opacity-100 scale-105'
                      : 'opacity-80'
                  }`}
                >
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- Table Area --- */}
      <div className="flex-1 p-4 md:p-8 overflow-x-auto">
        <div className="w-full min-w-[900px] border border-[#111] rounded-lg overflow-hidden bg-[#222]">

          {/* Table Header */}
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_130px_80px] bg-[#2a2a2a] border-b border-[#111]">
            {['מוצר', 'עלות', 'תוספת', 'עלות סופית', 'תאריך', 'שולם?'].map((header, idx) => (
              <div key={idx} className="p-3 text-center font-medium text-gray-300 text-sm border-l last:border-l-0 border-[#111]">
                {header}
              </div>
            ))}
          </div>

          {/* Table Body (Grid קבוע שלא נשבר בטלפון) */}
          <div className="flex flex-col">
            {currentRows.map((row) => {
              const rowFinalCost = getFinalCost(row.cost, row.addition);

              return (
                <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_130px_80px] border-b border-[#111] hover:bg-[#252525] transition-colors">

                  {/* Product Input */}
                  <div className="border-l border-[#111] bg-transparent">
                    <input
                      type="text"
                      value={row.product}
                      onChange={(e) => handleCellChange(row.id, 'product', e.target.value)}
                      className="w-full h-full min-h-[48px] bg-transparent text-center outline-none px-4 focus:bg-[#333] transition-colors font-normal"
                      placeholder=""
                    />
                  </div>

                  {/* Cost Input */}
                  <div className="border-l border-[#111]">
                    <input
                      type="text"
                      dir="auto"
                      value={row.cost}
                      onChange={(e) => handleCellChange(row.id, 'cost', e.target.value)}
                      className={`w-full h-full min-h-[48px] bg-transparent text-center outline-none px-2 font-mono focus:bg-[#333] transition-colors ${getColorClass(row.cost)}`}
                      placeholder=""
                    />
                  </div>

                  {/* Addition Input */}
                  <div className="border-l border-[#111]">
                    <input
                      type="text"
                      dir="auto"
                      value={row.addition}
                      onChange={(e) => handleCellChange(row.id, 'addition', e.target.value)}
                      className={`w-full h-full min-h-[48px] bg-transparent text-center outline-none px-2 font-mono focus:bg-[#333] transition-colors ${getColorClass(row.addition)}`}
                      placeholder=""
                    />
                  </div>

                  {/* Final Cost (Calculated) */}
                  <div className={`border-l border-[#111] flex items-center justify-center p-2 font-mono font-bold bg-[#1a1a1a] transition-opacity ${!row.isSettled ? 'opacity-40' : 'opacity-100'} ${getColorClass(rowFinalCost)}`}>
                    <span>{rowFinalCost !== 0 || row.cost || row.addition ? rowFinalCost : ''}</span>
                  </div>

                  {/* Date Input */}
                  <div className="border-l border-[#111]">
                    <button
                      onClick={() => setDateModal({ isOpen: true, rowId: row.id, value: row.date })}
                      className="w-full h-full min-h-[48px] bg-transparent text-center outline-none px-2 text-sm text-gray-400 hover:bg-[#333] transition-colors flex items-center justify-center gap-2"
                    >
                      <span>{row.date || '---'}</span>
                    </button>
                  </div>

                  {/* Settled Toggle Button */}
                  <div className="flex items-center justify-center p-2 bg-[#1a1a1a]">
                    <button
                      onClick={() => handleToggleSettled(row.id)}
                      title={row.isSettled ? "בטל והסר מהקופה" : "סמן כשולם והוסף לקופה"}
                      className={`h-8 w-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
                        row.isSettled
                          ? 'bg-[#4CAF50]/20 text-[#4CAF50] hover:bg-[#4CAF50]/30'
                          : 'bg-[#333] text-gray-500 hover:bg-[#444]'
                      }`}
                    >
                      <Check size={18} strokeWidth={row.isSettled ? 3 : 2} />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* Add Row Button */}
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

      {/* Date Modal */}
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
              <button
                onClick={handleSaveDate}
                className="flex-1 bg-[#4CAF50] text-white py-2.5 rounded-lg hover:bg-[#45a049] transition-colors font-medium"
              >
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

      {/* Price List Modal */}
      {isPriceListOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-[#222] border border-[#333] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-[#333]">
              <div className="flex items-center gap-3">
                <Tag className="text-[#3b82f6]" size={20} sm:size={24} />
                <h3 className="text-white text-lg sm:text-xl font-medium">מחירון מוצרים</h3>
              </div>
              <button onClick={() => setIsPriceListOpen(false)} className="text-gray-400 hover:text-white bg-[#333] hover:bg-[#444] p-1.5 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body / Table */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-5">
              <div className="border border-[#111] rounded-lg overflow-hidden bg-[#1a1a1a]">

                {/* Table Header (Desktop Only for Price List) */}
                <div className="hidden md:grid md:grid-cols-[1fr_1fr_1fr_50px] bg-[#2a2a2a] border-b border-[#111]">
                  <div className="p-3 text-center text-sm font-medium text-gray-300 border-l border-[#111]">שם המוצר</div>
                  <div className="p-3 text-center text-sm font-bold text-[#F44336] bg-[#F44336]/10 border-l border-[#111]">עולה לי (עלות)</div>
                  <div className="p-3 text-center text-sm font-bold text-[#4CAF50] bg-[#4CAF50]/10 border-l border-[#111]">מחיר מכירה</div>
                  <div></div>
                </div>

                {/* Table Rows (Responsive) */}
                <div className="flex flex-col">
                  {(priceList[activeTabId] || []).map(item => (
                    <div key={item.id} className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_50px] border-b-4 md:border-b border-[#111] hover:bg-[#252525] transition-colors last:border-b-0 relative">

                      {/* Name */}
                      <div className="col-span-2 md:col-span-1 border-b md:border-b-0 border-[#111]">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handlePriceListChange(item.id, 'name', e.target.value)}
                          className="w-full h-full min-h-[45px] bg-transparent text-center outline-none px-2 focus:bg-[#333] font-medium md:font-normal"
                          placeholder="שם המוצר..."
                        />
                      </div>

                      {/* Cost Price */}
                      <div className="col-span-1 md:col-span-1 border-l border-[#111] bg-[#F44336]/5">
                        <input
                          type="text"
                          dir="ltr"
                          value={item.costPrice}
                          onChange={(e) => handlePriceListChange(item.id, 'costPrice', e.target.value)}
                          className="w-full h-full min-h-[45px] bg-transparent text-center outline-none px-2 text-[#F44336] font-bold focus:bg-[#F44336]/20 font-mono transition-colors"
                          placeholder="עלות (₪)"
                        />
                      </div>

                      {/* Sell Price */}
                      <div className="col-span-1 md:col-span-1 border-l border-[#111] bg-[#4CAF50]/5">
                        <input
                          type="text"
                          dir="ltr"
                          value={item.sellPrice}
                          onChange={(e) => handlePriceListChange(item.id, 'sellPrice', e.target.value)}
                          className="w-full h-full min-h-[45px] bg-transparent text-center outline-none px-2 text-[#4CAF50] font-bold focus:bg-[#4CAF50]/20 font-mono transition-colors"
                          placeholder="מכירה (₪)"
                        />
                      </div>

                      {/* Trash Button */}
                      <div className="absolute top-1 left-1 md:relative md:top-0 md:left-0 col-span-2 md:col-span-1 flex items-center justify-center pointer-events-none md:pointer-events-auto">
                        <button
                          onClick={() => handleRemovePriceListRow(item.id)}
                          className="flex items-center justify-center p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors pointer-events-auto"
                          title="מחק מוצר"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>

            {/* Modal Footer */}
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

    </div>
  );
}
