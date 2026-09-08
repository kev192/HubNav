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
  const configuredTheme = configuredThemeMode === 'dark' ? 'dark' : 'light'
  // 用户在首页手动切换后的本地偏好优先；没有本地偏好时使用后台保存的默认主题。
  const themeMode = preferredThemeMode === 'dark' || preferredThemeMode === 'light'
    ? preferredThemeMode
    : configuredTheme

  return {
    configuredThemeMode: configuredTheme,
    themeMode,
    activeTheme: themeMode,
  }
}

export function getNextThemePreference(themeMode: ThemeMode): ThemeMode {
  return themeMode === 'dark' ? 'light' : 'dark'
}
