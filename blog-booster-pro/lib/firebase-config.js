/**
 * 블로그 부스터 Pro - Firebase 설정
 *
 * 사용 전 아래 firebaseConfig 값을 실제 Firebase 프로젝트 설정으로 교체하세요.
 * Firebase Console > 프로젝트 설정 > 일반 > 내 앱 > 웹 앱에서 확인 가능
 */

// Firebase 설정 (env-config.js에서 로드)
const firebaseConfig = ENV_CONFIG.firebase;

// 관리자 이메일
const ADMIN_EMAIL = ENV_CONFIG.adminEmail;

// Firebase 앱 초기화
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

// Firebase SDK 로드 확인
function isFirebaseLoaded() {
  return typeof firebase !== 'undefined';
}

// Firebase 초기화
function initializeFirebase() {
  if (!isFirebaseLoaded()) {
    console.error('[Firebase] SDK가 로드되지 않았습니다.');
    return false;
  }

  if (!firebaseApp) {
    try {
      firebaseApp = firebase.initializeApp(firebaseConfig);
      firebaseAuth = firebase.auth();
      firebaseDb = firebase.firestore();
      console.log('[Firebase] 초기화 완료');
      return true;
    } catch (error) {
      console.error('[Firebase] 초기화 오류:', error);
      return false;
    }
  }
  return true;
}

// ==================== 인증 함수 ====================

// 회원가입
async function signUp(email, password, name, nickname) {
  if (!initializeFirebase()) throw new Error('Firebase 초기화 실패');

  try {
    const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // 프로필 업데이트 (닉네임을 displayName으로 사용)
    await user.updateProfile({ displayName: nickname });

    // Firestore에 사용자 정보 저장
    await firebaseDb.collection('users').doc(user.uid).set({
      email: email,
      name: name,
      nickname: nickname,
      displayName: nickname,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
      plan: 'free',
      usageCount: 0,
      isActive: true
    });

    return { success: true, user: user };
  } catch (error) {
    console.error('[Firebase] 회원가입 오류:', error);
    return { success: false, error: getErrorMessage(error.code) };
  }
}

