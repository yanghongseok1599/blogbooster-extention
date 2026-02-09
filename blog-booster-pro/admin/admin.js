/**
 * 블로그 부스터 Pro - 관리자 페이지
 */

// 기본 관리자 비밀번호
const DEFAULT_ADMIN_PASSWORD = (typeof ENV_CONFIG !== 'undefined' && ENV_CONFIG.defaultAdminPassword) ? ENV_CONFIG.defaultAdminPassword : '315477aa';

// 관리자 인증 - 최우선 등록 (다른 코드 에러와 무관하게 동작)
document.addEventListener('DOMContentLoaded', function() {
  const authSection = document.getElementById('authSection');
  const adminMain = document.getElementById('adminMain');
  const adminPassword = document.getElementById('adminPassword');
  const authBtn = document.getElementById('authBtn');
  const authError = document.getElementById('authError');

  function authSuccess() {
    authSection.style.display = 'none';
    adminMain.style.display = 'flex';
    document.dispatchEvent(new Event('adminAuthenticated'));
  }

  async function doAuth() {
    const pw = adminPassword.value.trim();
    console.log('[Admin] 인증 시도 - 입력:', pw, '기본:', DEFAULT_ADMIN_PASSWORD, '일치:', pw === DEFAULT_ADMIN_PASSWORD);
    if (!pw) {
      if (authError) { authError.textContent = '비밀번호를 입력하세요.'; authError.style.display = 'block'; }
      return;
    }

    // 1) 기본 비밀번호 확인
    if (pw === DEFAULT_ADMIN_PASSWORD) {
      chrome.storage.local.set({ adminPassword: pw });
      authSuccess();
      return;
    }

    // 2) 저장된 비밀번호 확인 (변경한 경우)
    try {
      const result = await chrome.storage.local.get(['adminPassword']);
      console.log('[Admin] 저장된 비밀번호:', result.adminPassword, '일치:', pw === result.adminPassword);
      if (result.adminPassword && pw === result.adminPassword) {
        authSuccess();
        return;
      }
    } catch (e) {
      console.warn('[Admin] storage 조회 실패:', e);
    }

    if (authError) { authError.textContent = '비밀번호가 일치하지 않습니다.'; authError.style.display = 'block'; }
  }

  if (authBtn) authBtn.addEventListener('click', doAuth);
  if (adminPassword) adminPassword.addEventListener('keypress', function(e) { if (e.key === 'Enter') doAuth(); });
});

