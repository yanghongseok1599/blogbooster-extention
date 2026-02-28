/**
 * 블로그 부스터 Pro - 웹 로그인/회원가입
 * Vercel 배포용 (Firebase 직접 연동)
 */

const firebaseConfig = {
  apiKey: "AIzaSyCsGfW7kYFkTMk-ggAfA3f-rEPagjo9qP4",
  authDomain: "blogbooster-ebac0.firebaseapp.com",
  projectId: "blogbooster-ebac0",
  storageBucket: "blogbooster-ebac0.firebasestorage.app",
  messagingSenderId: "5339252490",
  appId: "1:5339252490:web:0339b7d5b40b6b43eb1cf3"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 마이페이지 URL (같은 Vercel 도메인 또는 별도 배포)
const MYPAGE_URL = 'https://mypage-web.vercel.app';

document.addEventListener('DOMContentLoaded', function() {
  // DOM 요소
  const tabBtns = document.querySelectorAll('.tab-btn');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const resetForm = document.getElementById('resetForm');
  const forgotPassword = document.getElementById('forgotPassword');
  const backToLogin = document.getElementById('backToLogin');
  const authMessage = document.getElementById('authMessage');

  // 프로모션 코드 관련
  const promoCodeInput = document.getElementById('promoCode');
  const promoCheckBtn = document.getElementById('promoCheckBtn');
  const promoResult = document.getElementById('promoResult');

  let currentForm = 'login';
  let validatedPromoCode = null;

  // 이미 로그인 상태면 마이페이지로 이동
  auth.onAuthStateChanged(user => {
    if (user) {
      window.location.href = MYPAGE_URL;
    }
  });

  // 탭 전환
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  function switchTab(tab) {
    currentForm = tab;
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelector('.auth-tabs').style.display = 'flex';
    loginForm.classList.toggle('active', tab === 'login');
    signupForm.classList.toggle('active', tab === 'signup');
    resetForm.classList.remove('active');
    hideMessage();
  }

  // 비밀번호 재설정 폼 표시
  forgotPassword.addEventListener('click', (e) => {
    e.preventDefault();
    currentForm = 'reset';
    document.querySelector('.auth-tabs').style.display = 'none';
    loginForm.classList.remove('active');
    signupForm.classList.remove('active');
    resetForm.classList.add('active');
    hideMessage();
  });

  backToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('login');
  });

  // 로그인
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      showMessage('error', '이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(loginForm, true);

    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      // Firestore 문서 확인 및 업데이트
      try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          await db.collection('users').doc(user.uid).update({
            lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // 회원가입 시 Firestore 저장 실패한 경우 → 자동 생성
          await db.collection('users').doc(user.uid).set({
            email: user.email,
            name: user.displayName || user.email.split('@')[0],
            nickname: user.displayName || user.email.split('@')[0],
            displayName: user.displayName || user.email.split('@')[0],
            plan: 'free',
            planExpiry: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
            usageCount: 0
          });
        }
      } catch (e) { console.warn('Firestore 업데이트 실패:', e.message); }
      window.location.href = MYPAGE_URL;
    } catch (error) {
      showMessage('error', getAuthError(error.code));
    } finally {
      setLoading(loginForm, false);
    }
  });

  // 회원가입
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('signupName').value.trim();
    const nickname = document.getElementById('signupNickname').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;

    if (!name || !nickname || !email || !password || !passwordConfirm) {
      showMessage('error', '모든 필드를 입력해주세요.');
      return;
    }
    if (password !== passwordConfirm) {
      showMessage('error', '비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 6) {
      showMessage('error', '비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (!agreeTerms) {
      showMessage('error', '이용약관에 동의해주세요.');
      return;
    }

    setLoading(signupForm, true);

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // displayName 설정
      await user.updateProfile({ displayName: nickname });

      // Firestore에 사용자 정보 저장
      await db.collection('users').doc(user.uid).set({
        email: email,
        name: name,
        nickname: nickname,
        displayName: nickname,
        plan: 'free',
        planExpiry: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        usageCount: 0
      });

      // 프로모션 코드 적용
      if (validatedPromoCode) {
        try {
          await applyPromoCode(validatedPromoCode, user.uid);
        } catch (promoError) {
          console.error('프로모션 코드 적용 오류:', promoError);
        }
      }

      window.location.href = MYPAGE_URL;
    } catch (error) {
      showMessage('error', getAuthError(error.code));
    } finally {
      setLoading(signupForm, false);
    }
  });

  // 비밀번호 재설정
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value.trim();

    if (!email) {
      showMessage('error', '이메일을 입력해주세요.');
      return;
    }

    setLoading(resetForm, true);

    try {
      await auth.sendPasswordResetEmail(email);
      showMessage('success', '비밀번호 재설정 이메일을 전송했습니다. 이메일을 확인해주세요.');
    } catch (error) {
      showMessage('error', getAuthError(error.code));
    } finally {
      setLoading(resetForm, false);
    }
  });

  // 프로모션 코드 확인
  if (promoCheckBtn) {
    promoCheckBtn.addEventListener('click', async () => {
      const code = promoCodeInput.value.trim().toUpperCase();
      if (!code) {
        showPromoResult('error', '코드를 입력해주세요.');
        return;
      }

      promoCheckBtn.disabled = true;
      promoCheckBtn.textContent = '확인 중...';

      try {
        // Firestore에서 직접 프로모션 코드 조회
        const snapshot = await db.collection('promoCodes')
          .where('code', '==', code)
          .where('status', '==', 'active')
          .limit(1)
          .get();

        if (snapshot.empty) {
          validatedPromoCode = null;
          showPromoResult('error', '유효하지 않거나 만료된 코드입니다.');
        } else {
          const promoData = snapshot.docs[0].data();
          const now = Date.now();

          if (promoData.expiresAt && promoData.expiresAt < now) {
            validatedPromoCode = null;
            showPromoResult('error', '만료된 코드입니다.');
          } else {
            validatedPromoCode = code;
            const benefitText = {
              'pro_3months': 'PRO 3개월 무료',
              'pro_1month': 'PRO 1개월 무료',
              'unlimited_3months': '무제한 3개월 무료'
            }[promoData.benefit] || promoData.benefit;

            showPromoResult('success', `✨ ${benefitText}`);
            promoCodeInput.disabled = true;
            promoCheckBtn.style.display = 'none';
          }
        }
      } catch (error) {
        console.error('프로모션 코드 확인 오류:', error);
        showPromoResult('error', '코드 확인 중 오류가 발생했습니다.');
      } finally {
        promoCheckBtn.disabled = false;
        promoCheckBtn.textContent = '확인';
      }
    });
  }

  // 프로모션 코드 적용
  async function applyPromoCode(code, userId) {
    const snapshot = await db.collection('promoCodes')
      .where('code', '==', code)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (snapshot.empty) return;

    const doc = snapshot.docs[0];
    const promoData = doc.data();

    // 혜택 계산
    let plan = 'pro';
    let months = 3;
    if (promoData.benefit === 'pro_1month') { plan = 'pro'; months = 1; }
    else if (promoData.benefit === 'pro_3months') { plan = 'pro'; months = 3; }
    else if (promoData.benefit === 'unlimited_3months') { plan = 'unlimited'; months = 3; }

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + months);

    // 사용자 플랜 업데이트
    await db.collection('users').doc(userId).update({
      plan: plan,
      planExpiry: expiry,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 코드 사용 처리
    await doc.ref.update({
      status: 'used',
      usedBy: userId,
      usedAt: Date.now()
    });
  }

  // 유틸리티 함수들
  function setLoading(form, isLoading) {
    const btn = form.querySelector('.auth-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');
    btn.disabled = isLoading;
    btnText.style.display = isLoading ? 'none' : 'inline';
    btnLoading.style.display = isLoading ? 'inline' : 'none';
  }

  function showMessage(type, text) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    authMessage.className = 'auth-message ' + type;
    authMessage.innerHTML = `
      <span class="message-icon">${icons[type]}</span>
      <span class="message-text">${text}</span>
    `;
    authMessage.style.display = 'flex';
  }

  function hideMessage() {
    authMessage.style.display = 'none';
  }

  function showPromoResult(type, text) {
    if (!promoResult) return;
    promoResult.className = 'promo-result ' + type;
    promoResult.innerHTML = `
      <span class="promo-icon">${type === 'success' ? '🎉' : '⚠️'}</span>
      <span class="promo-text">${text}</span>
    `;
    promoResult.style.display = 'flex';
  }

  function getAuthError(code) {
    const m = {
      'auth/user-not-found': '등록되지 않은 이메일입니다.',
      'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
      'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
      'auth/invalid-login-credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
      'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
      'auth/weak-password': '비밀번호가 너무 약합니다.',
      'auth/invalid-email': '유효하지 않은 이메일입니다.',
      'auth/too-many-requests': '너무 많은 시도입니다. 잠시 후 다시 시도하세요.',
      'auth/network-request-failed': '네트워크 오류입니다. 인터넷 연결을 확인하세요.',
      'auth/internal-error': '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    };
    return m[code] || `오류가 발생했습니다. (${code || 'unknown'})`;
  }
});
