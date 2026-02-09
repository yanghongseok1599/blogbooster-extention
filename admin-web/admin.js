/**
 * 블로그 부스터 Pro - 웹 관리자 페이지
 * Firebase Firestore 직접 연동 (실시간)
 */

const firebaseConfig = {
  apiKey: "AIzaSyCsGfW7kYFkTMk-ggAfA3f-rEPagjo9qP4",
  authDomain: "blogbooster-ebac0.firebaseapp.com",
  projectId: "blogbooster-ebac0",
  storageBucket: "blogbooster-ebac0.firebasestorage.app",
  messagingSenderId: "5339252490",
  appId: "1:5339252490:web:0339b7d5b40b6b43eb1cf3"
};

const ADMIN_EMAIL = "ccv1599@gmail.com";

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 실시간 리스너 해제 함수들
let unsubUsers = null;
let unsubCodes = null;

document.addEventListener('DOMContentLoaded', function() {
  const authSection = document.getElementById('authSection');
  const adminMain = document.getElementById('adminMain');
  const adminEmail = document.getElementById('adminEmail');
  const adminPassword = document.getElementById('adminPassword');
  const authBtn = document.getElementById('authBtn');
  const authError = document.getElementById('authError');
  const realtimeBadge = document.getElementById('realtimeBadge');

  // 인증 상태 감시
  auth.onAuthStateChanged(user => {
    if (user && user.email === ADMIN_EMAIL) {
      authSection.style.display = 'none';
      adminMain.style.display = 'flex';
      realtimeBadge.textContent = '🟢 실시간';
      realtimeBadge.classList.add('online');
      startRealtimeListeners();
    } else if (user && user.email !== ADMIN_EMAIL) {
      showAuthError('관리자 계정이 아닙니다.');
      auth.signOut();
    } else {
      authSection.style.display = 'flex';
      adminMain.style.display = 'none';
      realtimeBadge.textContent = '🔴 오프라인';
      realtimeBadge.classList.remove('online');
      stopRealtimeListeners();
    }
  });

  // 로그인
  authBtn.addEventListener('click', login);
  adminPassword.addEventListener('keypress', e => { if (e.key === 'Enter') login(); });
  adminEmail.addEventListener('keypress', e => { if (e.key === 'Enter') adminPassword.focus(); });

  async function login() {
    const email = adminEmail.value.trim();
    const password = adminPassword.value.trim();
    if (!email || !password) { showAuthError('이메일과 비밀번호를 입력하세요.'); return; }

    authBtn.disabled = true;
    authBtn.textContent = '로그인 중...';
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      showAuthError(getAuthError(error.code));
    } finally {
      authBtn.disabled = false;
      authBtn.textContent = '로그인';
    }
  }

  function showAuthError(msg) {
    authError.textContent = msg;
    authError.style.display = 'block';
    setTimeout(() => { authError.style.display = 'none'; }, 4000);
  }

  function getAuthError(code) {
    const m = {
      'auth/user-not-found': '등록되지 않은 이메일입니다.',
      'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
      'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
      'auth/too-many-requests': '너무 많은 시도입니다. 잠시 후 다시 시도하세요.',
      'auth/invalid-email': '유효하지 않은 이메일입니다.'
    };
    return m[code] || '로그인 중 오류가 발생했습니다.';
  }

  // ==================== 실시간 리스너 ====================

  function startRealtimeListeners() {
    listenUsers();
    listenPromoCodes();
  }

  function stopRealtimeListeners() {
    if (unsubUsers) { unsubUsers(); unsubUsers = null; }
    if (unsubCodes) { unsubCodes(); unsubCodes = null; }
  }

  // ==================== 유저 목록 (실시간) ====================

  let allUsers = [];

  function listenUsers() {
    if (unsubUsers) unsubUsers();

    unsubUsers = db.collection('users')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        allUsers = [];
        snapshot.forEach(doc => {
          allUsers.push({ id: doc.id, ...doc.data() });
        });
        updateDashboard();
        renderUsers(allUsers);
      }, error => {
        console.error('유저 리스너 오류:', error);
      });
  }

  function updateDashboard() {
    document.getElementById('totalUsers').textContent = allUsers.length;

    const now = new Date();
    let proCount = 0, freeCount = 0, todayCount = 0;

    allUsers.forEach(u => {
      if (u.plan && u.plan !== 'free') proCount++;
      else freeCount++;

      if (u.lastLoginAt) {
        let loginDate;
        if (u.lastLoginAt.toDate) loginDate = u.lastLoginAt.toDate();
        else if (u.lastLoginAt.seconds) loginDate = new Date(u.lastLoginAt.seconds * 1000);
        if (loginDate && loginDate.toDateString() === now.toDateString()) todayCount++;
      }
    });

    document.getElementById('proUsers').textContent = proCount;
    document.getElementById('freeUsers').textContent = freeCount;
    document.getElementById('todayLogins').textContent = todayCount;
    document.getElementById('usersListCount').textContent = `(${allUsers.length}명)`;
  }

  function renderUsers(users) {
    const body = document.getElementById('usersListBody');
    const searchVal = (document.getElementById('searchUser').value || '').toLowerCase();

    let filtered = users;
    if (searchVal) {
      filtered = users.filter(u =>
        (u.email || '').toLowerCase().includes(searchVal) ||
        (u.nickname || '').toLowerCase().includes(searchVal) ||
        (u.displayName || '').toLowerCase().includes(searchVal)
      );
    }

    if (filtered.length === 0) {
      body.innerHTML = '<tr class="empty-row"><td colspan="7">유저가 없습니다</td></tr>';
      return;
    }

    body.innerHTML = '';
    filtered.forEach((user, idx) => {
      const tr = document.createElement('tr');

      let planBadge;
      if (user.plan === 'unlimited') planBadge = '<span class="plan-badge pro">무제한</span>';
      else if (user.plan === 'pro') planBadge = '<span class="plan-badge pro">PRO</span>';
      else planBadge = '<span class="plan-badge free">무료</span>';

      const expiry = getExpiryInfo(user.planExpiry, user.plan);
      const created = formatTimestamp(user.createdAt);
      const lastLogin = formatTimestamp(user.lastLoginAt);

      tr.innerHTML = `
        <td title="${user.email}">${user.email}</td>
        <td>${user.nickname || user.displayName || '-'}</td>
        <td>${planBadge}</td>
        <td class="expiry-date ${expiry.status}">${expiry.text}</td>
        <td>${created}</td>
        <td>${lastLogin}</td>
        <td><button class="edit-btn" data-id="${user.id}">수정</button></td>
      `;
      body.appendChild(tr);
    });

    body.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const userId = this.dataset.id;
        const user = allUsers.find(u => u.id === userId);
        if (user) openPlanModal(user);
      });
    });
  }

  // 검색
  document.getElementById('searchUser').addEventListener('input', () => renderUsers(allUsers));
  document.getElementById('refreshUsersBtn').addEventListener('click', () => {
    listenUsers();
  });

  // ==================== 프로모션 코드 (실시간) ====================

  let allCodes = [];
  let lastGeneratedCodes = [];

  function listenPromoCodes() {
    if (unsubCodes) unsubCodes();

    unsubCodes = db.collection('promoCodes')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        allCodes = [];
        snapshot.forEach(doc => {
          allCodes.push({ docId: doc.id, ...doc.data() });
        });
        updateCodesTable();
        updateCodeStats();
      }, error => {
        console.error('코드 리스너 오류:', error);
      });
  }

  // 코드 발행
  document.getElementById('generateCodeBtn').addEventListener('click', async function() {
    const count = parseInt(document.getElementById('codeCount').value);
    const expiryHours = parseInt(document.getElementById('codeExpiry').value);
    const benefit = document.getElementById('codeBenefit').value;

    this.disabled = true;
    this.innerHTML = '<span class="btn-icon">⏳</span> 발행 중...';

    try {
      const batch = db.batch();
      const newCodes = [];
      const now = Date.now();

      for (let i = 0; i < count; i++) {
        const code = generatePromoCode();
        const data = {
          code,
          benefit,
          createdAt: now,
          expiresAt: now + (expiryHours * 60 * 60 * 1000),
          status: 'active',
          usedBy: null,
          usedAt: null
        };
        const ref = db.collection('promoCodes').doc();
        batch.set(ref, data);
        newCodes.push(data);
      }

      await batch.commit();
      lastGeneratedCodes = newCodes;
      displayGeneratedCodes(newCodes);
      alert(`${count}개의 프로모션 코드가 발행되었습니다.`);
    } catch (error) {
      console.error('코드 발행 오류:', error);
      alert('코드 발행 중 오류: ' + error.message);
    } finally {
      this.disabled = false;
      this.innerHTML = '<span class="btn-icon">🎟️</span> 코드 발행하기';
    }
  });

  function generatePromoCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'BP-';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }

  function displayGeneratedCodes(codes) {
    const container = document.getElementById('generatedCodes');
    const list = document.getElementById('codesList');
    container.style.display = 'block';
    list.innerHTML = '';

    codes.forEach(c => {
      const item = document.createElement('div');
      item.className = 'code-item';
      item.innerHTML = `
        <span class="code-text">${c.code}</span>
        <button class="copy-btn" data-code="${c.code}" title="복사">📋</button>
      `;
      list.appendChild(item);
    });

    list.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        navigator.clipboard.writeText(this.dataset.code);
        this.textContent = '✓';
        setTimeout(() => { this.textContent = '📋'; }, 1000);
      });
    });
  }

  document.getElementById('copyAllCodes').addEventListener('click', function() {
    const text = lastGeneratedCodes.map(c => c.code).join('\n');
    navigator.clipboard.writeText(text);
    this.textContent = '복사됨!';
    setTimeout(() => { this.textContent = '전체 복사'; }, 1500);
  });

  // 코드 테이블
  function updateCodesTable() {
    const body = document.getElementById('codesTableBody');
    const searchVal = (document.getElementById('searchCode').value || '').toLowerCase();
    const now = Date.now();

    let filtered = allCodes.map(c => {
      if (c.status === 'active' && c.expiresAt < now) return { ...c, status: 'expired' };
      return c;
    });

    if (searchVal) {
      filtered = filtered.filter(c => c.code.toLowerCase().includes(searchVal));
    }

    if (filtered.length === 0) {
      body.innerHTML = '<tr class="empty-row"><td colspan="6">코드가 없습니다</td></tr>';
      return;
    }

    body.innerHTML = '';
    filtered.forEach(c => {
      const tr = document.createElement('tr');
      const benefitText = { 'pro_3months': 'PRO 3개월', 'pro_1month': 'PRO 1개월', 'unlimited_3months': '무제한 3개월' }[c.benefit] || c.benefit;
      const statusClass = c.status === 'active' ? 'active' : c.status === 'used' ? 'used' : 'expired';
      const statusText = c.status === 'active' ? '활성' : c.status === 'used' ? '사용됨' : '만료';

      tr.innerHTML = `
        <td class="code-cell">${c.code}</td>
        <td>${benefitText}</td>
        <td>${formatMs(c.createdAt)}</td>
        <td>${formatMs(c.expiresAt)}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>
          <button class="action-btn copy-action" data-code="${c.code}">📋</button>
          <button class="action-btn delete-action" data-id="${c.docId}">🗑️</button>
        </td>
      `;
      body.appendChild(tr);
    });

    body.querySelectorAll('.copy-action').forEach(btn => {
      btn.addEventListener('click', function() {
        navigator.clipboard.writeText(this.dataset.code);
        this.textContent = '✓';
        setTimeout(() => { this.textContent = '📋'; }, 1000);
      });
    });

    body.querySelectorAll('.delete-action').forEach(btn => {
      btn.addEventListener('click', async function() {
        if (confirm('이 코드를 삭제하시겠습니까?')) {
          await db.collection('promoCodes').doc(this.dataset.id).delete();
        }
      });
    });
  }

  document.getElementById('searchCode').addEventListener('input', updateCodesTable);

  document.getElementById('cleanExpiredBtn').addEventListener('click', async function() {
    const now = Date.now();
    const expired = allCodes.filter(c => c.status === 'expired' || (c.status === 'active' && c.expiresAt < now));
    if (expired.length === 0) { alert('만료된 코드가 없습니다.'); return; }

    if (!confirm(`${expired.length}개의 만료 코드를 삭제하시겠습니까?`)) return;

    const batch = db.batch();
    expired.forEach(c => batch.delete(db.collection('promoCodes').doc(c.docId)));
    await batch.commit();
    alert(`${expired.length}개의 코드가 삭제되었습니다.`);
  });

  function updateCodeStats() {
    const now = Date.now();
    const codes = allCodes.map(c => c.status === 'active' && c.expiresAt < now ? { ...c, status: 'expired' } : c);
    document.getElementById('totalCodes').textContent = codes.length;
    document.getElementById('usedCodes').textContent = codes.filter(c => c.status === 'used').length;
    document.getElementById('activeCodes').textContent = codes.filter(c => c.status === 'active').length;
    document.getElementById('expiredCodes').textContent = codes.filter(c => c.status === 'expired').length;
  }

  // ==================== 유저 플랜 모달 ====================

  const planModal = document.getElementById('userPlanModal');

  function openPlanModal(user) {
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserEmail').textContent = user.email;
    document.getElementById('editUserNickname').textContent = user.nickname || user.displayName || '-';

    let planText = '무료';
    if (user.plan === 'pro') planText = '프로 (Pro)';
    else if (user.plan === 'unlimited') planText = '무제한 (Unlimited)';
    document.getElementById('editCurrentPlan').textContent = planText;
    document.getElementById('editPlanSelect').value = user.plan || 'free';

    const expiryInput = document.getElementById('editPlanExpiry');
    if (user.planExpiry) {
      let d;
      if (user.planExpiry.toDate) d = user.planExpiry.toDate();
      else if (user.planExpiry.seconds) d = new Date(user.planExpiry.seconds * 1000);
      else if (typeof user.planExpiry === 'string') d = new Date(user.planExpiry);
      if (d) expiryInput.value = d.toISOString().split('T')[0];
      else expiryInput.value = '';
    } else {
      const def = new Date();
      def.setMonth(def.getMonth() + 3);
      expiryInput.value = def.toISOString().split('T')[0];
    }

    planModal.style.display = 'flex';
  }

  function closePlanModal() { planModal.style.display = 'none'; }

  document.getElementById('closeUserPlanModal').addEventListener('click', closePlanModal);
  document.getElementById('cancelUserPlan').addEventListener('click', closePlanModal);
  planModal.addEventListener('click', e => { if (e.target === planModal) closePlanModal(); });

  document.getElementById('saveUserPlan').addEventListener('click', async function() {
    const userId = document.getElementById('editUserId').value;
    const newPlan = document.getElementById('editPlanSelect').value;
    const expiryValue = document.getElementById('editPlanExpiry').value;

    this.disabled = true;
    this.textContent = '저장 중...';

    try {
      const updateData = {
        plan: newPlan,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (newPlan !== 'free' && expiryValue) {
        updateData.planExpiry = new Date(expiryValue);
      } else if (newPlan === 'free') {
        updateData.planExpiry = null;
      }

      await db.collection('users').doc(userId).update(updateData);
      alert('플랜이 변경되었습니다.');
      closePlanModal();
    } catch (error) {
      alert('저장 오류: ' + error.message);
    } finally {
      this.disabled = false;
      this.textContent = '저장';
    }
  });

  // ==================== 유틸리티 ====================

  function getExpiryInfo(expiry, plan) {
    if (plan === 'free' || !expiry) return { text: '-', status: '' };

    let d;
    if (expiry.toDate) d = expiry.toDate();
    else if (expiry.seconds) d = new Date(expiry.seconds * 1000);
    else if (typeof expiry === 'string') d = new Date(expiry);
    else return { text: '-', status: '' };

    const diff = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (diff < 0) return { text: `${dateStr} (만료)`, status: 'expired' };
    if (diff <= 7) return { text: `${dateStr} (${diff}일 남음)`, status: 'soon' };
    return { text: `${dateStr} (${diff}일 남음)`, status: 'active' };
  }

  function formatTimestamp(ts) {
    if (!ts) return '-';
    let d;
    if (ts.toDate) d = ts.toDate();
    else if (ts.seconds) d = new Date(ts.seconds * 1000);
    else if (typeof ts === 'string') d = new Date(ts);
    else return '-';

    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${mi}`;
  }

  function formatMs(ms) {
    if (!ms) return '-';
    const d = new Date(ms);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${mi}`;
  }
});
