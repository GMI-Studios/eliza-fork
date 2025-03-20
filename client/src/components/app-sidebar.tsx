import { useQuery } from "@tanstack/react-query"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { apiClient } from "@/lib/api"
import { NavLink, useLocation } from "react-router"
import type { UUID } from "@elizaos/core"
import { Cog, User } from "lucide-react"
import ConnectionStatus from "./connection-status"

export function AppSidebar() {
  const location = useLocation()
  const query = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.getAgents(),
    refetchInterval: 5_000,
  })

  const agents = query?.data?.agents

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size='lg'
              asChild
            >
              <NavLink to='/'>
                <img
                  alt='icon'
                  src='/icon.png'
                  width='70%'
                  height='100%'
                  className='w-auto h-7 '
                />

                <div className='flex flex-col gap-0.5 leading-none'>
                  <span className='font-semibold'>Friendzone</span>
                  {/* <span className="">v{info?.version}</span> */}
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Agents</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <div>
                {agents?.map((agent: { id: UUID; name: string }) => (
                  <SidebarMenuItem key={agent.id}>
                    <NavLink to={`/chat/${agent.id}`}>
                      <SidebarMenuButton isActive={location.pathname.includes(agent.id)}>
                        <User />
                        <span>{agent.name}</span>
                      </SidebarMenuButton>
                    </NavLink>
                  </SidebarMenuItem>
                ))}
              </div>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <Cog /> Settings
            </SidebarMenuButton>
          </SidebarMenuItem>
          <ConnectionStatus />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
