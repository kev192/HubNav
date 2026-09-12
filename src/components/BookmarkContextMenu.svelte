<script lang="ts">
  type AsyncVoid<T = void> = T | Promise<T>

  export let onEdit: (() => AsyncVoid) | undefined = undefined
  export let onOpenExternal: (() => AsyncVoid) | undefined = undefined
  export let onOpenInternal: (() => AsyncVoid) | undefined = undefined
  export let hasInternal = false
  export let menuX = 0
  export let menuY = 0

  function handleEditClick() {
    void onEdit?.()
  }
</script>

<div class="bookmark-context-menu" role="menu" tabindex="-1" style={`left:${menuX}px; top:${menuY}px;`} on:click|stopPropagation on:contextmenu|stopPropagation on:keydown|stopPropagation>
  <button type="button" disabled={!hasInternal} on:click={() => void onOpenInternal?.()}>打开内网地址</button>
  <button type="button" on:click={() => void onOpenExternal?.()}>打开外网地址</button>
  {#if onEdit}<button type="button" data-testid="bookmark-context-edit" on:click={handleEditClick}>编辑</button>{/if}
</div>

<style>
  .bookmark-context-menu {
    position: fixed;
    z-index: 80;
    min-width: 88px;
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
  }

  .bookmark-context-menu button:hover {
    background: #eff6ff;
    color: #1d4ed8;
  }

  :global([data-theme='dark']) .bookmark-context-menu {
    border-color: rgba(148, 163, 184, 0.28);
    background: rgba(15, 23, 42, 0.94);
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.32);
  }

  :global([data-theme='dark']) .bookmark-context-menu button {
    color: #e5eefb;
  }

  :global([data-theme='dark']) .bookmark-context-menu button:hover {
    background: rgba(59, 130, 246, 0.18);
    color: #93c5fd;
  }
</style>
