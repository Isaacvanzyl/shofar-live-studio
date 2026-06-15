const YT_BASE = 'https://www.googleapis.com/youtube/v3'

export interface LiveBroadcast {
  id: string
  snippet: {
    title: string
    description: string
    thumbnails?: { medium?: { url: string } }
    liveChatId?: string
    publishedAt: string
  }
  status: {
    lifeCycleStatus: string
    recordingStatus: string
    madeForKids: boolean
  }
  statistics?: {
    viewerCount: string
  }
  liveStreamingDetails?: {
    actualStartTime?: string
    concurrentViewers?: string
    activeLiveChatId?: string
  }
  streamId?: string
}

export interface LiveStreamHealth {
  id: string
  snippet: { title: string }
  status: {
    streamStatus: string
    healthStatus: {
      status: string
      lastUpdateTimeSeconds?: string
      configurationIssues?: Array<{ type: string; severity: string; description: string }>
    }
  }
  cdn: {
    ingestionType: string
    ingestionInfo?: {
      streamName: string
      ingestionAddress: string
      backupIngestionAddress: string
    }
    resolution: string
    frameRate: string
  }
}

function mapVideoTobroadcast(item: Record<string, unknown>): LiveBroadcast {
  const snippet = item.snippet as Record<string, unknown> | undefined
  const lifeCycleStatus = snippet?.liveBroadcastContent === 'live' ? 'live'
    : snippet?.liveBroadcastContent === 'upcoming' ? 'ready' : 'complete'
  return {
    ...item,
    status: { ...(item.status as object), lifeCycleStatus },
  } as LiveBroadcast
}

// Fetch a specific broadcast by video ID — works with API key for public + unlisted videos.
export async function getBroadcastById(videoId: string, apiKey: string): Promise<LiveBroadcast | null> {
  const url = `${YT_BASE}/videos?part=snippet,status,statistics,liveStreamingDetails&id=${videoId}&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const item = data.items?.[0]
  if (!item) return null
  // liveStreamingDetails.activeLiveChatId is present; also try to get the bound stream ID
  // via the liveBroadcasts endpoint so we can fetch health/CDN info
  const broadcast = mapVideoTobroadcast(item)
  try {
    const lbUrl = `${YT_BASE}/liveBroadcasts?part=contentDetails&id=${videoId}&key=${apiKey}`
    const lbRes = await fetch(lbUrl)
    if (lbRes.ok) {
      const lbData = await lbRes.json()
      const streamId = lbData.items?.[0]?.contentDetails?.boundStreamId
      if (streamId) broadcast.streamId = streamId
    }
  } catch { /* non-critical */ }
  return broadcast
}

// Find the currently live broadcast on a channel, then fetch full details.
// Works with API key for public channels. Also returns unlisted streams discovered this way.
export async function getLiveBroadcastByChannel(channelId: string, apiKey: string): Promise<LiveBroadcast | null> {
  const searchUrl = `${YT_BASE}/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`
  const searchRes = await fetch(searchUrl)
  if (!searchRes.ok) return null
  const searchData = await searchRes.json()
  const videoId = searchData.items?.[0]?.id?.videoId
  if (!videoId) return null
  return getBroadcastById(videoId, apiKey)
}

export async function getLiveBroadcast(apiKey: string): Promise<LiveBroadcast | null> {
  const url = `${YT_BASE}/liveBroadcasts?part=snippet,status,statistics,contentDetails&broadcastStatus=active&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const item = data.items?.[0]
  if (!item) return null
  return item as LiveBroadcast
}

// OAuth-based: find active broadcast for the authenticated user (no API key needed)
export async function getMyActiveBroadcast(accessToken: string): Promise<LiveBroadcast | null> {
  const url = `${YT_BASE}/liveBroadcasts?part=snippet,status,statistics,contentDetails,liveStreamingDetails&broadcastStatus=active&mine=true`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  const item = data.items?.[0]
  if (!item) return item
  const broadcast = item as LiveBroadcast
  broadcast.streamId = item.contentDetails?.boundStreamId
  return broadcast
}

// OAuth-based: get live stream health by stream ID
export async function getMyLiveStream(streamId: string, accessToken: string): Promise<LiveStreamHealth | null> {
  const url = `${YT_BASE}/liveStreams?part=snippet,status,cdn&id=${streamId}&mine=true`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return (data.items?.[0] ?? null) as LiveStreamHealth | null
}

export async function getLiveStream(streamId: string, apiKey: string): Promise<LiveStreamHealth | null> {
  const url = `${YT_BASE}/liveStreams?part=snippet,status,cdn&id=${streamId}&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const item = data.items?.[0]
  if (!item) return null
  return item as LiveStreamHealth
}

export async function updateBroadcastTitle(
  broadcastId: string,
  title: string,
  description: string,
  accessToken: string
): Promise<boolean> {
  const url = `${YT_BASE}/liveBroadcasts?part=snippet`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: broadcastId,
      snippet: { title, scheduledStartTime: new Date().toISOString(), description },
    }),
  })
  return res.ok
}
