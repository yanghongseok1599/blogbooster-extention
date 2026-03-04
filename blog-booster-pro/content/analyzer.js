/**
 * 블로그 벤치마커 Pro - 분석기
 * 구조/키워드/스타일 분석
 */

const BlogAnalyzer = {
  /**
   * 전체 분석 실행
   */
  analyze(extractedData) {
    if (!extractedData) {
      return null;
    }

    const structure = this.analyzeStructure(extractedData);
    const keywords = this.analyzeKeywords(extractedData);
    const style = this.analyzeStyle(extractedData);
    const seo = this.analyzeSEO(extractedData, keywords);

    return {
      structure: structure,
      keywords: keywords,
      style: style,
      seo: seo,
      summary: this.generateSummary(structure, keywords, style, seo),
      analyzedAt: new Date().toISOString()
    };
  },

  /**
   * 구조 분석 (서론/본론/결론)
   */
  analyzeStructure(data) {
    const paragraphs = data.paragraphs || [];
    const totalParagraphs = paragraphs.length;

    if (totalParagraphs === 0) {
      return {
        intro: { percent: 0, paragraphs: [] },
        body: { percent: 0, paragraphs: [] },
        conclusion: { percent: 0, paragraphs: [] }
      };
    }

    // 문단 위치 기반 분류
    const introEnd = Math.max(1, Math.floor(totalParagraphs * 0.15));
    const conclusionStart = Math.floor(totalParagraphs * 0.85);

    const intro = paragraphs.slice(0, introEnd);
    const body = paragraphs.slice(introEnd, conclusionStart);
    const conclusion = paragraphs.slice(conclusionStart);

    // 문단 역할 태깅
    const taggedParagraphs = paragraphs.map((p, index) => {
      let role = 'body';
      if (index < introEnd) {
        role = this.detectIntroRole(p.text);
      } else if (index >= conclusionStart) {
        role = this.detectConclusionRole(p.text);
      } else {
        role = this.detectBodyRole(p.text);
      }
      return { ...p, role: role, index: index };
    });

    // 이미지 배치 패턴
    const imagePositions = this.analyzeImagePositions(data.images, totalParagraphs, data.fullText.length);

    // 평균 문단 길이 및 문장 길이
    const avgParagraphLength = Math.round(
      paragraphs.reduce((sum, p) => sum + p.length, 0) / totalParagraphs
    );

    const sentences = data.fullText.split(/[.!?]+/).filter(s => s.trim().length > 5);
    const avgSentenceLength = sentences.length > 0
      ? Math.round(sentences.reduce((sum, s) => sum + s.trim().length, 0) / sentences.length)
      : 0;

    return {
      intro: {
        percent: Math.round((intro.length / totalParagraphs) * 100),
        paragraphs: intro,
        charCount: intro.reduce((sum, p) => sum + p.length, 0),
        style: this.detectIntroStyle(intro)
      },
      body: {
        percent: Math.round((body.length / totalParagraphs) * 100),
        paragraphs: body,
        sectionCount: data.subheadings.length || Math.ceil(body.length / 3),
        charCount: body.reduce((sum, p) => sum + p.length, 0)
      },
      conclusion: {
        percent: Math.round((conclusion.length / totalParagraphs) * 100),
        paragraphs: conclusion,
        charCount: conclusion.reduce((sum, p) => sum + p.length, 0),
        style: this.detectConclusionStyle(conclusion)
      },
      taggedParagraphs: taggedParagraphs,
      imagePositions: imagePositions,
      avgParagraphLength: avgParagraphLength,
      avgSentenceLength: avgSentenceLength,
      subheadings: data.subheadings
    };
  },

  /**
   * 서론 역할 감지
   */
  detectIntroRole(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('안녕') || lowerText.includes('반갑') || lowerText.includes('오늘은')) {
      return 'greeting';
    }
    if (text.includes('?')) {
      return 'question_hook';
    }
    return 'intro';
  },

  /**
   * 본론 역할 감지
   */
  detectBodyRole(text) {
    const patterns = {
      explanation: ['입니다', '됩니다', '있습니다', '이란', '이라고'],
      example: ['예를 들', '예시', '처럼', '같이', '경우'],
      list: ['첫째', '둘째', '1.', '2.', '먼저', '다음으로'],
      tip: ['팁', 'tip', '꿀팁', '참고', '주의']
    };

    for (const [role, keywords] of Object.entries(patterns)) {
      if (keywords.some(kw => text.includes(kw))) {
        return role;
      }
    }
    return 'description';
  },

  /**
   * 결론 역할 감지
   */
  detectConclusionRole(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('마무리') || lowerText.includes('정리하') || lowerText.includes('요약')) {
      return 'summary';
    }
    if (lowerText.includes('추천') || lowerText.includes('드립니다') || lowerText.includes('해보세요')) {
      return 'recommendation';
    }
    if (lowerText.includes('감사') || lowerText.includes('읽어주셔') || lowerText.includes('다음에')) {
      return 'closing';
    }
    return 'conclusion';
  },

  /**
   * 서론 스타일 감지
   */
  detectIntroStyle(introParagraphs) {
    if (introParagraphs.length === 0) return 'unknown';
    const text = introParagraphs.map(p => p.text).join(' ');

    if (text.includes('?')) return 'question_opening';
    if (text.includes('!')) return 'exclamation_opening';
    if (text.includes('안녕') || text.includes('반갑')) return 'greeting_opening';
    return 'statement_opening';
  },

  /**
   * 결론 스타일 감지
   */
  detectConclusionStyle(conclusionParagraphs) {
    if (conclusionParagraphs.length === 0) return 'unknown';
    const text = conclusionParagraphs.map(p => p.text).join(' ');

    if (text.includes('추천') || text.includes('해보세요')) return 'recommendation';
    if (text.includes('요약') || text.includes('정리')) return 'summary';
    if (text.includes('감사') || text.includes('다음에')) return 'closing_remarks';
    return 'general_conclusion';
  },

  /**
   * 이미지 위치 패턴 분석
   */
  analyzeImagePositions(images, paragraphCount, textLength) {
    if (!images || images.length === 0) {
      return { pattern: 'no_images', positions: [] };
    }

    const positions = [];
    const interval = textLength / (images.length + 1);

    images.forEach((img, i) => {
      const position = Math.round((i / images.length) * 100);
      positions.push(position);
    });

    let pattern = 'scattered';
    if (positions.every(p => p < 30)) pattern = 'top_heavy';
    else if (positions.every(p => p > 70)) pattern = 'bottom_heavy';
    else if (positions.length >= 3 && this.isEvenlyDistributed(positions)) pattern = 'evenly_distributed';

    return {
      pattern: pattern,
      positions: positions,
      imageTextRatio: images.length / (paragraphCount || 1),
      avgImagesPerSection: (images.length / Math.max(1, paragraphCount / 3)).toFixed(1)
    };
  },

  /**
   * 균등 분포 확인
   */
  isEvenlyDistributed(positions) {
    if (positions.length < 2) return true;
    const sorted = [...positions].sort((a, b) => a - b);
    const diffs = [];
    for (let i = 1; i < sorted.length; i++) {
      diffs.push(sorted[i] - sorted[i - 1]);
    }
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    return diffs.every(d => Math.abs(d - avgDiff) < 20);
  },

  /**
   * 키워드 분석
   */
  analyzeKeywords(data) {
    const title = data.title || '';
    const text = data.fullText || '';
    const tags = data.tags || [];

    // NlpUtils 사용 (lib/nlp-utils.js에서 정의)
    const titleKeywords = typeof NlpUtils !== 'undefined'
      ? NlpUtils.extractNouns(title)
      : this.simpleExtractNouns(title);

    const textKeywords = typeof NlpUtils !== 'undefined'
      ? NlpUtils.extractNouns(text)
      : this.simpleExtractNouns(text);

    // 키워드 빈도 계산
    const keywordFreq = {};
    [...titleKeywords, ...textKeywords].forEach(kw => {
      keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
    });

    // 제목 키워드에 가중치 부여
    titleKeywords.forEach(kw => {
      keywordFreq[kw] = (keywordFreq[kw] || 0) * 2;
    });

    // 상위 키워드 추출
    const sortedKeywords = Object.entries(keywordFreq)
      .sort((a, b) => b[1] - a[1])
      .map(([keyword, freq]) => ({ keyword, freq }));

    // 메인 키워드: 제목+본문빈도+태그 교차 분석
    let mainKeyword = '';
    {
      const titleWords = title.match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
      const bodyWords = text.match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
      const bodyFreq = {};
      bodyWords.forEach(w => { bodyFreq[w] = (bodyFreq[w] || 0) + 1; });
      const cleanTags = tags.map(t => t.replace(/^#/, '').trim()).filter(t => t.length >= 2);

      const kwStopwords = ['있는', '하는', '되는', '그리고', '하지만', '그래서', '그런데', '그러나',
        '또한', '이런', '저런', '이것', '저것', '때문', '정말', '진짜', '너무', '매우',
        '아주', '가장', '더욱', '오늘', '내일', '어제', '결국', '이렇게', '블로그'];

      const candidates = [];
      titleWords.forEach(tw => {
        if (kwStopwords.includes(tw)) return;
        const freq = bodyFreq[tw] || 0;
        const tagBonus = cleanTags.some(tag => tag.includes(tw) || tw.includes(tag)) ? 10 : 0;
        const compoundBonus = title.includes(tw) && tw.length >= 4 ? 5 : 0;
        candidates.push({ word: tw, score: freq + tagBonus + compoundBonus + tw.length });
      });
      cleanTags.forEach(tag => {
        if (tag.length >= 2 && !kwStopwords.includes(tag)) {
          const inTitle = title.includes(tag);
          const freq = bodyFreq[tag] || 0;
          candidates.push({ word: tag, score: freq + (inTitle ? 20 : 0) + tag.length });
        }
      });
      candidates.sort((a, b) => b.score - a.score);
      const seen = {};
      for (const c of candidates) {
        if (!seen[c.word]) { mainKeyword = c.word; break; }
        seen[c.word] = true;
      }
      if (!mainKeyword && sortedKeywords.length > 0) {
        mainKeyword = sortedKeywords[0].keyword;
      }
    }
    const subKeywords = sortedKeywords
      .filter(k => k.keyword !== mainKeyword)
      .slice(0, 10)
      .map(k => k.keyword);

    // 키워드 밀도 계산
    const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const totalWords = text.split(/\s+/).length;
    const mainKeywordCount = mainKeyword ? (text.match(new RegExp(escapeRe(mainKeyword), 'gi')) || []).length : 0;
    const density = totalWords > 0 ? ((mainKeywordCount / totalWords) * 100).toFixed(2) : 0;

    // 키워드 위치맵
    const positionMap = this.analyzeKeywordPositions(mainKeyword, data);

    return {
      mainKeyword: mainKeyword,
      subKeywords: subKeywords,
      allKeywords: sortedKeywords.slice(0, 20),
      density: parseFloat(density),
      positionMap: positionMap,
      tags: tags,
      titleKeywords: titleKeywords,
      totalUniqueKeywords: Object.keys(keywordFreq).length
    };
  },

  /**
   * 간단한 명사 추출 (NlpUtils 없을 때 폴백)
   */
  simpleExtractNouns(text) {
    // 2글자 이상 한글 단어 추출
    const words = text.match(/[가-힣]{2,}/g) || [];

    // 불용어 제거
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
      '하다', '되다', '있다', '없다', '보다', '주다', '같다', '싶다',
      '하게', '하면', '하고', '해도', '해야', '해서', '하니',
      '되면', '되고', '되어', '돼서', '되니'
    ];

    return words.filter(w => {
      if (stopwords.includes(w) || w.length < 2) return false;
      if (w.length === 2 && /[을를은는이가의에도로서와과만]$/.test(w)) return false;
      return true;
    });
  },

  /**
   * 키워드 위치맵 분석
   */
  analyzeKeywordPositions(mainKeyword, data) {
    if (!mainKeyword) return {};

    const positionMap = {
      title: false,
      firstParagraph: false,
      subheadings: false,
      middle: false,
      lastParagraph: false,
      tags: false
    };

    const regex = new RegExp(mainKeyword, 'i');

    // 제목
    positionMap.title = regex.test(data.title || '');

    // 첫 문단
    if (data.paragraphs && data.paragraphs.length > 0) {
      positionMap.firstParagraph = regex.test(data.paragraphs[0].text);
    }

    // 소제목
    if (data.subheadings) {
      positionMap.subheadings = data.subheadings.some(sh => regex.test(sh.text));
    }

    // 중간 부분
    if (data.paragraphs && data.paragraphs.length > 2) {
      const midStart = Math.floor(data.paragraphs.length * 0.3);
      const midEnd = Math.floor(data.paragraphs.length * 0.7);
      const midText = data.paragraphs.slice(midStart, midEnd).map(p => p.text).join(' ');
      positionMap.middle = regex.test(midText);
    }

    // 마지막 문단
    if (data.paragraphs && data.paragraphs.length > 0) {
      positionMap.lastParagraph = regex.test(data.paragraphs[data.paragraphs.length - 1].text);
    }

    // 태그
    if (data.tags) {
      positionMap.tags = data.tags.some(tag => regex.test(tag));
    }

    return positionMap;
  },

  /**
   * 글쓰기 스타일 분석
   */
  analyzeStyle(data) {
    const text = data.fullText || '';
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5);

    // 문장 유형 분류
    let statements = 0, questions = 0, exclamations = 0;
    sentences.forEach(s => {
      if (s.trim().endsWith('?')) questions++;
      else if (s.trim().endsWith('!')) exclamations++;
      else statements++;
    });

    const total = sentences.length || 1;
    const sentenceTypes = {
      statement: Math.round((statements / total) * 100),
      question: Math.round((questions / total) * 100),
      exclamation: Math.round((exclamations / total) * 100)
    };

    // 이모지 분석
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const emojis = text.match(emojiRegex) || [];
    const uniqueEmojis = [...new Set(emojis)];

    // 평균 문장 길이로 어조 판단
    const avgLength = sentences.length > 0
      ? Math.round(sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length)
      : 0;

    let tone = 'neutral';
    if (avgLength < 30) tone = 'concise';
    else if (avgLength > 60) tone = 'detailed';
    else tone = 'balanced';

    // 첫 문장 후킹 유형
    const firstSentence = sentences[0] || '';
    const hookType = this.analyzeHookType(firstSentence);

    // 문체 분석
    const writingStyle = this.detectWritingStyle(text);

    return {
      sentenceTypes: sentenceTypes,
      emoji: {
        count: emojis.length,
        unique: uniqueEmojis,
        frequency: text.length > 0 ? (emojis.length / (text.length / 100)).toFixed(2) : 0
      },
      avgSentenceLength: avgLength,
      tone: tone,
      hookType: hookType,
      writingStyle: writingStyle,
      totalSentences: sentences.length
    };
  },

  /**
   * 첫 문장 후킹 유형 분석
   */
  analyzeHookType(firstSentence) {
    if (firstSentence.includes('?')) return 'question';
    if (firstSentence.includes('!')) return 'exclamation';
    if (firstSentence.includes('안녕') || firstSentence.includes('반갑')) return 'greeting';
    if (/\d+/.test(firstSentence)) return 'statistic';
    if (firstSentence.length > 50) return 'storytelling';
    return 'direct';
  },

  /**
   * 문체 감지 (문장 끝 어미 기준)
   */
  detectWritingStyle(text) {
    // 문장 단위로 분리
    const sentences = text.split(/[.!?。]+/).filter(s => s.trim().length > 3);

    const counts = { formal: 0, casual: 0, informal: 0 };

    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (!trimmed) return;

      // 문장 끝 부분 추출 (마지막 10자)
      const ending = trimmed.slice(-10);

      // 존댓말 (합니다체) - 니다/니까로 끝나는 모든 형태
      if (/니다$|니까$/.test(ending)) {
        counts.formal += 2;
      }
      // 해요체 - 요로 끝나는 모든 형태
      else if (/요$|죠$/.test(ending)) {
        counts.casual += 2;
      }
      // 반말 (해체/해라체) - 문장 끝이 반말 어미인 경우만
      else if (/(?:해$|야$|어$|아$|지$|네$|군$|구$|는다$|ㄴ다$|란다$|했어$|했지$|같아$|싶어$|할게$|갈게$|한다$|된다$|온다$|간다$)/.test(ending)) {
        counts.informal += 2;
      }
      // 명사형 종결 (체언 종결) - 블로그에서 자주 사용
      else if (/(?:음$|임$|기$|것$|듯$)/.test(ending)) {
        // 명사형은 중립으로 처리 (카운트 안함)
      }
    });

    // 가장 많이 사용된 문체 반환
    const maxStyle = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

    // 명확한 우세가 없으면 casual (해요체)로 기본 설정
    if (maxStyle[1] === 0) {
      return 'casual';
    }

    return maxStyle[0];
  },

  /**
   * SEO 분석 - NaverSEOAnalyzer 엔진 사용
   */
  analyzeSEO(data, keywords) {
    // NaverSEOAnalyzer 엔진 사용
    if (typeof NaverSEOAnalyzer !== 'undefined') {
      // 문단 구분된 content 생성 (getFirstParagraph가 \n으로 분리)
      const paragraphTexts = (data.paragraphs || [])
        .map(p => typeof p === 'string' ? p : (p.text || ''))
        .filter(t => t.length > 10);
      const contentForSEO = paragraphTexts.length > 0
        ? paragraphTexts.join('\n\n')
        : (data.fullText || '');

      const result = NaverSEOAnalyzer.analyze({
        title: data.title || '',
        content: contentForSEO,
        keyword: keywords.mainKeyword || '',
        imageCount: data.images ? data.images.length : 0,
        subheadingCount: data.subheadings ? data.subheadings.length : 0,
        tagCount: data.tags ? data.tags.length : 0,
        tags: data.tags || []
      });

      // 기존 형식과 호환되도록 변환
      const factors = result.details.map(d => ({
        factor: d.item,
        score: d.score,
        maxScore: d.max,
        status: d.status === 'good' ? 'good' : d.status === 'warn' ? 'warning' : 'bad',
        hint: d.hint
      }));

      return {
        score: result.score,
        maxScore: 100,
        percentage: result.score,
        factors: factors,
        grade: result.grade,
        gradeDescription: result.gradeDescription,
        details: result.details,
        version: 'v2.0'
      };
    }

    // 폴백: 기존 로직
    let score = 0;
    const factors = [];

    // 제목에 메인 키워드 포함 (25점)
    if (keywords.positionMap.title) {
      score += 25;
      factors.push({ factor: 'title_keyword', score: 25, status: 'good' });
    } else {
      factors.push({ factor: 'title_keyword', score: 0, status: 'bad' });
    }

    // 키워드 밀도 (20점) - 1~3%가 적정
    if (keywords.density >= 1 && keywords.density <= 3) {
      score += 20;
      factors.push({ factor: 'keyword_density', score: 20, status: 'good' });
    } else if (keywords.density > 0) {
      score += 10;
      factors.push({ factor: 'keyword_density', score: 10, status: 'warning' });
    } else {
      factors.push({ factor: 'keyword_density', score: 0, status: 'bad' });
    }

    // 글 길이 (20점) - 1500자 이상
    if (data.fullText.length >= 1500) {
      score += 20;
      factors.push({ factor: 'content_length', score: 20, status: 'good' });
    } else if (data.fullText.length >= 800) {
      score += 10;
      factors.push({ factor: 'content_length', score: 10, status: 'warning' });
    } else {
      factors.push({ factor: 'content_length', score: 0, status: 'bad' });
    }

    // 이미지 사용 (15점)
    if (data.images && data.images.length >= 3) {
      score += 15;
      factors.push({ factor: 'images', score: 15, status: 'good' });
    } else if (data.images && data.images.length > 0) {
      score += 8;
      factors.push({ factor: 'images', score: 8, status: 'warning' });
    } else {
      factors.push({ factor: 'images', score: 0, status: 'bad' });
    }

    // 소제목 사용 (10점)
    if (data.subheadings && data.subheadings.length >= 2) {
      score += 10;
      factors.push({ factor: 'subheadings', score: 10, status: 'good' });
    } else if (data.subheadings && data.subheadings.length > 0) {
      score += 5;
      factors.push({ factor: 'subheadings', score: 5, status: 'warning' });
    } else {
      factors.push({ factor: 'subheadings', score: 0, status: 'bad' });
    }

    // 태그 사용 (10점)
    if (data.tags && data.tags.length >= 5) {
      score += 10;
      factors.push({ factor: 'tags', score: 10, status: 'good' });
    } else if (data.tags && data.tags.length > 0) {
      score += 5;
      factors.push({ factor: 'tags', score: 5, status: 'warning' });
    } else {
      factors.push({ factor: 'tags', score: 0, status: 'bad' });
    }

    return {
      score: score,
      maxScore: 100,
      percentage: score,
      factors: factors,
      grade: this.getGrade(score)
    };
  },

  /**
   * 점수 등급 반환
   */
  getGrade(score) {
    if (score >= 95) return 'S';
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  },

  /**
   * 가독성 점수 계산
   */
  calculateReadability(data, structure) {
    let score = 100;

    // 평균 문장 길이 (40자 이하가 좋음)
    if (structure.avgSentenceLength > 60) score -= 20;
    else if (structure.avgSentenceLength > 40) score -= 10;

    // 문단 길이 (200자 내외가 좋음)
    if (structure.avgParagraphLength > 400) score -= 20;
    else if (structure.avgParagraphLength > 300) score -= 10;

    // 이미지 비율
    const imageRatio = data.images.length / (data.paragraphs.length || 1);
    if (imageRatio < 0.2) score -= 10;

    // 소제목 사용
    if (data.subheadings.length < 2) score -= 15;

    return Math.max(0, Math.min(100, score));
  },

  /**
   * 요약 생성
   */
  generateSummary(structure, keywords, style, seo) {
    const benchmarkPoints = [];

    // 구조 관련 포인트
    if (structure.intro.percent > 0 && structure.intro.percent <= 20) {
      benchmarkPoints.push('적절한 서론 비율로 독자 관심 유도');
    }
    if (structure.imagePositions.pattern === 'evenly_distributed') {
      benchmarkPoints.push('이미지가 균등하게 배치되어 가독성 향상');
    }
    if (structure.subheadings.length >= 3) {
      benchmarkPoints.push('충분한 소제목으로 글 구조화');
    }

    // 키워드 관련 포인트
    if (keywords.positionMap.title && keywords.positionMap.firstParagraph) {
      benchmarkPoints.push('핵심 키워드가 제목과 첫 문단에 자연스럽게 배치');
    }
    if (keywords.density >= 1 && keywords.density <= 3) {
      benchmarkPoints.push('적정 키워드 밀도 유지');
    }

    // 스타일 관련 포인트
    if (style.hookType === 'question') {
      benchmarkPoints.push('질문형 도입부로 독자 참여 유도');
    }
    if (style.emoji.count > 0) {
      benchmarkPoints.push('이모지 활용으로 친근한 분위기 연출');
    }

    // 상위 3개만 선택
    const topPoints = benchmarkPoints.slice(0, 3);
    if (topPoints.length === 0) {
      topPoints.push('기본적인 글 구조를 갖추고 있음');
    }

    return {
      benchmarkPoints: topPoints,
      quickStats: {
        charCount: structure.intro.charCount + structure.body.charCount + structure.conclusion.charCount,
        paragraphCount: (structure.intro.paragraphs?.length || 0) +
                       (structure.body.paragraphs?.length || 0) +
                       (structure.conclusion.paragraphs?.length || 0),
        imageCount: structure.imagePositions?.positions?.length || 0,
        mainKeyword: keywords.mainKeyword,
        seoScore: seo.score,
        seoGrade: seo.grade
      }
    };
  }
};

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze') {
    try {
      const extractedData = BlogExtractor.extract();
      if (!extractedData || !extractedData.fullText || extractedData.fullText.length < 30) {
        sendResponse({ success: false, error: '본문 없음' });
        return true;
      }
      const analysis = BlogAnalyzer.analyze(extractedData);
      sendResponse({ success: true, data: { extracted: extractedData, analysis: analysis } });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // 이미 추출된 데이터를 분석만 수행
  if (request.action === 'analyzeData') {
    try {
      const analysis = BlogAnalyzer.analyze(request.extractedData);
      sendResponse({ success: true, analysis: analysis });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

// 전역 노출
window.BlogAnalyzer = BlogAnalyzer;
