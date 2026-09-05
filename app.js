/**
 * 식물 성장 분석 AI 모바일 앱 (app.js)
 * - 앨범 업로드 버튼 & 파일 선택 창 즉시 연동 및 자동 분석
 * - 식물학적 스케일 착시 보정 & 엄격한 D-Day 안전장치 프롬프트 주입
 * - UTF-8 인코딩 및 한국어 완전 지원
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ────────────────────────────────────────────────────────
   * 0. 상수 및 설정
   * ──────────────────────────────────────────────────────── */
  const GEMINI_API_KEY = 'AQ.Ab8RN6K0JuqxqiGe7alYp7TDhmnRHtiX3YJqVHfnWXimILgINQ';
  const GEMINI_MODELS = [
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-flash-latest'
  ];

  /* ────────────────────────────────────────────────────────
   * 1. 앱 상태 변수
   * ──────────────────────────────────────────────────────── */
  let currentPlant = PLANTS_DATA.bean;
  let currentStream = null;
  let capturedImageSrc = null;
  let currentAnalysis = null;

  /* ────────────────────────────────────────────────────────
   * 2. DOM 엘리먼트 참조
   * ──────────────────────────────────────────────────────── */
  const screens = {
    select: document.getElementById('screen-select'),
    camera: document.getElementById('screen-camera'),
    scanning: document.getElementById('screen-scanning'),
    report: document.getElementById('screen-report'),
  };

  const choiceCards = document.querySelectorAll('.plant-choice-card');
  const previewPlantName = document.getElementById('preview-plant-name');
  const previewTotalDays = document.getElementById('preview-total-days');
  const previewOptimalTemp = document.getElementById('preview-optimal-temp');
  const previewSunlight = document.getElementById('preview-sunlight');
  const previewWatering = document.getElementById('preview-watering');
  const previewStagesCount = document.getElementById('preview-stages-count');
  const sampleScroll = document.getElementById('sample-scroll');

  const btnGoToCamera = document.getElementById('btn-go-to-camera');
  const btnBackToSelect = document.getElementById('btn-back-to-select');
  const btnRescan = document.getElementById('btn-rescan');
  const btnSwitchCam = document.getElementById('btn-switch-cam');
  const btnSaveDiary = document.getElementById('btn-save-diary');
  const btnViewHistory = document.getElementById('btn-view-history');
  const btnCloseHistory = document.getElementById('btn-close-history');
  const historyDrawer = document.getElementById('history-drawer');
  const historyList = document.getElementById('history-list');

  const videoElem = document.getElementById('camera-video');
  const previewImg = document.getElementById('preview-img');
  const canvasElem = document.getElementById('analysis-canvas');
  const btnShutter = document.getElementById('btn-shutter');

  const scanImgPreview = document.getElementById('scan-img-preview');
  const scanStatusText = document.getElementById('scan-status-text');
  const scanLogText = document.getElementById('scan-log-text');
  const scanProgressBar = document.getElementById('scan-progress-bar');
  const scanBoundingBox = document.getElementById('scan-bounding-box');
  const scanBoxLabel = document.getElementById('scan-box-label');

  const reportDdayNum = document.getElementById('report-dday-num');
  const reportHarvestDate = document.getElementById('report-harvest-date');
  const reportPlantBadge = document.getElementById('report-plant-badge');
  const reportConfidence = document.getElementById('report-confidence');
  const reportStageName = document.getElementById('report-stage-name');
  const reportProgressPct = document.getElementById('report-progress-pct');
  const reportProgressFill = document.getElementById('report-progress-fill');
  const reportElapsedDays = document.getElementById('report-elapsed-days');
  const reportCareWater = document.getElementById('report-care-water');
  const reportCareSun = document.getElementById('report-care-sun');
  const reportCareTemp = document.getElementById('report-care-temp');
  const reportAiAdvice = document.getElementById('report-ai-advice');
  const reportRoadmapList = document.getElementById('report-roadmap-list');
  const morphScaleTag = document.getElementById('morph-scale-tag');
  const morphMarginTag = document.getElementById('morph-margin-tag');
  const morphSafetyTag = document.getElementById('morph-safety-tag');

  /* ────────────────────────────────────────────────────────
   * 2-1. 테마 관리 (다크 / 라이트 모드 전환 & localStorage)
   * ──────────────────────────────────────────────────────── */
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const themeIcon = document.getElementById('theme-icon');

  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    if (themeIcon) {
      themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
    if (btnThemeToggle) {
      btnThemeToggle.setAttribute('title', theme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환');
      btnThemeToggle.setAttribute('aria-label', theme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환');
    }
    try {
      localStorage.setItem('plant_theme', theme);
    } catch (e) {
      console.warn('localStorage 저장 실패:', e);
    }
  }

  // 저장된 테마 불러오기 (기본: 다크 모드)
  try {
    const savedTheme = localStorage.getItem('plant_theme') || 'dark';
    applyTheme(savedTheme);
  } catch (e) {
    applyTheme('dark');
  }

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const currentTheme = document.body.getAttribute('data-theme') || 'dark';
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(nextTheme);
    });
  }

  /* ────────────────────────────────────────────────────────
   * 3. [앨범 업로드] 파일 인풋 엘리먼트 보장 및 바인딩
   * ──────────────────────────────────────────────────────── */
  let plantFileInput = document.getElementById('plantFileInput') ||
    document.getElementById('imageInput') ||
    document.getElementById('plant-file-input');

  if (!plantFileInput) {
    plantFileInput = document.createElement('input');
    plantFileInput.type = 'file';
    plantFileInput.id = 'plantFileInput';
    plantFileInput.accept = 'image/*';
    plantFileInput.style.display = 'none';
    document.body.appendChild(plantFileInput);
  } else {
    plantFileInput.removeAttribute('capture');
    plantFileInput.accept = 'image/*';
    plantFileInput.style.display = 'none';
  }

  // [앨범 업로드] 버튼 클릭 시 파일 선택 창 열기
  const btnUploadTrigger =
    document.getElementById('btn-upload-trigger') ||
    document.querySelector('[data-action="upload"]') ||
    document.querySelector('.ctrl-side-btn');

  if (btnUploadTrigger) {
    const cleanBtn = btnUploadTrigger.cloneNode(true);
    btnUploadTrigger.parentNode.replaceChild(cleanBtn, btnUploadTrigger);

    cleanBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      plantFileInput.click();
    });
  }

  // 파일 선택 즉시 '식물 분석 중...' UI 표시 및 Gemini API 자동 호출
  plantFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (evt) => {
      const dataUrl = evt.target.result;
      try { plantFileInput.value = ''; } catch (_) { }
      analyzeImage(dataUrl);
    };

    reader.onerror = () => {
      alert('이미지 파일을 읽는 중 오류가 발생했습니다. 다시 시도해주세요.');
    };

    reader.readAsDataURL(file);
  });

  /* ────────────────────────────────────────────────────────
   * 4. 화면 전환
   * ──────────────────────────────────────────────────────── */
  function switchScreen(screenName) {
    Object.values(screens).forEach(s => s && s.classList.remove('active'));
    if (screens[screenName]) {
      screens[screenName].classList.add('active');
      const container = document.querySelector('.app-screen-container');
      if (container) container.scrollTop = 0;
    }
    if (screenName !== 'camera') stopCamera();
  }

  /* ────────────────────────────────────────────────────────
   * 5. 카메라 제어
   * ──────────────────────────────────────────────────────── */
  async function startCamera() {
    if (!videoElem) return;
    videoElem.style.display = 'block';
    if (previewImg) previewImg.style.display = 'none';

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        currentStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 720 }, height: { ideal: 960 } }
        });
        videoElem.srcObject = currentStream;
        videoElem.play();
      } else {
        throw new Error('카메라 장치를 지원하지 않습니다.');
      }
    } catch (err) {
      console.warn('카메라 접근 불가:', err);
      if (videoElem) videoElem.style.display = 'none';
      if (previewImg) {
        previewImg.style.display = 'block';
        previewImg.src = currentPlant.stages[0].sampleImage;
      }
    }
  }

  function stopCamera() {
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }
  }

  // 셔터 버튼 클릭
  if (btnShutter) {
    btnShutter.addEventListener('click', () => {
      if (videoElem && videoElem.srcObject && videoElem.style.display !== 'none') {
        if (!canvasElem) return;
        canvasElem.width = videoElem.videoWidth || 640;
        canvasElem.height = videoElem.videoHeight || 480;
        canvasElem.getContext('2d').drawImage(videoElem, 0, 0, canvasElem.width, canvasElem.height);
        analyzeImage(canvasElem.toDataURL('image/jpeg', 0.88));
      } else {
        plantFileInput.click();
      }
    });
  }

  // 전면/후면 카메라 전환
  let useFacingUser = false;
  if (btnSwitchCam) {
    btnSwitchCam.addEventListener('click', async () => {
      stopCamera();
      useFacingUser = !useFacingUser;
      try {
        currentStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: useFacingUser ? 'user' : 'environment' }
        });
        videoElem.srcObject = currentStream;
        videoElem.play();
      } catch (e) {
        startCamera();
      }
    });
  }

  /* ────────────────────────────────────────────────────────
   * 6. 이미지를 JPEG Base64로 보장 (SVG 샘플 대비)
   * ──────────────────────────────────────────────────────── */
  async function ensureRasterBase64(imageSrc) {
    if (typeof imageSrc === 'string' && imageSrc.startsWith('data:image/jpeg;base64,')) {
      return imageSrc;
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || 400;
        c.height = img.naturalHeight || 400;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#0a1a11';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  }

  /* ────────────────────────────────────────────────────────
   * 7. [핵심] Google Gemini 2.5 Flash Vision API 정식 v1 호출
   * ──────────────────────────────────────────────────────── */
  async function callGeminiVisionApi(imageSrc) {
    const rasterDataUrl = await ensureRasterBase64(imageSrc);
    const base64Data = rasterDataUrl.split('base64,')[1];
    const mimeType = (rasterDataUrl.split(';')[0].split(':')[1]) || 'image/jpeg';

    // 식물학적 기준 및 안전장치가 반영된 시스템 지침
    const systemInstruction = `너는 식물 성장 분석 및 D-Day 예측 전문 AI 모델이야.
입력된 사진을 정밀 분석하고 아래의 엄격한 식물학적 안전 규칙을 반드시 준수해:

1. [크기 착시 보정 및 1단계 안전 규칙]
- 사진이 접사(클로즈업)되어 잎이 화면에 꽉 차 보이더라도 줄기가 가늘고, 흙 속 펄라이트(흰색 알갱이)와 비교해 잎이 작다면 절대 성체가 아닌 '1단계(발아/떡잎기)'로 판정해야 해.
- 하트 모양 또는 타원형의 작은 떡잎기 단계는 상추 기준 완료까지 최소 25~35일 남음으로 엄격히 계산할 것. (강낭콩은 최소 45~55일 남음) 절대로 5일이나 10일 같은 짧은 잔여일수를 부여하면 안 됨.

2. [2단계 본잎 성장기]
- 떡잎 사이로 가장자리에 톱니 모양이나 주름을 가진 고유 본잎이 나오기 시작했다면 '2단계(본잎 성장기)'로 판정하고, 상추 기준 잔여 15~20일(강낭콩은 28~40일)로 계산할 것.

3. [3단계 성숙기/수확기]
- 본잎이 화분 전체를 빽빽하게 채우고 겹겹이 풍성해졌다면 '3단계(성숙기/수확 직전)'로 판정하고 잔여 0~7일로 계산할 것.

결과는 다른 설명이나 마크다운 코드블록 없이 순수 JSON 포맷으로만 반환해:
{"stage": 1또는2또는3, "days_left": 남은날짜숫자, "reason": "형태학적 근거 설명"}`;

    const userPrompt = `선택된 식물: ${currentPlant.name} (${currentPlant.englishName}).
업로드된 식물 사진을 정밀 분석하고, 하트 모양 작은 떡잎기 단계는 상추 기준 완료까지 최소 25~35일 남음으로 엄격히 계산하여 순수 JSON 포맷 {"stage": 단계숫자, "days_left": 남은날짜숫자, "reason": "이유"} 으로만 반환해줘.`;

    const endpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${GEMINI_API_KEY}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`
    ];

    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: [{
              parts: [
                { text: userPrompt },
                { inline_data: { mime_type: mimeType, data: base64Data } }
              ]
            }],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.1
            }
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`[HTTP ${res.status}] ${errText}`);
        }

        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error('분석 응답을 받지 못했습니다.');

        let jsonStr = rawText.trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '');

        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        const parsed = JSON.parse(jsonStr);
        if (typeof parsed.stage === 'undefined' || typeof parsed.days_left === 'undefined') {
          throw new Error('반환된 데이터에 필수 필드가 누락되었습니다: ' + jsonStr);
        }

        return parsed;

      } catch (err) {
        console.warn(`엔드포인트 시도 실패:`, err.message);
        lastError = err;
      }
    }

    throw lastError || new Error('서버 연결에 실패했습니다.');
  }

  /* ────────────────────────────────────────────────────────
   * 8. analyzeImage — 이미지 분석 파이프라인
   * ──────────────────────────────────────────────────────── */
  async function analyzeImage(imageSrc) {
    capturedImageSrc = imageSrc;

    if (scanImgPreview) scanImgPreview.src = imageSrc;
    switchScreen('scanning');

    if (scanStatusText) scanStatusText.textContent = '식물 분석 중...';
    if (scanLogText) scanLogText.textContent = '식물의 생육 상태와 잔여 일수를 분석하고 있습니다.';

    let progress = 10;
    if (scanProgressBar) scanProgressBar.style.width = '10%';
    if (scanBoundingBox) {
      scanBoundingBox.style.opacity = '1';
      scanBoundingBox.style.top = '18%';
      scanBoundingBox.style.left = '16%';
      scanBoundingBox.style.width = '68%';
      scanBoundingBox.style.height = '62%';
    }
    if (scanBoxLabel) scanBoxLabel.textContent = '분석 진행 중...';

    const progressTimer = setInterval(() => {
      if (progress < 85) {
        progress += 5;
        if (scanProgressBar) scanProgressBar.style.width = `${progress}%`;
      }
    }, 120);

    try {
      const apiResult = await callGeminiVisionApi(imageSrc);

      clearInterval(progressTimer);
      if (scanProgressBar) scanProgressBar.style.width = '100%';
      if (scanStatusText) scanStatusText.textContent = '분석 완료!';
      if (scanLogText) scanLogText.textContent = '분석이 완료되었습니다. 결과 화면으로 이동합니다.';

      setTimeout(() => applyVisionApiResponse(apiResult, imageSrc), 300);

    } catch (err) {
      clearInterval(progressTimer);
      if (scanStatusText) scanStatusText.textContent = '분석 오류';
      if (scanLogText) scanLogText.textContent = err.message || 'API 호출 중 문제가 발생했습니다.';
      console.error('API Error:', err);

      setTimeout(() => {
        alert(`AI 분석 안내:\n${err.message}\n\n네트워크 상태나 사진을 확인한 후 다시 시도해주세요.`);
        switchScreen('camera');
        startCamera();
      }, 500);
    }
  }

  /* ────────────────────────────────────────────────────────
   * 9. 분석 결과 화면 렌더링
   * ──────────────────────────────────────────────────────── */
  function applyVisionApiResponse(apiResult, imgSrc) {
    const stageNum = Math.min(Math.max(Number(apiResult.stage) || 1, 1), 3);
    const stageObj = currentPlant.stages[stageNum - 1] || currentPlant.stages[0];
    const daysLeft = Math.max(0, Math.round(Number(apiResult.days_left)));
    const reasonText = apiResult.reason || stageObj.description;

    const now = new Date();
    const harvestDate = new Date(now.getTime() + daysLeft * 86400000);
    const formattedHarvestDate = `${harvestDate.getFullYear()}년 ${harvestDate.getMonth() + 1}월 ${harvestDate.getDate()}일`;

    const progressPercent = Math.min(100, Math.max(10,
      Math.round(((currentPlant.totalGrowthDays - daysLeft) / currentPlant.totalGrowthDays) * 100)
    ));

    if (reportDdayNum) reportDdayNum.textContent = daysLeft <= 0 ? 'D-Day (수확 적기!)' : `D-${daysLeft}`;
    if (reportHarvestDate) reportHarvestDate.innerHTML = daysLeft <= 0
      ? '<span>✨ 지금 바로 수확하여 드실 수 있습니다!</span>'
      : `<span>📅 예상 완료일: <strong>${formattedHarvestDate}경</strong></span>`;

    if (reportPlantBadge) reportPlantBadge.textContent = `${currentPlant.name} · ${stageObj.name}`;
    if (reportStageName) reportStageName.textContent = stageObj.name;
    if (reportProgressPct) reportProgressPct.textContent = `${progressPercent}% 달성`;
    if (reportProgressFill) reportProgressFill.style.width = `${progressPercent}%`;
    if (reportElapsedDays) reportElapsedDays.textContent = `잔여 ${daysLeft}일 / 총 ${currentPlant.totalGrowthDays}일 주기`;
    if (reportCareWater) reportCareWater.textContent = currentPlant.environment.wateringCycle;
    if (reportCareSun) reportCareSun.textContent = currentPlant.environment.sunlight;
    if (reportCareTemp) reportCareTemp.textContent = currentPlant.environment.optimalTemp;
    if (reportAiAdvice) reportAiAdvice.textContent = reasonText;
    if (morphScaleTag) morphScaleTag.textContent = `${stageObj.name} 확인`;
    if (morphMarginTag) morphMarginTag.textContent = stageObj.shortName;
    if (morphSafetyTag) morphSafetyTag.textContent = `예상 수확일까지 약 ${daysLeft}일 남음`;

    renderRoadmap(stageNum - 1);

    currentAnalysis = {
      plantId: currentPlant.id,
      plantName: currentPlant.name,
      stageIndex: stageNum - 1,
      stage: stageObj,
      totalDays: currentPlant.totalGrowthDays,
      remainingDays: daysLeft,
      harvestDateStr: formattedHarvestDate,
      imageSrc: imgSrc,
      reason: reasonText,
      timestamp: now.toISOString(),
      formattedDate: `${now.getMonth() + 1}월 ${now.getDate()}일 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
    };

    switchScreen('report');
  }

  function renderRoadmap(currentIndex) {
    if (!reportRoadmapList) return;
    reportRoadmapList.innerHTML = '';
    currentPlant.stages.forEach((st, idx) => {
      const item = document.createElement('div');
      item.className = 'stage-step-item' + (idx < currentIndex ? ' completed' : idx === currentIndex ? ' current' : '');
      item.innerHTML = `
        <div class="step-node">${idx < currentIndex ? '✓' : st.step}</div>
        <div class="step-content">
          <div class="step-header">
            <div class="step-name">${st.name}</div>
            <div class="step-days">${st.defaultRemainingDays ? '기준 잔여 약 ' + st.defaultRemainingDays + '일' : ''}</div>
          </div>
          <div class="step-desc">${st.description}</div>
        </div>
      `;
      reportRoadmapList.appendChild(item);
    });
  }

  /* ────────────────────────────────────────────────────────
   * 10. 식물 선택
   * ──────────────────────────────────────────────────────── */
  function selectPlant(plantId) {
    currentPlant = PLANTS_DATA[plantId];
    choiceCards.forEach(card => {
      card.classList.toggle('selected', card.dataset.plant === plantId);
    });
    if (previewPlantName) previewPlantName.textContent = `${currentPlant.emoji} ${currentPlant.name}`;
    if (previewTotalDays) previewTotalDays.textContent = `약 ${currentPlant.totalGrowthDays}일`;
    if (previewOptimalTemp) previewOptimalTemp.textContent = currentPlant.environment.optimalTemp;
    if (previewSunlight) previewSunlight.textContent = currentPlant.environment.sunlight;
    if (previewWatering) previewWatering.textContent = currentPlant.environment.wateringCycle;
    if (previewStagesCount) previewStagesCount.textContent = `${currentPlant.stages.length}단계 생육 모델`;
    renderSamplePresets();
  }

  choiceCards.forEach(card => card.addEventListener('click', () => selectPlant(card.dataset.plant)));

  function renderSamplePresets() {
    if (!sampleScroll) return;
    sampleScroll.innerHTML = '';
    currentPlant.stages.forEach((stage) => {
      const item = document.createElement('div');
      item.className = 'sample-item';
      item.innerHTML = `
        <div class="sample-thumb"><img src="${stage.sampleImage}" alt="${stage.name}"></div>
        <span>${stage.step}단계 (${stage.shortName})</span>
      `;
      item.addEventListener('click', () => analyzeImage(stage.sampleImage));
      sampleScroll.appendChild(item);
    });
  }

  /* ────────────────────────────────────────────────────────
   * 11. 내비게이션 버튼
   * ──────────────────────────────────────────────────────── */
  if (btnGoToCamera) btnGoToCamera.addEventListener('click', () => { switchScreen('camera'); startCamera(); });
  if (btnBackToSelect) btnBackToSelect.addEventListener('click', () => switchScreen('select'));
  if (btnRescan) btnRescan.addEventListener('click', () => { switchScreen('camera'); startCamera(); });

  /* ────────────────────────────────────────────────────────
   * 12. 성장 일지 (LocalStorage)
   * ──────────────────────────────────────────────────────── */
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem('plant_growth_diary') || '[]'); }
    catch { return []; }
  }
  function saveHistoryItem(item) {
    const list = loadHistory();
    list.unshift(item);
    if (list.length > 20) list.pop();
    localStorage.setItem('plant_growth_diary', JSON.stringify(list));
  }

  if (btnSaveDiary) {
    btnSaveDiary.addEventListener('click', () => {
      if (!currentAnalysis) return;
      saveHistoryItem(currentAnalysis);
      btnSaveDiary.innerHTML = '<span>✓ 저장 완료!</span>';
      btnSaveDiary.disabled = true;
      setTimeout(() => {
        btnSaveDiary.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          성장 일지에 저장
        `;
        btnSaveDiary.disabled = false;
      }, 2000);
    });
  }

  function renderHistoryDrawer() {
    if (!historyList) return;
    const history = loadHistory();
    historyList.innerHTML = '';
    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-history-tip">아직 저장된 식물 분석 기록이 없습니다.<br>사진을 찍고 분석한 뒤 일지에 저장해보세요!</div>';
      return;
    }
    history.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <img class="history-img" src="${entry.imageSrc}" alt="식물 사진">
        <div class="history-details">
          <div class="history-plant-title">${entry.plantName} · ${entry.stage.name}</div>
          <div class="history-dday">${entry.remainingDays === 0 ? '수확 완료 단계' : '완료까지 D-' + entry.remainingDays}</div>
          <div class="history-date">${entry.formattedDate} 분석</div>
        </div>
      `;
      item.addEventListener('click', () => {
        currentPlant = PLANTS_DATA[entry.plantId] || PLANTS_DATA.bean;
        applyVisionApiResponse({ stage: entry.stageIndex + 1, days_left: entry.remainingDays, reason: entry.reason }, entry.imageSrc);
        if (historyDrawer) historyDrawer.classList.remove('open');
      });
      historyList.appendChild(item);
    });
  }

  if (btnViewHistory) btnViewHistory.addEventListener('click', () => { renderHistoryDrawer(); if (historyDrawer) historyDrawer.classList.add('open'); });
  if (btnCloseHistory) btnCloseHistory.addEventListener('click', () => { if (historyDrawer) historyDrawer.classList.remove('open'); });
  if (historyDrawer) historyDrawer.addEventListener('click', e => { if (e.target === historyDrawer) historyDrawer.classList.remove('open'); });

  /* ────────────────────────────────────────────────────────
   * 13. 초기화
   * ──────────────────────────────────────────────────────── */
  selectPlant('bean');
  fetchWeatherByLocation(); // ★ 앱 시작 시 날씨 정보 함께 로드
}); // DOMContentLoaded


