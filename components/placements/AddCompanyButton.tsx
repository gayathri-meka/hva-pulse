'use client'

import { useState } from 'react'
import Modal from './Modal'
import CompanyForm from './CompanyForm'

export default function AddCompanyButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
      >
        + Add company
      </button>

      {open && (
        <Modal title="Add company" onClose={() => setOpen(false)}>
          <CompanyForm onClose={() => setOpen(false)} />
        </Modal>
      )}
    </>
  )
}
