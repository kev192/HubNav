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
  const themeMode = preferredThemeMode === 'dark' ? 'dark' : 'light'

  return {
    configuredThemeMode: configuredTheme,
    themeMode,
    activeTheme: themeMode,
  }
}

export function getNextThemePreference(themeMode: ThemeMode): ThemeMode {
  return themeMode === 'dark' ? 'light' : 'dark'
}