// ★ 위치 기반 날씨 및 식물 관리 팁 조회 함수
function fetchWeatherByLocation() {
  const statusEl = document.getElementById('weather-status');
  const tempEl = document.getElementById('weather-temp');
  const tipEl = document.getElementById('plant-tip');

  if (!statusEl || !tempEl || !tipEl) return;

  if (!navigator.geolocation) {
    statusEl.innerText = '⚠️ 위치 정보 미지원 브라우저';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );
        const data = await response.json();
        const weather = data.current_weather;

        const temp = weather.temperature;
        const code = weather.weathercode;

        tempEl.innerText = `${temp}°C`;

        let statusText = '☀️ 맑음';
        let tipText = '햇빛이 좋은 날입니다. 겉흙이 말랐다면 물을 주세요.';

        if ([1, 2, 3].includes(code)) {
          statusText = '⛅ 구름 조금';
          tipText = '통풍이 잘 되는 창가에 식물을 두면 좋습니다.';
        } else if ([51, 53, 55, 61, 63, 65, 80, 81].includes(code)) {
          statusText = '🌧️ 비 옴';
          tipText = '습도가 높으니 과습에 주의하고 과도한 물주기를 피하세요.';
        } else if ([71, 73, 75, 85].includes(code)) {
          statusText = '❄️ 눈 옴';
          tipText = '냉해를 입지 않도록 식물을 실내 따뜻한 곳으로 이동하세요.';
        }

        if (temp >= 30) {
          tipText += ' ⚠️ 폭염 주의! 직사광선을 피하고 분무해 주세요.';
        } else if (temp <= 5) {
          tipText += ' ❄️ 저온 주의! 냉해 위험이 있으니 베란다에서 실내로 들여놓으세요.';
        }

        statusEl.innerText = statusText;
        tipEl.innerText = tipText;

      } catch (error) {
        statusEl.innerText = '❌ 날씨 정보를 가져오지 못했습니다.';
      }
    },
    (error) => {
      statusEl.innerText = '📍 위치 권한이 거부되었습니다.';
      tipEl.innerText = '위치 권한을 허용하시면 실시간 날씨 맞춤 관리 팁을 받아보실 수 있습니다.';
    }
  );
}
// PWA 당겨서 새로고침(Pull-to-refresh) 강제 차단
let touchStartY = 0;

document.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: false });

document.addEventListener('touchmove', (e) => {
  const touchY = e.touches[0].clientY;
  const touchDiff = touchY - touchStartY;

  // 화면 최상단에서 아래로 쓸어내릴 때 새로고침 동작 차단
  if (window.scrollY === 0 && touchDiff > 0) {
    if (e.cancelable) e.preventDefault();
  }
}, { passive: false });