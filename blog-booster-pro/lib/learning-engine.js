/**
 * 블로그 벤치마커 Pro - 학습 엔진
 * 분석된 블로그 데이터를 학습하여 점진적으로 발전하는 AI 마케터
 * Firebase 연동으로 다른 기기에서도 학습 데이터 사용 가능
 */

const LearningEngine = {
  STORAGE_KEY: 'blogLearningData',
  MAX_SAMPLES: 100, // 최대 저장 샘플 수

  /**
   * 현재 로그인된 사용자 ID 가져오기
   */
  async getCurrentUserId() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['userInfo'], (result) => {
        resolve(result.userInfo?.uid || null);
      });
    });
  },

  /**
   * 학습 데이터 초기화
   */
  getDefaultData() {
    return {
      version: 1,
      totalAnalyzed: 0,
      lastUpdated: null,

      // 구조 패턴 학습
      structure: {
        avgIntroPercent: 15,
        avgBodyPercent: 70,
        avgConclusionPercent: 15,
        avgParagraphLength: 150,
        avgSentenceLength: 35,
        avgSubheadingCount: 3,
        avgImageCount: 5,
        samples: []
      },

      // 스타일 패턴 학습
      style: {
        writingStyles: { formal: 0, casual: 0, informal: 0 },
        tones: { concise: 0, balanced: 0, detailed: 0 },
        hookTypes: { question: 0, exclamation: 0, greeting: 0, statistic: 0, storytelling: 0, direct: 0 },
        avgEmojiCount: 0,
        sentenceTypes: { statement: 0, question: 0, exclamation: 0 },
        samples: []
      },

      // 키워드 패턴 학습
      keywords: {
        avgDensity: 1.5,
        avgSubKeywordCount: 5,
        avgTagCount: 5,
        commonKeywords: {},
        samples: []
      },

      // SEO 성공 패턴
      seo: {
        avgScore: 70,
        highScoreSamples: [], // 80점 이상 샘플
        successPatterns: []
      },

      // 업종별 패턴 (자동 분류)
      industries: {}
    };
  },

  /**
   * 저장된 학습 데이터 로드 (Firebase 우선, 로컬 폴백)
   */
  async loadData() {
    const userId = await this.getCurrentUserId();

    // 로그인된 경우 Firebase에서 먼저 시도
    if (userId) {
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'loadLearningDataFromFirebase',
            userId: userId
          }, resolve);
        });

        if (response && response.success && response.data) {
          // Firebase 데이터를 로컬에도 저장
          await this.saveToLocal(response.data);
          return response.data;
        }
      } catch (error) {
        console.log('[LearningEngine] Firebase 로드 실패, 로컬 사용:', error);
      }
    }

    // 로컬 스토리지에서 로드
    return this.loadFromLocal();
  },

  /**
   * 로컬 스토리지에서 로드
   */
  async loadFromLocal() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEY], (result) => {
        if (result[this.STORAGE_KEY]) {
          resolve(result[this.STORAGE_KEY]);
        } else {
          resolve(this.getDefaultData());
        }
      });
    });
  },

  /**
   * 로컬 스토리지에 저장
   */
  async saveToLocal(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: data }, resolve);
    });
  },

  /**
   * 학습 데이터 저장 (로컬 + Firebase 동기화)
   */
  async saveData(data) {
    // 로컬에 먼저 저장
    await this.saveToLocal(data);

    // 로그인된 경우 Firebase에도 동기화
    const userId = await this.getCurrentUserId();
    if (userId) {
      try {
        chrome.runtime.sendMessage({
          action: 'saveLearningDataToFirebase',
          userId: userId,
          data: data
        });
      } catch (error) {
        console.log('[LearningEngine] Firebase 동기화 실패:', error);
      }
    }
  },

  /**
   * 새로운 분석 데이터 학습
   */
  async learn(analysisResult) {
    if (!analysisResult || !analysisResult.analysis) {
      console.log('[LearningEngine] 유효하지 않은 분석 데이터');
      return false;
    }

    const data = await this.loadData();
    const { extracted, analysis } = analysisResult;

    // 기본 정보 업데이트
    data.totalAnalyzed++;
    data.lastUpdated = new Date().toISOString();

    // 구조 학습
    this.learnStructure(data, analysis.structure);

    // 스타일 학습
    this.learnStyle(data, analysis.style);

    // 키워드 학습
    this.learnKeywords(data, analysis.keywords, extracted);

    // SEO 학습
    this.learnSEO(data, analysis.seo, analysis);

    // 업종 패턴 학습 (제목 기반 추정)
    this.learnIndustry(data, extracted.title, analysis);

    // 저장
    await this.saveData(data);

    console.log('[LearningEngine] 학습 완료. 총 분석 수:', data.totalAnalyzed);
    return true;
  },

  /**
   * 구조 패턴 학습
   */
  learnStructure(data, structure) {
    const s = data.structure;
    const n = data.totalAnalyzed;

    // 이동 평균 계산
    s.avgIntroPercent = this.movingAverage(s.avgIntroPercent, structure.intro.percent, n);
    s.avgBodyPercent = this.movingAverage(s.avgBodyPercent, structure.body.percent, n);
    s.avgConclusionPercent = this.movingAverage(s.avgConclusionPercent, structure.conclusion.percent, n);
    s.avgParagraphLength = this.movingAverage(s.avgParagraphLength, structure.avgParagraphLength, n);
    s.avgSentenceLength = this.movingAverage(s.avgSentenceLength, structure.avgSentenceLength, n);
    s.avgSubheadingCount = this.movingAverage(s.avgSubheadingCount, structure.subheadings?.length || 0, n);

    const imageCount = structure.imagePositions?.positions?.length || 0;
    s.avgImageCount = this.movingAverage(s.avgImageCount, imageCount, n);

    // 샘플 저장 (최근 20개만)
    s.samples.push({
      intro: structure.intro.percent,
      body: structure.body.percent,
      conclusion: structure.conclusion.percent,
      paragraphLength: structure.avgParagraphLength,
      subheadings: structure.subheadings?.length || 0,
      images: imageCount
    });
    if (s.samples.length > 20) s.samples.shift();
  },

  /**
   * 스타일 패턴 학습
   */
  learnStyle(data, style) {
    const st = data.style;

    // 문체 카운트
    if (style.writingStyle && st.writingStyles[style.writingStyle] !== undefined) {
      st.writingStyles[style.writingStyle]++;
    }

    // 어조 카운트
    if (style.tone && st.tones[style.tone] !== undefined) {
      st.tones[style.tone]++;
    }

    // 후킹 유형 카운트
    if (style.hookType && st.hookTypes[style.hookType] !== undefined) {
      st.hookTypes[style.hookType]++;
    }

    // 이모지 평균
    const emojiCount = style.emoji?.count || 0;
    st.avgEmojiCount = this.movingAverage(st.avgEmojiCount, emojiCount, data.totalAnalyzed);

    // 문장 유형 비율 평균
    if (style.sentenceTypes) {
      st.sentenceTypes.statement = this.movingAverage(st.sentenceTypes.statement, style.sentenceTypes.statement, data.totalAnalyzed);
      st.sentenceTypes.question = this.movingAverage(st.sentenceTypes.question, style.sentenceTypes.question, data.totalAnalyzed);
      st.sentenceTypes.exclamation = this.movingAverage(st.sentenceTypes.exclamation, style.sentenceTypes.exclamation, data.totalAnalyzed);
    }

    // 샘플 저장
    st.samples.push({
      writingStyle: style.writingStyle,
      tone: style.tone,
      hookType: style.hookType,
      emojiCount: emojiCount
    });
    if (st.samples.length > 20) st.samples.shift();
  },

  /**
   * 키워드 패턴 학습
   */
  learnKeywords(data, keywords, extracted) {
    const kw = data.keywords;
    const n = data.totalAnalyzed;

    // 밀도 평균
    kw.avgDensity = this.movingAverage(kw.avgDensity, keywords.density, n);
    kw.avgSubKeywordCount = this.movingAverage(kw.avgSubKeywordCount, keywords.subKeywords?.length || 0, n);
    kw.avgTagCount = this.movingAverage(kw.avgTagCount, extracted.tags?.length || 0, n);

    // 자주 등장하는 키워드 수집
    if (keywords.mainKeyword) {
      kw.commonKeywords[keywords.mainKeyword] = (kw.commonKeywords[keywords.mainKeyword] || 0) + 1;
    }

    // 상위 50개만 유지
    const sorted = Object.entries(kw.commonKeywords).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 50) {
      kw.commonKeywords = Object.fromEntries(sorted.slice(0, 50));
    }
  },

  /**
   * SEO 패턴 학습
   */
  learnSEO(data, seo, analysis) {
    const se = data.seo;
    const n = data.totalAnalyzed;

    // 평균 점수
    se.avgScore = this.movingAverage(se.avgScore, seo.score, n);

    // 고득점 샘플 수집 (80점 이상)
    if (seo.score >= 80) {
      se.highScoreSamples.push({
        score: seo.score,
        structure: {
          intro: analysis.structure.intro.percent,
          paragraphLength: analysis.structure.avgParagraphLength,
          subheadings: analysis.structure.subheadings?.length || 0,
          images: analysis.structure.imagePositions?.positions?.length || 0
        },
        style: analysis.style.writingStyle,
        keywordDensity: analysis.keywords.density
      });

      // 최근 30개만 유지
      if (se.highScoreSamples.length > 30) {
        se.highScoreSamples.shift();
      }
    }
  },

  /**
   * 업종 패턴 학습 (제목 기반 자동 분류)
   */
  learnIndustry(data, title, analysis) {
    const industryKeywords = {
      '헬스/피트니스': ['헬스', 'PT', '운동', '다이어트', '필라테스', '요가', '트레이닝', '헬스장', '피트니스'],
      '뷰티/미용': ['피부', '미용', '헤어', '네일', '화장품', '뷰티', '시술', '성형'],
      '맛집/카페': ['맛집', '카페', '음식', '레스토랑', '식당', '맛있', '메뉴', '브런치'],
      '여행/숙박': ['여행', '호텔', '숙소', '펜션', '관광', '휴가', '여행지'],
      '육아/교육': ['육아', '아이', '교육', '학원', '유아', '어린이', '엄마'],
      '인테리어/부동산': ['인테리어', '집꾸미기', '부동산', '아파트', '이사', '리모델링'],
      'IT/테크': ['앱', '프로그램', '개발', 'IT', '테크', '디지털', '소프트웨어']
    };

    let detectedIndustry = '일반';
    const lowerTitle = title.toLowerCase();

    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      if (keywords.some(kw => lowerTitle.includes(kw))) {
        detectedIndustry = industry;
        break;
      }
    }

    // 업종별 데이터 저장
    if (!data.industries[detectedIndustry]) {
      data.industries[detectedIndustry] = {
        count: 0,
        avgSeoScore: 0,
        avgParagraphLength: 0,
        commonStyle: {},
        samples: []
      };
    }

    const ind = data.industries[detectedIndustry];
    ind.count++;
    ind.avgSeoScore = this.movingAverage(ind.avgSeoScore, analysis.seo.score, ind.count);
    ind.avgParagraphLength = this.movingAverage(ind.avgParagraphLength, analysis.structure.avgParagraphLength, ind.count);

    if (analysis.style.writingStyle) {
      ind.commonStyle[analysis.style.writingStyle] = (ind.commonStyle[analysis.style.writingStyle] || 0) + 1;
    }
  },

  /**
   * 이동 평균 계산
   */
  movingAverage(currentAvg, newValue, n) {
    if (n <= 1) return newValue;
    return Math.round((currentAvg * (n - 1) + newValue) / n * 100) / 100;
  },

  /**
   * 학습된 인사이트 생성 (프롬프트용)
   */
  async generateInsights() {
    const data = await this.loadData();

    if (data.totalAnalyzed < 3) {
      return null; // 최소 3개 이상 분석 필요
    }

    const insights = {
      totalAnalyzed: data.totalAnalyzed,

      // 최적 구조
      optimalStructure: {
        intro: Math.round(data.structure.avgIntroPercent),
        body: Math.round(data.structure.avgBodyPercent),
        conclusion: Math.round(data.structure.avgConclusionPercent),
        paragraphLength: Math.round(data.structure.avgParagraphLength),
        sentenceLength: Math.round(data.structure.avgSentenceLength),
        subheadings: Math.round(data.structure.avgSubheadingCount),
        images: Math.round(data.structure.avgImageCount)
      },

      // 선호 스타일
      preferredStyle: {
        writingStyle: this.getMostCommon(data.style.writingStyles),
        tone: this.getMostCommon(data.style.tones),
        hookType: this.getMostCommon(data.style.hookTypes),
        avgEmoji: Math.round(data.style.avgEmojiCount),
        sentenceRatio: {
          statement: Math.round(data.style.sentenceTypes.statement),
          question: Math.round(data.style.sentenceTypes.question),
          exclamation: Math.round(data.style.sentenceTypes.exclamation)
        }
      },

      // 키워드 전략
      keywordStrategy: {
        targetDensity: data.keywords.avgDensity.toFixed(1),
        avgSubKeywords: Math.round(data.keywords.avgSubKeywordCount),
        avgTags: Math.round(data.keywords.avgTagCount)
      },

      // SEO 성공 패턴
      seoSuccess: {
        avgScore: Math.round(data.seo.avgScore),
        highScoreCount: data.seo.highScoreSamples.length
      },

      // 업종별 인사이트
      topIndustries: this.getTopIndustries(data.industries)
    };

    return insights;
  },

  /**
   * 가장 빈도 높은 항목 반환
   */
  getMostCommon(obj) {
    const entries = Object.entries(obj);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  },

  /**
   * 상위 업종 반환
   */
  getTopIndustries(industries) {
    return Object.entries(industries)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgScore: Math.round(data.avgSeoScore)
      }));
  },

  /**
   * 학습 데이터 초기화
   */
  async reset() {
    await this.saveData(this.getDefaultData());
    console.log('[LearningEngine] 학습 데이터 초기화됨');
  },

  /**
   * 학습 통계 요약
   */
  async getSummary() {
    const data = await this.loadData();
    return {
      totalAnalyzed: data.totalAnalyzed,
      lastUpdated: data.lastUpdated,
      avgSeoScore: Math.round(data.seo.avgScore),
      topStyle: this.getMostCommon(data.style.writingStyles),
      topTone: this.getMostCommon(data.style.tones),
      topIndustry: this.getTopIndustries(data.industries)[0]?.name || '없음'
    };
  },

  /**
   * 생성된 글 저장 (Firebase)
   */
  async saveGeneratedPost(postData) {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      console.log('[LearningEngine] 로그인 필요 - 글 저장 스킵');
      return { success: false, error: '로그인이 필요합니다.' };
    }

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'saveGeneratedPost',
          userId: userId,
          postData: {
            ...postData,
            createdAt: new Date().toISOString()
          }
        }, resolve);
      });

      return response || { success: false, error: '저장 실패' };
    } catch (error) {
      console.error('[LearningEngine] 글 저장 오류:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 내 생성 글 목록 가져오기
   */
  async getMyGeneratedPosts(limit = 20) {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      return { success: false, error: '로그인이 필요합니다.' };
    }

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'getGeneratedPosts',
          userId: userId,
          limit: limit
        }, resolve);
      });

      return response || { success: false, error: '조회 실패' };
    } catch (error) {
      console.error('[LearningEngine] 글 목록 조회 오류:', error);
      return { success: false, error: error.message };
    }
  }
};

// 전역 노출
if (typeof window !== 'undefined') {
  window.LearningEngine = LearningEngine;
}
