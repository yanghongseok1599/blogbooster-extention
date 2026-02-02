/**
 * 블로그 부스터 Pro - 통합 팝업 스크립트
 * Firebase 인증 연동 버전
 */

document.addEventListener('DOMContentLoaded', function() {
  // 로그인 관련 DOM 요소
  const loginRequired = document.getElementById('loginRequired');
  const mainContent = document.getElementById('mainContent');
  const openLoginBtn = document.getElementById('openLoginBtn');
  const userBtn = document.getElementById('userBtn');
  const userDropdown = document.getElementById('userDropdown');
  const userName = document.getElementById('userName');
  const userEmail = document.getElementById('userEmail');
  const userPlan = document.getElementById('userPlan');
  const logoutBtn = document.getElementById('logoutBtn');

  // 기존 DOM 요소
  const analyzeBtn = document.getElementById('analyzeBtn');
  const sidepanelBtn = document.getElementById('sidepanelBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const seoBtn = document.getElementById('seoBtn');
  const timerBtn = document.getElementById('timerBtn');
  const exportBtn = document.getElementById('exportBtn');
  const helpLink = document.getElementById('helpLink');

  // 상태 표시 요소
  const statusIcon = document.getElementById('statusIcon');
  const statusText = document.getElementById('statusText');
  const charCount = document.getElementById('charCount');

  // 분석 결과 요소
  const quickResult = document.getElementById('quickResult');
  const seoBadge = document.getElementById('seoBadge');
  const paragraphCount = document.getElementById('paragraphCount');
  const imageCount = document.getElementById('imageCount');
  const seoScore = document.getElementById('seoScore');
  const mainKeyword = document.getElementById('mainKeyword');

  // 현재 분석 데이터
  let currentAnalysis = null;
  let isDropdownOpen = false;

  /**
   * 초기화
   */
  async function init() {
    await checkLoginState();
  }

  /**
   * 로그인 상태 확인
   */
  async function checkLoginState() {
    try {
      const result = await chrome.storage.local.get(['isLoggedIn', 'userInfo']);

      if (result.isLoggedIn && result.userInfo) {
        // 로그인 상태 - 메인 콘텐츠 표시
        showMainContent(result.userInfo);
      } else {
        // 비로그인 상태 - 로그인 필요 화면 표시
        showLoginRequired();
      }
    } catch (error) {
      console.error('로그인 상태 확인 오류:', error);
      showLoginRequired();
    }
  }

  /**
   * 로그인 필요 화면 표시
   */
  function showLoginRequired() {
    if (loginRequired) loginRequired.style.display = 'flex';
    if (mainContent) mainContent.style.display = 'none';
  }

  /**
   * 메인 콘텐츠 표시
   */
  async function showMainContent(userInfo) {
    if (loginRequired) loginRequired.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';

    // 사용자 정보 표시
    if (userName) userName.textContent = userInfo.displayName || '사용자';
    if (userEmail) userEmail.textContent = userInfo.email || '';

    // 플랜 배지 표시
    if (userPlan) {
      const plan = userInfo.plan || 'free';
      const planBadge = userPlan.querySelector('.plan-badge');
      if (planBadge) {
        planBadge.className = 'plan-badge ' + plan;
        planBadge.textContent = plan === 'free' ? '무료 플랜' :
                               plan === 'pro' ? 'Pro 플랜' :
                               plan === 'premium' ? 'Premium 플랜' : '무료 플랜';
      }
    }

    // 기존 초기화 로직
    await checkCurrentTab();
    await loadCharCount();
  }

  /**
   * 로그인 페이지 열기
   */
  function openLoginPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('auth/login.html')
    });
    window.close();
  }

  /**
   * 로그아웃
   */
  async function logout() {
    try {
      // 로컬 스토리지 초기화
      await chrome.storage.local.set({
        isLoggedIn: false,
        userInfo: null
      });

      // 로그인 필요 화면 표시
      showLoginRequired();
      hideUserDropdown();
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  }

  /**
   * 사용자 드롭다운 토글
   */
  function toggleUserDropdown() {
    if (isDropdownOpen) {
      hideUserDropdown();
    } else {
      showUserDropdown();
    }
  }

  function showUserDropdown() {
    if (userDropdown) {
      userDropdown.style.display = 'block';
      isDropdownOpen = true;
    }
  }

  function hideUserDropdown() {
    if (userDropdown) {
      userDropdown.style.display = 'none';
      isDropdownOpen = false;
    }
  }

  /**
   * 현재 탭이 네이버 블로그인지 확인
   */
  async function checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url) {
        updateStatus('📝', '탭 정보를 가져올 수 없습니다.');
        return false;
      }

      const isNaverBlog = tab.url.includes('blog.naver.com') || tab.url.includes('m.blog.naver.com');

      if (isNaverBlog) {
        updateStatus('✅', '분석 준비 완료');
        return true;
      } else {
        updateStatus('📝', '네이버 블로그에서 사용하세요');
        return false;
      }
    } catch (error) {
      console.error('탭 확인 오류:', error);
      return false;
    }
  }

  /**
   * 글자수 로드
   */
  async function loadCharCount() {
    try {
      const response = await sendMessage({ action: 'getCharCount' });
      const countValue = charCount?.querySelector('.count-value');

      if (response && typeof response.total === 'number' && response.total > 0) {
        if (countValue) countValue.textContent = formatNumber(response.total);
      } else {
        if (countValue) countValue.textContent = '-';
      }
    } catch (error) {
      console.error('글자수 로드 오류:', error);
    }
  }

  /**
   * 상태 업데이트
   */
  function updateStatus(icon, text) {
    if (statusIcon) statusIcon.textContent = icon;
    if (statusText) statusText.textContent = text;
  }

  /**
   * 로딩 상태 표시
   */
  function showLoading(show) {
    if (!analyzeBtn) return;

    if (show) {
      analyzeBtn.disabled = true;
      analyzeBtn.innerHTML = '<span class="loading-spinner"></span><span class="btn-text">분석 중...</span>';
    } else {
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '<span class="btn-icon">🔍</span><span class="btn-text">이 글 분석하기</span>';
    }
  }

  /**
   * 분석 실행
   */
  async function runAnalysis() {
    const isValid = await checkCurrentTab();
    if (!isValid) return;

    showLoading(true);
    updateStatus('🔄', '분석 중...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Content script에 분석 요청
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'analyze' });

      if (response && response.success) {
        currentAnalysis = response.data;
        showResults(response.data);
        updateStatus('✅', '분석 완료!');

        // 분석 결과 저장
        chrome.runtime.sendMessage({
          action: 'saveAnalysis',
          data: {
            url: tab.url,
            title: response.data.extracted?.title || '제목 없음',
            analysis: response.data.analysis
          }
        });

        // 사용 기록 (Firebase)
        const userInfo = (await chrome.storage.local.get(['userInfo'])).userInfo;
        if (userInfo && userInfo.uid) {
          chrome.runtime.sendMessage({
            action: 'logUsage',
            uid: userInfo.uid,
            actionType: 'analyze',
            details: { url: tab.url }
          });
        }
      } else {
        const errorMsg = response?.error || '분석에 실패했습니다.';
        updateStatus('❌', errorMsg);
      }
    } catch (error) {
      console.error('분석 오류:', error);
      updateStatus('❌', '페이지를 새로고침 후 다시 시도해주세요.');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 분석 결과 표시
   */
  function showResults(data) {
    if (!data || !data.extracted || !data.analysis) return;

    const extracted = data.extracted;
    const analysis = data.analysis;

    // 통계 업데이트
    if (paragraphCount && extracted.stats) {
      paragraphCount.textContent = extracted.stats.paragraphCount || 0;
    }
    if (imageCount && extracted.stats) {
      imageCount.textContent = extracted.stats.imageCount || 0;
    }
    if (seoScore && analysis.seo) {
      seoScore.textContent = analysis.seo.score || 0;
    }
    if (mainKeyword && analysis.keywords) {
      mainKeyword.textContent = analysis.keywords.mainKeyword || '-';
    }

    // SEO 배지 업데이트
    if (seoBadge && analysis.seo) {
      const grade = analysis.seo.grade || getGrade(analysis.seo.score);
      seoBadge.textContent = grade;
      seoBadge.className = 'seo-badge grade-' + grade;
    }

    // 글자수 업데이트
    if (charCount && extracted.stats) {
      const countValue = charCount.querySelector('.count-value');
      if (countValue) {
        countValue.textContent = formatNumber(extracted.stats.charCount || 0);
      }
    }

    // 결과 영역 표시
    if (quickResult) {
      quickResult.style.display = 'block';
      quickResult.classList.add('fade-in');
    }
  }

  /**
   * SEO 점수로 등급 계산
   */
  function getGrade(score) {
    if (score >= 95) return 'S';
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  /**
   * 사이드패널 열기
   */
  async function openSidePanel() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // 분석 데이터 저장
      if (currentAnalysis) {
        await chrome.storage.local.set({ currentAnalysis: currentAnalysis });
      }

      const response = await sendMessage({
        action: 'openSidePanel',
        tabId: tab.id
      });

      if (response && response.success) {
        window.close();
      } else {
        updateStatus('❌', '사이드패널을 열 수 없습니다.');
      }
    } catch (error) {
      console.error('사이드패널 오류:', error);
      updateStatus('❌', '사이드패널 오류');
    }
  }

  /**
   * 블로그 부스터 기능 실행
   */
  async function executeFunction(functionName) {
    try {
      await sendMessage({
        action: 'executeFunction',
        functionName: functionName
      });
      window.close();
    } catch (error) {
      console.error('기능 실행 오류:', error);
    }
  }

  /**
   * 메시지 전송 유틸리티
   */
  function sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('메시지 오류:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(response);
      });
    });
  }

  /**
   * 숫자 포맷팅
   */
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // ==================== 이벤트 리스너 ====================

  // 로그인 버튼
  if (openLoginBtn) {
    openLoginBtn.addEventListener('click', openLoginPage);
  }

  // 사용자 버튼 (드롭다운 토글)
  if (userBtn) {
    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleUserDropdown();
    });
  }

  // 로그아웃 버튼
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // 드롭다운 외부 클릭 시 닫기
  document.addEventListener('click', (e) => {
    if (isDropdownOpen && userDropdown && !userDropdown.contains(e.target)) {
      hideUserDropdown();
    }
  });

  // 기존 이벤트 리스너
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', runAnalysis);
  }

  if (sidepanelBtn) {
    sidepanelBtn.addEventListener('click', openSidePanel);
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  if (seoBtn) {
    seoBtn.addEventListener('click', () => {
      executeFunction('showAnalysis');
    });
  }

  if (timerBtn) {
    timerBtn.addEventListener('click', () => {
      executeFunction('showTimer');
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      executeFunction('exportWord');
    });
  }

  if (helpLink) {
    helpLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://blog.naver.com' });
    });
  }

  // 초기화 실행
  init();
});
