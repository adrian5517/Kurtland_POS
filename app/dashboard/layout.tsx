import DashboardNav from '@/components/dashboard/nav'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import DashboardAccessGuard from '@/components/auth/dashboard-access-guard'

export const metadata = {
  title: 'Dashboard - Kurtland POS',
  description: 'Manage your canteen operations efficiently',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardAccessGuard>
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        <DashboardNav />
        <DashboardShell>{children}</DashboardShell>
      </div>
    </DashboardAccessGuard>
  )
}