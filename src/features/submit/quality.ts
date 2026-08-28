/**
 * ISSUE-20 — 촬영 품질 사전 경고 (차단이 아닌 경고)
 * 밝기(과노출/저노출)와 선명도(라플라시안 분산 근사)를 클라이언트에서 검사한다.
 * 임계값은 아래 상수에서 조정 — 휴리스틱만으로 조용히 거부하지 않는다.
 */

export const QUALITY_THRESHOLDS = {
  /** 평균 밝기(0~255)가 이 값 이상이면 과노출 경고 */
  OVEREXPOSED_MEAN: 235,
  /** 평균 밝기(0~255)가 이 값 이하면 저노출 경고 */
  UNDEREXPOSED_MEAN: 40,
  /** 라플라시안 분산이 이 값 미만이면 흐림 경고 (다운스케일 기준) */
  BLUR_VARIANCE: 55,
  /** 분석용 다운스케일 크기 */
  SAMPLE_SIZE: 96,
} as const;

export interface QualityResult {
  warnings: string[];
  meanLuma: number;
  blurVariance: number;
}

export async function analyzeImageQuality(file: File): Promise<QualityResult> {
  const none: QualityResult = { warnings: [], meanLuma: 128, blurVariance: 999 };
  try {
    const bitmap = await createImageBitmap(file);
    const S = QUALITY_THRESHOLDS.SAMPLE_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return none;
    ctx.drawImage(bitmap, 0, 0, S, S);
    bitmap.close?.();
    const { data } = ctx.getImageData(0, 0, S, S);

    // 휘도 맵
    const luma = new Float32Array(S * S);
    let sum = 0;
    for (let i = 0; i < S * S; i += 1) {
      const y = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      luma[i] = y;
      sum += y;
    }
    const mean = sum / (S * S);

    // 라플라시안(4방향) 분산 — 낮으면 흐림
    let lapSum = 0;
    let lapSqSum = 0;
    let n = 0;
    for (let y = 1; y < S - 1; y += 1) {
      for (let x = 1; x < S - 1; x += 1) {
        const i = y * S + x;
        const lap = luma[i - 1] + luma[i + 1] + luma[i - S] + luma[i + S] - 4 * luma[i];
        lapSum += lap;
        lapSqSum += lap * lap;
        n += 1;
      }
    }
    const lapMean = lapSum / n;
    const variance = lapSqSum / n - lapMean * lapMean;

    const warnings: string[] = [];
    if (mean >= QUALITY_THRESHOLDS.OVEREXPOSED_MEAN) warnings.push("너무 밝게 찍혔어요");
    if (mean <= QUALITY_THRESHOLDS.UNDEREXPOSED_MEAN) warnings.push("너무 어둡게 찍혔어요");
    if (variance < QUALITY_THRESHOLDS.BLUR_VARIANCE) warnings.push("흐릿하게 찍힌 것 같아요");

    return { warnings, meanLuma: mean, blurVariance: variance };
  } catch {
    // 분석 실패는 제출을 막지 않는다
    return none;
  }
}
