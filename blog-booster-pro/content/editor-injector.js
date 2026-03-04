/**
 * 블로그 벤치마커 Pro - 에디터 주입기
 * 네이버 블로그 SmartEditor ONE - Selection API 방식 (v18)
 */

const BlogEditorInjector = {
  isTyping: false,
  isPaused: false,
  stopRequested: false,
  typingSpeed: 20,
  currentDoc: null,
  currentWin: null,

  /**
   * 현재 프레임의 문서 사용 (v12: 에디터가 있는 프레임에서 직접 실행)
   */
  getEditorContext() {
    // 이미 설정된 경우 그대로 사용
    if (this.currentDoc && this.currentWin) {
      return { doc: this.currentDoc, win: this.currentWin };
    }
    this.currentDoc = document;
    this.currentWin = window;
    return { doc: document, win: window };
  },

  delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  },

  /**
   * 요소 클릭
   */
  async clickElement(element, doc, win) {
    if (!element) return false;

    try {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      console.log('[EditorInjector] 클릭:', element.tagName, element.className?.substring(0, 50));

      // 이벤트 시퀀스
      element.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, cancelable: true, view: win,
        clientX: x, clientY: y, button: 0, buttons: 1
      }));

      await this.delay(30);

      element.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true, cancelable: true, view: win,
        clientX: x, clientY: y, button: 0
      }));

      element.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, view: win,
        clientX: x, clientY: y, button: 0
      }));

      // 버튼이면 직접 click도 시도
      if (element.tagName === 'BUTTON') {
        element.click();
      }

      await this.delay(100);
      return true;
    } catch (e) {
      console.error('[EditorInjector] 클릭 오류:', e);
      return false;
    }
  },

  /**
   * 현재 활성화된 에디터 요소 찾기 (클릭 없이) - 제목 영역 제외
   */
  findEditor(doc) {
    // 본문 영역만 찾기 (제목 영역 제외)
    const selectors = [
      '.se-component.se-text .se-text-paragraph',
      '.se-contents-area .se-text-paragraph',
      'p.se-text-paragraph'
    ];

    for (const sel of selectors) {
      const elements = doc.querySelectorAll(sel);
      for (const el of elements) {
        // 제목 영역인지 확인 (se-title, se-documentTitle 등 제외)
        const parent = el.closest('.se-title, .se-documentTitle, .se-title-text');
        if (parent) continue;

        const rect = el.getBoundingClientRect();
        // 본문 영역은 보통 더 아래에 있고 넓음
        if (rect.width > 200 && rect.height > 10 && rect.top > 100) {
          console.log('[EditorInjector] 본문 에디터 발견, top:', rect.top);
          return el;
        }
      }
    }

    // 폴백: contenteditable 중 본문만 (제목 제외)
    const editables = doc.querySelectorAll('[contenteditable="true"]');
    for (const el of editables) {
      const parent = el.closest('.se-title, .se-documentTitle, .se-title-text');
      if (parent) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width > 200 && rect.top > 150) {
        console.log('[EditorInjector] contenteditable 본문 발견, top:', rect.top);
        return el;
      }
    }

    return null;
  },

  /**
   * 본문 영역 찾아서 클릭하고 활성화
   */
  async activateEditor() {
    console.log('[EditorInjector] 에디터 활성화 시도...');

    const { doc, win } = this.getEditorContext();
    const editor = this.findEditor(doc);

    if (!editor) {
      console.error('[EditorInjector] 에디터를 찾을 수 없음');
      return null;
    }

    console.log('[EditorInjector] 에디터 발견');

    // 클릭하여 활성화
    await this.clickElement(editor, doc, win);
    await this.delay(150);

    // 포커스 설정
    editor.focus();

    // 커서를 끝으로
    try {
      const selection = doc.getSelection();
      const range = doc.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (e) {}

    console.log('[EditorInjector] 에디터 활성화 완료');
    return { editor, doc, win };
  },

  /**
   * 모바일 화면 전환
   */
  async switchToMobile() {
    const { doc, win } = this.getEditorContext();
    const btn = doc.querySelector('button.se-util-button-device-mobile');
    if (btn) {
      console.log('[EditorInjector] 모바일 버튼 클릭');
      await this.clickElement(btn, doc, win);
      await this.delay(500);
      return true;
    }
    console.log('[EditorInjector] 모바일 버튼 없음');
    return false;
  },

  /**
   * 가운데 정렬
   */
  async alignCenter() {
    const { doc, win } = this.getEditorContext();
    const btn = doc.querySelector('button.se-toolbar-option-align-center-button');
    if (btn) {
      console.log('[EditorInjector] 가운데 정렬 클릭');
      await this.clickElement(btn, doc, win);
      await this.delay(200);
      return true;
    }
    return false;
  },

  /**
   * 구분선 삽입
   */
  async insertLine() {
    const { doc, win } = this.getEditorContext();
    const btn = doc.querySelector('button.se-toolbar-option-insert-horizontal-line-line1-button');
    if (btn) {
      console.log('[EditorInjector] 구분선 클릭');
      await this.clickElement(btn, doc, win);
      await this.delay(300);
      return true;
    }
    return false;
  },

  /**
   * 소제목 서식
   */
  async applySubheading() {
    const { doc, win } = this.getEditorContext();
    const btn = doc.querySelector('button.se-toolbar-option-text-format-sectionTitle-button');
    if (btn) {
      console.log('[EditorInjector] 소제목 클릭');
      await this.clickElement(btn, doc, win);
      await this.delay(200);
      return true;
    }
    return false;
  },

  /**
   * 한 글자 입력 - execCommand 사용 (SmartEditor 호환)
   */
  async typeChar(char, editor) {
    const doc = this.currentDoc || document;

    if (!editor) {
      console.error('[EditorInjector] 에디터 없음');
      return false;
    }

    // 포커스 확인
    editor.focus();

    if (char === '\n') {
      // 줄바꿈: Enter 키 시뮬레이션
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      editor.dispatchEvent(enterEvent);
      doc.execCommand('insertParagraph', false, null);
    } else {
      // 일반 문자: execCommand 사용
      doc.execCommand('insertText', false, char);
    }

    await this.delay(this.typingSpeed);
    return true;
  },

  /**
   * 소제목 여부 확인
   */
  isSubheading(text) {
    const t = text.trim();
    return /^[■◆●▶★☆♦♠♣①②③④⑤⑥⑦⑧⑨⑩]/.test(t) || /^\d+\./.test(t);
  },

  /**
   * Selection API로 텍스트 직접 삽입
   */
  insertTextAtCursor(char, doc) {
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    // 텍스트 노드 생성 및 삽입
    const textNode = doc.createTextNode(char);
    range.insertNode(textNode);

    // 커서를 텍스트 뒤로 이동
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    return true;
  },

  /**
   * 키보드 이벤트로 한 글자 입력 (v18 - Selection API 사용)
   */
  async typeCharWithEvents(char, editor, doc, win) {
    const isEnter = char === '\n';
    const key = isEnter ? 'Enter' : char;
    const code = isEnter ? 'Enter' : `Key${char.toUpperCase()}`;
    const keyCode = isEnter ? 13 : char.charCodeAt(0);

    // keydown 이벤트
    const keydownEvent = new KeyboardEvent('keydown', {
      key: key,
      code: code,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      view: win
    });
    editor.dispatchEvent(keydownEvent);

    // 줄바꿈 처리
    if (isEnter) {
      // Enter: <br> 태그 삽입
      const selection = doc.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();

        // <br> 요소 2개 삽입 (단락 구분)
        const br1 = doc.createElement('br');
        const br2 = doc.createElement('br');
        range.insertNode(br2);
        range.insertNode(br1);

        // 커서를 br 뒤로 이동
        range.setStartAfter(br2);
        range.setEndAfter(br2);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      // beforeinput 이벤트
      try {
        const beforeInputEvent = new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: char,
          bubbles: true,
          cancelable: true
        });
        editor.dispatchEvent(beforeInputEvent);
      } catch (e) {}

      // Selection API로 텍스트 직접 삽입
      this.insertTextAtCursor(char, doc);

      // input 이벤트
      try {
        const inputEvent = new InputEvent('input', {
          inputType: 'insertText',
          data: char,
          bubbles: true,
          cancelable: false
        });
        editor.dispatchEvent(inputEvent);
      } catch (e) {}
    }

    // keyup 이벤트
    const keyupEvent = new KeyboardEvent('keyup', {
      key: key,
      code: code,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      view: win
    });
    editor.dispatchEvent(keyupEvent);
  },

  /**
   * 타이핑 시작 (v18 - Selection API)
   */
  async startTyping(text, options = {}) {
    console.log('[EditorInjector] === 타이핑 시작 (v18) ===');

    if (this.isTyping) {
      return { success: false, error: '이미 타이핑 중입니다' };
    }

    this.isTyping = true;
    this.stopRequested = false;

    try {
      // 에디터 활성화
      const ctx = await this.activateEditor();
      if (!ctx) {
        this.isTyping = false;
        return { success: false, error: '에디터를 찾을 수 없습니다' };
      }

      const { editor, doc, win } = ctx;
      const processed = text.replace(/\[이미지:\s*([^\]]+)\]/g, '\n\n[이미지: $1]\n\n');
      const total = processed.length;
      let typed = 0;

      console.log(`[EditorInjector] 타이핑 시작: 총 ${total}자`);

      // 에디터에 포커스
      editor.focus();

      // 한 글자씩 타이핑
      for (const char of processed) {
        if (this.stopRequested) {
          console.log('[EditorInjector] 타이핑 중단됨');
          break;
        }

        // 포커스 유지
        if (typed % 50 === 0) {
          editor.focus();
        }

        await this.typeCharWithEvents(char, editor, doc, win);
        typed++;

        // 진행률 전송 (50자마다)
        if (typed % 50 === 0) {
          this.sendProgress(typed, total);
          console.log(`[EditorInjector] 진행: ${typed}/${total} (${Math.round(typed/total*100)}%)`);
        }

        // 스크롤 따라가기 (100자마다)
        if (typed % 100 === 0) {
          editor.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }

        await this.delay(this.typingSpeed);
      }

      this.sendProgress(typed, total);
      console.log(`[EditorInjector] 타이핑 완료: ${typed}자 입력됨`);

      return { success: true, message: `타이핑 완료: ${typed}자`, typed: typed };

    } catch (e) {
      console.error('[EditorInjector] 오류:', e);
      return { success: false, error: e.message };
    } finally {
      this.isTyping = false;
    }
  },

  sendProgress(current, total) {
    try {
      chrome.runtime.sendMessage({ action: 'typingProgress', current, total });
    } catch (e) {}
  },

  stop() {
    this.stopRequested = true;
    this.isTyping = false;
    console.log('[EditorInjector] 타이핑 중단 요청됨');
  }
};

