/**
 * 블로그 벤치마커 Pro - 옵션 페이지 스크립트
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM 요소
  const apiKeyInput = document.getElementById('apiKeyInput');
  const toggleApiKey = document.getElementById('toggleApiKey');
  const testApiBtn = document.getElementById('testApiBtn');
  const saveApiBtn = document.getElementById('saveApiBtn');
  const apiStatus = document.getElementById('apiStatus');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  /**
   * 상태 메시지 표시
   */
  function showStatus(message, type = 'info') {
    apiStatus.textContent = message;
    apiStatus.className = 'status-message';
    if (type === 'success') apiStatus.classList.add('success');
    if (type === 'error') apiStatus.classList.add('error');
  }

  /**
   * API 키 로드
   */
  async function loadApiKey() {
    try {
      const result = await chrome.storage.sync.get(['geminiApiKey']);
      if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
      }
    } catch (error) {
      console.error('API 키 로드 오류:', error);
    }
  }

  /**
   * API 키 저장
   */
  async function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('API 키를 입력해주세요.', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ geminiApiKey: apiKey });
      showStatus('API 키가 저장되었습니다!', 'success');
    } catch (error) {
      showStatus('저장에 실패했습니다.', 'error');
      console.error('API 키 저장 오류:', error);
    }
  }

  /**
   * API 연결 테스트
   */
  async function testApiConnection() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('API 키를 입력해주세요.', 'error');
      return;
    }

    showStatus('연결 테스트 중...');
    testApiBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'generateContent',
        prompt: '안녕하세요. 연결 테스트입니다. "연결 성공"이라고만 답해주세요.',
        apiKey: apiKey
      });

      if (response && response.success) {
        showStatus('✅ API 연결 성공!', 'success');
      } else {
        showStatus(`❌ 연결 실패: ${response?.error || '알 수 없는 오류'}`, 'error');
      }
    } catch (error) {
      showStatus(`❌ 연결 실패: ${error.message}`, 'error');
    } finally {
      testApiBtn.disabled = false;
    }
  }

  /**
   * API 키 표시/숨기기
   */
  function toggleApiKeyVisibility() {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleApiKey.textContent = '🙈';
    } else {
      apiKeyInput.type = 'password';
      toggleApiKey.textContent = '👁️';
    }
  }

  /**
   * 히스토리 로드
   */
  async function loadHistory() {
    try {
      const result = await chrome.storage.local.get(['analysisHistory']);
      const history = result.analysisHistory || [];

      if (history.length === 0) {
        historyList.innerHTML = '<div class="empty-state">분석 기록이 없습니다</div>';
        return;
      }

      historyList.innerHTML = history.map((item, index) => `
        <div class="history-item" data-index="${index}">
          <div class="history-info">
            <div class="history-title">${escapeHtml(item.title || '제목 없음')}</div>
            <div class="history-meta">
              ${formatDate(item.savedAt)} • SEO ${item.analysis?.seo?.score || '-'}점
            </div>
          </div>
          <div class="history-actions">
            <button class="history-btn view" data-url="${escapeHtml(item.url || '')}">보기</button>
            <button class="history-btn delete" data-index="${index}">삭제</button>
          </div>
        </div>
      `).join('');

      // 이벤트 리스너 추가
      historyList.querySelectorAll('.history-btn.view').forEach(btn => {
        btn.addEventListener('click', () => {
          const url = btn.dataset.url;
          if (url) {
            chrome.tabs.create({ url: url });
          }
        });
      });

      historyList.querySelectorAll('.history-btn.delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          const index = parseInt(btn.dataset.index);
          await deleteHistoryItem(index);
        });
      });
    } catch (error) {
      console.error('히스토리 로드 오류:', error);
      historyList.innerHTML = '<div class="empty-state">기록을 불러올 수 없습니다</div>';
    }
  }

  /**
   * 히스토리 항목 삭제
   */
  async function deleteHistoryItem(index) {
    try {
      const result = await chrome.storage.local.get(['analysisHistory']);
      const history = result.analysisHistory || [];

      history.splice(index, 1);
      await chrome.storage.local.set({ analysisHistory: history });

      loadHistory();
    } catch (error) {
      console.error('삭제 오류:', error);
    }
  }

  /**
   * 히스토리 전체 삭제
   */
  async function clearHistory() {
    if (!confirm('모든 분석 기록을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await chrome.storage.local.set({ analysisHistory: [] });
      loadHistory();
    } catch (error) {
      console.error('전체 삭제 오류:', error);
    }
  }

  /**
   * 날짜 포맷팅
   */
  function formatDate(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * HTML 이스케이프
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 이벤트 리스너
  toggleApiKey.addEventListener('click', toggleApiKeyVisibility);
  saveApiBtn.addEventListener('click', saveApiKey);
  testApiBtn.addEventListener('click', testApiConnection);
  clearHistoryBtn.addEventListener('click', clearHistory);

  // 초기화
  loadApiKey();
  loadHistory();
});
