import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// 组件按标记断言（仓库既有约定：readFileSync + toContain），验证可访问性契约与关键交互钩子。
const switchSource = readFileSync('src/components/ui/Switch.svelte', 'utf8')
const tooltipSource = readFileSync('src/components/ui/Tooltip.svelte', 'utf8')
const inputGroupSource = readFileSync('src/components/ui/InputGroup.svelte', 'utf8')
const sliderSource = readFileSync('src/components/ui/Slider.svelte', 'utf8')

describe('Switch component', () => {
  it('is an accessible switch with checked state and disabled support', () => {
    expect(switchSource).toContain('role="switch"')
    expect(switchSource).toContain('aria-checked={checked}')
    expect(switchSource).toContain('export let disabled = false')
  })

  it('toggles via click and keyboard (Space/Enter) and dispatches change/bind events', () => {
    expect(switchSource).toContain('on:click={toggle}')
    expect(switchSource).toContain('on:keydown={handleKeydown}')
    expect(switchSource).toContain("event.key === ' ' || event.key === 'Enter'")
    expect(switchSource).toContain("dispatch('checked', checked)")
    expect(switchSource).toContain("dispatch('change', checked)")
  })

  it('does not toggle when disabled', () => {
    expect(switchSource).toContain('if (disabled) return')
  })
})

describe('Tooltip component', () => {
  it('trigger is a button exposing expanded state', () => {
    expect(tooltipSource).toContain('type="button"')
    expect(tooltipSource).toContain('aria-expanded={open}')
    expect(tooltipSource).toContain('role="tooltip"')
  })

  it('supports desktop hover/focus and mobile tap-to-toggle', () => {
    expect(tooltipSource).toContain('on:mouseenter={show}')
    expect(tooltipSource).toContain('on:focus={show}')
    expect(tooltipSource).toContain('on:click={togglePinned}')
  })

  it('is globally mutually exclusive and closes on outside pointer / Escape', () => {
    expect(tooltipSource).toContain("import { nextTooltipId, openTooltipId } from '../../lib/tooltipStore'")
    expect(tooltipSource).toContain('handleWindowPointerDown')
    expect(tooltipSource).toContain("event.key === 'Escape'")
  })

  it('associates the expanded bubble with its trigger', () => {
    expect(tooltipSource).toContain('aria-describedby={open && text ? bubbleId : undefined}')
    expect(tooltipSource).toContain('id={bubbleId}')
    expect(tooltipSource).toContain('role="tooltip"')
  })

  it('portals the bubble to the viewport so scrolling containers cannot clip it', () => {
    expect(tooltipSource).toContain('document.body.appendChild(node)')
    expect(tooltipSource).toContain('use:mountToBody')
    expect(tooltipSource).toContain('position: fixed')
    expect(tooltipSource).toContain('getBoundingClientRect()')
    expect(tooltipSource).toContain("window.addEventListener('scroll', handleViewportChange, true)")
  })
})

describe('InputGroup component', () => {
  it('supports a persistent unit suffix and a suffix slot for buttons/selects', () => {
    expect(inputGroupSource).toContain('export let suffixUnit')
    expect(inputGroupSource).toContain('ui-input-group-unit')
    expect(inputGroupSource).toContain('<slot name="suffix" />')
  })

  it('emits numeric values for number type', () => {
    expect(inputGroupSource).toContain("type === 'number'")
    expect(inputGroupSource).toContain("dispatch('input', value)")
    expect(inputGroupSource).toContain("dispatch('value', value)")
  })
})
describe('Slider component', () => {
  it('renders the formatted value beside the range and reuses formatSliderValue', () => {
    expect(sliderSource).toContain("from '../../lib/sliderFormat'")
    expect(sliderSource).toContain('formatSliderValue(value, { format, zeroLabel, countUnit, percentDigits })')
    expect(sliderSource).toContain('ui-slider-value')
    expect(sliderSource).toContain("type=\"range\"")
    expect(sliderSource).toContain('aria-valuetext={display}')
    expect(sliderSource).toContain("dispatch('value', value)")
  })
})
