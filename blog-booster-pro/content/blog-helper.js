// 블로그 부스터 Pro - Content Script v2.0
(function() {
  'use strict';

  // 중복 실행 방지
  if (window.BlogBoosterLoaded) return;
  window.BlogBoosterLoaded = true;

  // 최상위 프레임에서만 실행
  if (window !== window.top) return;

  console.log('[블로그부스터] 스크립트 시작 v2.0');

  // ==================== 유틸리티 함수 ====================

  function getEditorContent() {
    let content = '';
    const docs = [document];
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc) docs.push(iframeDoc);
      } catch (e) {}
    });

    for (const doc of docs) {
      const seMainContainer = doc.querySelector('.se-main-container');
      if (seMainContainer) {
        // 제목 컴포넌트 제외하고 본문만 추출 (다중 셀렉터로 시도)
        const titleComponent = seMainContainer.querySelector('.se-component.se-title, .se-component.se-documentTitle, [data-name="Title"]');
        const paragraphs = seMainContainer.querySelectorAll('.se-text-paragraph');
        if (paragraphs.length > 0) {
          content = Array.from(paragraphs)
            .filter(p => {
              if (!titleComponent) return true;
              // 제목 컴포넌트의 자식이면 제외
              if (titleComponent.contains(p)) return false;
              // 제목 컴포넌트와 같은 최상위 컴포넌트에 있으면 제외
              const parentComp = p.closest('.se-component');
              if (parentComp && titleComponent.contains(parentComp)) return false;
              // 구분선 컴포넌트 제외
              if (parentComp && (parentComp.classList.contains('se-horizontalLine') || parentComp.querySelector('.se-hr'))) return false;
              return true;
            })
            .map(p => p.textContent).join('\n');
          if (content.trim()) {
            // 텍스트 기반 제목 제거 (DOM 필터가 실패했을 경우 대비)
            return _stripTitleFromContent(content);
          }
        }
        content = seMainContainer.textContent;
        if (content.trim()) return _stripTitleFromContent(content);
      }

      const seComponents = doc.querySelectorAll('.se-component-content');
      if (seComponents.length > 0) {
        content = Array.from(seComponents).map(c => c.textContent).join('\n');
        if (content.trim()) return _stripTitleFromContent(content);
      }

      const editableAreas = doc.querySelectorAll('[contenteditable="true"]');
      for (const area of editableAreas) {
        if (area.textContent.trim() && area.textContent.length > 10) {
          return _stripTitleFromContent(area.textContent);
        }
      }

      const postViewArea = doc.querySelector('#postViewArea, .post_ct, .se_doc_viewer');
      if (postViewArea) return _stripTitleFromContent(postViewArea.textContent);
    }

    return '';
  }

  // 본문 시작 부분에서 제목 텍스트 제거
  function _stripTitleFromContent(content) {
    const title = getTitle();
    if (!title || title.length < 3) return content;
    const titleNorm = title.replace(/\s+/g, '').toLowerCase();
    const lines = content.split('\n');
    // 첫 3줄 이내에서 제목과 동일한 줄 제거
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const lineNorm = lines[i].trim().replace(/\s+/g, '').toLowerCase();
      if (lineNorm === titleNorm || (lineNorm.length > 5 && titleNorm.includes(lineNorm)) || (titleNorm.length > 5 && lineNorm.includes(titleNorm))) {
        lines.splice(i, 1);
        break;
      }
    }
    return lines.join('\n').trim();
  }

  function getTitle() {
    const titleSelectors = [
      '.se-title-text .se-text-paragraph span',
      '.se-title-text .se-text-paragraph',
      '.se-title-text span', '.se-title-text',
      '.se-documentTitle .se-text-paragraph span',
      '.se-documentTitle .se-text-paragraph',
      '.se-component.se-title .se-text-paragraph span',
      '.se-component.se-title .se-text-paragraph',
      '[data-name="Title"] .se-text-paragraph',
      '[data-name="documentTitle"] .se-text-paragraph',
      '[class*="title"] [contenteditable="true"]',
      '#subject', 'input[name="title"]', '.tit_h2', '.pcol1'
    ];

    function extractTitle(doc) {
      for (const selector of titleSelectors) {
        const el = doc.querySelector(selector);
        if (el) {
          const title = el.value || el.innerText || el.textContent || '';
          const cleanTitle = title.replace(/^제목$/g, '').trim();
          if (cleanTitle && cleanTitle.length >= 2) return cleanTitle;
        }
      }
      return '';
    }

    // 메인 문서에서 검색
    let result = extractTitle(document);
    if (result) return result;

    // iframe 내부 검색
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        result = extractTitle(iframeDoc);
        if (result) return result;
      } catch (e) {}
    }

    // 최후 폴백: getTitleElement()로 찾은 요소에서 직접 텍스트 추출
    const titleEl = getTitleElement();
    if (titleEl) {
      // 자식 p, span에서 텍스트 추출 시도
      const children = titleEl.querySelectorAll('p, span, [contenteditable]');
      for (const child of children) {
        const t = (child.innerText || child.textContent || '').replace(/^제목$/g, '').trim();
        if (t && t.length >= 2) return t;
      }
      // 요소 자체의 텍스트
      const directText = (titleEl.innerText || titleEl.textContent || '').replace(/^제목$/g, '').trim();
      if (directText && directText.length >= 2) return directText;
    }

    return '';
  }

  function getTitleElement() {
    const titleSelectors = [
      '.se-component.se-documentTitle',
      '.se-component.se-title',
      '.se-title-text',
      '[data-name="documentTitle"]',
      '[data-name="Title"]',
      '.se-module-title',
      '#subject',
      'input[name="title"]'
    ];

    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }

    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        for (const selector of titleSelectors) {
          const el = iframeDoc.querySelector(selector);
          if (el) return el;
        }
      } catch (e) {}
    }

    return null;
  }

  function getTitleDocument() {
    const titleSelectors = ['.se-component.se-documentTitle', '.se-component.se-title', '.se-title-text', '[data-name="documentTitle"]', '[data-name="Title"]'];

    for (const selector of titleSelectors) {
      if (document.querySelector(selector)) return document;
    }

    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        for (const selector of titleSelectors) {
          if (iframeDoc.querySelector(selector)) return iframeDoc;
        }
      } catch (e) {}
    }

    return document;
  }

  function countCharacters(text) {
    const total = text.replace(/\s/g, '').length;
    const withSpaces = text.replace(/\s+/g, ' ').trim().length;
    return { total, withSpaces };
  }

  function analyzeWords(text) {
    const rawWords = text.match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
    const wordStopwords = [
      '있는', '하는', '되는', '없는', '같은', '다른', '많은', '좋은',
      '있습니다', '합니다', '됩니다', '없습니다', '같습니다', '봅니다', '줍니다',
      '있어요', '해요', '돼요', '없어요', '같아요',
      '했습니다', '됐습니다', '았습니다', '었습니다', '아닙니다', '입니다', '습니다',
      '만들었습니다', '시작했습니다', '되었습니다', '있었습니다', '했었습니다',
      '그리고', '하지만', '그래서', '그런데', '그러나', '또한', '그래도', '그러면',
      '그렇게', '그러니', '그러므로', '따라서', '때문에', '근데', '그럼',
      '이런', '저런', '그런', '이것', '저것', '그것', '여기', '거기', '저기',
      '이거', '저거', '그거', '이게', '저게', '그게', '이건', '저건', '그건',
      '이렇게', '저렇게', '그렇게', '이래서', '그래서',
      '정말', '진짜', '너무', '매우', '아주', '가장', '더욱', '완전', '엄청', '되게',
      '오늘', '내일', '어제', '지금', '나중', '최근', '요즘',
      '때문', '무엇', '어떤', '모든', '정도', '경우', '사실',
      '하다', '되다', '있다', '없다', '보다', '주다', '같다', '싶다',
      '하게', '하면', '하고', '해도', '해야', '해서', '하니',
      '되면', '되고', '되어', '돼서', '되니',
      '맞고', '날린', '쓰고', '했고', '됐고', '봤고', '갔고', '왔고',
      '맞았습니다', '알았습니다', '봤습니다', '갔습니다', '됐습니다',
      '그렇게', '결국', '직접', '사진'
    ];
    const frequency = {};
    rawWords.forEach(word => {
      // 조사 제거
      const stripped = stripParticle(word.toLowerCase());
      if (stripped.length < 2) return;
      if (wordStopwords.includes(stripped)) return;
      // 2글자이고 조사로 끝나는 패턴 제거
      if (stripped.length === 2 && /[을를은는이가의에도로서와과만]$/.test(stripped)) return;
      // 동사/형용사 어미로만 이루어진 단어 제거
      if (/^(?:했|됐|봤|갔|왔|썼|먹|잤|샀)/.test(stripped) && stripped.length <= 3) return;
      frequency[stripped] = (frequency[stripped] || 0) + 1;
    });
    return Object.entries(frequency).sort((a, b) => b[1] - a[1]);
  }

  function showToast(message, type = 'success') {
    const existing = document.querySelector('.bb-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `bb-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  }

  // ==================== SEO 분석 ====================
  let seoKeyword = '';

  // 문서 목록 가져오기 (iframe 포함)
  function getAllDocs() {
    const docs = [document];
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc) docs.push(iframeDoc);
      } catch (e) {}
    });
    return docs;
  }

  // 이미지 개수 세기
  function countImages() {
    let count = 0;
    const docs = getAllDocs();
    docs.forEach(doc => {
      const seImages = doc.querySelectorAll('.se-image-resource, .se-component.se-image img');
      count += seImages.length;
      const normalImages = doc.querySelectorAll('.se-main-container img, #postViewArea img');
      count += normalImages.length;
    });
    return count;
  }

  // 소제목 개수 세기
  function countSubheadings() {
    let count = 0;
    const counted = new Set();
    const docs = getAllDocs();
    docs.forEach(doc => {
      // SE4 소제목 컴포넌트
      const seHeadings = doc.querySelectorAll('.se-component.se-text .se-text-paragraph-align-center, .se-section-title, .se-component.se-sectionTitle');
      seHeadings.forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 2 && t.length < 50 && !counted.has(t)) { counted.add(t); count++; }
      });
      // 인용구 소제목
      const quotations = doc.querySelectorAll('.se-section-quotation .se-text-paragraph');
      quotations.forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 2 && t.length < 50 && !counted.has(t)) { counted.add(t); count++; }
      });
      // 큰글씨 소제목 (se-fs-fs26 이상)
      const largeFonts = doc.querySelectorAll('[class*="se-fs-fs2"], [class*="se-fs-fs3"], [class*="se-fs-fs4"]');
      largeFonts.forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 2 && t.length < 50 && !counted.has(t)) { counted.add(t); count++; }
      });
      // 굵은 텍스트로 된 소제목
      const boldTexts = doc.querySelectorAll('.se-main-container strong, .se-main-container b');
      boldTexts.forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 3 && t.length < 50 && !counted.has(t)) { counted.add(t); count++; }
      });
      // 구분선(━━━ 또는 se-hr) 뒤에 오는 짧은 텍스트 = 소제목
      const components = doc.querySelectorAll('.se-main-container > .se-component');
      for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        const isHR = comp.classList.contains('se-horizontalLine') ||
                     comp.querySelector('hr, .se-hr') ||
                     (comp.textContent.trim().match(/^[━─═▬\-_]{3,}$/));
        if (isHR && i + 1 < components.length) {
          const nextComp = components[i + 1];
          const nextText = nextComp.textContent.trim();
          if (nextText.length > 2 && nextText.length < 50 && !counted.has(nextText)) {
            // 구분선 바로 뒤 짧은 텍스트는 소제목으로 인정
            if (!/[.!?]$/.test(nextText) || nextText.length < 25) {
              counted.add(nextText); count++;
            }
          }
        }
      }
    });
    // 텍스트 기반 소제목 감지 (DOM 감지 실패 시)
    if (count === 0) {
      const content = getEditorContent();
      const lines = content.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);

      // 방법 1: 구분선 패턴 뒤의 텍스트
      for (let i = 0; i < lines.length; i++) {
        if (/^[━─═▬\-_]{3,}$/.test(lines[i]) && i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (nextLine.length > 2 && nextLine.length < 50 && !counted.has(nextLine)) {
            if (!/[.]$/.test(nextLine)) {
              counted.add(nextLine); count++;
            }
          }
        }
      }

      // 방법 2: 구분선이 텍스트에 없는 경우 (에디터 컴포넌트로만 존재)
      // 짧은 독립 문장(마침표 없음)을 소제목으로 감지
      if (count === 0) {
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          // 소제목 조건: 3~45자, 마침표 없음, 이미지태그 아님
          if (line.length < 3 || line.length > 45) continue;
          if (/[.]$/.test(line)) continue;
          if (/^\[/.test(line)) continue; // [이미지...] 등 제외
          if (/^#/.test(line)) continue; // 해시태그 제외
          // 앞뒤에 더 긴 텍스트가 있어야 소제목으로 인정 (고립된 짧은 줄)
          const prevLine = lines[i - 1] || '';
          const nextLine = lines[i + 1] || '';
          const prevIsLong = prevLine.length > 45 || /[.]$/.test(prevLine);
          const nextIsLong = nextLine.length > 30;
          if ((prevIsLong || nextIsLong) && !counted.has(line)) {
            counted.add(line); count++;
          }
        }
      }
    }
    return Math.min(count, 15);
  }

  // 태그 개수 세기
  function countTags() {
    let count = 0;
    const docs = getAllDocs();
    const tagSelectors = ['.tag_item', '.tag-item', '.post_tag span', '.se-tag', '#tag_post span', '.tag_keyword'];

    docs.forEach(doc => {
      tagSelectors.forEach(selector => {
        const tags = doc.querySelectorAll(selector);
        count = Math.max(count, tags.length);
      });
    });

    const content = getEditorContent();
    const hashtagMatches = content.match(/#[가-힣a-zA-Z0-9_]+/g);
    if (hashtagMatches) {
      const uniqueTags = [...new Set(hashtagMatches)];
      count = Math.max(count, uniqueTags.length);
    }

    docs.forEach(doc => {
      const tagInput = doc.querySelector('#tag_post, .tag_input, [class*="tag"] input');
      if (tagInput && tagInput.value) {
        const tagCount = tagInput.value.split(',').filter(t => t.trim()).length;
        count = Math.max(count, tagCount);
      }
    });

    return count;
  }

  // 한글 조사 제거 (명사 추출용)
  function stripParticle(word) {
    // 2글자 조사부터 제거 시도 (긴 조사 우선)
    const particles2 = ['에서', '에게', '까지', '부터', '으로', '처럼', '만큼', '대로', '이나', '에는', '으로는'];
    for (const p of particles2) {
      if (word.endsWith(p) && word.length > p.length + 1) {
        return word.slice(0, -p.length);
      }
    }
    // 1글자 조사 제거
    const particles1 = ['을', '를', '은', '는', '이', '가', '의', '에', '도', '로', '서', '와', '과', '만', '란'];
    for (const p of particles1) {
      if (word.endsWith(p) && word.length > p.length + 1) {
        return word.slice(0, -p.length);
      }
    }
    return word;
  }

  // 자동 키워드 추출 (제목+본문빈도+태그 교차 분석)
  function getAutoKeyword() {
    const title = getTitle();
    const content = getEditorContent();
    if (!title && !content) return '';

    const commonWords = [
      '있다', '하다', '되다', '이다', '있는', '하는', '되는', '없는', '같은', '다른',
      '그리고', '하지만', '그래서', '때문에', '그런', '이런', '저런', '그런데', '그러나',
      '합니다', '입니다', '습니다', '됩니다', '있습니다', '했습니다', '됐습니다',
      '만들었습니다', '시작했습니다', '되었습니다', '있었습니다', '했었습니다',
      '수있', '것입', '하게', '에서', '으로', '부터', '까지',
      '블로그', '포스팅', '오늘', '여러분', '안녕', '직접', '결국',
      '알려주는', '방법', '추천', '소개', '정리', '후기', '리뷰',
      '가이드', '완벽', '총정리', '꿀팁', '필독', '사기', '맞고', '날린'
    ];

    // 제목에서 단어 추출 (한글 + 영문+숫자 혼합 지원)
    const rawTitleWords = title.match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
    // 조사 제거 후 중복 없이 정리
    const titleWords = [];
    const titleWordSet = new Set();
    for (const raw of rawTitleWords) {
      const stripped = stripParticle(raw);
      if (stripped.length >= 2 && !titleWordSet.has(stripped)) {
        titleWordSet.add(stripped);
        titleWords.push(stripped);
      }
    }

    // 본문 단어 빈도 (조사 제거 후)
    const rawBodyWords = content.match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
    const bodyFreq = {};
    rawBodyWords.forEach(w => {
      const s = stripParticle(w);
      if (s.length >= 2) bodyFreq[s] = (bodyFreq[s] || 0) + 1;
    });

    // 후보 점수 계산
    const candidates = [];
    for (const tw of titleWords) {
      if (commonWords.some(cw => tw === cw || (tw.length <= 3 && cw.includes(tw)))) continue;
      const freq = bodyFreq[tw] || 0;
      const lengthBonus = tw.length >= 4 ? 5 : 0;
      // 영문+한글 복합어 보너스 (예: AI블로그자동화)
      const mixedBonus = /[a-zA-Z]/.test(tw) && /[가-힣]/.test(tw) ? 10 : 0;
      candidates.push({ word: tw, score: freq + lengthBonus + mixedBonus + tw.length });
    }

    // 점수 순 정렬
    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length > 0) return candidates[0].word;

    // 폴백: 본문에서 가장 많이 나온 단어 중 제목에 포함된 것
    const sortedBody = Object.entries(bodyFreq).sort((a, b) => b[1] - a[1]);
    const titleLower = title.toLowerCase();
    for (const [word, count] of sortedBody) {
      if (word.length >= 3 && count >= 2 && titleLower.includes(word.toLowerCase())) {
        if (!commonWords.some(cw => word === cw)) return word;
      }
    }

    // 최종 폴백: 제목에서 가장 긴 단어
    if (titleWords.length > 0) {
      return titleWords.sort((a, b) => b.length - a.length)[0];
    }

    return '';
  }

  // ==================== SEO 분석 함수들 ====================

  // 1. 첫 문단 품질 분석 (20점)
  function analyzeFirstParagraph(content, title) {
    let score = 20;
    let status = 'good';
    let hint = '';
    const penalties = [];

    const paragraphs = content.split(/\n\n|\n/).filter(p => p.trim().length > 10);
    const firstPara = paragraphs[0] || '';

    // 나쁜 시작 패턴 체크
    const badStarts = ['안녕하세요', '오늘은', '여러분', '안녕', '반갑습니다', '오늘도', '안녕하세용', '하이'];
    const hasBadStart = badStarts.some(s => firstPara.trim().startsWith(s));

    if (hasBadStart) {
      score -= 8;
      penalties.push('인사말 시작');
    }

    // 제목 복붙 체크 (첫 문장이 제목과 80% 이상 유사)
    if (title && firstPara) {
      const firstSentence = firstPara.split(/[.?!]/)[0] || '';
      const similarity = calculateTextSimilarity(title, firstSentence);
      if (similarity > 80) {
        score -= 10;
        penalties.push('제목 복붙');
      }
    }

    // 핵심 결론 체크 (수치, 구체적 정보 포함 여부)
    const hasConcreteInfo = /\d+[개대평명원시간분%년월일만억천건회]|[\d,]+만?\s*원|[\d.]+km/.test(firstPara);
    const hasResultWord = /(결과|정리|비교|추천|핵심|중요|필수|가격|위치|시간)/.test(firstPara);

    if (!hasConcreteInfo && !hasResultWord) {
      score -= 5;
      penalties.push('핵심 정보 부족');
    }

    score = Math.max(0, score);

    if (score >= 18) {
      status = 'good';
      hint = '핵심 즉시 제시';
    } else if (score >= 12) {
      status = 'warn';
      hint = penalties.join(', ');
    } else {
      status = 'bad';
      hint = penalties.join(', ') || '개선 필요';
    }

    return { score, max: 20, status, hint, penalties };
  }

  // 텍스트 유사도 계산
  function calculateTextSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase().replace(/\s/g, '');
    const s2 = str2.toLowerCase().replace(/\s/g, '');
    if (s1 === s2) return 100;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 100;

    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }

    return Math.round((matches / longer.length) * 100);
  }

  // 2. 콘텐츠 구조 분석 (20점)
  function analyzeContentStructure(content) {
    let score = 0;
    let status = 'bad';
    let hint = '';

    const subheadingCount = countSubheadings();

    // 목차 존재 여부 체크
    const hasTableOfContents = /(목차|차례|순서|Contents)/i.test(content) ||
                               /[①②③④⑤⑥⑦⑧⑨⑩]|[1-9]\.|[1-9]\)/.test(content.slice(0, 500));

    // 계단식 구조 체크 (대주제 -> 소주제)
    const hasHierarchy = subheadingCount >= 2;

    // Q&A 섹션 체크
    const hasQnA = /(Q\s*[&:.]?\s*A|질문|자주\s*묻는|FAQ|Q\.|A\.)/i.test(content);

    if (hasTableOfContents && subheadingCount >= 3) {
      score = 20;
      status = 'good';
      hint = `목차+소제목 ${subheadingCount}개`;
    } else if (subheadingCount >= 2 && hasHierarchy) {
      score = 14;
      status = 'warn';
      hint = `소제목 ${subheadingCount}개 (목차 추가 권장)`;
    } else if (subheadingCount >= 1) {
      score = 8;
      status = 'warn';
      hint = `소제목 ${subheadingCount}개 (3개 이상 권장)`;
    } else {
      score = 0;
      status = 'bad';
      hint = '구조화 필요';
    }

    // Q&A 보너스
    if (hasQnA && score < 20) {
      score = Math.min(20, score + 2);
    }

    return { score, max: 20, status, hint, subheadingCount, hasTableOfContents, hasQnA };
  }

  // 3. FIRE 공식 분석 (20점)
  function analyzeFIRE(content) {
    let score = 0;
    const elements = [];
    let status = 'bad';
    let hint = '';

    // F (Fact): 수치, 단위, 스펙 포함
    const hasFact = /\d+[개대평명원시간분초%년월일주회만억천건]|[\d,]+만?\s*원|[\d.]+km|[\d.]+kg|[\d.]+m²/.test(content);
    if (hasFact) {
      score += 5;
      elements.push('F');
    }

    // I (Interpretation): 이유/해석 표현
    const hasInterpretation = /(덕분에|때문에|그래서|수 있|효과|장점|단점|이유|결과적으로|따라서)/.test(content);
    if (hasInterpretation) {
      score += 5;
      elements.push('I');
    }

    // R (Real): 직접 경험 표현
    const hasReal = /(직접|실제로|개월간|동안|이용하며|다녀|가봤|써봤|먹어봤|체험|경험)/.test(content);
    if (hasReal) {
      score += 5;
      elements.push('R');
    }

    // E (Experience): 느낌/결과/평가/감정 표현
    const hasExperience = /(느꼈|좋았|편했|만족|추천|아쉬웠|불편|최고|괜찮|별로|솔직히|결심|깨달|확실|강추|놓치지|대박|신세계|후회|뿌듯|다행|감동|놀라)/.test(content);
    if (hasExperience) {
      score += 5;
      elements.push('E');
    }

    // 추상적 표현만 있는 경우 감점
    const abstractOnly = /(좋아요|추천해요|괜찮아요|맛있어요)/.test(content) && elements.length < 2;
    if (abstractOnly) {
      score = Math.max(0, score - 3);
    }

    if (elements.length === 4) {
      status = 'good';
      hint = 'FIRE 완벽 적용';
    } else if (elements.length >= 3) {
      status = 'warn';
      hint = `${elements.join('+')} (${4 - elements.length}개 부족)`;
    } else if (elements.length >= 1) {
      status = 'warn';
      hint = `${elements.join('+')}만 있음`;
    } else {
      status = 'bad';
      hint = '구체적 경험 추가 필요';
    }

    return { score, max: 20, status, hint, elements };
  }

  // 4. 제목 최적화 분석 (15점)
  function analyzeTitleOptimization(title, keyword) {
    let score = 0;
    let status = 'bad';
    let hint = '';

    if (!title) {
      return { score: 0, max: 15, status: 'none', hint: '제목 입력 필요' };
    }

    // 키워드 포함 여부
    const hasKeyword = keyword && title.toLowerCase().includes(keyword.toLowerCase());

    // 구체적 수치/결과 포함 여부
    const hasConcreteNumber = /\d+[개대평명원시간분%년월일회]|[\d,]+원|[\d.]+kg/.test(title);

    // 키워드 앞쪽 배치 여부 (제목 앞 1/3 이내)
    let keywordPosition = 'none';
    if (hasKeyword) {
      const pos = title.toLowerCase().indexOf(keyword.toLowerCase());
      if (pos <= title.length / 3) {
        keywordPosition = 'front';
      } else {
        keywordPosition = 'back';
      }
    }

    if (hasKeyword && hasConcreteNumber && keywordPosition === 'front') {
      score = 15;
      status = 'good';
      hint = '키워드+수치+앞배치';
    } else if (hasKeyword && hasConcreteNumber) {
      score = 12;
      status = 'good';
      hint = '키워드+수치 포함';
    } else if (hasKeyword && keywordPosition === 'front') {
      score = 10;
      status = 'warn';
      hint = '구체적 수치 추가 권장';
    } else if (hasKeyword) {
      score = 7;
      status = 'warn';
      hint = '수치/결과 추가 권장';
    } else {
      score = 0;
      status = 'bad';
      hint = '키워드 미포함';
    }

    return { score, max: 15, status, hint, hasKeyword, hasConcreteNumber };
  }

  // 5. 이미지 활용 분석 (10점)
  function analyzeImageUsage() {
    const imageCount = countImages();
    let score = 0;
    let status = 'bad';
    let hint = '';

    if (imageCount >= 5) {
      score = 10;
      status = 'good';
      hint = `${imageCount}장 (우수)`;
    } else if (imageCount >= 3) {
      score = 7;
      status = 'warn';
      hint = `${imageCount}장 (5장 권장)`;
    } else if (imageCount >= 1) {
      score = 4;
      status = 'warn';
      hint = `${imageCount}장 (3장 이상 권장)`;
    } else {
      score = 0;
      status = 'bad';
      hint = '이미지 추가 필요';
    }

    return { score, max: 10, status, hint, imageCount };
  }

  // 6. 신뢰성 요소 분석 (10점)
  function analyzeCredibility(content) {
    let score = 0;
    const elements = [];
    let status = 'bad';
    let hint = '';

    // 외부 출처 링크 (URL 패턴)
    const linkCount = (content.match(/https?:\/\/[^\s]+|출처\s*:|참고\s*:|참조\s*:/gi) || []).length;
    if (linkCount >= 2) {
      score += 4;
      elements.push(`출처 ${linkCount}개`);
    } else if (linkCount >= 1) {
      score += 2;
      elements.push(`출처 ${linkCount}개`);
    }

    // 구체적 수치 데이터
    const dataPatterns = /\d+년\s*(경력|운영|역사)|회원\s*\d+|평점\s*[\d.]+|\d+평|수용\s*인원\s*\d+/;
    if (dataPatterns.test(content)) {
      score += 3;
      elements.push('데이터');
    }

    // 자격/경력 언급
    const credentialPatterns = /(자격증|수료증|전문가|경력\s*\d+년|지도사|트레이너|코치|강사|대표|원장)/;
    if (credentialPatterns.test(content)) {
      score += 3;
      elements.push('자격/경력');
    }

    // 불확실한 표현 감점
    const uncertainCount = (content.match(/(것\s*같아요|일\s*수도|아마도|글쎄요|모르겠)/g) || []).length;
    if (uncertainCount >= 3) {
      score = Math.max(0, score - 3);
      elements.push('불확실 표현 多');
    }

    score = Math.min(10, score);

    if (score >= 8) {
      status = 'good';
      hint = elements.slice(0, 2).join('+');
    } else if (score >= 4) {
      status = 'warn';
      hint = elements.length > 0 ? elements.join(', ') : '출처/데이터 추가 권장';
    } else {
      status = 'bad';
      hint = '신뢰성 요소 부족';
    }

    return { score, max: 10, status, hint, elements };
  }

  // 7. 태그 분석 (5점)
  function analyzeTagUsage(keyword) {
    const tagCount = countTags();
    let score = 0;
    let status = 'bad';
    let hint = '';

    if (tagCount >= 5) {
      score = 5;
      status = 'good';
      hint = `${tagCount}개`;
    } else if (tagCount >= 3) {
      score = 3;
      status = 'warn';
      hint = `${tagCount}개 (5개 권장)`;
    } else if (tagCount >= 1) {
      score = 1;
      status = 'warn';
      hint = `${tagCount}개 (관련 태그 추가)`;
    } else {
      score = 0;
      status = 'bad';
      hint = '태그 추가 필요';
    }

    return { score, max: 5, status, hint, tagCount };
  }

  // 8. 감점 요소 분석
  function analyzePenalties(content, title) {
    const penalties = [];
    let totalPenalty = 0;

    // 키워드 과다 반복 (동일 단어 15회 이상)
    const words = content.match(/[가-힣]{2,}/g) || [];
    const wordFreq = {};
    words.forEach(w => wordFreq[w] = (wordFreq[w] || 0) + 1);
    const maxRepeat = Math.max(...Object.values(wordFreq), 0);
    if (maxRepeat >= 15) {
      penalties.push({ reason: '키워드 과다 반복', penalty: -5 });
      totalPenalty -= 5;
    }

    // "~것 같아요" 반복
    const uncertainCount = (content.match(/(것\s*같아요|같습니다|것\s*같은)/g) || []).length;
    if (uncertainCount >= 5) {
      penalties.push({ reason: '"~것 같아요" 반복', penalty: -3 });
      totalPenalty -= 3;
    }

    return { penalties, totalPenalty };
  }

  // 메인 SEO 분석 함수 - NaverSEOAnalyzer 엔진 사용
  function analyzeSEO() {
    const title = getTitle();
    const content = getEditorContent();

    let keyword = seoKeyword.trim();
    let autoKeyword = '';
    if (!keyword) {
      autoKeyword = getAutoKeyword();
      keyword = autoKeyword;
    }

    // NaverSEOAnalyzer 엔진 사용
    if (typeof NaverSEOAnalyzer !== 'undefined') {
      const result = NaverSEOAnalyzer.analyze({
        title: title,
        content: content,
        keyword: keyword,
        imageCount: countImages(),
        subheadingCount: countSubheadings(),
        tagCount: countTags(),
        tags: []
      });
      return {
        score: result.score,
        grade: result.grade,
        details: result.details,
        keyword: keyword || autoKeyword,
        gradeDescription: result.gradeDescription
      };
    }

    // 폴백: 기존 로직 (NaverSEOAnalyzer 로드 실패 시)
    const details = [];
    let totalScore = 0;

    // 1. 첫 문단 품질 (20점)
    const firstPara = analyzeFirstParagraph(content, title);
    details.push({ item: '첫 문단 품질', ...firstPara });
    totalScore += firstPara.score;

    // 2. 콘텐츠 구조 (20점)
    const structure = analyzeContentStructure(content);
    details.push({ item: '콘텐츠 구조', ...structure });
    totalScore += structure.score;

    // 3. FIRE 공식 (20점)
    const fire = analyzeFIRE(content);
    details.push({ item: 'FIRE 공식', ...fire });
    totalScore += fire.score;

    // 4. 제목 최적화 (15점)
    const titleOpt = analyzeTitleOptimization(title, keyword);
    details.push({ item: '제목 최적화', ...titleOpt });
    totalScore += titleOpt.score;

    // 5. 이미지 활용 (10점)
    const images = analyzeImageUsage();
    details.push({ item: '이미지 활용', ...images });
    totalScore += images.score;

    // 6. 신뢰성 요소 (10점)
    const credibility = analyzeCredibility(content);
    details.push({ item: '신뢰성 요소', ...credibility });
    totalScore += credibility.score;

    // 7. 태그 (5점)
    const tags = analyzeTagUsage(keyword);
    details.push({ item: '태그', ...tags });
    totalScore += tags.score;

    // 8. 감점 요소
    const penaltyResult = analyzePenalties(content, title);
    if (penaltyResult.totalPenalty < 0) {
      details.push({
        item: '감점 요소',
        score: penaltyResult.totalPenalty,
        max: 0,
        status: 'bad',
        hint: penaltyResult.penalties.map(p => p.reason).join(', ')
      });
      totalScore += penaltyResult.totalPenalty;
    }

    // 최종 점수 보정
    totalScore = Math.max(0, Math.min(100, totalScore));

    // 등급 계산
    let grade = 'F';
    if (totalScore >= 95) grade = 'S';
    else if (totalScore >= 85) grade = 'A';
    else if (totalScore >= 70) grade = 'B';
    else if (totalScore >= 55) grade = 'C';
    else if (totalScore >= 40) grade = 'D';

    return { score: totalScore, grade, details, keyword: keyword || autoKeyword };
  }

  // ==================== 타자수 추적 ====================
  let keystrokeCount = 0;

  function setupKeystrokeTracking() {
    if (window._bbKeystrokeTrackingStarted) return;
    window._bbKeystrokeTrackingStarted = true;

    const ignoreKeys = new Set([
      'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown',
      'Escape', 'Tab', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
      'Insert', 'ContextMenu', 'PrintScreen', 'Pause'
    ]);

    function handleKeydown(e) {
      if (ignoreKeys.has(e.key)) return;
      if (e.ctrlKey || e.metaKey) return;
      keystrokeCount++;
      updateKeystrokeDisplay();
    }

    function attachListeners() {
      const docs = [document];
      document.querySelectorAll('iframe').forEach(iframe => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          if (iframeDoc) docs.push(iframeDoc);
        } catch (e) {}
      });
      docs.forEach(doc => {
        doc.querySelectorAll('[contenteditable="true"]').forEach(el => {
          if (!el._bbKeystrokeAttached) {
            el.addEventListener('keydown', handleKeydown);
            el._bbKeystrokeAttached = true;
          }
        });
      });
    }

    attachListeners();
    setInterval(attachListeners, 3000);
  }

  function updateKeystrokeDisplay() {
    const labelEl = document.getElementById('bb-keystroke-count');
    if (labelEl) {
      labelEl.textContent = `타자수 ${keystrokeCount.toLocaleString()}타`;
    }
  }

  // ==================== 사이드바 ====================
  let analysisSidebar = null;
  let sidebarUpdateInterval = null;

  function createAnalysisSidebar() {
    const existingSidebars = document.querySelectorAll('#bb-analysis-sidebar, .bb-analysis-sidebar');
    if (existingSidebars.length > 0) {
      existingSidebars.forEach((el, index) => {
        if (index === 0) {
          el.classList.remove('bb-hidden');
          analysisSidebar = el;
        } else {
          el.remove();
        }
      });
      startSidebarUpdate();
      return;
    }

    if (analysisSidebar && document.body.contains(analysisSidebar)) {
      analysisSidebar.classList.remove('bb-hidden');
      startSidebarUpdate();
      return;
    }

    analysisSidebar = document.createElement('div');
    analysisSidebar.id = 'bb-analysis-sidebar';
    analysisSidebar.className = 'bb-analysis-sidebar';
    analysisSidebar.innerHTML = `
      <div class="bb-sidebar-header">
        <span class="bb-sidebar-title">📊 블로그 부스터</span>
        <button class="bb-close-btn">✕</button>
      </div>
      <div class="bb-sidebar-content">
        <div class="bb-section bb-seo-section">
          <div class="bb-seo-header">
            <span>🎯 SEO 분석</span>
            <span class="bb-seo-grade" id="bb-seo-grade">-</span>
          </div>
          <div class="bb-seo-keyword-wrap">
            <input type="text" id="bb-seo-keyword" placeholder="키워드 입력" />
          </div>
          <div class="bb-seo-score-wrap">
            <div class="bb-seo-score-bar">
              <div class="bb-seo-score-fill" id="bb-seo-score-fill"></div>
            </div>
            <span class="bb-seo-score-text" id="bb-seo-score-text">0점</span>
          </div>
          <div class="bb-seo-details" id="bb-seo-details"></div>
        </div>
        <div class="bb-section bb-word-section">
          <div class="bb-section-title">📝 형태소 분석</div>
          <div class="bb-word-list" id="bb-word-list">
            <div class="bb-word-empty">본문을 작성하면 형태소가 분석됩니다.</div>
          </div>
        </div>
        <div class="bb-section bb-stats-section">
          <div class="bb-stats-label" id="bb-keystroke-count">타자수 0타</div>
          <div class="bb-stats-main" id="bb-main-count">0<span class="bb-stats-unit">자</span></div>
          <div class="bb-stats-sub" id="bb-sub-count">공백제외 0자</div>
        </div>
      </div>
    `;

    const keywordInput = analysisSidebar.querySelector('#bb-seo-keyword');
    if (keywordInput) {
      keywordInput.addEventListener('input', (e) => {
        seoKeyword = e.target.value;
        updateSEODisplay();
      });
    }

    // 리사이즈 핸들 추가
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'bb-resize-handle';
    analysisSidebar.appendChild(resizeHandle);

    document.body.appendChild(analysisSidebar);

    // 저장된 위치/크기 복원
    try {
      const saved = localStorage.getItem('bb-sidebar-pos');
      if (saved) {
        const pos = JSON.parse(saved);
        analysisSidebar.style.left = pos.left + 'px';
        analysisSidebar.style.top = pos.top + 'px';
        if (pos.width) analysisSidebar.style.width = pos.width + 'px';
        if (pos.height) {
          analysisSidebar.style.height = pos.height + 'px';
          analysisSidebar.style.maxHeight = 'none';
        }
        analysisSidebar.classList.add('bb-dragged');
      }
    } catch (e) {}

    // 드래그 기능
    const header = analysisSidebar.querySelector('.bb-sidebar-header');
    let isDragging = false, dragStartX, dragStartY, sidebarStartX, sidebarStartY;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.bb-close-btn')) return;
      isDragging = true;
      const rect = analysisSidebar.getBoundingClientRect();
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      sidebarStartX = rect.left;
      sidebarStartY = rect.top;
      // 첫 드래그 시 transform 제거
      if (!analysisSidebar.classList.contains('bb-dragged')) {
        analysisSidebar.style.top = rect.top + 'px';
        analysisSidebar.style.left = rect.left + 'px';
        analysisSidebar.classList.add('bb-dragged');
      }
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        analysisSidebar.style.left = Math.max(0, sidebarStartX + dx) + 'px';
        analysisSidebar.style.top = Math.max(0, sidebarStartY + dy) + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        saveSidebarPosition();
      }
    });

    // 리사이즈 기능
    let isResizing = false, resizeStartX, resizeStartY, startWidth, startHeight;

    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      const rect = analysisSidebar.getBoundingClientRect();
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      startWidth = rect.width;
      startHeight = rect.height;
      if (!analysisSidebar.classList.contains('bb-dragged')) {
        analysisSidebar.style.top = rect.top + 'px';
        analysisSidebar.style.left = rect.left + 'px';
        analysisSidebar.classList.add('bb-dragged');
      }
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (isResizing) {
        const newW = Math.max(160, startWidth + (e.clientX - resizeStartX));
        const newH = Math.max(200, startHeight + (e.clientY - resizeStartY));
        analysisSidebar.style.width = newW + 'px';
        analysisSidebar.style.height = newH + 'px';
        analysisSidebar.style.maxHeight = 'none';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        saveSidebarPosition();
      }
    });

    function saveSidebarPosition() {
      try {
        const rect = analysisSidebar.getBoundingClientRect();
        localStorage.setItem('bb-sidebar-pos', JSON.stringify({
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }));
      } catch (e) {}
    }

    analysisSidebar.querySelector('.bb-close-btn').addEventListener('click', () => {
      analysisSidebar.classList.add('bb-hidden');
      if (sidebarUpdateInterval) {
        clearInterval(sidebarUpdateInterval);
        sidebarUpdateInterval = null;
      }
    });

    startSidebarUpdate();
  }

  function updateSEODisplay() {
    const seo = analyzeSEO();

    const keywordInput = document.getElementById('bb-seo-keyword');
    if (keywordInput && !seoKeyword.trim()) {
      const autoKw = getAutoKeyword();
      if (autoKw) keywordInput.placeholder = `자동: ${autoKw}`;
    }

    const gradeEl = document.getElementById('bb-seo-grade');
    if (gradeEl) {
      gradeEl.textContent = seo.grade;
      // 등급 체계: S/A/B/C/D/F
      gradeEl.className = 'bb-seo-grade bb-grade-' + seo.grade;
    }

    const scoreFill = document.getElementById('bb-seo-score-fill');
    const scoreText = document.getElementById('bb-seo-score-text');
    if (scoreFill) {
      scoreFill.style.width = seo.score + '%';
      // 등급별 색상
      if (seo.score >= 95) scoreFill.style.background = 'linear-gradient(90deg, #FFD700, #FFA500)'; // S등급 (금색)
      else if (seo.score >= 85) scoreFill.style.background = '#4CAF50'; // A등급 (녹색)
      else if (seo.score >= 70) scoreFill.style.background = '#8BC34A'; // B등급 (연녹색)
      else if (seo.score >= 55) scoreFill.style.background = '#FF9800'; // C등급 (주황)
      else if (seo.score >= 40) scoreFill.style.background = '#FF5722'; // D등급 (빨주)
      else scoreFill.style.background = '#F44336'; // F등급 (빨강)
    }
    if (scoreText) scoreText.textContent = seo.score + '점';

    const detailsEl = document.getElementById('bb-seo-details');
    if (detailsEl) {
      detailsEl.innerHTML = seo.details.map(d => {
        let statusIcon = '', statusClass = '';
        if (d.status === 'good') { statusIcon = '✓'; statusClass = 'good'; }
        else if (d.status === 'warn') { statusIcon = '△'; statusClass = 'warn'; }
        else if (d.status === 'bad') { statusIcon = '✗'; statusClass = 'bad'; }
        else { statusIcon = '-'; statusClass = 'none'; }

        // 감점 항목은 다르게 표시
        const scoreDisplay = d.score < 0 ? d.score : `${d.score}/${d.max}`;

        return `<div class="bb-seo-item ${statusClass}">
          <span class="bb-seo-item-icon">${statusIcon}</span>
          <span class="bb-seo-item-name">${d.item}</span>
          <span class="bb-seo-item-score">${scoreDisplay}</span>
          ${d.hint ? `<span class="bb-seo-item-hint">${d.hint}</span>` : ''}
        </div>`;
      }).join('');
    }
  }

  function updateSidebar() {
    const text = getEditorContent();
    const counts = countCharacters(text);
    const words = analyzeWords(text);

    updateSEODisplay();

    const wordListEl = document.getElementById('bb-word-list');
    if (wordListEl) {
      if (words.length > 0) {
        wordListEl.innerHTML = words.slice(0, 50).map(([word, count]) => `
          <div class="bb-word-item">
            <span class="bb-word-text">${word}</span>
            <span class="bb-word-count">(${count})</span>
          </div>
        `).join('');
      } else {
        wordListEl.innerHTML = '<div class="bb-word-empty">본문을 작성하면 형태소가 분석됩니다.</div>';
      }
    }

    const mainCountEl = document.getElementById('bb-main-count');
    const subCountEl = document.getElementById('bb-sub-count');
    if (mainCountEl) mainCountEl.innerHTML = `${counts.withSpaces.toLocaleString()}<span class="bb-stats-unit">자</span>`;
    if (subCountEl) subCountEl.textContent = `공백제외 ${counts.total.toLocaleString()}자`;
  }

  function startSidebarUpdate() {
    if (sidebarUpdateInterval) clearInterval(sidebarUpdateInterval);
    updateSidebar();
    sidebarUpdateInterval = setInterval(updateSidebar, 1000);
    setupKeystrokeTracking();
  }

  // ==================== 뽀모도로 타이머 ====================
  let timerPanel = null;
  let timerInterval = null;
  let timerSeconds = 25 * 60;
  let timerRunning = false;
  let selectedPreset = 25;

  function createTimerPanel() {
    if (timerPanel) {
      timerPanel.classList.remove('bb-hidden');
      return;
    }

    timerPanel = document.createElement('div');
    timerPanel.className = 'bb-timer-panel';
    timerPanel.innerHTML = `
      <div class="bb-timer-header">
        <span>⏱️ 뽀모도로</span>
        <button class="bb-timer-close">✕</button>
      </div>
      <div class="bb-timer-body">
        <div class="bb-timer-display" id="bb-timer-display">25:00</div>
        <div class="bb-timer-presets">
          <button class="bb-timer-preset" data-minutes="15">15</button>
          <button class="bb-timer-preset" data-minutes="20">20</button>
          <button class="bb-timer-preset active" data-minutes="25">25</button>
          <button class="bb-timer-preset" data-minutes="30">30</button>
          <button class="bb-timer-preset" data-minutes="40">40</button>
          <button class="bb-timer-preset" data-minutes="60">60</button>
        </div>
        <div class="bb-timer-controls">
          <button class="bb-timer-btn bb-timer-btn-start" id="bb-timer-start">▶</button>
          <button class="bb-timer-btn bb-timer-btn-reset" id="bb-timer-reset">↺</button>
        </div>
      </div>
    `;

    document.body.appendChild(timerPanel);

    timerPanel.querySelector('.bb-timer-close').addEventListener('click', () => {
      timerPanel.classList.add('bb-hidden');
    });

    timerPanel.querySelectorAll('.bb-timer-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        if (timerRunning) return;
        timerPanel.querySelectorAll('.bb-timer-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPreset = parseInt(btn.dataset.minutes);
        timerSeconds = selectedPreset * 60;
        updateTimerDisplay();
      });
    });

    document.getElementById('bb-timer-start').addEventListener('click', toggleTimer);
    document.getElementById('bb-timer-reset').addEventListener('click', resetTimer);
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const display = document.getElementById('bb-timer-display');
    if (!display) return;
    const m = Math.floor(timerSeconds / 60);
    const s = timerSeconds % 60;
    display.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function toggleTimer() {
    const btn = document.getElementById('bb-timer-start');
    if (timerRunning) {
      clearInterval(timerInterval);
      timerRunning = false;
      btn.textContent = '▶';
    } else {
      timerRunning = true;
      btn.textContent = '⏸';
      timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();
        if (timerSeconds <= 0) {
          clearInterval(timerInterval);
          timerRunning = false;
          btn.textContent = '▶';
          playNotificationSound();
          showToast('⏱️ 타이머 완료!', 'success');
          timerSeconds = selectedPreset * 60;
          updateTimerDisplay();
        }
      }, 1000);
    }
  }

  function resetTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    timerSeconds = selectedPreset * 60;
    updateTimerDisplay();
    const btn = document.getElementById('bb-timer-start');
    if (btn) btn.textContent = '▶';
  }

  // ==================== 워드 내보내기 ====================
  function exportToWord() {
    const text = getEditorContent();
    let title = getTitle() || '블로그 글';
    let htmlContent = '';
    const selectors = ['.se-main-container', '#postViewArea', '.post_ct'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { htmlContent = el.innerHTML; break; }
    }
    if (!htmlContent) htmlContent = text.replace(/\n/g, '<br>');

    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font-family:'맑은 고딕',sans-serif;line-height:1.8;padding:40px;}h1{border-bottom:2px solid #667eea;padding-bottom:10px;}img{max-width:100%;}</style>
      </head><body><h1>${title}</h1><div>${htmlContent}</div></body></html>`;

    const blob = new Blob([doc], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.substring(0, 50).replace(/[<>:"/\\|?*]/g, '')}.doc`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('📄 워드 파일 저장 완료!', 'success');
  }

  // ==================== 메시지 리스너 ====================
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    switch (request.action) {
      case 'toggleCounter':
      case 'showAnalysis':
        createAnalysisSidebar();
        sendResponse({ success: true });
        break;
      case 'toggleSeoPanel':
        toggleSeoPanel();
        sendResponse({ success: true });
        break;
      case 'toggleTimer':
        createTimerPanel();
        sendResponse({ success: true });
        break;
      case 'exportWord':
        exportToWord();
        sendResponse({ success: true });
        break;
      case 'getCharCount':
        const text = getEditorContent();
        const counts = countCharacters(text);
        sendResponse(counts);
        break;
      case 'copyPlainText':
        if (request.text) {
          navigator.clipboard.writeText(request.text).then(() => {
            showToast('복사 완료', 'success');
          });
        }
        sendResponse({ success: true });
        break;
      case 'captureBlogContent':
        captureBlogContentAsImage().then(result => {
          sendResponse(result);
        }).catch(err => {
          sendResponse({ success: false, error: err.message });
        });
        return true; // 비동기 응답을 위해 true 반환
    }
    return true;
  });

  /**
   * 자동 스크롤로 모든 이미지 로드
   */
  async function autoScrollToLoadImages(targetDocument, contentContainer) {
    return new Promise(async (resolve) => {
      showToast('📷 이미지 로딩을 위해 스크롤 중...', 'info');

      // 스크롤할 대상 결정 (iframe 내부 또는 window)
      const scrollTarget = targetDocument === document ? window : targetDocument.defaultView || window;
      const scrollElement = targetDocument.scrollingElement || targetDocument.documentElement || targetDocument.body;

      // 현재 스크롤 위치 저장
      const originalScrollTop = scrollElement.scrollTop || window.scrollY;

      // 전체 높이 계산
      const totalHeight = Math.max(
        scrollElement.scrollHeight,
        contentContainer.scrollHeight,
        targetDocument.body?.scrollHeight || 0
      );

      const viewportHeight = window.innerHeight;
      const scrollStep = viewportHeight * 0.7; // 70%씩 스크롤
      let currentPosition = 0;

      console.log('[캡처] 자동 스크롤 시작, 전체 높이:', totalHeight);

      // 맨 위로 이동
      if (scrollTarget === window) {
        window.scrollTo(0, 0);
      } else {
        scrollElement.scrollTop = 0;
      }

      await new Promise(r => setTimeout(r, 300));

      // 아래로 스크롤하면서 이미지 로드
      while (currentPosition < totalHeight) {
        currentPosition += scrollStep;

        if (scrollTarget === window) {
          window.scrollTo({ top: currentPosition, behavior: 'instant' });
        } else {
          scrollElement.scrollTop = currentPosition;
        }

        // 이미지 로드 대기
        await new Promise(r => setTimeout(r, 200));

        // lazy loading 이미지 강제 트리거
        triggerLazyImages(targetDocument);
      }

      // 맨 아래까지 한번 더 스크롤
      if (scrollTarget === window) {
        window.scrollTo({ top: totalHeight, behavior: 'instant' });
      } else {
        scrollElement.scrollTop = totalHeight;
      }

      await new Promise(r => setTimeout(r, 500));

      // 원래 위치로 복귀
      if (scrollTarget === window) {
        window.scrollTo({ top: originalScrollTop, behavior: 'instant' });
      } else {
        scrollElement.scrollTop = originalScrollTop;
      }

      console.log('[캡처] 자동 스크롤 완료');
      await new Promise(r => setTimeout(r, 300));

      resolve();
    });
  }

  /**
   * Lazy loading 이미지 강제 로드 트리거
   */
  function triggerLazyImages(targetDocument) {
    // data-src를 가진 이미지들 처리
    const lazyImages = targetDocument.querySelectorAll('img[data-src], img[data-lazy-src], img[data-origin-src], img.lazyload, img[loading="lazy"]');

    lazyImages.forEach(img => {
      // data-src 속성들을 실제 src로 복사
      const dataSrc = img.getAttribute('data-src') ||
                      img.getAttribute('data-lazy-src') ||
                      img.getAttribute('data-origin-src');

      if (dataSrc && !img.src.includes(dataSrc)) {
        img.src = dataSrc;
      }

      // loading 속성 제거
      img.removeAttribute('loading');

      // lazy 클래스 제거
      img.classList.remove('lazyload', 'lazy');
    });

    // 네이버 블로그 특수 이미지 처리 (se-image-resource)
    const seImages = targetDocument.querySelectorAll('.se-image-resource');
    seImages.forEach(img => {
      const dataSrc = img.getAttribute('data-src');
      if (dataSrc && img.src !== dataSrc) {
        img.src = dataSrc;
      }
    });
  }

  /**
   * 블로그 글 전체를 이미지로 캡처
   */
  async function captureBlogContentAsImage() {
    try {
      showToast('📷 캡처 준비 중...', 'info');

      // iframe 내부 document 가져오기
      let targetDocument = document;
      let contentContainer = null;

      // iframe 내부 콘텐츠 찾기
      const iframe = document.querySelector('iframe#mainFrame');
      if (iframe && iframe.contentDocument) {
        targetDocument = iframe.contentDocument;
      }

      // 블로그 본문 컨테이너 찾기
      const selectors = [
        '.se-main-container',      // 스마트에디터3
        '#postViewArea',           // 구버전
        '.post_ct',                // 모바일
        '.se-component-content',   // 컴포넌트
        '.post-view',              // 대체
        '#post-view'               // 대체2
      ];

      for (const selector of selectors) {
        contentContainer = targetDocument.querySelector(selector);
        if (contentContainer) break;
      }

      if (!contentContainer) {
        throw new Error('블로그 본문을 찾을 수 없습니다.');
      }

      // 자동 스크롤로 모든 이미지 로드
      await autoScrollToLoadImages(targetDocument, contentContainer);

      showToast('📷 이미지 변환 중...', 'info');

      // 이미지들을 base64로 변환
      await convertImagesToBase64(contentContainer);

      // 이미지 변환 완료 후 잠시 대기 (렌더링 안정화)
      await new Promise(resolve => setTimeout(resolve, 500));

      showToast('📷 캡처 중... 잠시 기다려주세요.', 'info');

      // html2canvas 로드 (동적으로)
      if (typeof html2canvas === 'undefined') {
        await loadHtml2Canvas();
      }

      console.log('[캡처] html2canvas 시작');

      // 캡처 실행 (이미 base64로 변환된 이미지 사용)
      const canvas = await html2canvas(contentContainer, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scale: 2, // 고해상도
        logging: true, // 디버그용
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: contentContainer.scrollWidth,
        windowHeight: contentContainer.scrollHeight,
        imageTimeout: 30000, // 이미지 로딩 타임아웃 30초
        removeContainer: true
      });

      console.log('[캡처] html2canvas 완료, 크기:', canvas.width, 'x', canvas.height);

      // 파일명 생성 (제목 기반)
      const title = targetDocument.querySelector('.se-title-text, .pcol1, .tit_h3, #title')?.textContent?.trim() || '블로그글';
      const safeName = title.substring(0, 50).replace(/[<>:"/\\|?*]/g, '').trim();
      const timestamp = new Date().toISOString().slice(0, 10);

      // 이미지 크기 제한 (8000px 초과 시 분할)
      const MAX_PIXEL = 7900;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      if (canvasWidth <= MAX_PIXEL && canvasHeight <= MAX_PIXEL) {
        // 크기가 제한 이내면 그냥 저장
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${safeName}_${timestamp}.png`;
        link.href = dataUrl;
        link.click();
        showToast('✅ 캡처 완료! 이미지가 다운로드됩니다.', 'success');
      } else {
        // 높이가 8000픽셀 초과 시 분할
        showToast('📷 이미지가 커서 분할 저장합니다...', 'info');
        const parts = Math.ceil(canvasHeight / MAX_PIXEL);

        for (let i = 0; i < parts; i++) {
          const partCanvas = document.createElement('canvas');
          const startY = i * MAX_PIXEL;
          const partHeight = Math.min(MAX_PIXEL, canvasHeight - startY);

          partCanvas.width = Math.min(canvasWidth, MAX_PIXEL);
          partCanvas.height = partHeight;

          const partCtx = partCanvas.getContext('2d');
          partCtx.fillStyle = '#ffffff';
          partCtx.fillRect(0, 0, partCanvas.width, partCanvas.height);
          partCtx.drawImage(
            canvas,
            0, startY, partCanvas.width, partHeight,  // source
            0, 0, partCanvas.width, partHeight        // destination
          );

          const partDataUrl = partCanvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = `${safeName}_${timestamp}_${i + 1}.png`;
          link.href = partDataUrl;

          // 각 파일 다운로드 사이에 약간의 딜레이
          await new Promise(resolve => setTimeout(resolve, 300));
          link.click();
        }

        showToast(`✅ 캡처 완료! ${parts}장의 이미지가 다운로드됩니다.`, 'success');
      }

      return { success: true };

    } catch (error) {
      console.error('캡처 오류:', error);
      showToast('❌ 캡처 실패: ' + error.message, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * 컨테이너 내의 모든 이미지를 base64로 변환
   */
  async function convertImagesToBase64(container) {
    const images = container.querySelectorAll('img');
    const promises = [];

    console.log('[캡처] 이미지 개수:', images.length);

    for (const img of images) {
      // 네이버 블로그 이미지 src 찾기 (다양한 속성 체크)
      let src = img.src ||
                img.getAttribute('data-src') ||
                img.getAttribute('data-lazy-src') ||
                img.getAttribute('data-origin-src') ||
                img.getAttribute('data-linkdata') ||
                img.dataset.src;

      // srcset에서 가장 큰 이미지 찾기
      if (!src && img.srcset) {
        const srcsetParts = img.srcset.split(',').map(s => s.trim().split(' ')[0]);
        src = srcsetParts[srcsetParts.length - 1];
      }

      if (!src || src.startsWith('data:') || src.includes('blank.gif')) continue;

      console.log('[캡처] 이미지 처리:', src.substring(0, 80));

      const promise = fetchImageAsBase64(src)
        .then(base64 => {
          if (base64) {
            img.src = base64;
            img.style.visibility = 'visible';
            img.style.opacity = '1';
            img.removeAttribute('data-src');
            img.removeAttribute('data-lazy-src');
            img.removeAttribute('loading');
            console.log('[캡처] 이미지 변환 성공');
          }
        })
        .catch((e) => {
          console.log('[캡처] 이미지 변환 실패:', src.substring(0, 50), e);
        });

      promises.push(promise);
    }

    // 배경 이미지도 처리 (se-image 등)
    const bgElements = container.querySelectorAll('.se-image, [style*="background-image"]');
    for (const el of bgElements) {
      const style = window.getComputedStyle(el);
      const bgImage = style.backgroundImage;
      const match = bgImage.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/);
      if (match && match[1] && !match[1].includes('blank.gif')) {
        console.log('[캡처] 배경 이미지 처리:', match[1].substring(0, 50));
        const promise = fetchImageAsBase64(match[1])
          .then(base64 => {
            if (base64) {
              el.style.backgroundImage = `url(${base64})`;
            }
          })
          .catch(() => {});
        promises.push(promise);
      }
    }

    await Promise.allSettled(promises);
    console.log('[캡처] 이미지 변환 완료');
  }

  /**
   * 이미지 URL을 base64로 변환 (Background script를 통해)
   */
  async function fetchImageAsBase64(url) {
    try {
      // Background script에 이미지 fetch 요청
      const response = await chrome.runtime.sendMessage({
        action: 'fetchImageAsBase64',
        url: url
      });

      if (response && response.success && response.base64) {
        return response.base64;
      }

      // 실패 시 canvas 방식 시도 (같은 도메인 이미지용)
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch (err) {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    } catch (e) {
      console.log('이미지 변환 실패:', url, e);
      return null;
    }
  }

  /**
   * html2canvas 라이브러리 동적 로드
   */
  function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
      // 이미 로드되어 있으면 바로 resolve
      if (typeof html2canvas !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('html2canvas 로드 실패'));
      document.head.appendChild(script);
    });
  }

  /**
   * SEO 분석 패널 토글
   */
  function toggleSeoPanel() {
    const existingPanel = document.getElementById('bb-seo-panel');
    if (existingPanel) {
      existingPanel.remove();
      return;
    }
    createSeoPanelOverlay();
  }

  /**
   * SEO 분석 패널 오버레이 생성
   */
  function createSeoPanelOverlay() {
    // 기존 패널이 있으면 제거
    const existing = document.getElementById('bb-seo-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'bb-seo-panel';
    panel.innerHTML = `
      <div class="bb-seo-panel-header">
        <span class="bb-seo-panel-title">📊 SEO 분석</span>
        <button class="bb-seo-panel-close" id="bbSeoPanelClose">✕</button>
      </div>
      <div class="bb-seo-panel-content" id="bbSeoPanelContent">
        <div class="bb-seo-loading">분석 중...</div>
      </div>
    `;
    document.body.appendChild(panel);

    // 닫기 버튼 이벤트
    document.getElementById('bbSeoPanelClose').addEventListener('click', () => {
      panel.remove();
    });

    // 애니메이션을 위해 약간의 딜레이 후 활성화
    setTimeout(() => panel.classList.add('active'), 10);

    // SEO 분석 실행
    runSeoAnalysisForPanel();
  }

  /**
   * SEO 분석 실행하여 패널에 표시
   */
  async function runSeoAnalysisForPanel() {
    const contentEl = document.getElementById('bbSeoPanelContent');
    if (!contentEl) return;

    try {
      // 페이지 콘텐츠 추출 (BlogExtractor 사용)
      const pageData = window.BlogExtractor ? window.BlogExtractor.extract() : null;

      if (!pageData || !pageData.fullText) {
        contentEl.innerHTML = '<div class="bb-seo-error">블로그 글을 찾을 수 없습니다.<br><small>블로그 글 페이지에서 사용해주세요.</small></div>';
        return;
      }

      // 문단 구분된 content 생성 (NaverSEOAnalyzer의 getFirstParagraph가 \n으로 분리)
      const paragraphTexts = (pageData.paragraphs || [])
        .map(p => typeof p === 'string' ? p : (p.text || ''))
        .filter(t => t.length > 10);
      const contentWithBreaks = paragraphTexts.length > 0
        ? paragraphTexts.join('\n\n')
        : pageData.fullText;

      // SEO 분석용 데이터 변환
      const seoData = {
        title: pageData.title,
        content: contentWithBreaks,
        paragraphs: pageData.paragraphs,
        images: pageData.images,
        tags: pageData.tags,
        subheadings: pageData.subheadings,
        charCount: pageData.stats?.charCount || pageData.fullText.length,
        paragraphCount: pageData.stats?.paragraphCount || pageData.paragraphs?.length || 0,
        imageCount: pageData.stats?.imageCount || pageData.images?.length || 0
      };

      // 키워드 추출 (제목+본문빈도+태그 교차 분석)
      let autoKeyword = '';
      {
        const kwTitle = pageData.title || '';
        const kwText = pageData.fullText || '';
        const titleWords = kwTitle.match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
        const bodyWords = kwText.match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
        const bodyFreq = {};
        bodyWords.forEach(w => { bodyFreq[w] = (bodyFreq[w] || 0) + 1; });
        const cleanTags = (pageData.tags || []).map(t => t.replace(/^#/, '').trim()).filter(t => t.length >= 2);
        const kwStopwords = ['있는', '하는', '되는', '그리고', '하지만', '그래서', '그런데', '그러나',
          '또한', '이런', '저런', '이것', '저것', '때문', '정말', '진짜', '너무', '매우',
          '아주', '가장', '더욱', '오늘', '내일', '어제', '결국', '이렇게', '블로그'];
        const candidates = [];
        titleWords.forEach(tw => {
          if (kwStopwords.includes(tw)) return;
          const freq = bodyFreq[tw] || 0;
          const tagBonus = cleanTags.some(tag => tag.includes(tw) || tw.includes(tag)) ? 10 : 0;
          const compoundBonus = kwTitle.includes(tw) && tw.length >= 4 ? 5 : 0;
          candidates.push({ word: tw, score: freq + tagBonus + compoundBonus + tw.length });
        });
        cleanTags.forEach(tag => {
          if (tag.length >= 2 && !kwStopwords.includes(tag)) {
            const inTitle = kwTitle.includes(tag);
            const freq = bodyFreq[tag] || 0;
            candidates.push({ word: tag, score: freq + (inTitle ? 20 : 0) + tag.length });
          }
        });
        candidates.sort((a, b) => b.score - a.score);
        const seen = {};
        for (const c of candidates) {
          if (!seen[c.word]) { autoKeyword = c.word; break; }
          seen[c.word] = true;
        }
        if (!autoKeyword && titleWords.length > 0) {
          autoKeyword = titleWords.sort((a,b) => b.length - a.length)[0] || '';
        }
      }

      // SEO 분석 (NaverSEOAnalyzer 사용)
      const seoResult = typeof NaverSEOAnalyzer !== 'undefined'
        ? NaverSEOAnalyzer.analyze({
            title: seoData.title,
            content: seoData.content,
            keyword: autoKeyword,
            imageCount: seoData.imageCount,
            subheadingCount: seoData.subheadings?.length || 0,
            tagCount: seoData.tags?.length || 0,
            tags: seoData.tags || []
          })
        : calculateBasicSeoScore(seoData);

      // 키워드 목록 추출 (빈도 기반 정렬, 불용어 제거)
      const stopwords = [
        '있는', '하는', '되는', '없는', '같은', '다른', '많은', '좋은',
        '있습니다', '합니다', '됩니다', '없습니다', '같습니다', '봅니다', '줍니다',
        '있어요', '해요', '돼요', '없어요', '같아요',
        '했습니다', '됐습니다', '았습니다', '었습니다', '아닙니다', '입니다', '습니다',
        '그리고', '하지만', '그래서', '그런데', '그러나', '또한', '그래도', '그러면',
        '그렇게', '그러니', '그러므로', '따라서', '때문에', '근데', '그럼',
        '이런', '저런', '그런', '이것', '저것', '그것', '여기', '거기', '저기',
        '이거', '저거', '그거', '이게', '저게', '그게', '이건', '저건', '그건',
        '이렇게', '저렇게', '그렇게',
        '정말', '진짜', '너무', '매우', '아주', '가장', '더욱', '완전', '엄청', '되게',
        '오늘', '내일', '어제', '지금', '나중', '최근', '요즘',
        '때문', '무엇', '어떤', '모든', '것이', '수가', '것은', '것을', '정도', '경우',
        '글을', '글이', '글은', '말을', '말이', '말은',
        '있으신가요', '않았는데', '올리려고', '어느새', '하나', '있을',
        '위해', '통해', '대한', '에서', '으로', '부터', '까지', '처럼',
        '하다', '되다', '있다', '없다', '보다', '주다', '같다', '싶다',
        '하게', '하면', '하고', '해도', '해야', '해서', '하니',
        '되면', '되고', '되어', '돼서', '되니'
      ];
      let extractedKeywords = [];
      const allWords = (pageData.fullText || '').match(/[가-힣]{2,}/g) || [];
      const wordFreq = {};
      allWords.forEach(w => {
        if (stopwords.includes(w)) return;
        if (w.length === 2 && /[을를은는이가의에도로서와과만]$/.test(w)) return;
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      });
      extractedKeywords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word]) => word);

      // NaverSEOAnalyzer: details 배열 / BasicScore: factors 배열
      const detailItems = seoResult.details || seoResult.factors || [];

      // 항목별 기준 설명
      const criteriaMap = {
        '첫 문단 품질': '인사말 없이 핵심 정보를 바로 제시하는지 평가',
        '콘텐츠 구조': '목차와 소제목(3개+)으로 체계적으로 구성했는지 평가',
        'FIRE 공식': 'Fact(사실) + Interpretation(해석) + Real(실경험) + Experience(느낌)',
        '제목 최적화': '메인 키워드 포함 + 구체적 수치 + 키워드 앞배치',
        '이미지 활용': '5장 이상 이미지로 시각적 정보를 제공하는지 평가',
        '신뢰성 요소': '출처 링크, 구체적 데이터, 자격/경력 등 신뢰 근거',
        '태그': '5개 이상 태그 + 메인 키워드 태그 포함 여부',
        '감점 요소': '키워드 과다 반복(15회+), 불확실한 표현 반복 감점'
      };

      // 결과 표시
      contentEl.innerHTML = `
        <div class="bb-seo-score-section">
          <div class="bb-seo-score-circle ${getSeoScoreClass(seoResult.score)}">
            <span class="bb-seo-score-value">${seoResult.score}</span>
          </div>
          <div class="bb-seo-score-label">SEO 점수</div>
        </div>

        <div class="bb-seo-stats">
          <div class="bb-seo-stat">
            <span class="bb-seo-stat-label">글자수</span>
            <span class="bb-seo-stat-value">${seoData.charCount.toLocaleString()}자</span>
          </div>
          <div class="bb-seo-stat">
            <span class="bb-seo-stat-label">문단</span>
            <span class="bb-seo-stat-value">${seoData.paragraphCount}개</span>
          </div>
          <div class="bb-seo-stat">
            <span class="bb-seo-stat-label">이미지</span>
            <span class="bb-seo-stat-value">${seoData.imageCount}장</span>
          </div>
        </div>

        <div class="bb-seo-factors">
          <div class="bb-seo-factors-title">상세 항목</div>
          ${detailItems.map(d => {
            const name = d.item || d.name || '';
            const score = d.score || 0;
            const max = d.max || d.maxScore || 0;
            const status = d.status || (d.pass === true ? 'good' : 'bad');
            const icon = status === 'good' ? '✅' : (status === 'warn' ? '⚠️' : '❌');
            const scoreDisplay = score < 0 ? score : `${score}/${max}`;
            const criteria = criteriaMap[name] || '';
            return `
            <div class="bb-seo-factor-wrap">
              <div class="bb-seo-factor ${status === 'good' ? 'pass' : (status === 'warn' ? 'warn' : 'fail')}">
                <span class="bb-seo-factor-icon">${icon}</span>
                <span class="bb-seo-factor-name">${name}</span>
                ${criteria ? `<span class="bb-seo-factor-info" title="기준 설명">ℹ</span>` : ''}
                <span class="bb-seo-factor-score">${scoreDisplay}</span>
              </div>
              ${criteria ? `<div class="bb-seo-factor-criteria">${criteria}</div>` : ''}
              ${d.hint ? `<div class="bb-seo-factor-hint">${d.hint}</div>` : ''}
            </div>`;
          }).join('')}
        </div>

        ${extractedKeywords.length > 0 ? `
        <div class="bb-seo-keywords">
          <div class="bb-seo-keywords-title">주요 키워드</div>
          <div class="bb-seo-keyword-tags">
            ${extractedKeywords.map(kw =>
              `<span class="bb-seo-keyword-tag">${kw}</span>`
            ).join('')}
          </div>
        </div>
        ` : ''}

        ${pageData.tags && pageData.tags.length > 0 ? `
        <div class="bb-seo-keywords">
          <div class="bb-seo-keywords-title">원본 태그</div>
          <div class="bb-seo-keyword-tags">
            ${pageData.tags.map(tag =>
              `<span class="bb-seo-keyword-tag">#${tag}</span>`
            ).join('')}
          </div>
        </div>
        ` : ''}
      `;

      // ℹ 아이콘 클릭 이벤트 (이벤트 위임)
      contentEl.addEventListener('click', function(e) {
        const infoBtn = e.target.closest('.bb-seo-factor-info');
        if (!infoBtn) return;
        const wrap = infoBtn.closest('.bb-seo-factor-wrap');
        if (!wrap) return;
        const criteria = wrap.querySelector('.bb-seo-factor-criteria');
        if (criteria) criteria.classList.toggle('show');
      });
    } catch (error) {
      console.error('SEO 분석 오류:', error);
      contentEl.innerHTML = '<div class="bb-seo-error">분석 중 오류가 발생했습니다.<br><small>' + error.message + '</small></div>';
    }
  }

  /**
   * 기본 SEO 점수 계산 (analyzeNaverSEO가 없을 경우)
   */
  function calculateBasicSeoScore(data) {
    const factors = [];
    let totalScore = 0;

    // 글자수 (1500자 이상)
    const lengthPass = data.charCount >= 1500;
    const lengthScore = lengthPass ? 20 : Math.floor(data.charCount / 1500 * 20);
    factors.push({ name: '글 길이 (1500자+)', pass: lengthPass, score: lengthScore, maxScore: 20 });
    totalScore += lengthScore;

    // 이미지 (3장 이상)
    const imagePass = data.imageCount >= 3;
    const imageScore = imagePass ? 15 : Math.floor(data.imageCount / 3 * 15);
    factors.push({ name: '이미지 (3장+)', pass: imagePass, score: imageScore, maxScore: 15 });
    totalScore += imageScore;

    // 소제목 (2개 이상)
    const subheadingCount = data.subheadings?.length || 0;
    const subheadingPass = subheadingCount >= 2;
    const subheadingScore = subheadingPass ? 10 : Math.floor(subheadingCount / 2 * 10);
    factors.push({ name: '소제목 (2개+)', pass: subheadingPass, score: subheadingScore, maxScore: 10 });
    totalScore += subheadingScore;

    // 태그 (5개 이상)
    const tagCount = data.tags?.length || 0;
    const tagPass = tagCount >= 5;
    const tagScore = tagPass ? 10 : Math.floor(tagCount / 5 * 10);
    factors.push({ name: '태그 (5개+)', pass: tagPass, score: tagScore, maxScore: 10 });
    totalScore += tagScore;

    // 문단 (5개 이상)
    const paragraphPass = data.paragraphCount >= 5;
    const paragraphScore = paragraphPass ? 10 : Math.floor(data.paragraphCount / 5 * 10);
    factors.push({ name: '문단 구분 (5개+)', pass: paragraphPass, score: paragraphScore, maxScore: 10 });
    totalScore += paragraphScore;

    // 제목 길이 (10-70자)
    const titleLength = data.title?.length || 0;
    const titlePass = titleLength >= 10 && titleLength <= 70;
    const titleScore = titlePass ? 15 : (titleLength > 0 ? 7 : 0);
    factors.push({ name: '제목 길이 (10-70자)', pass: titlePass, score: titleScore, maxScore: 15 });
    totalScore += titleScore;

    return { score: Math.min(totalScore, 100), factors };
  }

  function getSeoScoreClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  // ==================== 초기화 ====================
  function init() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    const href = window.location.href;

    const isNaverBlog = hostname.includes('naver.com') &&
      (pathname.includes('blog') || pathname.includes('Post') || hostname.includes('blog'));

    if (isNaverBlog) {
      const isWritePage = pathname.includes('PostWrite') ||
          pathname.includes('postwrite') ||
          pathname.includes('PostWriteForm') ||
          href.includes('editor') ||
          href.includes('Write') ||
          href.includes('write') ||
          href.includes('actionType=write');

      if (isWritePage) {
        console.log('[블로그부스터] 글쓰기 페이지 감지:', pathname);
        setTimeout(() => {
          createAnalysisSidebar();
        }, 2000);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
