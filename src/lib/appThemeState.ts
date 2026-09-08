import type { ThemeMode } from '../../shared/types'

export type ActiveTheme = 'light' | 'dark'

export type AppThemeStateInput = {
  preferredThemeMode: ThemeMode | null
  configuredThemeMode: ThemeMode | null | undefined
  systemPrefersDark: boolean
}

export type AppThemeState = {
  configuredThemeMode: ThemeMode
  themeMode: ThemeMode
  activeTheme: ActiveTheme
}

export function resolveAppThemeState({
  preferredThemeMode,
  configuredThemeMode,
  systemPrefersDark: _systemPrefersDark,
}: AppThemeStateInput): AppThemeState {
  const configuredTheme: ThemeMode = configuredThemeMode === 'dark' || configuredThemeMode === 'auto' ? configuredThemeMode : 'light'
  // 用户在首页手动切换后的本地偏好优先；没有本地偏好时使用后台保存的默认主题。
  const themeMode: ThemeMode = preferredThemeMode === 'dark' || preferredThemeMode === 'light' || preferredThemeMode === 'auto'
    ? preferredThemeMode
    : configuredTheme
  const activeTheme: ActiveTheme = themeMode === 'auto' ? (_systemPrefersDark ? 'dark' : 'light') : themeMode

  return {
    configuredThemeMode: configuredTheme,
    themeMode,
    activeTheme,
  }
}

export function getNextThemePreference(themeMode: ThemeMode): ThemeMode {
  return themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'auto' : 'light'
}
