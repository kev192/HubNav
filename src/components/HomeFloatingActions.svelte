<script lang="ts">
  import { onMount } from 'svelte'
  import type { ThemeMode } from '../../shared/types'

  type AsyncVoid<T = void> = T | Promise<T>
  const BACK_TO_TOP_VISIBILITY_OFFSET = 320

  export let isAuthenticated = false
  export let authLoading = false
  export let activeTheme: 'light' | 'dark' = 'light'
  export let themeMode: ThemeMode = 'light'
  export let onToggleTheme: (() => AsyncVoid) | undefined = undefined
  export let onSwitchToAdmin: (() => AsyncVoid) | undefined = undefined
  export let onLogout: (() => AsyncVoid) | undefined = undefined
  export let onOpenLogin: (() => AsyncVoid) | undefined = undefined
  export let topNavigation = false

  let showBackToTop = false

  $: nextThemeLabel = themeMode === 'light' ? '暗色模式' : themeMode === 'dark' ? '跟随系统' : '浅色模式'
  $: currentThemeLabel = themeMode === 'auto' ? `跟随系统（当前${activeTheme === 'dark' ? '暗色' : '浅色'}）` : activeTheme === 'dark' ? '暗色模式' : '浅色模式'
  $: themeToggleLabel = `当前${currentThemeLabel}，点击切换到${nextThemeLabel}`

  function handleToggleTheme() {
    void onToggleTheme?.()
  }

  function handleSwitchToAdmin() {
    void onSwitchToAdmin?.()
  }

  function handleLogout() {
    void onLogout?.()
  }

  function handleOpenLogin() {
    void onOpenLogin?.()
  }

  function updateBackToTopVisibility() {
    showBackToTop = window.scrollY > BACK_TO_TOP_VISIBILITY_OFFSET
  }

  function handleBackToTop() {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    window.scrollTo({ top: 0, behavior })
  }

  onMount(() => {
    updateBackToTopVisibility()
    window.addEventListener('scroll', updateBackToTopVisibility, { passive: true })

    return () => window.removeEventListener('scroll', updateBackToTopVisibility)
  })
</script>

<div class="floating-actions" class:below-top-navigation={topNavigation}>
  <button
    type="button"
    class="icon-button theme-toggle-button"
    data-testid="home-theme-toggle"
    class:is-dark={activeTheme === 'dark'}
    on:click={handleToggleTheme}
    title={themeToggleLabel}
    aria-label={themeToggleLabel}
  >
    {#if themeMode === 'auto'}
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    {:else if activeTheme === 'dark'}
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z" />
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    {/if}
  </button>
  {#if isAuthenticated}
    <button
      type="button"
      class="icon-button admin-entry-button"
      data-testid="home-admin-button"
      on:click={handleSwitchToAdmin}
      title="管理后台"
      aria-label="管理后台"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.4v-2.6h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.1H15v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1V14h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </svg>
    </button>
    <button
      type="button"
      class="icon-button"
      data-testid="home-logout-button"
      on:click={handleLogout}
      disabled={authLoading}
      title="退出登录"
      aria-label="退出登录"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" x2="9" y1="12" y2="12" />
      </svg>
    </button>
  {:else}
    <button
      type="button"
      class="icon-button admin-entry-button"
      data-testid="home-login-button"
      on:click={handleOpenLogin}
      title="管理员登录"
      aria-label="管理员登录"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.4v-2.6h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.1H15v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1V14h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </svg>
    </button>
  {/if}
</div>

{#if showBackToTop}
  <button
    type="button"
    class="icon-button back-to-top-button"
    data-testid="home-back-to-top"
    on:click={handleBackToTop}
    title="回到顶部"
    aria-label="回到顶部"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 14.5 12 9l5.5 5.5" />
    </svg>
  </button>
{/if}

<style>
  .floating-actions {
    position: fixed;
    top: 1.25rem;
    right: 1.25rem;
    z-index: 70;
    display: flex;
    gap: 0.5rem;
  }

  /* 顶部导航模式：与固定导航栏（top:12px、高 52px）首行垂直居中对齐。
     悬浮在导航栏之上（z-index 70 > 导航栏 60），宽视口右缘重叠时不被遮挡（OQ-C2）。 */
  .floating-actions.below-top-navigation {
    top: 1.125rem;
  }

  .back-to-top-button {
    position: fixed;
    right: max(1.25rem, env(safe-area-inset-right));
    bottom: max(1.25rem, env(safe-area-inset-bottom));
    z-index: 50;
    color: #2563eb;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
  }

  .back-to-top-button svg {
    width: 1.35rem;
    height: 1.35rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .icon-button {
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.82);
    font-size: 1.15rem;
    line-height: 1;
    cursor: pointer;
    transition: background var(--transition-base), border-color var(--transition-base), transform var(--transition-base);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .icon-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.95);
    border-color: rgba(37, 99, 235, 0.45);
    transform: translateY(-1px);
  }

  .theme-toggle-button {
    color: #0f172a;
    font-weight: 700;
  }

  .theme-toggle-button.is-dark {
    background: rgba(15, 23, 42, 0.82);
    color: #e5eefb;
  }

  .icon-button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .icon-button svg {
    width: 1.2em;
    height: 1.2em;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .admin-entry-button svg {
    width: 1.42em;
    height: 1.42em;
    stroke-width: 2.15;
  }

  :global([data-theme='dark']) .icon-button {
    background: rgba(15, 23, 42, 0.7);
    border-color: rgba(148, 163, 184, 0.32);
    color: #e5eefb;
  }

  :global([data-theme='dark']) .icon-button:hover:not(:disabled) {
    background: rgba(15, 23, 42, 0.85);
  }

  :global([data-theme='dark']) .back-to-top-button {
    color: #7dd3fc;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
  }

  @media (max-width: 799px) {
    .floating-actions {
      top: 1rem;
      right: 1rem;
    }

    .floating-actions.below-top-navigation {
      /* 移动端顶部导航 top:8px、高 48px；按钮垂直居中对齐首行，不遮挡搜索框 */
      top: 0.85rem;
    }

    .icon-button {
      width: 2.2rem;
      height: 2.2rem;
      font-size: 1rem;
    }

    .back-to-top-button {
      right: max(1rem, env(safe-area-inset-right));
      bottom: max(1rem, env(safe-area-inset-bottom));
    }
  }
</style>
