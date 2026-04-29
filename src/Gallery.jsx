import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Images,
  Maximize,
  X,
  Send,
  Trash2,
} from 'lucide-react'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)

function Gallery() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [photos, setPhotos] = useState([])
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [likesCount, setLikesCount] = useState({})
  const [likedByMe, setLikedByMe] = useState({})

  const currentUser = localStorage.getItem('photoshare_user') || 'Guest'

  useEffect(() => {
    fetchPhotos()
    fetchLikes()
  }, [])

  useEffect(() => {
    const photoId = searchParams.get('photo')
    if (!photoId || photos.length === 0) return

    const foundPhoto = photos.find((photo) => photo.id === photoId)
    if (foundPhoto) openPhoto(foundPhoto, false)
  }, [photos, searchParams])

  const fetchPhotos = async () => {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
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

  const openPhoto = async (photo, openComments = false) => {
    setSelectedPhoto(photo)
    setCommentsOpen(openComments)
    await fetchComments(photo.id)
  }

  const closePhoto = () => {
    setSelectedPhoto(null)
    setCommentsOpen(false)
    setSearchParams({})
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

    await fetchLikes()
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

  const deletePhoto = async (photo) => {
    const confirmed = window.confirm('Delete this photo?')
    if (!confirmed) return

    if (photo.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove([photo.storage_path])

      if (storageError) {
        console.error(storageError)
      }
    }

    const { error } = await supabase.from('photos').delete().eq('id', photo.id)

    if (error) {
      console.error(error)
      alert('Could not delete photo.')
      return
    }

    setPhotos((prev) => prev.filter((item) => item.id !== photo.id))

    if (selectedPhoto?.id === photo.id) {
      closePhoto()
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/10 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 font-bold hover:bg-cyan-400 hover:text-slate-950"
          >
            <ArrowLeft size={18} />
            Back
          </Link>

          <div className="flex items-center gap-3">
            <Images className="text-cyan-300" />
            <h1 className="text-2xl font-black tracking-widest">GALLERY</h1>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h2 className="text-4xl font-black">Shared Photos</h2>
          <p className="mt-2 text-slate-400">
            Memories uploaded by friends and family.
          </p>
        </div>

        {photos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/20 bg-slate-900 p-16 text-center">
            <Images className="mx-auto mb-4 text-slate-500" size={50} />
            <p className="text-xl font-bold">No photos yet</p>
            <p className="mt-2 text-slate-400">
              Upload photos from the homepage first.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => {
              const isOwner = (photo.username || 'Guest') === currentUser

              return (
                <div
                  key={photo.id}
                  className="group overflow-hidden rounded-3xl bg-slate-900 shadow-xl transition hover:-translate-y-1 hover:bg-slate-800"
                >
                  <div className="relative">
                    <button
                      onClick={() => openPhoto(photo, false)}
                      className="block w-full overflow-hidden"
                    >
                      <img
                        src={photo.image_url}
                        alt={photo.file_name || 'Uploaded photo'}
                        className="h-80 w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    </button>

                    {isOwner && (
                      <button
                        onClick={() => deletePhoto(photo)}
                        className="absolute right-4 top-4 rounded-full bg-black/60 p-3 text-white backdrop-blur-md hover:bg-red-500"
                        title="Delete photo"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  <div className="p-5">
                    <p className="font-black">by {photo.username || 'Guest'}</p>

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={() => toggleLike(photo.id)}
                        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
                          likedByMe[photo.id]
                            ? 'bg-red-500 text-white'
                            : 'bg-white/10 text-slate-300 hover:bg-white hover:text-slate-950'
                        }`}
                      >
                        <Heart size={16} />
                        {likesCount[photo.id] || 0}
                      </button>

                      <button
                        onClick={() => openPhoto(photo, true)}
                        className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-cyan-400 hover:text-slate-950"
                      >
                        <MessageCircle size={16} />
                        Comment
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div
            className={`relative grid max-h-[90vh] w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl ${
              commentsOpen
                ? 'max-w-7xl lg:grid-cols-[minmax(0,1fr)_380px]'
                : 'max-w-5xl'
            }`}
          >
            <button
              onClick={closePhoto}
              className="absolute right-5 top-5 z-30 rounded-full bg-black/60 p-3 text-white hover:bg-white hover:text-slate-950"
            >
              <X size={22} />
            </button>

            <div className="relative flex h-[82vh] items-center justify-center bg-black">
              <img
                src={selectedPhoto.image_url}
                alt={selectedPhoto.file_name || 'Selected photo'}
                className="h-full w-full object-contain"
              />

              <div className="absolute right-6 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-4">
                <button
                  onClick={() => toggleLike(selectedPhoto.id)}
                  className={`rounded-2xl p-4 shadow-xl backdrop-blur-md transition hover:scale-105 ${
                    likedByMe[selectedPhoto.id]
                      ? 'bg-red-500 text-white'
                      : 'bg-black/60 text-white hover:bg-white hover:text-slate-950'
                  }`}
                  title="Like"
                >
                  <Heart size={24} />
                </button>

                <button
                  onClick={() => setCommentsOpen((prev) => !prev)}
                  className={`rounded-2xl p-4 shadow-xl backdrop-blur-md transition hover:scale-105 ${
                    commentsOpen
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-black/60 text-white hover:bg-white hover:text-slate-950'
                  }`}
                  title="Comments"
                >
                  <MessageCircle size={24} />
                </button>

                <button
                  onClick={() => window.open(selectedPhoto.image_url, '_blank')}
                  className="rounded-2xl bg-black/60 p-4 text-white shadow-xl backdrop-blur-md transition hover:scale-105 hover:bg-white hover:text-slate-950"
                  title="Fullscreen"
                >
                  <Maximize size={24} />
                </button>
              </div>

              <div className="absolute bottom-5 left-5 rounded-2xl bg-black/60 px-5 py-3 backdrop-blur-md">
                <p className="font-black">
                  by {selectedPhoto.username || 'Guest'}
                </p>
                <p className="text-sm text-slate-300">
                  {likesCount[selectedPhoto.id] || 0} likes
                </p>
              </div>
            </div>

            {commentsOpen && (
              <aside className="flex h-[82vh] flex-col border-l border-white/10 bg-slate-900">
                <div className="border-b border-white/10 p-5">
                  <p className="text-lg font-black">Comments</p>
                  <p className="mt-1 text-sm text-slate-400">
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
                      <div
                        key={comment.id}
                        className="rounded-2xl bg-white/5 p-4"
                      >
                        <p className="font-bold text-cyan-300">
                          {comment.username}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">
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
                    className="min-w-0 flex-1 rounded-2xl bg-white/10 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  />

                  <button className="rounded-2xl bg-cyan-400 px-4 text-slate-950 hover:bg-cyan-300">
                    <Send size={20} />
                  </button>
                </form>
              </aside>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

export default Gallery