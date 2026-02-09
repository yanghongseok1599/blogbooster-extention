# 블로그 부스터 Pro - 테스트 및 배포 가이드

---

# 로컬 테스트

## Step 1: 최종 파일 구조 확인

```
blogbooster-extention/
├── manifest.json              # 확장 프로그램 설정 (Manifest V3)
├── background/
│   └── service-worker.js      # 백그라운드 서비스 워커
├── content/
│   ├── extractor.js           # 블로그 본문 추출
│   ├── analyzer.js            # 본문 분석
│   ├── blog-helper.js         # 블로그 헬퍼
│   ├── editor-injector.js     # 에디터 자동 입력
│   └── content.css            # 콘텐츠 스타일
├── sidepanel/
│   ├── panel.html             # 사이드패널 UI
│   ├── panel.css              # 사이드패널 스타일
│   └── panel.js               # 사이드패널 로직
├── auth/
│   ├── login.html             # 로그인/회원가입 페이지
│   ├── login.css
│   └── login.js
├── admin/
│   ├── admin.html             # 관리자 페이지
│   ├── admin.css
│   └── admin.js
├── mypage/
│   ├── mypage.html            # 마이페이지
│   ├── mypage.css
│   └── mypage.js
├── options/
│   ├── options.html           # 설정 페이지
│   └── options.js
├── popup/                     # 팝업 UI
├── lib/
│   ├── env-config.js          # 환경 설정 (민감 정보, .gitignore)
│   ├── env-config.example.js  # 환경 설정 예시
│   ├── firebase-config.js     # Firebase 초기화
│   ├── firebase-app-compat.js
│   ├── firebase-auth-compat.js
│   ├── firebase-firestore-compat.js
│   ├── learning-engine.js     # AI 학습 엔진
│   ├── nlp-utils.js           # 자연어 처리
│   ├── naver-seo-analyzer.js  # SEO 분석기
│   └── html2canvas.min.js     # 캡처 라이브러리
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon.png
└── DOCS/
    └── testing-and-deployment.md
```

## Step 2: 환경 설정

```bash
# env-config.js 생성 (최초 1회)
cp lib/env-config.example.js lib/env-config.js
# 실제 Firebase 설정값, 관리자 이메일/비밀번호 입력
```

## Step 3: manifest.json 검증

```bash
# JSON 문법 검증
https://jsonlint.com/
```

**체크리스트:**
- [ ] `manifest_version: 3`
- [ ] `name`, `version`, `description` 입력
- [ ] `permissions` 필요한 것만 포함
- [ ] `content_scripts` 파일명 정확
- [ ] `icons` 경로 정확
- [ ] `side_panel` 경로 정확

## Step 4: 브라우저에 로드

### 크롬
1. `chrome://extensions` 열기
2. 개발자 모드 켜기
3. "압축 해제된 확장 프로그램을 로드합니다" 클릭
4. `blogbooster-extention` 폴더 선택

### 웨일
1. `whale://extensions` 열기
2. 개발자 모드 켜기
3. "압축 해제된 확장 프로그램을 로드합니다" 클릭
4. `blogbooster-extention` 폴더 선택

**성공 시:**
- 확장 프로그램 목록에 "블로그 부스터 Pro" 표시
- 아이콘이 툴바에 나타남
- 에러 메시지 없음

---

# 기능별 테스트 시나리오

## 테스트 1: 로그인/회원가입

**준비:**
1. 확장 프로그램 아이콘 클릭
2. 로그인 페이지 열기

**시나리오:**
1. 이메일/비밀번호 입력
2. "로그인" 클릭
3. 로그인 성공 시 사이드패널이 가운데에 표시되는지 확인

**체크:**
- [ ] 로그인 성공 시 로그인 화면 사라지고 패널 표시
- [ ] 로그아웃 후 로그인 화면 복귀
- [ ] 로그아웃 후 자동 로그인 안 됨
- [ ] 회원가입 정상 동작
- [ ] 비밀번호 재설정 이메일 발송

