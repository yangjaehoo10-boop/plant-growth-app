/**
 * 식물 성장 분석 데이터 및 식물학적 기준 엔진 (강낭콩 & 상추)
 * - 크기/스케일 오인 방지 (접사 착시 보정)
 * - 엄격한 3대 생육 단계 정의
 * - D-Day 최소 주기 안전장치 (Safety Clamps)
 * - LLM 비전 정밀 프롬프트 탑재
 */

// 고품질 SVG 단계별 샘플 식물 이미지 생성기 (스케일 비교용 펄라이트/흙 입자 디테일 반영)
function generatePlantSVG(type, stageIndex) {
  if (type === 'bean') {
    const beanVisuals = [
      // 1단계: 발아 및 떡잎기 (줄기 매우 가늘고 연약, 흙과 펄라이트 알갱이 대비 작은 떡잎)
      `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="320" fill="#17261d"/>
        <!-- 흙 표면 & 펄라이트(흰색 알갱이들) - 스케일 기준점 -->
        <path d="M0,230 Q160,220 320,230 L320,320 L0,320 Z" fill="#3b2618"/>
        <!-- 펄라이트 입자 (2~4mm 스케일) -->
        <circle cx="85" cy="245" r="4.5" fill="#f1f5f9" opacity="0.9"/>
        <circle cx="120" cy="265" r="3.5" fill="#e2e8f0" opacity="0.85"/>
        <circle cx="195" cy="240" r="5" fill="#f8fafc" opacity="0.95"/>
        <circle cx="230" cy="270" r="4" fill="#f1f5f9" opacity="0.9"/>
        <circle cx="160" cy="255" r="3" fill="#cbd5e1" opacity="0.8"/>
        <!-- 콩 씨앗 껍질 흔적 -->
        <ellipse cx="156" cy="232" rx="14" ry="10" fill="#651d14" transform="rotate(-15 156 232)"/>
        <!-- 가늘고 연약한 배축 (1.5mm 굵기 연출) -->
        <path d="M155,225 C154,185 140,165 155,128" fill="none" stroke="#86efac" stroke-width="4.5" stroke-linecap="round"/>
        <!-- 매끈한 전연의 둥근 자엽(떡잎) 2장 - 엽맥 단순함 -->
        <path d="M155,128 C135,124 122,108 135,96 C147,88 158,112 155,128 Z" fill="#86efac"/>
        <path d="M155,128 C175,124 188,108 175,96 C163,88 152,112 155,128 Z" fill="#4ade80"/>
        <!-- 스케일 표기 뱃지 -->
        <rect x="12" y="12" width="115" height="24" rx="6" fill="rgba(0,0,0,0.6)" stroke="#86efac" stroke-width="1"/>
        <text x="70" y="28" fill="#86efac" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle">1단계: 떡잎기 (새싹)</text>
      </svg>`,

      // 2단계: 본잎 성장기 (떡잎 사이로 3출엽 본잎 출현, 잎맥과 톱니/하트 윤곽 뚜렷해짐)
      `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="320" fill="#132219"/>
        <path d="M0,245 Q160,235 320,245 L320,320 L0,320 Z" fill="#332014"/>
        <!-- 펄라이트 입자 (본잎 대비 작아짐) -->
        <circle cx="70" cy="265" r="3.5" fill="#f8fafc" opacity="0.85"/>
        <circle cx="250" cy="275" r="4" fill="#f1f5f9" opacity="0.8"/>
        <!-- 굵어진 줄기 -->
        <path d="M160,245 Q158,165 160,105" fill="none" stroke="#22c55e" stroke-width="7" stroke-linecap="round"/>
        <!-- 아래쪽 시들어가는 떡잎 -->
        <ellipse cx="145" cy="210" rx="9" ry="5" fill="#a3e635" opacity="0.7" transform="rotate(-20 145 210)"/>
        <ellipse cx="175" cy="205" rx="9" ry="5" fill="#a3e635" opacity="0.7" transform="rotate(20 175 205)"/>
        <!-- 힘차게 돋아난 3출엽 본잎 및 뚜렷한 엽맥 -->
        <path d="M160,145 Q125,128 100,110" fill="none" stroke="#16a34a" stroke-width="4"/>
        <path d="M100,110 C75,80 100,60 125,90 C138,105 115,118 100,110 Z" fill="#22c55e"/>
        <line x1="100" y1="110" x2="114" y2="85" stroke="#86efac" stroke-width="2"/>
        <path d="M160,135 Q195,118 220,105" fill="none" stroke="#16a34a" stroke-width="4"/>
        <path d="M220,105 C245,75 220,55 195,85 C182,100 205,115 220,105 Z" fill="#16a34a"/>
        <line x1="220" y1="105" x2="206" y2="80" stroke="#86efac" stroke-width="2"/>
        <!-- 중앙 꼭대기 3번째 새 본잎 -->
        <path d="M160,105 C140,65 180,65 160,105 Z" fill="#4ade80"/>
        <rect x="12" y="12" width="125" height="24" rx="6" fill="rgba(0,0,0,0.6)" stroke="#4ade80" stroke-width="1"/>
        <text x="75" y="28" fill="#4ade80" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle">2단계: 본잎 성장기</text>
      </svg>`,

      // 3단계: 성숙기 / 수확 직전 (화분 가득 번성한 잎 군집, 굵은 원줄기와 꼬투리 맺힘)
      `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="320" fill="#0d1b12"/>
        <path d="M0,260 L320,260 L320,320 L0,320 Z" fill="#29180d"/>
        <!-- 지주대 및 굵고 단단한 줄기 -->
        <line x1="170" y1="265" x2="170" y2="30" stroke="#78716c" stroke-width="4.5"/>
        <path d="M160,260 Q135,180 165,120 T150,45" fill="none" stroke="#15803d" stroke-width="9"/>
        <!-- 풍성한 성체 잎 군집 (그늘 형성) -->
        <circle cx="105" cy="165" r="36" fill="#16a34a"/>
        <circle cx="215" cy="140" r="38" fill="#15803d"/>
        <circle cx="125" cy="95" r="32" fill="#22c55e"/>
        <circle cx="185" cy="75" r="30" fill="#16a34a"/>
        <!-- 굵고 통통하게 여문 강낭콩 꼬투리 -->
        <g stroke="#65a30d" stroke-width="9" stroke-linecap="round" fill="none">
          <path d="M185,115 Q225,145 230,195"/>
          <circle cx="202" cy="140" r="5.5" fill="#a3e635" stroke="none"/>
          <circle cx="216" cy="165" r="5.5" fill="#a3e635" stroke="none"/>
          <circle cx="225" cy="188" r="5.5" fill="#a3e635" stroke="none"/>
          <path d="M130,140 Q95,175 90,225"/>
          <circle cx="117" cy="165" r="5.5" fill="#bef264" stroke="none"/>
          <circle cx="106" cy="190" r="5.5" fill="#bef264" stroke="none"/>
          <circle cx="96" cy="215" r="5.5" fill="#bef264" stroke="none"/>
        </g>
        <rect x="12" y="12" width="135" height="24" rx="6" fill="rgba(0,0,0,0.6)" stroke="#facc15" stroke-width="1"/>
        <text x="80" y="28" fill="#facc15" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle">3단계: 성숙 및 수확기</text>
      </svg>`
    ];
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(beanVisuals[stageIndex] || beanVisuals[0]);
  } else {
    // 상추 단계별 SVG
    const lettuceVisuals = [
      // 1단계: 발아 및 떡잎기 (단순한 둥근 떡잎 2장, 연약한 실 같은 줄기, 펄라이트 대비 매우 작음)
      `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="320" fill="#18271e"/>
        <!-- 흙 배경 & 펄라이트(스케일 기준) -->
        <circle cx="160" cy="245" r="95" fill="#362215"/>
        <circle cx="95" cy="230" r="4.5" fill="#ffffff" opacity="0.95"/>
        <circle cx="130" cy="265" r="3.5" fill="#f1f5f9" opacity="0.9"/>
        <circle cx="225" cy="240" r="5" fill="#ffffff" opacity="0.95"/>
        <circle cx="190" cy="275" r="4" fill="#e2e8f0" opacity="0.85"/>
        <!-- 1~2mm 수준의 가느다란 줄기 -->
        <path d="M160,240 L160,195" stroke="#a3e635" stroke-width="3.2" stroke-linecap="round"/>
        <!-- 톱니/주름 없는 매끈하고 둥근 떡잎 2장 -->
        <ellipse cx="140" cy="190" rx="20" ry="12" fill="#86efac" transform="rotate(-15 140 190)"/>
        <ellipse cx="180" cy="190" rx="20" ry="12" fill="#4ade80" transform="rotate(15 180 190)"/>
        <!-- 미세한 단일 중심선 -->
        <line x1="160" y1="195" x2="130" y2="188" stroke="#dcfce7" stroke-width="1.2"/>
        <line x1="160" y1="195" x2="190" y2="188" stroke="#dcfce7" stroke-width="1.2"/>
        <rect x="12" y="12" width="125" height="24" rx="6" fill="rgba(0,0,0,0.6)" stroke="#86efac" stroke-width="1"/>
        <text x="75" y="28" fill="#86efac" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle">1단계: 떡잎기 (새싹)</text>
      </svg>`,

      // 2단계: 본잎 성장기 (떡잎 사이로 가장자리가 오톨도톨한 톱니/물결무늬 본잎 출현)
      `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="320" fill="#122319"/>
        <ellipse cx="160" cy="255" rx="120" ry="45" fill="#332014"/>
        <circle cx="65" cy="255" r="3.5" fill="#f8fafc" opacity="0.8"/>
        <circle cx="255" cy="265" r="4" fill="#f1f5f9" opacity="0.8"/>
        <!-- 아래쪽 작은 떡잎 흔적 -->
        <ellipse cx="135" cy="225" rx="14" ry="7" fill="#bef264" opacity="0.6"/>
        <ellipse cx="185" cy="225" rx="14" ry="7" fill="#bef264" opacity="0.6"/>
        <!-- 톱니와 주름이 생긴 본잎 3~5장 방사형 전개 -->
        <g fill="#22c55e" stroke="#16a34a" stroke-width="1.8">
          <path d="M160,225 C125,215 90,195 80,170 C80,155 115,160 152,215 Z" fill="#16a34a"/>
          <path d="M160,225 C195,215 230,195 240,170 C240,155 205,160 168,215 Z" fill="#22c55e"/>
          <path d="M160,225 C135,175 115,130 145,115 C170,105 180,155 160,225 Z" fill="#4ade80"/>
          <path d="M160,225 C175,180 205,140 180,125 C165,115 150,170 160,225 Z" fill="#86efac"/>
        </g>
        <!-- 뚜렷한 흰색 잎맥 네트워크 -->
        <path d="M160,225 Q152,165 148,122" stroke="#f0fdf4" stroke-width="2.5" fill="none" opacity="0.7"/>
        <rect x="12" y="12" width="125" height="24" rx="6" fill="rgba(0,0,0,0.6)" stroke="#4ade80" stroke-width="1"/>
        <text x="75" y="28" fill="#4ade80" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle">2단계: 본잎 성장기</text>
      </svg>`,

      // 3단계: 성숙기 / 수확 적기 (화분을 덮는 풍성한 로제트 결구, 겹겹이 중첩된 성체 쌈채소)
      `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="320" fill="#0b1a11"/>
        <ellipse cx="160" cy="270" rx="145" ry="35" fill="#24150b"/>
        <!-- 화분을 뒤덮은 겹겹의 거대한 상추 잎들 -->
        <g stroke="#14532d" stroke-width="2">
          <!-- 1단 바깥 성숙 잎 -->
          <ellipse cx="90" cy="215" rx="62" ry="40" fill="#15803d" transform="rotate(-25 90 215)"/>
          <ellipse cx="230" cy="215" rx="62" ry="40" fill="#15803d" transform="rotate(25 230 215)"/>
          <ellipse cx="160" cy="245" rx="68" ry="34" fill="#166534"/>
          <!-- 2단 주름진 풍성한 잎들 -->
          <ellipse cx="105" cy="165" rx="54" ry="42" fill="#16a34a" transform="rotate(-15 105 165)"/>
          <ellipse cx="215" cy="165" rx="54" ry="42" fill="#16a34a" transform="rotate(15 215 165)"/>
          <!-- 3단 속잎 (부드러운 연두/밝은 초록) -->
          <ellipse cx="135" cy="125" rx="42" ry="46" fill="#22c55e" transform="rotate(-8 135 125)"/>
          <ellipse cx="185" cy="125" rx="42" ry="46" fill="#4ade80" transform="rotate(8 185 125)"/>
          <ellipse cx="160" cy="98" rx="36" ry="38" fill="#86efac"/>
        </g>
        <rect x="12" y="12" width="135" height="24" rx="6" fill="rgba(0,0,0,0.6)" stroke="#facc15" stroke-width="1"/>
        <text x="80" y="28" fill="#facc15" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle">3단계: 성숙 및 수확기</text>
      </svg>`
    ];
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(lettuceVisuals[stageIndex] || lettuceVisuals[0]);
  }
}

