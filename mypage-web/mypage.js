/**
 * 블로그 부스터 Pro - 웹 마이페이지
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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const LOGIN_URL = 'https://login-web-five.vercel.app';

document.addEventListener('DOMContentLoaded', function() {
  // DOM 요소
  var loadingScreen = document.getElementById('loadingScreen');
  var mainContent = document.getElementById('mainContent');
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

  var currentUser = null;
  var currentUserData = null;
  var currentPostContent = '';

  // 인증 상태 감시 - 로그인 안 되어 있으면 로그인 페이지로
  auth.onAuthStateChanged(async function(user) {
    if (!user) {
      window.location.href = LOGIN_URL;
      return;
    }

    currentUser = user;
    await loadUserData();
    showMainContent();
  });

  /**
   * 사용자 데이터 로드 (Firestore 직접)
   */
  async function loadUserData() {
    try {
      var doc = await db.collection('users').doc(currentUser.uid).get();
      if (doc.exists) {
        currentUserData = doc.data();
      } else {
        currentUserData = {};
      }

      displayProfile();
      await loadLearningData();
      await loadGeneratedPosts();
      updateStats();
    } catch (error) {
      console.error('사용자 데이터 로드 오류:', error);
    }
  }

  /**
   * 프로필 정보 표시
   */
  function displayProfile() {
    var data = currentUserData || {};

    profileName.textContent = data.nickname || data.displayName || currentUser.displayName || '사용자';
    profileEmail.textContent = currentUser.email || '';

    var plan = data.plan || 'free';
    var planText = plan === 'free' ? '무료 플랜' :
                   plan === 'pro' ? 'PRO 플랜' :
                   plan === 'unlimited' ? '무제한 플랜' :
                   plan === 'premium' ? 'Premium 플랜' : '무료 플랜';
    profilePlan.textContent = planText;
    profilePlan.className = 'plan-badge ' + plan;

    // 플랜 만료일
    if (data.planExpiry) {
      var expiryDate;
      if (data.planExpiry.toDate) expiryDate = data.planExpiry.toDate();
      else if (data.planExpiry.seconds) expiryDate = new Date(data.planExpiry.seconds * 1000);
      else if (typeof data.planExpiry === 'string') expiryDate = new Date(data.planExpiry);

      if (expiryDate) {
        var daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        planExpiry.textContent = daysLeft > 0 ? daysLeft + '일 남음' : '만료됨';
      }
    }

    infoName.textContent = data.name || '-';
    infoNickname.textContent = data.nickname || data.displayName || '-';
    infoEmail.textContent = currentUser.email || '-';
    infoCreatedAt.textContent = formatTimestamp(data.createdAt) || '-';
    infoLastLogin.textContent = formatTimestamp(data.lastLoginAt) || '-';
  }

  /**
   * 학습 데이터 로드 (Firestore 직접)
   */
  async function loadLearningData() {
    try {
      var doc = await db.collection('learningData').doc(currentUser.uid).get();
      if (doc.exists) {
        displayLearningData(doc.data());
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

    summaryTotal.textContent = totalAnalyzed + '개';
    statLearned.textContent = totalAnalyzed;

    if (totalAnalyzed > 0) {
      var totalSeo = analyzedBlogs.reduce(function(sum, blog) {
        return sum + (blog.seoScore || 0);
      }, 0);
      var avgSeo = Math.round(totalSeo / totalAnalyzed);
      summaryAvgSeo.textContent = avgSeo + '점';

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
   * 생성된 글 로드 (Firestore 직접)
   */
  async function loadGeneratedPosts() {
    try {
      var snapshot = await db.collection('generatedPosts')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      var posts = [];
      snapshot.forEach(function(doc) {
        posts.push({ id: doc.id, ...doc.data() });
      });

      displayGeneratedPosts(posts);
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

        return '<div class="list-item" data-post-id="' + post.id + '">' +
          '<span class="item-icon">' + icon + '</span>' +
          '<div class="item-content">' +
            '<div class="item-title">' + escapeHtml(post.title || '제목 없음') + '</div>' +
            '<div class="item-meta">' +
              '<span>' + formatTimestamp(post.createdAt) + '</span>' +
              '<span class="item-badge ' + badgeClass + '">' + badgeText + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      postsList.innerHTML = listHtml;

      postsList.querySelectorAll('.list-item').forEach(function(item) {
        item.addEventListener('click', function() {
          var post = posts.find(function(p) { return p.id === item.dataset.postId; });
          if (post) showPostDetail(post);
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
    var usageCount = (currentUserData && currentUserData.usageCount) || 0;
    statUsageCount.textContent = usageCount;
  }

  /**
   * 글 상세 보기
   */
  function showPostDetail(post) {
    modalTitle.textContent = post.title || '생성된 글';
    var isYoutube = post.type === 'youtube';
    var typeText = isYoutube ? 'YouTube 변환' : '블로그 생성';
    modalMeta.innerHTML = '<span class="meta-date">' + formatTimestamp(post.createdAt) + '</span>' +
      '<span class="meta-type">' + typeText + '</span>';
    modalContent.textContent = post.content || '내용 없음';
    currentPostContent = post.content || '';
    postDetailModal.style.display = 'flex';
  }

  function hidePostDetail() {
    postDetailModal.style.display = 'none';
  }

  function copyPost() {
    if (currentPostContent) {
      navigator.clipboard.writeText(currentPostContent).then(function() {
        showToast('클립보드에 복사되었습니다.');
      }).catch(function() {
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
      await auth.sendPasswordResetEmail(currentUser.email);
      showToast('비밀번호 재설정 이메일이 전송되었습니다.');
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
      await auth.signOut();
      window.location.href = LOGIN_URL;
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
      await db.collection('learningData').doc(currentUser.uid).set({
        analyzedBlogs: [],
        stylePatterns: {},
        keywordPatterns: {},
        structurePatterns: {},
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast('학습 데이터가 초기화되었습니다.');

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

  function showMainContent() {
    loadingScreen.style.display = 'none';
    mainContent.style.display = 'block';
  }

  function showToast(message) {
    var toast = document.getElementById('toast');
    var toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.style.display = 'block';
    setTimeout(function() { toast.style.display = 'none'; }, 3000);
  }

  /**
   * Firestore Timestamp 포맷팅
   */
  function formatTimestamp(ts) {
    if (!ts) return '-';
    var d;
    if (ts.toDate) d = ts.toDate();
    else if (ts.seconds) d = new Date(ts.seconds * 1000);
    else if (typeof ts === 'string') d = new Date(ts);
    else if (typeof ts === 'number') d = new Date(ts);
    else return '-';

    if (isNaN(d.getTime())) return '-';

    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hours = String(d.getHours()).padStart(2, '0');
    var minutes = String(d.getMinutes()).padStart(2, '0');
    return year + '.' + month + '.' + day + ' ' + hours + ':' + minutes;
  }

  function formatDate(dateValue) {
    return formatTimestamp(dateValue);
  }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 이벤트 리스너
  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchTab(btn.dataset.tab);
    });
  });

  resetPasswordBtn.addEventListener('click', resetPassword);
  logoutBtn.addEventListener('click', logout);
  clearLearningBtn.addEventListener('click', clearLearningData);

  modalClose.addEventListener('click', hidePostDetail);
  closeModalBtn.addEventListener('click', hidePostDetail);
  copyPostBtn.addEventListener('click', copyPost);
  postDetailModal.addEventListener('click', function(e) {
    if (e.target === postDetailModal) hidePostDetail();
  });
});
