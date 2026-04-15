'use client'

import { createContext, useContext } from 'react'

interface Permissions {
  canEdit: boolean    // false for guests
  canSeePII: boolean  // false for guests
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
  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions(): Permissions {
  return useContext(PermissionsContext)
}
