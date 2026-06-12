# Skin Studio — AI 피부 분석 & Skin Code 제품 추천 위젯

미국 타겟 Shopify 자사몰에 임베드하는 **AI 피부 분석 위젯**입니다.
플로우: **사진 업로드 → 피부 컨디션 분석 → MBTI식 "Skin Code" 결과 → 추천 제품 링크**

1. 고객이 셀카 한 장을 올리고 4개의 짧은 질문(MBTI 테스트 느낌)에 답하면
2. **Claude 비전 AI**가 사진에서 피부 톤(Fitzpatrick·언더톤)과 눈에 보이는 고민(홍조, 색소침착, 트러블 등)을 분석하고
3. 퀴즈와 합쳐 **4글자 Skin Code**(16타입)와 피부 프로필을 만든 뒤
4. **제품 매칭표(기준표)** 또는 성분↔고민 매칭 엔진이 **단계별 루틴**(클렌저 → 토너 → 세럼 → 보습 → 선크림 + 보너스)을 추천합니다.

추천은 "어떤 성분이 어떤 고민에 왜 좋은지"까지 영어 문장으로 설명되어 함께 노출됩니다.

## Skin Code (16타입)

미국 스킨케어 커뮤니티(레딧 등)에서 익숙한 Baumann 방식과 같은 4축 구조입니다:

| 축 | 글자 | 판정 근거 |
|---|---|---|
| Moisture | **O**ily / **D**ry | 퀴즈(세안 후 느낌) + 사진의 유분기 |
| Sensitivity | **S**ensitive / **R**esistant | 퀴즈(반응성) + 사진의 홍조 |
| Pigment | **P**igmented / **N (Even)** | 다크스팟·톤 불균형 고민(사진/퀴즈) |
| Aging | **W**rinkle-care / **T**ight | 잔주름 고민 또는 40대 이상 |

→ `OSPT "The Glow Guardian"` 같은 코드 + 페르소나 이름 + 한 줄 설명이 결과 화면 히어로로 노출됩니다.
16개 페르소나 이름/문구는 `lib/skin-code.ts`에서 수정할 수 있습니다.

---

## 동작 구조

```
고객 셀카 + 퀴즈 4문항
        │
        ▼
POST /api/analyze
        │
        ├── Claude 비전 API (구조화된 JSON 출력)
        │     └─ 톤, 보이는 고민(심각도), 요약 문장
        │
        ├── lib/profile.ts   ← 퀴즈(피부타입·민감도) + 사진(톤·고민) 병합
        │
        └── lib/recommend.ts ← 성분↔고민 매칭 점수화
              └─ data/products.json (Shopify에서 동기화한 제품 카탈로그)
        │
        ▼
피부 프로필 + 단계별 루틴 (JSON) → 결과 화면
```

| 파일 | 역할 |
|---|---|
| `lib/skin-code.ts` | **Skin Code 16타입** — 축 판정 규칙, 페르소나 이름/문구 |
| `lib/code-matrix.ts` | **제품 매칭표 로더** — `data/code-matrix.json`이 있으면 엔진보다 우선 적용 |
| `lib/ingredients.ts` | **성분 지식베이스** — 고민별 유효 성분과 가중치. 순수 데이터라 자유롭게 수정 |
| `lib/analyze-photo.ts` | Claude 비전 호출 + 데모 모드 |
| `lib/profile.ts` | 퀴즈/사진 병합 로직 |
| `lib/recommend.ts` | 점수 기반 추천 엔진 (점수 = 고민 가중치 × 성분 효능 + 피부타입 보너스 − 민감성 페널티) |
| `scripts/sync-products.mjs` | Shopify Admin API → `data/products.json` 동기화 |
| `data/products.sample.json` | 동기화 전까지 쓰는 샘플 카탈로그 17종 |
| `data/code-matrix.sample.json` | 매칭표(기준표) 포맷 예시 |

## 제품 매칭표(기준표)로 직접 매칭하기

성분 엔진 대신(또는 함께) **직접 만든 기준표**로 코드별 추천을 고정할 수 있습니다.

1. 스프레드시트로 **16개 코드 × 단계(클렌저/토너/세럼/보습/선크림…)** 표를 만들고
   각 칸에 제품 **핸들**(상품 URL 마지막 부분)을 적습니다.
2. `data/code-matrix.sample.json` 포맷대로 JSON으로 옮겨 `data/code-matrix.json`으로 저장합니다.

```json
{
  "OSPT": {
    "products": {
      "cleanser": ["clarifying-gel-cleanser"],
      "serum": ["centella-rescue-serum", "tranexamic-spot-fade-serum"],
      "sunscreen": ["daily-mineral-spf50"]
    }
  }
}
```

- 표에 **없는 코드**나 카탈로그에 없는 핸들은 자동으로 성분 엔진으로 폴백 → 일부만 채워도 동작합니다.
- 추천 사유 문구는 매칭표를 쓰더라도 성분 정보가 있으면 자동 생성됩니다.
- 기준표(엑셀/시트)를 그대로 주시면 JSON 변환은 금방입니다.

---

## 빠르게 실행해 보기

```bash
npm install
npm run dev      # http://localhost:3000
```

`ANTHROPIC_API_KEY` 없이 실행하면 **데모 모드**로 돌아갑니다 — 사진 분석 없이
퀴즈만으로 프로필을 만들고 샘플 제품을 추천하므로, 전체 UX를 키 없이 확인할 수 있습니다.

