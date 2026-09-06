// 基础 Slider/数值格式化策略：把设置页里散落在各 label <em> 里的
// "N px" / "N%" / "0 → 0 (隐藏)" / "已禁用" / toFixed(2) 等格式集中到一处，
// 供 Slider 组件与相关单测复用。纯函数，无 DOM 依赖。

export type SliderValueFormat = 'px' | 'percent' | 'ratio-percent' | 'count' | 'raw'

export interface SliderFormatOptions {
  format: SliderValueFormat
  // count 模式下值为 0 时显示的语义文案，例如 "已禁用" 或 "0 (隐藏)"
  zeroLabel?: string
  // count 模式非零单位后缀，例如 "个"；默认无后缀
  countUnit?: string
  // ratio-percent 模式（0-1 → 百分比）的小数位，默认 0
  percentDigits?: number
}

// 把滑块原始数值格式化为展示文本。
// - px: `${n} px`
// - percent: `${n}%`（值本身已是百分比整数，如 0-100 或 0-50）
// - ratio-percent: 值域 0-1，输出 `${Math.round(n*100)}%`
// - count: 0 → zeroLabel（若给），否则 `${n}${countUnit}`
// - raw: 原样 `${n}`
export function formatSliderValue(value: number, options: SliderFormatOptions): string {
  const { format, zeroLabel, countUnit, percentDigits = 0 } = options

  if (!Number.isFinite(value)) {
    return ''
  }

  switch (format) {
    case 'px':
      return `${value} px`
    case 'percent':
      return `${value}%`
    case 'ratio-percent': {
      const pct = value * 100
      const rounded = percentDigits > 0 ? pct.toFixed(percentDigits) : String(Math.round(pct))
      return `${rounded}%`
    }
    case 'count':
      if (value === 0 && zeroLabel) {
        return zeroLabel
      }
      return countUnit ? `${value} ${countUnit}` : String(value)
    case 'raw':
    default:
      return String(value)
  }
}

// 把滑块值夹到 [min, max] 并按 step 对齐，供受控绑定使用。
export function clampSliderValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}
