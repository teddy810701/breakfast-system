import { db } from './firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc
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
  Save,
  Settings
} from 'lucide-react';

const App = () => {
  const DEFAULT_INITIAL_POINTS = 600;
  const GLOBAL_BASE_BONUS = 600;

  const STORE_CONFIG = {
    storeA: { label: '西螺文昌店', managerKey: 'managerA' },
    storeB: { label: '斗南站前店', managerKey: 'managerB' }
  };

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
  const [logs, setLogs] = useState([]);

  const [activeTab, setActiveTab] = useState('employee');
  const [selectedEmpId, setSelectedEmpId] = useState(null);

  const [authMode, setAuthMode] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [managerLoginKey, setManagerLoginKey] = useState('managerA');
  const [currentManager, setCurrentManager] = useState(null);

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

  const [authConfig, setAuthConfig] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [showPasswordSettings, setShowPasswordSettings] = useState(false);
  const [passwordPanel, setPasswordPanel] = useState({
    adminPassword: '',
    managerAName: '店長A',
    managerAPassword: '',
    managerBName: '店長B',
    managerBPassword: ''
  });
  const [savingPassword, setSavingPassword] = useState(false);

  const getStoreLabel = (storeId) =>
    STORE_CONFIG[storeId]?.label || storeId || '未設定店鋪';

  const currentStoreId = currentManager?.storeId || null;

  const showMessage = (text, type = 'info') => {
    setSystemMessage({ text, type });
    setTimeout(() => setSystemMessage(null), 3000);
  };

  useEffect(() => {
    const initAuthConfig = async () => {
      try {
        const authRef = doc(db, 'settings', 'auth');
        const snap = await getDoc(authRef);

        if (!snap.exists()) {
          const initialData = {
            adminPassword: '9999',
            managerA: {
              name: '店長A',
              password: 'a8888',
              storeId: 'storeA'
            },
            managerB: {
              name: '店長B',
              password: 'b8888',
              storeId: 'storeB'
            }
          };
          await setDoc(authRef, initialData);
          setAuthConfig(initialData);
          setPasswordPanel({
            adminPassword: initialData.adminPassword,
            managerAName: initialData.managerA.name,
            managerAPassword: initialData.managerA.password,
            managerBName: initialData.managerB.name,
            managerBPassword: initialData.managerB.password
          });
        } else {
          const data = snap.data();
          setAuthConfig(data);
          setPasswordPanel({
            adminPassword: data.adminPassword || '',
            managerAName: data.managerA?.name || '店長A',
            managerAPassword: data.managerA?.password || '',
            managerBName: data.managerB?.name || '店長B',
            managerBPassword: data.managerB?.password || ''
          });
        }
      } catch (error) {
        console.error('讀取 auth 設定失敗:', error);
        showMessage('讀取權限設定失敗', 'error');
      } finally {
        setAuthReady(true);
      }
    };

    initAuthConfig();
  }, []);

  useEffect(() => {
    const unsubscribers = [];

    ['storeA', 'storeB'].forEach((storeId) => {
      const unsubEmployees = onSnapshot(
        collection(db, 'stores', storeId, 'employees'),
        (snapshot) => {
          setEmployees((prev) => {
            const others = prev.filter((emp) => emp.storeId !== storeId);
            const data = snapshot.docs.map((docSnap) => {
              const raw = docSnap.data();
              return {
                id: docSnap.id,
                storeId,
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
                shop: raw.shop || getStoreLabel(storeId),
                name: raw.name || '',
                startDate: raw.startDate || ''
              };
            });

            return [...others, ...data];
          });
        },
        (error) => {
          console.error(`讀取 ${storeId} employees 失敗:`, error);
        }
      );

      const unsubLogs = onSnapshot(
        collection(db, 'stores', storeId, 'logs'),
        (snapshot) => {
          setLogs((prev) => {
            const others = prev.filter((log) => log.storeId !== storeId);
            const data = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              storeId,
              ...docSnap.data()
            }));

            const merged = [...others, ...data];
            merged.sort((a, b) => {
              const aTime = new Date(a.timestamp || 0).getTime() || 0;
              const bTime = new Date(b.timestamp || 0).getTime() || 0;
              return bTime - aTime;
            });

            return merged;
          });
        },
        (error) => {
          console.error(`讀取 ${storeId} logs 失敗:`, error);
        }
      );

      unsubscribers.push(unsubEmployees, unsubLogs);
    });

    return () => unsubscribers.forEach((fn) => fn && fn());
  }, []);

  useEffect(() => {
    const source =
      activeTab === 'manager' && currentStoreId
        ? employees.filter((emp) => emp.storeId === currentStoreId)
        : employees;

    setSelectedEmpId((prev) => {
      if (prev && source.some((emp) => emp.id === prev)) return prev;
      return source[0]?.id ?? null;
    });
  }, [employees, activeTab, currentStoreId]);

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

  const visibleEmployees = useMemo(() => {
    if (activeTab === 'manager' && currentStoreId) {
      return employees.filter((emp) => emp.storeId === currentStoreId);
    }
    return employees;
  }, [employees, activeTab, currentStoreId]);

  const selectedEmp =
    visibleEmployees.find((e) => e.id === selectedEmpId) ||
    visibleEmployees[0] ||
    null;

  const filteredPersonalLogs = logs
    .filter((log) => log.empId === selectedEmp?.id)
    .filter((log) => {
      const monthKey = getMonthKeyFromDate(log.occurrenceDate || log.timestamp);
      return monthKey === selectedMonth;
    });

  const managerViewLogs = logs
    .filter((log) => log.empId === selectedEmpId)
    .filter((log) => !currentStoreId || log.storeId === currentStoreId)
    .slice(0, 10);

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      const aPoints = getEmployeeYearPoints(a, getCurrentYear());
      const bPoints = getEmployeeYearPoints(b, getCurrentYear());
      return bPoints - aPoints;
    });
  }, [employees, logs]);

  const sortedVisibleEmployees = useMemo(() => {
    return [...visibleEmployees].sort((a, b) => {
      const aPoints = getEmployeeYearPoints(a, getCurrentYear());
      const bPoints = getEmployeeYearPoints(b, getCurrentYear());
      return bPoints - aPoints;
    });
  }, [visibleEmployees, logs]);
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

  const handleAddEmployee = async () => {
    if (!editingEmp?.name?.trim()) {
      showMessage('請輸入姓名', 'error');
      return;
    }

    if (activeTab === 'manager' && !currentStoreId) {
      showMessage('請先登入店長模式', 'error');
      return;
    }

    const targetStoreId =
      activeTab === 'manager'
        ? currentStoreId
        : editingEmp.storeId || 'storeA';

    const initialPoints =
      typeof editingEmp.initialPoints === 'number'
        ? editingEmp.initialPoints
        : DEFAULT_INITIAL_POINTS;

    const newEmployee = {
      name: editingEmp.name.trim(),
      shop: editingEmp.shop || getStoreLabel(targetStoreId),
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
      await addDoc(collection(db, 'stores', targetStoreId, 'employees'), newEmployee);
      setEditingEmp(null);
      setIsAddingNew(false);
      showMessage('新夥伴註冊成功', 'success');
    } catch (error) {
      console.error('新增員工失敗:', error);
      showMessage('新增員工失敗', 'error');
    }
  };

  const handleSaveEmpEdit = async () => {
    if (!editingEmp) return;

    if (isAddingNew) {
      await handleAddEmployee();
      return;
    }

    const targetStoreId = editingEmp.storeId;
    if (!targetStoreId) {
      showMessage('找不到員工分店資料', 'error');
      return;
    }

    try {
      await updateDoc(doc(db, 'stores', targetStoreId, 'employees', editingEmp.id), {
        name: editingEmp.name?.trim() || '',
        shop: editingEmp.shop || getStoreLabel(targetStoreId),
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
        lastYearLow: editingEmp.lastYearLow || false,
        shop: editingEmp.shop || getStoreLabel(targetStoreId)
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
    const targetEmp = employees.find((emp) => emp.id === id);
    if (!targetEmp?.storeId) {
      showMessage('找不到員工分店資料', 'error');
      return;
    }

    try {
      await deleteDoc(doc(db, 'stores', targetEmp.storeId, 'employees', id));
      setDeletingEmpId(null);
      showMessage('夥伴資料已刪除', 'error');
    } catch (error) {
      console.error('刪除失敗:', error);
      showMessage('刪除失敗', 'error');
    }
  };

  const handlePointChange = async (
    empId,
    amount,
    reason,
    operator = currentManager?.name || '店長'
  ) => {
    const targetEmp = employees.find((e) => e.id === empId);
    if (!targetEmp) return;

    const targetStoreId = targetEmp.storeId;
    if (!targetStoreId) {
      showMessage('找不到員工分店', 'error');
      return;
    }

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
        await updateDoc(doc(db, 'stores', targetStoreId, 'employees', empId), {
          currentPoints: nextCurrentPoints
        });
      }

      await addDoc(collection(db, 'stores', targetStoreId, 'logs'), {
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
    if (!targetEmp || !log.storeId) return;

    const logYear = getLogYear(log);
    const currentYear = getCurrentYear();
    const shouldSyncCurrentPoints = logYear === currentYear;

    try {
      if (shouldSyncCurrentPoints) {
        const currentYearPoints = getEmployeeYearPoints(targetEmp, currentYear);
        await updateDoc(doc(db, 'stores', log.storeId, 'employees', log.empId), {
          currentPoints: currentYearPoints - (Number(log.amount) || 0)
        });
      }

      await deleteDoc(doc(db, 'stores', log.storeId, 'logs', log.id));
      showMessage(`已撤銷 ${log.name} 的評分`, 'info');
    } catch (error) {
      console.error('撤銷失敗:', error);
      showMessage('撤銷失敗', 'error');
    }
  };

  const handleAuth = async (e) => {
    if (e) e.preventDefault();

    if (!authReady || !authConfig) {
      showMessage('權限設定尚未載入完成', 'error');
      return;
    }

    if (authMode === 'manager') {
      const managerData = authConfig[managerLoginKey];
      if (!managerData) {
        setPasswordInput('');
        showMessage('找不到店長設定', 'error');
        return;
      }

      if (passwordInput === managerData.password) {
        setCurrentManager({
          key: managerLoginKey,
          name: managerData.name,
          storeId: managerData.storeId
        });
        setActiveTab('manager');
        setAuthMode(null);
        setPasswordInput('');
        showMessage(`已進入 ${managerData.name} / ${getStoreLabel(managerData.storeId)}`, 'success');
      } else {
        setPasswordInput('');
        showMessage('密碼錯誤', 'error');
      }
    } else if (authMode === 'admin') {
      if (passwordInput === authConfig.adminPassword) {
        setActiveTab('admin');
        setAuthMode(null);
        setPasswordInput('');
      } else {
        setPasswordInput('');
        showMessage('密碼錯誤', 'error');
      }
    }
  };

  const leaveManagerMode = () => {
    setCurrentManager(null);
    setActiveTab('employee');
  };

  const savePasswords = async () => {
    try {
      setSavingPassword(true);

      const payload = {
        adminPassword: passwordPanel.adminPassword.trim(),
        managerA: {
          name: passwordPanel.managerAName.trim() || '店長A',
          password: passwordPanel.managerAPassword.trim(),
          storeId: 'storeA'
        },
        managerB: {
          name: passwordPanel.managerBName.trim() || '店長B',
          password: passwordPanel.managerBPassword.trim(),
          storeId: 'storeB'
        }
      };

      if (
        !payload.adminPassword ||
        !payload.managerA.password ||
        !payload.managerB.password
      ) {
        showMessage('密碼不可空白', 'error');
        return;
      }

      await setDoc(doc(db, 'settings', 'auth'), payload);
      setAuthConfig(payload);

      if (currentManager?.key && payload[currentManager.key]) {
        setCurrentManager({
          key: currentManager.key,
          name: payload[currentManager.key].name,
          storeId: payload[currentManager.key].storeId
        });
      }

      showMessage('權限設定已更新', 'success');
    } catch (error) {
      console.error('更新設定失敗:', error);
      showMessage('更新設定失敗', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const adminStoreStats = {
    storeA: employees.filter((emp) => emp.storeId === 'storeA').length,
    storeB: employees.filter((emp) => emp.storeId === 'storeB').length
  };

  const adminEmployees = [...employees].sort((a, b) => {
    const aPoints = getEmployeeYearPoints(a, getCurrentYear());
    const bPoints = getEmployeeYearPoints(b, getCurrentYear());
    return bPoints - aPoints;
  });

  const adminAllLogs = [...logs].sort((a, b) => {
    const aTime = new Date(a.timestamp || 0).getTime() || 0;
    const bTime = new Date(b.timestamp || 0).getTime() || 0;
    return bTime - aTime;
  });

  if (!authReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 px-8 py-6">
          <p className="font-black text-gray-700">系統載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-12">
      {systemMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 border ${
            systemMessage.type === 'error'
              ? 'bg-red-600 text-white border-red-300 animate-bounce'
              : systemMessage.type === 'success'
              ? 'bg-green-600 text-white border-green-300'
              : 'bg-gray-800 text-white border-gray-700'
          }`}
        >
          {systemMessage.type === 'error' && <AlertTriangle size={18} />}
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

            {authMode === 'manager' && (
              <div className="mb-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  選擇分店店長
                </label>
                <select
                  value={managerLoginKey}
                  onChange={(e) => setManagerLoginKey(e.target.value)}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-orange-500 outline-none font-bold"
                >
                  <option value="managerA">
                    {authConfig?.managerA?.name || '店長A'} / {getStoreLabel('storeA')}
                  </option>
                  <option value="managerB">
                    {authConfig?.managerB?.name || '店長B'} / {getStoreLabel('storeB')}
                  </option>
                </select>
              </div>
            )}

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

      {showPasswordSettings && (
        <div className="fixed inset-0 z-[650] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2.2rem] w-full max-w-3xl shadow-2xl overflow-hidden">
            <div className="p-6 sm:p-8 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                  <Settings size={22} className="text-orange-600" />
                  密碼與權限設定
                </h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
                  Password & Permission Settings
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordSettings(false)}
                className="w-11 h-11 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 sm:p-8 bg-white">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    管理員密碼
                  </label>
                  <input
                    value={passwordPanel.adminPassword}
                    onChange={(e) =>
                      setPasswordPanel((prev) => ({
                        ...prev,
                        adminPassword: e.target.value
                      }))
                    }
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:border-orange-500 outline-none font-bold"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                    <p className="text-sm font-black text-gray-800 mb-4">
                      店長 A / {getStoreLabel('storeA')}
                    </p>
                    <div className="space-y-3">
                      <input
                        value={passwordPanel.managerAName}
                        onChange={(e) =>
                          setPasswordPanel((prev) => ({
                            ...prev,
                            managerAName: e.target.value
                          }))
                        }
                        placeholder="店長名稱"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold"
                      />
                      <input
                        value={passwordPanel.managerAPassword}
                        onChange={(e) =>
                          setPasswordPanel((prev) => ({
                            ...prev,
                            managerAPassword: e.target.value
                          }))
                        }
                        placeholder="店長密碼"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                    <p className="text-sm font-black text-gray-800 mb-4">
                      店長 B / {getStoreLabel('storeB')}
                    </p>
                    <div className="space-y-3">
                      <input
                        value={passwordPanel.managerBName}
                        onChange={(e) =>
                          setPasswordPanel((prev) => ({
                            ...prev,
                            managerBName: e.target.value
                          }))
                        }
                        placeholder="店長名稱"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold"
                      />
                      <input
                        value={passwordPanel.managerBPassword}
                        onChange={(e) =>
                          setPasswordPanel((prev) => ({
                            ...prev,
                            managerBPassword: e.target.value
                          }))
                        }
                        placeholder="店長密碼"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={savePasswords}
                  disabled={savingPassword}
                  className="w-full py-4 rounded-2xl bg-gray-900 text-white font-black hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  type="button"
                >
                  <Save size={18} />
                  {savingPassword ? '儲存中...' : '儲存管理設定'}
                </button>
              </div>
            </div>
          </div>
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
                    value={editingEmp.storeId || ''}
                    onChange={(e) =>
                      setEditingEmp({
                        ...editingEmp,
                        storeId: e.target.value,
                        shop: getStoreLabel(e.target.value)
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold appearance-none"
                    disabled={activeTab === 'manager' || !isAddingNew}
                  >
                    {activeTab === 'manager' ? (
                      <option value={currentStoreId || ''}>
                        {getStoreLabel(currentStoreId)}
                      </option>
                    ) : (
                      <>
                        <option value="">選擇店鋪</option>
                        <option value="storeA">西螺文昌店</option>
                        <option value="storeB">斗南站前店</option>
                      </>
                    )}
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

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => {
                    setEditingEmp(null);
                    setIsAddingNew(false);
                  }}
                  className="w-full py-4 rounded-2xl bg-gray-100 text-gray-600 font-black hover:bg-gray-200 transition-colors"
                  type="button"
                >
                  取消
                </button>

                <button
                  onClick={isAddingNew ? handleAddEmployee : handleSaveEmpEdit}
                  className="w-full py-4 rounded-2xl bg-gray-900 text-white font-black hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                  type="button"
                >
                  <Save size={18} />
                  {isAddingNew ? '建立夥伴' : '儲存變更'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deletingEmpId && (
        <div className="fixed inset-0 z-[750] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle size={28} />
            </div>

            <h3 className="text-center text-2xl font-black text-gray-800">
              確定要刪除？
            </h3>
            <p className="text-center text-gray-400 font-bold mt-3 leading-7">
              刪除後將無法恢復，請再次確認是否要移除此夥伴資料。
            </p>

            <div className="grid grid-cols-2 gap-3 mt-8">
              <button
                type="button"
                onClick={() => setDeletingEmpId(null)}
                className="py-4 rounded-2xl bg-gray-100 text-gray-600 font-black hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => deleteEmployee(deletingEmpId)}
                className="py-4 rounded-2xl bg-red-600 text-white font-black hover:bg-red-700 transition-colors"
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
                activeTab === 'manager' ? leaveManagerMode() : setAuthMode('manager')
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 ${
                activeTab === 'manager'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              type="button"
            >
              <Store size={14} />
              <span className="hidden sm:inline">
                {activeTab === 'manager' ? currentManager?.name || '店長' : '店長'}
              </span>
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
        {activeTab === 'employee' && (
          <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                    <Users size={22} className="text-orange-600" />
                    員工查詢總覽
                  </h2>
                  <p className="text-xs text-gray-400 font-bold mt-1">
                    這裡只提供員工查看自己的狀態，不提供評分操作
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      全部人數
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
              </div>

              <div className="space-y-4">
                {sortedEmployees.map((emp) => {
                  const assessment = getEmployeeAssessment(emp);
                  const warnings = getEmployeeWarnings(emp);

                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => {
                        setSelectedEmpId(emp.id);
                        setSelectedMonth(new Date().toISOString().substring(0, 7));
                      }}
                      className={`w-full text-left p-5 rounded-3xl border transition-all ${
                        selectedEmpId === emp.id
                          ? 'border-orange-300 bg-orange-50/60'
                          : warnings.some((w) => w.level === 'danger')
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
                              <p className="text-xl font-black mt-2 text-gray-800">
                                {calculateSeniority(emp.startDate).text}
                              </p>
                            </div>

                            <div className="bg-white rounded-2xl p-4 border border-gray-100">
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                已過關卡
                              </p>
                              <p className="text-2xl font-black mt-2 text-gray-800">
                                {emp.skillsPassed}
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

                        <div className="xl:w-[140px]">
                          <div className="w-full px-4 py-4 rounded-2xl bg-white border border-gray-200 text-gray-700 font-black text-center">
                            查看狀態
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {sortedEmployees.length === 0 && (
                  <div className="p-8 rounded-3xl border border-dashed border-gray-200 text-center bg-gray-50 text-gray-400 font-bold">
                    目前尚無員工資料
                  </div>
                )}
              </div>
            </section>
            {selectedEmp && (
              <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-8 border-b bg-gray-50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] text-orange-600 font-black uppercase tracking-widest">
                          Employee Status
                        </p>
                        <h3 className="text-3xl font-black mt-2 text-gray-800">
                          {selectedEmp.name}
                        </h3>
                        <p className="text-sm text-gray-400 font-bold mt-2">
                          {selectedEmp.shop || '未設定店鋪'} · {selectedEmp.level}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
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
                    </div>
                  </div>

                  <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                        年資
                      </p>
                      <p className="text-2xl font-black mt-2 text-gray-800">
                        {calculateSeniority(selectedEmp.startDate).text}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                        今年分數
                      </p>
                      <p className="text-2xl font-black mt-2 text-gray-800">
                        {getEmployeeAssessment(selectedEmp).thisYearPoints}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                        去年分數
                      </p>
                      <p className="text-2xl font-black mt-2 text-gray-800">
                        {getEmployeeAssessment(selectedEmp).lastYearPoints}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                        年度結果
                      </p>
                      <p
                        className={`text-xl font-black mt-2 ${
                          getEmployeeAssessment(selectedEmp).result.color
                        }`}
                      >
                        {getEmployeeAssessment(selectedEmp).result.status}
                      </p>
                    </div>
                  </div>

                  <div className="px-8 pb-8">
                    <div className="bg-gray-50 rounded-[2rem] p-6 border border-gray-100">
                      <h3 className="font-black text-gray-800 mb-4">目前狀態說明</h3>

                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl p-5 border border-gray-100">
                          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                            年度描述
                          </p>
                          <p className="text-lg font-black text-gray-800 mt-2">
                            {getEmployeeAssessment(selectedEmp).result.desc}
                          </p>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-gray-100">
                          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                            本月遲到次數
                          </p>
                          <p className="text-2xl font-black text-gray-800 mt-2">
                            {getEmployeeMonthlyWarningStats(selectedEmp.id).lateCount}
                          </p>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-gray-100">
                          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                            本月累積扣分
                          </p>
                          <p className="text-2xl font-black text-red-600 mt-2">
                            {getEmployeeMonthlyWarningStats(selectedEmp.id).totalPenaltyPoints}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-black text-gray-800 flex items-center gap-2">
                      <History size={18} className="text-gray-400" />
                      當月紀錄
                    </h3>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-black text-gray-700 outline-none"
                    />
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
                                {log.note ? ` · ${log.note}` : ''}
                              </p>
                            </div>
                          </div>

                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                            {log.operator || '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-8 text-center text-gray-400 font-bold">
                      本月尚無紀錄
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === 'manager' && (
          <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                    <Store size={22} className="text-orange-600" />
                    {currentManager?.name || '店長'} / {getStoreLabel(currentStoreId)}
                  </h2>
                  <p className="text-xs text-gray-400 font-bold mt-1">
                    店長可管理自己分店夥伴、評分與歷程
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      分店人數
                    </p>
                    <p className="text-3xl font-black text-gray-800 mt-2">
                      {visibleEmployees.length}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      本月警示
                    </p>
                    <p className="text-3xl font-black text-red-600 mt-2">
                      {
                        visibleEmployees.filter((emp) =>
                          getEmployeeWarnings(emp).some(
                            (w) =>
                              w.key === 'late' ||
                              w.key === 'majorMistake' ||
                              w.key === 'penaltyPoints'
                          )
                        ).length
                      }
                    </p>
                  </div>

                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      B/C/D 人數
                    </p>
                    <p className="text-3xl font-black text-orange-600 mt-2">
                      {
                        visibleEmployees.filter((emp) =>
                          ['B', 'C', 'D'].some((tag) =>
                            getEmployeeAssessment(emp).result.status.includes(tag)
                          )
                        ).length
                      }
                    </p>
                  </div>

                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      目前月份
                    </p>
                    <p className="text-2xl font-black text-gray-800 mt-2">
                      {new Date().toISOString().substring(0, 7)}
                    </p>
                  </div>
                </div>
              </div>

              {sortedVisibleEmployees.length > 0 ? (
                <div className="grid gap-4">
                  {sortedVisibleEmployees.map((emp) => {
                    const assessment = getEmployeeAssessment(emp);
                    const warnings = getEmployeeWarnings(emp);

                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          setSelectedEmpId(emp.id);
                          setSelectedMonth(new Date().toISOString().substring(0, 7));
                        }}
                        className={`text-left p-5 rounded-3xl border transition-all ${
                          selectedEmpId === emp.id
                            ? 'border-orange-300 bg-orange-50/60'
                            : warnings.some((w) => w.level === 'danger')
                            ? 'border-red-200 bg-red-50/40'
                            : warnings.length > 0
                            ? 'border-yellow-200 bg-yellow-50/40'
                            : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center flex-wrap gap-2 mb-2">
                              <h3 className="text-xl font-black text-gray-800">
                                {emp.name}
                              </h3>

                              <span
                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${assessment.result.bg}`}
                              >
                                {assessment.result.status}
                              </span>

                              {warnings.slice(0, 3).map((warning) => (
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

                            <p className="text-sm text-gray-400 font-bold">
                              {emp.level} · 年資 {calculateSeniority(emp.startDate).text} · 今年 {assessment.thisYearPoints} 分
                            </p>
                          </div>

                          <div className="text-orange-600">
                            <ArrowRight size={20} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-[2rem] p-10 text-center text-gray-400 font-bold">
                  此分店目前尚無夥伴資料，請先新增夥伴
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEmp({
                          name: '',
                          shop: getStoreLabel(currentStoreId),
                          startDate: new Date().toISOString().split('T')[0],
                          currentPoints: DEFAULT_INITIAL_POINTS,
                          initialPoints: DEFAULT_INITIAL_POINTS,
                          lastYearLow: false,
                          level: '一般夥伴',
                          multiplier: 1,
                          skillsPassed: 0,
                          storeId: currentStoreId
                        });
                        setIsAddingNew(true);
                      }}
                      className="px-5 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 font-black hover:border-orange-300 hover:text-orange-600 transition-colors inline-flex items-center gap-2"
                    >
                      <PlusCircle size={16} />
                      新增夥伴
                    </button>
                  </div>
                </div>
              )}
            </section>

            {selectedEmp ? (
              <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-8 border-b bg-gray-50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] text-orange-600 font-black uppercase tracking-widest">
                          Store Employee Detail
                        </p>
                        <h3 className="text-3xl font-black mt-2 text-gray-800">
                          {selectedEmp.name}
                        </h3>
                        <p className="text-sm text-gray-400 font-bold mt-2">
                          {selectedEmp.shop || '未設定店鋪'} · {selectedEmp.level}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
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
                    </div>
                  </div>

                  <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                        年資
                      </p>
                      <p className="text-2xl font-black mt-2 text-gray-800">
                        {calculateSeniority(selectedEmp.startDate).text}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                        今年分數
                      </p>
                      <p className="text-2xl font-black mt-2 text-gray-800">
                        {getEmployeeAssessment(selectedEmp).thisYearPoints}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                        去年分數
                      </p>
                      <p className="text-2xl font-black mt-2 text-gray-800">
                        {getEmployeeAssessment(selectedEmp).lastYearPoints}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                        年度結果
                      </p>
                      <p
                        className={`text-xl font-black mt-2 ${
                          getEmployeeAssessment(selectedEmp).result.color
                        }`}
                      >
                        {getEmployeeAssessment(selectedEmp).result.status}
                      </p>
                    </div>
                  </div>

                  <div className="px-8 pb-8">
                    <div className="bg-gray-50 rounded-[2rem] p-6 border border-gray-100">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="font-black text-gray-800 flex items-center gap-2">
                          <History size={18} className="text-gray-400" />
                          最近評分紀錄
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEmp({
                              name: '',
                              shop: getStoreLabel(currentStoreId),
                              startDate: new Date().toISOString().split('T')[0],
                              currentPoints: DEFAULT_INITIAL_POINTS,
                              initialPoints: DEFAULT_INITIAL_POINTS,
                              lastYearLow: false,
                              level: '一般夥伴',
                              multiplier: 1,
                              skillsPassed: 0,
                              storeId: currentStoreId
                            });
                            setIsAddingNew(true);
                          }}
                          className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-sm hover:border-orange-300 hover:text-orange-600 transition-colors flex items-center gap-2"
                        >
                          <PlusCircle size={16} />
                          新增夥伴
                        </button>
                      </div>
                      {managerViewLogs.length > 0 ? (
                        <div className="space-y-3">
                          {managerViewLogs.map((log) => (
                            <div
                              key={log.id}
                              className="p-4 rounded-2xl bg-white border border-gray-100 flex items-center justify-between gap-4"
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
                                    {log.note ? ` · ${log.note}` : ''}
                                  </p>
                                </div>
                              </div>

                              <button
                                onClick={() => undoLog(log)}
                                className="w-11 h-11 rounded-2xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
                                type="button"
                              >
                                <RotateCcw size={18} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-8 text-center text-gray-400 font-bold">
                          目前沒有紀錄
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-6">
                    <h3 className="font-black text-gray-800 mb-5 flex items-center gap-2">
                      <Calendar size={18} className="text-orange-600" />
                      評分操作
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                          發生日期
                        </label>
                        <input
                          type="date"
                          value={occurrenceDate}
                          onChange={(e) => setOccurrenceDate(e.target.value)}
                          className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                          快速項目
                        </label>
                        <select
                          value={selectedItemLabel}
                          onChange={(e) => {
                            const value = e.target.value;
                            setSelectedItemLabel(value);

                            const found = [...PERFORMANCE_ITEMS.penalty, ...PERFORMANCE_ITEMS.bonus].find(
                              (item) => item.label === value
                            );

                            setCustomPoints(found ? found.val : 0);
                          }}
                          className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold appearance-none"
                        >
                          <option value="">請選擇考核項目</option>
                          <optgroup label="扣分項目">
                            {PERFORMANCE_ITEMS.penalty.map((item) => (
                              <option key={item.label} value={item.label}>
                                {item.label}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="加分項目">
                            {PERFORMANCE_ITEMS.bonus.map((item) => (
                              <option key={item.label} value={item.label}>
                                {item.label}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                          分數調整
                        </label>
                        <input
                          type="number"
                          value={customPoints}
                          onChange={(e) =>
                            setCustomPoints(parseInt(e.target.value, 10) || 0)
                          }
                          className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                          備註
                        </label>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={3}
                          className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500 outline-none font-bold resize-none"
                          placeholder="可輸入補充說明"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 mt-6">
                      <button
                        onClick={() => {
                          if (!selectedItemLabel) {
                            showMessage('請先選擇考核項目', 'error');
                            return;
                          }
                          handlePointChange(
                            selectedEmp.id,
                            customPoints,
                            selectedItemLabel
                          );
                        }}
                        className="py-4 rounded-2xl bg-gray-900 text-white font-black hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                        type="button"
                      >
                        <ArrowRight size={18} />
                        提交評分
                      </button>

                      <button
                        onClick={() => {
                          setEditingEmp({ ...selectedEmp });
                          setIsAddingNew(false);
                        }}
                        className="py-4 rounded-2xl bg-white border border-gray-200 text-gray-700 font-black hover:border-orange-300 hover:text-orange-600 transition-colors flex items-center justify-center gap-2"
                        type="button"
                      >
                        <Edit3 size={18} />
                        編輯夥伴
                      </button>

                      <button
                        onClick={() => setDeletingEmpId(selectedEmp.id)}
                        className="py-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 font-black hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                        type="button"
                      >
                        <Trash2 size={18} />
                        刪除夥伴
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-[2rem] p-10 text-center text-gray-400 font-bold">
                此分店目前尚無夥伴資料，請先新增夥伴
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEmp({
                        name: '',
                        shop: getStoreLabel(currentStoreId),
                        startDate: new Date().toISOString().split('T')[0],
                        currentPoints: DEFAULT_INITIAL_POINTS,
                        initialPoints: DEFAULT_INITIAL_POINTS,
                        lastYearLow: false,
                        level: '一般夥伴',
                        multiplier: 1,
                        skillsPassed: 0,
                        storeId: currentStoreId
                      });
                      setIsAddingNew(true);
                    }}
                    className="px-5 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 font-black hover:border-orange-300 hover:text-orange-600 transition-colors inline-flex items-center gap-2"
                  >
                    <PlusCircle size={16} />
                    新增夥伴
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-black flex items-center gap-2 text-gray-800">
                    <Lock size={22} className="text-red-600" />
                    管理員設定中心
                  </h2>
                  <p className="text-xs text-gray-400 font-bold mt-1">
                    系統總覽、全部員工總表、全部操作紀錄都放在這裡
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPasswordSettings(true)}
                  className="px-4 py-3 rounded-2xl bg-gray-900 text-white font-black hover:bg-orange-600 transition-colors flex items-center gap-2"
                >
                  <Settings size={18} />
                  權限與密碼設定
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                    全部員工
                  </p>
                  <p className="text-2xl font-black mt-2 text-gray-800">
                    {employees.length}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                    全部紀錄
                  </p>
                  <p className="text-2xl font-black mt-2 text-gray-800">
                    {logs.length}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                    {getStoreLabel('storeA')}
                  </p>
                  <p className="text-2xl font-black mt-2 text-orange-600">
                    {adminStoreStats.storeA}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                    {getStoreLabel('storeB')}
                  </p>
                  <p className="text-2xl font-black mt-2 text-orange-600">
                    {adminStoreStats.storeB}
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-lg font-black text-gray-800">全部員工總表</h3>
                  <p className="text-xs text-gray-400 font-bold mt-1">
                    顯示分店、年資、去年分數、今年分數、年度結果
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {adminEmployees.map((emp) => {
                  const assessment = getEmployeeAssessment(emp);
                  const warnings = getEmployeeWarnings(emp);
                  return (
                    <div
                      key={emp.id}
                      className={`p-5 rounded-3xl border ${
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
                            <h3 className="text-xl font-black text-gray-800">{emp.name}</h3>

                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white border border-gray-200 text-gray-500">
                              {getStoreLabel(emp.storeId)}
                            </span>

                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${assessment.result.bg}`}>
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
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">年資</p>
                              <p className="text-xl font-black mt-2 text-gray-800">{calculateSeniority(emp.startDate).text}</p>
                            </div>
                            <div className="bg-white rounded-2xl p-4 border border-gray-100">
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">去年分數</p>
                              <p className="text-2xl font-black mt-2 text-gray-800">{assessment.lastYearPoints}</p>
                            </div>
                            <div className="bg-white rounded-2xl p-4 border border-gray-100">
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">今年分數</p>
                              <p className="text-2xl font-black mt-2 text-gray-800">{assessment.thisYearPoints}</p>
                            </div>
                            <div className="bg-white rounded-2xl p-4 border border-gray-100">
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">已過關卡</p>
                              <p className="text-2xl font-black mt-2 text-gray-800">{emp.skillsPassed}</p>
                            </div>
                            <div className="bg-white rounded-2xl p-4 border border-gray-100">
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">預估加級</p>
                              <p className="text-2xl font-black mt-2 text-orange-600">{calculateFinalPay(emp)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {adminEmployees.length === 0 && (
                  <div className="p-8 rounded-3xl border border-dashed border-gray-200 text-center bg-gray-50 text-gray-400 font-bold">
                    目前尚無員工資料
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-lg font-black text-gray-800">全部操作紀錄總覽</h3>
                  <p className="text-xs text-gray-400 font-bold mt-1">
                    管理員可直接查看兩間店所有評分與操作紀錄
                  </p>
                </div>
              </div>

              {adminAllLogs.length > 0 ? (
                <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
                  {adminAllLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shrink-0 ${
                            Number(log.amount) >= 0
                              ? 'bg-green-100 text-green-600'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {Number(log.amount) > 0 ? '+' : ''}
                          {log.amount}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center flex-wrap gap-2">
                            <p className="font-black text-gray-800">{log.name || '未命名員工'}</p>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white border border-gray-200 text-gray-500">
                              {getStoreLabel(log.storeId)}
                            </span>
                            {log.operator && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-orange-50 border border-orange-100 text-orange-600">
                                操作者：{log.operator}
                              </span>
                            )}
                          </div>
                          <p className="font-bold text-gray-700 mt-1 break-words">{log.reason || '未填寫原因'}</p>
                          <p className="text-xs text-gray-400 mt-1 break-words">
                            {formatDate(log.occurrenceDate || log.timestamp)}
                            {log.note ? ` · 備註：${log.note}` : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-8 text-center text-gray-400 font-bold">
                  目前沒有任何操作紀錄
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
