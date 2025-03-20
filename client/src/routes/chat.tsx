import { useParams } from "react-router"
import Chat from "@/components/chat"
import type { UUID } from "@elizaos/core"
import { v4 as uuidv4 } from "uuid"

export default function AgentRoute() {
  const { agentId } = useParams<{ agentId: UUID }>()

  if (!agentId) return <div>No data.</div>

  // Check if roomId is already stored in localStorage
  let roomId = localStorage.getItem(agentId)

  // If no roomId is found, generate a new one and save it
  if (!roomId) {
    roomId = uuidv4()
    localStorage.setItem(agentId, roomId)
  }

  return (
    <Chat
      agentId={agentId}
      roomId={roomId}
    />
  )
}
