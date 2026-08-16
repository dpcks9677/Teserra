import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, deleteField, serverTimestamp, collection, query, where, orderBy, limit, getDocs, runTransaction } from "firebase/firestore";
import { app, db } from "./firebaseConfig.js";
import { getAchievementDefinition } from "./augmentProgress.js";

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export function subscribeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-in Error:", error);
    throw error;
  }
}

export async function setNickname(user, nickname) {
  try {
    await updateProfile(user, { displayName: nickname });
    return true;
  } catch (error) {
    console.error("Update Profile Error:", error);
    throw error;
  }
}

export async function saveUserToDB(uid, nickname) {
  try {
    const userRef = doc(db, "users", uid);
    // 기존 데이터 유지하되, nickname은 무조건 덮어씌움.
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
      await setDoc(userRef, {
        nickname: nickname,
        statusMsg: "안녕하세요! 주사위 굴리러 왔습니다.",
        createdAt: serverTimestamp(),
        profileViews: 0
      });
    } else {
      await setDoc(userRef, { nickname: nickname }, { merge: true });
    }
  } catch (error) {
    console.error("Firestore Save Error:", error);
    throw error;
  }
}

export async function updateUserStatusMsg(uid, newMsg) {
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, { statusMsg: newMsg }, { merge: true });
    return true;
  } catch (error) {
    console.error("Status Update Error:", error);
    return false;
  }
}

export async function getUserFromDB(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error("Firestore Get Error:", error);
    return null;
  }
}

export async function searchUsersByNickname(keyword, { limitResults = null } = {}) {
  const normalized = String(keyword || '').trim().slice(0, 30);
  if (!normalized) return [];
  try {
    const usersRef = collection(db, "users");
    const queryConstraints = [
      where("nickname", ">=", normalized),
      where("nickname", "<=", `${normalized}\uf8ff`),
      orderBy("nickname")
    ];
    if (Number.isInteger(limitResults) && limitResults > 0) queryConstraints.push(limit(limitResults));
    const usersQuery = query(usersRef, ...queryConstraints);
    const snapshot = await getDocs(usersQuery);
    const orderedUsers = snapshot.docs
      .map((userDoc) => ({ uid: userDoc.id, ...userDoc.data() }))
      .sort((a, b) => {
        const aName = String(a.nickname || '');
        const bName = String(b.nickname || '');
        return (aName === normalized ? -1 : 0) - (bName === normalized ? -1 : 0)
          || aName.length - bName.length
          || aName.localeCompare(bName);
      });
    return Number.isInteger(limitResults) && limitResults > 0
      ? orderedUsers.slice(0, limitResults)
      : orderedUsers;
  } catch (error) {
    console.error("User Search Error:", error);
    throw error;
  }
}

export async function incrementProfileViews(uid) {
  if (!uid || !auth.currentUser || auth.currentUser.uid === uid) return false;
  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", uid);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) return;
      transaction.update(userRef, {
        profileViews: (Number(userSnap.data().profileViews) || 0) + 1
      });
    });
    return true;
  } catch (error) {
    console.error("Profile view update failed:", error);
    return false;
  }
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function normalizeUserUid(value) {
  if (!value || typeof value !== 'string' || value.startsWith('guest')) return null;
  return value.split('_')[0];
}

export async function signOutUser() {
  try {
    localStorage.removeItem('ad_logged_in');
    await auth.signOut();
  } catch (error) {
    console.error("Sign Out Error:", error);
  }
}

export async function updateUserAvatar(uid, avatarUrl, cropData) {
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, { avatarUrl, cropData }, { merge: true });
    return true;
  } catch (error) {
    console.error("Avatar Update Error:", error);
    return false;
  }
}

export async function updateUserActiveGame(uid, roomId, mode) {
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, { activeRoomId: roomId, activeGameMode: mode }, { merge: true });
    return true;
  } catch (error) {
    console.error("Active Game Update Error:", error);
    return false;
  }
}

export async function clearUserActiveGame(uid) {
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, { activeRoomId: null, activeGameMode: null }, { merge: true });
    return true;
  } catch (error) {
    console.error("Clear Active Game Error:", error);
    return false;
  }
}

