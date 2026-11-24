// ============================================================
// 설정 파일 — Firebase 연결 정보를 채워 주세요.
// 값을 채우기 전에는 '데모 모드'(이 브라우저에만 저장)로 열립니다.
// ============================================================
window.APP_CONFIG = {
  // 처음 관리자(사용자 관리 가능) 구글 메일. firestore.rules 안의 메일과 똑같이 적어야 합니다.
  ownerEmails: ['여기에-관리자-구글메일@gmail.com'],

  // Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹) → 'SDK 설정 및 구성'의 firebaseConfig 값을 그대로 붙여넣기
  firebase: {
    apiKey: '여기에-apiKey',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  }
};