document.addEventListener('DOMContentLoaded', function() {
  // 요소 참조
  const authSection = document.getElementById('authSection');
  const adminMain = document.getElementById('adminMain');
  const adminPassword = document.getElementById('adminPassword');
  const authBtn = document.getElementById('authBtn');
  const authError = document.getElementById('authError');

  // 코드 생성 관련
  const generateCodeBtn = document.getElementById('generateCodeBtn');
  const codeCount = document.getElementById('codeCount');
  const codeExpiry = document.getElementById('codeExpiry');
  const codeBenefit = document.getElementById('codeBenefit');
  const generatedCodes = document.getElementById('generatedCodes');
  const codesList = document.getElementById('codesList');
  const copyAllCodes = document.getElementById('copyAllCodes');

  // 테이블 관련
  const codesTableBody = document.getElementById('codesTableBody');
  const searchCode = document.getElementById('searchCode');
  const cleanExpiredBtn = document.getElementById('cleanExpiredBtn');

  // 통계
  const totalCodesEl = document.getElementById('totalCodes');
  const usedCodesEl = document.getElementById('usedCodes');
  const activeCodesEl = document.getElementById('activeCodes');
  const expiredCodesEl = document.getElementById('expiredCodes');

  // 설정
  const newAdminPassword = document.getElementById('newAdminPassword');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const serverApiKey = document.getElementById('serverApiKey');
  const saveServerApiBtn = document.getElementById('saveServerApiBtn');

  let currentCodes = [];
  let allPromoCodes = [];

  // Firebase 초기화
  if (typeof FirebaseAuth !== 'undefined') {
    FirebaseAuth.initializeFirebase();
  }

  /**
   * Firebase 토큰 갱신 (Firebase API 호출 전 필요)
   */
  async function refreshFirebaseToken() {
    if (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.refreshIdToken) {
      return await FirebaseAuth.refreshIdToken();
    }
    return null;
  }

  // 인증 완료 시 데이터 로드 (상단의 독립 인증 핸들러에서 트리거됨)
  document.addEventListener('adminAuthenticated', function() {
    loadAllData();
  });

  /**
   * 프로모션 코드 생성
   */
  function generatePromoCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'BP-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * 코드 발행
   */
  async function generateCodes() {
    const count = parseInt(codeCount.value);
    const expiryHours = parseInt(codeExpiry.value);
    const benefit = codeBenefit.value;

    generateCodeBtn.disabled = true;
    generateCodeBtn.innerHTML = '<span class="btn-icon">⏳</span> 발행 중...';

    try {
      const newCodes = [];
      const now = Date.now();

      for (let i = 0; i < count; i++) {
        const code = generatePromoCode();
        const promoData = {
          code: code,
          benefit: benefit,
          createdAt: now,
          expiresAt: now + (expiryHours * 60 * 60 * 1000),
          status: 'active',
          usedBy: null,
          usedAt: null
        };
        newCodes.push(promoData);
      }

      // 기존 코드와 합치기
      const result = await chrome.storage.local.get(['promoCodes']);
      const existingCodes = result.promoCodes || [];
      const allCodes = [...existingCodes, ...newCodes];

      await chrome.storage.local.set({ promoCodes: allCodes });

      // UI 업데이트
      currentCodes = newCodes;
      displayGeneratedCodes(newCodes);
      loadAllData();

      alert(`${count}개의 프로모션 코드가 발행되었습니다.`);

    } catch (error) {
      console.error('코드 발행 오류:', error);
      alert('코드 발행 중 오류가 발생했습니다.');
    } finally {
      generateCodeBtn.disabled = false;
      generateCodeBtn.innerHTML = '<span class="btn-icon">🎟️</span> 코드 발행하기';
    }
  }

  /**
   * 생성된 코드 표시
   */
  function displayGeneratedCodes(codes) {
    generatedCodes.style.display = 'block';
    codesList.innerHTML = '';

    codes.forEach(codeData => {
      const item = document.createElement('div');
      item.className = 'code-item';
      item.innerHTML = `
        <span class="code-text">${codeData.code}</span>
        <button class="copy-btn" data-code="${codeData.code}" title="복사">📋</button>
      `;
      codesList.appendChild(item);
    });

    // 복사 버튼 이벤트
    codesList.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const code = this.dataset.code;
        navigator.clipboard.writeText(code).then(() => {
          this.textContent = '✓';
          setTimeout(() => { this.textContent = '📋'; }, 1000);
        });
      });
    });
  }

  /**
   * 전체 코드 복사
   */
  function copyAllCodesHandler() {
    const codesText = currentCodes.map(c => c.code).join('\n');
    navigator.clipboard.writeText(codesText).then(() => {
      copyAllCodes.textContent = '복사됨!';
      setTimeout(() => { copyAllCodes.textContent = '전체 복사'; }, 1500);
    });
  }

  /**
   * 모든 데이터 로드
   */
  async function loadAllData() {
    try {
      const result = await chrome.storage.local.get(['promoCodes', 'serverGeminiApiKey']);
      allPromoCodes = result.promoCodes || [];

      // 만료 상태 업데이트
      const now = Date.now();
      allPromoCodes = allPromoCodes.map(code => {
        if (code.status === 'active' && code.expiresAt < now) {
          return { ...code, status: 'expired' };
        }
        return code;
      });

      // 저장
      await chrome.storage.local.set({ promoCodes: allPromoCodes });

      // UI 업데이트
      updateTable();
      updateStats();

      // 서버 API 키 표시
      if (result.serverGeminiApiKey) {
        serverApiKey.value = result.serverGeminiApiKey;
      }

      // Firebase에서 freeAccessEnabled 설정 로드
      loadFreeAccessSetting();

      // 유저 목록 자동 로드
      loadUsersList();

    } catch (error) {
      console.error('데이터 로드 오류:', error);
    }
  }

  /**
   * Firebase에서 API 설정 로드
   */
  async function loadFreeAccessSetting() {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'getApiSettings'
        }, resolve);
      });

      const freeAccessCheckbox = document.getElementById('freeAccessEnabled');
      const youtubeApiKeysTextarea = document.getElementById('youtubeApiKeys');

      if (response && response.success) {
        if (freeAccessCheckbox) {
          freeAccessCheckbox.checked = response.settings.freeAccessEnabled || false;
        }

        // YouTube API 키 로드
        if (youtubeApiKeysTextarea && response.settings.youtubeApiKeys) {
          youtubeApiKeysTextarea.value = response.settings.youtubeApiKeys.join('\n');
          console.log('[Admin] YouTube API 키 로드됨:', response.settings.youtubeApiKeys.length, '개');
        }

        // API 키 상태 표시
        if (response.settings.hasApiKey) {
          console.log('[Admin] Firebase에 Gemini API 키 설정됨');
        }
      }
    } catch (error) {
      console.log('API 설정 로드 실패:', error);
    }
  }

  /**
   * YouTube API 키 저장
   */
  async function saveYouTubeApiKeys() {
    const youtubeApiKeysTextarea = document.getElementById('youtubeApiKeys');
    const saveYouTubeApiBtn = document.getElementById('saveYouTubeApiBtn');

    const keysText = youtubeApiKeysTextarea.value.trim();
    const keys = keysText.split('\n').map(k => k.trim()).filter(k => k.length > 0);

    if (keys.length === 0) {
      alert('YouTube API 키를 입력하세요.');
      return;
    }

    saveYouTubeApiBtn.disabled = true;
    saveYouTubeApiBtn.textContent = '저장 중...';

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'setYouTubeApiKeys',
          keys: keys
        }, resolve);
      });

      if (response && response.success) {
        alert('YouTube API 키가 저장되었습니다. (' + keys.length + '개)');
      } else {
        alert('저장 실패: ' + (response?.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('YouTube API 키 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      saveYouTubeApiBtn.disabled = false;
      saveYouTubeApiBtn.textContent = '저장';
    }
  }

  /**
   * 테이블 업데이트
   */
  function updateTable(filter = '') {
    let filteredCodes = allPromoCodes;

    if (filter) {
      filteredCodes = allPromoCodes.filter(c =>
        c.code.toLowerCase().includes(filter.toLowerCase())
      );
    }

    // 최신순 정렬
    filteredCodes.sort((a, b) => b.createdAt - a.createdAt);

    if (filteredCodes.length === 0) {
      codesTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">발행된 코드가 없습니다</td>
        </tr>
      `;
      return;
    }

    codesTableBody.innerHTML = '';

    filteredCodes.forEach(codeData => {
      const tr = document.createElement('tr');

      const benefitText = {
        'pro_3months': 'PRO 3개월',
        'pro_1month': 'PRO 1개월',
        'unlimited_3months': '무제한 3개월'
      }[codeData.benefit] || codeData.benefit;

      const statusClass = codeData.status === 'active' ? 'active' :
                          codeData.status === 'used' ? 'used' : 'expired';
      const statusText = codeData.status === 'active' ? '활성' :
                         codeData.status === 'used' ? '사용됨' : '만료';

      tr.innerHTML = `
        <td class="code-cell">${codeData.code}</td>
        <td>${benefitText}</td>
        <td>${formatDate(codeData.createdAt)}</td>
        <td>${formatDate(codeData.expiresAt)}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>
          <button class="action-btn copy-action" data-code="${codeData.code}" title="복사">📋</button>
          <button class="action-btn delete-action" data-code="${codeData.code}" title="삭제">🗑️</button>
        </td>
      `;

      codesTableBody.appendChild(tr);
    });

    // 이벤트 리스너
    codesTableBody.querySelectorAll('.copy-action').forEach(btn => {
      btn.addEventListener('click', function() {
        navigator.clipboard.writeText(this.dataset.code);
        this.textContent = '✓';
        setTimeout(() => { this.textContent = '📋'; }, 1000);
      });
    });

    codesTableBody.querySelectorAll('.delete-action').forEach(btn => {
      btn.addEventListener('click', function() {
        if (confirm('이 코드를 삭제하시겠습니까?')) {
          deleteCode(this.dataset.code);
        }
      });
    });
  }

  /**
   * 통계 업데이트
   */
  function updateStats() {
    const total = allPromoCodes.length;
    const used = allPromoCodes.filter(c => c.status === 'used').length;
    const active = allPromoCodes.filter(c => c.status === 'active').length;
    const expired = allPromoCodes.filter(c => c.status === 'expired').length;

    totalCodesEl.textContent = total;
    usedCodesEl.textContent = used;
    activeCodesEl.textContent = active;
    expiredCodesEl.textContent = expired;
  }

  /**
   * 코드 삭제
   */
  async function deleteCode(code) {
    allPromoCodes = allPromoCodes.filter(c => c.code !== code);
    await chrome.storage.local.set({ promoCodes: allPromoCodes });
    updateTable(searchCode.value);
    updateStats();
  }

  /**
   * 만료 코드 정리
   */
  async function cleanExpiredCodes() {
    const before = allPromoCodes.length;
    allPromoCodes = allPromoCodes.filter(c => c.status !== 'expired');
    const after = allPromoCodes.length;

    await chrome.storage.local.set({ promoCodes: allPromoCodes });
    updateTable(searchCode.value);
    updateStats();

    alert(`${before - after}개의 만료된 코드가 삭제되었습니다.`);
  }

  /**
   * 관리자 비밀번호 변경
   */
  async function changePassword() {
    const newPassword = newAdminPassword.value.trim();
    if (!newPassword) {
      alert('새 비밀번호를 입력하세요.');
      return;
    }

    if (newPassword.length < 6) {
      alert('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    await chrome.storage.local.set({ adminPassword: newPassword });
    newAdminPassword.value = '';
    alert('비밀번호가 변경되었습니다.');
  }

  /**
   * 서버 API 키 저장 (Firebase + 로컬 백업)
   */
  async function saveServerApiKey() {
    const apiKey = serverApiKey.value.trim();
    if (!apiKey) {
      alert('API 키를 입력하세요.');
      return;
    }

    saveServerApiBtn.disabled = true;
    saveServerApiBtn.textContent = '저장 중...';

    try {
      // 무료 사용자 접근 여부 체크박스 (선택사항)
      const freeAccessCheckbox = document.getElementById('freeAccessEnabled');
      const freeAccessEnabled = freeAccessCheckbox ? freeAccessCheckbox.checked : false;

      // Firebase에 저장 시도
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'saveGeminiApiKeyToFirebase',
          apiKey: apiKey,
          options: { freeAccessEnabled }
        }, resolve);
      });

      if (response && response.success) {
        // 로컬 백업도 저장 (폴백용)
        await chrome.storage.local.set({ serverGeminiApiKey: apiKey });
        alert('서버 API 키가 Firebase에 저장되었습니다.');
      } else {
        // Firebase 실패 시 로컬에만 저장
        await chrome.storage.local.set({ serverGeminiApiKey: apiKey });
        alert('Firebase 저장 실패. 로컬에만 저장되었습니다.\n(' + (response?.error || '알 수 없는 오류') + ')');
      }
    } catch (error) {
      console.error('API 키 저장 오류:', error);
      // 오류 시에도 로컬에 저장
      await chrome.storage.local.set({ serverGeminiApiKey: apiKey });
      alert('Firebase 연결 실패. 로컬에만 저장되었습니다.');
    } finally {
      saveServerApiBtn.disabled = false;
      saveServerApiBtn.textContent = '저장';
    }
  }

  /**
   * 날짜 포맷
   */
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  }

  // ==================== 가입 유저 목록 ====================

  const loadUsersListBtn = document.getElementById('loadUsersListBtn');
  const usersListCount = document.getElementById('usersListCount');
  const usersListBody = document.getElementById('usersListBody');

  // 유저 플랜 모달 요소
  const userPlanModal = document.getElementById('userPlanModal');
  const closeUserPlanModal = document.getElementById('closeUserPlanModal');
  const cancelUserPlan = document.getElementById('cancelUserPlan');
  const saveUserPlan = document.getElementById('saveUserPlan');

  let allUsersList = []; // 유저 목록 저장

  /**
   * 가입 유저 목록 로드
   */
  async function loadUsersList() {
    loadUsersListBtn.disabled = true;
    loadUsersListBtn.innerHTML = '<span class="btn-icon">⏳</span> 불러오는 중...';

    try {
      // Firebase SDK를 통해 직접 유저 목록 가져오기
      if (typeof FirebaseAuth === 'undefined' || !FirebaseAuth.getAllUsers) {
        throw new Error('Firebase가 초기화되지 않았습니다.');
      }

      const result = await FirebaseAuth.getAllUsers();

      if (!result.success) {
        throw new Error(result.error || '유저 목록 로드 실패');
      }

      allUsersList = result.data || [];
      usersListCount.textContent = `총 ${allUsersList.length}명`;
      renderUsersList(allUsersList);

    } catch (error) {
      console.error('유저 목록 로드 오류:', error);
      alert('유저 목록 로드 중 오류가 발생했습니다: ' + error.message);
    } finally {
      loadUsersListBtn.disabled = false;
      loadUsersListBtn.innerHTML = '<span class="btn-icon">🔄</span> 유저 목록 불러오기';
    }
  }

  /**
   * 유저 목록 테이블 렌더링
   */
  function renderUsersList(users) {
    if (users.length === 0) {
      usersListBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="7">가입된 유저가 없습니다</td>
        </tr>
      `;
      return;
    }

    usersListBody.innerHTML = '';

    users.forEach((user, index) => {
      const tr = document.createElement('tr');

      // 플랜 배지 스타일
      let planBadge;
      if (user.plan === 'unlimited') {
        planBadge = '<span class="plan-badge pro">무제한</span>';
      } else if (user.plan === 'pro') {
        planBadge = '<span class="plan-badge pro">PRO</span>';
      } else {
        planBadge = '<span class="plan-badge free">무료</span>';
      }

      // 만료일 처리
      const expiryInfo = getExpiryInfo(user.planExpiry, user.plan);

      // 날짜 포맷
      const createdAt = user.createdAt ? formatFirebaseTimestamp(user.createdAt) : '-';
      const lastLoginAt = user.lastLoginAt ? formatFirebaseTimestamp(user.lastLoginAt) : '-';

      tr.innerHTML = `
        <td title="${user.email}">${user.email}</td>
        <td>${user.nickname || user.displayName || '-'}</td>
        <td>${planBadge}</td>
        <td class="expiry-date ${expiryInfo.status}">${expiryInfo.text}</td>
        <td>${createdAt}</td>
        <td>${lastLoginAt}</td>
        <td><button class="edit-btn" data-index="${index}">수정</button></td>
      `;

      usersListBody.appendChild(tr);
    });

    // 수정 버튼 이벤트 연결
    usersListBody.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        openUserPlanModal(allUsersList[index]);
      });
    });
  }

  /**
   * 만료일 정보 가져오기
   */
  function getExpiryInfo(expiry, plan) {
    if (plan === 'free' || !expiry) {
      return { text: '-', status: '' };
    }

    let expiryDate;
    if (expiry.toDate) {
      expiryDate = expiry.toDate();
    } else if (expiry.seconds) {
      expiryDate = new Date(expiry.seconds * 1000);
    } else if (typeof expiry === 'string') {
      expiryDate = new Date(expiry);
    } else {
      return { text: '-', status: '' };
    }

    const now = new Date();
    const diffDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

    const year = expiryDate.getFullYear();
    const month = (expiryDate.getMonth() + 1).toString().padStart(2, '0');
    const day = expiryDate.getDate().toString().padStart(2, '0');
    const dateText = `${year}-${month}-${day}`;

    if (diffDays < 0) {
      return { text: `${dateText} (만료)`, status: 'expired' };
    } else if (diffDays <= 7) {
      return { text: `${dateText} (${diffDays}일 남음)`, status: 'soon' };
    } else {
      return { text: `${dateText} (${diffDays}일 남음)`, status: 'active' };
    }
  }

  /**
   * 유저 플랜 수정 모달 열기
   */
  function openUserPlanModal(user) {
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserEmail').textContent = user.email;
    document.getElementById('editUserNickname').textContent = user.nickname || user.displayName || '-';

    // 현재 플랜 표시
    let currentPlanText = '무료';
    if (user.plan === 'pro') currentPlanText = '프로 (Pro)';
    else if (user.plan === 'unlimited') currentPlanText = '무제한 (Unlimited)';
    document.getElementById('editCurrentPlan').textContent = currentPlanText;

    // 플랜 선택 설정
    document.getElementById('editPlanSelect').value = user.plan || 'free';

    // 만료일 설정
    const expiryInput = document.getElementById('editPlanExpiry');
    if (user.planExpiry) {
      let expiryDate;
      if (user.planExpiry.toDate) {
        expiryDate = user.planExpiry.toDate();
      } else if (user.planExpiry.seconds) {
        expiryDate = new Date(user.planExpiry.seconds * 1000);
      } else if (typeof user.planExpiry === 'string') {
        expiryDate = new Date(user.planExpiry);
      }

      if (expiryDate) {
        const year = expiryDate.getFullYear();
        const month = (expiryDate.getMonth() + 1).toString().padStart(2, '0');
        const day = expiryDate.getDate().toString().padStart(2, '0');
        expiryInput.value = `${year}-${month}-${day}`;
      } else {
        expiryInput.value = '';
      }
    } else {
      // 기본값: 3개월 후
      const defaultExpiry = new Date();
      defaultExpiry.setMonth(defaultExpiry.getMonth() + 3);
      const year = defaultExpiry.getFullYear();
      const month = (defaultExpiry.getMonth() + 1).toString().padStart(2, '0');
      const day = defaultExpiry.getDate().toString().padStart(2, '0');
      expiryInput.value = `${year}-${month}-${day}`;
    }

    userPlanModal.style.display = 'flex';
  }

  /**
   * 유저 플랜 수정 모달 닫기
   */
  function closeUserPlanModalFunc() {
    userPlanModal.style.display = 'none';
  }

  /**
   * 유저 플랜 저장
   */
  async function saveUserPlanFunc() {
    const userId = document.getElementById('editUserId').value;
    const newPlan = document.getElementById('editPlanSelect').value;
    const expiryValue = document.getElementById('editPlanExpiry').value;

    if (!userId) {
      alert('유저 정보가 없습니다.');
      return;
    }

    saveUserPlan.disabled = true;
    saveUserPlan.textContent = '저장 중...';

    try {
      // Firebase Firestore에 직접 업데이트
      const updateData = {
        plan: newPlan,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // 무료가 아닌 경우에만 만료일 설정
      if (newPlan !== 'free' && expiryValue) {
        updateData.planExpiry = new Date(expiryValue);
      } else if (newPlan === 'free') {
        updateData.planExpiry = null;
      }

      await firebase.firestore().collection('users').doc(userId).update(updateData);

      alert('플랜이 변경되었습니다.');
      closeUserPlanModalFunc();

      // 목록 새로고침
      loadUsersList();

    } catch (error) {
      console.error('플랜 저장 오류:', error);
      alert('플랜 저장 중 오류가 발생했습니다: ' + error.message);
    } finally {
      saveUserPlan.disabled = false;
      saveUserPlan.textContent = '저장';
    }
  }

  /**
   * Firebase Timestamp 포맷
   */
  function formatFirebaseTimestamp(timestamp) {
    if (!timestamp) return '-';

    let date;
    if (timestamp.toDate) {
      // Firestore Timestamp 객체
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      // seconds 필드가 있는 경우
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return '-';
    }

    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${month}/${day} ${hours}:${minutes}`;
  }

  // 유저 목록 로드 버튼 이벤트
  if (loadUsersListBtn) {
    loadUsersListBtn.addEventListener('click', loadUsersList);
  }

  // 유저 플랜 모달 이벤트
  if (closeUserPlanModal) {
    closeUserPlanModal.addEventListener('click', closeUserPlanModalFunc);
  }
  if (cancelUserPlan) {
    cancelUserPlan.addEventListener('click', closeUserPlanModalFunc);
  }
  if (saveUserPlan) {
    saveUserPlan.addEventListener('click', saveUserPlanFunc);
  }
  if (userPlanModal) {
    userPlanModal.addEventListener('click', function(e) {
      if (e.target === userPlanModal) {
        closeUserPlanModalFunc();
      }
    });
  }

  // ==================== 사용자 학습 데이터 ====================

  const loadUsersDataBtn = document.getElementById('loadUsersDataBtn');
  const usersDataCount = document.getElementById('usersDataCount');
  const usersDataBody = document.getElementById('usersDataBody');

  let allUsersData = [];

  /**
   * 사용자 학습 데이터 로드
   */
  async function loadUsersLearningData() {
    loadUsersDataBtn.disabled = true;
    loadUsersDataBtn.innerHTML = '<span class="btn-icon">⏳</span> 불러오는 중...';

    try {
      // Firebase 토큰 갱신
      await refreshFirebaseToken();

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'getAllUsersLearningData'
        }, resolve);
      });

      if (!response || !response.success) {
        throw new Error(response?.error || '데이터 로드 실패');
      }

      allUsersData = response.usersData || [];
      usersDataCount.textContent = `총 ${allUsersData.length}명의 사용자`;
      renderUsersTable();

    } catch (error) {
      console.error('사용자 데이터 로드 오류:', error);
      alert('데이터 로드 중 오류가 발생했습니다: ' + error.message);
    } finally {
      loadUsersDataBtn.disabled = false;
      loadUsersDataBtn.innerHTML = '<span class="btn-icon">🔄</span> 데이터 불러오기';
    }
  }

  /**
   * 사용자 테이블 렌더링
   */
  function renderUsersTable() {
    if (allUsersData.length === 0) {
      usersDataBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="7">학습 데이터가 있는 사용자가 없습니다</td>
        </tr>
      `;
      return;
    }

    usersDataBody.innerHTML = '';

    allUsersData.forEach((userData, index) => {
      const data = userData.data || {};
      const tr = document.createElement('tr');

      // 주요 스타일 추출
      const topStyle = getTopItem(data.style?.writingStyles) || '-';
      // 주요 업종 추출
      const topIndustry = getTopIndustry(data.industries) || '-';

      tr.innerHTML = `
        <td class="user-id" title="${userData.userId}">${userData.userId.substring(0, 12)}...</td>
        <td>${data.totalAnalyzed || 0}</td>
        <td>${data.seo?.avgScore ? Math.round(data.seo.avgScore) : '-'}</td>
        <td>${topStyle}</td>
        <td>${topIndustry}</td>
        <td>${data.lastUpdated ? formatDateTime(data.lastUpdated) : '-'}</td>
        <td>
          <button class="view-btn" data-index="${index}">상세보기</button>
        </td>
      `;

      usersDataBody.appendChild(tr);
    });

    // 상세보기 버튼 이벤트
    usersDataBody.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        showLearningDetail(allUsersData[index]);
      });
    });
  }

  /**
   * 가장 많은 항목 반환
   */
  function getTopItem(obj) {
    if (!obj) return null;
    const entries = Object.entries(obj);
    if (entries.length === 0) return null;
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return sorted[0][0];
  }

  /**
   * 상위 업종 반환
   */
  function getTopIndustry(industries) {
    if (!industries) return null;
    const entries = Object.entries(industries);
    if (entries.length === 0) return null;
    const sorted = entries.sort((a, b) => b[1].count - a[1].count);
    return sorted[0][0];
  }

  /**
   * 학습 데이터 상세 모달 표시
   */
  function showLearningDetail(userData) {
    const modal = document.getElementById('learningDetailModal');
    const content = document.getElementById('learningDetailContent');
    const data = userData.data || {};

    content.innerHTML = `
      <div class="learning-detail-section">
        <h4>기본 정보</h4>
        <div class="learning-detail-grid">
          <div class="learning-detail-item">
            <label>사용자 ID</label>
            <value>${userData.userId}</value>
          </div>
          <div class="learning-detail-item">
            <label>총 분석 횟수</label>
            <value>${data.totalAnalyzed || 0}회</value>
          </div>
          <div class="learning-detail-item">
            <label>마지막 업데이트</label>
            <value>${data.lastUpdated ? formatDateTime(data.lastUpdated) : '-'}</value>
          </div>
          <div class="learning-detail-item">
            <label>평균 SEO 점수</label>
            <value>${data.seo?.avgScore ? Math.round(data.seo.avgScore) + '점' : '-'}</value>
          </div>
        </div>
      </div>

      <div class="learning-detail-section">
        <h4>구조 패턴</h4>
        <div class="learning-detail-grid">
          <div class="learning-detail-item">
            <label>서론 비율</label>
            <value>${Math.round(data.structure?.avgIntroPercent || 0)}%</value>
          </div>
          <div class="learning-detail-item">
            <label>본론 비율</label>
            <value>${Math.round(data.structure?.avgBodyPercent || 0)}%</value>
          </div>
          <div class="learning-detail-item">
            <label>결론 비율</label>
            <value>${Math.round(data.structure?.avgConclusionPercent || 0)}%</value>
          </div>
          <div class="learning-detail-item">
            <label>평균 문단 길이</label>
            <value>${Math.round(data.structure?.avgParagraphLength || 0)}자</value>
          </div>
          <div class="learning-detail-item">
            <label>평균 소제목 수</label>
            <value>${Math.round(data.structure?.avgSubheadingCount || 0)}개</value>
          </div>
          <div class="learning-detail-item">
            <label>평균 이미지 수</label>
            <value>${Math.round(data.structure?.avgImageCount || 0)}개</value>
          </div>
        </div>
      </div>

      <div class="learning-detail-section">
        <h4>스타일 패턴</h4>
        <div class="learning-detail-grid">
          <div class="learning-detail-item">
            <label>주요 문체</label>
            <value>${getTopItem(data.style?.writingStyles) || '-'}</value>
          </div>
          <div class="learning-detail-item">
            <label>주요 어조</label>
            <value>${getTopItem(data.style?.tones) || '-'}</value>
          </div>
          <div class="learning-detail-item">
            <label>주요 훅 타입</label>
            <value>${getTopItem(data.style?.hookTypes) || '-'}</value>
          </div>
          <div class="learning-detail-item">
            <label>평균 이모지</label>
            <value>${Math.round(data.style?.avgEmojiCount || 0)}개</value>
          </div>
        </div>
      </div>

      <div class="learning-detail-section">
        <h4>키워드 전략</h4>
        <div class="learning-detail-grid">
          <div class="learning-detail-item">
            <label>평균 키워드 밀도</label>
            <value>${(data.keywords?.avgDensity || 0).toFixed(1)}%</value>
          </div>
          <div class="learning-detail-item">
            <label>평균 서브키워드</label>
            <value>${Math.round(data.keywords?.avgSubKeywordCount || 0)}개</value>
          </div>
          <div class="learning-detail-item">
            <label>평균 태그 수</label>
            <value>${Math.round(data.keywords?.avgTagCount || 0)}개</value>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  }

  // 학습 데이터 모달 닫기
  document.getElementById('closeLearningModal').addEventListener('click', () => {
    document.getElementById('learningDetailModal').style.display = 'none';
  });

  document.getElementById('learningDetailModal').addEventListener('click', (e) => {
    if (e.target.id === 'learningDetailModal') {
      e.target.style.display = 'none';
    }
  });

  // ==================== 생성된 글 목록 ====================

  const loadPostsBtn = document.getElementById('loadPostsBtn');
  const postsCount = document.getElementById('postsCount');
  const postsList = document.getElementById('postsList');

  let allPosts = [];

  /**
   * 생성된 글 목록 로드
   */
  async function loadGeneratedPosts() {
    loadPostsBtn.disabled = true;
    loadPostsBtn.innerHTML = '<span class="btn-icon">⏳</span> 불러오는 중...';

    try {
      // Firebase 토큰 갱신
      await refreshFirebaseToken();

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'getAllGeneratedPosts',
          limit: 100
        }, resolve);
      });

      if (!response || !response.success) {
        throw new Error(response?.error || '글 목록 로드 실패');
      }

      allPosts = response.posts || [];
      postsCount.textContent = `총 ${allPosts.length}개의 글`;
      renderPostsList();

    } catch (error) {
      console.error('글 목록 로드 오류:', error);
      alert('글 목록 로드 중 오류가 발생했습니다: ' + error.message);
    } finally {
      loadPostsBtn.disabled = false;
      loadPostsBtn.innerHTML = '<span class="btn-icon">🔄</span> 글 목록 불러오기';
    }
  }

  /**
   * 글 목록 렌더링
   */
  function renderPostsList() {
    if (allPosts.length === 0) {
      postsList.innerHTML = '<div class="empty-message">생성된 글이 없습니다</div>';
      return;
    }

    postsList.innerHTML = '';

    allPosts.forEach((post, index) => {
      const item = document.createElement('div');
      item.className = 'post-item';

      // 제목 추출 (##제목: 형식에서)
      let title = '제목 없음';
      const titleMatch = post.content?.match(/##\s*제목[:\s]*(.+)/);
      if (titleMatch) {
        title = titleMatch[1].trim();
      } else if (post.title) {
        title = post.title;
      }

      // 미리보기 텍스트
      let preview = post.content?.substring(0, 200).replace(/##[^\n]+/g, '').trim() || '';

      item.innerHTML = `
        <div class="post-item-header">
          <div>
            <div class="post-item-title">${escapeHtml(title)}</div>
            <div class="post-item-meta">${formatDateTime(post.createdAt)}</div>
          </div>
          <span class="post-item-user">${post.userId?.substring(0, 8) || 'unknown'}...</span>
        </div>
        <div class="post-item-preview">${escapeHtml(preview)}...</div>
        <div class="post-item-actions">
          <button class="view-post-btn" data-index="${index}">전체 보기</button>
          <button class="copy-post-btn" data-index="${index}">복사</button>
        </div>
      `;

      postsList.appendChild(item);
    });

    // 전체 보기 버튼 이벤트
    postsList.querySelectorAll('.view-post-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        showPostDetail(allPosts[index]);
      });
    });

    // 복사 버튼 이벤트
    postsList.querySelectorAll('.copy-post-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        navigator.clipboard.writeText(allPosts[index].content || '').then(() => {
          this.textContent = '복사됨!';
          setTimeout(() => { this.textContent = '복사'; }, 1500);
        });
      });
    });
  }

  /**
   * 글 상세 모달 표시
   */
  function showPostDetail(post) {
    const modal = document.getElementById('postDetailModal');
    const titleEl = document.getElementById('postDetailTitle');
    const contentEl = document.getElementById('postDetailContent');

    // 제목 추출
    let title = '생성된 글';
    const titleMatch = post.content?.match(/##\s*제목[:\s]*(.+)/);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    titleEl.textContent = title;
    contentEl.textContent = post.content || '내용 없음';

    // 복사 버튼 설정
    document.getElementById('copyPostContent').onclick = () => {
      navigator.clipboard.writeText(post.content || '').then(() => {
        alert('내용이 복사되었습니다.');
      });
    };

    modal.style.display = 'flex';
  }

  // 글 모달 닫기
  document.getElementById('closePostModal').addEventListener('click', () => {
    document.getElementById('postDetailModal').style.display = 'none';
  });

  document.getElementById('postDetailModal').addEventListener('click', (e) => {
    if (e.target.id === 'postDetailModal') {
      e.target.style.display = 'none';
    }
  });

  /**
   * HTML 이스케이프
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 날짜/시간 포맷
   */
  function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  // 이벤트 리스너 (인증은 상단 독립 핸들러에서 처리)
  generateCodeBtn.addEventListener('click', generateCodes);
  copyAllCodes.addEventListener('click', copyAllCodesHandler);

  searchCode.addEventListener('input', function() {
    updateTable(this.value);
  });

  cleanExpiredBtn.addEventListener('click', cleanExpiredCodes);
  changePasswordBtn.addEventListener('click', changePassword);
  saveServerApiBtn.addEventListener('click', saveServerApiKey);

  // YouTube API 키 저장 버튼
  const saveYouTubeApiBtn = document.getElementById('saveYouTubeApiBtn');
  if (saveYouTubeApiBtn) {
    saveYouTubeApiBtn.addEventListener('click', saveYouTubeApiKeys);
  }

  // 사용자 데이터 및 글 목록 로드 버튼
  loadUsersDataBtn.addEventListener('click', loadUsersLearningData);
  loadPostsBtn.addEventListener('click', loadGeneratedPosts);
});
