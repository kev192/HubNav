<script lang="ts">
  // range 封装，数值显示在滑块右侧；格式化策略集中在 src/lib/sliderFormat.ts。
  import { createEventDispatcher } from 'svelte'
  import { formatSliderValue, type SliderFormatOptions } from '../../lib/sliderFormat'

  export let value = 0
  export let min = 0
  export let max = 100
  export let step = 1
  export let disabled = false
  export let label = ''
  export let ariaLabel: string | undefined = undefined
  export let inputId: string | undefined = undefined
  // 数值显示格式；默认 raw
  export let format: SliderFormatOptions['format'] = 'raw'
  export let zeroLabel: string | undefined = undefined
  export let countUnit: string | undefined = undefined
  export let percentDigits = 0

  const dispatch = createEventDispatcher<{ input: number; value: number }>()

  $: display = formatSliderValue(value, { format, zeroLabel, countUnit, percentDigits })

  function handleInput(event: Event) {
    value = Number((event.currentTarget as HTMLInputElement).value)
    // input 用于显式监听；value 让 <Slider bind:value> 遵循 Svelte 绑定约定。
    dispatch('value', value)
    dispatch('input', value)
  }
</script>

<div class="ui-slider" class:disabled>
  {#if label}
    <span class="ui-slider-label">
      {label}
      <em class="ui-slider-value">{display}</em>
    </span>
  {/if}
  <input
    id={inputId}
    type="range"
    {min}
    {max}
    {step}
    {disabled}
    value={value}
    aria-label={ariaLabel ?? (label || undefined)}
    aria-valuetext={display}
    on:input={handleInput}
  />
</div>

<style>
  .ui-slider {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .ui-slider.disabled {
    opacity: 0.6;
  }

  .ui-slider-label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    color: var(--sp-label, #334155);
    font-size: 14px;
    font-weight: 600;
  }

  .ui-slider-value {
    font-style: normal;
    color: var(--sp-accent, #2563eb);
    font-weight: 600;
  }

  .ui-slider input[type='range'] {
    width: 100%;
    box-sizing: border-box;
    padding: 0;
    accent-color: var(--sp-accent, #2563eb);
  }
</style>
