/**
 * 양천구 도서관 관리 시스템 — app.js
 * Author : 1113 유재혁
 */

'use strict';

/* ── 설정 ─────────────────────────────────────── */
const CONFIG = {
  SERVICE_KEY: encodeURIComponent(
    '695e64f041e421c1dcb69a7c00f532d2b252d75621cce15490ef5b801aa3ad99'
  ),
  ENDPOINT: 'https://apis.data.go.kr/3140000/libraryService/libraryInfo',
  TYPE: 'xml',
};

/* ── 상태 ─────────────────────────────────────── */
const state = {
  allItems:    [],
  filtered:    [],
  pageNo:      1,
  numOfRows:   10,
  totalCount:  0,
  selectedIdx: null,
};

/* ── DOM ──────────────────────────────────────── */
const $$ = id => document.getElementById(id);
const el = {
  fetchBtn:       $$('fetchBtn'),
  searchInput:    $$('searchInput'),
  regionFilter:   $$('regionFilter'),
  numOfRows:      $$('numOfRows'),
  libraryList:    $$('libraryList'),
  detailContent:  $$('detailContent'),
  listCount:      $$('listCount'),
  statTotal:      $$('statTotal'),
  statFiltered:   $$('statFiltered'),
  statPage:       $$('statPage'),
  statStatus:     $$('statStatus'),
  paginationBar:  $$('paginationBar'),
  loadingOverlay: $$('loadingOverlay'),
  toast:          $$('toast'),
  clock:          $$('clock'),
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
    state.pageNo    = 1;
    fetchLibraries();
  });
});

