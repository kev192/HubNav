<script lang="ts">
  import { onMount } from 'svelte'
  export let refreshToken = 0

  // Render the real public home route at a representative desktop viewport,
  // then scale that complete first screen into the unchanged preview box.
  const PREVIEW_VIEWPORT_WIDTH = 1440

  let previewFrame: HTMLElement | null = null
  let previewScale = 1
  let previewViewportHeight = 900
  let localRefreshCount = 0

  function updatePreviewScale(): void {
    if (!previewFrame || previewFrame.clientWidth === 0) return

    // The preview viewport must match the visible frame aspect exactly. A hard
    // minimum height would make the scaled iframe taller than the frame and crop
    // the bottom of the real first screen.
    previewViewportHeight = Math.max(
      1,
      Math.round(
        PREVIEW_VIEWPORT_WIDTH * previewFrame.clientHeight / previewFrame.clientWidth,
      ),
    )
    previewScale = previewFrame.clientWidth / PREVIEW_VIEWPORT_WIDTH
  }

  function refreshPreview(): void {
    localRefreshCount += 1
  }

  onMount(() => {
    const observer = new ResizeObserver(updatePreviewScale)
    if (previewFrame) observer.observe(previewFrame)
    updatePreviewScale()

    return () => observer.disconnect()
  })
</script>

<aside class="home-preview" aria-label="首页首屏预览" data-testid="settings-home-preview">
  <header class="preview-toolbar">
    <div>
      <strong>首页预览</strong>
      <span>当前前台完整首屏；保存成功后自动刷新</span>
    </div>
    <button type="button" class="preview-refresh-button" on:click={refreshPreview}>
      刷新首屏
    </button>
  </header>

  <div class="preview-frame" bind:this={previewFrame}>
    <div class="preview-stage" data-testid="home-preview-stage">
      <div
        class="preview-viewport"
        style={`--preview-scale: ${previewScale}; --preview-viewport-height: ${previewViewportHeight}px`}
      >
        <iframe
          title="当前前台首页首屏预览"
          data-testid="home-live-preview"
          src={`/?preview=${refreshToken}-${localRefreshCount}`}
          tabindex="-1"
          aria-hidden="true"
        ></iframe>
      </div>
    </div>
  </div>
</aside>

<style>
  .home-preview {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 10px;
    min-width: 0;
    min-height: 0;
    height: 100%;
  }

  .preview-toolbar {
    min-height: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .preview-toolbar > div:first-child {
    display: grid;
    gap: 2px;
  }

  .preview-toolbar strong {
    color: var(--sp-strong);
    font-size: 13px;
  }

  .preview-toolbar span {
    color: var(--sp-muted);
    font-size: 11px;
  }

  .preview-refresh-button {
    min-height: 30px;
    flex: 0 0 auto;
    border: 1px solid var(--sp-input-border);
    border-radius: 8px;
    padding: 0 10px;
    background: var(--sp-input-bg);
    color: var(--sp-muted);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    transition:
      color var(--transition-fast),
      border-color var(--transition-fast),
      background var(--transition-fast);
  }

  .preview-refresh-button:hover {
    color: var(--sp-accent);
    border-color: var(--sp-accent);
  }

  .preview-refresh-button:focus-visible {
    outline: 2px solid var(--sp-accent);
    outline-offset: 2px;
  }

  .preview-frame {
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--sp-group-border);
    border-radius: 12px;
    background: var(--sp-group-bg-strong);
    box-shadow: 0 16px 32px rgba(15, 23, 42, 0.1);
  }

  .preview-stage {
    position: relative;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .preview-viewport {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1440px;
    height: var(--preview-viewport-height, 900px);
    overflow: hidden;
    transform: translate(-50%, -50%) scale(var(--preview-scale, 1));
    transform-origin: center;
  }

  .preview-viewport iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    background: transparent;
    pointer-events: none;
  }

  @media (max-width: 1280px) {
    .home-preview {
      height: auto;
    }

    .preview-stage {
      height: 560px;
      min-height: 0;
    }
  }

  @media (max-width: 620px) {
    .preview-toolbar {
      align-items: flex-start;
    }

    .preview-stage {
      height: 500px;
    }
  }
</style>