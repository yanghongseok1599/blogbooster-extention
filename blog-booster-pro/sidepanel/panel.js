/**
 * 블로그 벤치마커 Pro - 사이드패널 스크립트
 */

// 네이버 금칙어 리스트 및 대체어
const NAVER_BANNED_WORDS = {
  // 광고/홍보 관련
  '무료': '부담없는',
  '공짜': '서비스',
  '할인': '혜택',
  '세일': '특가',
  '이벤트': '프로모션',
  '경품': '선물',
  '당첨': '선정',
  '선착순': '조기',
  '한정': '특별',
  '최저가': '합리적인 가격',
  '최고': '우수한',
  '1등': '인기',
  '1위': '상위권',
  '베스트': '추천',
  '대박': '인기있는',
  '완판': '품절',
  '품절임박': '재고 소진 예정',
  // 의료/건강 관련
  '치료': '관리',
  '완치': '개선',
  '효능': '특징',
  '효과': '결과',
  '약효': '작용',
  '처방': '추천',
  '진단': '확인',
  '질병': '건강 상태',
  // 금융 관련
  '대출': '자금 지원',
  '투자': '자산 운용',
  '수익률': '성과',
  '보장': '약속',
  '원금보장': '안정적',
  '고수익': '좋은 성과',
  // 도박/성인
  '카지노': '',
  '도박': '',
  '베팅': '',
  '슬롯': '',
  // 기타 금칙어
  '사이트 바로가기': '방문하기',
  '클릭': '확인',
  '링크': '안내',
  '문의주세요': '연락 부탁드립니다',
  'DM주세요': '메시지 남겨주세요',
  '카톡': '메신저',
  '텔레그램': '메신저',
  '협찬': '제공',
  '광고': '소개',
  '체험단': '리뷰어',
  'AD': '',
  '#ad': ''
};

