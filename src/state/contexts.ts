import { createContext } from 'react'
import type { PreferencesApi } from './preferences'
import type { WorkspaceData } from './workspace'
import type { AppUiApi } from './app-ui'
import type { UndoApi } from './undo'

/**
 * React contexts live here, apart from the components that provide them.
 *
 * A module that exports both a component and a context is not compatible with
 * React Fast Refresh: editing the component replaces the module, which creates
 * a brand new context object while mounted consumers still hold the old one,
 * and every `useX must be used inside <XProvider>` guard fires at once. Keeping
 * the context objects in this component-free module makes their identity stable
 * across hot updates.
 *
 * The type-only imports above are erased at build time, so there is no runtime
 * cycle between this module and the providers.
 */

export const PreferencesContext = createContext<PreferencesApi | null>(null)
export const WorkspaceContext = createContext<WorkspaceData | null>(null)
export const AppUiContext = createContext<AppUiApi | null>(null)
export const UndoContext = createContext<UndoApi | null>(null)
