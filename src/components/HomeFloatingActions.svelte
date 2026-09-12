<script lang="ts">
  import { onMount } from 'svelte'
  import type { ThemeMode } from '../../shared/types'
  import {
    getNetworkMode,
    setNetworkMode,
    setResolvedNetworkMode,
    type NetworkMode,
  } from '../lib/networkMode'

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
  export let networkProbeUrl = ''

  let showBackToTop = false
  let networkMode: NetworkMode = 'external'
  let networkProbeSequence = 0
  let networkOnline: boolean | null = null
  let probing = false
  let lastAutoProbeUrl = ''

  $: nextThemeLabel = themeMode === 'light' ? '暗色模式' : themeMode === 'dark' ? '跟随系统' : '浅色模式'
  $: currentThemeLabel = themeMode === 'auto' ? `跟随系统（当前${activeTheme === 'dark' ? '暗色' : '浅色'}）` : activeTheme === 'dark' ? '暗色模式' : '浅色模式'
  $: themeToggleLabel = `当前${currentThemeLabel}，点击切换到${nextThemeLabel}`

  async function probeNetworkMode(sequence: number, probe = networkProbeUrl): Promise<void> {
    probing = true
    try {
      if (!probe) throw new Error('no probe')
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      try {
        await fetch(probe, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal,
        })
        if (sequence !== networkProbeSequence) return
        networkOnline = true
        setResolvedNetworkMode('internal')
      } finally {
        clearTimeout(timer)
      }
    } catch {
      if (sequence !== networkProbeSequence) return
      networkOnline = false
      setResolvedNetworkMode('external')
    } finally {
      if (sequence === networkProbeSequence) probing = false
    }
  }

  async function toggleNetworkMode() {
    const order: readonly NetworkMode[] = ['external', 'internal', 'auto']
    const nextMode = order[(order.indexOf(networkMode) + 1) % order.length]
    const sequence = ++networkProbeSequence
    networkMode = nextMode
    networkOnline = nextMode === 'internal' ? true : null
    setNetworkMode(nextMode)

    if (nextMode === 'auto') {
      // Keep the last auto result while probing instead of silently routing a
      // click to the external URL during the detection window.
      await probeNetworkMode(sequence)
      return
    }

    probing = false
    setResolvedNetworkMode(nextMode)
  }

  $: networkLabel = networkMode === "external" ? "外网" : networkMode === "internal" ? "内网" : "自动"
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

  // Public settings load asynchronously. Once the probe URL becomes available,
  // resolve a server-configured auto mode instead of permanently falling back
  // to the external URL.
  $: if (networkProbeUrl && networkMode === 'auto' && networkProbeUrl !== lastAutoProbeUrl) {
    lastAutoProbeUrl = networkProbeUrl
    void probeNetworkMode(++networkProbeSequence)
  }

  onMount(() => {
    networkMode = getNetworkMode()
    document.documentElement.dataset.networkMode = networkMode
    document.documentElement.dataset.networkResolvedMode = networkMode === 'auto'
      ? (document.documentElement.dataset.networkResolvedMode || 'external')
      : networkMode
    updateBackToTopVisibility()
    window.addEventListener('scroll', updateBackToTopVisibility, { passive: true })

    return () => window.removeEventListener('scroll', updateBackToTopVisibility)
  })
</script>

{#if isAuthenticated}
  <div class="network-switch">
    <button type="button" class="icon-button network-mode-button" on:click={toggleNetworkMode} title={`网络模式：${networkLabel}`} aria-label={`网络模式：${networkLabel}`}>
      <span class="network-icon" aria-hidden="true">
        {#if networkMode === 'external'}
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.3 5.1 3.3 8.5s-1.1 6.2-3.3 8.5c-2.2-2.3-3.3-5.1-3.3-8.5S9.8 5.8 12 3.5Z" /><path d="m16.8 4.8 3.2 3.2-3.2 3.2" /></svg>
        {:else if networkMode === 'internal'}
          <svg viewBox="0 0 24 24"><path d="M4 11.2 12 4l8 7.2" /><path d="M6.5 10.2v8.3h11v-8.3M12 18.5v-4.2" /><circle cx="5" cy="20" r="1.5" /><circle cx="19" cy="20" r="1.5" /><path d="M6.2 19.5h11.6" /></svg>
        {:else}
          <svg viewBox="0 0 24 24"><path d="M4 7h11M15 4l3 3-3 3M20 17H9M9 14l-3 3 3 3" /><path d="M4 7a8 8 0 0 1 14.1-2.1M20 17a8 8 0 0 1-14.1 2.1" /></svg>
        {/if}
      </span>
    </button>
    <span class="network-status-dot" class:online={networkOnline === true} class:offline={networkOnline === false}></span>
    <span class="network-label">{networkLabel}</span>
    {#if probing}<small class="network-probe-label">检测中</small>{/if}
  </div>
{/if}
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
  .network-switch { position: fixed; left: 1.25rem; right: auto; top: 1.25rem; z-index: 70; display: flex; align-items: center; flex-wrap: nowrap; gap: .35rem; color: inherit; font-size: .8rem; font-weight: 600; }
  .network-switch .icon-button { font-size: 1.2rem; }
  .network-mode-button { border-radius: 999px; background: linear-gradient(135deg, rgba(59,130,246,.2), rgba(14,165,233,.12)); box-shadow: 0 4px 14px rgba(37,99,235,.16); }
  .network-icon { display: inline-flex; align-items: center; justify-content: center; }
  .network-icon svg { width: 1.25rem; height: 1.25rem; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .network-status-dot { width: .48rem; height: .48rem; border-radius: 50%; background: #22c55e; margin-left: .05rem; box-shadow: 0 0 0 3px rgba(34,197,94,.16); }
  .network-status-dot.online { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.16); }

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
    .network-switch {
      left: max(.75rem, env(safe-area-inset-left));
      right: auto;
      top: .65rem;
      gap: 0;
    }

    .network-switch .icon-button {
      width: 1.88rem;
      height: 1.88rem;
      font-size: .96rem;
    }

    .network-status-dot,
    .network-label,
    .network-probe-label {
      display: none;
    }

    .floating-actions {
      top: .65rem;
      right: max(.75rem, env(safe-area-inset-right));
      gap: .35rem;
    }

    .floating-actions.below-top-navigation {
      top: .65rem;
    }

    /* 只缩放顶部操作行；回到顶部按钮保持原尺寸。 */
    .floating-actions .icon-button {
      width: 1.76rem;
      height: 1.76rem;
      font-size: .8rem;
    }

    .back-to-top-button {
      right: max(1rem, env(safe-area-inset-right));
      bottom: max(1rem, env(safe-area-inset-bottom));
    }
  }
</style>
