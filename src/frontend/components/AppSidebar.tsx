"use client";

import * as React from "react";
import {
  Home,
  Shield,
  Mic,
  Users,
  Sword,
  Swords,
  BookOpen,
  LayoutDashboard,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarRail,
} from "@/components/ui/sidebar";

const navMain = [
  {
    title: "Intelligence Hub",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Policy War Room",
    url: "/policy",
    icon: Sword,
    badge: "ALERT",
  },
  {
    title: "Investor Agent",
    url: "/investor",
    icon: Shield,
  },
  {
    title: "Podcast Hub",
    url: "/episodes",
    icon: Mic,
  },
  {
    title: "AI Hero Gallery",
    url: "/heroes",
    icon: Users,
  },
  {
    title: "Expert Clash",
    url: "/policy",
    icon: Swords,
    badge: "BETA",
  },
  {
    title: "Research Library",
    url: "/research",
    icon: BookOpen,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" className="border-r border-zinc-800 bg-zinc-950" {...props}>
      <SidebarHeader className="border-b border-zinc-800 p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <a href="/">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                    <AlertCircle className="size-5" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-bold tracking-tight text-white uppercase">
                      Renegade
                    </span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">
                      Intelligence Hub
                    </span>
                  </div>
                </a>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-zinc-500 px-4 py-2 uppercase text-[10px] font-bold tracking-widest">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    className="hover:bg-zinc-900 hover:text-white transition-all group"
                    render={
                      <a
                        href={item.url}
                        className="flex items-center gap-3 px-4 py-2"
                      >
                        <item.icon className="size-5 text-zinc-400 group-hover:text-red-500 transition-colors" />
                        <span className="font-medium">{item.title}</span>
                        {item.badge && (
                          <span className="ml-auto rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-500 ring-1 ring-inset ring-red-500/20">
                            {item.badge}
                          </span>
                        )}
                      </a>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-zinc-800 p-4">
        <div className="flex items-center gap-3 px-2">
           <div className="size-8 rounded-full bg-zinc-800 animate-pulse" />
           <div className="flex flex-col">
             <span className="text-xs font-bold text-zinc-300">System Active</span>
             <span className="text-[10px] text-green-500 flex items-center gap-1">
               <span className="size-1 rounded-full bg-green-500 animate-ping" /> RAG Engine Online
             </span>
           </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
