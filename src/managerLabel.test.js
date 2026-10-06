import {getManagerLabel, getPointOperatorLabel} from './managerLabel';

test('Wenchang manager label never uses the employee name or changes account metadata', () => {
  const manager = {key:'managerA', storeId:'storeA', name:'石淯鈴店長'};
  expect(getManagerLabel(manager)).toBe('西螺文昌店長');
  expect(getManagerLabel({...manager,name:'未來新任店長'})).toBe('西螺文昌店長');
  expect(manager).toEqual({key:'managerA',storeId:'storeA',name:'石淯鈴店長'});
  expect(getManagerLabel(null,'管理員')).toBe('管理員');
  expect(getManagerLabel({key:'managerB',storeId:'storeB',name:'斗南原店長'})).toBe('斗南站前店長');
});

test('deduction, approval and historical operator displays use the role alias without editing records', () => {
  const log = {operator:'石淯鈴店長',operatorKey:'managerA',name:'石淯鈴',amount:-1};
  const before = JSON.stringify(log);
  expect(getPointOperatorLabel(log)).toBe('西螺文昌店長');
  expect(getPointOperatorLabel({requestedBy:'石淯鈴',requestedByKey:'managerA'})).toBe('西螺文昌店長');
  expect(getPointOperatorLabel({operator:'石淯鈴店長',operatorKey:'app-user-uid'})).toBe('西螺文昌店長');
  expect(getPointOperatorLabel({operator:'石淯鈴 店長'})).toBe('西螺文昌店長');
  expect(JSON.stringify(log)).toBe(before);
  expect(log.name).toBe('石淯鈴');
  expect(getPointOperatorLabel({operator:'管理員',operatorKey:'admin',operatorStoreId:'storeA'})).toBe('管理員');
  expect(getPointOperatorLabel({operator:'其他店長',operatorKey:'managerB'})).toBe('斗南站前店長');
});

test('Dounan manager, new requests and old logs display the store role while keeping employee names', () => {
  const manager = {key:'managerB',storeId:'storeB',name:'店長B'};
  expect(getManagerLabel(manager)).toBe('斗南站前店長');
  expect(getManagerLabel({...manager,name:'未來新任店長'})).toBe('斗南站前店長');
  expect(manager.name).toBe('店長B');
  expect(getPointOperatorLabel({requestedBy:'蔡梅楨',requestedByKey:'managerB'})).toBe('斗南站前店長');
  for (const operator of ['店長B','蔡梅楨','蔡梅楨店長','蔡梅楨代理店長']) {
    const log = {operator,operatorKey:'app-manager-uid',name:'蔡梅楨',amount:-1};
    const before = JSON.stringify(log);
    expect(getPointOperatorLabel(log)).toBe('斗南站前店長');
    expect(JSON.stringify(log)).toBe(before);
  }
  expect(getPointOperatorLabel({operator:'管理員',operatorKey:'admin',operatorStoreId:'storeB'})).toBe('管理員');
});
