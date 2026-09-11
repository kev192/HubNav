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
    probeState = 'testing'; latency = 0
    const started = performance.now(); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 6000)
    try { await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: controller.signal }); latency = Math.round(performance.now() - started); probeState = 'online' }
    catch { probeState = 'offline' }
    finally { clearTimeout(timer); await tick() }
  }
</script>
<fieldset id="settings-section-network" class="group group-wide" disabled={saving}>
  <legend>网络环境切换</legend>
  <p class="group-desc">设置访客默认使用的地址，并可测试自动模式的网络连通性。</p>
  <div class="form-grid">
    <label class="field"><span>默认网络模式</span><select bind:value={form.network_mode}><option value="external">外网</option><option value="internal">内网</option><option value="auto">自动</option></select></label>
    <label class="field"><span>自动模式判别 URL</span><input bind:value={form.network_probe_url} type="url" placeholder="https://example.com/health" /></label>
    <div class="probe-row"><button type="button" class="probe-button" on:click={testConnection} disabled={saving || !form.network_probe_url.trim() || probeState === 'testing'}>{probeState === 'testing' ? '测试中…' : '测试连接性'}</button><span class:probe-ok={probeState === 'online'} class:probe-bad={probeState === 'offline'}>{probeState === 'online' ? `可访问，延迟 ${latency} ms` : probeState === 'offline' ? '无法连接' : '尚未测试'}</span></div>
  </div>
</fieldset>
<style>
  .form-grid { align-items: end; gap: 18px; }
  .field { min-width: 0; }
  .field input, .field select { min-height: 42px; }
  .probe-row { grid-column: 1 / -1; display:flex; align-items:center; gap:12px; }
  .probe-button { border:1px solid var(--sp-toggle-border); border-radius:10px; padding:9px 15px; background:var(--sp-toggle-bg); color:var(--sp-label); cursor:pointer; }
  .probe-button:disabled { opacity:.55; cursor:not-allowed; }
  .probe-ok { color:#16a34a; font-weight:600; } .probe-bad { color:#dc2626; font-weight:600; }
</style>
