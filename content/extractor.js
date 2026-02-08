/**
 * 블로그 벤치마커 Pro - 본문 추출기
 * 네이버 블로그 iframe 구조 대응
 */

const BlogExtractor = {
  // 셀렉터 우선순위
  selectors: {
    iframe: 'iframe#mainFrame',
    containers: [
      '.se-main-container',          // 스마트에디터3
      '#postViewArea',               // 구버전
      '.post_ct',                    // 모바일
      '.se-viewer',                  // SE 뷰어
      '.se_component_wrap',          // SE 컴포넌트 래퍼
      '.se_post_wrap',               // SE 포스트 래퍼
      '#post-view',                  // 신버전
      '.post-view',                  // 대체 셀렉터
      'div.blog2_series_wrap',       // 시리즈 글
      '.se-component-content',       // 컴포넌트
      '#content-area .post_article', // content-area 내부
      '.post_article',               // 포스트 아티클
      '.__se_component_area',        // SE 컴포넌트 영역 (신규)
      '.se_doc_viewer',              // 문서 뷰어
      '.se-section-content',         // 섹션 컨텐츠
      '#viewTypeSelector',           // 뷰타입 셀렉터
      '.blog_post_content',          // 블로그 포스트 컨텐츠
      '#postListBody',               // 포스트 리스트 바디
      'div[id^="post-view"]',        // post-view로 시작하는 ID
      'div[class*="post_ct"]',       // post_ct를 포함하는 클래스
      'div[class*="se-viewer"]',     // se-viewer를 포함하는 클래스
      'article',                     // 일반 article 태그
      'div[role="article"]',         // role=article
      '#body',                       // body ID
      '.entry-content',              // 엔트리 컨텐츠
      'main'                         // main 태그
    ],
    title: [
      '.se-title-text',
      '.pcol1',
      '.tit_h3',
      '#title',
      '.se-fs-',
      'meta[property="og:title"]'
    ],
    tags: [
      '.post_tag a',
      '.tag_area a',
      '.wrap_tag a',
      '#tagList a',
      '.post-tag a',
      '.tag_keyword'
    ]
  },

  /**
   * iframe 내부 document 가져오기
   */
  getIframeDocument() {
    try {
      // mainFrame 우선
      const mainFrame = document.querySelector(this.selectors.iframe);
      if (mainFrame && mainFrame.contentDocument) {
        return mainFrame.contentDocument;
      }
      // 모든 iframe 시도
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          if (iframe.contentDocument && iframe.contentDocument.body &&
              iframe.contentDocument.body.textContent.trim().length > 200) {
            return iframe.contentDocument;
          }
        } catch (e) {}
      }
    } catch (e) {
      console.log('[Extractor] iframe 접근 실패');
    }
    return document;
  },

  /**
   * 사용 가능한 모든 document 목록 반환 (현재 + iframe들)
   */
  getAllDocuments() {
    const docs = [document];
    try {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        try {
          if (iframe.contentDocument) {
            docs.push(iframe.contentDocument);
          }
        } catch (e) {}
      });
    } catch (e) {}
    return docs;
  },

  /**
   * 본문 컨테이너 찾기
   */
  findContentContainer(doc) {
    if (!doc) return null;
    // 1차: 셀렉터로 텍스트가 충분한 컨테이너 찾기
    for (const selector of this.selectors.containers) {
      try {
        const container = doc.querySelector(selector);
        if (container && container.textContent.trim().length > 50) {
          return container;
        }
      } catch (e) {}
    }
    // 2차: 텍스트 길이 무관하게 셀렉터로 찾기
    for (const selector of this.selectors.containers) {
      try {
        const container = doc.querySelector(selector);
        if (container) {
          return container;
        }
      } catch (e) {}
    }
    // 3차: 스마트 탐색 - 텍스트가 가장 많은 div 찾기
    return this.findLargestTextBlock(doc);
  },

  /**
   * 텍스트가 가장 많은 블록 요소 찾기 (스마트 폴백)
   */
  findLargestTextBlock(doc) {
    if (!doc || !doc.body) return null;
    let bestElement = null;
    let bestLength = 200; // 최소 200자 이상이어야 본문으로 인정

    const candidates = doc.querySelectorAll('div, section, article, main');
    candidates.forEach(el => {
      // 네비게이션, 사이드바, 헤더, 푸터 제외
      const tag = el.tagName.toLowerCase();
      const cls = (el.className || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      if (cls.match(/nav|sidebar|footer|header|menu|comment|reply/) ||
          id.match(/nav|sidebar|footer|header|menu|comment|reply/)) {
        return;
      }

      const textLen = el.textContent.trim().length;
      const childDivs = el.querySelectorAll('div').length;

      // 텍스트가 충분하고 너무 깊지 않은 요소 선호
      if (textLen > bestLength && childDivs < 100) {
        bestLength = textLen;
        bestElement = el;
      }
    });

    if (bestElement) {
      console.log('[Extractor] 스마트 탐색으로 본문 찾음:', bestElement.tagName, bestElement.className?.substring(0, 30));
    }
    return bestElement;
  },

  /**
   * 제목 추출
   */
  extractTitle(doc) {
    for (const selector of this.selectors.title) {
      const titleEl = doc.querySelector(selector);
      if (titleEl && titleEl.textContent.trim()) {
        return titleEl.textContent.trim();
      }
    }
    // 메타 태그에서 시도
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      return ogTitle.getAttribute('content') || '';
    }
    return '';
  },

  /**
   * 본문 텍스트 추출
   */
  extractText(container) {
    if (!container) return '';

    const clone = container.cloneNode(true);

    // 불필요한 요소 제거
    const removeSelectors = ['script', 'style', 'noscript', '.se-oglink', '.se-module-oglink'];
    removeSelectors.forEach(sel => {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    });

    return clone.textContent.replace(/\s+/g, ' ').trim();
  },

  /**
   * 문단별 텍스트 추출
   */
  extractParagraphs(container) {
    if (!container) return [];

    const paragraphs = [];
    const selectors = [
      '.se-text-paragraph',
      '.se-module-text',
      'p',
      '.post_tx',
      '.se-component-content'
    ];

    for (const selector of selectors) {
      const elements = container.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach(el => {
          const text = el.textContent.trim();
          if (text.length > 10) {  // 의미있는 문단만
            paragraphs.push({
              text: text,
              length: text.length,
              element: el.tagName.toLowerCase()
            });
          }
        });
        break;  // 첫 번째 성공한 셀렉터 사용
      }
    }

    // 문단이 없으면 줄바꿈 기준으로 분리
    if (paragraphs.length === 0) {
      const fullText = this.extractText(container);
      const lines = fullText.split(/[.!?]\s+/).filter(l => l.trim().length > 10);
      lines.forEach(line => {
        paragraphs.push({
          text: line.trim(),
          length: line.trim().length,
          element: 'text'
        });
      });
    }

    return paragraphs;
  },

  /**
   * 이미지 URL 추출
   */
  extractImages(container) {
    if (!container) return [];

    const images = [];
    const imgElements = container.querySelectorAll('img');

    imgElements.forEach((img, index) => {
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
      if (src && !src.includes('icon') && !src.includes('logo') && !src.includes('button')) {
        images.push({
          src: src,
          alt: img.alt || '',
          index: index,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height
        });
      }
    });

    return images;
  },

  /**
   * 태그 추출
   */
  extractTags(doc) {
    const tags = [];

    for (const selector of this.selectors.tags) {
      const tagElements = doc.querySelectorAll(selector);
      if (tagElements.length > 0) {
        tagElements.forEach(el => {
          const tag = el.textContent.trim().replace('#', '');
          if (tag && !tags.includes(tag)) {
            tags.push(tag);
          }
        });
        break;
      }
    }

    return tags;
  },

  /**
   * 소제목 추출 (h2, h3, 네이버 스마트에디터 소제목)
   */
  extractSubheadings(container) {
    if (!container) return [];

    const subheadings = [];
    const addedTexts = new Set(); // 중복 방지

    // h2, h3 태그
    container.querySelectorAll('h2, h3').forEach(el => {
      const text = el.textContent.trim();
      if (text && text.length >= 5 && !addedTexts.has(text)) {
        addedTexts.add(text);
        subheadings.push({
          text: text,
          type: el.tagName.toLowerCase(),
          level: el.tagName === 'H2' ? 2 : 3
        });
      }
    });

    // 네이버 스마트에디터3 소제목 스타일
    container.querySelectorAll('.se-section-title, .se-title-text, .se-sticker-title').forEach(el => {
      const text = el.textContent.trim();
      if (text && text.length >= 5 && !addedTexts.has(text)) {
        addedTexts.add(text);
        subheadings.push({
          text: text,
          type: 'section-title',
          level: 2
        });
      }
    });

    // 대괄호 텍스트 제외 헬퍼 (이미지 설명/카테고리 라벨)
    const isBracketText = (text) => /^\[.+\]$/.test(text);

    // 네이버 스마트에디터3 인용구 스타일 소제목
    container.querySelectorAll('.se-quotation, .se-section-quotation').forEach(el => {
      const text = el.textContent.trim();
      if (text && text.length >= 3 && text.length <= 40 && !addedTexts.has(text) && !isBracketText(text)) {
        addedTexts.add(text);
        subheadings.push({
          text: text,
          type: 'quotation-heading',
          level: 2
        });
      }
    });

    // blockquote 태그 (짧은 텍스트만 소제목으로 판단)
    container.querySelectorAll('blockquote').forEach(el => {
      const text = el.textContent.trim();
      if (text && text.length >= 3 && text.length <= 40 && !addedTexts.has(text) && !isBracketText(text)) {
        addedTexts.add(text);
        subheadings.push({
          text: text,
          type: 'blockquote-heading',
          level: 2
        });
      }
    });

    // 구분선 + 볼드/큰글씨 조합 (소제목으로 자주 사용)
    container.querySelectorAll('.se-hr + .se-module-text, .se-section-horizontalLine + .se-section-text').forEach(el => {
      const boldEl = el.querySelector('strong, b, .se-text-paragraph-align-center');
      if (boldEl) {
        const text = boldEl.textContent.trim();
        if (text && text.length >= 3 && text.length <= 40 && !addedTexts.has(text) && !isBracketText(text)) {
          addedTexts.add(text);
          subheadings.push({
            text: text,
            type: 'separator-heading',
            level: 2
          });
        }
      }
    });

    // 문단 시작 볼드 텍스트 (볼드가 문단의 거의 전부인 경우만)
    container.querySelectorAll('.se-module-text').forEach(el => {
      const firstChild = el.querySelector('strong, b');
      if (firstChild) {
        const text = firstChild.textContent.trim();
        const parentText = el.textContent.trim();
        if (text && text.length >= 5 && text.length <= 40 &&
            parentText.startsWith(text) && !addedTexts.has(text) && !isBracketText(text) &&
            text.length / parentText.length > 0.85) {
          addedTexts.add(text);
          subheadings.push({
            text: text,
            type: 'bold-heading',
            level: 3
          });
        }
      }
    });

    return subheadings;
  },

  /**
   * 전체 블로그 데이터 추출
   */
  extract() {
    console.log('[Extractor] 추출 시작 (프레임:', window.location.href.substring(0, 60), ')');

    // 1) 현재 document에서 시도
    let doc = document;
    let container = this.findContentContainer(doc);

    // 2) 못 찾으면 iframe document에서 시도
    if (!container) {
      const iframeDoc = this.getIframeDocument();
      if (iframeDoc !== document) {
        container = this.findContentContainer(iframeDoc);
        if (container) doc = iframeDoc;
      }
    }

    // 3) 못 찾으면 모든 iframe document 순회
    if (!container) {
      const docs = this.getAllDocuments();
      for (const d of docs) {
        if (d === document) continue; // 이미 시도함
        container = this.findContentContainer(d);
        if (container) {
          doc = d;
          break;
        }
      }
    }

    if (!container) {
      console.warn('[Extractor] 본문 컨테이너를 찾을 수 없습니다. (프레임:', window.location.href.substring(0, 60), ')');
      return null;
    }

    const title = this.extractTitle(doc);
    const fullText = this.extractText(container);

    // 텍스트가 비어있으면 무시 (빈 프레임)
    if (!fullText || fullText.length < 30) {
      return null;
    }

    const paragraphs = this.extractParagraphs(container);
    const images = this.extractImages(container);
    const tags = this.extractTags(doc);
    const subheadings = this.extractSubheadings(container);

    const data = {
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

    console.log('[Extractor] 추출 완료:', data.stats);
    return data;
  }
};

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ping 응답 (content script 로드 확인용)
  if (request.action === 'ping') {
    sendResponse({ success: true, loaded: true });
    return true;
  }

  if (request.action === 'extract') {
    try {
      const data = BlogExtractor.extract();
      sendResponse({ success: true, data: data });
    } catch (error) {
      console.error('[Extractor] 추출 오류:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // 이 리스너가 처리하지 않는 메시지는 다른 리스너에게 넘기기
  return false;
});

// 전역 노출
window.BlogExtractor = BlogExtractor;
