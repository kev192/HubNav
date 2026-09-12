<script lang="ts">
  export let open = false
  export let loading = false
  export let error = ''
  export let onSubmit:
    | ((payload: { username: string; password: string }) => void | Promise<void>)
    | undefined = undefined
  export let onCancel: (() => void) | undefined = undefined

  let username = ''
  let password = ''
  let showPassword = false
  let formKey = ''

  $: nextKey = open ? 'open' : 'closed'
  $: if (nextKey !== formKey) {
    formKey = nextKey
    if (open) {
      username = ''
      password = ''
    }
  }

  async function handleSubmit() {
    await onSubmit?.({
      username: username.trim(),
      password,
    })
  }

  function handleCancel() {
    if (loading) {
      return
    }

    onCancel?.()
  }

  function toggleShowPassword() {
    showPassword = !showPassword
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
      </div>

      <form class="modal-form" on:submit|preventDefault={handleSubmit}>
        <label>
          <span>用户名</span>
          <input bind:value={username} type="text" placeholder="请输入用户名" autocomplete="username" required />
        </label>

        <label>
          <span>密码</span>
          <div class="password-control">
            <input
              value={password}
              type={showPassword ? 'text' : 'password'}
              placeholder="请输入密码"
              autocomplete="current-password"
              required
              on:input={(event) => password = event.currentTarget.value}
            />
            <button
              type="button"
              class="password-toggle"
              on:click={toggleShowPassword}
              aria-pressed={showPassword}
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? '隐藏' : '显示'}
            </button>
          </div>
        </label>

        {#if error}
          <p class="error-text">{error}</p>
        {/if}

        <div class="modal-actions">
          <button type="button" class="ghost-button" on:click={handleCancel} disabled={loading}>取消</button>
          <button type="submit" class="primary-button" disabled={loading || !username.trim() || !password}>
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
    background: color-mix(in srgb, var(--home-background-mask-color, #0f172a) 56%, transparent);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
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
    background:
      linear-gradient(145deg, color-mix(in srgb, var(--card-bg-rgb, 255 255 255) 92%, transparent), color-mix(in srgb, var(--card-bg-rgb, 255 255 255) 70%, transparent)),
      rgb(var(--card-bg-rgb, 255 255 255) / var(--card-bg-opacity, 0.82));
    color: var(--card-text-color, #0f172a);
    border: 1px solid color-mix(in srgb, var(--home-accent-color, #2563eb) 22%, transparent);
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(24px) saturate(145%);
    -webkit-backdrop-filter: blur(24px) saturate(145%);
    padding: 24px;
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
    color: var(--home-accent-color, #2563eb);
    font-weight: 700;
  }

  h2 {
    margin: 0;
    font-size: 20px;
    color: var(--card-title-color, var(--card-text-color, #0f172a));
  }

  .modal-form {
    display: grid;
    gap: 14px;
  }

  label {
    display: grid;
    gap: 8px;
    color: var(--card-text-color, #334155);
    font-size: 14px;
  }

  input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid color-mix(in srgb, var(--card-text-color, #64748b) 24%, transparent);
    border-radius: var(--radius-lg);
    padding: var(--control-padding-input);
    font-size: var(--font-size-base);
    color: var(--card-text-color, #0f172a);
    background: rgb(var(--card-bg-rgb, 255 255 255) / 0.55);
  }

  input:focus {
    outline: none;
    border-color: var(--home-accent-color, #2563eb);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  input::placeholder {
    color: #94a3b8;
  }

  .password-control {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
  }

  .password-toggle {
    border: 1px solid color-mix(in srgb, var(--card-text-color, #64748b) 24%, transparent);
    border-radius: var(--radius-lg);
    background: rgb(var(--card-bg-rgb, 255 255 255) / 0.48);
    color: var(--card-text-color, #0f172a);
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: var(--transition-base);
  }

  .password-toggle:hover {
    border-color: var(--home-accent-color, #2563eb);
    color: var(--home-accent-color, #2563eb);
  }

  .error-text {
    margin: 0;
    color: #dc2626;
    font-size: 13px;
  }


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
    background: var(--home-accent-color, #2563eb);
    color: #ffffff;
  }

  .ghost-button {
    border: 1px solid color-mix(in srgb, var(--card-text-color, #64748b) 24%, transparent);
    background: rgb(var(--card-bg-rgb, 255 255 255) / 0.48);
    color: var(--card-text-color, #0f172a);
  }

  .primary-button:disabled,
  .ghost-button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  :global(html[data-theme='dark']) .modal-backdrop {
    background: rgba(2, 6, 23, 0.68);
  }

  :global(html[data-theme='dark']) .modal-card {
    background:
      radial-gradient(circle at 12% 0%, rgba(56, 189, 248, 0.14), transparent 42%),
      linear-gradient(145deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.97));
    color: #e5eefb;
    border-color: rgba(125, 211, 252, 0.25);
    box-shadow: 0 28px 80px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.09);
  }

  :global(html[data-theme='dark']) .modal-eyebrow {
    color: #7dd3fc;
  }

  :global(html[data-theme='dark']) h2,
  :global(html[data-theme='dark']) label {
    color: #e5eefb;
  }

  :global(html[data-theme='dark']) input {
    color: #f8fafc;
    background: rgba(2, 6, 23, 0.52);
    border-color: rgba(148, 163, 184, 0.34);
  }

  :global(html[data-theme='dark']) input::placeholder {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) input:focus {
    border-color: #38bdf8;
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.16);
  }

  :global(html[data-theme='dark']) .ghost-button {
    color: #e5eefb;
    background: rgba(30, 41, 59, 0.76);
    border-color: rgba(148, 163, 184, 0.36);
  }

  :global(html[data-theme='dark']) .password-toggle {
    color: #e5eefb;
    background: rgba(30, 41, 59, 0.76);
    border-color: rgba(148, 163, 184, 0.36);
  }

  :global(html[data-theme='dark']) .primary-button {
    background: linear-gradient(135deg, #0284c7, #2563eb);
    color: #ffffff;
  }

  :global(html[data-theme='dark']) .error-text {
    color: #fca5a5;
  }
</style>