document.addEventListener('DOMContentLoaded', function() {
  // 로그인 관련 DOM 요소
  var loginRequired = document.getElementById('loginRequired');
  var mainContent = document.getElementById('mainContent');
  var openLoginBtn = document.getElementById('openLoginBtn');
  var userBtn = document.getElementById('userBtn');
  var userDropdown = document.getElementById('userDropdown');
  var userName = document.getElementById('userName');
  var userEmail = document.getElementById('userEmail');
  var userPlan = document.getElementById('userPlan');
  var logoutBtn = document.getElementById('logoutBtn');
  var isDropdownOpen = false;

  // 기존 DOM 요소
  var refreshBtn = document.getElementById('refreshBtn');
  var analyzeBtn = document.getElementById('analyzeBtn');
  var tabBtns = document.querySelectorAll('.tab-btn');
  var tabPanes = document.querySelectorAll('.tab-pane');
  var generateBtn = document.getElementById('generateBtn');
  var copyBtn = document.getElementById('copyBtn');
  var loadingOverlay = document.getElementById('loadingOverlay');
  var loadingText = loadingOverlay ? loadingOverlay.querySelector('.loading-text') : null;

  // 분석 옵션 모달 요소
  var analysisModal = document.getElementById('analysisModal');
  var analysisCopyOnly = document.getElementById('analysisCopyOnly');
  var analysisWithLearn = document.getElementById('analysisWithLearn');
  var analysisModalClose = document.getElementById('analysisModalClose');
  var modalBackdrop = analysisModal ? analysisModal.querySelector('.modal-backdrop') : null;

  // 현재 분석 데이터
  var currentData = null;
  var generatedImagePrompts = [];

  /**
   * 초기화 - 로그인 상태 확인
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

      if (result.isLoggedIn && result.userInfo) {
        showMainContent(result.userInfo);
      } else {
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

  // 관리자 이메일
  var ADMIN_EMAIL = 'ccv1599@gmail.com';
  var adminBtn = document.getElementById('adminBtn');

  /**
   * 메인 콘텐츠 표시
   */
  function showMainContent(userInfo) {
    if (loginRequired) loginRequired.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';

    // 사용자 정보 표시
    if (userName) userName.textContent = userInfo.displayName || '사용자';
    if (userEmail) userEmail.textContent = userInfo.email || '';

    // 플랜 배지 표시
    if (userPlan) {
      var plan = userInfo.plan || 'free';
      var planBadge = userPlan.querySelector('.plan-badge');
      if (planBadge) {
        planBadge.className = 'plan-badge ' + plan;
        planBadge.textContent = plan === 'free' ? '무료 플랜' :
                               plan === 'pro' ? 'Pro 플랜' :
                               plan === 'premium' ? 'Premium 플랜' : '무료 플랜';
      }
    }

    // 관리자 버튼 표시 (관리자만)
    if (adminBtn) {
      adminBtn.style.display = (userInfo.email === ADMIN_EMAIL) ? 'block' : 'none';
    }
  }

  /**
   * 관리자 페이지 열기
   */
  function openAdminPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('admin/admin.html')
    });
  }

  /**
   * 마이페이지 열기
   */
  function openMyPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('mypage/mypage.html')
    });
    hideUserDropdown();
  }

  /**
   * SEO 분석 패널 열기 (좌측 오버레이)
   */
  async function openSeoAnalysisPanel() {
    try {
      // 현재 탭 정보 가져오기
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        alert('현재 탭을 찾을 수 없습니다.');
        return;
      }

      var tab = tabs[0];

      // 네이버 블로그인지 확인
      if (!tab.url || (!tab.url.includes('blog.naver.com') && !tab.url.includes('m.blog.naver.com'))) {
        alert('네이버 블로그 페이지에서만 사용할 수 있습니다.');
        return;
      }

      // 콘텐츠 스크립트에 메시지 전송하여 SEO 패널 토글
      chrome.tabs.sendMessage(tab.id, { action: 'toggleSeoPanel' }, function(response) {
        if (chrome.runtime.lastError) {
          // 콘텐츠 스크립트가 없는 경우 주입 시도
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/content.js']
          }).then(function() {
            // 스크립트 주입 후 다시 메시지 전송
            setTimeout(function() {
              chrome.tabs.sendMessage(tab.id, { action: 'toggleSeoPanel' });
            }, 500);
          }).catch(function(err) {
            console.error('스크립트 주입 실패:', err);
            alert('페이지를 새로고침한 후 다시 시도해주세요.');
          });
        }
      });
    } catch (error) {
      console.error('SEO 패널 열기 오류:', error);
      alert('오류가 발생했습니다. 페이지를 새로고침해주세요.');
    }
  }

  /**
   * 블로그 글 전체 캡처
   */
  async function captureBlogContent() {
    var captureBtn = document.getElementById('captureBtn');

    try {
      // 현재 탭 정보 가져오기
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        alert('현재 탭을 찾을 수 없습니다.');
        return;
      }

      var tab = tabs[0];

      // 네이버 블로그인지 확인
      if (!tab.url || (!tab.url.includes('blog.naver.com') && !tab.url.includes('m.blog.naver.com'))) {
        alert('네이버 블로그 페이지에서만 사용할 수 있습니다.');
        return;
      }

      // 캡처 중 표시
      if (captureBtn) {
        captureBtn.classList.add('capturing');
        captureBtn.textContent = '⏳';
      }

      // 콘텐츠 스크립트에 캡처 메시지 전송
      chrome.tabs.sendMessage(tab.id, { action: 'captureBlogContent' }, function(response) {
        if (captureBtn) {
          captureBtn.classList.remove('capturing');
          captureBtn.textContent = '📷';
        }

        if (chrome.runtime.lastError) {
          console.error('캡처 오류:', chrome.runtime.lastError);
          alert('캡처에 실패했습니다. 페이지를 새로고침 후 다시 시도해주세요.');
          return;
        }

        if (response && response.success) {
          alert('캡처가 완료되어 다운로드됩니다!');
        } else {
          alert('캡처 실패: ' + (response?.error || '알 수 없는 오류'));
        }
      });

    } catch (error) {
      console.error('캡처 오류:', error);
      if (captureBtn) {
        captureBtn.classList.remove('capturing');
        captureBtn.textContent = '📷';
      }
      alert('캡처 중 오류가 발생했습니다.');
    }
  }

  // 관리자 버튼 이벤트
  if (adminBtn) {
    adminBtn.addEventListener('click', openAdminPage);
  }

  // 마이페이지 버튼 이벤트
  var mypageBtn = document.getElementById('mypageBtn');
  if (mypageBtn) {
    mypageBtn.addEventListener('click', openMyPage);
  }

  /**
   * 로그인 페이지 열기
   */
  function openLoginPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('auth/login.html')
    });
  }

  /**
   * 로그아웃
   */
  async function logout() {
    try {
      // Firebase 세션도 로그아웃
      if (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.signOut) {
        await FirebaseAuth.signOut();
      }
      await chrome.storage.local.set({
        isLoggedIn: false,
        userInfo: null
      });
      // iframe 내에서 실행 중이면 부모 페이지에 로그아웃 알림
      if (window.parent !== window) {
        window.parent.postMessage({ action: 'logout' }, '*');
      }
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

  // 로그인 관련 이벤트 리스너
  if (openLoginBtn) {
    openLoginBtn.addEventListener('click', openLoginPage);
  }

  if (userBtn) {
    userBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleUserDropdown();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // 드롭다운 외부 클릭 시 닫기
  document.addEventListener('click', function(e) {
    if (isDropdownOpen && userDropdown && !userDropdown.contains(e.target)) {
      hideUserDropdown();
    }
  });

  // 초기화 실행
  init();

  // 스토리지 변경 감지 - 로그인 상태 변경 시 자동 갱신
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local' && changes.isLoggedIn) {
      checkLoginState();
    }
  });

  /**
   * 로딩 표시
   */
  function showLoading(show, text) {
    text = text || '분석 중...';
    loadingOverlay.style.display = show ? 'flex' : 'none';
    loadingText.textContent = text;
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
   * 분석 옵션 모달 표시
   */
  function showAnalysisModal() {
    if (analysisModal) {
      analysisModal.style.display = 'flex';
    }
  }

  /**
   * 분석 옵션 모달 숨김
   */
  function hideAnalysisModal() {
    if (analysisModal) {
      analysisModal.style.display = 'none';
    }
  }

  /**
   * 분석 실행
   * @param {boolean} withLearning - 학습 포함 여부
   */
  /**
   * 페이지에서 직접 블로그 본문 추출 (자체 포함 함수 - 콘텐츠 스크립트 불필요)
   */
  function extractBlogContent() {
    var selectors = [
      '.se-main-container', '#postViewArea', '.post_ct', '.se-viewer',
      '.se_component_wrap', '.se_post_wrap', '#post-view', '.post-view',
      '.se-component-content', '.post_article', '.__se_component_area',
      '.se_doc_viewer', '.blog_post_content', 'article', 'main'
    ];

    // 셀렉터로 컨테이너 찾기
    var container = null;
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.textContent.trim().length > 100) {
        container = el;
        break;
      }
    }

    // 못 찾으면 텍스트가 가장 많은 블록 요소
    if (!container) {
      var best = null;
      var bestLen = 200;
      document.querySelectorAll('div, section, article').forEach(function(el) {
        var cls = (el.className || '').toLowerCase();
        var id = (el.id || '').toLowerCase();
        if (cls.match(/nav|sidebar|footer|header|menu|comment/) ||
            id.match(/nav|sidebar|footer|header|menu|comment/)) return;
        var len = el.textContent.trim().length;
        if (len > bestLen && el.querySelectorAll('div').length < 100) {
          bestLen = len;
          best = el;
        }
      });
      container = best;
    }

    if (!container) return null;

    // 텍스트 추출 (BlogExtractor와 동일한 방식)
    var fullText = '';
    var paragraphs = [];

    // 본문 텍스트: cloneNode + textContent (불필요 요소 제거)
    var clone = container.cloneNode(true);
    ['script', 'style', 'noscript', '.se-oglink', '.se-module-oglink',
     '.se-component.se-documentTitle', '.se-component.se-title', '[data-name="Title"]',
     '.se-component.se-horizontalLine'].forEach(function(sel) {
      clone.querySelectorAll(sel).forEach(function(el) { el.remove(); });
    });
    fullText = clone.textContent.replace(/\s+/g, ' ').trim();

    // 문단 추출
    var pSelectors = ['.se-text-paragraph', '.se-module-text', 'p', '.post_tx'];
    for (var pi = 0; pi < pSelectors.length; pi++) {
      var pEls = container.querySelectorAll(pSelectors[pi]);
      if (pEls.length > 0) {
        pEls.forEach(function(el) {
          var t = el.textContent.trim();
          if (t.length > 10) {
            paragraphs.push({ text: t, length: t.length, element: el.tagName.toLowerCase() });
          }
        });
        break;
      }
    }
    if (paragraphs.length === 0) {
      fullText.split(/[.!?]\s+/).forEach(function(s) {
        var t = s.trim();
        if (t.length > 10) {
          paragraphs.push({ text: t, length: t.length, element: 'p' });
        }
      });
    }

    if (fullText.length < 30) return null;

    // 제목 추출 (문단 필터링에 필요하므로 먼저)
    var title = '';
    var titleSelectors = ['.se-title-text', '.pcol1', '.tit_h3', '#title'];
    for (var j = 0; j < titleSelectors.length; j++) {
      var titleEl = document.querySelector(titleSelectors[j]);
      if (titleEl && titleEl.textContent.trim()) {
        title = titleEl.textContent.trim();
        break;
      }
    }
    if (!title) {
      var ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) title = ogTitle.getAttribute('content') || '';
    }

    // paragraphs에서 제목과 동일한 첫 문단 제거
    if (title && title.length >= 3 && paragraphs.length > 0) {
      var _tNrm = title.replace(/\s+/g, '').toLowerCase();
      var _pNrm = paragraphs[0].text.replace(/\s+/g, '').toLowerCase();
      if (_pNrm === _tNrm ||
          (_pNrm.length > 5 && _pNrm.length < _tNrm.length * 3 && _tNrm.indexOf(_pNrm) >= 0) ||
          (_tNrm.length > 5 && _pNrm.length < _tNrm.length * 3 && _pNrm.indexOf(_tNrm) >= 0)) {
        paragraphs.shift();
      }
    }

    // 이미지 추출 (발행 뷰 + 에디터 뷰)
    var images = [];
    var seenSrcs = {};
    // SE4 에디터 이미지 컴포넌트
    container.querySelectorAll('.se-image-resource, .se-component.se-image img').forEach(function(img) {
      var src = img.src || img.dataset.src || img.dataset.lazySrc || '';
      if (src && !seenSrcs[src]) { seenSrcs[src] = true; images.push({ src: src, alt: img.alt || '' }); }
    });
    // 일반 이미지 (에디터에서 못 찾으면)
    if (images.length === 0) {
      container.querySelectorAll('img').forEach(function(img) {
        var src = img.src || img.dataset.src || '';
        if (src && !src.includes('icon') && !src.includes('logo') && !seenSrcs[src]) {
          // width가 0인 경우(lazy load) 또는 50 초과면 포함
          if (img.width === 0 || img.width > 50) {
            seenSrcs[src] = true;
            images.push({ src: src, alt: img.alt || '' });
          }
        }
      });
    }

    // 태그 추출 (발행 뷰 + 에디터 뷰 모두 지원)
    var tags = [];
    // 발행된 블로그 뷰
    document.querySelectorAll('.post_tag a, .tag_area a, .wrap_tag a, #tagList a, .post-tag a').forEach(function(a) {
      var tag = a.textContent.trim().replace('#', '');
      if (tag && tags.indexOf(tag) === -1) tags.push(tag);
    });
    // 에디터 뷰 (tag_item, se-tag 등)
    if (tags.length === 0) {
      document.querySelectorAll('.tag_item, .tag-item, .post_tag span, .se-tag, #tag_post span, .tag_keyword').forEach(function(el) {
        var tag = el.textContent.trim().replace(/^[#x×✕]\s*/, '').replace(/^#/, '');
        if (tag && tag.length >= 2 && tags.indexOf(tag) === -1) tags.push(tag);
      });
    }
    // 태그 input 필드 (에디터에서 input으로 관리하는 경우)
    if (tags.length === 0) {
      var tagInput = document.querySelector('#tag_post, .tag_input, [class*="tag"] input');
      if (tagInput && tagInput.value) {
        tagInput.value.split(',').forEach(function(t) {
          var tag = t.trim().replace('#', '');
          if (tag && tag.length >= 2 && tags.indexOf(tag) === -1) tags.push(tag);
        });
      }
    }
    // 본문 텍스트에서 해시태그 패턴 감지 (최후 폴백)
    if (tags.length === 0 && fullText) {
      var hashMatches = fullText.match(/#[가-힣a-zA-Z0-9_]{2,}/g);
      if (hashMatches) {
        hashMatches.forEach(function(h) {
          var tag = h.replace('#', '');
          if (tag && tag.length >= 2 && tags.indexOf(tag) === -1) tags.push(tag);
        });
      }
    }

    // 소제목 추출 (문장 필터링 포함)
    var subheadings = [];
    var addedTexts = {};
    function isSentenceText(text) {
      // 따옴표를 벗기고 내부 텍스트로 판별 ("문장입니다." → 문장입니다.)
      var inner = text.replace(/^[^가-힣a-zA-Z0-9]+|[^가-힣a-zA-Z0-9]+$/g, '').trim();
      var t = inner || text;
      // 마침표/온점은 항상 문장
      if (/[.。]$/.test(t)) return true;
      // ?나 !는 긴 텍스트(30자 초과)일 때만 문장 판별 (짧으면 소제목일 수 있음)
      if (t.length > 30 && /[?!]$/.test(t)) return true;
      // 한국어 문장 어미 (긴 텍스트만)
      if (t.length > 30 && /(?:니다|니까|에요|해요|세요|네요|거든요|잖아요|는데요|어요|아요|죠|구요|래요|나요)$/.test(t)) return true;
      // 한국어 문장 어미 (20자 초과 - 짧은 소제목에서도 흔히 사용)
      if (t.length > 20 && /(?:습니다|입니다|됩니다|했습니다)$/.test(t)) return true;
      return false;
    }
    function normalizeForCompare(text) {
      // 모든 종류의 따옴표/특수문자를 제거하고 핵심 텍스트만 비교
      return text.replace(/^[^가-힣a-zA-Z0-9]+|[^가-힣a-zA-Z0-9]+$/g, '').trim();
    }
    function addSubheading(text, type, skipSentenceCheck) {
      if (!text || text.length < 3 || text.length > 50) return;
      if (/^\[.+\]$/.test(text)) return;
      // 정규화된 버전으로도 중복 체크
      var normalized = normalizeForCompare(text);
      if (addedTexts[text] || addedTexts[normalized]) return;
      if (!skipSentenceCheck && isSentenceText(text)) return;
      addedTexts[text] = true;
      addedTexts[normalized] = true;
      subheadings.push({ text: text, type: type });
    }
    // 1. h2, h3 태그 (확실한 소제목 - 문장 필터 안 함)
    container.querySelectorAll('h2, h3').forEach(function(el) {
      addSubheading(el.textContent.trim(), el.tagName, true);
    });
    // 2. 네이버 스마트에디터3 소제목 스타일 (명시적 소제목 클래스)
    container.querySelectorAll('.se-section-title, .se-sticker-title').forEach(function(el) {
      addSubheading(el.textContent.trim(), 'section-title', true);
    });
    // 3. 인용구(따옴표) 스타일 소제목 (짧은 텍스트만)
    container.querySelectorAll('.se-section-quotation').forEach(function(el) {
      var textEl = el.querySelector('.se-module-text');
      if (textEl) {
        var t = textEl.textContent.trim();
        addSubheading(t, 'quotation-heading');
      }
    });
    // 4. 구분선 바로 뒤 볼드 텍스트
    container.querySelectorAll('.se-hr + .se-module-text, .se-section-horizontalLine + .se-section-text').forEach(function(el) {
      var boldEl = el.querySelector('strong, b');
      if (boldEl) {
        addSubheading(boldEl.textContent.trim(), 'separator-heading');
      }
    });
    // 4. 문단 전체가 볼드인 경우만 (볼드 비율 90% 이상)
    container.querySelectorAll('.se-module-text').forEach(function(el) {
      var boldEl = el.querySelector('strong, b');
      if (boldEl) {
        var t = boldEl.textContent.trim();
        var pt = el.textContent.trim();
        if (t.length >= 5 && t.length <= 50 && pt.startsWith(t) && (t.length / pt.length) > 0.9) {
          addSubheading(t, 'bold-heading');
        }
      }
    });
    // 5. 큰 글씨 소제목 (se-fs-fs26 이상 - 명시적 스타일이므로 문장 필터 안 함)
    container.querySelectorAll('[class*="se-fs-"]').forEach(function(el) {
      var cls = el.className || '';
      var match = cls.match(/se-fs-fs(\d+)/);
      if (match && parseInt(match[1]) >= 26) {
        addSubheading(el.textContent.trim(), 'large-text', true);
      }
    });
    // 6. 인라인 스타일 큰 폰트 (font-size >= 24px - 명시적 스타일이므로 문장 필터 안 함)
    container.querySelectorAll('[style*="font-size"]').forEach(function(el) {
      var style = el.getAttribute('style') || '';
      var match = style.match(/font-size\s*:\s*(\d+)/);
      if (match && parseInt(match[1]) >= 24) {
        addSubheading(el.textContent.trim(), 'large-text', true);
      }
    });

    // 7. DOM에서 소제목을 못 찾으면 텍스트 기반 감지
    if (subheadings.length === 0 && fullText.length > 200) {
      var ftLines = fullText.split(/\n/).filter(function(l) { return l.trim().length > 0; });
      // fullText가 줄바꿈 없이 한 줄이면 문단 텍스트에서 감지
      var detectLines = ftLines.length > 3 ? ftLines : paragraphs.map(function(p) {
        return typeof p === 'string' ? p : (p.text || '');
      }).filter(function(t) { return t.length > 0; });

      for (var dli = 0; dli < detectLines.length; dli++) {
        var dl = detectLines[dli].trim();
        if (dl.length >= 3 && dl.length <= 45 &&
            !/[.!?。]$/.test(dl) &&
            !/^\[이미지|^\[사진|^\[image/i.test(dl)) {
          var hasPrevLine = dli > 0 && detectLines[dli - 1].trim().length > 30;
          var hasNextLine = dli < detectLines.length - 1 && detectLines[dli + 1].trim().length > 30;
          if (hasPrevLine || hasNextLine) {
            addSubheading(dl, 'text-detected', true);
          }
        }
      }
    }

    return {
      title: title,
      fullText: fullText,
      paragraphs: paragraphs,
      images: images,
      tags: tags,
      subheadings: subheadings,
      stats: {
        charCount: fullText.length,
        paragraphCount: paragraphs.length,
        imageCount: images.length,
        tagCount: tags.length,
        subheadingCount: subheadings.length
      },
      url: window.location.href,
      extractedAt: new Date().toISOString()
    };
  }

  function runAnalysis(withLearning) {
    hideAnalysisModal();
    showLoading(true, '블로그 글을 분석하고 있습니다...');

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      var tab = tabs[0];

      if (!tab || tab.url.indexOf('blog.naver.com') === -1) {
        alert('네이버 블로그 페이지에서 사용해주세요.');
        showLoading(false);
        return;
      }

      // 모든 프레임에 직접 추출 함수 주입
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: extractBlogContent
      }, function(results) {
        if (chrome.runtime.lastError) {
          console.error('[Panel] 추출 오류:', chrome.runtime.lastError.message);
          alert('분석 중 오류가 발생했습니다. 페이지를 새로고침 후 다시 시도해주세요.');
          showLoading(false);
          return;
        }

        // 모든 프레임 결과에서 가장 긴 텍스트 선택
        var bestExtracted = null;
        var bestLength = 0;

        if (results) {
          results.forEach(function(frameResult) {
            if (frameResult && frameResult.result && frameResult.result.fullText) {
              var textLen = frameResult.result.fullText.length;
              if (textLen > bestLength) {
                bestLength = textLen;
                bestExtracted = frameResult.result;
              }
            }
          });
        }

        if (bestExtracted) {
          // 타임아웃 + 콘텐츠 스크립트 분석 시도
          var analysisHandled = false;
          var analysisTimeout = setTimeout(function() {
            if (analysisHandled) return;
            analysisHandled = true;
            console.log('[Panel] analyzeData 타임아웃 (5초) - 기본 분석 사용');
            var analysis = buildBasicAnalysis(bestExtracted);
            currentData = { extracted: bestExtracted, analysis: analysis };
            try { updateUI(currentData); } catch(e) { console.error('[Panel] UI 업데이트 오류:', e); }
            chrome.storage.local.set({ currentAnalysis: currentData });
            if (withLearning && typeof LearningEngine !== 'undefined') {
              LearningEngine.learn(currentData).then(function() { updateLearningStatus(); });
            }
            showLoading(false);
          }, 5000);

          chrome.tabs.sendMessage(tab.id, {
            action: 'analyzeData',
            extractedData: bestExtracted
          }, function(analysisResponse) {
            if (analysisHandled) return;
            analysisHandled = true;
            clearTimeout(analysisTimeout);

            var analysis;
            if (!chrome.runtime.lastError && analysisResponse && analysisResponse.success && analysisResponse.analysis) {
              analysis = analysisResponse.analysis;
            } else {
              // 분석기 없으면 기본 분석
              analysis = buildBasicAnalysis(bestExtracted);
            }

            currentData = { extracted: bestExtracted, analysis: analysis };
            try { updateUI(currentData); } catch(e) { console.error('[Panel] UI 업데이트 오류:', e); }
            chrome.storage.local.set({ currentAnalysis: currentData });

            if (withLearning && typeof LearningEngine !== 'undefined') {
              LearningEngine.learn(currentData).then(function() {
                updateLearningStatus();
              });
            }
            showLoading(false);
          });
        } else {
          alert('블로그 본문을 찾을 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.');
          showLoading(false);
        }
      });
    });
  }

  /**
   * 기본 분석 (콘텐츠 스크립트 없이)
   */
  function buildBasicAnalysis(extracted) {
    var text = extracted.fullText || '';
    var paragraphs = extracted.paragraphs || [];
    var subheadings = extracted.subheadings || [];
    var images = extracted.images || [];
    var tags = extracted.tags || [];

    // ── 제목이 본문 텍스트에 포함된 경우 제거 ──
    // 주의: fullText가 줄바꿈 없이 한 줄일 수 있으므로 길이 가드 필수
    if (extracted.title && extracted.title.length >= 3) {
      var _titleNorm = extracted.title.replace(/\s+/g, '').toLowerCase();
      var _lines = text.split('\n');
      for (var _i = 0; _i < Math.min(3, _lines.length); _i++) {
        var _lineNorm = _lines[_i].trim().replace(/\s+/g, '').toLowerCase();
        // 줄 길이가 제목의 3배 이내일 때만 제목 줄로 판정 (긴 본문 전체 삭제 방지)
        if (_lineNorm.length > 0 && _lineNorm.length < _titleNorm.length * 3 && (
            _lineNorm === _titleNorm ||
            (_lineNorm.length > 5 && _titleNorm.indexOf(_lineNorm) >= 0) ||
            (_titleNorm.length > 5 && _lineNorm.indexOf(_titleNorm) >= 0))) {
          _lines.splice(_i, 1);
          break;
        }
      }
      text = _lines.join('\n').trim();
    }

    // ── paragraphs 에서도 제목 문단 제거 ──
    if (extracted.title && paragraphs.length > 0) {
      var _fpText = typeof paragraphs[0] === 'string' ? paragraphs[0] : (paragraphs[0].text || '');
      var _tNorm = extracted.title.replace(/\s+/g, '').toLowerCase();
      var _pNorm = _fpText.trim().replace(/\s+/g, '').toLowerCase();
      if (_pNorm.length > 0 && _pNorm.length < _tNorm.length * 3 && (
          _pNorm === _tNorm ||
          (_pNorm.length > 5 && _tNorm.indexOf(_pNorm) >= 0) ||
          (_tNorm.length > 5 && _pNorm.indexOf(_tNorm) >= 0))) {
        paragraphs = paragraphs.slice(1);
      }
    }

    // ── 소제목이 없으면 텍스트 기반으로 감지 ──
    if (subheadings.length === 0 && text.length > 200) {
      var _textLines = text.split('\n').filter(function(l) { return l.trim().length > 0; });
      for (var _li = 0; _li < _textLines.length; _li++) {
        var _line = _textLines[_li].trim();
        // 3~45자, 마침표·물음표·느낌표 없음, 이미지 태그 아님
        if (_line.length >= 3 && _line.length <= 45 &&
            !/[.!?。]$/.test(_line) &&
            !/^\[이미지|^\[사진|^\[image/i.test(_line)) {
          // 앞이나 뒤에 긴 텍스트가 있으면 소제목으로 간주
          var _hasPrev = _li > 0 && _textLines[_li - 1].trim().length > 30;
          var _hasNext = _li < _textLines.length - 1 && _textLines[_li + 1].trim().length > 30;
          if (_hasPrev || _hasNext) {
            subheadings.push(_line);
          }
        }
      }
    }

    var totalLen = text.length || 1;
    var pCount = paragraphs.length || 1;

    // 서론/본론/결론 문단 분류
    var introEnd = Math.max(1, Math.floor(pCount * 0.15));
    var conclusionStart = Math.floor(pCount * 0.85);

    var introParagraphs = paragraphs.slice(0, introEnd);
    var bodyParagraphs = paragraphs.slice(introEnd, conclusionStart);
    var conclusionParagraphs = paragraphs.slice(conclusionStart);

    var introPercent = Math.round((introParagraphs.length / pCount) * 100) || 15;
    var bodyPercent = Math.round((bodyParagraphs.length / pCount) * 100) || 70;
    var conclusionPercent = 100 - introPercent - bodyPercent;

    var introCharCount = introParagraphs.reduce(function(sum, p) { return sum + (p.length || (p.text || '').length); }, 0);
    var bodyCharCount = bodyParagraphs.reduce(function(sum, p) { return sum + (p.length || (p.text || '').length); }, 0);
    var conclusionCharCount = conclusionParagraphs.reduce(function(sum, p) { return sum + (p.length || (p.text || '').length); }, 0);

    // 문장 분리 (구분자를 유지하여 문장 유형 판별)
    var sentencesRaw = text.match(/[^.!?。]+[.!?。]+/g) || [];
    var sentences = sentencesRaw.filter(function(s) { return s.trim().length > 5; });
    var avgSentenceLength = sentences.length > 0
      ? Math.round(sentences.reduce(function(sum, s) { return sum + s.trim().length; }, 0) / sentences.length)
      : 0;
    var avgParagraphLength = Math.round(totalLen / pCount);

    // 문장 유형 분류
    var statements = 0, questions = 0, exclamations = 0;
    sentences.forEach(function(s) {
      var trimmed = s.trim();
      if (trimmed.endsWith('?')) questions++;
      else if (trimmed.endsWith('!')) exclamations++;
      else statements++;
    });
    var totalSentences = sentences.length || 1;

    // 이미지 위치 패턴
    var imagePositions = [];
    images.forEach(function(img, i) {
      imagePositions.push(Math.round((i / (images.length || 1)) * 100));
    });
    var imagePattern = images.length === 0 ? 'no_images' : 'scattered';

    // 메인 키워드 추출 (제목+본문 빈도+태그 교차 분석)
    var mainKeyword = '';
    (function() {
      var title = extracted.title || '';
      // 제목에서 2글자 이상 한글 단어 추출
      var titleWords = title.match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
      // 본문에서 모든 2글자 이상 단어 빈도 계산
      var bodyWords = text.match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
      var bodyFreq = {};
      bodyWords.forEach(function(w) { bodyFreq[w] = (bodyFreq[w] || 0) + 1; });

      // 태그 목록 (# 제거, 정리)
      var cleanTags = tags.map(function(t) { return t.replace(/^#/, '').trim(); }).filter(function(t) { return t.length >= 2; });

      // 후보 키워드 생성: 제목 단어 중 본문에서도 등장하는 것
      var candidates = [];
      titleWords.forEach(function(tw) {
        var freq = bodyFreq[tw] || 0;
        // 태그에도 포함되면 보너스
        var tagBonus = cleanTags.some(function(tag) { return tag.indexOf(tw) >= 0 || tw.indexOf(tag) >= 0; }) ? 10 : 0;
        // 제목에서 복합 키워드 확인 (연속된 단어 조합)
        var isCompound = title.indexOf(tw) >= 0 && tw.length >= 4;
        var compoundBonus = isCompound ? 5 : 0;
        candidates.push({ word: tw, score: freq + tagBonus + compoundBonus + tw.length });
      });

      // 태그도 후보에 추가 (제목에 포함된 태그 우선)
      cleanTags.forEach(function(tag) {
        if (tag.length >= 2) {
          var inTitle = title.indexOf(tag) >= 0;
          var freq = bodyFreq[tag] || 0;
          if (inTitle) {
            candidates.push({ word: tag, score: freq + 20 + tag.length }); // 제목+태그 = 최우선
          } else {
            candidates.push({ word: tag, score: freq + tag.length });
          }
        }
      });

      // 불용어 필터
      var kwStopwords = ['있는', '하는', '되는', '그리고', '하지만', '그래서', '그런데', '그러나',
        '또한', '이런', '저런', '이것', '저것', '때문', '정말', '진짜', '너무', '매우',
        '아주', '가장', '더욱', '오늘', '내일', '어제', '결국', '이렇게', '블로그'];
      candidates = candidates.filter(function(c) { return kwStopwords.indexOf(c.word) === -1; });

      // 점수 순 정렬
      candidates.sort(function(a, b) { return b.score - a.score; });

      // 중복 제거 후 최고 점수 후보 선택
      var seen = {};
      for (var i = 0; i < candidates.length; i++) {
        if (!seen[candidates[i].word]) {
          mainKeyword = candidates[i].word;
          break;
        }
        seen[candidates[i].word] = true;
      }

      // 후보가 없으면 제목에서 가장 긴 단어
      if (!mainKeyword && titleWords.length > 0) {
        mainKeyword = titleWords.sort(function(a,b) { return b.length - a.length; })[0] || '';
      }
    })();

    // 키워드 위치맵
    function escapeRegExp(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    var positionMap = { title: false, firstParagraph: false, subheadings: false, middle: false, lastParagraph: false, tags: false };
    if (mainKeyword) {
      try {
        var kwRegex = new RegExp(escapeRegExp(mainKeyword), 'i');
        positionMap.title = kwRegex.test(extracted.title || '');
        if (paragraphs.length > 0) {
          var firstP = typeof paragraphs[0] === 'string' ? paragraphs[0] : (paragraphs[0].text || '');
          positionMap.firstParagraph = kwRegex.test(firstP);
          var lastP = typeof paragraphs[pCount-1] === 'string' ? paragraphs[pCount-1] : (paragraphs[pCount-1].text || '');
          positionMap.lastParagraph = kwRegex.test(lastP);
          // 중간 부분 체크
          if (paragraphs.length > 2) {
            var midStart = Math.floor(paragraphs.length * 0.3);
            var midEnd = Math.floor(paragraphs.length * 0.7);
            var midText = paragraphs.slice(midStart, midEnd).map(function(p) {
              return typeof p === 'string' ? p : (p.text || '');
            }).join(' ');
            positionMap.middle = kwRegex.test(midText);
          }
        }
        // 소제목 체크
        if (subheadings.length > 0) {
          positionMap.subheadings = subheadings.some(function(sh) {
            var shText = typeof sh === 'string' ? sh : (sh.text || '');
            return kwRegex.test(shText);
          });
        }
        positionMap.tags = tags.some(function(t) { return kwRegex.test(t); });
      } catch(e) {}
    }

    // 키워드 밀도
    var density = 0;
    if (mainKeyword && text.length > 0) {
      try {
        var kwCount = (text.match(new RegExp(escapeRegExp(mainKeyword), 'gi')) || []).length;
        var totalWords = text.split(/\s+/).length;
        density = totalWords > 0 ? parseFloat(((kwCount / totalWords) * 100).toFixed(2)) : 0;
      } catch(e) {}
    }

    // SEO 점수 - NaverSEOAnalyzer v2.0 호환 (7개 항목, 100점 만점)
    var seoScore = 0;
    var seoFactors = [];

    // 1. 첫 문단 품질 (20점)
    var fpScore = 15;
    var fpStatus = 'good';
    var fpHint = '';
    if (paragraphs.length > 0) {
      var fp = typeof paragraphs[0] === 'string' ? paragraphs[0] : (paragraphs[0].text || '');

      // 제목 복붙 체크 (제목 제거 후에도 남아 있을 수 있으므로 방어적 체크)
      if (extracted.title && fp.length > 0) {
        var _fpTitleNorm = extracted.title.replace(/\s+/g, '').toLowerCase();
        var _fpFirstLine = fp.split('\n')[0].trim().replace(/\s+/g, '').toLowerCase();
        // 첫 줄 길이가 제목의 3배 이내일 때만 복붙 판정 (긴 문단 오판 방지)
        if (_fpFirstLine.length > 3 && _fpFirstLine.length < _fpTitleNorm.length * 3 && (
            _fpFirstLine === _fpTitleNorm ||
            (_fpFirstLine.length > 5 && _fpTitleNorm.indexOf(_fpFirstLine) >= 0) ||
            (_fpTitleNorm.length > 5 && _fpFirstLine.indexOf(_fpTitleNorm) >= 0))) {
          fpScore = 5; fpStatus = 'bad'; fpHint = '제목 복붙';
        }
      }

      // 인사말 시작 감점
      var badStarts = ['안녕하세요', '오늘은', '여러분', '안녕', '반갑습니다'];
      if (fpStatus !== 'bad' && badStarts.some(function(s) { return fp.trim().startsWith(s); })) {
        fpScore = 7; fpStatus = 'bad'; fpHint = '인사말 시작';
      }

      // 구체적 정보(숫자) 포함 보너스
      if (/\d+[개대평명원시간분%년월일만억천건회]|[\d,]+만?\s*원/.test(fp)) {
        fpScore = Math.min(20, fpScore + 5);
      }

      // 핵심정보 부족 체크 (50자 미만)
      if (fp.trim().length < 50 && fpStatus !== 'bad') {
        fpScore = Math.max(5, fpScore - 5); fpHint = (fpHint ? fpHint + ', ' : '') + '핵심정보 부족';
      }
    } else {
      fpScore = 0; fpStatus = 'bad'; fpHint = '본문 없음';
    }
    seoScore += fpScore;
    seoFactors.push({ factor: '첫 문단 품질', score: fpScore, maxScore: 20, status: fpStatus, hint: fpHint });

    // 2. 콘텐츠 구조 (20점)
    var csScore = 0;
    var csHint = '';
    if (totalLen >= 2000) csScore += 8;
    else if (totalLen >= 1500) csScore += 6;
    else if (totalLen >= 800) csScore += 3;
    else csHint = '글 길이 부족';
    if (subheadings.length >= 3) csScore += 8;
    else if (subheadings.length >= 2) csScore += 6;
    else if (subheadings.length >= 1) csScore += 3;
    else csHint += (csHint ? ', ' : '') + '소제목 추가 권장';
    if (pCount >= 5) csScore += 4;
    else if (pCount >= 3) csScore += 2;
    csScore = Math.min(20, csScore);
    var csStatus = csScore >= 15 ? 'good' : csScore >= 8 ? 'warn' : 'bad';
    seoScore += csScore;
    seoFactors.push({ factor: '콘텐츠 구조', score: csScore, maxScore: 20, status: csStatus, hint: csHint });

    // 3. FIRE 공식 (20점)
    var fireScore = 0;
    var fireElements = [];
    if (/\d+[개대평명원시간분%년월일만억천건회]|[\d,]+만?\s*원|[\d.]+km/.test(text)) { fireScore += 5; fireElements.push('F'); }
    if (/때문|이유|원인|덕분|효과|덕분에|그래서/.test(text)) { fireScore += 5; fireElements.push('I'); }
    if (/직접|실제로|써보니|다녀와|먹어보니|사용해|체험|경험/.test(text)) { fireScore += 5; fireElements.push('R'); }
    if (/느낌|만족|추천|좋았|별로|후기|아쉬|편했|최고|결심|깨달|솔직히|확실|강추|놓치지|대박|신세계|후회|뿌듯|다행/.test(text)) { fireScore += 5; fireElements.push('E'); }
    var fireStatus = fireScore >= 15 ? 'good' : fireScore >= 10 ? 'warn' : 'bad';
    var fireHint = fireElements.length === 4 ? 'FIRE 완벽 적용' :
      fireElements.length > 0 ? fireElements.join('+') + ' (' + ['F','I','R','E'].filter(function(e) { return fireElements.indexOf(e) < 0; }).join('') + ' 부족)' : '구체적 경험 추가 필요';
    seoScore += fireScore;
    seoFactors.push({ factor: 'FIRE 공식', score: fireScore, maxScore: 20, status: fireStatus, hint: fireHint });

    // 4. 제목 최적화 (15점)
    var ttScore = 0;
    var ttHint = '';
    var hasKwInTitle = mainKeyword && positionMap.title;
    var hasNumberInTitle = /\d+[개대평명원시간분%년월일가지곳선만억천건회]|[\d,]+만?\s*원/.test(extracted.title || '');
    if (hasKwInTitle && hasNumberInTitle) { ttScore = 15; ttHint = '키워드+수치 포함'; }
    else if (hasKwInTitle) { ttScore = 10; ttHint = '수치 추가 권장'; }
    else if ((extracted.title || '').length >= 10) { ttScore = 5; ttHint = '키워드 포함 권장'; }
    else if ((extracted.title || '').length > 0) { ttScore = 3; ttHint = '제목 최적화 필요'; }
    else { ttScore = 0; ttHint = '제목 없음'; }
    var ttStatus = ttScore >= 12 ? 'good' : ttScore >= 7 ? 'warn' : 'bad';
    seoScore += ttScore;
    seoFactors.push({ factor: '제목 최적화', score: ttScore, maxScore: 15, status: ttStatus, hint: ttHint });

    // 5. 이미지 활용 (10점)
    var imgScore = 0;
    var imgHint = '';
    if (images.length >= 5) { imgScore = 10; }
    else if (images.length >= 3) { imgScore = 8; }
    else if (images.length > 0) { imgScore = 4; imgHint = '이미지 3장 이상 권장'; }
    else { imgScore = 0; imgHint = '이미지 없음'; }
    var imgStatus = imgScore >= 8 ? 'good' : imgScore >= 4 ? 'warn' : 'bad';
    seoScore += imgScore;
    seoFactors.push({ factor: '이미지 활용', score: imgScore, maxScore: 10, status: imgStatus, hint: imgHint });

    // 6. 신뢰성 요소 (10점)
    var crScore = 0;
    var crElements = [];
    if (/https?:\/\/|출처|참고|참조/.test(text)) { crScore += 3; crElements.push('출처'); }
    if (/\d+년\s*(경력|운영)|평점|별점|\d+평|\d+㎡/.test(text)) { crScore += 3; crElements.push('데이터'); }
    if (/자격증|수료증|전문가|인증|경력|트레이너|코치|강사|대표/.test(text)) { crScore += 3; crElements.push('자격'); }
    if (/주소|위치|영업시간|가격|[\d,]+원/.test(text)) { crScore += 1; crElements.push('정보'); }
    crScore = Math.min(10, crScore);
    var crStatus = crScore >= 7 ? 'good' : crScore >= 4 ? 'warn' : 'bad';
    var crHint = crElements.length > 0 ? crElements.join('+') : '신뢰성 요소 부족';
    seoScore += crScore;
    seoFactors.push({ factor: '신뢰성 요소', score: crScore, maxScore: 10, status: crStatus, hint: crHint });

    // 7. 태그 (5점)
    var tgScore = 0;
    var tgHint = '';
    if (tags.length >= 5) { tgScore = 5; }
    else if (tags.length >= 3) { tgScore = 3; tgHint = '태그 5개 이상 권장'; }
    else if (tags.length > 0) { tgScore = 1; tgHint = '태그 추가 필요'; }
    else { tgScore = 0; tgHint = '태그 없음'; }
    var tgStatus = tgScore >= 4 ? 'good' : tgScore >= 2 ? 'warn' : 'bad';
    seoScore += tgScore;
    seoFactors.push({ factor: '태그', score: tgScore, maxScore: 5, status: tgStatus, hint: tgHint });

    // 8. 감점 요소 (NaverSEOAnalyzer v2.0 호환)
    var penaltyScore = 0;
    var penaltyHints = [];
    if (mainKeyword) {
      try {
        var kwRepeatCount = (text.match(new RegExp(escapeRegExp(mainKeyword), 'gi')) || []).length;
        if (kwRepeatCount >= 15) { penaltyScore -= 5; penaltyHints.push('키워드 과다 반복(' + kwRepeatCount + '회)'); }
      } catch(e) {}
    }
    var uncertainPatterns = text.match(/것 같|아마|어쩌면|글쎄|잘 모르|~인 듯|~일 수도/g) || [];
    if (uncertainPatterns.length >= 5) { penaltyScore -= 3; penaltyHints.push('불확실한 표현 반복(' + uncertainPatterns.length + '회)'); }
    if (penaltyScore < 0) {
      seoScore += penaltyScore;
      seoFactors.push({ factor: '감점 요소', score: penaltyScore, maxScore: 0, status: 'bad', hint: penaltyHints.join(', ') });
    }

    seoScore = Math.max(0, Math.min(100, seoScore));
    var seoGrade = seoScore >= 95 ? 'S' : seoScore >= 85 ? 'A' : seoScore >= 70 ? 'B' : seoScore >= 55 ? 'C' : seoScore >= 40 ? 'D' : 'F';

    // 첫 문장 후킹 유형
    var firstSentence = sentences[0] || '';
    var hookType = 'direct';
    if (firstSentence.includes('?')) hookType = 'question';
    else if (firstSentence.includes('!')) hookType = 'exclamation';
    else if (firstSentence.includes('안녕') || firstSentence.includes('반갑')) hookType = 'greeting';
    else if (/\d+/.test(firstSentence)) hookType = 'statistic';
    else if (firstSentence.length > 50) hookType = 'storytelling';

    // 문체 감지 (문장 끝 어미 기준)
    var styleCounts = { formal: 0, casual: 0, informal: 0 };
    var styleSentences = text.split(/[.!?。]+/).filter(function(s) { return s.trim().length > 3; });
    styleSentences.forEach(function(sentence) {
      var trimmed = sentence.trim();
      if (!trimmed) return;
      var ending = trimmed.slice(-10);
      if (/니다$|니까$/.test(ending)) {
        styleCounts.formal += 2;
      } else if (/요$|죠$/.test(ending)) {
        styleCounts.casual += 2;
      } else if (/(?:해$|야$|어$|아$|지$|네$|군$|구$|는다$|ㄴ다$|란다$|했어$|했지$|같아$|싶어$|할게$|갈게$|한다$|된다$|온다$|간다$)/.test(ending)) {
        styleCounts.informal += 2;
      }
    });
    var detectedStyle = Object.entries(styleCounts).sort(function(a, b) { return b[1] - a[1]; })[0];
    var writingStyle = (detectedStyle && detectedStyle[1] > 0) ? detectedStyle[0] : 'casual';

    // 이모지 분석
    var emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    var emojisFound = text.match(emojiRegex) || [];
    var uniqueEmojis = [];
    emojisFound.forEach(function(e) { if (uniqueEmojis.indexOf(e) === -1) uniqueEmojis.push(e); });

    // 서브 키워드 추출
    var textWords = text.match(/[가-힣]{2,}/g) || [];
    var stopwords = [
      // 동사/형용사 어미
      '있는', '하는', '되는', '없는', '같은', '다른', '많은', '좋은', '큰', '작은',
      '있습니다', '합니다', '됩니다', '없습니다', '같습니다', '봅니다', '줍니다',
      '있어요', '해요', '돼요', '없어요', '같아요', '봐요', '줘요',
      '있어', '해서', '돼서', '없어', '같아', '봐서',
      '했습니다', '됐습니다', '았습니다', '었습니다',
      '아닙니다', '입니다', '습니다',
      // 접속사/부사
      '그리고', '하지만', '그래서', '그런데', '그러나', '또한', '그래도', '그러면',
      '그렇게', '그러니', '그러므로', '따라서', '때문에', '그리하여', '그렇지만',
      '그럼', '근데', '그땐', '그때', '이때', '지금', '나중',
      // 대명사/지시어
      '이런', '저런', '그런', '이것', '저것', '그것', '여기', '거기', '저기',
      '이거', '저거', '그거', '이게', '저게', '그게', '이건', '저건', '그건',
      '이렇게', '저렇게', '그렇게', '이래서', '그래서',
      // 일반 부사/관형사
      '정말', '진짜', '너무', '매우', '아주', '가장', '더욱', '꽤나', '참',
      '완전', '엄청', '되게', '좀', '약간', '조금', '살짝', '꽤',
      // 시간 관련
      '오늘', '내일', '어제', '지금', '나중', '최근', '요즘', '올해', '작년',
      // 일반 명사 (의미 없는)
      '때문', '무엇', '어떤', '모든', '것이', '수가', '것은', '것을', '것도',
      '정도', '이상', '이하', '이후', '이전', '부분', '경우', '사실', '방법',
      // 조사 붙은 대명사/일반어
      '글을', '글이', '글은', '글의', '말을', '말이', '말은',
      '분이', '분들', '분의', '분은', '분을',
      '걸로', '거로', '으로', '에서', '에게', '부터', '까지', '에는',
      // 동사 기본형
      '하다', '되다', '있다', '없다', '보다', '주다', '가다', '오다', '알다', '모르다',
      '같다', '싶다', '받다', '만들다', '쓰다', '먹다',
      // 보조용언
      '하게', '하면', '하고', '해도', '해야', '해서', '하니', '하는데',
      '되면', '되고', '되어', '돼서', '되니', '되는데'
    ];
    var wordFreq = {};
    textWords.forEach(function(w) {
      if (stopwords.indexOf(w) === -1 && w.length >= 2) {
        // 추가 필터: 2글자이며 조사/어미로 끝나는 패턴 제거
        if (w.length === 2 && /[을를은는이가의에도로서와과만]$/.test(w)) return;
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      }
    });
    var sortedWords = Object.entries(wordFreq)
      .sort(function(a, b) { return b[1] - a[1]; })
      .map(function(entry) { return entry[0]; })
      .filter(function(w) { return w !== mainKeyword; });
    var subKeywords = sortedWords.slice(0, 10);

    return {
      structure: {
        intro: {
          percent: introPercent,
          paragraphs: introParagraphs,
          charCount: introCharCount,
          style: 'statement_opening'
        },
        body: {
          percent: bodyPercent,
          paragraphs: bodyParagraphs,
          sectionCount: subheadings.length || Math.ceil(bodyParagraphs.length / 3),
          charCount: bodyCharCount
        },
        conclusion: {
          percent: conclusionPercent,
          paragraphs: conclusionParagraphs,
          charCount: conclusionCharCount,
          style: 'general_conclusion'
        },
        imagePositions: {
          pattern: imagePattern,
          positions: imagePositions
        },
        avgParagraphLength: avgParagraphLength,
        avgSentenceLength: avgSentenceLength,
        subheadings: subheadings
      },
      keywords: {
        mainKeyword: mainKeyword,
        subKeywords: subKeywords,
        density: density,
        tags: tags,
        positionMap: positionMap
      },
      style: {
        sentenceTypes: {
          statement: Math.round((statements / totalSentences) * 100),
          question: Math.round((questions / totalSentences) * 100),
          exclamation: Math.round((exclamations / totalSentences) * 100)
        },
        writingStyle: writingStyle,
        tone: avgSentenceLength < 30 ? 'concise' : avgSentenceLength > 60 ? 'detailed' : 'balanced',
        hookType: hookType,
        avgSentenceLength: avgSentenceLength,
        emoji: { count: emojisFound.length, unique: uniqueEmojis }
      },
      seo: {
        score: seoScore,
        maxScore: 100,
        percentage: seoScore,
        grade: seoGrade,
        factors: seoFactors
      }
    };
  }

  /**
   * 저장된 분석 데이터 로드
   */
  function loadSavedAnalysis() {
    chrome.storage.local.get(['currentAnalysis', 'openTab'], function(result) {
      if (result.currentAnalysis) {
        currentData = result.currentAnalysis;
        updateUI(result.currentAnalysis);

        if (result.openTab) {
          switchTab(result.openTab);
          chrome.storage.local.remove(['openTab']);
        }
      }
    });
  }

  /**
   * UI 업데이트
   */
  function updateUI(data) {
    var extracted = data.extracted;
    var analysis = data.analysis;

    updateSummaryCard(extracted, analysis);
    updateStructureTab(analysis.structure, extracted);
    updateKeywordTab(analysis.keywords, extracted);
    updateStyleTab(analysis.style);
    updateGenerateTab(analysis.keywords);
  }

  /**
   * 생성 탭 키워드 자동 입력
   */
  function updateGenerateTab(keywords) {
    var mainKeywordInput = document.getElementById('newMainKeyword');
    if (mainKeywordInput && keywords.mainKeyword) {
      mainKeywordInput.value = keywords.mainKeyword;
    }

    var subKeywordsInput = document.getElementById('newSubKeywords');
    if (subKeywordsInput && keywords.subKeywords && keywords.subKeywords.length > 0) {
      subKeywordsInput.value = keywords.subKeywords.slice(0, 5).join(', ');
    }
  }

  /**
   * 요약 카드 업데이트
   */
  function updateSummaryCard(extracted, analysis) {
    document.getElementById('blogTitle').textContent = extracted.title || '제목 없음';
    document.getElementById('seoBadge').textContent = 'SEO ' + analysis.seo.grade + ' (' + analysis.seo.score + '점)';
    document.getElementById('summaryCharCount').textContent = formatNumber(extracted.stats.charCount);
    document.getElementById('summaryParagraphCount').textContent = extracted.stats.paragraphCount;
    document.getElementById('summaryImageCount').textContent = extracted.stats.imageCount;

    // SEO 상세 정보 업데이트
    updateSeoDetail(analysis.seo);
  }

  /**
   * SEO 상세 정보 업데이트
   */
  function updateSeoDetail(seo) {
    var container = document.getElementById('seoFactors');
    if (!container) return;

    // NaverSEOAnalyzer: factors 또는 details 배열 지원
    var factors = seo.factors || seo.details || [];

    // 항목별 기준 설명
    var criteriaMap = {
      '첫 문단 품질': '인사말 없이 핵심 정보를 바로 제시하는지 평가',
      '콘텐츠 구조': '목차와 소제목(3개+)으로 체계적으로 구성했는지 평가',
      'FIRE 공식': 'Fact(사실) + Interpretation(해석) + Real(실경험) + Experience(느낌)',
      '제목 최적화': '메인 키워드 포함 + 구체적 수치 + 키워드 앞배치',
      '이미지 활용': '5장 이상 이미지로 시각적 정보를 제공하는지 평가',
      '신뢰성 요소': '출처 링크, 구체적 데이터, 자격/경력 등 신뢰 근거',
      '태그': '5개 이상 태그 + 메인 키워드 태그 포함 여부',
      '감점 요소': '키워드 과다 반복(15회+), 불확실한 표현 반복 감점'
    };

    container.innerHTML = factors.map(function(f) {
      var name = f.factor || f.item || '';
      var score = f.score || 0;
      var max = f.maxScore || f.max || 0;
      var status = f.status || 'bad';
      if (status === 'warn') status = 'warning';

      var icon = status === 'good' ? '✅' : (status === 'warning' ? '⚠️' : '❌');
      var scoreDisplay = score < 0 ? String(score) : (score + '/' + max);
      var criteria = criteriaMap[name] || '';
      var criteriaHtml = criteria ? '<div class="factor-criteria">' + criteria + '</div>' : '';
      var hintHtml = f.hint ? '<div class="factor-hint">' + f.hint + '</div>' : '';

      return '<div class="seo-factor ' + status + '">' +
        '<span class="factor-icon">' + icon + '</span>' +
        '<span class="factor-name">' + name + '</span>' +
        '<span class="factor-score">' + scoreDisplay + '</span>' +
        criteriaHtml +
        hintHtml +
        '</div>';
    }).join('');
  }

  /**
   * SEO 상세 토글
   */
  function toggleSeoDetail() {
    var seoDetail = document.getElementById('seoDetail');
    if (seoDetail) {
      seoDetail.style.display = seoDetail.style.display === 'none' ? 'block' : 'none';
    }
  }

  // SEO 배지 클릭 이벤트
  var seoBadge = document.getElementById('seoBadge');
  if (seoBadge) {
    seoBadge.addEventListener('click', toggleSeoDetail);
  }

  /**
   * 구조 탭 업데이트
   */
  function updateStructureTab(structure, extracted) {
    document.getElementById('introPercent').textContent = structure.intro.percent + '%';
    document.getElementById('introBar').style.width = structure.intro.percent + '%';
    document.getElementById('bodyPercent').textContent = structure.body.percent + '%';
    document.getElementById('bodyBar').style.width = structure.body.percent + '%';
    document.getElementById('conclusionPercent').textContent = structure.conclusion.percent + '%';
    document.getElementById('conclusionBar').style.width = structure.conclusion.percent + '%';

    document.getElementById('avgParagraphLength').textContent = structure.avgParagraphLength + '자';
    document.getElementById('avgSentenceLength').textContent = structure.avgSentenceLength + '자';
    document.getElementById('subheadingCount').textContent = (structure.subheadings ? structure.subheadings.length : 0) + '개';

    var patternNames = {
      'no_images': '이미지 없음',
      'top_heavy': '상단 집중',
      'bottom_heavy': '하단 집중',
      'evenly_distributed': '균등 배치',
      'scattered': '분산 배치'
    };
    var patternDescs = {
      'no_images': '이미지가 사용되지 않았습니다',
      'top_heavy': '이미지가 글 상단에 집중되어 있습니다',
      'bottom_heavy': '이미지가 글 하단에 집중되어 있습니다',
      'evenly_distributed': '이미지가 골고루 배치되어 있습니다',
      'scattered': '이미지가 다양한 위치에 분산되어 있습니다'
    };

    var pattern = structure.imagePositions ? structure.imagePositions.pattern : 'no_images';
    document.getElementById('imagePattern').textContent = patternNames[pattern] || pattern;
    document.getElementById('imagePatternDesc').textContent = patternDescs[pattern] || '';

    var subheadingList = document.getElementById('subheadingList');
    if (structure.subheadings && structure.subheadings.length > 0) {
      subheadingList.innerHTML = structure.subheadings
        .map(function(sh) { return '<li>' + escapeHtml(sh.text) + '</li>'; })
        .join('');
    } else {
      subheadingList.innerHTML = '<li class="empty-state">소제목이 없습니다</li>';
    }
  }

  /**
   * 키워드 탭 업데이트
   */
  function updateKeywordTab(keywords, extracted) {
    document.getElementById('mainKeywordDisplay').textContent = keywords.mainKeyword || '-';
    document.getElementById('keywordDensity').textContent = keywords.density + '%';

    var subKeywordTags = document.getElementById('subKeywordTags');
    if (keywords.subKeywords && keywords.subKeywords.length > 0) {
      subKeywordTags.innerHTML = keywords.subKeywords
        .map(function(kw) { return '<span class="keyword-tag">' + escapeHtml(kw) + '</span>'; })
        .join('');
    } else {
      subKeywordTags.innerHTML = '<span class="empty-state">서브 키워드가 없습니다</span>';
    }

    var posMap = keywords.positionMap || {};
    document.getElementById('posTitle').textContent = posMap.title ? '✅' : '❌';
    document.getElementById('posFirst').textContent = posMap.firstParagraph ? '✅' : '❌';
    document.getElementById('posSubheading').textContent = posMap.subheadings ? '✅' : '❌';
    document.getElementById('posMiddle').textContent = posMap.middle ? '✅' : '❌';
    document.getElementById('posLast').textContent = posMap.lastParagraph ? '✅' : '❌';
    document.getElementById('posTags').textContent = posMap.tags ? '✅' : '❌';

    var originalTags = document.getElementById('originalTags');
    if (extracted.tags && extracted.tags.length > 0) {
      originalTags.innerHTML = extracted.tags
        .map(function(tag) { return '<span class="keyword-tag">#' + escapeHtml(tag) + '</span>'; })
        .join('');
    } else {
      originalTags.innerHTML = '<span class="empty-state">태그가 없습니다</span>';
    }
  }

  /**
   * 스타일 탭 업데이트
   */
  function updateStyleTab(style) {
    var types = style.sentenceTypes || {};
    document.getElementById('statementBar').style.width = types.statement + '%';
    document.getElementById('questionBar').style.width = types.question + '%';
    document.getElementById('exclamationBar').style.width = types.exclamation + '%';

    document.getElementById('statementPercent').textContent = types.statement + '%';
    document.getElementById('questionPercent').textContent = types.question + '%';
    document.getElementById('exclamationPercent').textContent = types.exclamation + '%';

    var toneNames = {
      'concise': '간결한',
      'balanced': '균형잡힌',
      'detailed': '상세한',
      'neutral': '중립적인'
    };
    var styleNames = {
      'formal': '정중한 존댓말',
      'casual': '친근한 해요체',
      'informal': '편안한 반말'
    };

    document.getElementById('toneBadge').textContent = toneNames[style.tone] || style.tone;
    document.getElementById('writingStyle').textContent = styleNames[style.writingStyle] || style.writingStyle;
    document.getElementById('avgSentence').textContent = style.avgSentenceLength + '자';

    var hookTypes = {
      'question': '질문형',
      'exclamation': '감탄형',
      'greeting': '인사형',
      'statistic': '통계형',
      'storytelling': '스토리텔링',
      'direct': '직접 진술'
    };
    var hookDescs = {
      'question': '질문으로 시작하여 독자의 호기심을 유발합니다',
      'exclamation': '감탄사로 시작하여 강한 인상을 줍니다',
      'greeting': '인사로 시작하여 친근감을 형성합니다',
      'statistic': '숫자/통계로 시작하여 신뢰감을 줍니다',
      'storytelling': '이야기로 시작하여 몰입감을 줍니다',
      'direct': '바로 본론으로 들어가는 직접적인 스타일입니다'
    };

    document.getElementById('hookType').textContent = hookTypes[style.hookType] || style.hookType;
    document.getElementById('hookDesc').textContent = hookDescs[style.hookType] || '';

    var emoji = style.emoji || {};
    document.getElementById('emojiCount').textContent = emoji.count || 0;

    var emojiList = document.getElementById('emojiList');
    if (emoji.unique && emoji.unique.length > 0) {
      emojiList.textContent = emoji.unique.slice(0, 10).join(' ');
    } else {
      emojiList.innerHTML = '<span class="empty-state">이모지 없음</span>';
    }
  }


  /**
   * 마크다운 제거
   */
  function removeMarkdown(text) {
    var result = text;

    // 1. 먼저 **text**: 또는 **text:** 패턴 처리 (콜론이 안팎에 있는 경우 모두)
    result = result.replace(/\*\*([^*\n]+?)\*\*\s*:/g, '$1:');
    result = result.replace(/\*\*([^*\n]+?:)\*\*/g, '$1');

    // 2. 반복적으로 ** 패턴 제거 (중첩 대응)
    var prevResult = '';
    var iterations = 0;
    while (prevResult !== result && iterations < 10) {
      prevResult = result;
      result = result.replace(/\*\*([^*]+?)\*\*/g, '$1');
      iterations++;
    }

    // 3. 나머지 마크다운 패턴 제거
    result = result
      // *text* 제거 (이탤릭) - 줄바꿈 포함하지 않는 짧은 텍스트만
      .replace(/\*([^*\n]{1,100})\*/g, '$1')
      // 헤딩 제거: ### text -> text
      .replace(/^#{1,6}\s+/gm, '')
      // 코드블록 제거
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // 인용 제거: > text -> text
      .replace(/^>\s+/gm, '')
      // 링크 제거: [text](url) -> text (단, [이미지: ]는 유지)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // 이미지 마크다운 제거: ![alt](url)
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      // 수평선 제거
      .replace(/^---+$/gm, '')
      .replace(/^\*\*\*+$/gm, '')
      // 리스트 마커 정리: - item -> item (단, [이미지 는 유지)
      .replace(/^[\-\*]\s+(?!\[이미지)/gm, '')
      // 번호 리스트: 1. item -> item
      .replace(/^\d+\.\s+/gm, '');

    // 4. 최종: 남은 ** 또는 * 완전 제거
    result = result.replace(/\*\*/g, '');
    result = result.replace(/(?<![가-힣a-zA-Z0-9])\*|\*(?![가-힣a-zA-Z0-9])/g, '');

    return result;
  }

  /**
   * 네이버 금칙어 검사 및 자동 대체
   */
  function checkAndReplaceBannedWords(text) {
    var foundWords = [];
    var replacedText = text;

    Object.keys(NAVER_BANNED_WORDS).forEach(function(word) {
      var regex = new RegExp(word, 'gi');
      if (regex.test(replacedText)) {
        foundWords.push({
          original: word,
          replacement: NAVER_BANNED_WORDS[word]
        });
        // 대체어가 있으면 대체, 없으면 삭제
        replacedText = replacedText.replace(regex, NAVER_BANNED_WORDS[word]);
      }
    });

    return {
      originalText: text,
      replacedText: replacedText,
      foundWords: foundWords
    };
  }

  /**
   * 글 생성
   */
  function generatePost() {
    if (!currentData) {
      alert('먼저 블로그 글을 분석해주세요.');
      return;
    }

    var mainKeyword = document.getElementById('newMainKeyword').value.trim();
    if (!mainKeyword) {
      alert('메인 키워드를 입력해주세요.');
      return;
    }

    var subKeywords = document.getElementById('newSubKeywords').value
      .split(',')
      .map(function(k) { return k.trim(); })
      .filter(function(k) { return k; });

    // 사업장 정보
    var businessNameEl = document.getElementById('businessName');
    var businessName = businessNameEl ? businessNameEl.value.trim() : '';

    var businessInfoEl = document.getElementById('businessInfo');
    var businessInfo = businessInfoEl ? businessInfoEl.value.trim() : '';

    // 작성자 역할
    var writerRoleEl = document.getElementById('writerRole');
    var writerRole = writerRoleEl ? writerRoleEl.value.trim() : '';

    var creativityEl = document.querySelector('input[name="creativity"]:checked');
    var creativityLevel = creativityEl ? creativityEl.value : '재해석';

    var lengthEl = document.querySelector('input[name="length"]:checked');
    var lengthRatio = lengthEl ? parseInt(lengthEl.value) : 100;

    // AI 추가 요청사항
    var customRequestEl = document.getElementById('aiCustomRequest');
    var customRequest = customRequestEl ? customRequestEl.value.trim() : '';

    showLoading(true, 'AI가 SEO 최적화 글을 생성하고 있습니다...');

    // 학습 인사이트 가져오기
    var learningInsightsPromise = (typeof LearningEngine !== 'undefined')
      ? LearningEngine.generateInsights()
      : Promise.resolve(null);

    learningInsightsPromise.then(function(learnedInsights) {
        var prompt = buildPrompt(currentData.analysis, {
          mainKeyword: mainKeyword,
          subKeywords: subKeywords,
          businessName: businessName,
          businessInfo: businessInfo,
          writerRole: writerRole,
          creativityLevel: creativityLevel,
          lengthRatio: lengthRatio,
          customRequest: customRequest,
          learnedInsights: learnedInsights
        });

      // 서비스 워커에서 API 키를 관리하므로 직접 요청
      chrome.runtime.sendMessage({
        action: 'generateContent',
        prompt: prompt,
        maxTokens: 65536
      }, function(response) {
        if (chrome.runtime.lastError) {
          alert('글 생성 중 오류가 발생했습니다.');
          showLoading(false);
          return;
        }

        if (response && response.success) {
          var generatedText = response.data;

          // 마크다운 제거
          generatedText = removeMarkdown(generatedText);

          // 금칙어 검사 및 자동 대체
          var bannedResult = checkAndReplaceBannedWords(generatedText);

          // 결과 표시 (대체된 텍스트 사용)
          displayResult(bannedResult);
        } else {
          var errorMsg = (response && response.error) ? response.error : '글 생성에 실패했습니다.';
          // 영문 원본 에러 메시지가 노출되지 않도록 변환
          if (errorMsg.toLowerCase().indexOf('quota') !== -1 || errorMsg.indexOf('429') !== -1 || errorMsg.toLowerCase().indexOf('rate') !== -1) {
            errorMsg = 'API 사용량이 일시적으로 초과되었습니다. 1~2분 후 다시 시도해주세요.';
          } else if (errorMsg.toLowerCase().indexOf('exceeded') !== -1 || errorMsg.toLowerCase().indexOf('resource') !== -1) {
            errorMsg = 'API 사용량이 일시적으로 초과되었습니다. 1~2분 후 다시 시도해주세요.';
          }
          alert(errorMsg);
        }
        showLoading(false);
      });
    }); // learningInsightsPromise.then 닫기
  }

  /**
   * 제목과 본문 분리
   */
  function extractTitleAndContent(text) {
    var titleMatch = text.match(/\[제목\]\s*(.+?)(?:\n|$)/);
    var title = '';
    var content = text;

    if (titleMatch) {
      title = titleMatch[1].trim();
      // .+ (greedy)로 전체 제목 라인을 매칭하여 제거
      content = text.replace(/\[제목\]\s*.+(?:\n|$)/, '').trim();
    }

    return { title: title, content: content };
  }

  /**
   * 결과 표시 (금칙어 자동 대체 + 제목 분리 포함)
   */
  function displayResult(bannedResult) {
    var resultContent = document.getElementById('resultContent');
    var resultCard = document.getElementById('resultCard');

    // 제목과 본문 분리
    var extracted = extractTitleAndContent(bannedResult.replacedText);
    var generatedTitle = extracted.title;
    var generatedContent = extracted.content;

    // 대체된 텍스트 표시 (본문만)
    resultContent.textContent = generatedContent;
    resultCard.style.display = 'block';

    // 제목 표시
    var bannedWordResult = document.getElementById('bannedWordResult');
    if (bannedWordResult) {
      var titleHtml = '';

      // SEO 제목 표시
      if (generatedTitle) {
        titleHtml += '<div class="generated-title">' +
          '<div class="generated-title-label">📌 SEO 최적화 제목</div>' +
          '<div class="generated-title-text">' + escapeHtml(generatedTitle) + '</div>' +
          '<button class="copy-title-btn" id="copyTitleBtn">제목 복사</button>' +
          '</div>';
      }

      // 금칙어 검토 결과
      if (bannedResult.foundWords.length > 0) {
        var replacementList = bannedResult.foundWords.map(function(item) {
          if (item.replacement) {
            return '"' + item.original + '" → "' + item.replacement + '"';
          } else {
            return '"' + item.original + '" (삭제됨)';
          }
        }).join('<br>');

        titleHtml += '<div class="info-box">' +
          '<strong>🔄 금칙어 자동 수정 완료 (' + bannedResult.foundWords.length + '개)</strong><br>' +
          '<div class="replacement-list">' + replacementList + '</div>' +
          '<small>네이버 검색 노출에 불리한 단어들이 자동으로 대체되었습니다.</small>' +
          '</div>';
      } else {
        titleHtml += '<div class="success-box">' +
          '<strong>✅ 금칙어 검사 통과</strong><br>' +
          '<small>네이버 금칙어가 발견되지 않았습니다.</small>' +
          '</div>';
      }

      bannedWordResult.innerHTML = titleHtml;

      // 제목 복사 버튼 이벤트
      var copyTitleBtn = document.getElementById('copyTitleBtn');
      if (copyTitleBtn) {
        copyTitleBtn.addEventListener('click', function() {
          safeCopy(generatedTitle).then(function() {
            copyTitleBtn.textContent = '복사됨!';
            setTimeout(function() { copyTitleBtn.textContent = '제목 복사'; }, 1500);
          });
        });
      }
    }

    // 이미지 프롬프트 추출
    extractImagePrompts(generatedContent);
  }

  /**
   * 나노바나나 최적화 프롬프트 생성
   */
  function generateNanobanaPrompt(description) {
    var prompt = 'Create a high-quality, professional photograph for a Korean blog post.\n\n';
    prompt += 'Subject: ' + description + '\n\n';
    prompt += 'Style Requirements:\n';
    prompt += '- Photorealistic, high resolution (4K quality)\n';
    prompt += '- Natural lighting, soft shadows\n';
    prompt += '- Clean, modern aesthetic suitable for lifestyle/blog content\n';
    prompt += '- Warm, inviting color tones\n';
    prompt += '- Professional composition with rule of thirds\n';
    prompt += '- Shallow depth of field for product/food shots\n';
    prompt += '- No text, watermarks, or logos\n';
    prompt += '- Korean aesthetic sensibility\n\n';
    prompt += 'Technical specs: 16:9 aspect ratio, vibrant but natural colors, Instagram-worthy quality';

    return prompt;
  }

  /**
   * 이미지 프롬프트 추출
   */
  function extractImagePrompts(text) {
    var imageSection = document.getElementById('imagePromptsSection');
    var promptsList = document.getElementById('imagePromptsList');

    if (!imageSection || !promptsList) return;

    // [이미지 N: 설명] 또는 [이미지: 설명] 패턴 찾기
    var imagePattern = /\[이미지\s*\d*\s*[:\s]\s*([^\]]+)\]/g;
    var matches = [];
    var match;

    while ((match = imagePattern.exec(text)) !== null) {
      matches.push(match[1].trim());
    }

    generatedImagePrompts = matches;

    if (matches.length > 0) {
      imageSection.style.display = 'block';
      promptsList.innerHTML = matches.map(function(description, index) {
        var optimizedPrompt = generateNanobanaPrompt(description);
        return '<div class="image-prompt-item">' +
          '<span class="prompt-number">' + (index + 1) + '</span>' +
          '<div class="prompt-content">' +
            '<span class="prompt-text">' + escapeHtml(description) + '</span>' +
            '<span class="prompt-preview">AI Studio용 프롬프트 생성됨</span>' +
          '</div>' +
          '<button class="copy-prompt-btn" data-prompt="' + escapeHtml(optimizedPrompt) + '">복사</button>' +
          '</div>';
      }).join('');

      // 복사 버튼 이벤트
      promptsList.querySelectorAll('.copy-prompt-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var promptText = btn.getAttribute('data-prompt');
          safeCopy(promptText).then(function() {
            btn.textContent = '복사됨!';
            setTimeout(function() { btn.textContent = '복사'; }, 1500);
          }).catch(function() {
            alert('복사에 실패했습니다.');
          });
        });
      });
    } else {
      imageSection.style.display = 'none';
    }
  }

  /**
   * 프롬프트 생성 (마크다운 제거 + 이미지 위치 표시 + SEO 제목)
   */
  function buildPrompt(analysis, options) {
    var structure = analysis.structure;
    var keywords = analysis.keywords;
    var style = analysis.style;

    var prompt = '당신은 네이버 블로그 SEO 전문가이자 콘텐츠 작성 전문가입니다.\n\n';

    prompt += '## 절대 금지 사항 (매우 중요) ##\n';
    prompt += '다음 마크다운 문법을 절대로 사용하지 마세요:\n';
    prompt += '- ** (볼드) 사용 금지\n';
    prompt += '- * (이탤릭) 사용 금지\n';
    prompt += '- # ## ### (헤딩) 사용 금지\n';
    prompt += '- ``` (코드블록) 사용 금지\n';
    prompt += '- > (인용) 사용 금지\n';
    prompt += '- - [ ] (체크박스) 사용 금지\n';
    prompt += '- [텍스트](링크) 사용 금지\n';
    prompt += '순수한 일반 텍스트만 작성하세요!\n\n';

    prompt += '## 작성 지침 ##\n';
    prompt += '1. 반드시 첫 줄에 SEO 최적화된 제목을 [제목] 태그로 작성하세요.\n';
    prompt += '   예시: [제목] 가양동 헬스장 추천! 바디프로짐에서 3개월 운동 후기\n';
    prompt += '2. 이미지가 들어갈 위치에는 [이미지 1: 설명], [이미지 2: 설명] 형식으로 순서대로 번호를 매겨 표시하세요.\n';
    prompt += '3. 소제목은 별도 줄에 작성하고 앞뒤로 빈 줄을 넣어 구분하세요.\n';
    prompt += '4. 강조가 필요하면 마크다운 대신 "따옴표"나 느낌표!를 사용하세요.\n';
    prompt += '5. 네이버 블로그에 바로 붙여넣기 할 수 있는 형태로 작성하세요.\n\n';

    prompt += '## SEO 제목 작성 규칙 ##\n';
    prompt += '- 메인 키워드를 제목 앞부분에 배치\n';
    prompt += '- 15~30자 내외로 작성\n';
    prompt += '- 클릭을 유도하는 후킹 요소 포함 (숫자, 감정, 이득)\n';
    prompt += '- 예시: "강남 PT 추천 | 3개월 -10kg 감량 성공 비결"\n';
    prompt += '- 예시: "가양동 헬스장 가격 비교! 가성비 최고는 여기"\n\n';

    // 사업장 정보
    if (options.businessName || options.writerRole) {
      prompt += '[사업장/작성자 정보]\n';
      if (options.businessName) {
        prompt += '- 사업장: ' + options.businessName + '\n';
      }
      if (options.businessInfo) {
        prompt += '- 특징: ' + options.businessInfo + '\n';
      }
      if (options.writerRole) {
        prompt += '- 작성자 역할: ' + options.writerRole + '\n';
        prompt += '- "' + options.writerRole + '"의 전문적인 시각과 경험을 녹여서 작성\n';
      }
      prompt += '\n';
    }

    // 원본 구조 데이터
    var originalImageCount = structure.imagePositions ? structure.imagePositions.positions.length : 0;
    var originalSubheadingCount = structure.subheadings ? structure.subheadings.length : 3;
    var originalCharCount = (structure.intro ? structure.intro.charCount : 0) +
                            (structure.body ? structure.body.charCount : 0) +
                            (structure.conclusion ? structure.conclusion.charCount : 0);
    var targetLength = calculateTargetLength(structure, options.lengthRatio);

    // 독창성 레벨별 이미지 수 결정 (상한선 적용)
    var recommendedImageCount;
    if (options.creativityLevel === '참고용') {
      recommendedImageCount = Math.min(15, originalImageCount);
    } else if (options.creativityLevel === '재해석') {
      recommendedImageCount = Math.min(12, Math.max(1, Math.round(originalImageCount * 0.8)));
    } else {
      recommendedImageCount = Math.min(10, Math.max(1, Math.round(originalImageCount * 0.6)));
    }

    // 스타일 한글 변환
    var styleNameMap = { 'formal': '정중한 존댓말(합니다체)', 'casual': '친근한 해요체', 'informal': '편안한 반말' };
    var toneNameMap = { 'concise': '간결한', 'balanced': '균형잡힌', 'detailed': '상세한', 'neutral': '중립적인' };
    var hookNameMap = { 'question': '질문형', 'exclamation': '감탄형', 'greeting': '인사형', 'statistic': '통계형', 'storytelling': '스토리텔링', 'direct': '직접 진술' };
    var styleName = styleNameMap[style.writingStyle] || style.writingStyle;
    var toneName = toneNameMap[style.tone] || style.tone;
    var hookName = hookNameMap[style.hookType] || style.hookType;

    prompt += '[원본 글 구조]\n';
    prompt += '- 전체 글자수: ' + originalCharCount + '자\n';
    prompt += '- 서론: ' + structure.intro.percent + '% (' + structure.intro.charCount + '자, ' + (structure.intro.style || '일반') + ')\n';
    prompt += '- 본론: ' + structure.body.percent + '% (' + structure.body.charCount + '자, ' + structure.body.sectionCount + '개 섹션)\n';
    prompt += '- 결론: ' + structure.conclusion.percent + '% (' + structure.conclusion.charCount + '자, ' + (structure.conclusion.style || '일반') + ')\n';
    prompt += '- 소제목 수: ' + originalSubheadingCount + '개\n';
    prompt += '- 평균 문단 길이: ' + structure.avgParagraphLength + '자\n';
    prompt += '- 원본 이미지 수: ' + originalImageCount + '장\n\n';

    prompt += '[분석된 스타일 - 반드시 이 스타일로 작성]\n';
    prompt += '- 문체: ' + styleName + '\n';
    prompt += '- 어조: ' + toneName + '\n';
    prompt += '- 문장 패턴: 서술형 ' + style.sentenceTypes.statement + '%, 질문형 ' + style.sentenceTypes.question + '%, 감탄형 ' + style.sentenceTypes.exclamation + '%\n';
    prompt += '- 첫문장 유형: ' + hookName + '\n';
    prompt += '- 평균 문장 길이: ' + style.avgSentenceLength + '자\n';
    if (style.emoji && style.emoji.count > 0) {
      prompt += '- 이모지 활용: ' + style.emoji.unique.slice(0, 5).join('') + ' (비슷한 이모지 활용)\n';
    }

    prompt += '\n[사용자 키워드]\n';
    prompt += '- 메인 키워드: ' + options.mainKeyword + '\n';
    prompt += '- 서브 키워드: ' + (options.subKeywords.length > 0 ? options.subKeywords.join(', ') : '없음') + '\n\n';

    // 최소 글자수 보장 (최소 2000자, 원본의 80% 이상)
    var minLength = Math.max(2000, Math.round(targetLength * 0.8));

    // 독창성 레벨별 프롬프트 분기
    if (options.creativityLevel === '참고용') {
      prompt += '[모드: 참고용 - 원본 구조 최대한 유지]\n';
      prompt += '원본 글의 구조, 문체, 문단 배치, 이미지 위치를 최대한 따라가되, 키워드만 바꿔서 작성하세요.\n';
      prompt += '- 서론/본론/결론 비율을 원본과 동일하게 유지 (' + structure.intro.percent + '/' + structure.body.percent + '/' + structure.conclusion.percent + '%)\n';
      prompt += '- 소제목 개수: ' + originalSubheadingCount + '개 (원본과 동일)\n';
      prompt += '- 이미지 위치: [이미지 N: 설명] 형식으로 번호를 매겨 ' + recommendedImageCount + '곳에 표시 (원본과 동일한 위치)\n';
      prompt += '- 문단 수와 각 문단 길이도 원본과 비슷하게 유지\n\n';
    } else if (options.creativityLevel === '재해석') {
      prompt += '[모드: 재해석 - 원본 구조 참고 + 새로운 표현]\n';
      prompt += '원본 글의 구조를 기반으로 하되, 표현과 전개 방식을 새롭게 작성하세요.\n';
      prompt += '- 서론/본론/결론 구조를 유지하되 비율은 약간 조정 가능\n';
      prompt += '- 소제목 개수: ' + originalSubheadingCount + '개 전후\n';
      prompt += '- 이미지 위치: [이미지 N: 설명] 형식으로 번호를 매겨 ' + recommendedImageCount + '곳에 표시\n';
      prompt += '- 원본의 핵심 논점은 유지하면서 다른 각도로 서술\n\n';
    } else {
      prompt += '[모드: 창작 - 원본 스타일만 참고 + 자유 창작]\n';
      prompt += '원본 글의 문체와 어조만 참고하고, 내용과 구조는 자유롭게 새로 작성하세요.\n';
      prompt += '- 서론/본론/결론 기본 구조만 유지\n';
      prompt += '- 소제목 개수: 자유 (원본 ' + originalSubheadingCount + '개 참고)\n';
      prompt += '- 이미지 위치: [이미지 N: 설명] 형식으로 번호를 매겨 ' + recommendedImageCount + '곳에 표시\n';
      prompt += '- 독창적인 관점과 새로운 정보를 포함\n\n';
    }

    prompt += '⚠️ [필수 글자수 규칙 - 반드시 준수] ⚠️\n';
    prompt += '- 목표 글자수: ' + targetLength + '자\n';
    prompt += '- 최소 글자수: ' + minLength + '자 (이 이하로 작성하면 안 됩니다!)\n';
    prompt += '- 원본 글자수: ' + originalCharCount + '자\n';
    prompt += '- 글을 절대로 요약하거나 축약하지 마세요\n';
    prompt += '- 각 섹션(서론/본론/결론)을 충분히 길고 상세하게 작성하세요\n';
    prompt += '- 짧은 글은 SEO에 불리합니다. 반드시 목표 글자수에 맞춰 충실하게 작성하세요\n\n';

    prompt += '[글 작성 지침]\n';
    prompt += '1. 첫 줄은 반드시 [제목] SEO 최적화된 제목 형식으로 작성\n';
    prompt += '2. 마크다운 없이 순수 텍스트로만 작성\n';
    prompt += '3. 문체는 반드시 ' + styleName + '으로 통일\n';
    prompt += '4. ' + (style.hookType === 'question' ? '질문으로 시작하여 독자의 관심을 끌어주세요' :
                       style.hookType === 'statistic' ? '구체적인 숫자/통계로 시작하여 신뢰감을 주세요' :
                       style.hookType === 'storytelling' ? '짧은 이야기/경험담으로 시작하여 몰입감을 주세요' :
                       style.hookType === 'greeting' ? '자연스러운 인사로 시작하세요' :
                       '흥미로운 도입부로 시작해주세요') + '\n';
    prompt += '5. 메인 키워드 "' + options.mainKeyword + '"를 제목, 첫 문단, 소제목에 자연스럽게 포함\n\n';

    // 학습된 인사이트 반영
    if (options.learnedInsights && options.learnedInsights.totalAnalyzed >= 3) {
      var insights = options.learnedInsights;
      prompt += '[AI 학습 인사이트 - ' + insights.totalAnalyzed + '개 글 분석 기반]\n';
      prompt += '지금까지 분석한 성공적인 블로그 글들의 패턴을 참고하세요:\n';
      prompt += '- 최적 구조: 서론 ' + insights.optimalStructure.intro + '% / 본론 ' + insights.optimalStructure.body + '% / 결론 ' + insights.optimalStructure.conclusion + '%\n';
      prompt += '- 권장 문단 길이: 평균 ' + insights.optimalStructure.paragraphLength + '자\n';
      prompt += '- 권장 소제목 수: ' + insights.optimalStructure.subheadings + '개\n';
      prompt += '- 선호 문체: ' + (insights.preferredStyle.writingStyle || '해요체') + '\n';
      prompt += '- 선호 어조: ' + (insights.preferredStyle.tone || '균형잡힌') + '\n';
      prompt += '- 효과적인 도입부: ' + (insights.preferredStyle.hookType || '질문형') + '\n';
      prompt += '- 키워드 밀도: ' + insights.keywordStrategy.targetDensity + '%\n';
      prompt += '- 평균 SEO 점수: ' + insights.seoSuccess.avgScore + '점 (이 점수 이상 목표)\n\n';
    }

    // 사용자 추가 요청사항
    if (options.customRequest) {
      prompt += '[사용자 추가 요청]\n';
      prompt += options.customRequest + '\n\n';
    }

    // 최종 리마인더
    prompt += '## 최종 확인 ##\n';
    prompt += '1. 마크다운 절대 금지: **볼드**, *이탤릭*, # 헤딩 등 어떤 마크다운도 사용하지 마세요.\n';
    prompt += '   "**단어:**" 형식으로 쓰지 말고, "단어:" 형식의 일반 텍스트로만 작성하세요.\n';
    prompt += '   소제목 강조가 필요하면 줄바꿈과 빈 줄로 구분하세요.\n';
    prompt += '2. 글자수 필수: 반드시 ' + minLength + '자 이상, 목표 ' + targetLength + '자로 작성하세요. 짧게 쓰지 마세요!\n';

    return prompt;
  }

  /**
   * 독창성 레벨 설명
   */
  function getCreativityDesc(level) {
    var descriptions = {
      '참고용': '최대한 참고하여',
      '재해석': '적절히 재해석하여',
      '창작': '창의적으로 변형하여'
    };
    return descriptions[level] || descriptions['재해석'];
  }

  /**
   * 목표 글자수 계산
   */
  function calculateTargetLength(structure, ratio) {
    var originalLength = (structure.intro ? structure.intro.charCount : 0) +
                        (structure.body ? structure.body.charCount : 0) +
                        (structure.conclusion ? structure.conclusion.charCount : 0);
    return Math.round(originalLength * (ratio / 100));
  }

  /**
   * 숫자 포맷팅
   */
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * HTML 이스케이프
   */
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 클립보드 복사 (폴백 포함)
   */
  function safeCopy(text) {
    return new Promise(function(resolve, reject) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(resolve).catch(function() {
          // 확장프로그램 사이드패널에서 clipboard API가 실제로 복사하지만
          // Promise가 reject되는 경우가 있으므로 폴백 시도 후 항상 resolve
          fallbackCopy(text);
          resolve();
        });
      } else {
        fallbackCopy(text) ? resolve() : reject(new Error('복사 실패'));
      }
    });
  }

  function fallbackCopy(text) {
    try {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      var success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (e) {
      return false;
    }
  }

  function copyToClipboard() {
    var content = document.getElementById('resultContent').textContent;
    safeCopy(content).then(function() {
      alert('클립보드에 복사되었습니다!');
    }).catch(function() {
      alert('복사에 실패했습니다.');
    });
  }

  /**
   * 이미지 생성 페이지 열기
   */
  function openImageGenerator() {
    // Gemini 열기
    var geminiUrl = 'https://gemini.google.com/app';
    window.open(geminiUrl, '_blank');
  }

  // 이벤트 리스너
  refreshBtn.addEventListener('click', showAnalysisModal);

  // SEO 분석 패널 버튼 이벤트
  var seoPanelBtn = document.getElementById('seoPanelBtn');
  if (seoPanelBtn) {
    seoPanelBtn.addEventListener('click', openSeoAnalysisPanel);
  }

  // 캡처 버튼 이벤트
  var captureBtn = document.getElementById('captureBtn');
  if (captureBtn) {
    captureBtn.addEventListener('click', captureBlogContent);
  }

  // 분석하기 버튼 이벤트
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', showAnalysisModal);
  }

  // 분석 옵션 모달 이벤트
  if (analysisCopyOnly) {
    analysisCopyOnly.addEventListener('click', function() {
      runAnalysis(false); // 학습 없이 분석만
    });
  }
  if (analysisWithLearn) {
    analysisWithLearn.addEventListener('click', function() {
      runAnalysis(true); // 학습 포함 분석
    });
  }
  if (analysisModalClose) {
    analysisModalClose.addEventListener('click', hideAnalysisModal);
  }
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', hideAnalysisModal);
  }

  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
  });

  generateBtn.addEventListener('click', generatePost);
  copyBtn.addEventListener('click', copyToClipboard);

  // 프롬프트 전체복사 버튼 이벤트
  var copyAllPromptsBtn = document.getElementById('copyAllPromptsBtn');
  if (copyAllPromptsBtn) {
    copyAllPromptsBtn.addEventListener('click', function() {
      if (!generatedImagePrompts || generatedImagePrompts.length === 0) {
        alert('복사할 프롬프트가 없습니다.');
        return;
      }
      var allPrompts = generatedImagePrompts.map(function(desc, i) {
        return (i + 1) + '. ' + generateNanobanaPrompt(desc);
      }).join('\n\n');
      safeCopy(allPrompts).then(function() {
        copyAllPromptsBtn.textContent = '복사 완료!';
        setTimeout(function() { copyAllPromptsBtn.textContent = '프롬프트 전체복사'; }, 1500);
      }).catch(function() {
        alert('복사에 실패했습니다.');
      });
    });
  }

  // 이미지 생성 버튼 이벤트
  var imageGenBtn = document.getElementById('imageGenBtn');
  if (imageGenBtn) {
    imageGenBtn.addEventListener('click', openImageGenerator);
  }

  // ========== 클립보드 복사 기능 ==========

  var startTypingBtn = document.getElementById('startTypingBtn');
  var typingProgress = document.getElementById('typingProgress');
  var typingProgressFill = document.getElementById('typingProgressFill');
  var typingProgressText = document.getElementById('typingProgressText');

  /**
   * 글쓰기 (클립보드 복사)
   */
  function startTyping() {
    var resultContent = document.getElementById('resultContent');
    var text = resultContent ? resultContent.textContent : '';

    if (!text || text.trim() === '') {
      alert('먼저 글을 생성해주세요.');
      return;
    }

    // 이미지 플레이스홀더는 이미 번호가 매겨져 있으므로 그대로 사용
    var processedText = text;

    // 클립보드에 복사
    safeCopy(processedText).then(function() {
      typingProgressFill.style.width = '100%';
      typingProgressText.textContent = '복사 완료!';
      typingProgress.style.display = 'block';

      alert('✅ 클립보드에 복사되었습니다!\n\n네이버 블로그 본문을 클릭한 후\nCtrl+V로 붙여넣기 하세요.');

      setTimeout(function() {
        typingProgress.style.display = 'none';
      }, 3000);
    }).catch(function(err) {
      console.error('클립보드 복사 실패:', err);
      alert('클립보드 복사에 실패했습니다.');
    });
  }

  // 복사 버튼 이벤트 리스너
  if (startTypingBtn) {
    startTypingBtn.addEventListener('click', startTyping);
  }

  // ========== 글쓰기 자동화 (직접 타이핑) ==========

  var autoTypingBtn = document.getElementById('autoTypingBtn');

  /**
   * 글쓰기 자동화 (직접 타이핑)
   */
  function startAutoTyping() {
    var resultContent = document.getElementById('resultContent');
    var text = resultContent ? resultContent.textContent : '';

    if (!text || text.trim() === '') {
      alert('먼저 글을 생성해주세요.');
      return;
    }

    // UI 업데이트
    autoTypingBtn.disabled = true;
    autoTypingBtn.textContent = '⏳ 타이핑 중...';
    typingProgress.style.display = 'block';
    typingProgressFill.style.width = '0%';
    typingProgressText.textContent = '에디터 활성화 중...';

    var formatOptions = { speed: 20 };

    // 현재 탭에 콘텐츠 스크립트로 타이핑 요청
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || tabs.length === 0) {
        alert('활성 탭을 찾을 수 없습니다.');
        resetAutoTypingUI();
        return;
      }

      var tab = tabs[0];

      // 네이버 블로그 글쓰기 페이지 확인
      if (!tab.url || !tab.url.includes('blog.naver.com')) {
        alert('네이버 블로그 글쓰기 페이지에서 실행해주세요.\n\n현재 URL: ' + (tab.url || '알 수 없음'));
        resetAutoTypingUI();
        return;
      }

      // UI 업데이트
      autoTypingBtn.textContent = '⏹️ 중단하려면 클릭';
      typingProgressText.textContent = '입력 시작...';

      // 콘텐츠 스크립트에 타이핑 요청
      chrome.tabs.sendMessage(tab.id, {
        action: 'startTyping',
        text: text,
        options: formatOptions
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('메시지 전송 오류:', chrome.runtime.lastError);
          alert('❌ 에디터에 연결할 수 없습니다.\n\n[해결 방법]\n1. 네이버 블로그 글쓰기 페이지를 새로고침\n2. 본문 영역을 한 번 클릭\n3. 다시 시도');
          resetAutoTypingUI();
          return;
        }

        if (response && response.success) {
          typingProgressFill.style.width = '100%';
          typingProgressText.textContent = '완료! ' + (response.typed || '') + '자 입력됨';
          alert('✅ 타이핑 완료!');
        } else {
          var errorMsg = response ? response.error : '알 수 없는 오류';
          alert('❌ 타이핑 오류: ' + errorMsg);
        }
        resetAutoTypingUI();
      });
    });
  }

  function resetAutoTypingUI() {
    autoTypingBtn.disabled = false;
    autoTypingBtn.textContent = '⌨️ 에디터에 직접 입력';
    setTimeout(function() {
      typingProgress.style.display = 'none';
    }, 2000);
  }

  if (autoTypingBtn) {
    autoTypingBtn.addEventListener('click', startAutoTyping);
  }

  // 진행률 업데이트 리스너
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'typingProgress') {
      var percent = Math.round((request.current / request.total) * 100);
      typingProgressFill.style.width = percent + '%';
      typingProgressText.textContent = request.current + ' / ' + request.total + '자 (' + percent + '%)';
    }
  });

  // 역할 태그 클릭 이벤트
  var roleTags = document.querySelectorAll('.role-tag');
  var writerRoleInput = document.getElementById('writerRole');
  if (roleTags && writerRoleInput) {
    roleTags.forEach(function(tag) {
      tag.addEventListener('click', function() {
        writerRoleInput.value = tag.getAttribute('data-role');
      });
    });
  }

  // 독창성 레벨 설명 업데이트
  var creativityDescriptions = {
    '참고용': '참고용: 원본과 최대한 유사하게 구조와 표현을 따라 작성',
    '재해석': '재해석: 원본 구조를 유지하면서 새로운 표현으로 작성',
    '창작': '창작: 원본의 핵심만 참고하고 완전히 새롭게 창작'
  };

  var creativityRadios = document.querySelectorAll('input[name="creativity"]');
  var creativityDescEl = document.getElementById('creativityDesc');
  if (creativityRadios && creativityDescEl) {
    creativityRadios.forEach(function(radio) {
      radio.addEventListener('change', function() {
        var desc = creativityDescriptions[radio.value] || '';
        creativityDescEl.innerHTML = '<small>' + desc + '</small>';
      });
    });
  }

  // 학습 현황 업데이트
  function updateLearningStatus() {
    if (typeof LearningEngine === 'undefined') return;

    LearningEngine.getSummary().then(function(summary) {
      var countEl = document.getElementById('learningCount');
      var scoreEl = document.getElementById('learningScore');

      if (countEl) {
        countEl.textContent = summary.totalAnalyzed + '개 글 학습됨';
      }
      if (scoreEl) {
        if (summary.totalAnalyzed > 0) {
          scoreEl.textContent = '평균 ' + summary.avgSeoScore + '점';
          scoreEl.title = '선호 스타일: ' + (summary.topStyle || '-') + '\n주요 업종: ' + (summary.topIndustry || '-');
        } else {
          scoreEl.textContent = '-';
        }
      }
    });
  }

  // 초기화
  loadSavedAnalysis();
  updateLearningStatus();

  // ========== YouTube 변환 기능 ==========

  var youtubeSection = document.getElementById('youtubeSection');
  var youtubeUrl = document.getElementById('youtubeUrl');
  var youtubeAnalyzeBtn = document.getElementById('youtubeAnalyzeBtn');
  var youtubeUsage = document.getElementById('youtubeUsage');
  var youtubeAnalysisResult = document.getElementById('youtubeAnalysisResult');
  var youtubeVideoPreview = document.getElementById('youtubeVideoPreview');
  var youtubeCustomPrompt = document.getElementById('youtubeCustomPrompt');
  var youtubeGenerateBtn = document.getElementById('youtubeGenerateBtn');

  // 현재 분석된 YouTube 데이터 저장
  var currentYouTubeData = null;

  /**
   * YouTube 사용량 업데이트
   */
  async function updateYouTubeUsage() {
    try {
      var result = await chrome.storage.local.get(['userInfo']);
      var userId = result.userInfo?.uid || 'anonymous';

      var response = await new Promise(function(resolve) {
        chrome.runtime.sendMessage({
          action: 'getYouTubeUsage',
          userId: userId
        }, resolve);
      });

      if (response && response.success && youtubeUsage) {
        var usage = response.usage;
        youtubeUsage.textContent = '오늘 ' + usage.remaining + '/' + usage.limit + '건 남음';

        // 색상 변경
        youtubeUsage.classList.remove('warning', 'depleted');
        if (usage.remaining === 0) {
          youtubeUsage.classList.add('depleted');
        } else if (usage.remaining === 1) {
          youtubeUsage.classList.add('warning');
        }
      }
    } catch (error) {
      console.error('YouTube 사용량 조회 오류:', error);
    }
  }

  /**
   * YouTube URL 유효성 검사
   */
  function isValidYouTubeUrl(url) {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/.test(url);
  }

  /**
   * YouTube 영상 분석 (블로그 생성 없이 정보만 가져오기)
   */
  async function analyzeYouTube() {
    var url = youtubeUrl.value.trim();

    if (!url) {
      alert('YouTube URL을 입력해주세요.');
      return;
    }

    if (!isValidYouTubeUrl(url)) {
      alert('유효한 YouTube URL이 아닙니다.\n\n예시:\nhttps://www.youtube.com/watch?v=xxxxx\nhttps://youtu.be/xxxxx');
      return;
    }

    // 버튼 비활성화
    youtubeAnalyzeBtn.disabled = true;
    youtubeAnalyzeBtn.textContent = '분석 중...';
    showLoading(true, 'YouTube 영상을 분석하고 있습니다...');

    try {
      var response = await new Promise(function(resolve) {
        chrome.runtime.sendMessage({
          action: 'analyzeYouTube',
          url: url
        }, resolve);
      });

      if (response && response.success) {
        // 분석 결과 저장
        currentYouTubeData = {
          url: url,
          ...response.data
        };

        // 분석 결과 UI 표시
        displayYouTubeAnalysis(response.data);
      } else {
        alert(response ? response.error : 'YouTube 분석에 실패했습니다.');
      }
    } catch (error) {
      console.error('YouTube 분석 오류:', error);
      alert('분석 중 오류가 발생했습니다.');
    } finally {
      youtubeAnalyzeBtn.disabled = false;
      youtubeAnalyzeBtn.textContent = '분석';
      showLoading(false);
    }
  }

  /**
   * YouTube 분석 결과 UI 표시
   */
  function displayYouTubeAnalysis(data) {
    var videoInfo = data.videoInfo;

    // 영상 정보 HTML 생성
    var previewHtml = '<div class="video-info">';

    if (videoInfo.thumbnail) {
      previewHtml += '<img src="' + videoInfo.thumbnail + '" class="video-thumbnail" alt="썸네일">';
    }

    previewHtml += '<div class="video-details">';
    previewHtml += '<div class="video-title">' + escapeHtml(videoInfo.title) + '</div>';
    previewHtml += '<div class="video-channel">' + escapeHtml(videoInfo.channel) + '</div>';

    // 자막 여부 표시
    if (data.hasTranscript) {
      previewHtml += '<span class="video-status has-transcript">✅ 자막 있음</span>';
    } else {
      previewHtml += '<span class="video-status no-transcript">⚠️ 자막 없음 (설명 기반 변환)</span>';
    }

    previewHtml += '</div></div>';

    // 설명 미리보기
    if (videoInfo.description) {
      previewHtml += '<div class="video-description">' + escapeHtml(videoInfo.description) + '</div>';
    }

    youtubeVideoPreview.innerHTML = previewHtml;

    // 분석 결과 섹션 표시
    youtubeAnalysisResult.style.display = 'block';

    // 추가 프롬프트 초기화
    if (youtubeCustomPrompt) {
      youtubeCustomPrompt.value = '';
    }

    // 스크롤 이동
    youtubeAnalysisResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * YouTube 블로그 글 생성
   */
  async function generateYouTubeBlog() {
    if (!currentYouTubeData) {
      alert('먼저 YouTube 영상을 분석해주세요.');
      return;
    }

    // 로그인 확인
    var result = await chrome.storage.local.get(['userInfo']);
    var userId = result.userInfo?.uid || 'anonymous';

    // 추가 프롬프트
    var customPrompt = youtubeCustomPrompt ? youtubeCustomPrompt.value.trim() : '';

    // 버튼 비활성화
    youtubeGenerateBtn.disabled = true;
    youtubeGenerateBtn.innerHTML = '<span>⏳</span> 생성 중...';
    showLoading(true, 'AI가 블로그 글을 생성하고 있습니다...');

    try {
      var response = await new Promise(function(resolve) {
        chrome.runtime.sendMessage({
          action: 'generateYouTubeBlog',
          url: currentYouTubeData.url,
          userId: userId,
          customPrompt: customPrompt
        }, resolve);
      });

      if (response && response.success) {
        // 성공: 결과 표시
        displayYouTubeResult(response.data);
        updateYouTubeUsage();

        // 분석 섹션 숨기기 및 초기화
        youtubeAnalysisResult.style.display = 'none';
        youtubeUrl.value = '';
        currentYouTubeData = null;
      } else {
        alert(response ? response.error : 'YouTube 블로그 생성에 실패했습니다.');
        if (response && response.usage) {
          updateYouTubeUsage();
        }
      }
    } catch (error) {
      console.error('YouTube 블로그 생성 오류:', error);
      alert('생성 중 오류가 발생했습니다.');
    } finally {
      youtubeGenerateBtn.disabled = false;
      youtubeGenerateBtn.innerHTML = '<span>✨</span> AI로 블로그 글 생성하기';
      showLoading(false);
    }
  }

  /**
   * YouTube 변환 결과 표시
   */
  function displayYouTubeResult(data) {
    var resultCard = document.getElementById('resultCard');
    var resultContent = document.getElementById('resultContent');
    var bannedWordResult = document.getElementById('bannedWordResult');

    // 마크다운 제거
    var cleanedContent = removeMarkdown(data.blogContent);

    // 금칙어 검사 및 자동 대체
    var bannedResult = checkAndReplaceBannedWords(cleanedContent);

    // 제목과 본문 분리
    var extracted = extractTitleAndContent(bannedResult.replacedText);
    var generatedTitle = extracted.title;
    var generatedContent = extracted.content;

    // 본문 표시
    resultContent.textContent = generatedContent;
    resultCard.style.display = 'block';

    // 제목 및 금칙어 결과 표시
    if (bannedWordResult) {
      var titleHtml = '';

      // 영상 정보 표시
      if (data.videoInfo) {
        titleHtml += '<div class="youtube-video-info" style="display: flex; gap: 12px; margin-bottom: 12px; padding: 12px; background: #f5f5f5; border-radius: 8px;">';
        if (data.videoInfo.thumbnail) {
          titleHtml += '<img src="' + data.videoInfo.thumbnail + '" class="youtube-thumbnail" style="width: 120px; border-radius: 6px;">';
        }
        titleHtml += '<div style="flex: 1;">';
        titleHtml += '<div style="font-weight: 600; margin-bottom: 4px;">' + escapeHtml(data.videoInfo.title) + '</div>';
        titleHtml += '<div style="font-size: 12px; color: #666;">' + escapeHtml(data.videoInfo.channel) + '</div>';
        titleHtml += '<div style="font-size: 11px; color: ' + (data.hasTranscript ? '#27ae60' : '#e67e22') + '; margin-top: 4px;">';
        titleHtml += data.hasTranscript ? '✅ 자막 기반 변환' : '⚠️ 설명 기반 변환 (자막 없음)';
        titleHtml += '</div>';
        titleHtml += '</div></div>';
      }

      // SEO 제목 표시
      if (generatedTitle) {
        titleHtml += '<div class="generated-title">' +
          '<div class="generated-title-label">📌 SEO 최적화 제목</div>' +
          '<div class="generated-title-text">' + escapeHtml(generatedTitle) + '</div>' +
          '<button class="copy-title-btn" id="copyTitleBtn">제목 복사</button>' +
          '</div>';
      }

      // 금칙어 검토 결과
      if (bannedResult.foundWords.length > 0) {
        var replacementList = bannedResult.foundWords.map(function(item) {
          if (item.replacement) {
            return '"' + item.original + '" → "' + item.replacement + '"';
          } else {
            return '"' + item.original + '" (삭제됨)';
          }
        }).join('<br>');

        titleHtml += '<div class="info-box">' +
          '<strong>🔄 금칙어 자동 수정 완료 (' + bannedResult.foundWords.length + '개)</strong><br>' +
          '<div class="replacement-list">' + replacementList + '</div>' +
          '<small>네이버 검색 노출에 불리한 단어들이 자동으로 대체되었습니다.</small>' +
          '</div>';
      } else {
        titleHtml += '<div class="success-box">' +
          '<strong>✅ 금칙어 검사 통과</strong><br>' +
          '<small>네이버 금칙어가 발견되지 않았습니다.</small>' +
          '</div>';
      }

      bannedWordResult.innerHTML = titleHtml;

      // 제목 복사 버튼 이벤트
      var copyTitleBtn = document.getElementById('copyTitleBtn');
      if (copyTitleBtn) {
        copyTitleBtn.addEventListener('click', function() {
          safeCopy(generatedTitle).then(function() {
            copyTitleBtn.textContent = '복사됨!';
            setTimeout(function() { copyTitleBtn.textContent = '제목 복사'; }, 1500);
          });
        });
      }
    }

    // 이미지 프롬프트 추출
    extractImagePrompts(generatedContent);

    // 생성 탭으로 이동
    switchTab('generate');

    // 스크롤 이동
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * 현재 탭이 YouTube인지 확인하고 URL 자동 입력
   */
  async function checkCurrentTabForYouTube() {
    try {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].url && isValidYouTubeUrl(tabs[0].url)) {
        youtubeUrl.value = tabs[0].url;
        youtubeUrl.placeholder = '현재 페이지 URL이 입력되었습니다';
      }
    } catch (error) {
      console.error('탭 확인 오류:', error);
    }
  }

  // YouTube 이벤트 리스너
  if (youtubeAnalyzeBtn) {
    youtubeAnalyzeBtn.addEventListener('click', analyzeYouTube);
  }

  if (youtubeGenerateBtn) {
    youtubeGenerateBtn.addEventListener('click', generateYouTubeBlog);
  }

  if (youtubeUrl) {
    // Enter 키로 분석
    youtubeUrl.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        analyzeYouTube();
      }
    });

    // 붙여넣기 시 자동 하이라이트
    youtubeUrl.addEventListener('paste', function(e) {
      setTimeout(function() {
        if (isValidYouTubeUrl(youtubeUrl.value)) {
          youtubeUrl.style.borderColor = '#00C853';
        }
      }, 100);
    });

    // URL 변경 시 분석 결과 숨기기
    youtubeUrl.addEventListener('input', function() {
      if (youtubeAnalysisResult && youtubeAnalysisResult.style.display !== 'none') {
        youtubeAnalysisResult.style.display = 'none';
        currentYouTubeData = null;
      }
    });
  }

  // YouTube 섹션이 있으면 사용량 업데이트 및 현재 탭 확인
  if (youtubeSection) {
    updateYouTubeUsage();
    checkCurrentTabForYouTube();
  }
});
