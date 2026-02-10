/**
 * 블로그 부스터 Pro - 통합 서비스 워커
 * 블로그 부스터 + 블로그 벤치마커 Pro 통합
 */

// 환경 설정 로드
importScripts('../lib/env-config.js');

// ==================== 설정 ====================
// 관리자 이메일 (env-config.js에서 로드)
const ADMIN_EMAIL = ENV_CONFIG.adminEmail;

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent';
const DEFAULT_GEMINI_API_KEY = 'AIzaSyBTkLbVrVB6ucdiGiQNuGeWbqOsFHBecp4';

// YouTube API 설정
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_DAILY_LIMIT = 3; // 1인당 일일 변환 제한

// YouTube API 키 목록 (관리자 페이지에서 설정하거나 Firebase에서 관리)
// 설정 방법: 관리자 페이지 > API 설정에서 YouTube API 키 추가
let youtubeApiKeys = [];

// 확장 프로그램 설치 시 실행
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Service Worker] 블로그 부스터 Pro 설치됨 v2.0');

  // 사이드패널 설정
  chrome.sidePanel.setOptions({
    enabled: true
  });

  // 컨텍스트 메뉴 생성
  chrome.contextMenus.create({
    id: 'blogBoosterAnalyze',
    title: '블로그 부스터로 분석',
    contexts: ['page'],
    documentUrlPatterns: ['https://blog.naver.com/*', 'https://m.blog.naver.com/*']
  });

  // Firebase에서 API 키 동기화 (설치/업데이트 시)
  syncApiKeysFromFirebase();
});

// 서비스 워커 시작 시 API 키 동기화
chrome.runtime.onStartup.addListener(() => {
  console.log('[Service Worker] 브라우저 시작 - API 키 동기화');
  syncApiKeysFromFirebase();
});

// Firebase에서 API 키 동기화 (로그인 상태와 무관하게)
async function syncApiKeysFromFirebase() {
  try {
    console.log('[Service Worker] Firebase에서 API 키 동기화 시작...');

    const settingsUrl = `${FIRESTORE_BASE_URL}/settings/apiKeys`;

    // 토큰 없이도 읽기 시도 (보안 규칙에서 로그인 사용자 읽기 허용)
    const token = await getFirebaseIdToken().catch(() => null);

    const response = await fetch(settingsUrl, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (!response.ok) {
      console.log('[Service Worker] API 설정 문서 없음 또는 접근 불가');
      return;
    }

    const doc = await response.json();
    const settings = firestoreDocToJson(doc);

    if (settings) {
      // YouTube API 키 동기화
      if (settings.youtubeApiKeys && Array.isArray(settings.youtubeApiKeys) && settings.youtubeApiKeys.length > 0) {
        youtubeApiKeys = settings.youtubeApiKeys;
        await chrome.storage.local.set({ youtubeApiKeys: settings.youtubeApiKeys });
        console.log('[Service Worker] YouTube API 키 동기화 완료:', youtubeApiKeys.length, '개');
      }

      // Gemini API 키도 동기화 (서버용)
      if (settings.geminiApiKey) {
        await chrome.storage.local.set({ serverGeminiApiKey: settings.geminiApiKey });
        console.log('[Service Worker] Gemini API 키 동기화 완료');
      }

      // freeAccessEnabled 설정 동기화
      await chrome.storage.local.set({ freeAccessEnabled: settings.freeAccessEnabled || false });
    }
  } catch (error) {
    console.log('[Service Worker] API 키 동기화 실패 (정상 - 오프라인 또는 최초 실행):', error.message);
  }
}

// 확장 프로그램 아이콘 클릭 시 사이드패널 열기
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[Service Worker] 아이콘 클릭 - 사이드패널 열기');
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// 컨텍스트 메뉴 클릭 핸들러
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'blogBoosterAnalyze' && tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Service Worker] 메시지 수신:', request.action);

  switch (request.action) {
    // ==================== AI 관련 ====================
    case 'generateContent':
      handleGenerateContent(request, sendResponse);
      return true;

    case 'getApiKey':
      handleGetApiKey(sendResponse);
      return true;

    case 'setApiKey':
      handleSetApiKey(request.apiKey, sendResponse);
      return true;

    // ==================== 분석 관련 ====================
    case 'analyzeCurrentTab':
      handleAnalyzeCurrentTab(sendResponse);
      return true;

    case 'saveAnalysis':
      handleSaveAnalysis(request.data, sendResponse);
      return true;

    case 'getAnalysisHistory':
      handleGetAnalysisHistory(sendResponse);
      return true;

    // ==================== 사이드패널 ====================
    case 'openSidePanel':
      handleOpenSidePanel(request.tabId || sender.tab?.id, sendResponse);
      return true;

    // ==================== 블로그 부스터 기능 ====================
    case 'executeFunction':
      handleExecuteFunction(request.functionName, sendResponse);
      return true;

    case 'getCharCount':
      handleGetCharCount(sendResponse);
      return true;

    // ==================== YouTube 관련 ====================
    case 'analyzeYouTube':
      handleAnalyzeYouTube(request, sendResponse);
      return true;

    case 'generateYouTubeBlog':
      handleGenerateYouTubeBlog(request, sendResponse);
      return true;

    case 'convertYouTubeToBlog':
      handleYouTubeToBlog(request, sendResponse);
      return true;

    case 'getYouTubeUsage':
      handleGetYouTubeUsage(request.userId, sendResponse);
      return true;

    case 'setYouTubeApiKeys':
      handleSetYouTubeApiKeys(request.keys, sendResponse);
      return true;

    // ==================== 이미지 캡처 관련 ====================
    case 'fetchImageAsBase64':
      handleFetchImageAsBase64(request.url, sendResponse);
      return true;

    // ==================== 프로모션 코드 관련 ====================
    case 'validatePromoCode':
      handleValidatePromoCode(request.code, sendResponse);
      return true;

    case 'usePromoCode':
      handleUsePromoCode(request.code, request.userId, sendResponse);
      return true;

    case 'getUserPlan':
      handleGetUserPlan(request.userId, sendResponse);
      return true;

    // ==================== Firebase 학습 데이터 관련 ====================
    case 'loadLearningDataFromFirebase':
      handleLoadLearningData(request.userId, sendResponse);
      return true;

    case 'saveLearningDataToFirebase':
      handleSaveLearningData(request.userId, request.data, sendResponse);
      return true;

    case 'saveGeneratedPost':
      handleSaveGeneratedPost(request.userId, request.postData, sendResponse);
      return true;

    case 'getGeneratedPosts':
      handleGetGeneratedPosts(request.userId, request.limit, sendResponse);
      return true;

    case 'getAllUsersLearningData':
      handleGetAllUsersLearningData(sendResponse);
      return true;

    case 'getAllGeneratedPosts':
      handleGetAllGeneratedPosts(request.limit, sendResponse);
      return true;

    // ==================== Firebase API 키 관리 ====================
    case 'saveGeminiApiKeyToFirebase':
      handleSaveGeminiApiKeyToFirebase(request.apiKey, request.options, sendResponse);
      return true;

    case 'getGeminiApiKeyAccess':
      handleGetGeminiApiKeyAccess(sendResponse);
      return true;

    case 'getApiSettings':
      handleGetApiSettings(sendResponse);
      return true;

    case 'syncApiKeys':
      // 로그인 후 또는 수동으로 API 키 동기화 요청 시
      syncApiKeysFromFirebase().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    default:
      sendResponse({ success: false, error: '알 수 없는 액션' });
      return false;
  }
});

