<script lang="ts">
  import { cubicOut } from 'svelte/easing'
  import type { TransitionConfig } from 'svelte/transition'
  import { toastStore } from '../lib/toast'

  $: toasts = $toastStore

  function flyFromBottom(node: HTMLElement): TransitionConfig {
    const rect = node.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    // Begin at the viewport bottom, regardless of the toast's final position.
    const distance = Math.max(viewportHeight - (rect.top + rect.height / 2), 180)

    return {
      duration: 0,
      easing: cubicOut,
      css: (t) => `transform: translateY(${(1 - t) * distance}px); opacity: ${t};`,
    }
  }

  function dismiss(id: string) {
    toastStore.dismissToast(id)
  }
</script>

{#if toasts.length > 0}
  <div class="toast-container" role="region" aria-label="通知">
    {#each toasts as toast (toast.id)}
      <div
        class="toast-item"
        class:toast-success={toast.type === 'success'}
        class:toast-error={toast.type === 'error'}
        class:toast-info={toast.type === 'info'}
        transition:flyFromBottom|global
        role="status"
        aria-live="polite"
      >
        <span class="toast-message">{toast.message}</span>
        <button
          class="toast-dismiss"
          on:click={() => dismiss(toast.id)}
          aria-label="关闭通知"
        >×</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    top: 45%;
    left: 50%;
    right: auto;
    z-index: 10020;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(calc(100vw - 32px), 420px);
    max-width: 420px;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .toast-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.45;
    box-shadow:
      0 4px 16px rgba(15, 23, 42, 0.12),
      0 1px 3px rgba(15, 23, 42, 0.06);
    pointer-events: auto;
    backdrop-filter: blur(8px);
  }

  .toast-success {
    color: #065f46;
    background: rgba(209, 250, 229, 0.92);
    border: 1px solid rgba(52, 211, 153, 0.4);
  }

  .toast-error {
    color: #991b1b;
    background: rgba(254, 226, 226, 0.92);
    border: 1px solid rgba(248, 113, 113, 0.4);
  }

  .toast-info {
    color: #1e40af;
    background: rgba(219, 234, 254, 0.92);
    border: 1px solid rgba(96, 165, 250, 0.4);
  }

  :global([data-theme='dark']) .toast-success {
    color: #6ee7b7;
    background: rgba(6, 78, 59, 0.9);
    border-color: rgba(52, 211, 153, 0.25);
  }

  :global([data-theme='dark']) .toast-error {
    color: #fca5a5;
    background: rgba(127, 29, 29, 0.9);
    border-color: rgba(248, 113, 113, 0.25);
  }

  :global([data-theme='dark']) .toast-info {
    color: #93c5fd;
    background: rgba(30, 58, 138, 0.9);
    border-color: rgba(96, 165, 250, 0.25);
  }

  .toast-message {
    flex: 1 1 0;
    min-width: 0;
  }

  .toast-dismiss {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.08);
    color: inherit;
    font-size: 16px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
  }

  .toast-dismiss:hover {
    background: rgba(0, 0, 0, 0.14);
  }

  :global([data-theme='dark']) .toast-dismiss {
    background: rgba(255, 255, 255, 0.1);
  }

  :global([data-theme='dark']) .toast-dismiss:hover {
    background: rgba(255, 255, 255, 0.18);
  }
  @media (max-width: 600px) {
    .toast-container {
      top: 45%;
      width: min(calc(100vw - 24px), 420px);
    }
  }

</style>
