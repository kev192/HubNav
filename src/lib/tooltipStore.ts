// 全局 Tooltip 互斥：同一时刻只允许一个 Tooltip 展开。
// Tooltip 组件在点按打开时把自己的 id 写进来，其它已打开的据此收起。
import { writable } from 'svelte/store'

// 当前展开的 tooltip id；null 表示全部关闭
export const openTooltipId = writable<string | null>(null)

let counter = 0
export function nextTooltipId(): string {
  counter += 1
  return `ui-tooltip-${counter}`
}
