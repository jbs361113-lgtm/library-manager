# 📚 양천구 도서관 관리 시스템

> **개발자:** 1113 유재혁  
> **데이터:** 서울특별시 양천구\_도서시설 현황 (공공데이터포털 Open API)  
> **기술 스택:** HTML5 · CSS3 · Vanilla JavaScript (ES2022)

---

## 📌 프로젝트 개요

서울특별시 양천구의 공공 도서시설 현황을 조회·관리하는 웹 애플리케이션입니다.  
공공데이터포털 REST API를 실시간으로 호출하여 도서관의 위치, 운영 시간, 연락처 등을 제공합니다.

---

## 📁 파일 구조

```
project/
├── index.html   ← 전체 HTML 구조 (헤더 · 검색바 · 목록 · 상세)
├── style.css    ← 디자인 시스템 (CSS 변수 기반 에디토리얼 테마)
├── app.js       ← API 호출 · XML 파싱 · 필터 · 페이지네이션 로직
└── README.md    ← 이 문서
```

---

## 🔑 API 상세 정보

| 항목 | 내용 |
|------|------|
| 데이터명 | 서울특별시 양천구\_도서시설 현황 |
| End Point | `https://apis.data.go.kr/3140000/libraryService/libraryInfo` |
| 서비스 유형 | REST |
| 데이터 포맷 | **XML** (기본값) / JSON / GeoJSON |
| 활용 기간 | 2026-04-13 ~ 2028-04-13 |
| 일일 트래픽 | 10,000 건 |

### 요청 변수 (Request Parameter)

| 항목명 | 샘플 | 설명 |
|--------|------|------|
| `type` | `xml` | 응답 형식 (xml / json / geojson) |
| `serviceKey` | 인증키 | **URL Encoding** 된 인증키 |
| `numOfRows` | `10` | 페이지당 목록 수 |
| `pageNo` | `1` | 페이지 번호 |

> ⚠️ `serviceKey`는 반드시 **URL Encoding** 형식으로 전달해야 합니다.  
> `app.js`에서 `encodeURIComponent()`로 처리 후 URL에 직접 삽입합니다.  
> (`URLSearchParams`를 쓰면 이중 인코딩이 발생하므로 수동 URL 조립 방식 사용)

---

## 🚀 실행 방법

### ✅ 방법 1 — VS Code Live Server (권장)

1. 4개 파일을 같은 폴더에 저장합니다.
2. VS Code에서 해당 폴더를 엽니다.
3. Extensions에서 **Live Server** (ritwickdey.LiveServer) 설치.
4. `index.html` 우클릭 → **Open with Live Server** 선택.
5. 브라우저가 자동으로 열리면 **"데이터 불러오기"** 버튼을 클릭합니다.

### 방법 2 — Python 간이 서버

```bash
# 프로젝트 폴더에서 실행
python -m http.server 5500

# 브라우저에서 http://localhost:5500 접속
```

> ❌ `file://` 프로토콜로 직접 열면 CORS 오류가 발생합니다.  
> 반드시 로컬 서버(`http://localhost:...`)를 통해 실행하세요.

---

## 🖥️ 기능 목록

### 데이터 조회
- **데이터 불러오기** 버튼 → 공공API 실시간 호출 (XML 응답 파싱)
- API 오류 또는 CORS 차단 시 샘플 데이터 3건 자동 표시 (폴백)

### 검색 & 필터
- 도서관 이름 / 주소 실시간 텍스트 검색
- 지역 드롭다운 필터 (API 응답에서 자동 생성)
- 페이지당 표시 수 선택 (5 / 10 / 20 / 50개)

### 페이지네이션
- API `pageNo` 파라미터 기반 서버사이드 페이징
- 총 건수(`totalCount`)를 이용한 정확한 페이지 수 계산
- 현재 페이지 ±2 범위 표시, 처음/끝 페이지 버튼 포함

### 상세 정보
- 도로명 주소 / 지번 주소
- 전화번호 · 팩스 · 홈페이지
- 운영 시간 · 휴관일 · 장서 수
- 위도/경도 좌표 + 네이버/카카오 지도 바로가기
- 원시 XML 응답 데이터 확인 (개발자용 토글)

### 통계 요약
- 전체 도서관 수 · 검색 결과 수 · 현재 페이지 / 전체 페이지 · API 상태

---

## ⚙️ 주요 응답 필드 (XML `<item>` 내부)

| 필드명 | 설명 |
|--------|------|
| `lbrryNm` | 도서관 이름 |
| `rdnmadr` | 도로명 주소 |
| `lnmadr` | 지번 주소 |
| `phoneNumber` | 전화번호 |
| `faxNumber` | 팩스 번호 |
| `homepageUrl` | 홈페이지 URL |
| `operationTime` | 운영 시간 |
| `closeDay` | 휴관일 |
| `bookCo` | 장서 수 |
| `latitude` | 위도 |
| `longitude` | 경도 |
| `libraryIntro` | 도서관 소개 |

---

## 🛠️ 기술 세부 사항

- **순수 바닐라 JS** — 외부 라이브러리 없음
- **XML 파싱** — `DOMParser` API 사용 (브라우저 내장)
- **URL 인코딩** — `encodeURIComponent()` 적용, 이중 인코딩 방지
- **XSS 방어** — 모든 출력값 `esc()` 함수로 HTML 이스케이프 처리
- **에러 핸들링** — API 오류 코드 파싱, 폴백 샘플 데이터 제공
- **반응형 레이아웃** — 모바일(860px 이하) 지원

---

## 📝 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 데이터가 안 나옴 (샘플 표시됨) | CORS 차단 | 로컬 서버로 실행 |
| API 오류 코드 반환 | 인증키 문제 | 포털에서 인코딩/디코딩 키 교차 시도 |
| XML 파싱 오류 | 응답이 HTML 오류 페이지 | 개발자 도구 > Network 탭에서 응답 확인 |

---

## 🧾 라이선스

교육 및 비영리 목적으로 작성된 프로젝트입니다.  
공공데이터 활용 시 [공공데이터포털 이용약관](https://www.data.go.kr/information/TERMS_0000000000000001.do)을 준수하세요.
