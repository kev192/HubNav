// 跨模块共用的类型守卫。
//
// 这里只放「确实逐字相同、且不带任何领域语义」的判断。像 clampAlpha（0..1，
// NaN 回退 1）、clampPage（1..n，NaN 回退 1）、clampTitleFontSize（16..72，
// NaN 回退 32）这类函数名字看着像重复，实际每个的边界和兜底值都绑着自己的领域，
// 合并只会把语义抹平，不要往这里搬。

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
