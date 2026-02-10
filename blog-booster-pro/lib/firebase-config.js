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
      // 이미 초기화된 앱이 있는지 확인
      try {
        firebaseApp = firebase.app();
      } catch (e) {
        firebaseApp = firebase.initializeApp(firebaseConfig);
      }
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
  if (!initializeFirebase()) return { success: false, error: 'Firebase 초기화에 실패했습니다. 잠시 후 다시 시도해주세요.' };

  try {
    const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // 프로필 업데이트 (닉네임을 displayName으로 사용)
    try {
      await user.updateProfile({ displayName: nickname });
    } catch (profileError) {
      console.warn('[Firebase] 프로필 업데이트 실패:', profileError.message);
    }

    // Firestore에 사용자 정보 저장 (실패해도 회원가입 자체는 성공으로 처리)
    try {
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
    } catch (firestoreError) {
      console.warn('[Firebase] Firestore 사용자 정보 저장 실패 (회원가입은 성공):', firestoreError.message);
    }

    return { success: true, user: user };
  } catch (error) {
    console.error('[Firebase] 회원가입 오류:', error);
    return { success: false, error: getErrorMessage(error.code) };
  }
}

// 로그인
async function signIn(email, password) {
  if (!initializeFirebase()) return { success: false, error: 'Firebase 초기화에 실패했습니다. 잠시 후 다시 시도해주세요.' };

  try {
    const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // 마지막 로그인 시간 업데이트 (실패해도 로그인 자체는 성공으로 처리)
    try {
      await firebaseDb.collection('users').doc(user.uid).update({
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (firestoreError) {
      console.warn('[Firebase] Firestore 업데이트 실패 (로그인은 성공):', firestoreError.message);
    }

    return { success: true, user: user };
  } catch (error) {
    console.error('[Firebase] 로그인 오류:', error);
    return { success: false, error: getErrorMessage(error.code) };
  }
}

// 로그아웃
async function signOut() {
  if (!initializeFirebase()) return { success: false, error: 'Firebase 초기화 실패' };

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
  if (!initializeFirebase()) return { success: false, error: 'Firebase 초기화에 실패했습니다.' };

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
  if (!initializeFirebase()) return { success: false, error: 'Firebase 초기화 실패' };

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
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/invalid-login-credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/too-many-requests': '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
    'auth/network-request-failed': '네트워크 오류가 발생했습니다.',
    'auth/popup-closed-by-user': '로그인이 취소되었습니다.',
    'auth/internal-error': '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
  };
  return messages[errorCode] || `오류가 발생했습니다. (${errorCode || 'unknown'})`;
}

// 로그인 상태를 Chrome Storage에 동기화
async function syncAuthState() {
  const user = getCurrentUser();
  if (user) {
    console.log('[syncAuthState] 시작 - uid:', user.uid, 'email:', user.email);

    // 기존 저장된 플랜을 먼저 읽어서, Firestore 조회 실패 시 보존
    let existingPlan = 'free';
    try {
      const existing = await chrome.storage.local.get(['userInfo']);
      if (existing.userInfo && existing.userInfo.plan) {
        existingPlan = existing.userInfo.plan;
      }
    } catch (e) { /* ignore */ }
    console.log('[syncAuthState] 기존 플랜:', existingPlan);

    // ID 토큰 가져오기 (최대 2번 시도)
    let idToken = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        idToken = await user.getIdToken(attempt > 0); // 두 번째 시도에서 force refresh
        if (idToken) {
          console.log('[syncAuthState] ID 토큰 획득 (시도 ' + (attempt + 1) + ')');
          break;
        }
      } catch (tokenError) {
        console.warn('[syncAuthState] ID 토큰 가져오기 실패 (시도 ' + (attempt + 1) + '):', tokenError.message);
      }
    }

    // 방법 1: Firebase SDK로 플랜 읽기
    let plan = existingPlan;
    let planFetched = false;
    try {
      const userData = await getUserData(user.uid);
      if (userData.success && userData.data) {
        plan = userData.data.plan || 'free';
        planFetched = true;
        console.log('[syncAuthState] SDK 플랜 확인:', plan);
      } else {
        console.warn('[syncAuthState] SDK 유저 데이터 없음:', userData.error);
      }
    } catch (e) {
      console.warn('[syncAuthState] SDK 플랜 조회 실패:', e.message);
    }

    // 방법 2: SDK 실패 시 REST API로 직접 읽기
    if (!planFetched && idToken) {
      try {
        const projectId = firebaseConfig.projectId;
        const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${user.uid}`;
        const resp = await fetch(restUrl, {
          headers: { 'Authorization': 'Bearer ' + idToken }
        });
        console.log('[syncAuthState] REST API 응답:', resp.status);
        if (resp.ok) {
          const doc = await resp.json();
          if (doc.fields && doc.fields.plan && doc.fields.plan.stringValue) {
            plan = doc.fields.plan.stringValue;
            planFetched = true;
            console.log('[syncAuthState] REST API 플랜 확인:', plan);
          } else {
            console.warn('[syncAuthState] REST API 응답에 plan 필드 없음:', JSON.stringify(doc.fields ? Object.keys(doc.fields) : 'no fields'));
          }
        } else {
          const errText = await resp.text().catch(() => '');
          console.warn('[syncAuthState] REST API 실패: status', resp.status, errText.substring(0, 200));
        }
      } catch (e) {
        console.warn('[syncAuthState] REST API 오류:', e.message);
      }
    }

    console.log('[syncAuthState] 최종 플랜:', plan, '(fetched:', planFetched, ', token:', idToken ? '있음' : '없음', ')');

    await chrome.storage.local.set({
      isLoggedIn: true,
      userInfo: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        plan: plan
      },
      firebaseIdToken: idToken,
      firebaseRefreshToken: user.refreshToken || null,
      firebaseTokenTimestamp: Date.now()
    });

    console.log('[syncAuthState] 저장 완료');
  } else {
    console.log('[syncAuthState] 로그아웃 상태');
    await chrome.storage.local.set({
      isLoggedIn: false,
      userInfo: null,
      firebaseIdToken: null,
      firebaseRefreshToken: null,
      firebaseTokenTimestamp: null
    });
  }
}

// ID 토큰 갱신 (1시간마다 만료됨)
async function refreshIdToken() {
  const user = getCurrentUser();
  if (user) {
    try {
      const idToken = await user.getIdToken(true);
      await chrome.storage.local.set({
        firebaseIdToken: idToken,
        firebaseRefreshToken: user.refreshToken || null,
        firebaseTokenTimestamp: Date.now()
      });
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
