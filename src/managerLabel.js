const WENCHANG_MANAGER_LABEL = '西螺文昌店長';

// A role label is separate from the employee's real name and account key.
export const getManagerLabel = (manager, fallback = '店長') => {
  if (manager?.key === 'managerA' || manager?.storeId === 'storeA') return WENCHANG_MANAGER_LABEL;
  return manager?.name || fallback;
};

export const getPointOperatorLabel = (record, fallback = '店長') => {
  const key = record?.operatorKey || record?.requestedByKey;
  const original = record?.operator || record?.requestedBy || '';
  if (key === 'managerA') return WENCHANG_MANAGER_LABEL;
  // Keep existing administrator and other-store identities unchanged.
  if (key === 'admin' || key === 'managerB') return original || fallback;
  if (/^石淯鈴(?:店長)?$/.test(String(original).replace(/\s/g, ''))) return WENCHANG_MANAGER_LABEL;
  return original || fallback;
};