// 메시지 리스너 (에디터가 있는 프레임에서만)
if (!window._editorInjectorV18) {
  window._editorInjectorV18 = true;

  // 이 프레임에 에디터가 있는지 확인
  function hasEditorInThisFrame() {
    const selectors = [
      '.se-component.se-text .se-text-paragraph',
      'p.se-text-paragraph'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 200 && rect.height > 10) {
          return true;
        }
      }
    }
    return false;
  }

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    // EditorInjector가 처리하지 않는 메시지는 무시
    const editorActions = ['startTyping', 'stopTyping', 'checkEditor'];
    if (!editorActions.includes(req.action)) {
      return false; // 다른 리스너가 처리하도록
    }

    // 에디터가 없는 프레임은 무시
    if (req.action === 'startTyping' || req.action === 'checkEditor') {
      if (!hasEditorInThisFrame()) {
        return false; // 다른 프레임이 처리하도록
      }
    }

    console.log('[EditorInjector] 메시지 수신 (이 프레임에서 처리):', req.action);

    if (req.action === 'startTyping') {
      // 이 프레임의 document를 사용
      BlogEditorInjector.currentDoc = document;
      BlogEditorInjector.currentWin = window;
      BlogEditorInjector.startTyping(req.text, req.options)
        .then(r => sendResponse(r));
      return true;
    }

    if (req.action === 'stopTyping') {
      BlogEditorInjector.stop();
      sendResponse({ success: true });
    }

    if (req.action === 'checkEditor') {
      const { doc } = BlogEditorInjector.getEditorContext();
      sendResponse({ hasEditor: !!doc.querySelector('.se-text-paragraph') });
    }

    return true;
  });

  console.log('[EditorInjector] v18 준비 완료 (Selection API)');
}

window.BlogEditorInjector = BlogEditorInjector;
