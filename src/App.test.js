import {createPointSubmission,readPendingPoint,pendingPointKey,submitPointOnce} from './pointSubmission';
const input={uid:'test-user',storeId:'storeA',collection:'logs',payload:{empId:'TEST',amount:-1}};
test('pending operation survives reload and keeps the same original payload',()=>{
 const original=createPointSubmission(input,'original-operation-1234');
 const values=new Map([[pendingPointKey(input.uid),JSON.stringify(original)]]);
 expect(readPendingPoint({getItem:k=>values.get(k)},input.uid)).toEqual(original);
 expect(readPendingPoint({getItem:()=>null},'other')).toBeNull();
});
test('lost response retry recovers one saved log, not a second deduction',async()=>{
 let saved=null,writes=0;
 const dependencies={ref:path=>path,transaction:async cb=>cb({get:async()=>({exists:()=>!!saved,data:()=>saved}),set:(_ref,value)=>{saved=value;writes++;}})};
 const original=createPointSubmission(input,'original-operation-1234');
 await submitPointOnce(original,dependencies);
 expect((await submitPointOnce(original,dependencies)).alreadySaved).toBe(true);
 expect(writes).toBe(1);
 await expect(submitPointOnce({...original,fingerprint:'changed'},dependencies)).rejects.toThrow('不一致');
});
test('manager submission is stored separately and remains pending',async()=>{
 let path,record;
 const original=createPointSubmission({...input,collection:'pointRequests',payload:{...input.payload,status:'pending'}},'manager-operation-1234');
 await submitPointOnce(original,{ref:value=>{path=value;return value;},transaction:async cb=>cb({get:async()=>({exists:()=>false}),set:(_ref,value)=>{record=value;}})});
 expect(path).toContain('/pointRequests/');expect(record.status).toBe('pending');
});