## 테스트 2: 네이버 블로그 분석

**준비:**
1. 네이버 블로그 아무 글 열기
2. 사이드패널 열기

**시나리오:**
1. "이 글 분석하기" 클릭
2. 분석 옵션 선택 (분석만 / 분석+학습)
3. 분석 결과 확인

**체크:**
- [ ] 본문 추출 성공
- [ ] SEO 점수 표시
- [ ] 서론/본론/결론 비율 표시
- [ ] 키워드 분석 결과 표시
- [ ] 문장 유형 분포 표시
- [ ] 소제목 목록 표시

## 테스트 3: AI 글 생성

**준비:**
1. 블로그 분석 완료 상태
2. "생성" 탭 이동

**시나리오:**
1. 메인 키워드 입력 (예: "서울 카페 추천")
2. 서브 키워드 입력 (예: "인스타 감성, 디저트")
3. 사업장 정보 입력
4. 독창성/글 길이 설정
5. "AI로 글 생성하기" 클릭

**예상 결과:**
- AI가 SEO 최적화된 블로그 글 생성
- 클립보드 복사 버튼 동작

**체크:**
- [ ] Gemini API 연동 정상
- [ ] 글 생성 완료 (로딩 → 결과 표시)
- [ ] 클립보드 복사 동작
- [ ] 금칙어 검토 결과 표시

## 테스트 4: YouTube → 블로그 변환

**준비:**
1. YouTube URL 준비

**시나리오:**
1. 사이드패널에서 YouTube URL 입력
2. "분석" 클릭
3. 영상 정보 확인
4. "AI로 블로그 글 생성하기" 클릭

**체크:**
- [ ] YouTube 자막 추출 성공
- [ ] 영상 미리보기 표시
- [ ] 블로그 글 생성 완료
- [ ] 일일 사용량 카운트 (3건/일)

## 테스트 5: 관리자 기능

**준비:**
1. 관리자 이메일로 로그인
2. 관리자 페이지 접속

**시나리오:**
1. 관리자 비밀번호 입력
2. 프로모션 코드 발행
3. 유저 목록 불러오기
4. 유저 플랜 수정

**체크:**
- [ ] 관리자 인증 동작
- [ ] 프로모션 코드 생성/복사
- [ ] 활성 코드 목록 표시
- [ ] 유저 목록 로드
- [ ] 유저 플랜 변경
- [ ] Gemini API 키 저장
- [ ] YouTube API 키 저장

## 테스트 6: 에러 상황

### 6-1. API 키 미설정
- Gemini API 키 미저장 상태에서 글 생성 시도

**예상:**
```
"API 키가 설정되지 않았습니다. 관리자에게 문의하세요."
```

### 6-2. 네트워크 오류
- 인터넷 연결 끊기 후 기능 사용

**예상:**
- 적절한 에러 메시지 표시

### 6-3. 비로그인 상태
- 로그아웃 상태에서 사이드패널 접근

**예상:**
- "로그인이 필요합니다" 화면 표시

### 6-4. 무료 유저 AI 기능 접근
- 무료 플랜 유저가 AI 글 생성 시도

**예상:**
- "PRO 구독이 필요한 기능입니다." 메시지

---

# 배포 준비

## 옵션 1: 개인/팀 내부 사용

**그대로 사용:**
- 개발자 모드로 로드
- 언제든 코드 수정 가능
- 브라우저 재시작 시 재로드 필요

## 옵션 2: 크롬 웹스토어 배포

### Step 1: 배포 파일 준비

**제거할 파일/폴더:**
- `DOCS/` (선택)
- `.git/`
- `.gitignore`
- `lib/env-config.example.js`

**주의: `lib/env-config.js`는 반드시 포함**

### Step 2: ZIP 압축

```bash
# 폴더 내용물만 압축 (manifest.json이 루트에 위치해야 함)
cd blogbooster-extention
zip -r ../blogbooster-pro.zip . -x ".git/*" "DOCS/*" ".gitignore" "lib/env-config.example.js"
```

