import * as React from "react"
import { AppSidebar } from "@/components/AppSidebar"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/ThemeToggle"

interface SidebarLayoutProps {
  children: React.ReactNode
  title: string
}

export function SidebarLayout({ children, title }: SidebarLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-zinc-950">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-950/80 px-6 backdrop-blur-md">
          <SidebarTrigger className="-ml-1 text-zinc-400 hover:text-white" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-zinc-800" />
          <div className="flex flex-1 items-center gap-2">
             <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Platform</span>
             <span className="text-zinc-600">/</span>
             <h1 className="text-sm font-semibold text-zinc-200">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
