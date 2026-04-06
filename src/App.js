import { db } from './firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  PlusCircle,
  AlertTriangle,
  ShieldCheck,
  History,
  Calendar,
  Store,
  Trash2,
  Lock,
  Edit3,
  X,
  Search,
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
    const unsubscribe = onSnapshot(
      collection(db, 'employees'),
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data();
          return {
            id: docSnap.id,
            ...raw,
            skillsPassed: raw.skillsPassed ?? raw.skillspassed ?? 0,
            lastYearLow: raw.lastYearLow ?? raw.LastYearLow ?? false,
            currentPoints:
              typeof raw.currentPoints === 'number'
                ? raw.currentPoints
                : raw.initialPoints ?? DEFAULT_INITIAL_POINTS,
            initialPoints:
              typeof raw.initialPoints === 'number'
                ? raw.initialPoints
                : DEFAULT_INITIAL_POINTS,
            multiplier:
              typeof raw.multiplier === 'number' ? raw.multiplier : 1,
            level: raw.level || '一般夥伴',
            shop: raw.shop || '',
            name: raw.name || '',
            startDate: raw.startDate || ''
          };
        });

        setEmployees(data);
        setSelectedEmpId((prev) => {
          if (prev && data.some((emp) => emp.id === prev)) return prev;
          return data[0]?.id ?? null;
        });
      },
      (error) => {
        console.error('讀取 employees 失敗:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'logs'),
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data();
          return {
            id: docSnap.id,
            ...raw
          };
        });

        data.sort((a, b) => {
          const aTime = new Date(a.timestamp || 0).getTime() || 0;
          const bTime = new Date(b.timestamp || 0).getTime() || 0;
          return bTime - aTime;
        });

        setLogs(data);
      },
      (error) => {
        console.error('讀取 logs 失敗:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const showMessage = (text, type = 'info') => {
    setSystemMessage({ text, type });
    setTimeout(() => setSystemMessage(null), 3000);
  };

  const formatDate = (value) => {
    if (!value) return '';

    if (typeof value === 'string') {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('zh-TW');
      return value;
    }

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

  // ===== 年度分數系統 =====
  const getCurrentYear = () => new Date().getFullYear();

  const getLogDate = (log) => {
    return toJsDate(log?.occurrenceDate || log?.timestamp);
  };

  const getLogYear = (log) => {
    const d = getLogDate(log);
    if (!d || Number.isNaN(d.getTime())) return null;
    return d.getFullYear();
  };

  const getMonthKeyFromDate = (value) => {
    const d = toJsDate(value);
    if (!d || Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const getEmployeeYearLogs = (empId, year) => {
    return logs.filter(
      (log) => log.empId === empId && getLogYear(log) === year
    );
  };

  const getEmployeeYearPoints = (emp, year) => {
    if (!emp) return DEFAULT_INITIAL_POINTS;

    const initial =
      typeof emp.initialPoints === 'number'
        ? emp.initialPoints
        : DEFAULT_INITIAL_POINTS;

    const yearLogs = getEmployeeYearLogs(emp.id, year);
    const delta = yearLogs.reduce(
      (sum, log) => sum + (Number(log.amount) || 0),
      0
    );

    return initial + delta;
  };

  const calculateResult = (
    points,
    lastYearPoints,
    lastYearLowFallback = false
  ) => {
    const lastYearIsLow = lastYearPoints < 499 || lastYearLowFallback;

    if (lastYearIsLow && points < 499) {
      return {
        status: 'D (淘汰)',
        color: 'text-gray-900',
        bg: 'bg-gray-900 text-white',
        desc: '連兩年低於499'
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

  const getEmployeeAssessment = (emp, year = getCurrentYear()) => {
    const thisYearPoints = getEmployeeYearPoints(emp, year);
    const lastYearPoints = getEmployeeYearPoints(emp, year - 1);
    const result = calculateResult(
      thisYearPoints,
      lastYearPoints,
      emp?.lastYearLow || false
    );

    return {
      year,
      thisYearPoints,
      lastYearPoints,
      result
    };
  };

  const calculateFinalPay = (emp) => {
    if (!emp || emp.skillsPassed < 2) return 0;

    const seniority = calculateSeniority(emp.startDate);
    if (!seniority.isEligible) return 0;

    const { result } = getEmployeeAssessment(emp);
    const base = GLOBAL_BASE_BONUS * (emp.multiplier || 1);

    if (result.status.includes('A')) return Math.round(base);
    if (result.status.includes('B')) return Math.round(base / 2);
    return 0;
  };

  // ===== 警示系統 =====
  const getEmployeeMonthLogs = (empId, monthKey = getCurrentMonthKey()) => {
    return logs.filter((log) => {
      if (log.empId !== empId) return false;
      return getMonthKeyFromDate(log.occurrenceDate || log.timestamp) === monthKey;
    });
  };

  const isLateLog = (log) => {
    const reason = String(log.reason || '');
    return reason.includes('遲到');
  };

  const isMajorMistakeLog = (log) => {
    const reason = String(log.reason || '');
    return (
      reason.includes('作業失誤-重') ||
      reason.includes('燒焦') ||
      reason.includes('客訴')
    );
  };

  const getEmployeeMonthlyWarningStats = (
    empId,
    monthKey = getCurrentMonthKey()
  ) => {
    const monthLogs = getEmployeeMonthLogs(empId, monthKey);

    const lateCount = monthLogs.filter(isLateLog).length;
    const majorMistakeCount = monthLogs.filter(isMajorMistakeLog).length;
    const totalPenaltyPoints = monthLogs
      .filter((log) => Number(log.amount) < 0)
      .reduce((sum, log) => sum + Math.abs(Number(log.amount) || 0), 0);
    const totalPenaltyCount = monthLogs.filter(
      (log) => Number(log.amount) < 0
    ).length;

    return {
      lateCount,
      majorMistakeCount,
      totalPenaltyPoints,
      totalPenaltyCount
    };
  };

  const getEmployeeWarnings = (emp) => {
    if (!emp) return [];

    const warnings = [];
    const stats = getEmployeeMonthlyWarningStats(emp.id);
    const assessment = getEmployeeAssessment(emp);

    if (stats.lateCount >= 2) {
      warnings.push({
        key: 'late',
        label: `本月遲到 ${stats.lateCount} 次`,
        level: 'warning'
      });
    }

    if (stats.majorMistakeCount >= 2) {
      warnings.push({
        key: 'majorMistake',
        label: `本月重大失誤 ${stats.majorMistakeCount} 次`,
        level: 'danger'
      });
    }

    if (stats.totalPenaltyPoints >= 15) {
      warnings.push({
        key: 'penaltyPoints',
        label: `本月累積扣分 ${stats.totalPenaltyPoints}`,
        level: 'danger'
      });
    }

    if (stats.totalPenaltyCount >= 5) {
      warnings.push({
        key: 'penaltyCount',
        label: `本月負向紀錄 ${stats.totalPenaltyCount} 筆`,
        level: 'warning'
      });
    }

    if (assessment.result.status.includes('B')) {
      warnings.push({
        key: 'yearB',
        label: '年度 B 警示',
        level: 'warning'
      });
    }

    if (assessment.result.status.includes('C')) {
      warnings.push({
        key: 'yearC',
        label: '年度 C 重罰',
        level: 'danger'
      });
    }

    if (assessment.result.status.includes('D')) {
      warnings.push({
        key: 'yearD',
        label: '年度 D 淘汰',
        level: 'danger'
      });
    }

    return warnings;
  };

  const getWarningBadgeClass = (level) => {
    if (level === 'danger') {
      return 'bg-red-100 text-red-700 border-red-200';
    }
    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  };

  // ===== CRUD =====
  const handleAddEmployee = async () => {
    if (!editingEmp?.name?.trim()) {
      showMessage('請輸入姓名', 'error');
      return;
    }

    const initialPoints =
      typeof editingEmp.initialPoints === 'number'
        ? editingEmp.initialPoints
        : DEFAULT_INITIAL_POINTS;

    const newEmployee = {
      name: editingEmp.name.trim(),
      shop: editingEmp.shop || '',
      startDate: editingEmp.startDate || new Date().toISOString().split('T')[0],
      currentPoints: initialPoints,
      initialPoints,
      lastYearLow: editingEmp.lastYearLow || false,
      level: editingEmp.level || '一般夥伴',
      multiplier:
        typeof editingEmp.multiplier === 'number' ? editingEmp.multiplier : 1,
      skillsPassed:
        typeof editingEmp.skillsPassed === 'number' ? editingEmp.skillsPassed : 0
    };

    try {
      await addDoc(collection(db, 'employees'), newEmployee);
      setEditingEmp(null);
      setIsAddingNew(false);
      showMessage('新夥伴註冊成功', 'success');
    } catch (error) {
      console.error('新增員工失敗:', error);
      showMessage('新增員工失敗', 'error');
    }
  };

  const handlePointChange = async (
    empId,
    amount,
    reason,
    operator = '店長'
  ) => {
    const targetEmp = employees.find((e) => e.id === empId);
    if (!targetEmp) return;

    const selectedDate = toJsDate(occurrenceDate);
    const selectedYear = selectedDate?.getFullYear();
    const currentYear = getCurrentYear();
    const shouldSyncCurrentPoints = selectedYear === currentYear;

    const currentYearPoints = getEmployeeYearPoints(targetEmp, currentYear);
    const nextCurrentPoints = shouldSyncCurrentPoints
      ? currentYearPoints + amount
      : targetEmp.currentPoints ?? currentYearPoints;

    try {
      if (shouldSyncCurrentPoints) {
        await updateDoc(doc(db, 'employees', empId), {
          currentPoints: nextCurrentPoints
        });
      }

      await addDoc(collection(db, 'logs'), {
        empId,
        occurrenceDate,
        name: targetEmp.name,
        amount,
        reason,
        note,
        operator,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('寫入失敗:', error);
      showMessage('寫入 Firebase 失敗', 'error');
      return;
    }

    const previewMonthLogs = [
      ...getEmployeeMonthLogs(empId, getMonthKeyFromDate(occurrenceDate)),
      {
        empId,
        amount,
        reason,
        occurrenceDate
      }
    ];
    const previewLateCount = previewMonthLogs.filter(isLateLog).length;

    setNote('');
    setSelectedItemLabel('');
    setCustomPoints(0);

    if (previewLateCount >= 2) {
      showMessage(
        `${targetEmp.name} 本月遲到已達 ${previewLateCount} 次，請留意`,
        'error'
      );
    } else {
      showMessage(
        `${targetEmp.name} 分數已變動 ${amount > 0 ? '+' : ''}${amount}`,
        'success'
      );
    }
  };

  const undoLog = async (log) => {
    const targetEmp = employees.find((emp) => emp.id === log.empId);
    if (!targetEmp) return;

    const logYear = getLogYear(log);
    const currentYear = getCurrentYear();
    const shouldSyncCurrentPoints = logYear === currentYear;

    try {
      if (shouldSyncCurrentPoints) {
        const currentYearPoints = getEmployeeYearPoints(targetEmp, currentYear);
        await updateDoc(doc(db, 'employees', log.empId), {
          currentPoints: currentYearPoints - (Number(log.amount) || 0)
        });
      }

      await deleteDoc(doc(db, 'logs', log.id));
      showMessage(`已撤銷 ${log.name} 的評分`, 'info');
    } catch (error) {
      console.error('撤銷失敗:', error);
      showMessage('撤銷失敗', 'error');
    }
  };

  const handleSaveEmpEdit = async () => {
    if (!editingEmp) return;

    if (isAddingNew) {
      await handleAddEmployee();
      return;
    }

    try {
      await updateDoc(doc(db, 'employees', editingEmp.id), {
        name: editingEmp.name?.trim() || '',
        shop: editingEmp.shop || '',
        startDate: editingEmp.startDate || '',
        level: editingEmp.level || '一般夥伴',
        skillsPassed:
          typeof editingEmp.skillsPassed === 'number' ? editingEmp.skillsPassed : 0,
        multiplier:
          typeof editingEmp.multiplier === 'number' ? editingEmp.multiplier : 1,
        initialPoints:
          typeof editingEmp.initialPoints === 'number'
            ? editingEmp.initialPoints
            : DEFAULT_INITIAL_POINTS,
        currentPoints:
          typeof editingEmp.currentPoints === 'number'
            ? editingEmp.currentPoints
            : DEFAULT_INITIAL_POINTS,
        lastYearLow: editingEmp.lastYearLow || false
      });

      setEditingEmp(null);
      setIsAddingNew(false);
      showMessage('夥伴資料已更新', 'success');
    } catch (error) {
      console.error('更新員工失敗:', error);
      showMessage('更新失敗', 'error');
    }
  };

  const deleteEmployee = async (id) => {
    try {
      await deleteDoc(doc(db, 'employees', id));
      setDeletingEmpId(null);
      showMessage('夥伴資料已刪除', 'error');
    } catch (error) {
      console.error('刪除失敗:', error);
      showMessage('刪除失敗', 'error');
    }
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
    employees.find((e) => e.id === selectedEmpId) || employees[0] || null;

  const filteredPersonalLogs = logs
    .filter((log) => log.empId === selectedEmp?.id)
    .filter((log) => {
      const monthKey = getMonthKeyFromDate(log.occurrenceDate || log.timestamp);
      return monthKey === selectedMonth;
    });

  const managerViewLogs = logs
    .filter((log) => log.empId === selectedEmpId)
    .slice(0, 10);

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      const aPoints = getEmployeeYearPoints(a, getCurrentYear());
      const bPoints = getEmployeeYearPoints(b, getCurrentYear());
      return bPoints - aPoints;
    });
  }, [employees, logs]);

  const totalEmployees = employees.length;
  const warningCount = employees.filter((emp) => {
    const warnings = getEmployeeWarnings(emp);
    return warnings.length > 0;
  }).length;

  const monthlyWarningCount = employees.filter((emp) => {
    const warnings = getEmployeeWarnings(emp);
    return warnings.some(
      (w) =>
        w.key === 'late' ||
        w.key === 'majorMistake' ||
        w.key === 'penaltyPoints'
    );
  }).length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-12">
      {systemMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 ${
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
            className="bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-sm"
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
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl">
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
                onClick={() => {
                  setEditingEmp(null);
                  setIsAddingNew(false);
                }}
                className="w-12 h-12 flex items-center justify-center bg-white border rounded-full hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
                type="button"
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
                        currentPoints: isAddingNew
                          ? points
                          : editingEmp.currentPoints ?? points
                      });
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold"
                  />
                </div>
              </div>

              {!isAddingNew && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    目前總積分（今年）
                  </label>
                  <input
                    type="number"
                    value={editingEmp.currentPoints}
                    onChange={(e) =>
                      setEditingEmp({
                        ...editingEmp,
                        currentPoints: parseInt(e.target.value, 10) || 0
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold"
                  />
                </div>
              )}

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
                    去年評分為低分警示
                  </span>
                  <span className="text-[10px] font-bold text-orange-400 uppercase">
                    若去年紀錄未完整，可用此欄位作為 D 判定輔助
                  </span>
                </div>
              </label>

              <button
                onClick={isAddingNew ? handleAddEmployee : handleSaveEmpEdit}
                className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-lg hover:bg-orange-600 transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-2"
                type="button"
              >
                <Save size={20} />
                {isAddingNew ? '新增夥伴' : '儲存夥伴資料'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingEmpId && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-5">
              <AlertTriangle size={28} />
            </div>

            <h3 className="text-xl font-black text-gray-800 mb-2">確認刪除夥伴？</h3>
            <p className="text-sm text-gray-400 font-bold mb-6">
              此操作無法復原，員工資料將被移除。
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDeletingEmpId(null)}
                className="py-3 rounded-2xl bg-gray-100 text-gray-600 font-black hover:bg-gray-200 transition-colors"
                type="button"
              >
                取消
              </button>
              <button
                onClick={() => deleteEmployee(deletingEmpId)}
                className="py-3 rounded-2xl bg-red-600 text-white font-black hover:bg-red-700 transition-colors"
                type="button"
              >
                確認刪除
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
              type="button"
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
              type="button"
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
              type="button"
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
                    type="button"
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
                      type="button"
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
                      type="button"
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
                disabled={!selectedItemLabel || !note || !selectedEmpId}
                className="w-full py-5 rounded-3xl font-black text-xl bg-orange-600 text-white disabled:bg-gray-200 transition-all active:scale-[0.98] shadow-xl shadow-orange-200 flex items-center justify-center gap-2 group"
                type="button"
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
                          <p className="text-sm font-black text-gray-800">
                            {log.reason}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(log.occurrenceDate)} ・ {log.note || '無備註'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => undoLog(log)}
                        className="p-3 bg-white border border-gray-200 text-gray-400 hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50 rounded-xl transition-all"
                        title="撤銷紀錄"
                        type="button"
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
                  type="button"
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

                    <h2 className="text-5xl md:text-6xl font-black mb-4 tracking-tighter">
                      {selectedEmp.name}
                    </h2>

                    {getEmployeeWarnings(selectedEmp).length > 0 && (
                      <div className="flex flex-wrap justify-center gap-2 mb-4">
                        {getEmployeeWarnings(selectedEmp).map((warning) => (
                          <span
                            key={warning.key}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getWarningBadgeClass(
                              warning.level
                            )}`}
                          >
                            {warning.label}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 md:gap-6 w-full mt-4">
                      <div className="bg-white/15 backdrop-blur-md rounded-3xl p-5">
                        <p className="text-[10px] uppercase tracking-[0.2em] font-black opacity-70">
                          今年分數
                        </p>
                        <p className="text-4xl font-black mt-2">
                          {getEmployeeAssessment(selectedEmp).thisYearPoints}
                        </p>
                      </div>

                      <div className="bg-white/15 backdrop-blur-md rounded-3xl p-5">
                        <p className="text-[10px] uppercase tracking-[0.2em] font-black opacity-70">
                          去年分數
                        </p>
                        <p className="text-4xl font-black mt-2">
                          {getEmployeeAssessment(selectedEmp).lastYearPoints}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                      年資
                    </p>
                    <p className="text-xl font-black mt-3 text-gray-800">
                      {calculateSeniority(selectedEmp.startDate).text}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                      年度結果
                    </p>
                    <div className="mt-3">
                      <span
                        className={`px-4 py-2 rounded-2xl text-xs font-black ${getEmployeeAssessment(selectedEmp).result.bg}`}
                      >
                        {getEmployeeAssessment(selectedEmp).result.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 font-bold">
                      {getEmployeeAssessment(selectedEmp).result.desc}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                      預估加級
                    </p>
                    <p className="text-3xl font-black mt-3 text-orange-600">
                      {calculateFinalPay(selectedEmp)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-black text-gray-800 flex items-center gap-2">
                    <History size={18} className="text-gray-400" />
                    當月紀錄
                  </h3>
                  <span className="text-[10px] text-gray-300 font-black uppercase tracking-widest">
                    {selectedMonth}
                  </span>
                </div>

                {filteredPersonalLogs.length > 0 ? (
                  <div className="space-y-3">
                    {filteredPersonalLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black ${
                              log.amount >= 0
                                ? 'bg-green-100 text-green-600'
                                : 'bg-red-100 text-red-600'
                            }`}
                          >
                            {log.amount > 0 ? '+' : ''}
                            {log.amount}
                          </div>

                          <div>
                            <p className="font-black text-gray-800">{log.reason}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatDate(log.occurrenceDate)}
                              {log.note ? ` ・ ${log.note}` : ''}
                            </p>
                          </div>
                        </div>
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
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-xl font-black flex items-center gap-2 text-gray-800">
                    <Lock size={24} className="text-red-600" />
                    管理員模式
                  </h2>
                  <p className="text-xs text-gray-400 font-bold mt-1">
                    員工資料管理與年度風險檢視
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingEmp({
                      name: '',
                      shop: '',
                      startDate: new Date().toISOString().split('T')[0],
                      level: '一般夥伴',
                      skillsPassed: 0,
                      multiplier: 1,
                      initialPoints: DEFAULT_INITIAL_POINTS,
                      currentPoints: DEFAULT_INITIAL_POINTS,
                      lastYearLow: false
                    });
                    setIsAddingNew(true);
                  }}
                  className="px-5 py-3 rounded-2xl bg-gray-900 text-white font-black hover:bg-red-600 transition-all flex items-center gap-2 w-fit"
                  type="button"
                >
                  <PlusCircle size={18} />
                  新增夥伴
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    總夥伴數
                  </p>
                  <p className="text-3xl font-black text-gray-800 mt-2">
                    {totalEmployees}
                  </p>
                </div>

                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    全部警示人數
                  </p>
                  <p className="text-3xl font-black text-orange-600 mt-2">
                    {warningCount}
                  </p>
                </div>

                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    本月警示人數
                  </p>
                  <p className="text-3xl font-black text-red-600 mt-2">
                    {monthlyWarningCount}
                  </p>
                </div>

                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    年度基準
                  </p>
                  <p className="text-3xl font-black text-gray-800 mt-2">
                    {DEFAULT_INITIAL_POINTS}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {sortedEmployees.map((emp) => {
                  const assessment = getEmployeeAssessment(emp);
                  const warnings = getEmployeeWarnings(emp);

                  return (
                    <div
                      key={emp.id}
                      className={`p-5 rounded-3xl border transition-all ${
                        warnings.some((w) => w.level === 'danger')
                          ? 'border-red-200 bg-red-50/40'
                          : warnings.length > 0
                          ? 'border-yellow-200 bg-yellow-50/40'
                          : 'border-gray-100 bg-gray-50'
                      }`}
                    >
                      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
                        <div className="flex-1">
                          <div className="flex items-center flex-wrap gap-2 mb-3">
                            <h3 className="text-xl font-black text-gray-800">
                              {emp.name}
                            </h3>

                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white border border-gray-200 text-gray-400">
                              {emp.shop || '未設定店鋪'}
                            </span>

                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${assessment.result.bg}`}
                            >
                              {assessment.result.status}
                            </span>

                            {warnings.slice(0, 4).map((warning) => (
                              <span
                                key={warning.key}
                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getWarningBadgeClass(
                                  warning.level
                                )}`}
                              >
                                {warning.label}
                              </span>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div className="bg-white rounded-2xl p-4 border border-gray-100">
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                今年分數
                              </p>
                              <p className="text-2xl font-black mt-2 text-gray-800">
                                {assessment.thisYearPoints}
                              </p>
                            </div>

                            <div className="bg-white rounded-2xl p-4 border border-gray-100">
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                去年分數
                              </p>
                              <p className="text-2xl font-black mt-2 text-gray-800">
                                {assessment.lastYearPoints}
                              </p>
                            </div>

                            <div className="bg-white rounded-2xl p-4 border border-gray-100">
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                年資
                              </p>
                              <p className="text-sm font-black mt-3 text-gray-800">
                                {calculateSeniority(emp.startDate).text}
                              </p>
                            </div>

                            <div className="bg-white rounded-2xl p-4 border border-gray-100">
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                關卡
                              </p>
                              <p className="text-2xl font-black mt-2 text-gray-800">
                                {emp.skillsPassed || 0}
                              </p>
                            </div>

                            <div className="bg-white rounded-2xl p-4 border border-gray-100">
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                預估加級
                              </p>
                              <p className="text-2xl font-black mt-2 text-orange-600">
                                {calculateFinalPay(emp)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setEditingEmp({
                                ...emp,
                                currentPoints: getEmployeeYearPoints(
                                  emp,
                                  getCurrentYear()
                                )
                              });
                              setIsAddingNew(false);
                            }}
                            className="px-5 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-600 transition-all flex items-center gap-2 font-black"
                            type="button"
                          >
                            <Edit3 size={16} />
                            編輯
                          </button>

                          <button
                            onClick={() => setDeletingEmpId(emp.id)}
                            className="px-5 py-3 rounded-2xl bg-white border border-red-200 text-red-500 hover:bg-red-50 transition-all flex items-center gap-2 font-black"
                            type="button"
                          >
                            <Trash2 size={16} />
                            刪除
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 text-xs text-gray-400 font-bold">
                        {assessment.result.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