### Step 3: 개발자 등록

1. https://chrome.google.com/webstore/devconsole/ 접속
2. $5 일회성 등록 비용 결제
3. 개발자 계정 생성

### Step 4: 확장 프로그램 등록

1. "새 항목" 클릭
2. ZIP 파일 업로드
3. 스토어 등록 정보 입력:
   - **이름:** 블로그 부스터 Pro
   - **설명:** 네이버 블로그 올인원 도우미 - SEO 분석, 벤치마킹, AI 글 생성
   - **카테고리:** 생산성
   - **스크린샷:** 1280x800 또는 640x400
   - **아이콘:** 128x128 (icons/icon128.png)
   - **개인정보 처리방침:** 필요 시 URL 입력

### Step 5: 심사 제출

- 검토 시간: 1-3일
- 승인 후 자동 배포

## 옵션 3: .crx 파일 배포

1. `chrome://extensions`
2. "확장 프로그램 패키징" 클릭
3. `blogbooster-extention` 폴더 선택
4. `.crx` 파일 생성 후 공유

---

# 보안 체크리스트

## 코드 보안

- [x] API 키 하드코딩 제거 → `env-config.js`로 분리
- [x] `env-config.js`는 `.gitignore`에 포함
- [ ] Firebase Security Rules 설정 확인
- [ ] `eval()` 사용 안 함

## 권한 목록

```json
"permissions": [
  "activeTab",       // 현재 탭 접근
  "tabs",            // 탭 관리 (관리자/마이페이지 열기)
  "storage",         // 설정/인증 데이터 저장
  "sidePanel",       // 사이드패널 UI
  "scripting",       // Content Script 주입
  "webNavigation",   // 페이지 이동 감지
  "contextMenus",    // 우클릭 메뉴
  "identity"         // Firebase 인증
]
```

## 데이터 보호

- Firebase 인증 토큰은 `chrome.storage.local`에만 저장
- Gemini API 키는 Firebase Firestore에서 관리
- 사용자 개인 API 키는 `chrome.storage.sync`에 저장

---

# 버전 관리

```json
"version": "2.0.0"  // major.minor.patch
```

**버전 규칙:**
- `2.0.0` → `2.0.1`: 버그 수정
- `2.0.0` → `2.1.0`: 기능 추가
- `2.0.0` → `3.0.0`: 대규모 변경

## 업데이트 절차

1. 코드 수정
2. `manifest.json` 버전 업
3. 테스트
4. ZIP 재생성
5. 웹스토어 업데이트 제출

---

# 환경 설정 가이드

## 최초 설정

```bash
# 1. env-config.js 생성
cp lib/env-config.example.js lib/env-config.js

# 2. Firebase 설정값 입력
# Firebase Console > 프로젝트 설정 > 일반 > 웹 앱에서 확인

# 3. 관리자 이메일/비밀번호 설정
```

## 관리자 설정 (확장 프로그램 내)

1. 관리자 페이지 접속
2. **Gemini API 키** 저장 (Google AI Studio에서 발급)
3. **YouTube API 키** 저장 (Google Cloud Console에서 발급)
4. **무료 사용자 API 접근** 허용 여부 설정

---

# 문제 해결

| 문제 | 원인 | 해결 |
|------|------|------|
| "API 키가 설정되지 않았습니다" | 관리자가 Gemini API 키 미저장 | 관리자 페이지에서 API 키 저장 |
| "PRO 구독이 필요합니다" | 무료 유저 + 무료접근 비허용 | 관리자 페이지에서 유저 플랜 변경 또는 무료접근 허용 |
| "로그인이 필요합니다" | Firebase 세션 만료 | 재로그인 |
| 사이드패널 안 열림 | 권한 문제 | 확장 프로그램 재설치 |
| 블로그 분석 안 됨 | 네이버 블로그 외 페이지 | 네이버 블로그 페이지에서만 동작 |
| YouTube 변환 실패 | YouTube API 키 미설정 또는 일일 한도 초과 | API 키 확인, 다음 날 재시도 |
