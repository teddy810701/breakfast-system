import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  updateDoc
} from 'firebase/firestore';
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Pin,
  Plus,
  Printer,
  Search,
  X
} from 'lucide-react';

const CATEGORIES = ['人事', '工作規範', '食安', '客訴', '教育訓練', '設備維修', '其他'];
const STORE_OPTIONS = [
  { value: 'all', label: '全門市' },
  { value: 'storeA', label: '西螺文昌店' },
  { value: 'storeB', label: '斗南站前店' }
];
const PUBLISHER_OPTIONS = ['麥味登西螺文昌店', '麥味登斗南站前店'];
const LEVELS = {
  urgent: { label: '重要', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  normal: { label: '一般', badge: 'bg-orange-100 text-orange-700', dot: 'bg-[#e88024]' },
  notice: { label: '通知', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-[#2f8a5b]' }
};

const PRINT_SAMPLE = {
  number: '2026-0822-001',
  announcementDate: '2026-08-22',
  effectiveDate: '2026-08-22',
  storeId: 'all',
  category: '工作規範',
  publisher: PUBLISHER_OPTIONS[0],
  priority: 'urgent',
  title: '報廢商品處理規範',
  content: '為確保商品品質及門市紀錄完整，自即日起請依下列方式處理：\n\n1. 任何製作錯誤或品質異常商品，不得自行丟棄。\n2. 應先向當班主管回報，說明品項與原因。\n3. 經主管確認後，才能依規定進行報廢。\n4. 如涉及食品安全問題，應立即停止出餐並通知主管。',
  requiresSignature: true,
  version: 1,
  attachmentName: '',
  attachmentUrl: '',
  imageData: ''
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({
  title: '',
  category: '工作規範',
  storeId: 'all',
  publisher: PUBLISHER_OPTIONS[0],
  content: '',
  announcementDate: today(),
  effectiveDate: today(),
  requiresSignature: true,
  priority: 'normal',
  pinned: false,
  attachmentName: '',
  attachmentUrl: '',
  imageData: '',
  isNew: false
});

const dateLabel = (value) => {
  if (!value) return '—';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return y && m && d ? `${y}/${m}/${d}` : value;
};

const storeLabel = (value) => STORE_OPTIONS.find((item) => item.value === value)?.label || value;

const sortTime = (value) => {
  if (value?.toDate) return value.toDate().getTime();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const snapshotVersion = (record, editor, note) => ({
  version: record.version || 1,
  title: record.title,
  category: record.category,
  storeId: record.storeId,
  content: record.content,
  announcementDate: record.announcementDate,
  effectiveDate: record.effectiveDate,
  requiresSignature: Boolean(record.requiresSignature),
  priority: record.priority,
  pinned: Boolean(record.pinned),
  attachmentName: record.attachmentName || '',
  attachmentUrl: record.attachmentUrl || '',
  imageData: record.imageData || '',
  status: record.status,
  savedAt: new Date().toISOString(),
  savedBy: editor,
  note
});

function AnnouncementPrint({ item, onBack }) {
  return (
    <div className="announcement-print-shell min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="print-toolbar max-w-[210mm] mx-auto mb-4 flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-black text-slate-600 shadow-sm">
          <ArrowLeft size={18} /> 返回公告
        </button>
        <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-white font-black shadow-lg shadow-orange-200">
          <Printer size={18} /> 列印 A4
        </button>
      </div>

      <article className="announcement-paper mx-auto overflow-hidden bg-white text-slate-900 shadow-xl">
        <div className="-mx-[17mm] -mt-[16mm] h-3 bg-[#0b5637]" />
        <header className="mt-6 flex items-center justify-between border-b border-slate-200 pb-5">
          <div>
            <img src="/mwd-logo.png" alt="麥味登 My Warm Day" className="h-14 w-auto object-contain" />
            <p className="mt-2 text-xs font-bold tracking-[0.22em] text-slate-400">西螺文昌店・斗南站前店</p>
          </div>
          <div className="text-right">
            <p className="inline-block rounded-full bg-[#0b5637] px-4 py-1.5 text-[10px] font-black tracking-[0.18em] text-white">INTERNAL NOTICE</p>
            <h1 className="mt-3 text-3xl font-black tracking-[0.16em] text-[#0b5637]">內部公告</h1>
          </div>
        </header>

        <dl className="mt-5 grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-xs">
          <div className="border-b border-r border-slate-200 p-3"><dt className="font-black text-slate-400">公告編號</dt><dd className="mt-1 font-black text-slate-800">{item.number}</dd></div>
          <div className="border-b border-r border-slate-200 p-3"><dt className="font-black text-slate-400">公告日期</dt><dd className="mt-1 font-black text-slate-800">{dateLabel(item.announcementDate)}</dd></div>
          <div className="border-b border-slate-200 p-3"><dt className="font-black text-slate-400">生效日期</dt><dd className="mt-1 font-black text-slate-800">{dateLabel(item.effectiveDate)}</dd></div>
          <div className="border-r border-slate-200 p-3"><dt className="font-black text-slate-400">適用門市</dt><dd className="mt-1 font-black text-slate-800">{storeLabel(item.storeId)}</dd></div>
          <div className="border-r border-slate-200 p-3"><dt className="font-black text-slate-400">公告分類</dt><dd className="mt-1 font-black text-slate-800">{item.category}</dd></div>
          <div className="p-3"><dt className="font-black text-slate-400">發布單位</dt><dd className="mt-1 font-black text-slate-800">{item.publisher || PUBLISHER_OPTIONS[0]}</dd></div>
        </dl>

        <section className="mt-7">
          <div className="flex items-center gap-3">
            <span className="h-9 w-1.5 rounded-full bg-[#e88024]" />
            <div>
              <p className="text-[10px] font-black tracking-[0.2em] text-[#e88024]">NOTICE SUBJECT</p>
              <h2 className="mt-0.5 text-2xl font-black text-slate-900">{item.title}</h2>
            </div>
          </div>
          <div className="announcement-print-content mt-5 whitespace-pre-wrap rounded-xl border border-slate-100 bg-white px-5 py-4 text-[15px] leading-8 text-slate-700">{item.content}</div>
          {item.imageData && <img src={item.imageData} alt="公告附件" className="mt-6 max-h-64 max-w-full object-contain" />}
          {item.attachmentUrl && <p className="mt-5 break-all text-xs">附件：{item.attachmentName || item.attachmentUrl}</p>}
        </section>

        <footer className="mt-7 text-sm">
          {item.requiresSignature && (
            <section className="signature-section mt-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-black text-[#0b5637]">員工簽名確認區</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">本人已閱讀並了解上述公告內容，請於下方空白處簽名並註明日期。</p>
                </div>
                <p className="text-[10px] font-bold text-slate-400">版本 V{item.version || 1}</p>
              </div>
              <div className="signature-blank mt-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60" />
            </section>
          )}
          {!item.requiresSignature && <p className="border-t border-slate-200 pt-3 text-right text-[10px] font-bold text-slate-400">文件版本 V{item.version || 1}</p>}
          <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-3 text-[9px] font-bold tracking-wider text-slate-400">
            <span>MY WARM DAY・INTERNAL USE ONLY</span>
            <span>{item.number}</span>
          </div>
        </footer>
      </article>
    </div>
  );
}

export default function Announcements({ db, isAdmin, onRequestAdminLogin, createRequested, onCreateRequestHandled, showMessage }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [printing, setPrinting] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(today().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState('');
  const [category, setCategory] = useState('all');
  const [store, setStore] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const deepLinkedAnnouncementId = new URLSearchParams(window.location.search).get('announcement');

  const canManage = Boolean(isAdmin);
  const editorName = isAdmin ? '系統管理員' : '';

  useEffect(() => {
    if (!canManage || !createRequested) return;
    setEditing(null);
    setForm({ ...emptyForm(), isNew: true });
    onCreateRequestHandled();
  }, [canManage, createRequested, onCreateRequestHandled]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'stores', 'shared', 'announcements'),
      (snap) => {
        const next = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        next.sort((a, b) => Number(b.pinned) - Number(a.pinned) || sortTime(b.publishedAt || b.announcementDate) - sortTime(a.publishedAt || a.announcementDate));
        setItems(next);
        setSelected((previous) => {
          if (deepLinkedAnnouncementId) return next.find((item) => item.id === deepLinkedAnnouncementId) || previous || null;
          return previous ? next.find((item) => item.id === previous.id) || null : null;
        });
        setLoading(false);
      },
      (error) => {
        console.error('讀取公告失敗:', error);
        showMessage('公告讀取失敗，請確認 Firebase 權限', 'error');
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [db, showMessage, deepLinkedAnnouncementId]);

  const itemsMatchingBasicFilters = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!showArchived && item.status === 'archived') return false;
      if (showArchived && item.status !== 'archived') return false;
      if (keyword && ![item.number, item.title, item.content, item.publisher].some((value) => String(value || '').toLowerCase().includes(keyword))) return false;
      if (category !== 'all' && item.category !== category) return false;
      if (store !== 'all' && item.storeId !== store && item.storeId !== 'all') return false;
      return true;
    });
  }, [items, query, category, store, showArchived]);

  const announcementsByDate = useMemo(() => {
    return itemsMatchingBasicFilters.reduce((groups, item) => {
      const key = String(item.announcementDate || '').slice(0, 10);
      if (key) groups[key] = [...(groups[key] || []), item];
      return groups;
    }, {});
  }, [itemsMatchingBasicFilters]);

  const calendarDays = useMemo(() => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      })
    ];
  }, [calendarMonth]);

  const changeMonth = (offset) => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + offset, 1);
    setCalendarMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
    setSelectedDate('');
  };

  const filtered = useMemo(() => {
    return selectedDate
      ? itemsMatchingBasicFilters.filter((item) => item.announcementDate === selectedDate)
      : itemsMatchingBasicFilters;
  }, [itemsMatchingBasicFilters, selectedDate]);

  const sidePanelItems = useMemo(() => {
    if (selectedDate) return itemsMatchingBasicFilters.filter((item) => item.announcementDate === selectedDate);
    return itemsMatchingBasicFilters.slice(0, 3);
  }, [itemsMatchingBasicFilters, selectedDate]);

  const openCreate = () => {
    if (!canManage) {
      onRequestAdminLogin();
      return;
    }
    setEditing(null);
    setForm({ ...emptyForm(), isNew: true });
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title || '', category: item.category || '其他', storeId: item.storeId || 'all',
      content: item.content || '', announcementDate: item.announcementDate || today(), effectiveDate: item.effectiveDate || today(),
      requiresSignature: Boolean(item.requiresSignature), priority: item.priority || 'normal', pinned: Boolean(item.pinned), publisher: item.publisher || PUBLISHER_OPTIONS[0],
      attachmentName: item.attachmentName || '', attachmentUrl: item.attachmentUrl || '', imageData: item.imageData || ''
    });
  };

  const closeEditor = () => {
    setEditing(null);
    setForm(emptyForm());
  };

  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return showMessage('請選擇圖片檔案', 'error');
    if (file.size > 450 * 1024) return showMessage('圖片請壓縮至 450KB 以下', 'error');
    const reader = new FileReader();
    reader.onload = () => setForm((value) => ({ ...value, imageData: reader.result, attachmentName: value.attachmentName || file.name }));
    reader.readAsDataURL(file);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim() || !form.announcementDate || !form.effectiveDate) {
      showMessage('請完整填寫標題、內容、公告日期與生效日期', 'error');
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (editing) {
        const history = [...(editing.versions || []), snapshotVersion(editing, editorName, '修改前版本')];
        const { isNew, ...announcementFields } = form;
        await updateDoc(doc(db, 'stores', 'shared', 'announcements', editing.id), {
          ...announcementFields,
          title: form.title.trim(), content: form.content.trim(), attachmentUrl: form.attachmentUrl.trim(), attachmentName: form.attachmentName.trim(),
          version: (editing.version || 1) + 1, versions: history, updatedAt: now, updatedBy: editorName
        });
        showMessage('公告已更新並保留舊版本', 'success');
      } else {
        const dateKey = form.announcementDate.replaceAll('-', '');
        const counterRef = doc(db, 'settings', `announcement-counter-${dateKey}`);
        const sequence = await runTransaction(db, async (transaction) => {
          const counter = await transaction.get(counterRef);
          const next = (counter.exists() ? Number(counter.data().value) : 0) + 1;
          transaction.set(counterRef, { value: next, updatedAt: now });
          return next;
        });
        const number = `${form.announcementDate.slice(0, 4)}-${form.announcementDate.slice(5, 7)}${form.announcementDate.slice(8, 10)}-${String(sequence).padStart(3, '0')}`;
        const { isNew, ...announcementFields } = form;
        await addDoc(collection(db, 'stores', 'shared', 'announcements'), {
          ...announcementFields, title: form.title.trim(), content: form.content.trim(), attachmentUrl: form.attachmentUrl.trim(), attachmentName: form.attachmentName.trim(),
          number, version: 1, versions: [], status: 'published', publisher: form.publisher, publishedAt: now, updatedAt: now
        });
        showMessage(`公告 ${number} 已發布`, 'success');
      }
      closeEditor();
    } catch (error) {
      console.error('儲存公告失敗:', error);
      showMessage('公告儲存失敗，請確認網路或 Firebase 權限', 'error');
    } finally {
      setSaving(false);
    }
  };

  const archive = async (item) => {
    if (!window.confirm(`確定作廢「${item.title}」？舊資料與版本仍會保留。`)) return;
    try {
      await updateDoc(doc(db, 'stores', 'shared', 'announcements', item.id), {
        status: 'archived', pinned: false, archivedAt: new Date().toISOString(), archivedBy: editorName,
        versions: [...(item.versions || []), snapshotVersion(item, editorName, '作廢前版本')]
      });
      setSelected(null);
      showMessage('公告已作廢並保留紀錄', 'success');
    } catch (error) {
      console.error('作廢公告失敗:', error);
      showMessage('公告作廢失敗', 'error');
    }
  };

  if (printing) return <AnnouncementPrint item={printing} onBack={() => setPrinting(null)} />;

  return (
    <div className="space-y-5 animate-in slide-in-from-top-4 duration-300">
      <section className="overflow-hidden rounded-[2rem] border border-[#cfe1d5] border-b-8 border-b-[#e88024] bg-[#edf6ef] p-6 text-[#174d37] shadow-lg sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black tracking-[0.22em] text-[#d96710]">MORNING NOTICE BOARD</p>
            <h2 className="mt-2 text-3xl font-black">公告管理</h2>
            <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-[#64806f]">發布店內規範、快速搜尋歷史公告，並列印正式 A4 簽收單。</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => setPrinting(PRINT_SAMPLE)} className="flex items-center justify-center gap-2 rounded-2xl border border-[#9fc5ad] bg-white px-5 py-3 font-black text-[#0b5637] hover:bg-[#f7fbf8]">
              <Printer size={19} /> A4 列印預覽
            </button>
            <button type="button" onClick={openCreate} className="flex items-center justify-center gap-2 rounded-2xl bg-[#e88024] px-5 py-3 font-black text-white shadow-lg shadow-[#063b27]/40 hover:bg-[#f09545]">
              <Plus size={19} /> {canManage ? '新增公告' : '管理員登入後新增'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#e7dcc3] bg-[#fffdf7] p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="relative md:col-span-2"><Search className="absolute left-3 top-3 text-[#4f7c65]" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋標題、內容、編號或發布單位" className="w-full rounded-xl border border-[#d8cfba] bg-white py-2.5 pl-10 pr-3 text-sm font-bold outline-none focus:border-[#0b5637]" /></label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold"><option value="all">全部分類</option>{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select>
          <select value={store} onChange={(e) => setStore(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold">{STORE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.value === 'all' ? '全部門市' : option.label}</option>)}</select>
        </div>

        <div className="mt-5 grid items-stretch gap-4 lg:grid-cols-2">
        <div className="w-full overflow-hidden rounded-xl border border-[#bdd7c5] bg-[#f4f8f2] text-[#174d37] shadow-sm">
          <div className="flex items-center justify-between px-2 pb-2 pt-3 sm:px-3">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="上一個月" className="rounded-lg p-1.5 text-[#4f7c65] hover:bg-[#deeee2]"><ChevronLeft size={16} /></button>
            <div className="text-center">
              <p className="text-base font-black text-[#174d37]">{calendarMonth.slice(0, 4)} 年　{Number(calendarMonth.slice(5, 7))} 月</p>
              <p className="text-[8px] font-bold text-[#789382]">亮點代表當天有公告</p>
            </div>
            <button type="button" onClick={() => changeMonth(1)} aria-label="下一個月" className="rounded-lg p-1.5 text-[#4f7c65] hover:bg-[#deeee2]"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 border-b border-[#cfe1d5] px-2 text-center text-[9px] font-black text-[#64806f]">
            {['日', '一', '二', '三', '四', '五', '六'].map((weekday, index) => <div key={weekday} className={`py-1.5 ${index === 0 || index === 6 ? 'text-slate-500' : ''}`}>{weekday}</div>)}
          </div>
          <div className="grid grid-cols-7 px-2 pb-2">
            {calendarDays.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} className="h-12 border-b border-[#dce9df]" />;
              const dateItems = announcementsByDate[date] || [];
              const count = dateItems.length;
              const active = selectedDate === date;
              const isToday = date === today();
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(active ? '' : date)}
                  aria-label={`${date}${count ? `，${count} 篇公告` : '，沒有公告'}`}
                  className="group relative flex h-12 flex-col items-center border-b border-[#dce9df] pt-1 text-xs font-black text-[#365f49] transition hover:bg-white"
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${active ? 'bg-[#e88024] text-white' : isToday ? 'ring-1 ring-[#e88024] text-[#d96710]' : ''}`}>{Number(date.slice(8, 10))}</span>
                  {count > 0 && (
                    <span className="mt-0.5 flex max-w-full items-center justify-center gap-0.5 px-0.5">
                      {dateItems.slice(0, 3).map((item, dotIndex) => (
                        <span key={`${item.id}-${dotIndex}`} className={`h-1.5 rounded-full ${dotIndex === 0 ? 'w-3' : 'w-1.5'} ${(LEVELS[item.priority] || LEVELS.normal).dot}`} />
                      ))}
                      {count > 3 && <span className="text-[7px] leading-none text-slate-400">+{count - 3}</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <aside className="rounded-xl border border-[#e7dcc3] bg-[#f8f2e5] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black tracking-widest text-[#e06f14]">{selectedDate ? 'SELECTED DATE' : 'RECENT NOTICES'}</p>
              <h3 className="mt-1 text-lg font-black text-slate-800">{selectedDate ? `${dateLabel(selectedDate)} 公告` : '最近公告'}</h3>
            </div>
            {selectedDate && <button type="button" onClick={() => setSelectedDate('')} className="text-xs font-black text-slate-400 hover:text-orange-600">清除</button>}
          </div>
          <div className="mt-4 space-y-2">
            {sidePanelItems.length ? sidePanelItems.map((item) => {
              const level = LEVELS[item.priority] || LEVELS.normal;
              return <button key={item.id} type="button" onClick={() => setSelected(item)} className="w-full rounded-xl border border-[#dfd4bd] bg-white p-3 text-left transition hover:border-[#e88024] hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${level.dot}`} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="mt-1 block text-[10px] font-bold text-slate-400">{storeLabel(item.storeId)}・{item.category}・{dateLabel(item.announcementDate)}</span></span>
                  <ArrowLeft size={14} className="mt-1 rotate-180 text-slate-300" />
                </div>
              </button>;
            }) : <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm font-bold text-slate-400">這天沒有公告</div>}
          </div>
          {sidePanelItems.length > 0 && <p className="mt-3 text-[10px] font-bold text-slate-400">點選公告可查看全文與列印預覽</p>}
        </aside>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-400">
          <span>{selectedDate ? `${dateLabel(selectedDate)}：` : ''}找到 {filtered.length} 篇公告{selectedDate && <button type="button" onClick={() => setSelectedDate('')} className="ml-2 text-orange-600">清除日期</button>}</span>
          {canManage && <button type="button" onClick={() => setShowArchived((value) => !value)} className="flex items-center gap-1 text-slate-500 hover:text-orange-600"><Archive size={14} />{showArchived ? '返回已發布公告' : '查看已作廢公告'}</button>}
        </div>
      </section>

      {loading ? <div className="rounded-3xl bg-white p-12 text-center font-bold text-slate-400">正在載入公告…</div> : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><FileText className="mx-auto text-slate-300" size={40} /><p className="mt-3 font-black text-slate-500">目前沒有符合條件的公告</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((item) => {
            const level = LEVELS[item.priority] || LEVELS.normal;
            return <article key={item.id} className={`group relative rounded-3xl border bg-[#fffdf7] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${item.pinned ? 'border-[#e88024]' : 'border-[#e7dcc3]'}`}>
              <button type="button" onClick={() => setSelected(item)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${level.badge}`}>{level.label}</span>{item.pinned && <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700"><Pin size={11} />置頂</span>}<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">{item.category}</span></div><span className="text-xs font-black text-slate-400">V{item.version || 1}</span></div>
                <h3 className="mt-4 text-xl font-black leading-snug text-[#174d37] group-hover:text-[#d96710]">{item.title}</h3>
                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-500">{item.content}</p>
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-400"><span>{item.number}</span><span className="flex items-center gap-1"><CalendarDays size={13} />{dateLabel(item.announcementDate)}</span><span>{storeLabel(item.storeId)}</span></div>
              </button>
            </article>;
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[700] overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
          <article className="mx-auto my-4 max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2 text-xs font-black text-slate-400"><span>{selected.number}</span><span>•</span><span>V{selected.version || 1}</span></div><button type="button" onClick={() => setSelected(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div>
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap gap-2"><span className={`rounded-full px-3 py-1 text-xs font-black ${(LEVELS[selected.priority] || LEVELS.normal).badge}`}>{(LEVELS[selected.priority] || LEVELS.normal).label}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{selected.category}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{storeLabel(selected.storeId)}</span>{selected.status === 'archived' && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">已作廢</span>}</div>
              <h2 className="mt-5 text-3xl font-black leading-tight text-slate-900">{selected.title}</h2>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-400"><span>公告：{dateLabel(selected.announcementDate)}</span><span>生效：{dateLabel(selected.effectiveDate)}</span><span>發布單位：{selected.publisher || PUBLISHER_OPTIONS[0]}</span></div>
              <div className="mt-7 whitespace-pre-wrap border-y border-slate-100 py-7 text-[15px] font-medium leading-8 text-slate-700">{selected.content}</div>
              {selected.imageData && <img src={selected.imageData} alt="公告附件" className="mt-6 max-h-96 rounded-2xl border border-slate-100 object-contain" />}
              {selected.attachmentUrl && <a href={selected.attachmentUrl} target="_blank" rel="noreferrer" className="mt-5 flex items-center gap-2 rounded-2xl bg-slate-50 p-4 font-black text-blue-600 hover:bg-blue-50"><Paperclip size={18} />{selected.attachmentName || '開啟附件'}<ExternalLink className="ml-auto" size={16} /></a>}
              {showVersions && <div className="mt-6 rounded-2xl bg-slate-50 p-4"><h3 className="font-black text-slate-700">版本紀錄</h3><div className="mt-3 space-y-2 text-sm font-bold text-slate-500">{[...(selected.versions || [])].reverse().map((version, index) => <div key={`${version.version}-${index}`} className="rounded-xl bg-white p-3">V{version.version}　{dateLabel(version.savedAt)}　{version.savedBy || '管理員'}　<span className="text-slate-400">{version.note}</span></div>)}<div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-orange-700">V{selected.version || 1}　目前版本</div></div></div>}
              <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" onClick={() => setPrinting(selected)} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 font-black text-white"><Printer size={18} />預覽列印</button>
                <button type="button" onClick={() => setShowVersions((value) => !value)} className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 font-black text-slate-600"><FileText size={18} />版本</button>
                {canManage && !selected.isDemo && selected.status !== 'archived' && <><button type="button" onClick={() => { openEdit(selected); setSelected(null); }} className="flex items-center gap-2 rounded-2xl bg-orange-100 px-4 py-3 font-black text-orange-700"><Edit3 size={18} />修改</button><button type="button" onClick={() => archive(selected)} className="flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 font-black text-red-600"><Archive size={18} />作廢</button></>}
              </div>
            </div>
          </article>
        </div>
      )}

      {canManage && (editing || form.isNew) && (
        <div className="fixed inset-0 z-[750] overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
          <form onSubmit={save} className="mx-auto my-4 max-w-3xl rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between"><div><p className="text-xs font-black tracking-widest text-orange-600">{editing ? `修改 ${editing.number}` : 'NEW ANNOUNCEMENT'}</p><h2 className="mt-1 text-2xl font-black text-slate-900">{editing ? '修改公告並建立新版' : '新增公告'}</h2></div><button type="button" onClick={closeEditor} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={21} /></button></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="form-label">公告標題 *</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="form-input" placeholder="例如：報廢商品處理規範" /></label>
              <label><span className="form-label">公告日期 *</span><input type="date" value={form.announcementDate} onChange={(e) => setForm({ ...form, announcementDate: e.target.value })} className="form-input" /></label>
              <label><span className="form-label">生效日期 *</span><input type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} className="form-input" /></label>
              <label><span className="form-label">分類</span><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="form-input">{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span className="form-label">適用門市</span><select value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value, publisher: e.target.value === 'storeA' ? PUBLISHER_OPTIONS[0] : e.target.value === 'storeB' ? PUBLISHER_OPTIONS[1] : form.publisher })} className="form-input">{STORE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span className="form-label">重要程度</span><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="form-input">{Object.entries(LEVELS).map(([value, detail]) => <option key={value} value={value}>{detail.label}</option>)}</select></label>
              <label><span className="form-label">發布單位</span><select value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} className="form-input">{PUBLISHER_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className="sm:col-span-2"><span className="form-label">公告內容 *</span><textarea rows="9" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="form-input resize-y" placeholder="輸入完整公告內容，可使用換行與編號。" /></label>
              <label><span className="form-label">附件名稱</span><input value={form.attachmentName} onChange={(e) => setForm({ ...form, attachmentName: e.target.value })} className="form-input" placeholder="例如：作業流程 PDF" /></label>
              <label><span className="form-label">附件連結</span><input type="url" value={form.attachmentUrl} onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })} className="form-input" placeholder="https://…" /></label>
              <label className="sm:col-span-2"><span className="form-label">公告圖片（450KB 以下）</span><div className="mt-1 flex items-center gap-3"><label className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-200"><ImageIcon size={17} />選擇圖片<input type="file" accept="image/*" onChange={handleImage} className="hidden" /></label>{form.imageData && <button type="button" onClick={() => setForm({ ...form, imageData: '' })} className="text-xs font-black text-red-500">移除圖片</button>}</div></label>
              <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-black text-slate-700"><input type="checkbox" checked={form.requiresSignature} onChange={(e) => setForm({ ...form, requiresSignature: e.target.checked })} className="h-5 w-5 accent-orange-600" />需要員工紙本簽名</label>
              <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-black text-slate-700"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="h-5 w-5 accent-orange-600" />置頂顯示</label>
            </div>
            <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={closeEditor} className="rounded-2xl bg-slate-100 px-5 py-3 font-black text-slate-600">取消</button><button disabled={saving} className="rounded-2xl bg-orange-600 px-6 py-3 font-black text-white disabled:opacity-50">{saving ? '儲存中…' : editing ? '儲存新版' : '發布公告'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
