'use client'

import { createContext, useContext, useEffect } from 'react'

interface Permissions {
  canEdit: boolean
  canSeePII: boolean
  role: 'admin' | 'staff' | 'guest' | 'learner'
}

const PermissionsContext = createContext<Permissions>({
  canEdit: true,
  canSeePII: true,
  role: 'admin',
})

export function PermissionsProvider({
  children,
  role,
}: {
  children: React.ReactNode
  role: Permissions['role']
}) {
  const value: Permissions = {
    canEdit:   role === 'admin' || role === 'staff',
    canSeePII: role !== 'guest',
    role,
  }

  // Add a CSS class to body for global read-only styling
  useEffect(() => {
    if (role === 'guest') {
      document.body.classList.add('guest-readonly')
    }
    return () => { document.body.classList.remove('guest-readonly') }
  }, [role])

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions(): Permissions {
  return useContext(PermissionsContext)
}
