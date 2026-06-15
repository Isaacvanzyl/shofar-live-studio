import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function GoogleCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'processing' | 'error'>('processing')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('yt_error')

    if (error) {
      setStatus('error')
      setErrorMsg(decodeURIComponent(error))
      setTimeout(() => navigate('/control'), 4000)
      return
    }

    // This page is only reached via redirect from /api/auth/google-callback
    // which then redirects to /control?yt_connected=1 — we shouldn't normally land here
    navigate('/control')
  }, [navigate])

  if (status === 'error') {
    return (
      <div className="yt-callback-wrap">
        <div className="yt-callback-card">
          <div className="yt-callback-icon error">✕</div>
          <h2>YouTube Connection Failed</h2>
          <p>{errorMsg}</p>
          <p className="yt-callback-sub">Redirecting back to studio...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="yt-callback-wrap">
      <div className="yt-callback-card">
        <div className="yt-callback-icon loading" />
        <h2>Connecting YouTube...</h2>
        <p className="yt-callback-sub">Please wait</p>
      </div>
    </div>
  )
}