/* ── 시계 ─────────────────────────────────────── */
function startClock() {
  const pad  = n => String(n).padStart(2, '0');
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

  const url =
    `${CONFIG.ENDPOINT}` +
    `?serviceKey=${CONFIG.SERVICE_KEY}` +
    `&type=${CONFIG.TYPE}` +
    `&numOfRows=${state.numOfRows}` +
    `&pageNo=${state.pageNo}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text  = await res.text();
    const items = parseXML(text);
    const total = parseTotalCount(text);

    if (items.length === 0) throw new Error('데이터가 없습니다.');

    state.allItems    = items;
    state.totalCount  = total || items.length;
    state.selectedIdx = null;

    buildRegionFilter(items);
    applyFilters();
    updateStats();
    renderPagination();
    setStatus('정상');
    showToast('✅ ' + items.length + '개 도서관 정보 로드 완료', 'success');

  } catch (err) {
    console.error('[API 오류]', err);
    setStatus('오류');
    showToast('❌ ' + err.message, 'error');
    renderFallback();
  } finally {
    showLoading(false);
    el.fetchBtn.disabled = false;
  }
}

/* ── XML 파싱 ─────────────────────────────────── */
function parseXML(xmlText) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xmlText, 'application/xml');

  if (doc.querySelector('parsererror')) {
    console.error('XML 파싱 오류');
    return [];
  }

  const resultCode = doc.querySelector('resultCode');
  if (resultCode && resultCode.textContent.trim() !== '00') {
    const msg = doc.querySelector('resultMsg');
    throw new Error('API 오류: ' + (msg ? msg.textContent.trim() : '알 수 없음'));
  }

  const items = [];
  const itemNodes = doc.querySelectorAll('item');

  itemNodes.forEach(function(node) {
    const obj = {};
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      // 태그명 그대로 소문자로 저장
      obj[child.tagName.toLowerCase()] = child.textContent ? child.textContent.trim() : '';
    }
    if (Object.keys(obj).length > 0) {
      items.push(obj);
    }
  });

  return items;
}

function parseTotalCount(xmlText) {
  const match = xmlText.match(/<totalCount>(\d+)<\/totalCount>/);
  return match ? parseInt(match[1], 10) : 0;
}

/* ── 필드 읽기 ────────────────────────────────── */
// obj에서 key(소문자)로 값을 꺼냄. 없으면 빈 문자열
function fld(obj, key) {
  const val = obj[key];
  if (val === undefined || val === null) return '';
  return String(val);
}

/* ── 지역 필터 ────────────────────────────────── */
function buildRegionFilter(items) {
  const prev    = el.regionFilter.value;
  const regions = [];
  const seen    = {};

  items.forEach(function(lib) {
    const emdnm = fld(lib, 'emdnm');
    if (emdnm && !seen[emdnm]) {
      seen[emdnm] = true;
      regions.push(emdnm);
    }
  });
  regions.sort();

  el.regionFilter.innerHTML = '<option value="">전체 지역</option>';
  regions.forEach(function(r) {
    const opt       = document.createElement('option');
    opt.value       = r;
    opt.textContent = r;
    if (r === prev) opt.selected = true;
    el.regionFilter.appendChild(opt);
  });
}

/* ── 필터 적용 ────────────────────────────────── */
function applyFilters() {
  const keyword = el.searchInput.value.trim().toLowerCase();
  const region  = el.regionFilter.value;

  state.filtered = state.allItems.filter(function(lib) {
    const name   = fld(lib, 'lbrrynm').toLowerCase();
    const addr   = fld(lib, 'rdnmadr').toLowerCase();
    const emdnm  = fld(lib, 'emdnm');
    const okKey  = !keyword || name.indexOf(keyword) !== -1 || addr.indexOf(keyword) !== -1;
    const okReg  = !region  || emdnm === region;
    return okKey && okReg;
  });

  state.selectedIdx = null;
  renderList();
  updateStats();
}

/* ── 목록 렌더링 ──────────────────────────────── */
function renderList() {
  el.listCount.textContent = state.filtered.length + '개';

  if (state.filtered.length === 0) {
    el.libraryList.innerHTML =
      '<div class="empty-state"><div class="empty-icon">🔍</div><p>검색 결과가 없습니다.</p></div>';
    el.detailContent.innerHTML =
      '<div class="empty-state"><div class="empty-icon">👈</div><p>목록에서 도서관을 선택하면<br/>상세 정보가 표시됩니다.</p></div>';
    return;
  }

  let html = '';
  state.filtered.forEach(function(lib, i) {
    const name    = fld(lib, 'lbrrynm') || '(이름 없음)';
    const addr    = fld(lib, 'rdnmadr') || '주소 정보 없음';
    const tel     = fld(lib, 'phonenumber');
    const lbrryty = fld(lib, 'lbrryty');
    const active  = state.selectedIdx === i ? ' active' : '';

    html +=
      '<div class="library-card' + active + '" onclick="selectLibrary(' + i + ')" role="button" tabindex="0">' +
        '<div class="card-name">📖 ' + esc(name) + '</div>' +
        '<div class="card-addr">' + esc(addr) + '</div>' +
        '<div class="card-tags">' +
          (lbrryty ? '<span class="tag green">' + esc(lbrryty) + '</span>' : '') +
          (tel     ? '<span class="tag">📞 ' + esc(tel) + '</span>'        : '') +
        '</div>' +
      '</div>';
  });

  el.libraryList.innerHTML = html;
}

/* ── 도서관 선택 ──────────────────────────────── */
function selectLibrary(i) {
  state.selectedIdx = i;
  const cards = document.querySelectorAll('.library-card');
  cards.forEach(function(card, idx) {
    card.classList.toggle('active', idx === i);
  });
  renderDetail(state.filtered[i]);
}

/* ── 상세 정보 렌더링 ─────────────────────────── */
function renderDetail(lib) {
  const name     = fld(lib, 'lbrrynm');
  const addr     = fld(lib, 'rdnmadr');
  const tel      = fld(lib, 'phonenumber');
  const homepage = fld(lib, 'hompageurl');
  const wkStart  = fld(lib, 'wkdayoperbgngtm');
  const wkEnd    = fld(lib, 'wkdayoperendtm');
  const satStart = fld(lib, 'satoperbgngtm');
  const satEnd   = fld(lib, 'satoperendtm');
  const hlStart  = fld(lib, 'hloperbgngtm');
  const hlEnd    = fld(lib, 'hloperendtm');
  const closeday = fld(lib, 'closeday');
  const bookco   = fld(lib, 'bookco');
  const seatco   = fld(lib, 'seatco');
  const lat      = fld(lib, 'latitude');
  const lng      = fld(lib, 'longitude');
  const lbrryty  = fld(lib, 'lbrryty');
  const organ    = fld(lib, 'operinestitutionnm');
  const emdnm    = fld(lib, 'emdnm');
  const partclr  = fld(lib, 'partclr');

  // 홈페이지
  const homepageHtml = homepage
    ? '<a href="' + esc(homepage) + '" target="_blank" rel="noopener noreferrer">' + esc(homepage) + '</a>'
    : '정보 없음';

  // 운영 시간
  let openTime = '';
  if (wkStart && wkEnd)   openTime += '평일 ' + wkStart + ' ~ ' + wkEnd;
  if (satStart && satEnd) openTime += '<br/>토요일 ' + satStart + ' ~ ' + satEnd;
  if (hlStart  && hlEnd)  openTime += '<br/>공휴일 ' + hlStart  + ' ~ ' + hlEnd;
  if (!openTime)          openTime  = '정보 없음';

  // 지도
  let mapSection = '';
  if (lat && lng) {
    mapSection =
      '<div class="map-link-box">' +
        '<p>🗺️ 외부 지도에서 위치를 확인하세요.</p>' +
        '<div class="map-coords">lat: ' + esc(lat) + ' &nbsp;|&nbsp; lng: ' + esc(lng) + '</div>' +
        '<div class="map-buttons">' +
          '<a class="map-btn" href="https://map.naver.com/v5/search/' + encodeURIComponent(name) + '" target="_blank" rel="noopener">네이버 지도</a>' +
          '<a class="map-btn" href="https://map.kakao.com/link/map/' + encodeURIComponent(name) + ',' + esc(lat) + ',' + esc(lng) + '" target="_blank" rel="noopener">카카오 지도</a>' +
        '</div>' +
      '</div>';
  }

  // 부제목
  let subTitle = esc(lbrryty);
  if (emdnm)   subTitle += ' · ' + esc(emdnm);
  if (partclr) subTitle += ' · ' + esc(partclr);

  el.detailContent.innerHTML =
    '<div class="detail-grid">' +

      '<div class="detail-name-row">' +
        '<div class="detail-main-icon">🏛️</div>' +
        '<div>' +
          '<div class="detail-main-title">' + (esc(name) || '—') + '</div>' +
          '<div class="detail-main-sub">' + subTitle + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="info-block full">' +
        '<div class="info-label">주소</div>' +
        '<div class="info-value">' + (esc(addr) || '정보 없음') + '</div>' +
      '</div>' +

      '<div class="info-block">' +
        '<div class="info-label">전화번호</div>' +
        '<div class="info-value">' + (esc(tel) || '정보 없음') + '</div>' +
      '</div>' +

      '<div class="info-block">' +
        '<div class="info-label">운영 기관</div>' +
        '<div class="info-value">' + (esc(organ) || '정보 없음') + '</div>' +
      '</div>' +

      '<div class="info-block full">' +
        '<div class="info-label">운영 시간</div>' +
        '<div class="info-value">' + openTime + '</div>' +
      '</div>' +

      '<div class="info-block">' +
        '<div class="info-label">휴관일</div>' +
        '<div class="info-value">' + (esc(closeday) || '정보 없음') + '</div>' +
      '</div>' +

      '<div class="info-block">' +
        '<div class="info-label">장서 수</div>' +
        '<div class="info-value">' + (bookco ? Number(bookco).toLocaleString() + ' 권' : '정보 없음') + '</div>' +
      '</div>' +

      '<div class="info-block">' +
        '<div class="info-label">좌석 수</div>' +
        '<div class="info-value">' + (seatco ? Number(seatco).toLocaleString() + ' 석' : '정보 없음') + '</div>' +
      '</div>' +

      '<div class="info-block">' +
        '<div class="info-label">홈페이지</div>' +
        '<div class="info-value">' + homepageHtml + '</div>' +
      '</div>' +

      mapSection +

    '</div>';
}

/* ── 페이지네이션 ─────────────────────────────── */
function renderPagination() {
  const totalPages = Math.ceil(state.totalCount / state.numOfRows) || 1;
  const cur        = state.pageNo;
  let start = Math.max(1, cur - 2);
  let end   = Math.min(totalPages, cur + 2);
  if (end - start < 4) {
    if (start === 1) end   = Math.min(totalPages, start + 4);
    else             start = Math.max(1, end - 4);
  }

  let html = '<button class="page-btn" onclick="goPage(' + (cur-1) + ')" ' + (cur===1?'disabled':'') + '>‹</button>';

  if (start > 1) {
    html += '<button class="page-btn" onclick="goPage(1)">1</button>';
    if (start > 2) html += '<span style="padding:0 0.2rem;color:var(--ink-light)">…</span>';
  }

  for (let p = start; p <= end; p++) {
    html += '<button class="page-btn' + (p===cur?' active':'') + '" onclick="goPage(' + p + ')">' + p + '</button>';
  }

  if (end < totalPages) {
    if (end < totalPages - 1) html += '<span style="padding:0 0.2rem;color:var(--ink-light)">…</span>';
    html += '<button class="page-btn" onclick="goPage(' + totalPages + ')">' + totalPages + '</button>';
  }

  html += '<button class="page-btn" onclick="goPage(' + (cur+1) + ')" ' + (cur>=totalPages?'disabled':'') + '>›</button>';

  el.paginationBar.innerHTML = html;
}

function goPage(p) {
  const totalPages = Math.ceil(state.totalCount / state.numOfRows) || 1;
  if (p < 1 || p > totalPages) return;
  state.pageNo = p;
  fetchLibraries();
  el.libraryList.scrollTop = 0;
}

/* ── 통계 ─────────────────────────────────────── */
function updateStats() {
  el.statTotal.textContent    = state.totalCount || '—';
  el.statFiltered.textContent = state.filtered.length || '—';
  el.statPage.textContent     = state.totalCount
    ? state.pageNo + ' / ' + Math.ceil(state.totalCount / state.numOfRows)
    : '—';
}

function setStatus(text) { el.statStatus.textContent = text; }

/* ── 폴백 샘플 ────────────────────────────────── */
function renderFallback() {
  const FALLBACK = [
    {
      lbrrynm: '양천중앙도서관',
      rdnmadr: '서울특별시 양천구 신정로7길 81',
      phonenumber: '02-2699-5919',
      hompageurl: 'https://lib.yangcheon.or.kr/yclib/',
      wkdayoperbgngtm: '9:00', wkdayoperendtm: '22:00',
      satoperbgngtm: '9:00', satoperendtm: '18:00',
      hloperbgngtm: '', hloperendtm: '',
      closeday: '금요일+공휴일',
      bookco: '76603', seatco: '1259',
      latitude: '37.5136560000', longitude: '126.8337280000',
      lbrryty: '공공도서관', operinestitutionnm: '양천문화재단',
      emdnm: '신정3동', partclr: '',
    },
    {
      lbrrynm: '신월음악도서관',
      rdnmadr: '서울특별시 양천구 오목로5길 34',
      phonenumber: '02-2691-5919',
      hompageurl: 'https://lib.yangcheon.or.kr/libsin/',
      wkdayoperbgngtm: '9:00', wkdayoperendtm: '22:00',
      satoperbgngtm: '9:00', satoperendtm: '18:00',
      hloperbgngtm: '', hloperendtm: '',
      closeday: '월요일+공휴일',
      bookco: '62439', seatco: '200',
      latitude: '37.5246790000', longitude: '126.8401520000',
      lbrryty: '공공도서관', operinestitutionnm: '양천문화재단',
      emdnm: '신월4동', partclr: '',
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
function showToast(msg, type) {
  type = type || '';
  el.toast.textContent = msg;
  el.toast.className   = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.toast.className = 'toast'; }, 3800);
}

function showLoading(v) {
  el.loadingOverlay.classList.toggle('hidden', !v);
}

window.selectLibrary = selectLibrary;
window.goPage        = goPage;
