'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

type DashboardShellProps = {
  children: ReactNode
}

export default function DashboardShell({ children }: DashboardShellProps) {
  return (
    <motion.main
      className="flex-1 min-w-0 w-full overflow-auto pt-14 md:pt-0"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="h-full w-full min-w-0 p-4 sm:p-6 lg:p-2 2xl:p-6">{children}</div>
    </motion.main>
  )
}