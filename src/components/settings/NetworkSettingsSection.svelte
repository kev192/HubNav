<script lang="ts">
  import { tick } from 'svelte'
  import type { SettingsFormModel } from '../../lib/settingsForm'
  export let form: SettingsFormModel
  export let saving = false
  let probeState: 'idle' | 'testing' | 'online' | 'offline' = 'idle'
  let latency = 0

  async function testConnection() {
    const url = form.network_probe_url.trim()
    if (!url) return
    probeState = 'testing'
    latency = 0
    const started = performance.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    try {
      await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: controller.signal })
      latency = Math.round(performance.now() - started)
      probeState = 'online'
    } catch {
      probeState = 'offline'
    } finally {
      clearTimeout(timer)
      await tick()
    }
  }
</script>

<fieldset id="settings-section-network" class="group group-wide" disabled={saving}>
  <legend>网络环境切换</legend>
  <p class="group-desc">管理员选择“自动”模式时，通过此地址判断当前网络是否可以访问内网；游客始终使用外网地址。</p>
  <div class="network-settings-content">
    <label class="field">
      <span>自动模式判别 URL</span>
      <input bind:value={form.network_probe_url} type="url" placeholder="https://example.com/health" />
      <small>仅登录管理员使用。管理员选择的网络模式保存在当前浏览器，不影响游客。</small>
    </label>
    <div class="probe-row">
      <button type="button" class="probe-button" on:click={testConnection} disabled={saving || !form.network_probe_url.trim() || probeState === 'testing'}>{probeState === 'testing' ? '测试中…' : '测试连接性'}</button>
      <span class="probe-result" class:probe-ok={probeState === 'online'} class:probe-bad={probeState === 'offline'}>{probeState === 'online' ? `可访问，延迟 ${latency} ms` : probeState === 'offline' ? '无法连接' : '尚未测试'}</span>
    </div>
  </div>
</fieldset>

<style>
  .network-settings-content {
    display: grid;
    gap: 16px;
    max-width: 720px;
  }

  .network-settings-content .field {
    min-width: 0;
  }

  .network-settings-content .field input {
    min-height: 42px;
  }

  .network-settings-content .field small {
    font-size: 12px;
    line-height: 1.5;
  }

  .probe-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px 14px;
  }

  .probe-button {
    border: 1px solid var(--sp-toggle-border);
    border-radius: 10px;
    padding: 9px 15px;
    background: var(--sp-toggle-bg);
    color: var(--sp-label);
    cursor: pointer;
    font: inherit;
    font-weight: 600;
  }

  .probe-button:disabled {
    opacity: .55;
    cursor: not-allowed;
  }

  .probe-result {
    color: var(--sp-muted);
    font-size: 13px;
  }

  .probe-ok { color: #16a34a; font-weight: 600; }
  .probe-bad { color: #dc2626; font-weight: 600; }

  @media (max-width: 720px) {
    .network-settings-content {
      max-width: none;
      gap: 14px;
    }

    .probe-row {
      align-items: flex-start;
      flex-direction: column;
      gap: 8px;
    }
  }
</style>