실제 AI 분석을 켜려면:

```bash
cp .env.example .env.local
# .env.local 에 ANTHROPIC_API_KEY 입력 (https://platform.claude.com 에서 발급)
```

---

## Shopify 연동

### 1. 제품에 핵심 성분 입력 (전성분 매칭의 핵심)

Shopify 관리자 → **설정 → 커스텀 데이터 → 제품**에서 메타필드 정의를 만듭니다.

- 네임스페이스/키: `custom.key_ingredients`
- 타입: **단일 텍스트(목록)** 권장 (쉼표로 구분된 한 줄 텍스트도 동작)

각 제품에 핵심 성분을 입력합니다. 예: `Niacinamide, Zinc PCA, Green Tea`
→ 동기화 스크립트가 INCI/마케팅 명칭을 표준 슬러그로 자동 정규화합니다
(별칭 테이블: `lib/ingredients.ts`).

제품 **태그**(선택):

- `category:serum` 등 — 카테고리 강제 지정 (없으면 제품 유형/제목 키워드로 추론)
- `skin:oily` `skin:dry` `skin:combination` `skin:normal` — 적합 피부타입 보너스
- `fragrance-free` — 민감 피부 추천 가산점

### 2. Admin API 토큰 발급

Shopify 관리자 → **설정 → 앱 및 판매 채널 → 앱 개발 → 앱 만들기**
→ Admin API 권한에서 `read_products` 체크 → 설치 후 토큰(`shpat_…`) 복사.

### 3. 제품 동기화

```bash
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com \
SHOPIFY_ADMIN_TOKEN=shpat_xxx \
npm run sync-products
```

`data/products.json`이 생성되며 그때부터 샘플 대신 실제 제품으로 추천합니다.
(제품이 바뀌면 다시 실행 — 배포 파이프라인에 넣어두면 편합니다.)

### 4. 스토어에 임베드

가장 간단한 방법은 **iframe**입니다. 이 앱을 Vercel 등에 배포한 뒤,
Shopify 관리자 → 온라인 스토어 → 페이지 → "Skin Quiz" 페이지를 만들고
HTML 보기로 아래를 붙여넣으세요:

```html
<iframe
  src="https://YOUR-APP.vercel.app"
  style="width:100%;min-height:88vh;border:0;border-radius:16px"
  allow="camera"
  title="AI Skin Analysis"></iframe>
```

`allow="camera"`가 있어야 iframe 안에서 "Take a selfie"가 동작합니다.
메뉴/홈 배너에서 이 페이지로 링크하면 끝.
(다음 단계로 Shopify App Proxy나 테마 앱 익스텐션으로 승격 가능 — 아래 로드맵 참고)

---

## 배포 (Vercel 기준)

1. 이 리포를 Vercel에 import
2. 환경변수 설정: `ANTHROPIC_API_KEY` (+ 선택: `CLAUDE_MODEL`, `NEXT_PUBLIC_STORE_URL`)
3. `data/products.json`은 gitignore 되어 있으므로, 빌드 전에 동기화하려면
   Vercel Build Command를 `npm run sync-products && npm run build`로 바꾸고
   `SHOPIFY_STORE_DOMAIN` / `SHOPIFY_ADMIN_TOKEN`도 환경변수로 추가

---

## 미국 시장 체크리스트 (중요)

- **생체정보법(BIPA 등)**: 일리노이·텍사스·워싱턴 주는 생체정보 수집에 명시적 동의를
  요구합니다. 이 앱은 ① 업로드 직전 동의 체크박스를 받고 ② 사진을 저장하지 않고
  실시간 처리 후 폐기하는 구조라 리스크를 최소화했지만, **스토어 개인정보처리방침에
  "AI 사진 분석" 항목을 추가**하는 것을 권장합니다.
- **의료기기/FDA**: 고객 노출 문구에서 "진단(diagnosis)"이라는 표현을 쓰지 않습니다.
  UI 전반에 "cosmetic guidance only — not medical advice" 면책을 박아뒀고, AI
  프롬프트도 의학적 병명 언급을 금지하도록 설계되어 있습니다. 마케팅 문구를 추가할 때도
  치료·진단성 표현(treat, cure, diagnose)은 피하세요.
- 사진은 Claude API로 분석 용도로만 전송되며 이 앱이 디스크에 쓰거나 로그로 남기지 않습니다.

---

## 비용 감각

분석 1회 = Claude 호출 1회(이미지 1장 + 짧은 JSON 응답). 기본 모델은
`claude-opus-4-8`이며 `.env`의 `CLAUDE_MODEL`로 바꿀 수 있습니다.
트래픽이 늘면 모델/`effort` 조정으로 단가를 낮출 수 있습니다
(`lib/analyze-photo.ts`의 `effort: "medium"` 참고).

---

## 로드맵 아이디어

- [ ] Shopify **App Proxy** 연동 → iframe 없이 스토어 도메인 경로(`/apps/skin-quiz`)에서 서빙
- [ ] 결과 페이지에 **장바구니 담기**(variant ID 기반 cart permalink) 버튼
- [ ] 결과 이메일 수집 → Klaviyo 연동 (리텐션/마케팅)
- [ ] 분석 결과 익명 통계 저장 → 머천트 대시보드
- [ ] 사진 전/후 비교(재방문 고객) — 이 경우 저장 동의·보존정책 별도 설계 필요
- [ ] WhatsApp/SMS 채널 연결 (chiqui.ai 스타일)
