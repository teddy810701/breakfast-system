// Keep the immutable submission until its database receipt is confirmed.
export const pendingPointKey = uid => `breakfast-pending-point-v1:${uid}`;
export const readPendingPoint = (storage, uid) => {
  if (!uid) return null;
  const raw = storage.getItem(pendingPointKey(uid));
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value.uid !== uid || !/^[A-Za-z0-9-]{10,80}$/.test(value.operationId) || !['logs','pointRequests'].includes(value.collection) || !['storeA','storeB'].includes(value.storeId)) throw new Error('待確認資料格式錯誤，請聯絡管理員');
  return value;
};
export const createPointSubmission = ({uid,storeId,collection,payload}, operationId) => ({uid,storeId,collection,payload,operationId,fingerprint:JSON.stringify(payload)});
export const submitPointOnce = async (submission, {transaction,ref}) => {
  const receipt = ref(`stores/${submission.storeId}/${submission.collection}/web_${submission.uid}_${submission.operationId}`);
  return transaction(async tx => {
    const previous = await tx.get(receipt);
    if (previous.exists()) {
      if (previous.data().submissionFingerprint !== submission.fingerprint || previous.data().submissionUid !== submission.uid) throw new Error('送出內容與原始資料不一致');
      return {alreadySaved:true};
    }
    tx.set(receipt,{...submission.payload,submissionUid:submission.uid,submissionOperationId:submission.operationId,submissionFingerprint:submission.fingerprint});
    return {alreadySaved:false};
  });
};
