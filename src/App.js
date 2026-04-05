import { db } from './firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import {
  Users,
  PlusCircle,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  DollarSign,
  History,
  ChevronRight,
  Calendar,
  Store,
  Trash2,
  Lock,
  Edit3,
  X,
  GraduationCap,
  Search,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Save
} from 'lucide-react';

const App = () => {
  const DEFAULT_INITIAL_POINTS = 600;
  const GLOBAL_BASE_BONUS = 600;

  const PERFORMANCE_ITEMS = {
    penalty: [
      { label: '遲到 (預設1分/可修改)', val: -1 },
      { label: '延遲開工 (15分以上)', val: -10 },
      { label: '工作態度不佳 (不服管教)', val: -5 },
      { label: '作業失誤-輕 (漏餐具等)', val: -2 },
      { label: '作業失誤-重 (燒焦/客訴)', val: -5 },
      { label: '環境責任 (收班不確實)', val: -3 },
      { label: '服儀不整', val: -2 },
      { label: '其他扣分事項', val: -1 }
    ],
    bonus: [
      { label: '申請打掃環境', val: 2 },
      { label: '支援另一間店', val: 1 },
      { label: '獲得顧客五星評論', val: 2 },
      { label: '表現優異 (店長推薦)', val: 5 },
      { label: '其他加分事項', val: 1 }
    ]
  };

  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState('employee');
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [authMode, setAuthMode] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedItemLabel, setSelectedItemLabel] = useState('');
  const [customPoints, setCustomPoints] = useState(0);
  const [occurrenceDate, setOccurrenceDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [note, setNote] = useState('');
  const [systemMessage, setSystemMessage] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().substring(0, 7)
  );
  const [editingEmp, setEditingEmp] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [deletingEmpId, setDeletingEmpId] = useState(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'employees'));
        const data = querySnapshot.docs.map((doc) => {
          const raw = doc.data();
          return {
            id: raw.id ?? doc.id,
            ...raw,
            skillsPassed: raw.skillsPassed ?? raw.skillspassed ?? 0,
            lastYearLow: raw.lastYearLow ?? raw.LastYearLow ?? false
          };
        });

        setEmployees(data);
        if (data.length > 0) {
          setSelectedEmpId((prev) => prev ?? data[0].id);
        }
      } catch (error) {
        console.error('讀取 employees 失敗:', error);
      }
    };

    fetchEmployees();
  }, []);

  const showMessage = (text, type = 'info') => {
    setSystemMessage({ text, type });
    setTimeout(() => setSystemMessage(null), 3000);
  };

  const formatDate = (value) => {
    if (!value) return '';

    if (typeof value === 'string') return value;

    if (value?.toDate) {
      return value.toDate().toLocaleDateString('zh-TW');
    }

    if (value?.seconds) {
      return new Date(value.seconds * 1000).toLocaleDateString('zh-TW');
    }

    return String(value);
  };

  const toJsDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') return new Date(value);
    if (value?.toDate) return value.toDate();
    if (value?.seconds) return new Date(value.seconds * 1000);
    return new Date(value);
  };

  const calculateSeniority = (startDate) => {
    if (!startDate) {
      return { years: 0, months: 0, isEligible: false, text: '未設定' };
    }

    const start = toJsDate(startDate);
    if (!start || Number.isNaN(start.getTime())) {
      return { years: 0, months: 0, isEligible: false, text: '未設定' };
    }

    const now = new Date();

    let years = now.getFullYear() - start.getFullYear();
    const anniversaryThisYear = new Date(start);
    anniversaryThisYear.setFullYear(now.getFullYear());

    if (now < anniversaryThisYear) years--;

    let months = now.getMonth() - start.getMonth();
    if (now.getDate() < start.getDate()) months--;
    if (months < 0) months += 12;

    return {
      years: Math.max(0, years),
      months: Math.max(0, months),
      isEligible: years >= 1,
      text: `${Math.max(0, years)}年${Math.max(0, months)}個月`
    };
  };

  const calculateResult = (points, lastYearLow) => {
    if (lastYearLow && points < 500) {
      return {
        status: 'D (淘汰)',
        color: 'text-gray-900',
        bg: 'bg-gray-900 text-white',
        desc: '不合格且去年已警示'
      };
    }
    if (points >= 500) {
      return {
        status: 'A (合格)',
        color: 'text-green-600',
        bg: 'bg-green-100 text-green-800',
        desc: '年度加級正常發放'
      };
    }
    if (points >= 481) {
      return {
        status: 'B (警示)',
        color: 'text-orange-600',
        bg: 'bg-yellow-100 text-yellow-800',
        desc: '金額減半'
      };
    }
    return {
      status: 'C (重罰)',
      color: 'text-red-600',
      bg: 'bg-red-100 text-red-800',
      desc: '取消年度加級資格'
    };
  };

  const calculateFinalPay = (emp) => {
    if (!emp || emp.skillsPassed < 2) return 0;

    const seniority = calculateSeniority(emp.startDate);
    if (!seniority.isEligible) return 0;

    const res = calculateResult(emp.currentPoints, emp.lastYearLow);
    const base = GLOBAL_BASE_BONUS * emp.multiplier;

    if (res.status.includes('A')) return Math.round(base);
    if (res.status.includes('B')) return Math.round(base / 2);
    return 0;
  };

  const handlePointChange = async (
    empId,
    amount,
    reason,
    operator = '店長'
  ) => {
    const targetEmp = employees.find((e) => e.id === empId);
    if (!targetEmp) return;

    const newLog = {
      id: Date.now(),
      empId,
      occurrenceDate,
      name: targetEmp.name,
      amount,
      reason,
      note,
      operator,
      timestamp: new Date().toLocaleString()
    };

    try {
      await addDoc(collection(db, 'logs'), {
        empId,
        occurrenceDate,
        name: targetEmp.name,
        amount,
        reason,
        note,
        operator,
        timestamp: new Date().toLocaleString()
      });
    } catch (error) {
      console.error('寫入失敗:', error);
      showMessage('寫入 Firebase 失敗', 'error');
      return;
    }

    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === empId
          ? { ...emp, currentPoints: emp.currentPoints + amount }
          : emp
      )
    );

    setLogs((prevLogs) => [newLog, ...prevLogs]);
    setNote('');
    setSelectedItemLabel('');
    setCustomPoints(0);
    showMessage(
      `${targetEmp.name} 分數已變動 ${amount > 0 ? '+' : ''}${amount}`,
      'success'
    );
  };

  const undoLog = (log) => {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === log.empId
          ? { ...emp, currentPoints: emp.currentPoints - log.amount }
          : emp
      )
    );
    setLogs((prev) => prev.filter((l) => l.id !== log.id));
    showMessage(`已撤銷 ${log.name} 的評分`, 'info');
  };

  const handleSaveEmpEdit = () => {
    if (!editingEmp) return;

    if (isAddingNew) {
      setEmployees((prev) => [...prev, editingEmp]);
      showMessage('新夥伴註冊成功', 'success');
    } else {
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === editingEmp.id ? editingEmp : emp))
      );
      showMessage('夥伴資料已更新', 'success');
    }

    setEditingEmp(null);
    setIsAddingNew(false);
  };

  const deleteEmployee = (id) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    setDeletingEmpId(null);
    showMessage('夥伴資料已刪除', 'error');
  };

  const handleAuth = (e) => {
    if (e) e.preventDefault();

    if (authMode === 'manager' && passwordInput === '8888') {
      setActiveTab('manager');
      setAuthMode(null);
      setPasswordInput('');
    } else if (authMode === 'admin' && passwordInput === '9999') {
      setActiveTab('admin');
      setAuthMode(null);
      setPasswordInput('');
    } else {
      setPasswordInput('');
      showMessage('密碼錯誤', 'error');
    }
  };

  const selectedEmp =
    employees.find((e) => e.id === selectedEmpId) || employees[0];

  const filteredPersonalLogs = logs
    .filter((log) => log.empId === selectedEmp?.id)
    .filter((log) => {
      const dateValue = formatDate(log.occurrenceDate);
      return dateValue.startsWith(selectedMonth);
    });

  const managerViewLogs = logs
    .filter((log) => log.empId === selectedEmpId)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-12">
      {systemMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 animate-in fade-in zoom-in duration-300 ${
            systemMessage.type === 'error'
              ? 'bg-red-600 text-white'
              : systemMessage.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-white'
          }`}
        >
          {systemMessage.text}
        </div>
      )}

      {authMode && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <form
            onSubmit={handleAuth}
            className="bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-sm animate-in zoom-in duration-200"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black flex items-center gap-2">
                {authMode === 'manager' ? (
                  <Store className="text-orange-600" />
                ) : (
                  <Lock className="text-red-600" />
                )}
                身分驗證
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAuthMode(null);
                  setPasswordInput('');
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-400 font-bold mb-4 uppercase tracking-widest">
              請輸入 {authMode === 'manager' ? '店長' : '最高權限'} 密碼
            </p>

            <input
              autoFocus
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••"
              className="w-full text-4xl text-center tracking-[1em] py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-orange-500 outline-none transition-all mb-6"
            />

            <button className="w-full py-4 rounded-2xl bg-gray-900 text-white font-black hover:bg-orange-600 transition-colors">
              確認進入
            </button>
          </form>
        </div>
      )}

      {editingEmp && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
            <div className="p-8 border-b flex justify-between items-center bg-gray-50 rounded-t-[2.5rem]">
              <div>
                <h3 className="text-2xl font-black">
                  {isAddingNew ? '註冊新夥伴' : '編輯夥伴資料'}
                </h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                  Employee Profile Settings
                </p>
              </div>
              <button
                onClick={() => setEditingEmp(null)}
                className="w-12 h-12 flex items-center justify-center bg-white border rounded-full hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    夥伴姓名
                  </label>
                  <input
                    type="text"
                    value={editingEmp.name}
                    onChange={(e) =>
                      setEditingEmp({ ...editingEmp, name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold"
                    placeholder="輸入姓名"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    所屬門店
                  </label>
                  <select
                    value={editingEmp.shop}
                    onChange={(e) =>
                      setEditingEmp({ ...editingEmp, shop: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold appearance-none"
                  >
                    <option value="">選擇店鋪</option>
                    <option value="西螺文昌店">西螺文昌店</option>
                    <option value="斗南站前店">斗南站前店</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  到職日期
                </label>
                <input
                  type="date"
                  value={
                    typeof editingEmp.startDate === 'string'
                      ? editingEmp.startDate
                      : ''
                  }
                  onChange={(e) =>
                    setEditingEmp({ ...editingEmp, startDate: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    職級名稱
                  </label>
                  <select
                    value={editingEmp.level}
                    onChange={(e) =>
                      setEditingEmp({ ...editingEmp, level: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold appearance-none"
                  >
                    <option value="一般夥伴">一般夥伴</option>
                    <option value="熟練夥伴">熟練夥伴</option>
                    <option value="全能夥伴">全能夥伴</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    已過關卡 (獎金門檻: 2)
                  </label>
                  <input
                    type="number"
                    value={editingEmp.skillsPassed}
                    onChange={(e) =>
                      setEditingEmp({
                        ...editingEmp,
                        skillsPassed: parseInt(e.target.value, 10) || 0
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    考核權重 (Multiplier)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingEmp.multiplier}
                    onChange={(e) =>
                      setEditingEmp({
                        ...editingEmp,
                        multiplier: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    初始總積分 (預設600)
                  </label>
                  <input
                    type="number"
                    value={editingEmp.initialPoints}
                    onChange={(e) => {
                      const points = parseInt(e.target.value, 10) || 600;
                      setEditingEmp({
                        ...editingEmp,
                        initialPoints: points,
                        currentPoints: points
                      });
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 p-4 bg-orange-50 rounded-2xl cursor-pointer group hover:bg-orange-100 transition-colors">
                <input
                  type="checkbox"
                  checked={editingEmp.lastYearLow}
                  onChange={(e) =>
                    setEditingEmp({
                      ...editingEmp,
                      lastYearLow: e.target.checked
                    })
                  }
                  className="w-5 h-5 rounded accent-orange-600"
                />
                <div className="flex flex-col">
                  <span className="font-black text-sm text-orange-700">
                    去年評分為 D (淘汰)
                  </span>
                  <span className="text-[10px] font-bold text-orange-400 uppercase">
                    今年積分低於 500 將直接觸發淘汰
                  </span>
                </div>
              </label>

              <button
                onClick={handleSaveEmpEdit}
                className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-lg hover:bg-orange-600 transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-2"
              >
                <Save size={20} />
                儲存夥伴資料
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-200">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-800 leading-tight">
                績效考核系統
              </h1>
              <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest">
                Performance Insight
              </p>
            </div>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl gap-1 border border-gray-200">
            <button
              onClick={() => setActiveTab('employee')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 ${
                activeTab === 'employee'
                  ? 'bg-white shadow-sm text-orange-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Search size={14} />
              <span className="hidden sm:inline">查詢</span>
            </button>

            <button
              onClick={() =>
                activeTab === 'manager'
                  ? setActiveTab('employee')
                  : setAuthMode('manager')
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 ${
                activeTab === 'manager'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Store size={14} />
              <span className="hidden sm:inline">店長</span>
            </button>

            <button
              onClick={() =>
                activeTab === 'admin'
                  ? setActiveTab('employee')
                  : setAuthMode('admin')
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center ${
                activeTab === 'admin'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-red-600'
              }`}
            >
              <Lock size={14} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        {activeTab === 'manager' && (
          <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-xl font-black flex items-center gap-2 text-gray-800">
                    <Store size={24} className="text-orange-600" />
                    店長評分區
                  </h2>
                  <p className="text-xs text-gray-400 font-bold mt-1">
                    選取夥伴並提交當日考核表現
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-orange-50 px-4 py-2.5 rounded-2xl border border-orange-100 w-fit">
                  <Calendar size={16} className="text-orange-600" />
                  <input
                    type="date"
                    value={occurrenceDate}
                    onChange={(e) => setOccurrenceDate(e.target.value)}
                    className="bg-transparent text-sm font-black text-orange-700 outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex gap-3 mb-10 overflow-x-auto pb-4 scrollbar-hide snap-x">
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmpId(emp.id)}
                    className={`px-5 py-4 rounded-2xl whitespace-nowrap border-2 transition-all min-w-[140px] text-left snap-start ${
                      selectedEmpId === emp.id
                        ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-lg shadow-orange-100'
                        : 'border-gray-50 bg-white hover:border-gray-200 text-gray-400'
                    }`}
                  >
                    <p className="text-[10px] opacity-60 font-black mb-1">
                      {emp.shop}
                    </p>
                    <span className="block font-black text-lg">{emp.name}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                    考核項目
                  </label>
                  <select
                    value={selectedItemLabel}
                    onChange={(e) => {
                      const label = e.target.value;
                      setSelectedItemLabel(label);

                      const allItems = [
                        ...PERFORMANCE_ITEMS.penalty,
                        ...PERFORMANCE_ITEMS.bonus
                      ];
                      const item = allItems.find((i) => i.label === label);
                      if (item) setCustomPoints(item.val);
                    }}
                    className="w-full bg-gray-50 border-2 border-gray-100 px-4 py-4 rounded-2xl font-black text-gray-700 focus:border-orange-400 outline-none transition-colors appearance-none"
                  >
                    <option value="">請選擇考核標籤...</option>
                    <optgroup label="🔴 扣分項目 (Penalty)">
                      {PERFORMANCE_ITEMS.penalty.map((i) => (
                        <option key={i.label} value={i.label}>
                          {i.label} ({i.val})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="🟢 獎勵項目 (Bonus)">
                      {PERFORMANCE_ITEMS.bonus.map((i) => (
                        <option key={i.label} value={i.label}>
                          {i.label} (+{i.val})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                    點數調整
                  </label>
                  <div className="flex items-center bg-gray-50 border-2 border-gray-100 rounded-2xl focus-within:border-orange-400 transition-colors">
                    <button
                      onClick={() => setCustomPoints((p) => p - 1)}
                      className="p-4 text-gray-400 hover:text-orange-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>

                    <input
                      type="number"
                      value={customPoints}
                      onChange={(e) =>
                        setCustomPoints(parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full bg-transparent font-black text-center text-xl outline-none"
                    />

                    <button
                      onClick={() => setCustomPoints((p) => p + 1)}
                      className="p-4 text-gray-400 hover:text-orange-600 transition-colors"
                    >
                      <PlusCircle size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-8">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                  事件詳情 (必要)
                </label>
                <textarea
                  placeholder="請描述具體情況 (例如：遲到20分鐘、支援斗南店 4 小時...)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full h-32 px-5 py-4 rounded-3xl border-2 border-gray-100 bg-gray-50 outline-none focus:border-orange-400 font-medium placeholder:text-gray-300 transition-all"
                />
              </div>

              <button
                onClick={() =>
                  handlePointChange(selectedEmpId, customPoints, selectedItemLabel)
                }
                disabled={!selectedItemLabel || !note}
                className="w-full py-5 rounded-3xl font-black text-xl bg-orange-600 text-white disabled:bg-gray-200 transition-all active:scale-[0.98] shadow-xl shadow-orange-200 flex items-center justify-center gap-2 group"
              >
                確認執行評分
                <ArrowRight
                  size={20}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </button>
            </section>

            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-gray-800 flex items-center gap-2">
                  <History size={18} className="text-gray-400" />
                  夥伴最近評分紀錄
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] text-gray-400">
                    最近 10 筆
                  </span>
                </h3>
              </div>

              {managerViewLogs.length > 0 ? (
                <div className="space-y-3">
                  {managerViewLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:border-orange-200 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                            log.amount >= 0
                              ? 'bg-green-100 text-green-600'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {log.amount > 0 ? '+' : ''}
                          {log.amount}
                        </div>

                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase">
                            {formatDate(log.occurrenceDate)}
                          </p>
                          <p className="font-black text-gray-700 text-sm">
                            {log.reason}
                          </p>
                          {log.note && (
                            <p className="text-[11px] text-gray-400 font-medium truncate max-w-[200px] sm:max-w-md">
                              {log.note}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => undoLog(log)}
                        className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="撤銷紀錄"
                      >
                        <RotateCcw size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-2xl">
                  <p className="text-gray-300 text-xs font-black uppercase tracking-widest">
                    目前暫無該夥伴的評分紀錄
                  </p>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'employee' && selectedEmp && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex gap-2 overflow-x-auto pb-2 justify-center scrollbar-hide">
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmpId(emp.id)}
                  className={`px-6 py-2.5 rounded-full whitespace-nowrap text-xs font-black transition-all transform active:scale-95 ${
                    selectedEmpId === emp.id
                      ? 'bg-gray-900 text-white shadow-xl translate-y-[-2px]'
                      : 'bg-white text-gray-400 border border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  {emp.name}
                </button>
              ))}
            </div>

            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl shadow-gray-200/50 border border-gray-100">
                <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 p-10 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full mb-4 text-[10px] font-black tracking-widest flex items-center gap-2 uppercase">
                      <Store size={12} />
                      {selectedEmp.shop}
                      <span className="opacity-40">|</span>
                      {selectedEmp.level}
                    </div>

                    <h2 className="text-6xl font-black mb-4 tracking-tighter">
                      {selectedEmp.name}
                    </h2>

                    <div className="flex justify-center items-center gap-4 text-xs font-bold bg-black/10 px-6 py-3 rounded-2xl">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-orange-200" />
                        {formatDate(selectedEmp.startDate)}
                      </div>
                      <div className="w-[1px] h-3 bg-white/20"></div>
                      <div className="flex items-center gap-1.5">
                        <History size={14} className="text-orange-200" />
                        {calculateSeniority(selectedEmp.startDate).text}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex flex-col items-center justify-center text-center group hover:bg-white hover:shadow-xl transition-all">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-2 group-hover:text-orange-500 transition-colors">
                      當前累積績效積分
                    </p>

                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black text-gray-800">
                        {selectedEmp.currentPoints}
                      </span>
                      <span className="text-sm text-gray-400 font-bold">
                        / {selectedEmp.initialPoints}
                      </span>
                    </div>

                    <div
                      className={`mt-4 px-4 py-1 rounded-full text-[10px] font-black ${
                        calculateResult(
                          selectedEmp.currentPoints,
                          selectedEmp.lastYearLow
                        ).bg
                      }`}
                    >
                      {
                        calculateResult(
                          selectedEmp.currentPoints,
                          selectedEmp.lastYearLow
                        ).status
                      }
                    </div>
                  </div>

                  <div className="bg-orange-50 p-6 rounded-[2rem] border border-orange-100 flex flex-col items-center justify-center text-center group hover:bg-white hover:shadow-xl transition-all">
                    <p className="text-[10px] text-orange-400 font-black uppercase tracking-widest mb-2 group-hover:text-orange-600 transition-colors">
                      預計年度結算獎勵
                    </p>

                    <div className="flex items-baseline gap-1 text-orange-600">
                      <span className="text-sm font-black">$</span>
                      <span className="text-5xl font-black">
                        {calculateFinalPay(selectedEmp)}
                      </span>
                    </div>

                    <div className="mt-4 text-[10px] text-orange-400 font-bold flex items-center gap-1 uppercase">
                      <TrendingUp size={12} />
                      倍率 x{selectedEmp.multiplier?.toFixed?.(1) ?? selectedEmp.multiplier}
                    </div>
                  </div>
                </div>

                {(!calculateSeniority(selectedEmp.startDate).isEligible ||
                  selectedEmp.skillsPassed < 2) && (
                  <div className="px-8 pb-8">
                    <div className="bg-red-50 text-red-600 p-6 rounded-3xl border border-red-100 flex items-start gap-4">
                      <div className="bg-red-100 p-3 rounded-2xl">
                        <AlertTriangle size={24} />
                      </div>
                      <div>
                        <p className="font-black text-sm mb-1 uppercase tracking-wider">
                          資格尚未達成
                        </p>
                        <p className="text-xs font-bold leading-relaxed opacity-80">
                          您目前過關數：{selectedEmp.skillsPassed}/2 關 且
                          年資：{calculateSeniority(selectedEmp.startDate).text}。
                          <br />
                          需考過 2 關以上且年資滿一年才符合結算資格。
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
                  <h3 className="font-black text-gray-800 text-xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                      <History size={20} />
                    </div>
                    歷史績效明細
                  </h3>

                  <div className="bg-gray-100 p-1 rounded-xl flex">
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-transparent px-4 py-2 rounded-lg text-xs font-black outline-none cursor-pointer"
                    />
                  </div>
                </div>

                {filteredPersonalLogs.length > 0 ? (
                  <div className="space-y-4">
                    {filteredPersonalLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex justify-between items-center p-6 border border-gray-100 rounded-3xl bg-white shadow-sm hover:border-orange-200 transition-all hover:shadow-md group"
                      >
                        <div className="flex gap-4 items-center">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                              log.amount >= 0
                                ? 'bg-green-50 text-green-600'
                                : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {log.amount > 0 ? '+' : ''}
                            {log.amount}
                          </div>

                          <div className="text-left">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              {formatDate(log.occurrenceDate)}
                              <span className="mx-1 opacity-20">|</span>
                              審核員: {log.operator}
                            </p>
                            <p className="font-black text-gray-800 text-lg leading-tight mt-0.5">
                              {log.reason}
                            </p>
                            {log.note && (
                              <p className="text-xs text-gray-400 font-bold mt-1 bg-gray-50 px-3 py-1 rounded-lg inline-block">
                                {log.note}
                              </p>
                            )}
                          </div>
                        </div>

                        <ChevronRight
                          size={20}
                          className="text-gray-200 group-hover:text-orange-300 transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
                    <CheckCircle2
                      size={32}
                      className="text-gray-200 mx-auto mb-4"
                    />
                    <p className="text-gray-400 text-sm font-black uppercase tracking-widest">
                      本月份暫無績效變動紀錄
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
            <section className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-8 bg-gray-900 text-white flex flex-col sm:flex-row justify-between sm:items-center gap-4 relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                <div>
                  <h3 className="font-black text-2xl flex items-center gap-3 tracking-tight">
                    <Users size={28} className="text-red-500" />
                    門店名單總覽
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                    Personnel & Multi-store Management
                  </p>
                </div>

                <button
                  onClick={() => {
                    const newEmpTemplate = {
                      id: Date.now(),
                      name: '',
                      shop: '',
                      startDate: new Date().toISOString().split('T')[0],
                      level: '一般夥伴',
                      skillsPassed: 0,
                      initialPoints: DEFAULT_INITIAL_POINTS,
                      currentPoints: DEFAULT_INITIAL_POINTS,
                      multiplier: 1.0,
                      lastYearLow: false
                    };
                    setEditingEmp(newEmpTemplate);
                    setIsAddingNew(true);
                  }}
                  className="bg-red-600 text-white px-8 py-3.5 rounded-2xl text-sm font-black shadow-xl shadow-red-900/20 flex items-center gap-2 hover:bg-red-500 transition active:scale-95 z-10"
                >
                  <PlusCircle size={20} />
                  註冊新夥伴
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50/50 font-black text-[10px] text-gray-400 border-b uppercase tracking-[0.15em]">
                    <tr>
                      <th className="px-8 py-6">基本資料</th>
                      <th className="px-8 py-6">當前績效</th>
                      <th className="px-8 py-6">職級權重</th>
                      <th className="px-8 py-6">預估獎勵</th>
                      <th className="px-8 py-6 text-right">操作</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-50 font-bold">
                    {employees.map((emp) => {
                      const finalPay = calculateFinalPay(emp);
                      const result = calculateResult(
                        emp.currentPoints,
                        emp.lastYearLow
                      );

                      return (
                        <tr
                          key={emp.id}
                          className="hover:bg-gray-50/50 transition-colors group"
                        >
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="font-black text-gray-800 text-base group-hover:text-orange-600 transition-colors">
                                {emp.name}
                              </span>
                              <span className="text-[10px] text-gray-400 mt-0.5">
                                {emp.shop}
                                <span className="mx-1 opacity-20">|</span>
                                {formatDate(emp.startDate)}
                              </span>
                            </div>
                          </td>

                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <div className="flex items-baseline gap-1">
                                <span className="text-gray-800 font-black text-lg">
                                  {emp.currentPoints}
                                </span>
                                <span className="text-[10px] text-gray-400 font-normal">
                                  / {emp.initialPoints}
                                </span>
                              </div>
                              <div className={`text-[10px] font-black mt-1 ${result.color}`}>
                                {result.status}
                              </div>
                            </div>
                          </td>

                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 text-blue-600">
                                <GraduationCap size={14} />
                                <span className="font-black text-sm">{emp.level}</span>
                              </div>
                              <span className="text-[10px] text-gray-400 mt-1 uppercase font-black">
                                倍率 x{emp.multiplier?.toFixed?.(1) ?? emp.multiplier}
                              </span>
                            </div>
                          </td>

                          <td className="px-8 py-6">
                            <div
                              className={`flex items-center gap-2 p-3 rounded-2xl w-fit ${
                                finalPay > 0
                                  ? 'bg-orange-50 text-orange-600'
                                  : 'bg-gray-100 text-gray-300'
                              }`}
                            >
                              <DollarSign size={14} />
                              <span className="font-black text-lg">{finalPay}</span>
                            </div>
                          </td>

                          <td className="px-8 py-6 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingEmp({
                                    ...emp,
                                    startDate:
                                      typeof emp.startDate === 'string'
                                        ? emp.startDate
                                        : formatDate(emp.startDate)
                                  });
                                  setIsAddingNew(false);
                                }}
                                className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              >
                                <Edit3 size={18} />
                              </button>

                              <button
                                onClick={() => setDeletingEmpId(emp.id)}
                                className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {deletingEmpId && (
              <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
                <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} />
                  </div>
                  <h3 className="text-xl font-black mb-2">確定要刪除夥伴？</h3>
                  <p className="text-gray-400 text-sm mb-6">
                    此操作無法復原，該夥伴的所有績效積分紀錄都將被清除。
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setDeletingEmpId(null)}
                      className="py-3 px-4 bg-gray-100 rounded-xl font-black hover:bg-gray-200 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => deleteEmployee(deletingEmpId)}
                      className="py-3 px-4 bg-red-600 text-white rounded-xl font-black hover:bg-red-700 transition-colors"
                    >
                      確定刪除
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;