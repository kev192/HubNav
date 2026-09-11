<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { CardStyle, DescriptionDisplayMode, PublicBookmark } from '../../shared/types'
  import BookmarkCardCompact from './BookmarkCardCompact.svelte'
  import { publicStore } from '../lib/stores'
  import { api } from '../lib/api'
  import BookmarkCardInfo from './BookmarkCardInfo.svelte'
  import BookmarkContextMenu from './BookmarkContextMenu.svelte'
  import BookmarkLinkModal from './BookmarkLinkModal.svelte'
  import { getIconCardTrackWidth } from '../lib/bookmarkCardLayout'
  import { buildIconStyle } from '../lib/bookmarkIconDisplay'
  import {
    BOOKMARK_CONTEXT_MENU_OPEN_EVENT,
    canOpenBookmarkContextMenu,
    createBookmarkContextMenuOpenEvent,
    isExternalContextMenuOpenEvent,
    shouldBlockCardNavigation,
    shouldOpenBookmarkModal,
  } from '../lib/bookmarkCardInteractions'
  import {
    deriveBookmarkCardIconBase,
    deriveBookmarkCardIconUrl,
  } from '../lib/bookmarkCardIconState'
  import { observeIconVisibility } from '../lib/iconVisibility'
  import {
    NETWORK_MODE_CHANGE_EVENT,
    resolveBookmarkUrl,
  } from '../lib/networkMode'
  import {
    fetchCachedBookmarkIconUrl,
    readCachedBookmarkIconDataUri,
    revokeLocalIconUrl,
  } from '../lib/localBookmarkIconCache'

  type AsyncVoid<T = void> = T | Promise<T>

  export let bookmark: PublicBookmark
  export let style: CardStyle = 'info'
  export let iconSize: number = 100
  export let showDescription: boolean = true
  export let descriptionMode: DescriptionDisplayMode = showDescription ? 'always' : 'hidden'
  export let showIconTitle: boolean = true
  export let width: number = 200
  export let height: number = 0
  export let canEdit = false
  export let sortMode = false
  export let preview = false
  export let themeOverride: 'light' | 'dark' | null = null
  export let onEdit: ((bookmark: PublicBookmark) => AsyncVoid) | undefined = undefined

  let cachedIconFailed = false
  let fallbackFailed = false
  let localCachedIconUrl = ''
  let syncLocalCachedIconUrl = ''
  let localCachePending = false
  let localCacheRequestId = 0
  let iconInView = false
  let shellElement: HTMLDivElement | null = null
  let stopIconVisibilityObserver: (() => void) | null = null
  let contextMenuOpen = false
  let contextMenuX = 0
  let contextMenuY = 0
  let modalOpen = false
  let iconStateKey = ''
  let windowListenersAttached = false
  let contextMenuInstanceId = Math.random().toString(36).slice(2)
  let networkModeRevision = 0

  $: openInNewTab = bookmark.open_method === 1
  $: selectedBookmarkUrl = getSelectedBookmarkUrl()
  $: iconBaseState = deriveBookmarkCardIconBase({
    bookmark,
    iconInView,
  })
  $: cachedIcon = iconBaseState.cachedIcon
  $: iconText = iconBaseState.iconText
  $: nextIconStateKey = iconBaseState.nextIconStateKey
  $: localCacheKey = iconBaseState.localCacheKey
  $: shouldReadLocalIconCache = iconBaseState.shouldReadLocalIconCache
  $: shouldWaitForLocalIconCache = iconBaseState.shouldWaitForLocalIconCache
  $: syncLocalCachedIconUrl = iconInView && !iconBaseState.hasEmbeddedIcon
    ? readCachedBookmarkIconDataUri(localCacheKey) ?? ''
    : ''
  $: iconUrlState = deriveBookmarkCardIconUrl({
    bookmark,
    baseState: iconBaseState,
    cachedIconFailed,
    fallbackFailed,
    syncLocalCachedIconUrl,
    localCachedIconUrl,
    localCachePending,
  })
  $: iconUrl = iconUrlState.iconUrl
  $: hasRenderableIcon = iconUrlState.hasRenderableIcon
  $: infoCardHeight = height > 0 ? height : 70
  $: infoIconInset = infoCardHeight <= 56 ? 6 : 8
  $: infoIconSize = Math.max(32, Math.min(infoCardHeight - infoIconInset * 2, width - infoIconInset * 2))
  $: compactIconSize = Math.max(0, iconSize)
  $: compactShellWidth = getIconCardTrackWidth(compactIconSize, showIconTitle)
  $: iconBackgroundColor = bookmark.icon_background_color || ''
  $: hasCustomIconBackground = Boolean(iconBackgroundColor)
  $: infoIconStyle = buildIconStyle(infoIconSize, { customBackground: iconBackgroundColor })
  $: compactIconStyle = buildIconStyle(compactIconSize, {
    compact: true,
    customBackground: iconBackgroundColor,
  })
  $: tooltipText = bookmark.description ? `${bookmark.title}\n${bookmark.description}` : bookmark.title
  $: cardShellStyle =
    style === 'info'
      ? `--card-configured-min-width: ${Math.max(0, width)}px; ${height > 0 ? `height: ${height}px;` : ''}`
      : `width: ${compactShellWidth}px;`
  $: cardLinkStyle = height > 0 ? `height: ${height}px;` : ''
  $: if (nextIconStateKey !== iconStateKey) {
    iconStateKey = nextIconStateKey
    cachedIconFailed = false
    fallbackFailed = false
    resetLocalCachedIconUrl()
    if (shouldReadLocalIconCache) {
      void loadLocalCachedIcon(localCacheKey, shouldWaitForLocalIconCache)
    } else {
      localCachePending = false
    }
  }
  $: syncWindowListeners(contextMenuOpen || modalOpen)

  function resetLocalCachedIconUrl() {
    if (localCachedIconUrl) {
      revokeLocalIconUrl(localCachedIconUrl)
      localCachedIconUrl = ''
    }
  }

  async function loadLocalCachedIcon(cacheKey: string, waitForLocalCache: boolean) {
    if (waitForLocalCache) {
      localCachePending = true
    }

    const result = await fetchCachedBookmarkIconUrl(cacheKey, { current: localCacheRequestId })
    if (result.stale) return
    if (result.url) {
      resetLocalCachedIconUrl()
      localCachedIconUrl = result.url
    }
    localCachePending = false
  }

  function handleIconError() {
    if (localCachedIconUrl) {
      resetLocalCachedIconUrl()
      return
    }

    if (!cachedIconFailed && /^data:image\//i.test(cachedIcon)) {
      cachedIconFailed = true
      return
    }

    fallbackFailed = true
  }

  function handleIconLoad() {
    localCachePending = false
    fallbackFailed = false
  }

  function closeContextMenu() {
    contextMenuOpen = false
  }

  function notifyContextMenuOpen() {
    window.dispatchEvent(createBookmarkContextMenuOpenEvent(contextMenuInstanceId))
  }

  function handleContextMenuOpenEvent(event: Event) {
    if (isExternalContextMenuOpenEvent(event, contextMenuInstanceId)) {
      closeContextMenu()
    }
  }

  function handleContextMenu(event: MouseEvent) {
    if (shouldBlockCardNavigation(sortMode)) {
      event.preventDefault()
      return
    }
    if (!canOpenBookmarkContextMenu({ sortMode, canEdit, hasEditHandler: Boolean(onEdit) })) { event.preventDefault(); return }
    event.preventDefault()
    event.stopPropagation()
    notifyContextMenuOpen()
    contextMenuX = Math.min(event.clientX + 12, window.innerWidth - 190)
    contextMenuY = Math.min(event.clientY + 12, window.innerHeight - 150)
    contextMenuOpen = true
  }

  async function handleEditClick() {
    closeContextMenu()
    await onEdit?.(bookmark)
  }

  function getSelectedBookmarkUrl(): string {
    // Keep the reactive dependency so a mode switch updates every rendered anchor.
    void networkModeRevision
    return resolveBookmarkUrl(bookmark)
  }

  function handleNetworkModeChanged() {
    networkModeRevision += 1
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key === null || event.key === 'navhub-network-mode' || event.key === 'navhub-network-resolved') {
      networkModeRevision += 1
    }
  }

  function openBookmarkUrl(url: string) {
    if (!url) return
    if (openInNewTab) window.open(url, '_blank', 'noopener,noreferrer')
    else window.location.href = url
  }
  function handleLinkClick(event: MouseEvent) {
    if (preview) {
      event.preventDefault()
      return
    }
    if (shouldBlockCardNavigation(sortMode)) {
      event.preventDefault()
      return
    }

    if (!selectedBookmarkUrl) {
      event.preventDefault()
      return
    }

    // Register click both locally and on server. For normal links we leave the
    // browser's native navigation intact; the anchor already contains the
    // network-aware URL, so new-tab/current-tab behavior remains reliable.
    publicStore.incrementClick(bookmark.id)
    void api.public.registerClick(bookmark.id)

    if (!shouldOpenBookmarkModal({ sortMode, openMethod: bookmark.open_method })) return
    event.preventDefault()
    modalOpen = true
  }

  function closeModal() {
    modalOpen = false
  }

  function handleWindowClick() {
    if (contextMenuOpen) closeContextMenu()
  }

  function handleDocumentKeydown(event: KeyboardEvent) {
    if (modalOpen && event.key === 'Escape') closeModal()
    if (contextMenuOpen && event.key === 'Escape') closeContextMenu()
  }

  function markIconInView() {
    iconInView = true
    disconnectIconObserver()
  }

  function disconnectIconObserver() {
    stopIconVisibilityObserver?.()
    stopIconVisibilityObserver = null
  }

  function setupIconObserver() {
    disconnectIconObserver()
    if (iconInView) return

    if (shellElement) {
      stopIconVisibilityObserver = observeIconVisibility(shellElement, markIconInView)
    } else {
      iconInView = true
    }
  }

  function syncWindowListeners(active: boolean) {
    if (typeof window === 'undefined') return

    if (active && !windowListenersAttached) {
      window.addEventListener('click', handleWindowClick)
      window.addEventListener('keydown', handleDocumentKeydown)
      window.addEventListener(BOOKMARK_CONTEXT_MENU_OPEN_EVENT, handleContextMenuOpenEvent)
      windowListenersAttached = true
      return
    }

    if (!active && windowListenersAttached) {
      window.removeEventListener('click', handleWindowClick)
      window.removeEventListener('keydown', handleDocumentKeydown)
      window.removeEventListener(BOOKMARK_CONTEXT_MENU_OPEN_EVENT, handleContextMenuOpenEvent)
      windowListenersAttached = false
    }
  }

  onMount(() => {
    setupIconObserver()
    window.addEventListener(NETWORK_MODE_CHANGE_EVENT, handleNetworkModeChanged)
    window.addEventListener('storage', handleStorageChange)
  })

  onDestroy(() => {
    localCacheRequestId += 1
    disconnectIconObserver()
    resetLocalCachedIconUrl()
    syncWindowListeners(false)
    window.removeEventListener(NETWORK_MODE_CHANGE_EVENT, handleNetworkModeChanged)
    window.removeEventListener('storage', handleStorageChange)
  })
