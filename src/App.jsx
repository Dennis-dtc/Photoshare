import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import {
  Bell,
  Upload,
  Images,
  Heart,
  MessageCircle,
  Maximize,
  X,
  Send,
  User,
  Lock,
} from 'lucide-react'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)

const BUCKET_NAME = 'photos'
const FRIEND_PASSWORD = 'photoshare123'

function App() {
  const fileInputRef = useRef(null)

  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [message, setMessage] = useState('')

  const [currentUser, setCurrentUser] = useState(
    localStorage.getItem('photoshare_user') || ''
  )
  const [loginName, setLoginName] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [profileOpen, setProfileOpen] = useState(false)

  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [likesCount, setLikesCount] = useState({})
  const [likedByMe, setLikedByMe] = useState({})

  useEffect(() => {
    fetchPhotos()
    fetchLikes()
  }, [currentUser])

  const handleLogin = (event) => {
    event.preventDefault()

    if (!loginName.trim()) {
      setLoginError('Please enter your username.')
      return
    }

    if (loginPassword !== FRIEND_PASSWORD) {
      setLoginError('Wrong password.')
      return
    }

    localStorage.setItem('photoshare_user', loginName.trim())
    setCurrentUser(loginName.trim())
    setLoginError('')
  }

  const handleLogout = () => {
    localStorage.removeItem('photoshare_user')
    window.location.reload()
  }

  const fetchPhotos = async () => {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setMessage('Could not load photos.')
      return
    }

    setPhotos(data || [])
  }

  const fetchLikes = async () => {
    const { data, error } = await supabase.from('likes').select('*')

    if (error) {
      console.error(error)
      return
    }

    const counts = {}
    const mine = {}

    data.forEach((like) => {
      counts[like.photo_id] = (counts[like.photo_id] || 0) + 1

      if (like.username === currentUser) {
        mine[like.photo_id] = true
      }
    })

    setLikesCount(counts)
    setLikedByMe(mine)
  }

  const uploadFiles = async (files) => {
    if (!currentUser) return

    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith('image/')
    )

    if (imageFiles.length === 0) {
      setMessage('Please choose an image file.')
      return
    }

    setUploading(true)
    setMessage('Uploading...')

    for (const file of imageFiles) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file)

      if (uploadError) {
        console.error(uploadError)
        setMessage('Upload failed. Check your Supabase bucket settings.')
        setUploading(false)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName)

      const { error: insertError } = await supabase.from('photos').insert({
        image_url: publicUrlData.publicUrl,
        file_name: file.name,
        storage_path: fileName,
        username: currentUser,
      })

      if (insertError) {
        console.error(insertError)
        setMessage('Image uploaded, but saving to database failed.')
        setUploading(false)
        return
      }
    }

    setMessage('Photo uploaded successfully!')
    setUploading(false)
    fetchPhotos()
  }

  const handleInputChange = (event) => {
    uploadFiles(event.target.files)
    event.target.value = ''
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragActive(false)
    uploadFiles(event.dataTransfer.files)
  }

  const openPhoto = async (photo) => {
    setSelectedPhoto(photo)
    setCommentsOpen(false)
    await fetchComments(photo.id)
  }

  const fetchComments = async (photoId) => {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('photo_id', photoId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    setComments(data || [])
  }

  const toggleLike = async (photoId) => {
    if (!currentUser) return

    if (likedByMe[photoId]) {
      await supabase
        .from('likes')
        .delete()
        .eq('photo_id', photoId)
        .eq('username', currentUser)
    } else {
      await supabase.from('likes').insert({
        photo_id: photoId,
        username: currentUser,
      })
    }

    fetchLikes()
  }

  const sendComment = async (event) => {
    event.preventDefault()

    if (!commentText.trim() || !selectedPhoto) return

    const { error } = await supabase.from('comments').insert({
      photo_id: selectedPhoto.id,
      username: currentUser,
      comment: commentText.trim(),
    })

    if (error) {
      console.error(error)
      return
    }

    setCommentText('')
    fetchComments(selectedPhoto.id)
  }

  return (
    <>
      {!currentUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 px-6 backdrop-blur-md">
          <form
            onSubmit={handleLogin}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 text-white shadow-2xl"
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
              <Images size={28} />
            </div>

            <h2 className="text-3xl font-black">Welcome to Photoshare</h2>
            <p className="mt-2 text-slate-400">
              Enter your username and friend password to continue.
            </p>

            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-bold text-slate-300">
                Username
              </span>
              <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
                <User size={18} />
                <input
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  className="w-full bg-transparent outline-none"
                  placeholder="e.g. Alex"
                />
              </div>
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-bold text-slate-300">
                Friend password
              </span>
              <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
                <Lock size={18} />
                <input
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  type="password"
                  className="w-full bg-transparent outline-none"
                  placeholder="Enter password"
                />
              </div>
            </label>

            {loginError && (
              <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {loginError}
              </p>
            )}

            <button className="mt-6 w-full rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300">
              Enter Photoshare
            </button>
          </form>
        </div>
      )}

      <main
        className={`min-h-screen bg-slate-950 text-white ${
          !currentUser ? 'pointer-events-none blur-sm' : ''
        }`}
      >
        <nav className="border-b border-white/10 bg-slate-950/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
                <Images size={24} />
              </div>
              <h1 className="text-2xl font-black tracking-widest text-white">
                PHOTOSHARE
              </h1>
            </div>

            <div className="relative flex items-center gap-3">
              <Link
                to="/gallery"
                className="rounded-full bg-white/10 px-5 py-2 text-sm font-bold hover:bg-cyan-400 hover:text-slate-950"
              >
                Gallery
              </Link>

              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="flex items-center gap-3 rounded-full bg-white/10 px-3 py-2 hover:bg-white hover:text-slate-950"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 text-sm font-black text-slate-950">
                  {(currentUser || 'G').charAt(0).toUpperCase()}
                </span>

                <span className="text-sm font-bold">{currentUser || 'Guest'}</span>
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-14 z-50 w-56 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
                  <div className="border-b border-white/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      Signed in as
                    </p>
                    <p className="mt-1 font-black text-white">{currentUser || 'Guest'}</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-left text-sm font-bold text-red-400 hover:bg-red-500 hover:text-white"
                  >
                    Leave Photoshare
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-[430px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <p className="mb-4 inline-flex rounded-full bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-cyan-300">
              Welcome to Photo Share
            </p>

            <h2 className="text-4xl font-black leading-tight">
              Share your photos with friends and family.
            </h2>

            <p className="mt-4 text-slate-300">
              Upload memories, keep them online, and let friends comment and
              like them.
            </p>

            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-black">Recent uploads</h3>
                <Link to="/gallery" className="text-sm font-bold text-cyan-300">
                  View all
                </Link>
              </div>

              <div className="max-h-[390px] space-y-4 overflow-y-auto pr-2">
                {photos.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                    <Images className="mx-auto mb-3 text-slate-500" size={42} />
                    <p className="font-bold text-slate-300">
                      No photos uploaded yet
                    </p>
                  </div>
                ) : (
                  photos.slice(0, 6).map((photo) => (
                    <Link
                      to={`/gallery?photo=${photo.id}`}
                      key={photo.id}
                      className="flex w-full gap-4 rounded-2xl bg-white/10 p-3 text-left hover:bg-white/15"
                    >
                      <img
                        src={photo.image_url}
                        alt={photo.file_name || 'Uploaded photo'}
                        className="h-24 w-24 rounded-xl object-cover"
                      />

                      <div className="min-w-0">
                        <p className="truncate font-bold">
                          {photo.file_name || 'Uploaded photo'}
                        </p>
                        <p className="text-sm text-slate-400">
                          by {photo.username || 'Guest'}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </aside>

          <section className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div
              onDrop={handleDrop}
              onDragOver={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              className={`flex min-h-[620px] flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center ${
                dragActive
                  ? 'border-cyan-300 bg-cyan-400/10'
                  : 'border-white/20 bg-slate-950'
              }`}
            >
              <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-3xl bg-cyan-400 text-slate-950 shadow-xl">
                <Upload size={52} />
              </div>

              <h2 className="text-5xl font-black">Drag & drop your photo</h2>

              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
                Browse your computer or drop photos here. They will appear in
                the shared gallery.
              </p>

              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                disabled={uploading}
                className="mt-9 flex items-center gap-3 rounded-full bg-cyan-400 px-9 py-4 text-lg font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
              >
                <Upload size={22} />
                {uploading ? 'Uploading...' : 'Upload / Browse'}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleInputChange}
                className="hidden"
              />

              {message && (
                <p className="mt-6 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold">
                  {message}
                </p>
              )}
            </div>
          </section>
        </section>
      </main>

      {selectedPhoto && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div
            className={`relative grid max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-3xl bg-slate-950 shadow-2xl ${
              commentsOpen ? 'lg:grid-cols-[1fr_380px]' : 'max-w-5xl'
            }`}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute right-4 top-4 z-20 rounded-full bg-black/60 p-3 text-white hover:bg-white hover:text-slate-950"
            >
              <X size={22} />
            </button>

            <div className="relative flex min-h-[70vh] items-center justify-center bg-black">
              <img
                src={selectedPhoto.image_url}
                alt={selectedPhoto.file_name || 'Selected photo'}
                className="max-h-[88vh] w-full object-contain"
              />

              <div className="absolute right-5 top-1/2 flex -translate-y-1/2 flex-col gap-3">
                <button
                  onClick={() => toggleLike(selectedPhoto.id)}
                  className={`rounded-2xl p-4 shadow-xl ${
                    likedByMe[selectedPhoto.id]
                      ? 'bg-pink-500 text-white'
                      : 'bg-black/60 text-white hover:bg-white hover:text-slate-950'
                  }`}
                >
                  <Heart size={24} />
                </button>

                <button
                  onClick={() => setCommentsOpen((prev) => !prev)}
                  className="rounded-2xl bg-black/60 p-4 text-white shadow-xl hover:bg-white hover:text-slate-950"
                >
                  <MessageCircle size={24} />
                </button>

                <button
                  onClick={() => window.open(selectedPhoto.image_url, '_blank')}
                  className="rounded-2xl bg-black/60 p-4 text-white shadow-xl hover:bg-white hover:text-slate-950"
                >
                  <Maximize size={24} />
                </button>
              </div>
            </div>

            {commentsOpen && (
              <aside className="flex max-h-[92vh] flex-col border-l border-white/10 bg-slate-900">
                <div className="border-b border-white/10 p-5">
                  <p className="font-black">Comments</p>
                  <p className="text-sm text-slate-400">
                    Photo by {selectedPhoto.username || 'Guest'}
                  </p>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  {comments.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No comments yet. Be the first.
                    </p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id}>
                        <p className="font-bold">{comment.username}</p>
                        <p className="text-sm text-slate-300">
                          {comment.comment}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <form
                  onSubmit={sendComment}
                  className="flex gap-3 border-t border-white/10 p-4"
                >
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className="min-w-0 flex-1 rounded-2xl bg-white/10 px-4 py-3 outline-none"
                  />

                  <button className="rounded-2xl bg-cyan-400 px-4 text-slate-950">
                    <Send size={20} />
                  </button>
                </form>
              </aside>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default App