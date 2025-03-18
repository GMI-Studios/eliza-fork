import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Cog } from "lucide-react"
import PageTitle from "@/components/page-title"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { apiClient } from "@/lib/api"
import { NavLink } from "react-router"
import type { UUID } from "@elizaos/core"
import { formatAgentName } from "@/lib/utils"

export default function Home() {
  const [twitterHandle, setTwitterHandle] = useState("")
  const [loading, setLoading] = useState(false)
  const [description, setDescription] = useState("")

  const query = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.getAgents(),
    refetchInterval: 5_000,
  })

  const agents = query?.data?.agents

  const handleGenerateAgent = async () => {
    setLoading(true)
    try {
      // Replace this with your actual API call to fetch tweets and generate description
      const response = await fetch(`/api/generate-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ twitterHandle }),
      })
      const data = await response.json()
      setDescription(data.description)
    } catch (error) {
      console.error("Error generating agent:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='flex flex-col gap-4 h-full p-4'>
      <PageTitle title='Agents' />

      <div className='flex flex-col gap-2 max-w-md'>
        <input
          type='text'
          placeholder='Enter Twitter handle'
          value={twitterHandle}
          onChange={(e) => setTwitterHandle(e.target.value)}
          className='p-2 border rounded'
        />
        <Button
          onClick={handleGenerateAgent}
          disabled={loading || !twitterHandle}
        >
          {loading ? "Generating..." : "Generate Agent"}
        </Button>
        {description && (
          <div className='mt-2 p-2 border rounded'>
            <strong>Description:</strong> {description}
          </div>
        )}
      </div>

      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        {agents?.map((agent: { id: UUID; name: string }) => (
          <Card key={agent.id}>
            <CardHeader>
              <CardTitle>{agent?.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='rounded-md bg-muted aspect-square w-full grid place-items-center'>
                <div className='text-6xl font-bold uppercase'>{formatAgentName(agent?.name)}</div>
              </div>
            </CardContent>
            <CardFooter>
              <div className='flex items-center gap-4 w-full'>
                <NavLink
                  to={`/chat/${agent.id}`}
                  className='w-full grow'
                >
                  <Button
                    variant='outline'
                    className='w-full grow'
                  >
                    Chat
                  </Button>
                </NavLink>
                <NavLink
                  to={`/settings/${agent.id}`}
                  key={agent.id}
                >
                  <Button
                    size='icon'
                    variant='outline'
                  >
                    <Cog />
                  </Button>
                </NavLink>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