</script>

<div
  class="bookmark-card-shell"
  class:is-info={style === 'info'}
  class:is-icon={style !== 'info'}
  class:sort-mode={sortMode}
  style={cardShellStyle}
  bind:this={shellElement}
>
  {#if style === 'info'}
    <BookmarkCardInfo
      {bookmark}
      bookmarkUrl={selectedBookmarkUrl}
      {openInNewTab}
      {sortMode}
      {cardLinkStyle}
      {showDescription}
      {descriptionMode}
      {tooltipText}
      iconUrl={hasRenderableIcon ? iconUrl : ''}
      {iconText}
      {infoIconSize}
      {infoIconStyle}
      {hasCustomIconBackground}
      {preview}
      {themeOverride}
      onLinkClick={handleLinkClick}
      onContextMenu={handleContextMenu}
      onIconError={handleIconError}
      onIconLoad={handleIconLoad}
    />
  {:else}
    <BookmarkCardCompact
      {bookmark}
      bookmarkUrl={selectedBookmarkUrl}
      {openInNewTab}
      {sortMode}
      {tooltipText}
      {compactIconSize}
      {compactIconStyle}
      {showIconTitle}
      iconUrl={hasRenderableIcon ? iconUrl : ''}
      {iconText}
      {hasCustomIconBackground}
      {preview}
      {themeOverride}
      onLinkClick={handleLinkClick}
      onContextMenu={handleContextMenu}
      onIconError={handleIconError}
      onIconLoad={handleIconLoad}
    />
  {/if}

  {#if contextMenuOpen}
    <BookmarkContextMenu menuX={contextMenuX} menuY={contextMenuY} onEdit={canEdit ? handleEditClick : undefined} hasInternal={Boolean(bookmark.internal_url)} onOpenExternal={() => openBookmarkUrl(bookmark.url)} onOpenInternal={() => openBookmarkUrl(bookmark.internal_url ?? bookmark.url)} />
  {/if}

  {#if modalOpen}
    <BookmarkLinkModal title={bookmark.title} url={selectedBookmarkUrl} onClose={closeModal} />
  {/if}
</div>

<style>
  .bookmark-card-shell {
    position: relative;
    z-index: 0;
    min-width: 0;
    contain: layout style;
  }

  .bookmark-card-shell:hover,
  .bookmark-card-shell:focus-within {
    z-index: 1;
  }

  .bookmark-card-shell.is-info {
    width: 100%;
    min-width: var(--card-configured-min-width, 200px);
  }

  .bookmark-card-shell.is-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 0 0 auto;
  }

  @media (max-width: 500px) {
    .bookmark-card-shell.is-info {
      min-width: 0;
    }
  }

</style>
