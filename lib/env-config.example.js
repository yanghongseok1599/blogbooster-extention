/**
 * 블로그 부스터 Pro - 환경 설정 예시
 *
 * 이 파일을 env-config.js로 복사한 뒤 실제 값을 입력하세요.
 * cp lib/env-config.example.js lib/env-config.js
 */

const ENV_CONFIG = {
  // Firebase 설정 (Firebase Console > 프로젝트 설정 > 일반 > 웹 앱)
  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
  },

  // 관리자 설정
  adminEmail: "YOUR_ADMIN_EMAIL",
  defaultAdminPassword: "YOUR_ADMIN_PASSWORD"
};