/**
 * 식물 성장 분석 데이터 (엄격한 3단계 분류 및 D-Day 안전장치 모델)
 */
const PLANTS_DATA = {
  bean: {
    id: "bean",
    name: "강낭콩",
    scientificName: "Phaseolus vulgaris",
    englishName: "Kidney Bean",
    emoji: "🌱",
    iconColor: "#4ade80",
    themeGradient: "linear-gradient(135deg, #052e16 0%, #14532d 100%)",
    totalGrowthDays: 60, // 표준 총 생장 주기 (일)
    harvestDescription: "꼬투리가 통통하게 비대해지고 콩 알이 손에 잡힐 때 수확합니다.",
    environment: {
      optimalTemp: "20°C ~ 25°C",
      sunlight: "하루 6시간 이상 직사광선",
      wateringCycle: "겉흙이 마르면 듬뿍 (2~3일에 1회)",
      soilType: "배수가 우수한 배양토 / 부엽토"
    },
    // D-Day 절대 안전장치 (Safety Clamps)
    safetyBounds: {
      minDaysStage1: 45, // 1단계는 어떠한 경우에도 남은 날짜 45일 미만 불가! (사용자 요구사항 엄격 준수)
      maxDaysStage1: 58,
      minDaysStage2: 28, // 2단계는 28~42일 남음
      maxDaysStage2: 42,
      minDaysStage3: 0,  // 3단계는 0~10일 남음
      maxDaysStage3: 10
    },
    stages: [
      {
        step: 1,
        code: "sprout_cotyledon",
        name: "1단계: 발아 및 떡잎기",
        shortName: "발아 & 떡잎기",
        engName: "Germination & Cotyledon",
        dayRange: [1, 10],
        medianDays: 6,
        progressPercent: 15,
        defaultRemainingDays: 52, // 안전 기준: 45~55일 이상 남음
        remainingRange: [45, 58],
        description: "하트 모양 또는 둥근 자엽(떡잎)만 존재하며, 배축(줄기)이 1~2mm로 매우 가늘고 연약한 새싹 단계입니다.",
        morphologicalCues: [
          "줄기 직경 1~2mm 수준으로 극도로 가늘고 반투명함",
          "흙 입자(펄라이트) 크기와 비교했을 때 잎 크기가 소형임 (클로즈업 착시 주의)",
          "본잎(3출엽)이 아직 나오지 않았거나 떡잎 사이에 미세하게 숨어있음",
          "엽맥이 단순하거나 거의 관찰되지 않음"
        ],
        careTip: "흙이 과습하면 콩이 썩을 수 있으니 분무기로 표면만 촉촉하게 해주고 따뜻한 곳(20°C 이상)에 두세요.",
        checklist: ["실내 따뜻한 곳 보관", "과습 방지 및 표면 분무"]
      },
      {
        step: 2,
        code: "true_leaves_vegetative",
        name: "2단계: 본잎 성장기",
        shortName: "본잎 성장기",
        engName: "True Leaves & Stem Growth",
        dayRange: [11, 35],
        medianDays: 24,
        progressPercent: 55,
        defaultRemainingDays: 35, // 안전 기준: 30~40일 내외 남음
        remainingRange: [28, 42],
        description: "떡잎 위로 강낭콩 특유의 3출엽 '본잎'이 활짝 전개되고, 줄기가 단단해지며 위로 뻗어나가는 단계입니다.",
        morphologicalCues: [
          "가장자리가 뚜렷한 하트형/달걀형의 3출엽 본잎 출현",
          "잎맥(망상맥)이 뚜렷하고 줄기가 두꺼워지며 지지대를 잡으려 함",
          "화분 흙 표면보다 잎 군집이 넓어지기 시작함"
        ],
        careTip: "웃자람을 방지하기 위해 햇빛을 6시간 이상 쬐어주고, 줄기가 쓰러지지 않게 지지대를 설치해주세요.",
        checklist: ["식물 지지대 설치", "하루 6시간 이상 햇빛 제공"]
      },
      {
        step: 3,
        code: "mature_pod_harvest",
        name: "3단계: 성숙기 & 수확 직전",
        shortName: "성숙기 / 수확 직전",
        engName: "Mature Pod & Harvest",
        dayRange: [36, 60],
        medianDays: 52,
        progressPercent: 95,
        defaultRemainingDays: 7, // 안전 기준: 5~10일 내외 또는 수확기
        remainingRange: [0, 10],
        description: "꽃이 피고 진 자리에 굵고 통통한 꼬투리가 맺혀 여물었거나 수확을 앞둔 성숙 단계입니다.",
        morphologicalCues: [
          "줄기와 잎이 화분 전체를 무성하게 뒤덮음",
          "길고 통통한 꼬투리가 뚜렷하게 관찰되며 콩 알의 볼록한 윤곽이 보임",
          "하부 잎이 노르스름해지며 수확 적기에 도달함"
        ],
        careTip: "꼬투리 속 콩 알이 단단하게 만져지면 가위로 줄기를 잘라 즉시 수확하세요.",
        checklist: ["가장 굵은 꼬투리부터 차례대로 수확", "흙 수분 유지"]
      }
    ]
  },

  lettuce: {
    id: "lettuce",
    name: "상추",
    scientificName: "Lactuca sativa",
    englishName: "Lettuce",
    emoji: "🥬",
    iconColor: "#22c55e",
    themeGradient: "linear-gradient(135deg, #022c22 0%, #064e3b 100%)",
    totalGrowthDays: 40, // 표준 총 생장 주기 (일)
    harvestDescription: "손바닥 크기의 쌈 채소 잎이 겹겹이 풍성해지면 바깥 잎부터 수확합니다.",
    environment: {
      optimalTemp: "15°C ~ 20°C (서늘한 기온 선호)",
      sunlight: "반양지 또는 직사광선 4~5시간",
      wateringCycle: "흙이 마르기 전 촉촉하게 (1~2일에 1회)",
      soilType: "유기질이 풍부하고 배수가 원활한 상토"
    },
    // D-Day 절대 안전장치 (Safety Clamps)
    safetyBounds: {
      minDaysStage1: 25, // 1단계는 어떠한 경우에도 5일 내외 불가! 최소 25~30일 이상 보장! (사용자 요구사항 엄격 준수)
      maxDaysStage1: 35,
      minDaysStage2: 15, // 2단계는 15~20일 남음
      maxDaysStage2: 22,
      minDaysStage3: 0,  // 3단계는 3~7일 남음 또는 즉시 수확
      maxDaysStage3: 8
    },
    stages: [
      {
        step: 1,
        code: "sprout_cotyledon",
        name: "1단계: 발아 및 떡잎기",
        shortName: "발아 & 떡잎기",
        engName: "Germination & Cotyledon",
        dayRange: [1, 7],
        medianDays: 4,
        progressPercent: 15,
        defaultRemainingDays: 28, // 안전 기준: 25~30일 이상 남음
        remainingRange: [25, 35],
        description: "하트 모양 또는 둥근 모양의 떡잎(자엽) 2장만 존재하는 단계로, 줄기가 실처럼 매우 가늘고 연약합니다.",
        morphologicalCues: [
          "줄기가 1mm 내외로 매우 가늘고 지탱력이 약함",
          "흙 입자(펄라이트 알갱이 2~4mm)와 크기를 비교했을 때 잎 전체 크기가 불과 1cm 안팎임 (클로즈업 확대 착각 방지)",
          "잎 가장자리가 매끈하며 상추 본잎 특유의 오톨도톨한 톱니나 주름이 전혀 없음",
          "단순한 타원형 자엽 2장만 대칭으로 관찰됨"
        ],
        careTip: "광발아 종자이므로 흙을 얇게 덮고, 스프레이로 흙이 마르지 않게 촉촉함을 유지해주세요.",
        checklist: ["스프레이로 부드럽게 분무", "통풍이 잘되는 밝은 그늘에 두기"]
      },
      {
        step: 2,
        code: "true_leaves_rosette",
        name: "2단계: 본잎 성장기",
        shortName: "본잎 성장기",
        engName: "True Leaves Growth",
        dayRange: [8, 22],
        medianDays: 15,
        progressPercent: 50,
        defaultRemainingDays: 18, // 안전 기준: 15~20일 내외 남음
        remainingRange: [15, 22],
        description: "떡잎 사이로 가장자리에 톱니 모양과 주름을 가진 고유의 '본잎'이 2~5장 이상 나오며 왕성하게 자라는 단계입니다.",
        morphologicalCues: [
          "가장자리가 톱니 모양 또는 물결치는 상추 본잎 출현",
          "잎맥이 도드라지며 잎 표면의 오돌토돌한 텍스처(주름) 형성",
          "잎들이 방사형(로제트 형태)으로 펼쳐지며 펄라이트 입자 대비 뚜렷하게 큼"
        ],
        careTip: "싹이 밀집해 있다면 튼튼한 포기만 남기고 5~7cm 간격으로 솎아주기(Thinning)를 해주세요.",
        checklist: ["빽빽한 포기 솎아주기", "시원한 온도(20°C 이하) 유지"]
      },
      {
        step: 3,
        code: "mature_harvest_ready",
        name: "3단계: 성숙기 / 수확 직전",
        shortName: "성숙기 / 수확 직전",
        engName: "Mature & Harvest Ready",
        dayRange: [23, 40],
        medianDays: 34,
        progressPercent: 95,
        defaultRemainingDays: 5, // 안전 기준: 3~7일 내외 또는 즉시 수확
        remainingRange: [0, 7],
        description: "본잎이 화분이나 텃밭 흙을 완전히 가득 채우고 풍성해져, 손바닥 크기의 쌈 채소로 수확하기 딱 좋은 단계입니다.",
        morphologicalCues: [
          "화분 흙이 거의 보이지 않을 정도로 잎들이 겹겹이 풍성하게 로제트를 형성함",
          "잎 크기가 사람 손바닥 수준(12~18cm)에 달하며 잎맥이 굵고 아삭함",
          "바깥 잎부터 1~2cm 남기고 즉시 쌈으로 수확 가능한 상태"
        ],
        careTip: "가장 바깥쪽 큰 잎부터 가위나 손으로 밑동을 따면 속에서 새 잎이 계속 자라납니다.",
        checklist: ["바깥 잎부터 차례로 수확", "아침 일찍 물주기"]
      }
    ]
  }
};

/**
 * 백엔드 및 AI 모델(LLM Vision API) 전송용 공식 시스템 프롬프트 (System Prompt)
 */
const BOTANICAL_VISION_PROMPT = {
  systemPrompt: `너는 식물 성장 분석 전문가야. 입력된 사진을 정밀 분석해줘.
- 하트 모양의 작은 떡잎만 가득하다면 '발아/떡잎기'로 판단하고 남은 날짜는 반드시 25~35일 사이로 계산해. (절대 5일 같이 짧게 주면 안 됨)
- 톱니 모양 본잎이 자라기 시작했다면 '본잎 성장기'로 15~20일 남음으로 계산해.
- 화분에 본잎이 꽉 찼다면 '성숙기'로 3~7일 남음으로 계산해.
결과는 반드시 JSON 형식 {"stage": 단계숫자, "days_left": 남은날짜숫자, "reason": "이유"} 로만 반환해.`
};

// 단계별 샘플 바인딩
for (const key of Object.keys(PLANTS_DATA)) {
  const p = PLANTS_DATA[key];
  p.stages.forEach((stage, idx) => {
    stage.sampleImage = generatePlantSVG(p.id, idx);
  });
}