export async function getUserMatchesFromDB(uid) {
  if (!uid) return [];
  try {
    const matchesRef = collection(db, "matches");
    const cleanUid = (typeof uid === 'string' && !uid.startsWith('guest')) ? uid.split('_')[0] : uid;

    let q;
    try {
      q = query(matchesRef, where("playerUids", "array-contains", cleanUid), orderBy("timestamp", "desc"), limit(20));
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      return list;
    } catch (indexErr) {
      console.warn("Firestore index missing, falling back to client sort:", indexErr);
      q = query(matchesRef, where("playerUids", "array-contains", cleanUid), limit(100));
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => {
        const tA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        const tB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
        return tB - tA;
      });
      return list.slice(0, 20);
    }
  } catch (error) {
    console.error("Fetch Matches Error:", error);
    return [];
  }
}

export async function saveAugmentProgress(uid, session) {
  if (!uid || !session?.sessionId || session.saved) return false;
  const userRef = doc(db, "users", uid);
  const receiptRef = doc(db, "users", uid, "augmentStatReceipts", session.sessionId);

  const saved = await runTransaction(db, async (transaction) => {
    const [receiptSnap, userSnap] = await Promise.all([
      transaction.get(receiptRef),
      transaction.get(userRef)
    ]);
    if (receiptSnap.exists() || !userSnap.exists()) return false;

    const userData = userSnap.data();
    const stats = userData.stats || {};
    const augmentStats = { ...(stats.augmentStats || {}) };
    const achievements = { ...(userData.achievements || {}) };
    const selectedIds = new Set(Object.keys(session.selections || {}));
    const augmentIds = new Set([
      ...Object.keys(session.appearances || {}),
      ...selectedIds,
      ...Object.keys(session.metrics || {})
    ]);
    const completedAt = new Date().toISOString();
    const updatedAt = completedAt;

    augmentIds.forEach((augmentId) => {
      const old = augmentStats[augmentId] || {};
      const completedSelections = (old.completedSelections || 0) + (selectedIds.has(augmentId) ? 1 : 0);
      const metrics = { ...(old.metrics || {}) };
      Object.entries(session.metrics?.[augmentId] || {}).forEach(([key, value]) => {
        metrics[key] = (metrics[key] || 0) + value;
      });
      augmentStats[augmentId] = {
        ...old,
        appearances: (old.appearances || 0) + (session.appearances[augmentId] || 0),
        selections: (old.selections || 0) + (session.selections[augmentId] || 0),
        completedSelections,
        metrics,
        updatedAt
      };

      const achievementId = `augment-mastery:${augmentId}`;
      const oldAchievement = achievements[achievementId] || {};
      const masteryProgress = Math.min(10, completedSelections);
      achievements[achievementId] = {
        ...oldAchievement,
        current: masteryProgress,
        progress: masteryProgress,
        target: 10,
        completed: masteryProgress >= 10,
        completedAt: oldAchievement.completedAt || (masteryProgress >= 10 ? completedAt : null)
      };
    });

    Object.entries(session.achievements || {}).forEach(([achievementId, amount]) => {
      const definition = getAchievementDefinition(achievementId);
      if (!definition) return;
      const oldAchievement = achievements[achievementId] || {};
      const progress = Math.min(definition.target, (oldAchievement.current ?? oldAchievement.progress ?? 0) + amount);
      achievements[achievementId] = {
        ...oldAchievement,
        current: progress,
        progress,
        target: definition.target,
        completed: progress >= definition.target,
        completedAt: oldAchievement.completedAt || (progress >= definition.target ? completedAt : null)
      };
    });

    transaction.update(userRef, {
      stats: { ...stats, augmentStatsVersion: 1, augmentStats },
      achievements
    });
    transaction.set(receiptRef, { createdAt: serverTimestamp() });
    return true;
  });

  session.saved = saved;
  return saved;
}

export async function resetAugmentProgress(uid) {
  if (!uid) return false;
  await updateDoc(doc(db, "users", uid), {
    achievements: deleteField(),
    "stats.augmentStats": deleteField(),
    "stats.augmentStatsVersion": deleteField()
  });
  return true;
}