// API 키를 Firebase에 저장 (관리자용)
async function handleSaveGeminiApiKeyToFirebase(apiKey, options, sendResponse) {
  const result = await saveApiKeyToFirebase(apiKey, options);
  sendResponse(result);
}

// API 키 접근 권한 확인
async function handleGetGeminiApiKeyAccess(sendResponse) {
  const result = await getGeminiApiKeyFromFirebase();
  sendResponse(result);
}

// API 설정 가져오기 (관리자용)
async function handleGetApiSettings(sendResponse) {
  try {
    const settingsUrl = `${FIRESTORE_BASE_URL}/settings/apiKeys`;
    const response = await fetchWithTokenRefresh(settingsUrl);

    if (!response || !response.ok) {
      sendResponse({ success: false, error: '설정을 찾을 수 없습니다.' });
      return;
    }

    const doc = await response.json();
    const settings = firestoreDocToJson(doc);

    sendResponse({
      success: true,
      settings: {
        hasApiKey: !!settings?.geminiApiKey,
        freeAccessEnabled: settings?.freeAccessEnabled || false,
        youtubeApiKeys: settings?.youtubeApiKeys || [],
        hasYouTubeApiKeys: !!(settings?.youtubeApiKeys && settings.youtubeApiKeys.length > 0),
        updatedAt: settings?.updatedAt || null
      }
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// ==================== AI 핸들러 ====================

async function handleGenerateContent(request, sendResponse) {
  try {
    // Firebase에서 API 키 가져오기 (구독 확인 포함)
    let key = request.apiKey;

    if (!key) {
      const apiKeyResult = await getGeminiApiKeyFromFirebase();
      if (!apiKeyResult.success) {
        sendResponse({
          success: false,
          error: apiKeyResult.error,
          requireSubscription: apiKeyResult.requireSubscription
        });
        return;
      }
      key = apiKeyResult.apiKey;
    }

    if (!key) {
      sendResponse({ success: false, error: 'API 키가 설정되지 않았습니다.' });
      return;
    }
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: request.prompt }]
        }],
        generationConfig: {
          temperature: request.temperature || 0.7,
          maxOutputTokens: request.maxTokens || 4096,
          topP: 0.8,
          topK: 40
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API 오류: ${response.status} - ${errorData.error?.message || '알 수 없는 오류'}`);
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('응답 생성에 실패했습니다.');
    }

    const generatedText = data.candidates[0].content.parts[0].text;
    sendResponse({ success: true, data: generatedText });
  } catch (error) {
    console.error('[Service Worker] AI 생성 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetApiKey(sendResponse) {
  try {
    const result = await chrome.storage.sync.get(['geminiApiKey']);
    sendResponse({ success: true, apiKey: result.geminiApiKey || '' });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleSetApiKey(apiKey, sendResponse) {
  try {
    await chrome.storage.sync.set({ geminiApiKey: apiKey });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// ==================== 분석 핸들러 ====================

async function handleAnalyzeCurrentTab(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      sendResponse({ success: false, error: '활성 탭을 찾을 수 없습니다.' });
      return;
    }

    if (!tab.url.includes('blog.naver.com')) {
      sendResponse({ success: false, error: '네이버 블로그 페이지에서만 사용 가능합니다.' });
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'analyze' });
    sendResponse(response);
  } catch (error) {
    console.error('[Service Worker] 분석 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleSaveAnalysis(data, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['analysisHistory']);
    const history = result.analysisHistory || [];

    history.unshift({
      ...data,
      savedAt: new Date().toISOString()
    });

    if (history.length > 50) {
      history.pop();
    }

    await chrome.storage.local.set({ analysisHistory: history });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetAnalysisHistory(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['analysisHistory']);
    sendResponse({ success: true, data: result.analysisHistory || [] });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// ==================== 사이드패널 핸들러 ====================

async function handleOpenSidePanel(tabId, sendResponse) {
  try {
    if (tabId) {
      await chrome.sidePanel.open({ tabId: tabId });
    } else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
    }
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Service Worker] 사이드패널 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ==================== 블로그 부스터 핸들러 ====================

async function sendMessageToTab(tabId, message) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content/blog-helper.js']
    }).catch(() => {});

    const response = await chrome.tabs.sendMessage(tabId, message);
    return response;
  } catch (error) {
    console.log('Message send failed:', error.message);
    return null;
  }
}

async function handleExecuteFunction(functionName, sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      const response = await sendMessageToTab(tab.id, { action: functionName });
      sendResponse(response || { success: true });
    } else {
      sendResponse({ success: false, error: 'No active tab' });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetCharCount(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      const response = await sendMessageToTab(tab.id, { action: 'getCharCount' });
      sendResponse(response || { total: 0, withSpaces: 0 });
    } else {
      sendResponse({ total: 0, withSpaces: 0 });
    }
  } catch (error) {
    sendResponse({ total: 0, withSpaces: 0 });
  }
}

// ==================== 탭 이벤트 ====================

// 탭 업데이트 시 뱃지 상태 변경
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isNaverBlog = tab.url.includes('blog.naver.com') || tab.url.includes('naver.com/blog');
    const isYouTube = tab.url.includes('youtube.com/watch');

    if (isNaverBlog) {
      chrome.action.setBadgeText({ tabId: tabId, text: '✓' });
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#00C853' });
    } else if (isYouTube) {
      chrome.action.setBadgeText({ tabId: tabId, text: 'YT' });
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#FF0000' });
    } else {
      chrome.action.setBadgeText({ tabId: tabId, text: '' });
    }
  }
});

// ==================== YouTube 핸들러 ====================

// YouTube URL에서 Video ID 추출
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// 사용 가능한 YouTube API 키 가져오기 (로테이션)
async function getAvailableYouTubeApiKey() {
  try {
    // 로컬에서 먼저 확인
    const result = await chrome.storage.local.get(['youtubeApiKeys', 'youtubeApiUsage']);
    let keys = result.youtubeApiKeys || youtubeApiKeys;

    // 로컬에 키가 없으면 Firebase에서 로드
    if (!keys || keys.length === 0) {
      console.log('[YouTube] 로컬에 API 키 없음, Firebase에서 로드 시도');
      const firebaseResult = await loadYouTubeApiKeysFromFirebase();
      if (firebaseResult.success) {
        keys = firebaseResult.keys;
      }
    }

    if (!keys || keys.length === 0) {
      console.warn('[YouTube] API 키가 설정되지 않았습니다.');
      return null;
    }

    const usage = result.youtubeApiUsage || {};
    const today = new Date().toISOString().split('T')[0];

    // 가장 여유있는 키 선택
    let bestKey = null;
    let minUsage = Infinity;

    for (const key of keys) {
      const keyUsage = usage[key]?.[today] || 0;
      if (keyUsage < 9500 && keyUsage < minUsage) { // 9500 유닛 미만인 키
        bestKey = key;
        minUsage = keyUsage;
      }
    }

    return bestKey || keys[0];
  } catch (error) {
    console.error('[YouTube] API 키 가져오기 오류:', error);
    return youtubeApiKeys[0] || null;
  }
}

// API 키 사용량 업데이트
async function updateApiKeyUsage(apiKey, unitsUsed) {
  try {
    const result = await chrome.storage.local.get(['youtubeApiUsage']);
    const usage = result.youtubeApiUsage || {};
    const today = new Date().toISOString().split('T')[0];

    if (!usage[apiKey]) usage[apiKey] = {};
    usage[apiKey][today] = (usage[apiKey][today] || 0) + unitsUsed;

    await chrome.storage.local.set({ youtubeApiUsage: usage });
  } catch (error) {
    console.error('[YouTube] 사용량 업데이트 오류:', error);
  }
}

// 사용자 일일 사용량 확인
async function checkUserDailyUsage(userId) {
  try {
    const result = await chrome.storage.local.get(['youtubeUserUsage']);
    const userUsage = result.youtubeUserUsage || {};
    const today = new Date().toISOString().split('T')[0];

    const todayUsage = userUsage[userId]?.[today] || 0;
    return {
      used: todayUsage,
      remaining: Math.max(0, YOUTUBE_DAILY_LIMIT - todayUsage),
      limit: YOUTUBE_DAILY_LIMIT
    };
  } catch (error) {
    console.error('[YouTube] 사용량 확인 오류:', error);
    return { used: 0, remaining: YOUTUBE_DAILY_LIMIT, limit: YOUTUBE_DAILY_LIMIT };
  }
}

// 사용자 사용량 증가
async function incrementUserUsage(userId) {
  try {
    const result = await chrome.storage.local.get(['youtubeUserUsage']);
    const userUsage = result.youtubeUserUsage || {};
    const today = new Date().toISOString().split('T')[0];

    if (!userUsage[userId]) userUsage[userId] = {};
    userUsage[userId][today] = (userUsage[userId][today] || 0) + 1;

    // 오래된 데이터 정리 (7일 이상)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    for (const uid in userUsage) {
      for (const date in userUsage[uid]) {
        if (date < weekAgoStr) {
          delete userUsage[uid][date];
        }
      }
    }

    await chrome.storage.local.set({ youtubeUserUsage: userUsage });
  } catch (error) {
    console.error('[YouTube] 사용량 증가 오류:', error);
  }
}

// YouTube 동영상 정보 가져오기
async function fetchVideoInfo(videoId, apiKey) {
  const url = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`YouTube API 오류: ${response.status}`);
  }

  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    throw new Error('동영상을 찾을 수 없습니다.');
  }

  await updateApiKeyUsage(apiKey, 1); // videos.list = 1 유닛

  return data.items[0];
}

// YouTube 자막 목록 가져오기
async function fetchCaptionList(videoId, apiKey) {
  const url = `${YOUTUBE_API_BASE}/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    // 자막 API 접근 권한이 없을 수 있음 - 대체 방법 사용
    return null;
  }

  const data = await response.json();
  await updateApiKeyUsage(apiKey, 50); // captions.list = 50 유닛

  return data.items || [];
}

// 자막 없이 동영상 설명으로 블로그 생성
async function generateBlogFromDescription(videoInfo, apiKey) {
  const snippet = videoInfo.snippet;

  const prompt = `다음 YouTube 동영상 정보를 바탕으로 네이버 블로그에 적합한 글을 작성해주세요.

동영상 제목: ${snippet.title}
채널: ${snippet.channelTitle}
설명: ${snippet.description}

요구사항:
1. 블로그 제목을 먼저 작성 (##제목: 형식)
2. 서론-본론-결론 구조로 작성
3. 적절한 소제목 사용
4. 친근하고 읽기 쉬운 문체
5. 1500자 이상 작성
6. 이모지 적절히 사용
7. 마지막에 태그 5개 추천 (##태그: 형식)

동영상 내용을 유추하여 유익한 정보 글로 작성해주세요.`;

  // Firebase에서 API 키 가져오기
  const geminiKey = await getAvailableGeminiApiKey();
  if (!geminiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. PRO 구독이 필요할 수 있습니다.');
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        topP: 0.8,
        topK: 40
      }
    })
  });

  if (!response.ok) {
    throw new Error('블로그 생성 실패');
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// YouTube 자막 크롤링 (비공식 방법 - API 할당량 절약)
async function fetchTranscriptDirect(videoId) {
  try {
    // YouTube 페이지에서 자막 데이터 추출 시도
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(pageUrl);
    const html = await response.text();

    // 자막 URL 추출 시도
    const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!captionMatch) {
      return null;
    }

    const captionTracks = JSON.parse(captionMatch[1]);
    // 한국어 또는 영어 자막 찾기
    const track = captionTracks.find(t => t.languageCode === 'ko')
                || captionTracks.find(t => t.languageCode === 'en')
                || captionTracks[0];

    if (!track || !track.baseUrl) {
      return null;
    }

    // 자막 다운로드
    const captionResponse = await fetch(track.baseUrl);
    const captionXml = await captionResponse.text();

    // XML 파싱하여 텍스트 추출
    const textMatches = captionXml.matchAll(/<text[^>]*>(.*?)<\/text>/gs);
    const transcriptParts = [];

    for (const match of textMatches) {
      let text = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]*>/g, '');
      transcriptParts.push(text);
    }

    return transcriptParts.join(' ');
  } catch (error) {
    console.error('[YouTube] 자막 직접 추출 실패:', error);
    return null;
  }
}

