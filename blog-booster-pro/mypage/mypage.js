/**
 * 마이페이지 스크립트
 */

document.addEventListener('DOMContentLoaded', async function() {
  // DOM 요소
  var loadingScreen = document.getElementById('loadingScreen');
  var mainContent = document.getElementById('mainContent');
  var backBtn = document.getElementById('backBtn');
  var tabBtns = document.querySelectorAll('.tab-btn');
  var tabPanes = document.querySelectorAll('.tab-pane');

  // 프로필 요소
  var profileName = document.getElementById('profileName');
  var profileEmail = document.getElementById('profileEmail');
  var profilePlan = document.getElementById('profilePlan');
  var planExpiry = document.getElementById('planExpiry');

  // 정보 요소
  var infoName = document.getElementById('infoName');
  var infoNickname = document.getElementById('infoNickname');
  var infoEmail = document.getElementById('infoEmail');
  var infoCreatedAt = document.getElementById('infoCreatedAt');
  var infoLastLogin = document.getElementById('infoLastLogin');

  // 통계 요소
  var statLearned = document.getElementById('statLearned');
  var statGenerated = document.getElementById('statGenerated');
  var statUsageCount = document.getElementById('statUsageCount');

  // 학습 요소
  var summaryTotal = document.getElementById('summaryTotal');
  var summaryAvgSeo = document.getElementById('summaryAvgSeo');
  var summaryStyle = document.getElementById('summaryStyle');
  var learningList = document.getElementById('learningList');

  // 글 목록 요소
  var postCount = document.getElementById('postCount');
  var postsList = document.getElementById('postsList');

  // 버튼 요소
  var resetPasswordBtn = document.getElementById('resetPasswordBtn');
  var logoutBtn = document.getElementById('logoutBtn');
  var clearLearningBtn = document.getElementById('clearLearningBtn');

  // 모달 요소
  var postDetailModal = document.getElementById('postDetailModal');
  var modalTitle = document.getElementById('modalTitle');
  var modalMeta = document.getElementById('modalMeta');
  var modalContent = document.getElementById('modalContent');
  var modalClose = document.getElementById('modalClose');
  var closeModalBtn = document.getElementById('closeModalBtn');
  var copyPostBtn = document.getElementById('copyPostBtn');

  // 현재 사용자 정보
  var currentUser = null;
  var currentUserData = null;
  var currentPostContent = '';

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
      var result = await chrome.storage.local.get(['isLoggedIn', 'userInfo']);

      if (!result.isLoggedIn || !result.userInfo) {
        // 로그인 페이지로 이동
        window.location.href = chrome.runtime.getURL('auth/login.html');
        return;
      }

      currentUser = result.userInfo;
      await loadUserData();
      showMainContent();
    } catch (error) {
      console.error('로그인 상태 확인 오류:', error);
      showToast('오류가 발생했습니다.');
    }
  }

  /**
   * 사용자 데이터 로드
   */
  async function loadUserData() {
    try {
      // Firebase에서 사용자 상세 정보 가져오기 (firebase-config.js 사용)
      if (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.initializeFirebase()) {
        var firebaseUser = FirebaseAuth.getCurrentUser();
        if (firebaseUser) {
          var userData = await FirebaseAuth.getUserData(firebaseUser.uid);
          if (userData.success) {
            currentUserData = userData.data;
          }
        }
      }

      // 프로필 정보 표시
      displayProfile();

      // 학습 데이터 로드
      await loadLearningData();

      // 생성된 글 로드
      await loadGeneratedPosts();

      // 통계 업데이트
      updateStats();

    } catch (error) {
      console.error('사용자 데이터 로드 오류:', error);
    }
  }

  /**
   * 프로필 정보 표시
   */
  function displayProfile() {
    var user = currentUser;
    var data = currentUserData || {};

    // 상단 프로필
    profileName.textContent = data.nickname || data.displayName || user.displayName || '사용자';
    profileEmail.textContent = user.email || '';

    // 플랜 정보
    var plan = user.plan || data.plan || 'free';
    var planText = plan === 'free' ? '무료 플랜' :
                   plan === 'pro' ? 'PRO 플랜' :
                   plan === 'premium' ? 'Premium 플랜' : '무료 플랜';
    profilePlan.textContent = planText;
    profilePlan.className = 'plan-badge ' + plan;

    // 플랜 만료일 (있으면)
    if (data.planExpiresAt) {
      var expiryDate = new Date(data.planExpiresAt);
      var now = new Date();
      var daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0) {
        planExpiry.textContent = daysLeft + '일 남음';
      } else {
        planExpiry.textContent = '만료됨';
      }
    }

    // 상세 정보
    infoName.textContent = data.name || '-';
    infoNickname.textContent = data.nickname || data.displayName || '-';
    infoEmail.textContent = user.email || '-';
    infoCreatedAt.textContent = formatDate(data.createdAt) || '-';
    infoLastLogin.textContent = formatDate(data.lastLoginAt) || '-';
  }

  /**
   * 학습 데이터 로드
   */
  async function loadLearningData() {
    try {
      var response = await new Promise(function(resolve) {
        chrome.runtime.sendMessage({
          action: 'loadLearningDataFromFirebase',
          userId: currentUser.uid
        }, resolve);
      });

      if (response && response.success && response.data) {
        displayLearningData(response.data);
      } else {
        // 로컬 스토리지에서 시도
        var localResult = await chrome.storage.local.get(['learningData']);
        if (localResult.learningData) {
          displayLearningData(localResult.learningData);
        }
      }
    } catch (error) {
      console.error('학습 데이터 로드 오류:', error);
    }
  }

  /**
   * 학습 데이터 표시
   */
  function displayLearningData(data) {
    var analyzedBlogs = data.analyzedBlogs || [];
    var totalAnalyzed = analyzedBlogs.length;

    // 요약 정보
    summaryTotal.textContent = totalAnalyzed + '개';
    statLearned.textContent = totalAnalyzed;

    if (totalAnalyzed > 0) {
      // 평균 SEO 점수 계산
      var totalSeo = analyzedBlogs.reduce(function(sum, blog) {
        return sum + (blog.seoScore || 0);
      }, 0);
      var avgSeo = Math.round(totalSeo / totalAnalyzed);
      summaryAvgSeo.textContent = avgSeo + '점';

      // 선호 스타일 (가장 많이 사용된)
      var styleCounts = {};
      analyzedBlogs.forEach(function(blog) {
        var style = blog.writingStyle || 'casual';
        styleCounts[style] = (styleCounts[style] || 0) + 1;
      });
      var topStyle = Object.keys(styleCounts).reduce(function(a, b) {
        return styleCounts[a] > styleCounts[b] ? a : b;
      }, 'casual');
      var styleNames = {
        'formal': '정중한 존댓말',
        'casual': '친근한 해요체',
        'informal': '편안한 반말'
      };
      summaryStyle.textContent = styleNames[topStyle] || topStyle;

      // 학습 목록 표시
      var listHtml = analyzedBlogs.slice(0, 20).map(function(blog, index) {
        return '<div class="list-item" data-index="' + index + '">' +
          '<span class="item-icon">📄</span>' +
          '<div class="item-content">' +
            '<div class="item-title">' + escapeHtml(blog.title || '제목 없음') + '</div>' +
            '<div class="item-meta">' +
              '<span>' + formatDate(blog.analyzedAt) + '</span>' +
              '<span class="item-badge seo">SEO ' + (blog.seoScore || 0) + '점</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      learningList.innerHTML = listHtml;
    } else {
      learningList.innerHTML = '<div class="empty-state">' +
        '<span class="empty-icon">🧠</span>' +
        '<p>아직 학습된 글이 없습니다.</p>' +
        '<p class="empty-hint">블로그를 분석할 때 "분석 + 학습"을 선택하면 AI가 학습합니다.</p>' +
      '</div>';
    }
  }

  /**
   * 생성된 글 로드
   */
  async function loadGeneratedPosts() {
    try {
      var response = await new Promise(function(resolve) {
        chrome.runtime.sendMessage({
          action: 'getGeneratedPosts',
          userId: currentUser.uid,
          limit: 50
        }, resolve);
      });

      if (response && response.success && response.posts) {
        displayGeneratedPosts(response.posts);
      }
    } catch (error) {
      console.error('생성된 글 로드 오류:', error);
    }
  }

  /**
   * 생성된 글 표시
   */
  function displayGeneratedPosts(posts) {
    var totalPosts = posts.length;
    postCount.textContent = totalPosts + '개';
    statGenerated.textContent = totalPosts;

    if (totalPosts > 0) {
      var listHtml = posts.map(function(post) {
        var isYoutube = post.type === 'youtube';
        var icon = isYoutube ? '📺' : '📝';
        var badgeClass = isYoutube ? 'youtube' : 'blog';
        var badgeText = isYoutube ? 'YouTube' : '블로그';

        return '<div class="list-item" data-post-id="' + post.id + '" data-content="' + escapeHtml(post.content || '') + '">' +
          '<span class="item-icon">' + icon + '</span>' +
          '<div class="item-content">' +
            '<div class="item-title">' + escapeHtml(post.title || '제목 없음') + '</div>' +
            '<div class="item-meta">' +
              '<span>' + formatDate(post.createdAt) + '</span>' +
              '<span class="item-badge ' + badgeClass + '">' + badgeText + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      postsList.innerHTML = listHtml;

      // 클릭 이벤트 추가
      postsList.querySelectorAll('.list-item').forEach(function(item) {
        item.addEventListener('click', function() {
          var post = posts.find(function(p) { return p.id === item.dataset.postId; });
          if (post) {
            showPostDetail(post);
          }
        });
      });
    } else {
      postsList.innerHTML = '<div class="empty-state">' +
        '<span class="empty-icon">📝</span>' +
        '<p>아직 생성된 글이 없습니다.</p>' +
        '<p class="empty-hint">블로그를 분석 후 AI로 글을 생성해보세요.</p>' +
      '</div>';
    }
  }

  /**
   * 통계 업데이트
   */
  function updateStats() {
    var usageCount = currentUserData?.usageCount || 0;
    statUsageCount.textContent = usageCount;
  }

  /**
   * 글 상세 보기
   */
  function showPostDetail(post) {
    modalTitle.textContent = post.title || '생성된 글';

    var isYoutube = post.type === 'youtube';
    var typeText = isYoutube ? 'YouTube 변환' : '블로그 생성';

    modalMeta.innerHTML = '<span class="meta-date">' + formatDate(post.createdAt) + '</span>' +
      '<span class="meta-type">' + typeText + '</span>';

    modalContent.textContent = post.content || '내용 없음';
    currentPostContent = post.content || '';

    postDetailModal.style.display = 'flex';
  }

  /**
   * 모달 닫기
   */
  function hidePostDetail() {
    postDetailModal.style.display = 'none';
  }

  /**
   * 글 복사
   */
  function copyPost() {
    if (currentPostContent) {
      navigator.clipboard.writeText(currentPostContent).then(function() {
        showToast('클립보드에 복사되었습니다.');
      }).catch(function(err) {
        console.error('복사 실패:', err);
        showToast('복사에 실패했습니다.');
      });
    }
  }

  /**
   * 비밀번호 재설정
   */
  async function resetPassword() {
    if (!currentUser || !currentUser.email) {
      showToast('이메일 정보가 없습니다.');
      return;
    }

    resetPasswordBtn.disabled = true;
    resetPasswordBtn.textContent = '전송 중...';

    try {
      if (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.initializeFirebase()) {
        var result = await FirebaseAuth.sendPasswordReset(currentUser.email);
        if (result.success) {
          showToast('비밀번호 재설정 이메일이 전송되었습니다.');
        } else {
          showToast(result.error || '이메일 전송에 실패했습니다.');
        }
      } else {
        showToast('Firebase가 초기화되지 않았습니다.');
      }
    } catch (error) {
      console.error('비밀번호 재설정 오류:', error);
      showToast('오류가 발생했습니다.');
    } finally {
      resetPasswordBtn.disabled = false;
      resetPasswordBtn.textContent = '비밀번호 재설정 이메일 받기';
    }
  }

  /**
   * 로그아웃
   */
  async function logout() {
    try {
      if (typeof FirebaseAuth !== 'undefined') {
        await FirebaseAuth.signOut();
      }
      await chrome.storage.local.set({
        isLoggedIn: false,
        userInfo: null,
        firebaseIdToken: null,
        firebaseRefreshToken: null,
        firebaseTokenTimestamp: null
      });
      // 로그인 페이지로 이동
      window.location.href = chrome.runtime.getURL('auth/login.html');
    } catch (error) {
      console.error('로그아웃 오류:', error);
      showToast('로그아웃에 실패했습니다.');
    }
  }

  /**
   * 학습 데이터 초기화
   */
  async function clearLearningData() {
    if (!confirm('학습 데이터를 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    clearLearningBtn.disabled = true;
    clearLearningBtn.textContent = '초기화 중...';

    try {
      // 로컬 스토리지 초기화
      await chrome.storage.local.remove(['learningData']);

      // Firebase 초기화 (빈 데이터로 덮어쓰기)
      await new Promise(function(resolve) {
        chrome.runtime.sendMessage({
          action: 'saveLearningDataToFirebase',
          userId: currentUser.uid,
          data: {
            analyzedBlogs: [],
            stylePatterns: {},
            keywordPatterns: {},
            structurePatterns: {},
            updatedAt: new Date().toISOString()
          }
        }, resolve);
      });

      showToast('학습 데이터가 초기화되었습니다.');

      // UI 업데이트
      summaryTotal.textContent = '0개';
      summaryAvgSeo.textContent = '-점';
      summaryStyle.textContent = '-';
      statLearned.textContent = '0';
      learningList.innerHTML = '<div class="empty-state">' +
        '<span class="empty-icon">🧠</span>' +
        '<p>아직 학습된 글이 없습니다.</p>' +
        '<p class="empty-hint">블로그를 분석할 때 "분석 + 학습"을 선택하면 AI가 학습합니다.</p>' +
      '</div>';

    } catch (error) {
      console.error('학습 데이터 초기화 오류:', error);
      showToast('초기화에 실패했습니다.');
    } finally {
      clearLearningBtn.disabled = false;
      clearLearningBtn.textContent = '학습 데이터 초기화';
    }
  }

  /**
   * 탭 전환
   */
  function switchTab(tabId) {
    tabBtns.forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    tabPanes.forEach(function(pane) {
      pane.classList.toggle('active', pane.id === tabId + 'Tab');
    });
  }

  /**
   * 메인 컨텐츠 표시
   */
  function showMainContent() {
    loadingScreen.style.display = 'none';
    mainContent.style.display = 'block';
  }

  /**
   * 토스트 메시지 표시
   */
  function showToast(message) {
    var toast = document.getElementById('toast');
    var toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    toast.style.display = 'block';

    setTimeout(function() {
      toast.style.display = 'none';
    }, 3000);
  }

  /**
   * 날짜 포맷팅
   */
  function formatDate(dateValue) {
    if (!dateValue) return '-';

    var date;
    if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else if (dateValue.seconds) {
      // Firestore Timestamp
      date = new Date(dateValue.seconds * 1000);
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return '-';
    }

    if (isNaN(date.getTime())) return '-';

    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    var hours = String(date.getHours()).padStart(2, '0');
    var minutes = String(date.getMinutes()).padStart(2, '0');

    return year + '.' + month + '.' + day + ' ' + hours + ':' + minutes;
  }

  /**
   * HTML 이스케이프
   */
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== API 키 관리 ====================

  var apiKeyInput = document.getElementById('apiKeyInput');
  var saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
  var deleteApiKeyBtn = document.getElementById('deleteApiKeyBtn');
  var toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');
  var toggleIcon = document.getElementById('toggleIcon');
  var apiKeyStatusValue = document.getElementById('apiKeyStatusValue');

  /**
   * 저장된 API 키 로드
   */
  async function loadApiKey() {
    try {
      var result = await chrome.storage.sync.get(['geminiApiKey']);
      if (result.geminiApiKey) {
        var key = result.geminiApiKey;
        apiKeyInput.value = key;
        apiKeyInput.type = 'password';
        apiKeyStatusValue.textContent = key.substring(0, 4) + '...' + key.substring(key.length - 3);
        apiKeyStatusValue.classList.add('active');
        deleteApiKeyBtn.style.display = 'inline-flex';
      } else {
        apiKeyStatusValue.textContent = '기본 키 사용 중';
        apiKeyStatusValue.classList.remove('active');
        deleteApiKeyBtn.style.display = 'none';
      }
    } catch (error) {
      console.error('API 키 로드 오류:', error);
    }
  }

  /**
   * API 키 저장
   */
  async function saveApiKey() {
    var key = apiKeyInput.value.trim();
    if (!key) {
      showToast('API 키를 입력해주세요.');
      return;
    }

    if (!key.startsWith('AIza')) {
      showToast('올바른 Gemini API 키 형식이 아닙니다.');
      return;
    }

    saveApiKeyBtn.disabled = true;
    saveApiKeyBtn.textContent = '저장 중...';

    try {
      await chrome.storage.sync.set({ geminiApiKey: key });
      apiKeyStatusValue.textContent = key.substring(0, 4) + '...' + key.substring(key.length - 3);
      apiKeyStatusValue.classList.add('active');
      deleteApiKeyBtn.style.display = 'inline-flex';
      showToast('API 키가 저장되었습니다.');
    } catch (error) {
      console.error('API 키 저장 오류:', error);
      showToast('저장에 실패했습니다.');
    } finally {
      saveApiKeyBtn.disabled = false;
      saveApiKeyBtn.textContent = '저장';
    }
  }

  /**
   * API 키 삭제
   */
  async function deleteApiKey() {
    if (!confirm('개인 API 키를 삭제하시겠습니까?\n기본 공유 키로 전환됩니다.')) {
      return;
    }

    try {
      await chrome.storage.sync.remove(['geminiApiKey']);
      apiKeyInput.value = '';
      apiKeyStatusValue.textContent = '기본 키 사용 중';
      apiKeyStatusValue.classList.remove('active');
      deleteApiKeyBtn.style.display = 'none';
      showToast('API 키가 삭제되었습니다.');
    } catch (error) {
      console.error('API 키 삭제 오류:', error);
      showToast('삭제에 실패했습니다.');
    }
  }

  /**
   * API 키 보기/숨기기 토글
   */
  function toggleApiKeyVisibility() {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleIcon.textContent = '🔒';
    } else {
      apiKeyInput.type = 'password';
      toggleIcon.textContent = '👁';
    }
  }

  // 페이지 로드 시 API 키 로드
  loadApiKey();

  /**
   * 뒤로가기
   */
  function goBack() {
    window.close();
  }

  // 이벤트 리스너
  backBtn.addEventListener('click', goBack);

  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchTab(btn.dataset.tab);
    });
  });

  resetPasswordBtn.addEventListener('click', resetPassword);
  logoutBtn.addEventListener('click', logout);
  clearLearningBtn.addEventListener('click', clearLearningData);

  // API 키 이벤트
  saveApiKeyBtn.addEventListener('click', saveApiKey);
  deleteApiKeyBtn.addEventListener('click', deleteApiKey);
  toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);

  // 모달 이벤트
  modalClose.addEventListener('click', hidePostDetail);
  closeModalBtn.addEventListener('click', hidePostDetail);
  copyPostBtn.addEventListener('click', copyPost);
  postDetailModal.addEventListener('click', function(e) {
    if (e.target === postDetailModal) {
      hidePostDetail();
    }
  });

  // 초기화 실행
  init();
});
