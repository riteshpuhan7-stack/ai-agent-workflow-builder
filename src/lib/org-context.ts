import { create } from 'zustand'

interface OrgContextState {
  currentOrgId: string | null
  currentRole: 'owner' | 'editor' | 'viewer' | null
  setContext: (orgId: string, role: 'owner' | 'editor' | 'viewer') => void
  clearContext: () => void
}

export const useOrgContext = create<OrgContextState>((set) => ({
  currentOrgId: null,
  currentRole: null,
  setContext: (orgId, role) => set({ currentOrgId: orgId, currentRole: role }),
  clearContext: () => set({ currentOrgId: null, currentRole: null }),
}))
