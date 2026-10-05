import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, SkipBack, SkipForward, Plus, X, Trash2, Search, Music, CheckCircle2,
  ChevronDown, MoreVertical, PlusCircle, Shuffle, Timer, Share2, ListMusic, Laptop,
  Edit3, Maximize2, Minimize2, List, QrCode, Clock, Sparkles, Crop, ZoomIn, Check, Sparkle, ShieldCheck
} from 'lucide-react';

const CATEGORIES = ['Semua', 'Keluarga', 'Liburan', 'Pasangan', 'Wisuda', 'Ulang Tahun', 'Umum'];

export default function App() {
  const [memories, setMemories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Kiosk & Ambient Mode State
  const [isAmbientMode, setIsAmbientMode] = useState(false);
  const [timeString, setTimeString] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Audio Duration & Progress State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Umum');
  const [imageFile, setImageFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);

  // CROPPER STATE (Native Pixel Engine)
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [rawImgDimensions, setRawImgDimensions] = useState({ width: 0, height: 0 });
  const [showCropModal, setShowCropModal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState(null);

  const canvasRef = useRef(null);

  // Musik API Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [previewingTrackUrl, setPreviewingTrackUrl] = useState(null);

  const audioRef = useRef(null);
  const previewAudioRef = useRef(null);

  // Clock realtime
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Data Memories
  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMemories(data);
      if (data.length === 0) {
        setCurrentIndex(0);
      } else if (currentIndex >= data.length) {
        setCurrentIndex(data.length - 1);
      }
    } else {
      console.error("Gagal mengambil data:", error);
    }
  };

  const filteredMemories = memories.filter(m => 
    selectedCategory === 'Semua' ? true : (m.category || 'Umum') === selectedCategory
  );

  const currentMemory = filteredMemories[currentIndex] || memories[currentIndex] || {
    title: "Belum Ada Kenangan",
    subtitle: "Tambahkan foto & lagu pertama Anda",
    description: "Klik tombol + di pojok kanan atas",
    category: "Umum",
    image_url: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?auto=format&fit=crop&w=800&q=80",
    audio_url: ""
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || secs === 0) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  // --- LOGIKA PILIH FOTO & BACA UKURAN ASLI (NATIVE DIMENSIONS) ---
  const handleSelectFile = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.src = reader.result;
        img.onload = () => {
          setRawImgDimensions({ width: img.naturalWidth, height: img.naturalHeight });
          setRawImageSrc(reader.result);
          setZoom(1);
          setCropOffset({ x: 0, y: 0 });
          setShowCropModal(true);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  // Render preview canvas interaktif di layar
  useEffect(() => {
    if (showCropModal && rawImageSrc && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = rawImageSrc;

      img.onload = () => {
        const displaySize = 280;
        canvas.width = displaySize;
        canvas.height = displaySize;

        ctx.clearRect(0, 0, displaySize, displaySize);

        const minScale = Math.max(displaySize / img.naturalWidth, displaySize / img.naturalHeight);
        const currentScale = minScale * zoom;

        const drawWidth = img.naturalWidth * currentScale;
        const drawHeight = img.naturalHeight * currentScale;

        const x = (displaySize - drawWidth) / 2 + cropOffset.x;
        const y = (displaySize - drawHeight) / 2 + cropOffset.y;

        ctx.drawImage(img, x, y, drawWidth, drawHeight);
      };
    }
  }, [showCropModal, rawImageSrc, zoom, cropOffset]);

  const handleStartDrag = (clientX, clientY) => {
    setIsDragging(true);
    setDragStart({ x: clientX - cropOffset.x, y: clientY - cropOffset.y });
  };

  const handleMoveDrag = (clientX, clientY) => {
    if (!isDragging) return;
    setCropOffset({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleEndDrag = () => setIsDragging(false);

  // --- PEMOTONGAN TINGKAT PIKSEL ASLI (100% KUALITAS KAMERA/HP) ---
  const handleConfirmCrop = () => {
    if (!rawImageSrc) return;

    const img = new Image();
    img.src = rawImageSrc;

    img.onload = () => {
      const displaySize = 280;
      const minScale = Math.max(displaySize / img.naturalWidth, displaySize / img.naturalHeight);
      const scaleApplied = minScale * zoom;

      // Hitung posisi gambar di layar preview
      const displayedWidth = img.naturalWidth * scaleApplied;
      const displayedHeight = img.naturalHeight * scaleApplied;
      const displayX = (displaySize - displayedWidth) / 2 + cropOffset.x;
      const displayY = (displaySize - displayedHeight) / 2 + cropOffset.y;

      // Konversi area potong layar langsung ke KOORDINAT PIKSEL ASLI GAMBAR
      const sourceX = Math.max(0, -displayX / scaleApplied);
      const sourceY = Math.max(0, -displayY / scaleApplied);
      const sourceWidth = displaySize / scaleApplied;
      const sourceHeight = displaySize / scaleApplied;

      // Buat Canvas khusus dengan resolusi murni hasil potongan asli
      const outputCanvas = document.createElement('canvas');
      const targetSize = Math.min(Math.max(sourceWidth, sourceHeight), 2048); // Maksimal 2048px (Ultra HD)
      outputCanvas.width = targetSize;
      outputCanvas.height = targetSize;

      const ctx = outputCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Potong langsung dari piksel asli foto kamera tanpa ada stretching/blur
      ctx.drawImage(
        img,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, targetSize, targetSize
      );

      // Simpan dengan kualitas penuh tanpa kompresi
      outputCanvas.toBlob((blob) => {
        if (blob) {
          const croppedFile = new File([blob], `native_hd_${Date.now()}.jpg`, { type: 'image/jpeg' });
          setImageFile(croppedFile);
          setCroppedPreviewUrl(URL.createObjectURL(blob));
          setShowCropModal(false);
        }
      }, 'image/jpeg', 1.0); // 1.0 = Kualitas Maksimal (Lossless Quality)
    };
  };

  const handleSearchMusic = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&entity=song&limit=6`
      );
      const data = await response.json();
      if (data.results) {
        setSearchResults(data.results);
      }
    } catch (err) {
      console.error("Gagal mencari lagu:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const togglePreviewTrack = (previewUrl) => {
    if (previewingTrackUrl === previewUrl) {
      previewAudioRef.current?.pause();
      setPreviewingTrackUrl(null);
    } else {
      setPreviewingTrackUrl(previewUrl);
      if (previewAudioRef.current) {
        previewAudioRef.current.src = previewUrl;
        previewAudioRef.current.play();
      }
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentMemory.audio_url) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, [currentIndex]);

  const handleNext = () => {
    const list = filteredMemories.length > 0 ? filteredMemories : memories;
    if (list.length <= 1) return;
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * list.length);
      setCurrentIndex(randomIndex);
    } else {
      setCurrentIndex((prev) => (prev + 1) % list.length);
    }
  };

  const handlePrev = () => {
    const list = filteredMemories.length > 0 ? filteredMemories : memories;
    if (list.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + list.length) % list.length);
  };

  const handleDelete = async () => {
    setShowMenu(false);
    if (!currentMemory.id) return;
    
    const confirmed = window.confirm(`Apakah Anda yakin ingin menghapus kenangan "${currentMemory.title}"?`);
    if (!confirmed) return;

    try {
      if (isPlaying && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }

      const { error } = await supabase
        .from('memories')
        .delete()
        .eq('id', currentMemory.id);

      if (error) throw error;

      alert("Kenangan berhasil dihapus!");
      await fetchMemories();
    } catch (err) {
      alert("Gagal menghapus: " + err.message);
    }
  };

  const openEditModal = () => {
    setShowMenu(false);
    if (!currentMemory.id) return;

    setIsEditing(true);
    setEditingId(currentMemory.id);
    setTitle(currentMemory.title || '');
    setSubtitle(currentMemory.subtitle || '');
    setDescription(currentMemory.description || '');
    setCategory(currentMemory.category || 'Umum');
    setSelectedTrack(null);
    setCroppedPreviewUrl(currentMemory.image_url);
    setRawImageSrc(currentMemory.image_url);
    setShowModal(true);
  };

  const toggleFullscreen = () => {
    setShowMenu(false);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title) return alert("Judul Momen wajib diisi!");
    if (!isEditing && !imageFile) return alert("Foto Kenangan wajib diunggah & dipotong!");
    setLoading(true);

    try {
      let imageUrl = currentMemory.image_url;

      if (imageFile) {
        const imageName = `native_hd_${Date.now()}.jpg`;
        const { error: imgErr } = await supabase.storage
          .from('frame-assets')
          .upload(`images/${imageName}`, imageFile, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (imgErr) throw imgErr;

        imageUrl = supabase.storage
          .from('frame-assets')
          .getPublicUrl(`images/${imageName}`).data.publicUrl;
      }

      let finalAudioUrl = currentMemory.audio_url || '';

      if (selectedTrack) {
        finalAudioUrl = selectedTrack.previewUrl;
      } else if (audioFile) {
        const audioExt = audioFile.name.split('.').pop();
        const audioName = `audio_${Date.now()}.${audioExt}`;
        const { error: audErr } = await supabase.storage
          .from('frame-assets')
          .upload(`audio/${audioName}`, audioFile);

        if (audErr) throw audErr;

        finalAudioUrl = supabase.storage
          .from('frame-assets')
          .getPublicUrl(`audio/${audioName}`).data.publicUrl;
      }

      const finalSubtitle = subtitle || (selectedTrack ? `${selectedTrack.artistName}` : '');

      if (isEditing) {
        const { error: updateErr } = await supabase
          .from('memories')
          .update({
            title,
            subtitle: finalSubtitle,
            description,
            category,
            image_url: imageUrl,
            audio_url: finalAudioUrl
          })
          .eq('id', editingId);

        if (updateErr) throw updateErr;
        alert("Kenangan berhasil diperbarui!");
      } else {
        const { error: dbErr } = await supabase.from('memories').insert([
          {
            title,
            subtitle: finalSubtitle,
            description,
            category,
            image_url: imageUrl,
            audio_url: finalAudioUrl,
          }
        ]);

        if (dbErr) throw dbErr;
        alert("Berhasil menambahkan kenangan baru!");
      }

      setShowModal(false);
      setIsEditing(false);
      setEditingId(null);
      setTitle('');
      setSubtitle('');
      setDescription('');
      setCategory('Umum');
      setImageFile(null);
      setCroppedPreviewUrl(null);
      setAudioFile(null);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedTrack(null);
      setPreviewingTrackUrl(null);

      await fetchMemories();
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const activeList = filteredMemories.length > 0 ? filteredMemories : memories;
  const prevMemory = activeList.length > 0 
    ? activeList[(currentIndex - 1 + activeList.length) % activeList.length]
    : currentMemory;
  const nextMemory = activeList.length > 0 
    ? activeList[(currentIndex + 1) % activeList.length]
    : currentMemory;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    window.location.href
  )}`;

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-zinc-800 via-zinc-900 to-black text-white flex flex-col justify-between font-sans selection:bg-emerald-500 overflow-x-hidden">
      
      <audio ref={previewAudioRef} onEnded={() => setPreviewingTrackUrl(null)} />
      <audio 
        ref={audioRef} 
        src={currentMemory.audio_url || null} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={handleNext} 
      />

      {/* Dynamic Background Glow */}
      <motion.div 
        key={currentMemory.image_url}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.35 }}
        transition={{ duration: 0.8 }}
        className="fixed inset-0 bg-cover bg-center filter blur-3xl scale-125 pointer-events-none z-0"
        style={{ backgroundImage: `url(${currentMemory.image_url})` }}
      />

      {/* AMBIENT CLOCK OVERLAY */}
      {isAmbientMode && (
        <div className="fixed top-8 left-8 z-30 flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
          <Clock size={18} className="text-emerald-400" />
          <span className="text-xl font-extrabold tracking-widest">{timeString}</span>
        </div>
      )}

      {/* 1. TOP HEADER */}
      <div className="relative z-20 flex items-center justify-between px-6 pt-6 pb-2 max-w-lg mx-auto w-full">
        <button 
          onClick={() => setShowGallery(true)}
          title="Buka Daftar Kenangan"
          className="text-zinc-300 hover:text-white transition p-1"
        >
          <ChevronDown size={28} />
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/50 flex items-center gap-1">
              <Sparkle size={10} className="fill-emerald-400" />
              {currentMemory.category || 'Smart Memory Frame'}
            </span>
          </div>
          <p className="text-sm font-bold text-white tracking-wide truncate max-w-[200px] mt-1">
            {currentMemory.subtitle || "Smart Memory Frame"}
          </p>
        </div>

        <div className="flex items-center gap-3 relative">
          <button 
            onClick={() => {
              setIsEditing(false);
              setTitle('');
              setSubtitle('');
              setDescription('');
              setCroppedPreviewUrl(null);
              setImageFile(null);
              setRawImageSrc(null);
              setShowModal(true);
            }}
            title="Tambah Kenangan"
            className="text-zinc-300 hover:text-white transition p-1"
          >
            <Plus size={24} />
          </button>

          <button 
            onClick={() => setShowMenu(!showMenu)}
            title="Opsi Momen"
            className="text-zinc-300 hover:text-white transition p-1"
          >
            <MoreVertical size={22} />
          </button>

          {/* DROPDOWN MENU TITIK TIGA */}
          {showMenu && (
            <div className="absolute top-10 right-0 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1.5 w-56 text-xs font-medium z-50">
              <button 
                onClick={() => {
                  setIsAmbientMode(!isAmbientMode);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-800 rounded-lg text-emerald-400 transition"
              >
                <Sparkles size={16} />
                {isAmbientMode ? 'Matikan Mode Bingkai' : 'Mode Bingkai Digital (Ambient)'}
              </button>

              <div className="my-1 border-t border-zinc-800" />

              {memories.length > 0 && currentMemory.id && (
                <>
                  <button 
                    onClick={openEditModal}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-800 rounded-lg text-zinc-200 transition"
                  >
                    <Edit3 size={16} className="text-blue-400" />
                    Edit Momen Ini
                  </button>

                  <button 
                    onClick={() => {
                      setShowMenu(false);
                      setShowQrModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-800 rounded-lg text-zinc-200 transition"
                  >
                    <QrCode size={16} className="text-purple-400" />
                    Cetak Kode QR Momen
                  </button>

                  <div className="my-1 border-t border-zinc-800" />
                </>
              )}

              <button 
                onClick={toggleFullscreen}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-800 rounded-lg text-zinc-200 transition"
              >
                {isFullscreen ? <Minimize2 size={16} className="text-amber-400" /> : <Maximize2 size={16} className="text-amber-400" />}
                {isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh'}
              </button>

              {memories.length > 0 && currentMemory.id && (
                <>
                  <div className="my-1 border-t border-zinc-800" />
                  <button 
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-red-950/60 text-red-400 rounded-lg transition"
                  >
                    <Trash2 size={16} />
                    Hapus Kenangan Ini
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. MAIN CONTENT CONTAINER (3D CAROUSEL BOLD LOOK) */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-4 max-w-lg mx-auto w-full">
        
        {/* CONTAINER 3D CAROUSEL */}
        <div className="relative w-full aspect-square flex items-center justify-center my-4 overflow-visible">
          
          {/* FOTO SEBELUMNYA (KIRI) */}
          <motion.div 
            key={`prev-${prevMemory.id || currentIndex}`}
            onClick={handlePrev}
            initial={{ scale: 0.75, x: -140, opacity: 0.3 }}
            animate={{ scale: 0.8, x: -110, opacity: 0.45 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            title="Ke Foto Sebelumnya"
            className="absolute w-2/3 aspect-square rounded-2xl overflow-hidden cursor-pointer z-0 border border-white/20 hover:opacity-75 shadow-2xl bg-black"
          >
            <img 
              src={prevMemory.image_url} 
              alt="Foto Sebelumnya" 
              className="w-full h-full object-cover filter blur-[0.5px]"
            />
          </motion.div>

          {/* FOTO BERIKUTNYA (KANAN) */}
          <motion.div 
            key={`next-${nextMemory.id || currentIndex}`}
            onClick={handleNext}
            initial={{ scale: 0.75, x: 140, opacity: 0.3 }}
            animate={{ scale: 0.8, x: 110, opacity: 0.45 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            title="Ke Foto Selanjutnya"
            className="absolute w-2/3 aspect-square rounded-2xl overflow-hidden cursor-pointer z-0 border border-white/20 hover:opacity-75 shadow-2xl bg-black"
          >
            <img 
              src={nextMemory.image_url} 
              alt="Foto Selanjutnya" 
              className="w-full h-full object-cover filter blur-[0.5px]"
            />
          </motion.div>

          {/* FOTO UTAMA TAJAM (TENGAH DEPAN) */}
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentMemory.id || currentIndex}
              initial={{ scale: 0.9, opacity: 0.5, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0.5, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="relative z-10 w-3/4 aspect-square rounded-2xl overflow-hidden shadow-2xl border border-white/30 bg-black"
            >
              <img 
                src={currentMemory.image_url} 
                alt={currentMemory.title} 
                className="w-full h-full object-cover"
              />
            </motion.div>
          </AnimatePresence>

        </div>

        {/* Lirik / Catatan Bar Teks Besar */}
        {currentMemory.description && (
          <motion.div 
            key={`desc-${currentIndex}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-2 text-center"
          >
            <p className="text-base font-bold text-zinc-100 tracking-tight leading-snug drop-shadow-sm whitespace-pre-line">
              {currentMemory.description}
            </p>
          </motion.div>
        )}

        {/* Judul Lagu & Artis */}
        <div className="flex items-center justify-between mt-2 mb-3">
          <motion.div 
            key={`title-${currentIndex}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="overflow-hidden pr-2"
          >
            <h1 className="text-xl font-extrabold text-white tracking-wide truncate">{currentMemory.title}</h1>
            <p className="text-xs font-medium text-zinc-400 mt-0.5 truncate">{currentMemory.subtitle || "Memory Asset"}</p>
          </motion.div>
          <button className="text-zinc-300 hover:text-white transition transform active:scale-95">
            <PlusCircle size={26} />
          </button>
        </div>

        {/* 3. SEEKBAR / PROGRESS BAR */}
        <div className="w-full mb-2">
          <input 
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white hover:accent-emerald-500 transition"
          />
          <div className="flex justify-between items-center text-[11px] font-medium text-zinc-400 mt-1.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 4. CONTROLS BAR */}
        <div className="flex items-center justify-between py-2">
          <button 
            onClick={() => setIsShuffle(!isShuffle)}
            className={`transition ${isShuffle ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <Shuffle size={20} />
          </button>

          <button 
            onClick={handlePrev} 
            disabled={activeList.length <= 1}
            className="text-zinc-200 hover:text-white transition active:scale-90 disabled:opacity-30"
          >
            <SkipBack fill="currentColor" size={32} />
          </button>

          <button 
            onClick={togglePlay} 
            disabled={!currentMemory.audio_url}
            className="bg-white text-black p-4 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition disabled:opacity-50 flex items-center justify-center"
          >
            {isPlaying ? (
              <Pause className="text-black" fill="currentColor" size={28} />
            ) : (
              <Play className="text-black ml-0.5" fill="currentColor" size={28} />
            )}
          </button>

          <button 
            onClick={handleNext} 
            disabled={activeList.length <= 1}
            className="text-zinc-200 hover:text-white transition active:scale-90 disabled:opacity-30"
          >
            <SkipForward fill="currentColor" size={32} />
          </button>

          <button className="text-zinc-400 hover:text-white transition">
            <Timer size={22} />
          </button>
        </div>

      </div>

      {/* 5. BOTTOM TOOLBAR & LYRICS PREVIEW CARD */}
      <div className="relative z-10 px-6 pb-12 pt-2 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between text-zinc-400 px-1 mb-4">
          <button className="hover:text-white transition">
            <Laptop size={20} />
          </button>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setShowQrModal(true)}
              title="Kode QR"
              className="hover:text-white transition"
            >
              <Share2 size={20} />
            </button>
            <button 
              onClick={() => setShowGallery(true)}
              title="Lihat Daftar Kenangan"
              className="hover:text-white transition"
            >
              <ListMusic size={20} />
            </button>
          </div>
        </div>

        <div className="bg-purple-900/40 backdrop-blur-xl border border-purple-500/30 p-4 rounded-2xl shadow-xl">
          <p className="text-xs font-bold text-purple-200 mb-1 tracking-wide">Pratinjau lirik</p>
          <p className="text-sm font-bold text-white leading-snug whitespace-pre-line line-clamp-4">
            {currentMemory.description || "Hapus semua bedakmu,\ntampilkan wajah aslimu..."}
          </p>
        </div>
      </div>

      {/* MODAL GALERI FOTO */}
      {showGallery && (
        <div className="fixed inset-0 z-40 bg-zinc-950/95 backdrop-blur-2xl p-6 overflow-y-auto">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <List size={20} className="text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Album Kenangan</h2>
              </div>
              <button 
                onClick={() => setShowGallery(false)}
                className="p-1 rounded-full bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* TAB FILTER KATEGORI */}
            <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-none">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setCurrentIndex(0);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                    selectedCategory === cat 
                      ? 'bg-emerald-500 text-black' 
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {filteredMemories.length === 0 ? (
              <p className="text-center text-zinc-500 text-sm py-12">Belum ada foto kenangan dalam kategori ini.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredMemories.map((mem, index) => {
                  const isActive = index === currentIndex;
                  return (
                    <div 
                      key={mem.id || index}
                      onClick={() => {
                        setCurrentIndex(index);
                        setShowGallery(false);
                      }}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition cursor-pointer ${
                        isActive 
                          ? 'bg-emerald-950/40 border-emerald-500/60 text-white' 
                          : 'bg-zinc-900/80 border-zinc-800 hover:bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-black">
                        <img src={mem.image_url} alt={mem.title} className="w-full h-full object-cover" />
                        {isActive && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Play size={14} className="text-emerald-400 fill-emerald-400" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 overflow-hidden">
                        <p className={`text-sm font-bold truncate ${isActive ? 'text-emerald-400' : 'text-white'}`}>
                          {mem.title}
                        </p>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">
                          {mem.subtitle || "Smart Memory Asset"}
                        </p>
                      </div>

                      <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-700 shrink-0">
                        {mem.category || 'Umum'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL KODE QR INTERAKTIF */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-xs w-full text-center shadow-2xl relative">
            <button 
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <h3 className="text-base font-bold text-white mb-1">Kode QR Kenangan</h3>
            <p className="text-xs text-zinc-400 mb-4">Cetak & tempelkan pada album/bingkai fisik Anda</p>

            <div className="bg-white p-3 rounded-xl inline-block mb-4 shadow-lg">
              <img src={qrCodeUrl} alt="Kode QR Kenangan" className="w-48 h-48" />
            </div>

            <p className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 p-2 rounded-lg border border-emerald-800/40">
              Pindai dengan kamera HP untuk memutar kenangan secara langsung.
            </p>
          </div>
        </div>
      )}

      {/* MODAL INPUT / EDIT FORM */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-md w-full text-left shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <button 
              onClick={() => {
                setShowModal(false);
                setIsEditing(false);
                previewAudioRef.current?.pause();
                setPreviewingTrackUrl(null);
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold mb-4 text-white">
              {isEditing ? 'Edit Momen Kenangan' : 'Tambah Momen Kenangan'}
            </h2>
            
            <form onSubmit={handleUpload} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Judul Momen *</label>
                <input 
                  type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Di Balik Layar"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Kategori Album</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 text-xs"
                >
                  {CATEGORIES.filter(c => c !== 'Semua').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* INPUT FILE FOTO + INDIKATOR NATIVE QUALITY */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Pilih Foto Kenangan {isEditing ? '(Opsional)' : '*'}
                </label>
                
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleSelectFile}
                  className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 cursor-pointer"
                />

                {/* PRATINJAU DENGAN INDIKATOR KUALITAS ASLI */}
                {croppedPreviewUrl && (
                  <div className="mt-3 flex items-center justify-between bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                    <div className="flex items-center gap-3">
                      <img src={croppedPreviewUrl} alt="Hasil Crop" className="w-12 h-12 object-cover rounded-lg border border-emerald-500" />
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-bold text-emerald-400">Foto Siap Ditampilkan</p>
                          <span className="text-[9px] bg-emerald-950 text-emerald-300 font-extrabold px-1.5 py-0.2 rounded border border-emerald-700 flex items-center gap-1">
                            <ShieldCheck size={10} className="text-emerald-400" />
                            Piksel Asli (Lossless)
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400">100% Tajam seperti kamera HP</p>
                      </div>
                    </div>

                    {rawImageSrc && (
                      <button
                        type="button"
                        onClick={() => setShowCropModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-lg text-xs font-semibold transition"
                      >
                        <Crop size={14} />
                        Atur Ulang
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* FITUR PENCARIAN MUSIK VIA API */}
              <div className="border-t border-zinc-800 pt-3">
                <label className="block text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
                  <Music className="text-emerald-500" size={14} />
                  Ganti/Cari Musik Latar (Pilih dari iTunes)
                </label>

                <div className="flex gap-2 mb-2">
                  <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchMusic(); } }}
                    placeholder="Ketik judul lagu atau penyanyi..."
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button 
                    type="button" 
                    onClick={handleSearchMusic} 
                    disabled={isSearching}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 rounded-lg flex items-center gap-1 text-xs transition disabled:opacity-50 font-semibold"
                  >
                    <Search size={14} />
                    {isSearching ? 'Cari...' : 'Cari'}
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 my-2 bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                    {searchResults.map((track) => {
                      const isSelected = selectedTrack?.trackId === track.trackId;
                      const isPreviewing = previewingTrackUrl === track.previewUrl;

                      return (
                        <div 
                          key={track.trackId}
                          className={`flex items-center justify-between p-2 rounded-lg border transition text-xs cursor-pointer ${
                            isSelected ? 'bg-emerald-950/80 border-emerald-500' : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden flex-1" onClick={() => {
                            setSelectedTrack(track);
                            setAudioFile(null);
                          }}>
                            <img src={track.artworkUrl60} alt={track.trackName} className="w-8 h-8 rounded object-cover" />
                            <div className="truncate">
                              <p className="font-semibold text-white truncate">{track.trackName}</p>
                              <p className="text-[10px] text-zinc-400 truncate">{track.artistName}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-2">
                            <button
                              type="button"
                              onClick={() => togglePreviewTrack(track.previewUrl)}
                              className="p-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white"
                            >
                              {isPreviewing ? <Pause size={12} /> : <Play size={12} />}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTrack(track);
                                setAudioFile(null);
                              }}
                              className={`p-1.5 rounded-full ${isSelected ? 'text-emerald-500' : 'text-zinc-500 hover:text-white'}`}
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedTrack && (
                  <div className="bg-emerald-950/50 border border-emerald-800/60 p-2.5 rounded-lg flex items-center justify-between text-xs text-emerald-200 mt-2">
                    <span className="truncate">
                      <strong>Lagu Terpilih:</strong> {selectedTrack.artistName} - {selectedTrack.trackName}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setSelectedTrack(null)} 
                      className="text-xs text-emerald-400 hover:underline ml-2"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>

              {!selectedTrack && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Atau Upload Voice Note / File MP3 Manual (Opsional)</label>
                  <input 
                    type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files[0])}
                    className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 cursor-pointer"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Artis / Penyanyi (Subjudul)</label>
                <input 
                  type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Contoh: Juicy Luicy"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Kutipan Lirik / Catatan Memori</label>
                <textarea 
                  rows={3}
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={`Contoh:\nHapus semua bedakmu,\ntampilkan wajah aslimu...`}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 text-xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" onClick={() => {
                    setShowModal(false);
                    setIsEditing(false);
                    previewAudioRef.current?.pause();
                    setPreviewingTrackUrl(null);
                  }}
                  className="px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-xs text-zinc-300"
                >
                  Batal
                </button>
                <button 
                  type="submit" disabled={loading}
                  className="px-4 py-2 bg-emerald-500 text-black font-bold rounded-lg hover:bg-emerald-400 text-xs disabled:opacity-50"
                >
                  {loading ? 'Sabar...' : (isEditing ? 'Perbarui Momen' : 'Simpan Kenangan')}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* POPUP PEMOTONG FOTO NATIVE (Z-[60]) */}
      {showCropModal && rawImageSrc && (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 p-5 rounded-2xl max-w-sm w-full shadow-2xl flex flex-col items-center relative">
            
            <div className="flex items-center justify-between w-full mb-3 border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Crop size={18} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Potong Foto Kualitas Murni</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowCropModal(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 mb-2 text-center">
              Geser posisi & atur zoom. Pemotongan langsung mengambil piksel asli kamera HP ({rawImgDimensions.width} × {rawImgDimensions.height}px).
            </p>

            {/* AREA CANVAS CROPPER REALTIME */}
            <div 
              className="relative w-[280px] h-[280px] bg-black rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-2xl cursor-grab active:cursor-grabbing flex items-center justify-center touch-none"
              onMouseDown={(e) => handleStartDrag(e.clientX, e.clientY)}
              onMouseMove={(e) => handleMoveDrag(e.clientX, e.clientY)}
              onMouseUp={handleEndDrag}
              onMouseLeave={handleEndDrag}
              onTouchStart={(e) => handleStartDrag(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchMove={(e) => handleMoveDrag(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchEnd={handleEndDrag}
            >
              <canvas ref={canvasRef} className="w-full h-full object-contain pointer-events-none" />
            </div>

            {/* SLIDER ZOOM */}
            <div className="w-full flex items-center gap-3 my-4 px-2">
              <ZoomIn size={16} className="text-zinc-400 shrink-0" />
              <input 
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 w-full pt-1 border-t border-zinc-800">
              <button 
                type="button" 
                onClick={() => setShowCropModal(false)}
                className="px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-xs text-zinc-300"
              >
                Batal
              </button>
              <button 
                type="button" 
                onClick={handleConfirmCrop}
                className="px-4 py-2 bg-emerald-500 text-black font-bold rounded-lg hover:bg-emerald-400 text-xs flex items-center gap-1.5"
              >
                <Check size={16} />
                Potong & Simpan Kualitas Murni
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}