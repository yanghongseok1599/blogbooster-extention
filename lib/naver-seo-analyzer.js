/**
 * 네이버 블로그 SEO 분석기 v2.0
 *
 * 네이버 통합검색 최신 정책에 맞춘 SEO 점수 측정 엔진
 * - 키워드 반복 횟수 중심에서 콘텐츠 품질 + 사용자 경험 중심으로 전환
 * - FIRE 공식 (Fact + Interpretation + Real + Experience) 적용
 * - E-E-A-T (경험, 전문성, 권위성, 신뢰성) 강화
 *
 * 총점: 100점
 * - 첫 문단 품질: 20점
 * - 콘텐츠 구조: 20점
 * - FIRE 공식: 20점
 * - 제목 최적화: 15점
 * - 이미지 활용: 10점
 * - 신뢰성 요소: 10점
 * - 태그: 5점
 */

const NaverSEOAnalyzer = (function() {
  'use strict';

  // ==================== 유틸리티 함수 ====================

  function levenshteinDistance(str1, str2) {
    const m = str1.length, n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j - 1] + 1, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
        }
      }
    }
    return dp[m][n];
  }

  function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase().replace(/\s/g, '');
    const s2 = str2.toLowerCase().replace(/\s/g, '');
    if (s1 === s2) return 100;
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 100;
    return Math.round((1 - levenshteinDistance(s1, s2) / maxLen) * 100);
  }

  function getFirstParagraph(content) {
    const paragraphs = content.split(/\n\n|\n/).filter(p => p.trim().length > 10);
    return paragraphs[0] || '';
  }

  // ==================== 1. 첫 문단 품질 분석 (20점) ====================

  function analyzeFirstParagraph(content, title) {
    let score = 20;
    let status = 'good';
    let hint = '';
    const issues = [];

    const firstPara = getFirstParagraph(content);
    if (!firstPara) {
      return { score: 0, max: 20, status: 'bad', hint: '본문 없음', issues: [] };
    }

    // 나쁜 시작 패턴 체크 (-8점)
    const badStarts = [
      '안녕하세요', '오늘은', '여러분', '안녕', '반갑습니다',
      '오늘도', '안녕하세용', '하이', '안뇽', '헬로우',
      '요즘', '날씨가', '주말에', '오랜만에'
    ];

    const trimmedFirst = firstPara.trim();
    const hasBadStart = badStarts.some(s => trimmedFirst.startsWith(s));
    if (hasBadStart) {
      score -= 8;
      issues.push('인사말 시작 (-8)');
    }

    // 제목 복붙 체크 (-10점)
    if (title) {
      const firstSentence = trimmedFirst.split(/[.?!]/)[0] || '';
      const similarity = calculateSimilarity(title, firstSentence);
      if (similarity >= 80) {
        score -= 10;
        issues.push(`제목 복붙 ${similarity}% (-10)`);
      }
    }

    // 핵심 정보 체크 (-5점)
    const concretePatterns = [
      /\d+[개대평명원시간분초%년월일주회층]/,
      /[\d,]+원/,
      /[\d.]+km|[\d.]+m|[\d.]+kg/,
      /\d+층|\d+호/,
      /\d+:\d+/,
    ];
    const resultKeywords = /(결과|정리|비교|추천|핵심|중요|필수|가격|위치|시간|요약|결론)/;
    const hasConcreteInfo = concretePatterns.some(p => p.test(firstPara));
    const hasResultWord = resultKeywords.test(firstPara);

    if (!hasConcreteInfo && !hasResultWord) {
      score -= 5;
      issues.push('핵심정보 부족 (-5)');
    }

    score = Math.max(0, score);

    if (score >= 18) {
      status = 'good';
      hint = '핵심 즉시 제시';
    } else if (score >= 12) {
      status = 'warn';
      hint = issues.join(', ');
    } else {
      status = 'bad';
      hint = issues.join(', ') || '개선 필요';
    }

    return { score, max: 20, status, hint, issues };
  }

  // ==================== 2. 콘텐츠 구조 분석 (20점) ====================

  function analyzeContentStructure(content, subheadingCount = 0) {
    let score = 0;
    let status = 'bad';
    let hint = '';
    const details = {};

    // 목차 존재 여부
    const tocPatterns = [
      /(목차|차례|순서|Contents|INDEX)/i,
      /[①②③④⑤⑥⑦⑧⑨⑩]/,
      /^\s*[1-9]\./m,
      /^\s*[1-9]\)/m,
    ];
    const hasTableOfContents = tocPatterns.some(p => p.test(content.slice(0, 1000)));
    details.hasTableOfContents = hasTableOfContents;

    // Q&A 섹션 체크
    const qnaPatterns = /(Q\s*[&:.]?\s*A|자주\s*묻는|FAQ|Q\.|A\.|질문과\s*답변)/i;
    const hasQnA = qnaPatterns.test(content);
    details.hasQnA = hasQnA;
    details.subheadingCount = subheadingCount;

    // 점수 계산
    if (hasTableOfContents && subheadingCount >= 3) {
      score = 20;
      status = 'good';
      hint = `목차+소제목 ${subheadingCount}개`;
    } else if (subheadingCount >= 2) {
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
      hint += ' +Q&A';
    }

    return { score, max: 20, status, hint, details };
  }

  // ==================== 3. FIRE 공식 분석 (20점) ====================

  function analyzeFIRE(content) {
    let score = 0;
    const elements = [];
    let status = 'bad';
    let hint = '';

    // F (Fact): 수치, 단위, 스펙
    const factPatterns = [
      /\d+[개대평명원시간분초%년월일주회층호]/,
      /[\d,]+원/,
      /[\d.]+km|[\d.]+m²|[\d.]+kg|[\d.]+cm/,
      /\d+인분|\d+인용/,
      /평점\s*[\d.]+/,
    ];
    if (factPatterns.some(p => p.test(content))) {
      score += 5;
      elements.push('F');
    }

    // I (Interpretation): 이유/해석
    const interpretationPatterns = [
      /(덕분에|때문에|그래서|수\s*있|효과|장점|단점)/,
      /(이유|결과적으로|따라서|그러므로)/,
      /(비교하면|대비|반면|차이점)/,
    ];
    if (interpretationPatterns.some(p => p.test(content))) {
      score += 5;
      elements.push('I');
    }

    // R (Real): 직접 경험
    const realPatterns = [
      /(직접|실제로|개월간|동안|이용하며)/,
      /(다녀|가봤|써봤|먹어봤|체험|경험)/,
      /(방문했|구매했|결제했|예약했)/,
    ];
    if (realPatterns.some(p => p.test(content))) {
      score += 5;
      elements.push('R');
    }

    // E (Experience): 느낌/결과
    const experiencePatterns = [
      /(느꼈|좋았|편했|만족|추천|아쉬웠)/,
      /(불편|최고|괜찮|별로|솔직히)/,
      /(기대\s*이상|기대\s*이하|생각보다)/,
    ];
    if (experiencePatterns.some(p => p.test(content))) {
      score += 5;
      elements.push('E');
    }

    // 추상적 표현만 있는 경우 감점
    if (/(좋아요|추천해요|괜찮아요|맛있어요)/.test(content) && elements.length < 2) {
      score = Math.max(0, score - 3);
    }

    if (elements.length === 4) {
      status = 'good';
      hint = 'FIRE 완벽 적용';
    } else if (elements.length >= 3) {
      status = 'warn';
      const missing = ['F', 'I', 'R', 'E'].filter(e => !elements.includes(e));
      hint = `${elements.join('+')} (${missing.join('')} 부족)`;
    } else if (elements.length >= 1) {
      status = 'warn';
      hint = `${elements.join('+')}만 있음`;
    } else {
      status = 'bad';
      hint = '구체적 경험 추가 필요';
    }

    return { score, max: 20, status, hint, elements };
  }

  // ==================== 4. 제목 최적화 분석 (15점) ====================

  function analyzeTitle(title, keyword) {
    let score = 0;
    let status = 'bad';
    let hint = '';
    const details = {};

    if (!title) {
      return { score: 0, max: 15, status: 'none', hint: '제목 입력 필요', details: {} };
    }

    const hasKeyword = keyword && title.toLowerCase().includes(keyword.toLowerCase());
    details.hasKeyword = hasKeyword;

    const numberPatterns = [
      /\d+[개대평명원시간분%년월일회층]/,
      /[\d,]+원/,
      /[\d.]+kg|[\d.]+km/,
      /\d+가지|\d+곳|\d+선/,
    ];
    const hasConcreteNumber = numberPatterns.some(p => p.test(title));
    details.hasConcreteNumber = hasConcreteNumber;

    let keywordPosition = 'none';
    if (hasKeyword && keyword) {
      const pos = title.toLowerCase().indexOf(keyword.toLowerCase());
      keywordPosition = pos <= title.length / 3 ? 'front' : 'back';
    }
    details.keywordPosition = keywordPosition;

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
      hint = '수치 추가 권장';
    } else if (hasKeyword) {
      score = 7;
      status = 'warn';
      hint = '수치+앞배치 권장';
    } else if (keyword) {
      score = 0;
      status = 'bad';
      hint = `키워드 "${keyword}" 미포함`;
    } else {
      score = 5;
      status = 'warn';
      hint = '키워드 설정 필요';
    }

    return { score, max: 15, status, hint, details };
  }

  // ==================== 5. 이미지 활용 분석 (10점) ====================

  function analyzeImages(imageCount) {
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

  // ==================== 6. 신뢰성 요소 분석 (10점) ====================

  function analyzeCredibility(content) {
    let score = 0;
    const elements = [];
    let status = 'bad';
    let hint = '';
    const details = {};

    // 외부 출처 링크
    const sourcePatterns = /https?:\/\/[^\s]+|출처\s*:|참고\s*:|참조\s*:/gi;
    const linkCount = (content.match(sourcePatterns) || []).length;
    details.linkCount = linkCount;

    if (linkCount >= 2) {
      score += 4;
      elements.push(`출처 ${linkCount}개`);
    } else if (linkCount >= 1) {
      score += 2;
      elements.push(`출처 ${linkCount}개`);
    }

    // 구체적 수치 데이터
    const dataPatterns = [
      /\d+년\s*(경력|운영|역사)/,
      /회원\s*\d+|고객\s*\d+/,
      /평점\s*[\d.]+|별점\s*[\d.]+/,
      /\d+평|\d+㎡/,
    ];
    if (dataPatterns.some(p => p.test(content))) {
      score += 3;
      elements.push('데이터');
      details.hasData = true;
    }

    // 자격/경력 언급
    const credentialPatterns = [
      /(자격증|수료증|전문가|인증)/,
      /경력\s*\d+년/,
      /(지도사|트레이너|코치|강사|대표|원장)/,
    ];
    if (credentialPatterns.some(p => p.test(content))) {
      score += 3;
      elements.push('자격/경력');
      details.hasCredentials = true;
    }

    // 불확실한 표현 감점
    const uncertainCount = (content.match(/(것\s*같아요|일\s*수도|아마도|글쎄요|모르겠)/g) || []).length;
    details.uncertainCount = uncertainCount;
    if (uncertainCount >= 3) {
      score = Math.max(0, score - 3);
      elements.push('불확실 多 (-3)');
    }

    score = Math.min(10, score);

    if (score >= 8) {
      status = 'good';
      hint = elements.filter(e => !e.includes('불확실')).slice(0, 2).join('+');
    } else if (score >= 4) {
      status = 'warn';
      hint = elements.length > 0 ? elements.join(', ') : '출처/데이터 추가 권장';
    } else {
      status = 'bad';
      hint = '신뢰성 요소 부족';
    }

    return { score, max: 10, status, hint, elements, details };
  }

  // ==================== 7. 태그 분석 (5점) ====================

  function analyzeTags(tagCount, keyword = '', tags = []) {
    let score = 0;
    let status = 'bad';
    let hint = '';

    let hasMainKeyword = false;
    if (keyword && tags.length > 0) {
      hasMainKeyword = tags.some(tag =>
        tag.toLowerCase().includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(tag.toLowerCase())
      );
    }

    if (tagCount >= 5) {
      score = 5;
      status = 'good';
      hint = `${tagCount}개` + (hasMainKeyword ? '+메인키워드' : '');
    } else if (tagCount >= 3) {
      score = 3;
      status = 'warn';
      hint = `${tagCount}개 (5개 권장)`;
    } else if (tagCount >= 1) {
      score = 1;
      status = 'warn';
      hint = `${tagCount}개 (태그 추가)`;
    } else {
      score = 0;
      status = 'bad';
      hint = '태그 추가 필요';
    }

    return { score, max: 5, status, hint, tagCount };
  }

  // ==================== 8. 감점 요소 분석 ====================

  function analyzePenalties(content) {
    const penalties = [];
    let totalPenalty = 0;

    // 키워드 과다 반복 (15회 이상): -5점
    const words = content.match(/[가-힣]{2,}/g) || [];
    const wordFreq = {};
    words.forEach(w => wordFreq[w] = (wordFreq[w] || 0) + 1);

    const overused = Object.entries(wordFreq)
      .filter(([word, count]) => count >= 15 && word.length >= 2)
      .map(([word, count]) => `"${word}"(${count}회)`);

    if (overused.length > 0) {
      penalties.push({ reason: `키워드 과다: ${overused.slice(0, 2).join(', ')}`, penalty: -5 });
      totalPenalty -= 5;
    }

    // "~것 같아요" 반복 (5회 이상): -3점
    const uncertainCount = (content.match(/(것\s*같아요|것\s*같습니다|것\s*같은데)/g) || []).length;
    if (uncertainCount >= 5) {
      penalties.push({ reason: `"~것 같아요" ${uncertainCount}회 반복`, penalty: -3 });
      totalPenalty -= 3;
    }

    return { penalties, totalPenalty };
  }

  // ==================== 등급 계산 ====================

  function calculateGrade(score) {
    if (score >= 95) return 'S';
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  function getGradeDescription(grade) {
    const desc = {
      'S': '통합검색 상단 노출 가능성 높음',
      'A': '검증 기간 후 상위 노출 기대',
      'B': '중위권 노출, 개선 여지 있음',
      'C': '하위 노출, 구조 개선 필요',
      'D': '노출 어려움, 전면 수정 권장',
      'F': '재작성 필요'
    };
    return desc[grade] || '';
  }

  // ==================== 메인 분석 함수 ====================

  function analyze(data) {
    const {
      title = '',
      content = '',
      keyword = '',
      imageCount = 0,
      subheadingCount = 0,
      tagCount = 0,
      tags = []
    } = data;

    const details = [];
    let totalScore = 0;

    // 1. 첫 문단 품질 (20점)
    const firstParagraph = analyzeFirstParagraph(content, title);
    details.push({ item: '첫 문단 품질', ...firstParagraph });
    totalScore += firstParagraph.score;

    // 2. 콘텐츠 구조 (20점)
    const structure = analyzeContentStructure(content, subheadingCount);
    details.push({ item: '콘텐츠 구조', ...structure });
    totalScore += structure.score;

    // 3. FIRE 공식 (20점)
    const fire = analyzeFIRE(content);
    details.push({ item: 'FIRE 공식', ...fire });
    totalScore += fire.score;

    // 4. 제목 최적화 (15점)
    const titleAnalysis = analyzeTitle(title, keyword);
    details.push({ item: '제목 최적화', ...titleAnalysis });
    totalScore += titleAnalysis.score;

    // 5. 이미지 활용 (10점)
    const images = analyzeImages(imageCount);
    details.push({ item: '이미지 활용', ...images });
    totalScore += images.score;

    // 6. 신뢰성 요소 (10점)
    const credibility = analyzeCredibility(content);
    details.push({ item: '신뢰성 요소', ...credibility });
    totalScore += credibility.score;

    // 7. 태그 (5점)
    const tagAnalysis = analyzeTags(tagCount, keyword, tags);
    details.push({ item: '태그', ...tagAnalysis });
    totalScore += tagAnalysis.score;

    // 8. 감점 요소
    const penaltyResult = analyzePenalties(content);
    if (penaltyResult.totalPenalty < 0) {
      details.push({
        item: '감점 요소',
        score: penaltyResult.totalPenalty,
        max: 0,
        status: 'bad',
        hint: penaltyResult.penalties.map(p => p.reason).join(', '),
        penalties: penaltyResult.penalties
      });
      totalScore += penaltyResult.totalPenalty;
    }

    totalScore = Math.max(0, Math.min(100, totalScore));
    const grade = calculateGrade(totalScore);

    return {
      score: totalScore,
      maxScore: 100,
      grade,
      gradeDescription: getGradeDescription(grade),
      details,
      keyword,
      analyzedAt: new Date().toISOString(),
      version: 'v2.0'
    };
  }

  // ==================== 개선 제안 생성 ====================

  function generateSuggestions(result) {
    const suggestions = [];

    result.details.forEach(item => {
      if (item.status === 'bad' || item.status === 'warn') {
        switch (item.item) {
          case '첫 문단 품질':
            if (item.hint.includes('인사말')) {
              suggestions.push({ priority: 'high', category: '첫 문단', text: '인사말 대신 핵심 결론으로 시작하세요' });
            }
            if (item.hint.includes('복붙')) {
              suggestions.push({ priority: 'high', category: '첫 문단', text: '제목을 첫 문장에 그대로 복사하지 마세요' });
            }
            break;
          case '콘텐츠 구조':
            if (!item.details?.hasTableOfContents) {
              suggestions.push({ priority: 'medium', category: '구조', text: '글 상단에 목차를 추가하세요' });
            }
            if (item.details?.subheadingCount < 3) {
              suggestions.push({ priority: 'medium', category: '구조', text: '소제목을 3개 이상 추가하세요' });
            }
            break;
          case 'FIRE 공식':
            const missing = ['F', 'I', 'R', 'E'].filter(e => !item.elements?.includes(e));
            if (missing.includes('F')) suggestions.push({ priority: 'high', category: 'FIRE', text: 'Fact: 구체적 수치/스펙 추가' });
            if (missing.includes('I')) suggestions.push({ priority: 'high', category: 'FIRE', text: 'Interpretation: 이유/해석 추가' });
            if (missing.includes('R')) suggestions.push({ priority: 'high', category: 'FIRE', text: 'Real: 직접 경험 표현 추가' });
            if (missing.includes('E')) suggestions.push({ priority: 'high', category: 'FIRE', text: 'Experience: 느낌/결과 추가' });
            break;
          case '제목 최적화':
            if (!item.details?.hasKeyword) {
              suggestions.push({ priority: 'high', category: '제목', text: '제목에 메인 키워드 포함하세요' });
            }
            if (!item.details?.hasConcreteNumber) {
              suggestions.push({ priority: 'medium', category: '제목', text: '제목에 구체적 수치 추가 (예: 3개월 후기)' });
            }
            break;
          case '이미지 활용':
            if (item.imageCount < 5) {
              suggestions.push({ priority: 'medium', category: '이미지', text: '이미지 5장 이상 추가하세요' });
            }
            break;
          case '신뢰성 요소':
            if (!item.details?.linkCount) {
              suggestions.push({ priority: 'medium', category: '신뢰성', text: '외부 출처 링크 2개 이상 추가하세요' });
            }
            break;
          case '태그':
            if (item.tagCount < 5) {
              suggestions.push({ priority: 'low', category: '태그', text: '태그 5개 이상 설정하세요' });
            }
            break;
        }
      }
    });

    const order = { high: 0, medium: 1, low: 2 };
    return suggestions.sort((a, b) => order[a.priority] - order[b.priority]);
  }

  // ==================== Public API ====================

  return {
    analyze,
    generateSuggestions,
    calculateGrade,
    getGradeDescription,
    analyzeFirstParagraph,
    analyzeContentStructure,
    analyzeFIRE,
    analyzeTitle,
    analyzeImages,
    analyzeCredibility,
    analyzeTags,
    analyzePenalties,
    calculateSimilarity,
    version: 'v2.0'
  };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NaverSEOAnalyzer;
} else if (typeof window !== 'undefined') {
  window.NaverSEOAnalyzer = NaverSEOAnalyzer;
}
