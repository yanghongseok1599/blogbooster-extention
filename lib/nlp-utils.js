/**
 * 블로그 벤치마커 Pro - NLP 유틸리티
 * 한글 키워드 추출 및 텍스트 처리
 */

const NlpUtils = {
  // 한국어 불용어 (조사, 접속사, 대명사 등)
  stopwords: [
    // 조사
    '은', '는', '이', '가', '을', '를', '의', '에', '에서', '로', '으로', '와', '과', '도', '만', '까지', '부터',
    // 접속사
    '그리고', '그러나', '하지만', '그래서', '따라서', '그런데', '그러므로', '또한', '및', '혹은', '또는',
    // 대명사
    '나', '너', '우리', '저', '그', '그녀', '이것', '저것', '그것', '여기', '저기', '거기',
    // 지시사
    '이런', '저런', '그런', '이렇게', '저렇게', '그렇게',
    // 시간 관련
    '오늘', '내일', '어제', '지금', '언제', '항상', '매일', '때', '후', '전',
    // 일반 동사/형용사 어미
    '있는', '하는', '되는', '있습니다', '합니다', '됩니다', '했습니다', '있었습니다',
    '해요', '예요', '이에요', '네요', '죠', '거든요', '잖아요',
    // 기타
    '것', '수', '등', '때문', '위해', '대해', '통해', '경우', '점', '분', '개', '번'
  ],

  // 명사 추출용 정규식 패턴
  nounPatterns: [
    /[가-힣]+(?:님|씨|분|들)/g,  // 사람 관련
    /[가-힣]+(?:점|관|장|원|실)/g,  // 장소 관련
    /[가-힣]+(?:음식|요리|메뉴)/g,  // 음식 관련
    /[가-힣]+(?:여행|관광|투어)/g,  // 여행 관련
  ],

  /**
   * 텍스트에서 명사 추출
   */
  extractNouns(text) {
    if (!text || typeof text !== 'string') return [];

    // 특수문자 및 숫자 제거 (한글만 유지)
    const cleanText = text.replace(/[^\s가-힣]/g, ' ');

    // 공백 기준 분리
    const words = cleanText.split(/\s+/).filter(w => w.length >= 2);

    // 불용어 제거 및 필터링
    const filtered = words.filter(word => {
      // 불용어 체크
      if (this.stopwords.includes(word)) return false;

      // 2글자 이상
      if (word.length < 2) return false;

      // 동사/형용사 어미로 끝나는 단어 제외
      const verbEndings = ['하다', '되다', '이다', '있다', '없다', '하고', '되고', '하며', '되며'];
      if (verbEndings.some(e => word.endsWith(e))) return false;

      return true;
    });

    // 어미 제거하여 어간 추출
    const stemmed = filtered.map(word => this.stemWord(word));

    // 중복 제거
    return [...new Set(stemmed)].filter(w => w.length >= 2);
  },

  /**
   * 간단한 어간 추출 (어미 제거)
   */
  stemWord(word) {
    // 일반적인 동사/형용사 어미 패턴
    const endings = [
      '입니다', '습니다', '됩니다', '았습니다', '었습니다',
      '해요', '예요', '이에요', '네요', '죠', '거든요',
      '하는', '되는', '있는', '없는',
      '했던', '됐던', '있었던',
      '하게', '되게', '있게',
      '하면', '되면', '있으면',
      '해서', '되서', '있어서',
      '한다', '된다', '있다', '없다'
    ];

    let result = word;
    for (const ending of endings) {
      if (word.endsWith(ending) && word.length > ending.length) {
        result = word.slice(0, -ending.length);
        break;
      }
    }

    // 최소 2글자 유지
    return result.length >= 2 ? result : word;
  },

  /**
   * 키워드 빈도 계산
   */
  calculateFrequency(words) {
    const freq = {};
    words.forEach(word => {
      freq[word] = (freq[word] || 0) + 1;
    });
    return freq;
  },

  /**
   * 상위 N개 키워드 추출
   */
  getTopKeywords(text, n = 10) {
    const nouns = this.extractNouns(text);
    const freq = this.calculateFrequency(nouns);

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([word, count]) => ({ word, count }));
  },

  /**
   * 키워드 밀도 계산
   */
  calculateDensity(text, keyword) {
    if (!text || !keyword) return 0;

    const totalWords = text.split(/\s+/).length;
    const keywordCount = (text.match(new RegExp(keyword, 'gi')) || []).length;

    return totalWords > 0 ? (keywordCount / totalWords * 100) : 0;
  },

  /**
   * 문장 분리
   */
  splitSentences(text) {
    if (!text) return [];

    // 마침표, 물음표, 느낌표 기준 분리
    return text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
  },

  /**
   * 문장 유형 판별
   */
  getSentenceType(sentence) {
    const trimmed = sentence.trim();
    if (trimmed.endsWith('?')) return 'question';
    if (trimmed.endsWith('!')) return 'exclamation';
    return 'statement';
  },

  /**
   * N-gram 추출 (연속 단어 조합)
   */
  extractNgrams(text, n = 2) {
    const words = this.extractNouns(text);
    const ngrams = [];

    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '));
    }

    return ngrams;
  },

  /**
   * 문장 길이 통계
   */
  getSentenceStats(text) {
    const sentences = this.splitSentences(text);

    if (sentences.length === 0) {
      return { avg: 0, min: 0, max: 0, total: 0 };
    }

    const lengths = sentences.map(s => s.length);

    return {
      avg: Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length),
      min: Math.min(...lengths),
      max: Math.max(...lengths),
      total: sentences.length
    };
  },

  /**
   * 이모지 추출
   */
  extractEmojis(text) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    return text.match(emojiRegex) || [];
  },

  /**
   * 텍스트 정제
   */
  cleanText(text) {
    if (!text) return '';

    return text
      .replace(/\s+/g, ' ')  // 다중 공백 제거
      .replace(/[\r\n]+/g, ' ')  // 줄바꿈 제거
      .trim();
  },

  /**
   * 한글 비율 계산
   */
  getKoreanRatio(text) {
    if (!text) return 0;

    const korean = (text.match(/[가-힣]/g) || []).length;
    const total = text.replace(/\s/g, '').length;

    return total > 0 ? (korean / total * 100) : 0;
  }
};

// 전역 노출
if (typeof window !== 'undefined') {
  window.NlpUtils = NlpUtils;
}

// Node.js 환경에서도 사용 가능하도록
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NlpUtils;
}
