/**
 * 양천구 도서관 관리 시스템 — app.js
 * Author : 1113 유재혁
 *
 * API 정보
 *  - End Point : https://apis.data.go.kr/3140000/libraryService/libraryInfo
 *  - 인증키    : URL Encoding 방식 적용
 *  - 응답 형식 : XML (기본값) → DOMParser로 파싱
 *  - 요청 변수 : type, serviceKey, numOfRows, pageNo
 */

'use strict';

/* ── 설정 ─────────────────────────────────────── */
const CONFIG = {
  // URL Encoding 된 인증키 (공공API 명세: serviceKey = 인증키 URL Encoding)
  SERVICE_KEY: encodeURIComponent(
    '695e64f041e421c1dcb69a7c00f532d2b252d75621cce15490ef5b801aa3ad99'
  ),
  ENDPOINT: 'https://apis.data.go.kr/3140000/libraryService/libraryInfo',
  DEFAULT_TYPE: 'xml',   // API 기본값: xml
};

/* ── 상태 ─────────────────────────────────────── */
const state = {
  allItems:    [],   // 현재 페이지에서 받아온 원본 항목
  filtered:    [],   // 검색/필터 후 목록
  pageNo:      1,
  numOfRows:   10,
  totalCount:  0,
  selectedIdx: null,
};

/* ── DOM ──────────────────────────────────────── */
const $$ = id => document.getElementById(id);
const el = {
  fetchBtn:      $$('fetchBtn'),
  searchInput:   $$('searchInput'),
  regionFilter:  $$('regionFilter'),
  numOfRows:     $$('numOfRows'),
  libraryList:   $$('libraryList'),
  detailContent: $$('detailContent'),
  listCount:     $$('listCount'),
  statTotal:     $$('statTotal'),
  statFiltered:  $$('statFiltered'),
  statPage:      $$('statPage'),
  statStatus:    $$('statStatus'),
  paginationBar: $$('paginationBar'),
  loadingOverlay:$$('loadingOverlay'),
  toast:         $$('toast'),
  clock:         $$('clock'),
};