// 로그인
async function signIn(email, password) {
  if (!initializeFirebase()) throw new Error('Firebase 초기화 실패');

  try {
    const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // 마지막 로그인 시간 업데이트
    await firebaseDb.collection('users').doc(user.uid).update({
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, user: user };
  } catch (error) {
    console.error('[Firebase] 로그인 오류:', error);
    return { success: false, error: getErrorMessage(error.code) };
  }
}

// 로그아웃
async function signOut() {
  if (!initializeFirebase()) throw new Error('Firebase 초기화 실패');

  try {
    await firebaseAuth.signOut();
    return { success: true };
  } catch (error) {
    console.error('[Firebase] 로그아웃 오류:', error);
    return { success: false, error: error.message };
  }
}

// 현재 사용자 가져오기
function getCurrentUser() {
  if (!initializeFirebase()) return null;
  return firebaseAuth.currentUser;
}

// 인증 상태 변경 리스너
function onAuthStateChanged(callback) {
  if (!initializeFirebase()) return null;
  return firebaseAuth.onAuthStateChanged(callback);
}

// 비밀번호 재설정 이메일 전송
async function sendPasswordReset(email) {
  if (!initializeFirebase()) throw new Error('Firebase 초기화 실패');

  try {
    await firebaseAuth.sendPasswordResetEmail(email);
    return { success: true };
  } catch (error) {
    console.error('[Firebase] 비밀번호 재설정 오류:', error);
    return { success: false, error: getErrorMessage(error.code) };
  }
}

// ==================== 사용자 데이터 함수 ====================

// 사용자 정보 가져오기
async function getUserData(uid) {
  if (!initializeFirebase()) throw new Error('Firebase 초기화 실패');

  try {
    const doc = await firebaseDb.collection('users').doc(uid).get();
    if (doc.exists) {
      return { success: true, data: doc.data() };
    } else {
      return { success: false, error: '사용자 정보를 찾을 수 없습니다.' };
    }
  } catch (error) {
    console.error('[Firebase] 사용자 정보 조회 오류:', error);
    return { success: false, error: error.message };
  }
}

// 사용 기록 저장
async function logUsage(uid, action, details = {}) {
  if (!initializeFirebase()) return;

  try {
    // 사용 기록 추가
    await firebaseDb.collection('usageLogs').add({
      uid: uid,
      action: action,
      details: details,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 사용 횟수 증가
    await firebaseDb.collection('users').doc(uid).update({
      usageCount: firebase.firestore.FieldValue.increment(1)
    });
  } catch (error) {
    console.error('[Firebase] 사용 기록 저장 오류:', error);
  }
}

// ==================== 관리자 함수 ====================

// 관리자 여부 확인
function isAdmin(email) {
  return email === ADMIN_EMAIL;
}

// 모든 사용자 목록 가져오기 (관리자용)
async function getAllUsers() {
  if (!initializeFirebase()) throw new Error('Firebase 초기화 실패');

  const currentUser = getCurrentUser();
  if (!currentUser || !isAdmin(currentUser.email)) {
    return { success: false, error: '관리자 권한이 필요합니다.' };
  }

  try {
    const snapshot = await firebaseDb.collection('users')
      .orderBy('createdAt', 'desc')
      .get();

    const users = [];
    snapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });

    return { success: true, data: users };
  } catch (error) {
    console.error('[Firebase] 사용자 목록 조회 오류:', error);
    return { success: false, error: error.message };
  }
}

// 사용 통계 가져오기 (관리자용)
async function getUsageStats() {
  if (!initializeFirebase()) throw new Error('Firebase 초기화 실패');

  const currentUser = getCurrentUser();
  if (!currentUser || !isAdmin(currentUser.email)) {
    return { success: false, error: '관리자 권한이 필요합니다.' };
  }

  try {
    // 총 사용자 수
    const usersSnapshot = await firebaseDb.collection('users').get();
    const totalUsers = usersSnapshot.size;

    // 오늘 활성 사용자
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeSnapshot = await firebaseDb.collection('users')
      .where('lastLoginAt', '>=', today)
      .get();
    const activeToday = activeSnapshot.size;

    // 최근 7일 사용 기록
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const logsSnapshot = await firebaseDb.collection('usageLogs')
      .where('timestamp', '>=', weekAgo)
      .get();
    const weeklyUsage = logsSnapshot.size;

    return {
      success: true,
      data: {
        totalUsers,
        activeToday,
        weeklyUsage
      }
    };
  } catch (error) {
    console.error('[Firebase] 통계 조회 오류:', error);
    return { success: false, error: error.message };
  }
}

// ==================== 유틸리티 함수 ====================

// 오류 메시지 변환
function getErrorMessage(errorCode) {
  const messages = {
    'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
    'auth/invalid-email': '유효하지 않은 이메일 형식입니다.',
    'auth/operation-not-allowed': '이메일/비밀번호 로그인이 비활성화되어 있습니다.',
    'auth/weak-password': '비밀번호가 너무 약합니다. (6자 이상)',
    'auth/user-disabled': '비활성화된 계정입니다.',
    'auth/user-not-found': '등록되지 않은 이메일입니다.',
    'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
    'auth/too-many-requests': '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
    'auth/network-request-failed': '네트워크 오류가 발생했습니다.'
  };
  return messages[errorCode] || '오류가 발생했습니다.';
}

// 로그인 상태를 Chrome Storage에 동기화
async function syncAuthState() {
  const user = getCurrentUser();
  if (user) {
    const userData = await getUserData(user.uid);

    // ID 토큰 가져와서 저장 (서비스 워커에서 Firebase API 호출용)
    let idToken = null;
    try {
      idToken = await user.getIdToken(true);
    } catch (tokenError) {
      console.error('[Firebase] ID 토큰 가져오기 실패:', tokenError);
    }

    await chrome.storage.local.set({
      isLoggedIn: true,
      userInfo: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        plan: userData.data?.plan || 'free'
      },
      firebaseIdToken: idToken
    });
  } else {
    await chrome.storage.local.set({
      isLoggedIn: false,
      userInfo: null,
      firebaseIdToken: null
    });
  }
}

// ID 토큰 갱신 (1시간마다 만료됨)
async function refreshIdToken() {
  const user = getCurrentUser();
  if (user) {
    try {
      const idToken = await user.getIdToken(true);
      await chrome.storage.local.set({ firebaseIdToken: idToken });
      return idToken;
    } catch (error) {
      console.error('[Firebase] 토큰 갱신 실패:', error);
      return null;
    }
  }
  return null;
}

// 전역 내보내기
window.FirebaseAuth = {
  initializeFirebase,
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  onAuthStateChanged,
  sendPasswordReset,
  getUserData,
  logUsage,
  isAdmin,
  getAllUsers,
  getUsageStats,
  syncAuthState,
  refreshIdToken,
  ADMIN_EMAIL
};
