/**
 * 블로그 부스터 Pro - 로그인/회원가입 스크립트
 */

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

  // 현재 활성 폼
  let currentForm = 'login';
  let validatedPromoCode = null; // 검증된 프로모션 코드
  let loggedOut = false; // 로그아웃 상태 플래그

  // Firebase 초기화
  if (typeof FirebaseAuth !== 'undefined') {
    FirebaseAuth.initializeFirebase();

    // 이미 로그인되어 있는지 확인
    FirebaseAuth.onAuthStateChanged(async (user) => {
      if (user && !loggedOut) {
        await FirebaseAuth.syncAuthState();
        showLoginSuccess();
      }
    });
  }

  // 탭 전환
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });

  function switchTab(tab) {
    currentForm = tab;

    // 탭 버튼 활성화
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // 탭 표시 (기본 2개)
    document.querySelector('.auth-tabs').style.display = 'flex';

    // 폼 전환
    loginForm.classList.toggle('active', tab === 'login');
    signupForm.classList.toggle('active', tab === 'signup');
    resetForm.classList.remove('active');

    // 메시지 숨김
    hideMessage();
  }

  // 비밀번호 재설정 폼 표시
  forgotPassword.addEventListener('click', (e) => {
    e.preventDefault();
    currentForm = 'reset';

    // 탭 숨기기
    document.querySelector('.auth-tabs').style.display = 'none';

    loginForm.classList.remove('active');
    signupForm.classList.remove('active');
    resetForm.classList.add('active');
    hideMessage();
  });

  // 로그인으로 돌아가기
  backToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('login');
  });

  // 로그인 폼 제출
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
      const result = await FirebaseAuth.signIn(email, password);

      if (result.success) {
        loggedOut = false;
        await FirebaseAuth.syncAuthState();
        showLoginSuccess();
      } else {
        showMessage('error', result.error);
      }
    } catch (error) {
      showMessage('error', '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(loginForm, false);
    }
  });

  // 프로모션 코드 확인 버튼
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
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'validatePromoCode',
            code: code
          }, resolve);
        });

        if (response && response.success) {
          validatedPromoCode = code;
          showPromoResult('success', `✨ ${response.benefitText}`);
          promoCodeInput.disabled = true;
          promoCheckBtn.style.display = 'none';
        } else {
          validatedPromoCode = null;
          showPromoResult('error', response ? response.error : '코드 확인에 실패했습니다.');
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

  // 프로모션 결과 표시
  function showPromoResult(type, text) {
    if (!promoResult) return;

    promoResult.className = 'promo-result ' + type;
    promoResult.innerHTML = `
      <span class="promo-icon">${type === 'success' ? '🎉' : '⚠️'}</span>
      <span class="promo-text">${text}</span>
    `;
    promoResult.style.display = 'flex';
  }

  // 회원가입 폼 제출
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('signupName').value.trim();
    const nickname = document.getElementById('signupNickname').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;

    // 유효성 검사
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
      const result = await FirebaseAuth.signUp(email, password, name, nickname);

      if (result.success) {
        // 프로모션 코드가 있으면 사용 처리
        if (validatedPromoCode && result.user) {
          try {
            await new Promise((resolve) => {
              chrome.runtime.sendMessage({
                action: 'usePromoCode',
                code: validatedPromoCode,
                userId: result.user.uid
              }, resolve);
            });
          } catch (promoError) {
            console.error('프로모션 코드 적용 오류:', promoError);
          }
        }

        await FirebaseAuth.syncAuthState();

        showLoginSuccess();
      } else {
        showMessage('error', result.error);
      }
    } catch (error) {
      showMessage('error', '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(signupForm, false);
    }
  });

  // 비밀번호 재설정 폼 제출
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('resetEmail').value.trim();

    if (!email) {
      showMessage('error', '이메일을 입력해주세요.');
      return;
    }

    setLoading(resetForm, true);

    try {
      const result = await FirebaseAuth.sendPasswordReset(email);

      if (result.success) {
        showMessage('success', '비밀번호 재설정 이메일을 전송했습니다. 이메일을 확인해주세요.');
      } else {
        showMessage('error', result.error);
      }
    } catch (error) {
      showMessage('error', '이메일 전송 중 오류가 발생했습니다.');
    } finally {
      setLoading(resetForm, false);
    }
  });

  // 로딩 상태 설정
  function setLoading(form, isLoading) {
    const btn = form.querySelector('.auth-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');

    btn.disabled = isLoading;
    btnText.style.display = isLoading ? 'none' : 'inline';
    btnLoading.style.display = isLoading ? 'inline' : 'none';
  }

  // 메시지 표시
  function showMessage(type, text) {
    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️'
    };

    authMessage.className = 'auth-message ' + type;
    authMessage.innerHTML = `
      <span class="message-icon">${icons[type]}</span>
      <span class="message-text">${text}</span>
    `;
    authMessage.style.display = 'flex';
  }

  // 메시지 숨김
  function hideMessage() {
    authMessage.style.display = 'none';
  }

  // 로그인 성공 후 패널 표시
  function showLoginSuccess() {
    const authContainer = document.querySelector('.auth-container');
    const panelWrapper = document.getElementById('panelWrapper');
    authContainer.style.display = 'none';
    panelWrapper.style.display = 'block';
  }

  // iframe(패널)에서 로그아웃 메시지 수신
  window.addEventListener('message', async function(e) {
    if (e.data && e.data.action === 'logout') {
      loggedOut = true;
      // 부모 페이지의 Firebase 세션도 로그아웃
      if (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.signOut) {
        await FirebaseAuth.signOut();
      }
      const authContainer = document.querySelector('.auth-container');
      const panelWrapper = document.getElementById('panelWrapper');
      panelWrapper.style.display = 'none';
      authContainer.style.display = 'block';
    }
  });
});
