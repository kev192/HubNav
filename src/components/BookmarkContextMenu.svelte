<script lang="ts">
  import { onMount, tick } from 'svelte'

  type AsyncVoid<T = void> = T | Promise<T>

  export let onEdit: (() => AsyncVoid) | undefined = undefined
  export let onOpenExternal: (() => AsyncVoid) | undefined = undefined
  export let onOpenInternal: (() => AsyncVoid) | undefined = undefined
  export let hasInternal = false
  // menuX/menuY are the original pointer coordinates in viewport space.
  export let menuX = 0
  export let menuY = 0

  let menuElement: HTMLDivElement
  let mounted = false
  let positionFrame = 0

  function mountToBody(node: HTMLElement) {
    document.body.appendChild(node)
    return {
      destroy() {
        node.remove()
      },
    }
  }

  function schedulePosition(): void {
    if (!mounted) return
    cancelAnimationFrame(positionFrame)
    positionFrame = requestAnimationFrame(() => {
      const rect = menuElement.getBoundingClientRect()
      const gap = 10
      const margin = 8
      const preferredLeft = menuX + gap
      const preferredTop = menuY + gap
      const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin)
      const maxTop = Math.max(margin, window.innerHeight - rect.height - margin)

      // Keep the menu in the pointer's lower-right quadrant. Only adjust when
      // the pointer is genuinely close to a viewport edge.
      menuElement.style.left = `${Math.max(margin, Math.min(preferredLeft, maxLeft))}px`
      menuElement.style.top = `${Math.max(margin, Math.min(preferredTop, maxTop))}px`
    })
  }

  function handleEditClick() {
    void onEdit?.()
  }

  onMount(() => {
    mounted = true
    void tick().then(schedulePosition)

    const handleResize = () => schedulePosition()
    window.addEventListener('resize', handleResize)
    return () => {
      mounted = false
      cancelAnimationFrame(positionFrame)
      window.removeEventListener('resize', handleResize)
    }
  })

  $: if (mounted) {
    menuX
    menuY
    schedulePosition()
  }
</script>

<div
  use:mountToBody
  bind:this={menuElement}
  class="bookmark-context-menu"
  role="menu"
  tabindex="-1"
  style={`left:${menuX + 10}px; top:${menuY + 10}px;`}
  on:click|stopPropagation
  on:contextmenu|stopPropagation
  on:keydown|stopPropagation
>
  <button type="button" aria-label={hasInternal ? '打开内网地址' : '打开内网地址（未设置）'} on:click={() => void onOpenInternal?.()}>打开内网地址</button>
  <button type="button" on:click={() => void onOpenExternal?.()}>打开外网地址</button>
  {#if onEdit}<button type="button" data-testid="bookmark-context-edit" on:click={handleEditClick}>编辑</button>{/if}
</div>

<style>
  .bookmark-context-menu {
    position: fixed;
    z-index: 10000;
    min-width: 150px;
    max-width: min(220px, calc(100vw - 16px));
    padding: 6px;
    border: 1px solid rgba(148, 163, 184, 0.32);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 14px 32px rgba(15, 23, 42, 0.18);
    backdrop-filter: blur(10px);
  }

  .bookmark-context-menu button {
    width: 100%;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #0f172a;
    cursor: pointer;
    font-size: 13px;
    padding: 7px 12px;
    text-align: left;
    white-space: nowrap;
  }

  .bookmark-context-menu button:hover,
  .bookmark-context-menu button:focus-visible {
    background: #eff6ff;
    color: #1d4ed8;
    outline: none;
  }

  :global([data-theme='dark']) .bookmark-context-menu {
    border-color: rgba(148, 163, 184, 0.28);
    background: rgba(15, 23, 42, 0.94);
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.32);
  }

  :global([data-theme='dark']) .bookmark-context-menu button {
    color: #e5eefb;
  }

  :global([data-theme='dark']) .bookmark-context-menu button:hover,
  :global([data-theme='dark']) .bookmark-context-menu button:focus-visible {
    background: rgba(59, 130, 246, 0.18);
    color: #93c5fd;
  }
</style>
