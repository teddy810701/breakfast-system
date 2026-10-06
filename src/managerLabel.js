const WENCHANG_MANAGER_LABEL = '西螺文昌店長';
const DOUNAN_MANAGER_LABEL = '斗南站前店長';

// A role label is separate from the employee's real name and account key.
export const getManagerLabel = (manager, fallback = '店長') => {
  if (manager?.key === 'managerA' || manager?.storeId === 'storeA') return WENCHANG_MANAGER_LABEL;
  if (manager?.key === 'managerB' || manager?.storeId === 'storeB') return DOUNAN_MANAGER_LABEL;
  return manager?.name || fallback;
};

export const getPointOperatorLabel = (record, fallback = '店長') => {
  const key = record?.operatorKey || record?.requestedByKey;
  const original = record?.operator || record?.requestedBy || '';
  if (key === 'managerA') return WENCHANG_MANAGER_LABEL;
  if (key === 'managerB') return DOUNAN_MANAGER_LABEL;
  // Keep the administrator identity unchanged; historical names are display-only.
  if (key === 'admin') return original || fallback;
  const legacyLabel = String(original).replace(/\s/g, '');
  if (/^石淯鈴(?:店長)?$/.test(legacyLabel)) return WENCHANG_MANAGER_LABEL;
  if (/^(?:店長B|蔡梅楨(?:(?:代理)?店長)?)$/.test(legacyLabel)) return DOUNAN_MANAGER_LABEL;
  return original || fallback;
};