// 자막을 블로그로 변환
async function convertTranscriptToBlog(transcript, videoInfo) {
  const snippet = videoInfo.snippet;

  const prompt = `다음 YouTube 동영상의 자막을 네이버 블로그에 적합한 글로 변환해주세요.

동영상 제목: ${snippet.title}
채널: ${snippet.channelTitle}

자막 내용:
${transcript.substring(0, 15000)} ${transcript.length > 15000 ? '... (생략됨)' : ''}

요구사항:
1. 블로그 제목을 먼저 작성 (##제목: 형식으로 한 줄)
2. 서론-본론-결론 구조로 재구성
3. 적절한 소제목으로 구분 (###소제목 형식)
4. 구어체를 문어체로 자연스럽게 변환
5. 친근하고 읽기 쉬운 블로그 문체
6. 핵심 내용을 잘 정리
7. 2000자 이상 작성
8. 이모지 적절히 사용
9. 마지막에 태그 5개 추천 (##태그: 태그1, 태그2... 형식)

자막의 핵심 내용을 살려서 유익한 블로그 글로 작성해주세요.`;

  // Firebase에서 API 키 가져오기
  const geminiKey = await getAvailableGeminiApiKey();
  if (!geminiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. PRO 구독이 필요할 수 있습니다.');
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        topP: 0.8,
        topK: 40
      }
    })
  });

  if (!response.ok) {
    throw new Error('블로그 생성 실패');
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// YouTube → 블로그 변환 메인 핸들러
async function handleYouTubeToBlog(request, sendResponse) {
  try {
    const { url, userId } = request;

    // 1. 사용자 일일 제한 확인
    const usage = await checkUserDailyUsage(userId);
    if (usage.remaining <= 0) {
      sendResponse({
        success: false,
        error: '오늘의 변환 횟수를 모두 사용했습니다. (일일 3회 제한)',
        usage
      });
      return;
    }

    // 2. Video ID 추출
    const videoId = extractVideoId(url);
    if (!videoId) {
      sendResponse({ success: false, error: '유효한 YouTube URL이 아닙니다.' });
      return;
    }

    // 3. API 키 가져오기
    const apiKey = await getAvailableYouTubeApiKey();
    if (!apiKey) {
      sendResponse({ success: false, error: 'YouTube API 키가 설정되지 않았습니다.' });
      return;
    }

    // 4. 동영상 정보 가져오기
    const videoInfo = await fetchVideoInfo(videoId, apiKey);

    // 5. 자막 가져오기 시도 (직접 크롤링)
    let transcript = await fetchTranscriptDirect(videoId);

    let blogContent;
    if (transcript && transcript.length > 100) {
      // 6a. 자막이 있으면 자막 기반으로 블로그 생성
      blogContent = await convertTranscriptToBlog(transcript, videoInfo);
    } else {
      // 6b. 자막이 없으면 설명 기반으로 생성
      blogContent = await generateBlogFromDescription(videoInfo, apiKey);
    }

    // 7. 사용자 사용량 증가
    await incrementUserUsage(userId);
    const newUsage = await checkUserDailyUsage(userId);

    // 8. 생성된 글 Firebase에 저장
    try {
      await handleSaveGeneratedPost(userId, {
        type: 'youtube',
        title: videoInfo.snippet.title,
        sourceUrl: url,
        content: blogContent,
        hasTranscript: !!(transcript && transcript.length > 100)
      }, () => {});
    } catch (saveError) {
      console.log('[YouTube] 글 저장 스킵:', saveError.message);
    }

    sendResponse({
      success: true,
      data: {
        videoInfo: {
          title: videoInfo.snippet.title,
          channel: videoInfo.snippet.channelTitle,
          thumbnail: videoInfo.snippet.thumbnails?.medium?.url || videoInfo.snippet.thumbnails?.default?.url,
          description: videoInfo.snippet.description?.substring(0, 200)
        },
        blogContent,
        hasTranscript: !!(transcript && transcript.length > 100)
      },
      usage: newUsage
    });

  } catch (error) {
    console.error('[YouTube] 변환 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 사용자 YouTube 사용량 조회 핸들러
async function handleGetYouTubeUsage(userId, sendResponse) {
  try {
    const usage = await checkUserDailyUsage(userId);
    sendResponse({ success: true, usage });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// YouTube 영상 분석 (블로그 생성 없이 정보만 가져오기)
async function handleAnalyzeYouTube(request, sendResponse) {
  try {
    const { url } = request;

    // 1. Video ID 추출
    const videoId = extractVideoId(url);
    if (!videoId) {
      sendResponse({ success: false, error: '유효한 YouTube URL이 아닙니다.' });
      return;
    }

    // 2. API 키 가져오기
    const apiKey = await getAvailableYouTubeApiKey();
    if (!apiKey) {
      sendResponse({ success: false, error: 'YouTube API 키가 설정되지 않았습니다.' });
      return;
    }

    // 3. 동영상 정보 가져오기
    const videoInfo = await fetchVideoInfo(videoId, apiKey);

    // 4. 자막 존재 여부 확인 (실제 크롤링은 하지 않음)
    let hasTranscript = false;
    try {
      const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(pageUrl);
      const html = await response.text();
      hasTranscript = html.includes('"captionTracks"');
    } catch (e) {
      console.log('[YouTube] 자막 확인 오류:', e);
    }

    sendResponse({
      success: true,
      data: {
        videoId,
        videoInfo: {
          title: videoInfo.snippet.title,
          channel: videoInfo.snippet.channelTitle,
          thumbnail: videoInfo.snippet.thumbnails?.medium?.url || videoInfo.snippet.thumbnails?.default?.url,
          description: videoInfo.snippet.description?.substring(0, 300),
          publishedAt: videoInfo.snippet.publishedAt
        },
        hasTranscript
      }
    });

  } catch (error) {
    console.error('[YouTube] 분석 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// YouTube 블로그 글 생성 (분석 후 사용자가 생성 버튼 클릭 시)
async function handleGenerateYouTubeBlog(request, sendResponse) {
  try {
    const { url, userId, customPrompt } = request;

    // 1. 사용자 일일 제한 확인
    const usage = await checkUserDailyUsage(userId);
    if (usage.remaining <= 0) {
      sendResponse({
        success: false,
        error: '오늘의 변환 횟수를 모두 사용했습니다. (일일 3회 제한)',
        usage
      });
      return;
    }

    // 2. Video ID 추출
    const videoId = extractVideoId(url);
    if (!videoId) {
      sendResponse({ success: false, error: '유효한 YouTube URL이 아닙니다.' });
      return;
    }

    // 3. API 키 가져오기
    const apiKey = await getAvailableYouTubeApiKey();
    if (!apiKey) {
      sendResponse({ success: false, error: 'YouTube API 키가 설정되지 않았습니다.' });
      return;
    }

    // 4. 동영상 정보 가져오기
    const videoInfo = await fetchVideoInfo(videoId, apiKey);

    // 5. 자막 가져오기 시도 (직접 크롤링)
    let transcript = await fetchTranscriptDirect(videoId);

    let blogContent;
    if (transcript && transcript.length > 100) {
      // 6a. 자막이 있으면 자막 기반으로 블로그 생성
      blogContent = await convertTranscriptToBlogWithPrompt(transcript, videoInfo, customPrompt);
    } else {
      // 6b. 자막이 없으면 설명 기반으로 생성
      blogContent = await generateBlogFromDescriptionWithPrompt(videoInfo, apiKey, customPrompt);
    }

    // 7. 사용자 사용량 증가
    await incrementUserUsage(userId);
    const newUsage = await checkUserDailyUsage(userId);

    // 8. 생성된 글 Firebase에 저장
    try {
      await handleSaveGeneratedPost(userId, {
        type: 'youtube',
        title: videoInfo.snippet.title,
        sourceUrl: url,
        content: blogContent,
        hasTranscript: !!(transcript && transcript.length > 100),
        customPrompt: customPrompt || null
      }, () => {});
    } catch (saveError) {
      console.log('[YouTube] 글 저장 스킵:', saveError.message);
    }

    sendResponse({
      success: true,
      data: {
        videoInfo: {
          title: videoInfo.snippet.title,
          channel: videoInfo.snippet.channelTitle,
          thumbnail: videoInfo.snippet.thumbnails?.medium?.url || videoInfo.snippet.thumbnails?.default?.url,
          description: videoInfo.snippet.description?.substring(0, 200)
        },
        blogContent,
        hasTranscript: !!(transcript && transcript.length > 100)
      },
      usage: newUsage
    });

  } catch (error) {
    console.error('[YouTube] 블로그 생성 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 자막을 블로그로 변환 (사용자 추가 요청 포함)
async function convertTranscriptToBlogWithPrompt(transcript, videoInfo, customPrompt) {
  const snippet = videoInfo.snippet;

  let prompt = `다음 YouTube 동영상의 자막을 네이버 블로그에 적합한 글로 변환해주세요.

동영상 제목: ${snippet.title}
채널: ${snippet.channelTitle}

자막 내용:
${transcript.substring(0, 15000)} ${transcript.length > 15000 ? '... (생략됨)' : ''}

요구사항:
1. 블로그 제목을 먼저 작성 (##제목: 형식으로 한 줄)
2. 서론-본론-결론 구조로 재구성
3. 적절한 소제목으로 구분 (###소제목 형식)
4. 구어체를 문어체로 자연스럽게 변환
5. 친근하고 읽기 쉬운 블로그 문체
6. 핵심 내용을 잘 정리
7. 2000자 이상 작성
8. 이모지 적절히 사용
9. 마지막에 태그 5개 추천 (##태그: 태그1, 태그2... 형식)`;

  // 사용자 추가 요청이 있으면 추가
  if (customPrompt && customPrompt.trim()) {
    prompt += `

추가 요청사항:
${customPrompt}`;
  }

  prompt += `

자막의 핵심 내용을 살려서 유익한 블로그 글로 작성해주세요.`;

  // Firebase에서 API 키 가져오기
  const geminiKey = await getAvailableGeminiApiKey();
  if (!geminiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. PRO 구독이 필요할 수 있습니다.');
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        topP: 0.8,
        topK: 40
      }
    })
  });

  if (!response.ok) {
    throw new Error('블로그 생성 실패');
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// 동영상 설명으로 블로그 생성 (사용자 추가 요청 포함)
async function generateBlogFromDescriptionWithPrompt(videoInfo, apiKey, customPrompt) {
  const snippet = videoInfo.snippet;

  let prompt = `다음 YouTube 동영상 정보를 바탕으로 네이버 블로그에 적합한 글을 작성해주세요.

동영상 제목: ${snippet.title}
채널: ${snippet.channelTitle}
설명: ${snippet.description}

요구사항:
1. 블로그 제목을 먼저 작성 (##제목: 형식)
2. 서론-본론-결론 구조로 작성
3. 적절한 소제목 사용
4. 친근하고 읽기 쉬운 문체
5. 1500자 이상 작성
6. 이모지 적절히 사용
7. 마지막에 태그 5개 추천 (##태그: 형식)`;

  // 사용자 추가 요청이 있으면 추가
  if (customPrompt && customPrompt.trim()) {
    prompt += `

추가 요청사항:
${customPrompt}`;
  }

  prompt += `

동영상 내용을 유추하여 유익한 정보 글로 작성해주세요.`;

  // Firebase에서 API 키 가져오기
  const geminiKey = await getAvailableGeminiApiKey();
  if (!geminiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. PRO 구독이 필요할 수 있습니다.');
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        topP: 0.8,
        topK: 40
      }
    })
  });

  if (!response.ok) {
    throw new Error('블로그 생성 실패');
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// YouTube API 키 설정 핸들러 (관리자용 - Firebase에 저장)
async function handleSetYouTubeApiKeys(keys, sendResponse) {
  try {
    // 로컬에도 저장 (캐시용)
    youtubeApiKeys = keys;
    await chrome.storage.local.set({ youtubeApiKeys: keys });

    // Firebase에도 저장
    const firebaseResult = await saveYouTubeApiKeysToFirebase(keys);
    if (!firebaseResult.success) {
      console.warn('[YouTube] Firebase 저장 실패, 로컬에만 저장됨:', firebaseResult.error);
    }

    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// 이미지 URL을 base64로 변환 (캡처용)
async function handleFetchImageAsBase64(url, sendResponse) {
  try {
    if (!url || !url.startsWith('http')) {
      sendResponse({ success: false, error: 'Invalid URL' });
      return;
    }

    console.log('[Image Fetch] 시작:', url.substring(0, 60));

    // Referer 헤더 추가 (네이버 이미지 서버용)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://blog.naver.com/'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();

    // Promise로 감싸서 await 가능하게
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });

    console.log('[Image Fetch] 성공:', url.substring(0, 40));
    sendResponse({ success: true, base64: base64 });
  } catch (error) {
    console.error('[Image Fetch] 오류:', url.substring(0, 50), error.message);
    sendResponse({ success: false, error: error.message });
  }
}

// YouTube API 키 Firebase에 저장 (관리자용)
async function saveYouTubeApiKeysToFirebase(keys) {
  try {
    // 관리자 확인
    const userResult = await chrome.storage.local.get(['userInfo']);
    const userEmail = userResult.userInfo?.email;
    if (userEmail !== ADMIN_EMAIL) {
      return { success: false, error: '관리자 권한이 필요합니다.' };
    }

    const settingsUrl = `${FIRESTORE_BASE_URL}/settings/apiKeys`;

    // 기존 설정 가져오기
    let existingSettings = {};
    try {
      const getResponse = await fetchWithTokenRefresh(settingsUrl);
      if (getResponse && getResponse.ok) {
        const doc = await getResponse.json();
        existingSettings = firestoreDocToJson(doc) || {};
      }
    } catch (e) {
      // 기존 문서 없음
    }

    // 설정 업데이트 (YouTube API 키 추가)
    const newSettings = {
      ...existingSettings,
      youtubeApiKeys: keys,
      updatedAt: new Date().toISOString()
    };

    const response = await fetchWithTokenRefresh(settingsUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonToFirestoreDoc(newSettings))
    });

    if (!response) {
      return { success: false, error: '인증 토큰 없음' };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log('[Firebase] YouTube API 키 저장 완료');
    return { success: true };

  } catch (error) {
    console.error('[Firebase] YouTube API 키 저장 오류:', error);
    return { success: false, error: error.message };
  }
}

// Firebase에서 YouTube API 키 로드
async function loadYouTubeApiKeysFromFirebase() {
  try {
    const settingsUrl = `${FIRESTORE_BASE_URL}/settings/apiKeys`;
    const response = await fetchWithTokenRefresh(settingsUrl);

    if (!response || !response.ok) {
      return { success: false, error: '설정을 찾을 수 없습니다.' };
    }

    const doc = await response.json();
    const settings = firestoreDocToJson(doc);

    if (settings?.youtubeApiKeys && Array.isArray(settings.youtubeApiKeys)) {
      youtubeApiKeys = settings.youtubeApiKeys;
      await chrome.storage.local.set({ youtubeApiKeys: settings.youtubeApiKeys });
      console.log('[Firebase] YouTube API 키 로드 완료:', youtubeApiKeys.length, '개');
      return { success: true, keys: settings.youtubeApiKeys };
    }

    return { success: false, error: 'YouTube API 키가 설정되지 않았습니다.' };
  } catch (error) {
    console.error('[Firebase] YouTube API 키 로드 오류:', error);
    return { success: false, error: error.message };
  }
}

// ==================== 프로모션 코드 핸들러 ====================

// 프로모션 코드 유효성 검사
async function handleValidatePromoCode(code, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['promoCodes']);
    const promoCodes = result.promoCodes || [];

    const promoCode = promoCodes.find(p => p.code === code.toUpperCase());

    if (!promoCode) {
      sendResponse({ success: false, error: '유효하지 않은 코드입니다.' });
      return;
    }

    const now = Date.now();

    if (promoCode.status === 'used') {
      sendResponse({ success: false, error: '이미 사용된 코드입니다.' });
      return;
    }

    if (promoCode.status === 'expired' || promoCode.expiresAt < now) {
      sendResponse({ success: false, error: '만료된 코드입니다.' });
      return;
    }

    // 혜택 정보 반환
    const benefitText = {
      'pro_3months': 'PRO 3개월 무료 이용권',
      'pro_1month': 'PRO 1개월 무료 이용권',
      'unlimited_3months': '무제한 3개월 무료 이용권'
    }[promoCode.benefit] || promoCode.benefit;

    sendResponse({
      success: true,
      benefit: promoCode.benefit,
      benefitText: benefitText
    });

  } catch (error) {
    console.error('[PromoCode] 검증 오류:', error);
    sendResponse({ success: false, error: '코드 검증 중 오류가 발생했습니다.' });
  }
}

// 프로모션 코드 사용 처리
async function handleUsePromoCode(code, userId, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['promoCodes', 'userPlans']);
    const promoCodes = result.promoCodes || [];
    const userPlans = result.userPlans || {};

    const codeIndex = promoCodes.findIndex(p => p.code === code.toUpperCase());

    if (codeIndex === -1) {
      sendResponse({ success: false, error: '유효하지 않은 코드입니다.' });
      return;
    }

    const promoCode = promoCodes[codeIndex];
    const now = Date.now();

    if (promoCode.status !== 'active' || promoCode.expiresAt < now) {
      sendResponse({ success: false, error: '사용할 수 없는 코드입니다.' });
      return;
    }

    // 코드 사용 처리
    promoCodes[codeIndex] = {
      ...promoCode,
      status: 'used',
      usedBy: userId,
      usedAt: now
    };

    // 사용자 플랜 설정
    let planDuration = 90 * 24 * 60 * 60 * 1000; // 기본 90일
    let planType = 'pro';

    if (promoCode.benefit === 'pro_1month') {
      planDuration = 30 * 24 * 60 * 60 * 1000;
    } else if (promoCode.benefit === 'unlimited_3months') {
      planType = 'unlimited';
    }

    userPlans[userId] = {
      plan: planType,
      startedAt: now,
      expiresAt: now + planDuration,
      promoCodeUsed: code.toUpperCase()
    };

    await chrome.storage.local.set({ promoCodes, userPlans });

    sendResponse({
      success: true,
      plan: userPlans[userId]
    });

  } catch (error) {
    console.error('[PromoCode] 사용 처리 오류:', error);
    sendResponse({ success: false, error: '코드 사용 중 오류가 발생했습니다.' });
  }
}

// 사용자 플랜 조회
async function handleGetUserPlan(userId, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['userPlans']);
    const userPlans = result.userPlans || {};
    const userPlan = userPlans[userId];

    if (!userPlan) {
      sendResponse({
        success: true,
        plan: null,
        status: 'none'
      });
      return;
    }

    const now = Date.now();
    const isExpired = userPlan.expiresAt < now;

    sendResponse({
      success: true,
      plan: userPlan,
      status: isExpired ? 'expired' : 'active',
      daysRemaining: isExpired ? 0 : Math.ceil((userPlan.expiresAt - now) / (24 * 60 * 60 * 1000))
    });

  } catch (error) {
    console.error('[UserPlan] 조회 오류:', error);
    sendResponse({ success: false, error: '플랜 조회 중 오류가 발생했습니다.' });
  }
}

// ==================== Firebase 학습 데이터 핸들러 ====================

// Firestore REST API 엔드포인트
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${ENV_CONFIG.firebase.projectId}/databases/(default)/documents`;

// Firebase 인증 토큰 가져오기 (만료 시 자동 갱신)
async function getFirebaseIdToken() {
  try {
    const result = await chrome.storage.local.get(['firebaseIdToken', 'firebaseRefreshToken', 'firebaseTokenTimestamp']);

    // 토큰이 없지만 refreshToken이 있으면 갱신 시도
    if (!result.firebaseIdToken) {
      if (result.firebaseRefreshToken) {
        console.log('[Firebase] ID 토큰 없음, refreshToken으로 갱신 시도...');
        const newToken = await refreshFirebaseTokenWithRestApi(result.firebaseRefreshToken);
        if (newToken) return newToken;
      }
      console.log('[Firebase] 토큰 없음 (refreshToken도 없음)');
      return null;
    }

    // 토큰 만료 확인 (50분 = 3000000ms, 1시간 만료 전 여유)
    const tokenAge = Date.now() - (result.firebaseTokenTimestamp || 0);
    if (tokenAge > 3000000) {
      if (result.firebaseRefreshToken) {
        console.log('[Firebase] 토큰 만료됨, 갱신 시도...');
        const newToken = await refreshFirebaseTokenWithRestApi(result.firebaseRefreshToken);
        if (newToken) return newToken;
      }
      // 갱신 실패해도 기존 토큰 반환 (만료됐을 수 있지만, 401 시 재시도 로직에서 처리)
      console.log('[Firebase] 토큰 갱신 실패, 기존 토큰 반환');
    }

    return result.firebaseIdToken;
  } catch (error) {
    console.error('[Firebase] 토큰 가져오기 오류:', error);
    return null;
  }
}

// Firebase REST API로 토큰 갱신 (서비스 워커에서 SDK 사용 불가하므로)
async function refreshFirebaseTokenWithRestApi(refreshToken) {
  try {
    const apiKey = ENV_CONFIG.firebase.apiKey;
    const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      console.error('[Firebase] 토큰 갱신 실패:', response.status);
      return null;
    }

    const data = await response.json();
    const newIdToken = data.id_token;
    const newRefreshToken = data.refresh_token;

    // 갱신된 토큰 저장
    await chrome.storage.local.set({
      firebaseIdToken: newIdToken,
      firebaseRefreshToken: newRefreshToken,
      firebaseTokenTimestamp: Date.now()
    });

    console.log('[Firebase] 토큰 갱신 성공');
    return newIdToken;
  } catch (error) {
    console.error('[Firebase] REST API 토큰 갱신 오류:', error);
    return null;
  }
}

// 401 발생 시 토큰 갱신 후 재시도하는 fetch 래퍼
async function fetchWithTokenRefresh(url, options = {}) {
  let token = await getFirebaseIdToken();
  if (!token) return null;

  options.headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
  let response = await fetch(url, options);

  // 401 또는 403이면 강제 토큰 갱신 후 재시도
  if (response.status === 401 || response.status === 403) {
    console.log(`[Firebase] ${response.status} 수신, 토큰 강제 갱신 후 재시도...`);
    const newToken = await forceRefreshToken();
    if (newToken) {
      options.headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, options);
    }
  }

  return response;
}

// 토큰 강제 갱신 헬퍼
async function forceRefreshToken() {
  try {
    const result = await chrome.storage.local.get(['firebaseRefreshToken']);
    if (result.firebaseRefreshToken) {
      const newToken = await refreshFirebaseTokenWithRestApi(result.firebaseRefreshToken);
      if (newToken) return newToken;
    }
  } catch (e) { /* ignore */ }
  return null;
}

// ==================== Firebase API 키 관리 ====================

/**
 * Firebase에서 Gemini API 키 가져오기
 * - 유료 구독자 또는 무료 접근 허용 시에만 API 키 반환
 * - 향후 무료 사용자 오픈 시 freeAccessEnabled를 true로 설정
 */
async function getGeminiApiKeyFromFirebase() {
  try {
    let token = await getFirebaseIdToken();
    console.log('[PlanCheck] 1. 토큰 상태:', token ? '있음' : '없음');

    // 1. 사용자 정보 확인
    const userResult = await chrome.storage.local.get(['userInfo', 'isLoggedIn']);
    const isLoggedIn = userResult.isLoggedIn;
    const userInfo = userResult.userInfo;

    if (!isLoggedIn || !userInfo) {
      console.log('[PlanCheck] 로그인 안됨:', { isLoggedIn, hasUserInfo: !!userInfo });
      return { success: false, error: '로그인이 필요합니다.' };
    }

    console.log('[PlanCheck] 2. 유저정보:', { uid: userInfo.uid, email: userInfo.email, storedPlan: userInfo.plan });

    // 토큰이 없으면 한 번 더 갱신 시도
    if (!token) {
      console.log('[PlanCheck] 토큰 없음 → 강제 갱신 시도');
      token = await forceRefreshToken();
      console.log('[PlanCheck] 강제 갱신 결과:', token ? '성공' : '실패');
    }

    // 2. API 키 결정 (Firestore settings 또는 기본 키)
    let apiKey = DEFAULT_GEMINI_API_KEY;
    let freeAccessEnabled = false;

    try {
      const settingsUrl = `${FIRESTORE_BASE_URL}/settings/apiKeys`;
      let settingsResponse = await fetch(settingsUrl, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      // 401/403 시 토큰 갱신 후 재시도
      if ((settingsResponse.status === 401 || settingsResponse.status === 403)) {
        console.log('[PlanCheck] settings 조회 실패:', settingsResponse.status, '→ 토큰 갱신');
        token = await forceRefreshToken();
        if (token) {
          settingsResponse = await fetch(settingsUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        }
      }

      if (settingsResponse.ok) {
        const settingsDoc = await settingsResponse.json();
        const settings = firestoreDocToJson(settingsDoc);
        if (settings && settings.geminiApiKey) {
          apiKey = settings.geminiApiKey;
        }
        freeAccessEnabled = settings?.freeAccessEnabled || false;
        console.log('[PlanCheck] settings 조회 성공, freeAccess:', freeAccessEnabled);
      }
    } catch (e) {
      console.log('[PlanCheck] API 설정 조회 실패:', e.message);
    }

    // 3. 접근 권한 확인
    const userUid = userInfo.uid;
    let hasActivePlan = false;
    const storedPlan = userInfo.plan || 'free';

    // 3-1. Firestore에서 최신 플랜 확인 (UID로 조회)
    if (userUid) {
      // 토큰이 없으면 마지막으로 한 번 더 시도
      if (!token) {
        token = await forceRefreshToken();
      }

      if (token) {
        try {
          const userDocUrl = `${FIRESTORE_BASE_URL}/users/${encodeURIComponent(userUid)}`;
          console.log('[PlanCheck] 3-1. Firestore 조회 시작:', userDocUrl);
          let resp = await fetch(userDocUrl, { headers: { 'Authorization': `Bearer ${token}` } });
          console.log('[PlanCheck] 3-1. 응답 상태:', resp.status);

          // 401/403 → 토큰 갱신 후 재시도
          if (resp.status === 401 || resp.status === 403) {
            console.log('[PlanCheck] 3-1. 인증 실패 → 토큰 갱신 재시도');
            token = await forceRefreshToken();
            if (token) {
              resp = await fetch(userDocUrl, { headers: { 'Authorization': `Bearer ${token}` } });
              console.log('[PlanCheck] 3-1. 재시도 응답:', resp.status);
            }
          }

          if (resp.ok) {
            const rawDoc = await resp.json();
            const userData = firestoreDocToJson(rawDoc);
            console.log('[PlanCheck] 3-1. Firestore 유저 데이터:', userData ? { plan: userData.plan, planExpiry: userData.planExpiry } : 'null');

            if (userData) {
              const plan = userData.plan || 'free';
              let expiresAt = 0;
              const rawExpiry = userData.planExpiry || userData.planExpiresAt || userData.expiresAt;

              if (rawExpiry) {
                if (typeof rawExpiry === 'number') expiresAt = rawExpiry;
                else if (rawExpiry.seconds) expiresAt = rawExpiry.seconds * 1000;
                else if (typeof rawExpiry === 'string') expiresAt = new Date(rawExpiry).getTime();
              }

              // storage 플랜을 Firestore 최신값으로 동기화
              if (plan !== storedPlan) {
                console.log('[PlanCheck] 3-1. 플랜 동기화:', storedPlan, '→', plan);
                try {
                  const s = await chrome.storage.local.get(['userInfo']);
                  if (s.userInfo) { s.userInfo.plan = plan; await chrome.storage.local.set({ userInfo: s.userInfo }); }
                } catch (e) { /* ignore */ }
              }

              const now = Date.now();
              if (plan !== 'free' && (!expiresAt || expiresAt > now)) {
                hasActivePlan = true;
                console.log(`[PlanCheck] 3-1. ✅ 유료 플랜 확인: ${plan}, 만료: ${expiresAt ? new Date(expiresAt).toISOString() : '없음'}`);
              } else if (plan !== 'free' && expiresAt && expiresAt <= now) {
                // 만료 → storage도 free로
                try {
                  const s = await chrome.storage.local.get(['userInfo']);
                  if (s.userInfo) { s.userInfo.plan = 'free'; await chrome.storage.local.set({ userInfo: s.userInfo }); }
                } catch (e) { /* ignore */ }
                console.log('[PlanCheck] 3-1. ❌ 플랜 만료:', new Date(expiresAt).toISOString());
              } else {
                console.log('[PlanCheck] 3-1. 무료 플랜:', plan);
              }
            }
          } else {
            console.log('[PlanCheck] 3-1. Firestore 조회 실패 (status:', resp.status, ')');
          }
        } catch (e) {
          console.log('[PlanCheck] 3-1. Firestore 조회 오류:', e.message);
        }
      } else {
        console.log('[PlanCheck] 3-1. 건너뜀 (토큰 없음)');
      }
    }

    // 3-2. Firestore 조회 실패/불가 시 → storage에 저장된 플랜으로 판단
    if (!hasActivePlan && storedPlan !== 'free') {
      hasActivePlan = true;
      console.log(`[PlanCheck] 3-2. ✅ 저장된 플랜으로 접근 허용: ${storedPlan}`);
    }

    // 3-3. 로컬 userPlans 폴백 (프로모 코드)
    if (!hasActivePlan) {
      const plansResult = await chrome.storage.local.get(['userPlans']);
      const userPlans = plansResult.userPlans || {};
      const planData = userPlans[userUid] || userPlans[userInfo.email];
      const now = Date.now();
      if (planData && planData.expiresAt > now) {
        hasActivePlan = true;
        console.log('[PlanCheck] 3-3. ✅ 로컬 플랜으로 접근 허용');
      }
    }

    if (hasActivePlan || freeAccessEnabled) {
      console.log('[PlanCheck] ✅ 최종: 접근 허용 (hasActivePlan:', hasActivePlan, ', freeAccess:', freeAccessEnabled, ')');
      return { success: true, apiKey };
    }

    console.log('[PlanCheck] ❌ 최종: PRO 구독 필요 (storedPlan:', storedPlan, ', token:', token ? '있음' : '없음', ')');
    return { success: false, error: 'PRO 구독이 필요한 기능입니다.', requireSubscription: true };

  } catch (error) {
    console.error('[PlanCheck] 오류:', error);

    // 최후 방어: 오류 발생해도 storage에 유료 플랜이면 허용
    try {
      const fb = await chrome.storage.local.get(['userInfo']);
      if (fb.userInfo && fb.userInfo.plan && fb.userInfo.plan !== 'free') {
        console.log('[PlanCheck] 오류 폴백: 저장된 유료 플랜으로 허용:', fb.userInfo.plan);
        return { success: true, apiKey: DEFAULT_GEMINI_API_KEY };
      }
    } catch (e) { /* ignore */ }

    return { success: false, error: error.message };
  }
}

/**
 * Gemini API 키 가져오기 (통합 함수)
 * Firebase 우선, 실패 시 로컬 폴백
 */
async function getAvailableGeminiApiKey() {
  // 1. Firebase에서 가져오기 시도
  const firebaseResult = await getGeminiApiKeyFromFirebase();
  if (firebaseResult.success) {
    return firebaseResult.apiKey;
  }

  // 2. 구독 필요 에러인 경우 null 반환 (PRO 전용)
  if (firebaseResult.requireSubscription) {
    return null;
  }

  // 3. 기본 API 키 폴백
  return DEFAULT_GEMINI_API_KEY;
}

/**
 * Firebase에 API 키 저장 (관리자용)
 */
async function saveApiKeyToFirebase(apiKey, options = {}) {
  try {
    // 관리자 확인
    const userResult = await chrome.storage.local.get(['userInfo']);
    const userEmail = userResult.userInfo?.email;
    if (userEmail !== ADMIN_EMAIL) {
      return { success: false, error: '관리자 권한이 필요합니다.' };
    }

    const settingsUrl = `${FIRESTORE_BASE_URL}/settings/apiKeys`;

    // 기존 설정 가져오기
    let existingSettings = {};
    try {
      const getResponse = await fetchWithTokenRefresh(settingsUrl);
      if (getResponse && getResponse.ok) {
        const doc = await getResponse.json();
        existingSettings = firestoreDocToJson(doc) || {};
      }
    } catch (e) {
      // 기존 문서 없음
    }

    // 설정 업데이트
    const newSettings = {
      ...existingSettings,
      geminiApiKey: apiKey,
      freeAccessEnabled: options.freeAccessEnabled ?? existingSettings.freeAccessEnabled ?? false,
      updatedAt: new Date().toISOString()
    };

    const response = await fetchWithTokenRefresh(settingsUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonToFirestoreDoc(newSettings))
    });

    if (!response) {
      return { success: false, error: '인증 토큰 없음' };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log('[Firebase] API 키 저장 완료');
    return { success: true };

  } catch (error) {
    console.error('[Firebase] API 키 저장 오류:', error);
    return { success: false, error: error.message };
  }
}

// Firestore 문서를 JSON으로 변환
function firestoreDocToJson(doc) {
  if (!doc || !doc.fields) return null;

  const result = {};
  for (const [key, value] of Object.entries(doc.fields)) {
    result[key] = parseFirestoreValue(value);
  }
  return result;
}

function parseFirestoreValue(value) {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.nullValue !== undefined) return null;
  if (value.arrayValue) {
    return (value.arrayValue.values || []).map(parseFirestoreValue);
  }
  if (value.mapValue) {
    return firestoreDocToJson(value.mapValue);
  }
  return null;
}

// JSON을 Firestore 형식으로 변환
function jsonToFirestoreDoc(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    fields[key] = toFirestoreValue(value);
  }
  return { fields };
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: value.toString() };
    }
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: jsonToFirestoreDoc(value) };
  }
  return { stringValue: String(value) };
}

// 학습 데이터 로드 (Firebase)
async function handleLoadLearningData(userId, sendResponse) {
  try {
    const url = `${FIRESTORE_BASE_URL}/users/${userId}/learningData/data`;
    const response = await fetchWithTokenRefresh(url);

    if (!response) {
      sendResponse({ success: false, error: '인증 토큰 없음' });
      return;
    }

    if (!response.ok) {
      if (response.status === 404) {
        sendResponse({ success: true, data: null });
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const doc = await response.json();
    const data = firestoreDocToJson(doc);

    sendResponse({ success: true, data });
  } catch (error) {
    console.error('[Firebase] 학습 데이터 로드 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 학습 데이터 저장 (Firebase)
async function handleSaveLearningData(userId, data, sendResponse) {
  try {
    const url = `${FIRESTORE_BASE_URL}/users/${userId}/learningData/data`;
    const response = await fetchWithTokenRefresh(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonToFirestoreDoc(data))
    });

    if (!response) {
      // 토큰이 없으면 로컬에만 저장
      sendResponse({ success: true, local: true });
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error('[Firebase] 학습 데이터 저장 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 생성된 글 저장 (Firebase)
async function handleSaveGeneratedPost(userId, postData, sendResponse) {
  try {
    const url = `${FIRESTORE_BASE_URL}/users/${userId}/generatedPosts`;
    const response = await fetchWithTokenRefresh(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonToFirestoreDoc({
        ...postData,
        userId: userId,
        createdAt: new Date().toISOString()
      }))
    });

    if (!response) {
      sendResponse({ success: false, error: '로그인이 필요합니다.' });
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    sendResponse({ success: true, postId: result.name?.split('/').pop() });
  } catch (error) {
    console.error('[Firebase] 글 저장 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 사용자 생성 글 목록 조회 (Firebase)
async function handleGetGeneratedPosts(userId, limit = 20, sendResponse) {
  try {
    const queryUrl = `${FIRESTORE_BASE_URL}:runQuery`;
    const response = await fetchWithTokenRefresh(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'generatedPosts' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'userId' },
              op: 'EQUAL',
              value: { stringValue: userId }
            }
          },
          orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
          limit: limit
        }
      })
    });

    if (!response) {
      sendResponse({ success: false, error: '로그인이 필요합니다.' });
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const results = await response.json();
    const posts = results
      .filter(r => r.document)
      .map(r => ({
        id: r.document.name?.split('/').pop(),
        ...firestoreDocToJson(r.document)
      }));

    sendResponse({ success: true, posts });
  } catch (error) {
    console.error('[Firebase] 글 목록 조회 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 모든 사용자 학습 데이터 조회 (관리자용)
async function handleGetAllUsersLearningData(sendResponse) {
  try {
    // 관리자 확인
    const userInfo = await chrome.storage.local.get(['userInfo']);
    if (userInfo.userInfo?.email !== ADMIN_EMAIL) {
      sendResponse({ success: false, error: '관리자 권한이 필요합니다.' });
      return;
    }

    const queryUrl = `${FIRESTORE_BASE_URL}:runQuery`;
    const response = await fetchWithTokenRefresh(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{
            collectionId: 'learningData',
            allDescendants: true
          }],
          limit: 100
        }
      })
    });

    if (!response) {
      sendResponse({ success: false, error: '로그인이 필요합니다.' });
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const results = await response.json();
    const usersData = results
      .filter(r => r.document)
      .map(r => {
        const pathParts = r.document.name.split('/');
        const userIdIndex = pathParts.indexOf('users') + 1;
        return {
          userId: pathParts[userIdIndex] || 'unknown',
          data: firestoreDocToJson(r.document)
        };
      });

    sendResponse({ success: true, usersData });
  } catch (error) {
    console.error('[Firebase] 전체 학습 데이터 조회 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 모든 생성 글 조회 (관리자용)
async function handleGetAllGeneratedPosts(limit = 100, sendResponse) {
  try {
    // 관리자 확인
    const userInfo = await chrome.storage.local.get(['userInfo']);
    if (userInfo.userInfo?.email !== ADMIN_EMAIL) {
      sendResponse({ success: false, error: '관리자 권한이 필요합니다.' });
      return;
    }

    const queryUrl = `${FIRESTORE_BASE_URL}:runQuery`;
    const response = await fetchWithTokenRefresh(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{
            collectionId: 'generatedPosts',
            allDescendants: true
          }],
          orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
          limit: limit
        }
      })
    });

    if (!response) {
      sendResponse({ success: false, error: '로그인이 필요합니다.' });
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const results = await response.json();
    const posts = results
      .filter(r => r.document)
      .map(r => ({
        id: r.document.name?.split('/').pop(),
        ...firestoreDocToJson(r.document)
      }));

    sendResponse({ success: true, posts });
  } catch (error) {
    console.error('[Firebase] 전체 글 조회 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}
