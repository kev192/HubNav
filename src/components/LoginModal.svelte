<script lang="ts">
  export let open = false
  export let loading = false
  export let error = ''
  export let turnstileSiteKey: string | null = null
  export let onSubmit:
    | ((payload: { username: string; password: string; turnstile_token?: string }) => void | Promise<void>)
    | undefined = undefined
  export let onCancel: (() => void) | undefined = undefined

  let username = ''
  let password = ''
  let formKey = ''
  let turnstileToken = ''
  let turnstileContainer: HTMLDivElement | null = null
  let turnstileWidgetId: string | null = null

  type TurnstileApi = { render: (element: HTMLElement, options: Record<string, unknown>) => string; reset: (id?: string) => void }
  function getTurnstile(): TurnstileApi | undefined {
    return (window as Window & { turnstile?: TurnstileApi }).turnstile
  }

  $: nextKey = open ? 'open' : 'closed'
  $: if (nextKey !== formKey) {
    formKey = nextKey
    if (open) {
      username = ''
      password = ''
      turnstileToken = ''
    }
  }

  async function handleSubmit() {
    await onSubmit?.({
      username: username.trim(),
      password,
      ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
    })
  }

  function renderTurnstile(): void {
    const turnstile = getTurnstile()
    if (!turnstileSiteKey || !turnstileContainer || !turnstile || turnstileWidgetId) return
    turnstileWidgetId = turnstile.render(turnstileContainer, {
      sitekey: turnstileSiteKey,
      callback: (token: string) => { turnstileToken = token },
      'expired-callback': () => { turnstileToken = '' },
      'error-callback': () => { turnstileToken = '' },
      theme: 'auto',
    })
  }

  function loadTurnstile(): void {
    if (!turnstileSiteKey || typeof document === 'undefined') return
    if (getTurnstile()) { renderTurnstile(); return }
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-api]')
    if (existing) { existing.addEventListener('load', renderTurnstile, { once: true }); return }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.turnstileApi = 'true'
    script.addEventListener('load', renderTurnstile, { once: true })
    document.head.appendChild(script)
  }

  $: if (open && turnstileSiteKey) loadTurnstile()

  function handleCancel() {
    if (loading) {
      return
    }

    onCancel?.()
  }
</script>

{#if open}
  <div class="modal-backdrop">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
      <div class="modal-header">
        <div>
          <p class="modal-eyebrow">管理员登录</p>
          <h2 id="login-modal-title">请输入账号信息</h2>
        </div>
        <button type="button" class="ghost-button" on:click={handleCancel} disabled={loading}>取消</button>
      </div>

      <form class="modal-form" on:submit|preventDefault={handleSubmit}>
        <label>
          <span>用户名</span>
          <input bind:value={username} type="text" placeholder="请输入用户名" autocomplete="username" required />
        </label>

        {#if turnstileSiteKey}
          <div bind:this={turnstileContainer} class="turnstile-container" aria-label="人机验证"></div>
        {/if}

        <label>
          <span>密码</span>
          <input
            bind:value={password}
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
            required
          />
        </label>

        {#if error}
          <p class="error-text">{error}</p>
        {/if}

        <div class="modal-actions">
          <button type="button" class="ghost-button" on:click={handleCancel} disabled={loading}>取消</button>
          <button type="submit" class="primary-button" disabled={loading || !username.trim() || !password || (Boolean(turnstileSiteKey) && !turnstileToken)}>
            {#if loading}登录中...{:else}登录{/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(15, 23, 42, 0.56);
  }

  .modal-backdrop::before {
    content: '';
    position: absolute;
    inset: 0;
  }

  .modal-card {
    position: relative;
    width: min(100%, 420px);
    border-radius: var(--radius-xl);
    background: #ffffff;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24);
    padding: 20px;
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
  }

  .modal-eyebrow {
    margin: 0 0 6px;
    font-size: 12px;
    color: #64748b;
  }

  h2 {
    margin: 0;
    font-size: 20px;
    color: #0f172a;
  }

  .modal-form {
    display: grid;
    gap: 14px;
  }

  label {
    display: grid;
    gap: 8px;
    color: #334155;
    font-size: 14px;
  }

  input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #cbd5e1;
    border-radius: var(--radius-lg);
    padding: var(--control-padding-input);
    font-size: var(--font-size-base);
    color: #0f172a;
    background: #ffffff;
  }

  input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  .error-text {
    margin: 0;
    color: #dc2626;
    font-size: 13px;
  }

  .turnstile-container { min-height: 65px; }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 4px;
  }

  .primary-button,
  .ghost-button {
    border-radius: var(--radius-lg);
    padding: var(--control-padding-md);
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: var(--transition-base);
  }

  .primary-button {
    border: none;
    background: #2563eb;
    color: #ffffff;
  }

  .ghost-button {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #0f172a;
  }

  .primary-button:disabled,
  .ghost-button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
</style>