/* ── 초기화 ───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  el.fetchBtn.addEventListener('click', () => {
    state.pageNo    = 1;
    state.numOfRows = parseInt(el.numOfRows.value, 10);
    fetchLibraries();
  });
  el.searchInput.addEventListener('input', applyFilters);
  el.regionFilter.addEventListener('change', applyFilters);
  el.numOfRows.addEventListener('change', () => {
    state.numOfRows = parseInt(el.numOfRows.value, 10);
    state.pageNo = 1;
    fetchLibraries();
  });
});

/* ── 시계 ─────────────────────────────────────── */
function startClock() {
  const pad = n => String(n).padStart(2, '0');
  const tick = () => {
    const d = new Date();
    el.clock.textContent =
      `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);
}

/* ── API 호출 ─────────────────────────────────── */
async function fetchLibraries() {
  showLoading(true);
  setStatus('요청 중');
  el.fetchBtn.disabled = true;

  // 요청 URL 구성
  // serviceKey는 이미 encodeURIComponent() 처리된 값을 직접 삽입
  // (URLSearchParams를 쓰면 이중 인코딩되므로 수동 조립)
  const url =
    `${CONFIG.ENDPOINT}` +
    `?serviceKey=${CONFIG.SERVICE_KEY}` +
    `&type=${CONFIG.DEFAULT_TYPE}` +
    `&numOfRows=${state.numOfRows}` +
    `&pageNo=${state.pageNo}`;

  try {
    const res = await fetch(url);

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const text = await res.text();

    // XML 파싱
    const items = parseXML(text);
    const totalCount = parseTotalCount(text);

    if (items.length === 0) {
      throw new Error('조회된 항목이 없습니다. 인증키 또는 네트워크를 확인하세요.');
    }

    state.allItems   = items;
    state.totalCount = totalCount || items.length;
    state.selectedIdx = null;

    buildRegionFilter(items);
    applyFilters();
    updateStats();
    renderPagination();
    setStatus('정상');
    showToast(`✅ ${items.length}개 도서관 정보 로드 완료`, 'success');

  } catch (err) {
    console.error('[API 오류]', err);
    setStatus('오류');
    showToast(`❌ ${err.message}`, 'error');
    renderFallback();
  } finally {
    showLoading(false);
    el.fetchBtn.disabled = false;
  }
}

/* ── XML 파싱 ─────────────────────────────────── */
/**
 * 공공데이터포털 XML 응답 구조:
 * <response>
 *   <header><resultCode/><resultMsg/></header>
 *   <body>
 *     <items>
 *       <item> ... </item>
 *     </items>
 *     <numOfRows/><pageNo/><totalCount/>
 *   </body>
 * </response>
 */
function parseXML(xmlText) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xmlText, 'application/xml');

  // 파싱 오류 확인
  const parseErr = doc.querySelector('parsererror');
  if (parseErr) {
    console.warn('[XML 파싱 오류]', parseErr.textContent);
    return [];
  }

  // 에러 응답 확인 (공공API 오류 XML)
  const resultCode = doc.querySelector('resultCode')?.textContent?.trim();
  if (resultCode && resultCode !== '00') {
    const resultMsg = doc.querySelector('resultMsg')?.textContent?.trim();
    throw new Error(`API 오류 (${resultCode}): ${resultMsg}`);
  }

  const itemNodes = doc.querySelectorAll('item');
  const items = [];
  itemNodes.forEach(node => {
    const obj = {};
    node.childNodes.forEach(child => {
      if (child.nodeType === 1) { // ELEMENT_NODE
        obj[child.nodeName] = child.textContent?.trim() ?? '';
      }
    });
    if (Object.keys(obj).length > 0) items.push(obj);
  });
  return items;
}

function parseTotalCount(xmlText) {
  const match = xmlText.match(/<totalCount>(\d+)<\/totalCount>/);
  return match ? parseInt(match[1], 10) : 0;
}

/* ── 지역 필터 구성 ───────────────────────────── */
function buildRegionFilter(items) {
  const prev = el.regionFilter.value;
  const regions = [...new Set(
    items
      .map(item => getField(item, 'lnmadr', 'rdnmadr'))
      .map(addr => addr.split(' ').slice(0, 3).join(' '))
      .filter(Boolean)
  )].sort();

  el.regionFilter.innerHTML = '<option value="">전체 지역</option>';
  regions.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    if (r === prev) opt.selected = true;
    el.regionFilter.appendChild(opt);
  });
}

/* ── 필터 적용 ────────────────────────────────── */
function applyFilters() {
  const keyword = el.searchInput.value.trim().toLowerCase();
  const region  = el.regionFilter.value.toLowerCase();

  state.filtered = state.allItems.filter(lib => {
    const name = getField(lib, 'lbrryNm').toLowerCase();
    const addr = getField(lib, 'lnmadr', 'rdnmadr').toLowerCase();
    const okKeyword = !keyword || name.includes(keyword) || addr.includes(keyword);
    const okRegion  = !region  || addr.includes(region);
    return okKeyword && okRegion;
  });

  state.selectedIdx = null;
  renderList();
  updateStats();
}

/* ── 목록 렌더링 ──────────────────────────────── */
function renderList() {
  el.listCount.textContent = `${state.filtered.length}개`;

  if (state.filtered.length === 0) {
    el.libraryList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>검색 결과가 없습니다.</p>
      </div>`;
    el.detailContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👈</div>
        <p>목록에서 도서관을 선택하면<br/>상세 정보가 표시됩니다.</p>
      </div>`;
    return;
  }

  el.libraryList.innerHTML = state.filtered.map((lib, i) => {
    const name = esc(getField(lib, 'lbrryNm')) || '(이름 없음)';
    const addr = esc(getField(lib, 'rdnmadr', 'lnmadr')) || '주소 정보 없음';
    const tel  = getField(lib, 'phoneNumber');
    const isActive = state.selectedIdx === i;
    return `
      <div class="library-card${isActive ? ' active' : ''}"
           onclick="selectLibrary(${i})"
           role="button" tabindex="0"
           onkeydown="if(event.key==='Enter')selectLibrary(${i})">
        <div class="card-name">📖 ${name}</div>
        <div class="card-addr">${addr}</div>
        <div class="card-tags">
          ${tel ? `<span class="tag green">📞 ${esc(tel)}</span>` : ''}
          <span class="tag">양천구</span>
          <span class="tag">p.${state.pageNo}</span>
        </div>
      </div>`;
  }).join('');
}

/* ── 도서관 선택 ──────────────────────────────── */
function selectLibrary(i) {
  state.selectedIdx = i;
  // active 클래스 갱신
  document.querySelectorAll('.library-card').forEach((card, idx) => {
    card.classList.toggle('active', idx === i);
  });
  renderDetail(state.filtered[i]);
}

/* ── 상세 정보 렌더링 ─────────────────────────── */
function renderDetail(lib) {
  const g = (...keys) => esc(getField(lib, ...keys)) || '—';

  const name     = g('lbrryNm');
  const rdnAddr  = g('rdnmadr');
  const lnAddr   = g('lnmadr');
  const tel      = g('phoneNumber');
  const fax      = g('faxNumber');
  const homepage = getField(lib, 'homepageUrl');
  const openTm   = g('operationTime');
  const closeDy  = g('closeDay');
  const bookCo   = getField(lib, 'bookCo');
  const lat      = getField(lib, 'latitude');
  const lng      = getField(lib, 'longitude');
  const intro    = getField(lib, 'libraryIntro');

  const homepageHtml = homepage
    ? `<a href="${esc(homepage)}" target="_blank" rel="noopener noreferrer">${esc(homepage)}</a>`
    : '—';

  const bookStr = bookCo
    ? `${Number(bookCo).toLocaleString()} 권`
    : '—';

  const hasCoord = lat && lng;
  const mapSection = hasCoord ? `
    <div class="map-link-box">
      <p>🗺️ 좌표 정보가 있습니다. 외부 지도에서 확인하세요.</p>
      <div class="map-coords">lat: ${esc(lat)} &nbsp;|&nbsp; lng: ${esc(lng)}</div>
      <div class="map-buttons">
        <a class="map-btn"
           href="https://map.naver.com/v5/search/${encodeURIComponent(getField(lib,'lbrryNm'))}"
           target="_blank" rel="noopener">네이버 지도</a>
        <a class="map-btn"
           href="https://map.kakao.com/link/map/${encodeURIComponent(getField(lib,'lbrryNm'))},${esc(lat)},${esc(lng)}"
           target="_blank" rel="noopener">카카오 지도</a>
      </div>
    </div>` : '';

  // 원시 데이터 (개발자 확인용)
  const rawJson = JSON.stringify(lib, null, 2);

  el.detailContent.innerHTML = `
    <div class="detail-grid">

      <div class="detail-name-row">
        <div class="detail-main-icon">🏛️</div>
        <div>
          <div class="detail-main-title">${name}</div>
          <div class="detail-main-sub">양천구 도서시설</div>
        </div>
      </div>

      <div class="info-block full">
        <div class="info-label">도로명 주소</div>
        <div class="info-value">${rdnAddr}</div>
      </div>

      <div class="info-block full">
        <div class="info-label">지번 주소</div>
        <div class="info-value">${lnAddr}</div>
      </div>

      <div class="info-block">
        <div class="info-label">전화번호</div>
        <div class="info-value">${tel}</div>
      </div>

      <div class="info-block">
        <div class="info-label">팩스</div>
        <div class="info-value">${fax}</div>
      </div>

      <div class="info-block full">
        <div class="info-label">홈페이지</div>
        <div class="info-value">${homepageHtml}</div>
      </div>

      <div class="info-block">
        <div class="info-label">운영 시간</div>
        <div class="info-value">${openTm}</div>
      </div>

      <div class="info-block">
        <div class="info-label">휴관일</div>
        <div class="info-value">${closeDy}</div>
      </div>

      <div class="info-block">
        <div class="info-label">장서 수</div>
        <div class="info-value">${bookStr}</div>
      </div>

      <div class="info-block">
        <div class="info-label">위도 / 경도</div>
        <div class="info-value mono">${lat || '—'} / ${lng || '—'}</div>
      </div>

      ${intro ? `
      <div class="info-block full">
        <div class="info-label">도서관 소개</div>
        <div class="info-value">${esc(intro)}</div>
      </div>` : ''}

      ${mapSection}

      <details class="raw-toggle">
        <summary>▸ 원시 응답 데이터 보기 (개발자용)</summary>
        <pre class="raw-data">${esc(rawJson)}</pre>
      </details>

    </div>`;
}

/* ── 페이지네이션 렌더링 ───────────────────────── */
function renderPagination() {
  const totalPages = Math.ceil(state.totalCount / state.numOfRows) || 1;
  const cur = state.pageNo;

  // 표시할 페이지 범위 (현재 ±2)
  let start = Math.max(1, cur - 2);
  let end   = Math.min(totalPages, cur + 2);
  if (end - start < 4) {
    if (start === 1) end = Math.min(totalPages, start + 4);
    else start = Math.max(1, end - 4);
  }

  let html = '';

  // 이전
  html += `<button class="page-btn" onclick="goPage(${cur-1})" ${cur===1?'disabled':''}>‹</button>`;

  if (start > 1) html += `<button class="page-btn" onclick="goPage(1)">1</button>${start>2?'<span style="padding:0 0.2rem;color:var(--ink-light)">…</span>':''}`;

  for (let p = start; p <= end; p++) {
    html += `<button class="page-btn${p===cur?' active':''}" onclick="goPage(${p})">${p}</button>`;
  }

  if (end < totalPages) html += `${end<totalPages-1?'<span style="padding:0 0.2rem;color:var(--ink-light)">…</span>':''}<button class="page-btn" onclick="goPage(${totalPages})">${totalPages}</button>`;

  // 다음
  html += `<button class="page-btn" onclick="goPage(${cur+1})" ${cur>=totalPages?'disabled':''}>›</button>`;

  el.paginationBar.innerHTML = html;
}

function goPage(p) {
  const totalPages = Math.ceil(state.totalCount / state.numOfRows) || 1;
  if (p < 1 || p > totalPages) return;
  state.pageNo = p;
  fetchLibraries();
  el.libraryList.scrollTop = 0;
}

/* ── 통계 업데이트 ────────────────────────────── */
function updateStats() {
  el.statTotal.textContent    = state.totalCount || state.allItems.length || '—';
  el.statFiltered.textContent = state.filtered.length || '—';
  el.statPage.textContent     = state.totalCount
    ? `${state.pageNo} / ${Math.ceil(state.totalCount / state.numOfRows)}`
    : '—';
}

function setStatus(text) { el.statStatus.textContent = text; }

/* ── 폴백 샘플 데이터 ─────────────────────────── */
function renderFallback() {
  const FALLBACK = [
    {
      lbrryNm: '양천구립 신월도서관',
      rdnmadr: '서울특별시 양천구 신월로 386',
      lnmadr:  '서울특별시 양천구 신월동 192-1',
      phoneNumber: '02-2601-3011',
      faxNumber:   '02-2601-3019',
      homepageUrl: 'https://lib.yangcheon.go.kr',
      operationTime: '평일 09:00~22:00 / 주말 09:00~18:00',
      closeDay: '매주 월요일, 법정공휴일',
      bookCo: '120000',
      latitude:  '37.5304',
      longitude: '126.8254',
    },
    {
      lbrryNm: '양천구립 신정도서관',
      rdnmadr: '서울특별시 양천구 신정로 241',
      lnmadr:  '서울특별시 양천구 신정동 322',
      phoneNumber: '02-2061-8810',
      faxNumber:   '02-2061-8819',
      homepageUrl: 'https://lib.yangcheon.go.kr',
      operationTime: '평일 09:00~21:00 / 주말 09:00~17:00',
      closeDay: '매주 월요일, 법정공휴일',
      bookCo: '98000',
      latitude:  '37.5274',
      longitude: '126.8557',
    },
    {
      lbrryNm: '양천구립 목동도서관',
      rdnmadr: '서울특별시 양천구 목동로 105',
      lnmadr:  '서울특별시 양천구 목동 916-2',
      phoneNumber: '02-2645-0065',
      faxNumber:   '02-2645-0068',
      homepageUrl: 'https://lib.yangcheon.go.kr',
      operationTime: '평일 09:00~22:00 / 주말 09:00~18:00',
      closeDay: '매주 월요일, 법정공휴일',
      bookCo: '145000',
      latitude:  '37.5375',
      longitude: '126.8723',
    },
  ];

  state.allItems   = FALLBACK;
  state.totalCount = FALLBACK.length;
  buildRegionFilter(FALLBACK);
  applyFilters();
  updateStats();
  renderPagination();
  setStatus('샘플');
  showToast('⚠️ 샘플 데이터를 표시합니다 (API 미연결)', 'warn');
}

/* ── 유틸 ─────────────────────────────────────── */
/**
 * 여러 키를 순서대로 탐색, 첫 번째로 값 있는 것 반환.
 * 마지막 인자가 fallback 문자열이 아니면 빈 문자열 반환.
 */
function getField(obj, ...keys) {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
    // 대문자 형태도 시도
    const upper = k.toUpperCase();
    const vU = obj[upper];
    if (vU !== undefined && vU !== null && vU !== '') return String(vU);
  }
  return '';
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let toastTimer;
function showToast(msg, type = '') {
  el.toast.textContent = msg;
  el.toast.className = `toast show${type ? ' ' + type : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.className = 'toast'; }, 3800);
}

function showLoading(v) {
  el.loadingOverlay.classList.toggle('hidden', !v);
}

// 전역 노출 (인라인 onclick에서 사용)
window.selectLibrary = selectLibrary;
window.goPage        = goPage;
