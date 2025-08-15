"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Camera, RotateCcw, Printer, Download, Settings, Sparkles, Instagram, Github, Home, User, Shield, Mail, Layout, Play, Pause, Square, Heart, Zap, Star, Music, PartyPopper, Camera as CameraIcon, Smile, Palette, Sparkles as SparklesIcon } from 'lucide-react'
import { cn } from "@/lib/utils"

type PhotoLayout = "1x1" | "1x2" | "1x3" | "1x4"
type Filter = "none" | "vintage" | "blackwhite" | "warm" | "cool" | "neon" | "retro" | "dreamy"
type Overlay = "none" | "hat" | "glasses" | "crown" | "hearts" | "stars" | "rainbow" | "fire"

interface CapturedPhoto {
  dataUrl: string
  timestamp: Date
}

interface PolaroidStrip {
  photos: CapturedPhoto[]
  note?: string
  layout: PhotoLayout
}

export default function PhotoBooth() {
  const [currentStep, setCurrentStep] = useState<"landing" | "selection" | "camera" | "preview" | "note">("landing")
  const [curtainsOpen, setCurtainsOpen] = useState(false)
  const [selectedLayout, setSelectedLayout] = useState<PhotoLayout>("1x1")
  const [selectedFilter, setSelectedFilter] = useState<Filter>("none")
  const [selectedOverlay, setSelectedOverlay] = useState<Overlay>("none")
  const [timerSeconds, setTimerSeconds] = useState(3)
  const [countdown, setCountdown] = useState(0)
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([])
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)
  const [polaroidNote, setPolaroidNote] = useState("")
  const [isMobile, setIsMobile] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const photoLayoutConfig = {
    "1x1": { count: 1, label: "Solo Shot", icon: "📸", description: "Perfect for that main character energy", emoji: "✨" },
    "1x2": { count: 2, label: "Bestie Strip", icon: "👯‍♀️", description: "Double trouble vibes", emoji: "💅" },
    "1x3": { count: 3, label: "Squad Goals", icon: "👥", description: "Three's a party", emoji: "🔥" },
    "1x4": { count: 4, label: "Epic Collage", icon: "🎭", description: "Maximum chaos energy", emoji: "⚡" },
  }

  const filterConfig = {
    none: { label: "Natural", description: "No filter needed, you're already perfect", emoji: "😌" },
    vintage: { label: "Vintage Vibes", description: "Throwback to the good old days", emoji: "📼" },
    blackwhite: { label: "Monochrome", description: "Classic black & white aesthetic", emoji: "🎭" },
    warm: { label: "Golden Hour", description: "Warm and cozy feels", emoji: "🌅" },
    cool: { label: "Ice Cold", description: "Cool blue tones", emoji: "❄️" },
    neon: { label: "Neon Dreams", description: "Cyberpunk aesthetic", emoji: "🌃" },
    retro: { label: "Retro Wave", description: "80s synthwave vibes", emoji: "🎸" },
    dreamy: { label: "Dreamy", description: "Soft and ethereal", emoji: "💫" },
  }

  const overlayConfig = {
    none: { label: "Natural", emoji: "😊" },
    hat: { label: "Party Hat", emoji: "🎩" },
    glasses: { label: "Cool Shades", emoji: "🕶️" },
    crown: { label: "Crown", emoji: "👑" },
    hearts: { label: "Hearts", emoji: "💖" },
    stars: { label: "Stars", emoji: "⭐" },
    rainbow: { label: "Rainbow", emoji: "🌈" },
    fire: { label: "Fire", emoji: "🔥" },
  }

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Check if camera is available
  const checkCameraAvailability = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter((device) => device.kind === "videoinput")
      setHasCamera(videoDevices.length > 0)
      return videoDevices.length > 0
    } catch (error) {
      console.error("Error checking camera availability:", error)
      setHasCamera(false)
      return false
    }
  }, [])

  const startCamera = useCallback(async () => {
    setIsLoading(true)
    setCameraError(null)

    try {
      // Stop any existing stream first
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop())
      }

      // Check if camera is available first
      const cameraAvailable = await checkCameraAvailability()
      if (!cameraAvailable) {
        throw new Error("No camera devices found")
      }

      // Request camera permission with mobile-optimized constraints
      const constraints = {
        video: {
          width: { ideal: isMobile ? 640 : 1280, min: 320 },
          height: { ideal: isMobile ? 480 : 720, min: 240 },
          facingMode: "user",
          aspectRatio: { ideal: 4/3 }
        },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      if (!stream) {
        throw new Error("Failed to get camera stream")
      }

      setCameraStream(stream)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error("Video element not available"))
            return
          }

          const video = videoRef.current

          const onLoadedMetadata = () => {
            video.removeEventListener("loadedmetadata", onLoadedMetadata)
            video.removeEventListener("error", onError)
            resolve()
          }

          const onError = (error: Event) => {
            video.removeEventListener("loadedmetadata", onLoadedMetadata)
            video.removeEventListener("error", onError)
            reject(new Error("Video failed to load"))
          }

          video.addEventListener("loadedmetadata", onLoadedMetadata)
          video.addEventListener("error", onError)

          // Timeout after 10 seconds
          setTimeout(() => {
            video.removeEventListener("loadedmetadata", onLoadedMetadata)
            video.removeEventListener("error", onError)
            reject(new Error("Video loading timeout"))
          }, 10000)
        })
      }
    } catch (error: any) {
      console.error("Camera access error:", error)
      let errorMessage = "Camera access failed! "

      if (error.name === "NotAllowedError") {
        errorMessage += "Please allow camera permissions and try again! 📱"
      } else if (error.name === "NotFoundError") {
        errorMessage += "No camera found on your device! 📷"
      } else if (error.name === "NotReadableError") {
        errorMessage += "Camera is busy with another app! 🔄"
      } else {
        errorMessage += "Something went wrong with your camera! 🤔"
      }

      setCameraError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [checkCameraAvailability, cameraStream, isMobile])

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => {
        track.stop()
      })
      setCameraStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [cameraStream])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      console.error("Video or canvas element not available")
      return
    }

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      console.error("Canvas context not available")
      return
    }

    try {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Apply filters
      const filterMap = {
        none: "none",
        vintage: "sepia(80%) contrast(120%) brightness(110%) saturate(130%)",
        blackwhite: "grayscale(100%) contrast(110%)",
        warm: "sepia(30%) saturate(140%) brightness(110%)",
        cool: "hue-rotate(180deg) saturate(120%) brightness(105%)",
        neon: "hue-rotate(90deg) saturate(200%) brightness(120%) contrast(150%)",
        retro: "sepia(50%) hue-rotate(30deg) saturate(150%) brightness(110%)",
        dreamy: "brightness(110%) contrast(90%) saturate(120%) blur(0.5px)",
      }

      ctx.filter = filterMap[selectedFilter]
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Reset filter for overlays
      ctx.filter = "none"

      // Add overlays
      if (selectedOverlay === "hat") {
        // Draw party hat
        ctx.fillStyle = "rgba(255, 0, 0, 0.9)"
        ctx.beginPath()
        ctx.moveTo(canvas.width * 0.5, canvas.height * 0.1)
        ctx.lineTo(canvas.width * 0.3, canvas.height * 0.25)
        ctx.lineTo(canvas.width * 0.7, canvas.height * 0.25)
        ctx.closePath()
        ctx.fill()
      } else if (selectedOverlay === "glasses") {
        // Draw cool glasses
        ctx.strokeStyle = "#2c3e50"
        ctx.lineWidth = Math.max(8, canvas.width * 0.015)
        ctx.beginPath()
        ctx.arc(canvas.width * 0.35, canvas.height * 0.35, canvas.width * 0.08, 0, Math.PI * 2)
        ctx.arc(canvas.width * 0.65, canvas.height * 0.35, canvas.width * 0.08, 0, Math.PI * 2)
        ctx.stroke()
        // Bridge
        ctx.beginPath()
        ctx.moveTo(canvas.width * 0.35 + canvas.width * 0.08, canvas.height * 0.35)
        ctx.lineTo(canvas.width * 0.65 - canvas.width * 0.08, canvas.height * 0.35)
        ctx.stroke()
      } else if (selectedOverlay === "crown") {
        // Draw crown
        ctx.fillStyle = "rgba(255, 215, 0, 0.9)"
        ctx.fillRect(canvas.width * 0.25, canvas.height * 0.05, canvas.width * 0.5, canvas.height * 0.15)
        // Crown points
        for (let i = 0; i < 5; i++) {
          ctx.beginPath()
          ctx.moveTo(canvas.width * (0.3 + i * 0.1), canvas.height * 0.05)
          ctx.lineTo(canvas.width * (0.35 + i * 0.1), canvas.height * 0.02)
          ctx.lineTo(canvas.width * (0.4 + i * 0.1), canvas.height * 0.05)
          ctx.closePath()
          ctx.fill()
        }
      } else if (selectedOverlay === "hearts") {
        // Draw hearts around
        ctx.fillStyle = "rgba(255, 20, 147, 0.8)"
        const heartPositions = [
          [0.1, 0.2], [0.9, 0.2], [0.1, 0.8], [0.9, 0.8]
        ]
        heartPositions.forEach(([x, y]) => {
          ctx.beginPath()
          ctx.arc(canvas.width * x, canvas.height * y, 20, 0, Math.PI * 2)
          ctx.fill()
        })
      } else if (selectedOverlay === "stars") {
        // Draw stars
        ctx.fillStyle = "rgba(255, 255, 0, 0.9)"
        const starPositions = [
          [0.1, 0.15], [0.9, 0.15], [0.1, 0.85], [0.9, 0.85]
        ]
        starPositions.forEach(([x, y]) => {
          ctx.beginPath()
          for (let i = 0; i < 5; i++) {
            const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2
            const x1 = canvas.width * x + Math.cos(angle) * 15
            const y1 = canvas.height * y + Math.sin(angle) * 15
            if (i === 0) ctx.moveTo(x1, y1)
            else ctx.lineTo(x1, y1)
          }
          ctx.closePath()
          ctx.fill()
        })
      }

      const dataUrl = canvas.toDataURL("image/jpeg", 0.95)
      const newPhoto: CapturedPhoto = {
        dataUrl,
        timestamp: new Date(),
      }

      setCapturedPhotos((prev) => [...prev, newPhoto])
      setCurrentPhotoIndex((prev) => prev + 1)
    } catch (error) {
      console.error("Error capturing photo:", error)
      setCameraError("Failed to capture photo. Please try again! 📸")
    }
  }, [selectedFilter, selectedOverlay])

  const startCountdown = useCallback(() => {
    if (countdown > 0) return // Prevent multiple countdowns

    setCountdown(timerSeconds)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setTimeout(() => capturePhoto(), 100)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [timerSeconds, capturePhoto, countdown])

  const handleStartPhotoBooth = () => {
    setCurtainsOpen(true)
    setTimeout(() => {
      setCurrentStep("selection")
    }, 1200)
  }

  const handleLayoutSelection = (layout: PhotoLayout) => {
    setSelectedLayout(layout)
    setCurrentStep("camera")
    startCamera()
  }

  const handleRetake = () => {
    setCapturedPhotos([])
    setCurrentPhotoIndex(0)
    setCurrentStep("camera")
    setCameraError(null)
  }

  const handlePrint = () => {
    const polaroidStrip: PolaroidStrip = {
      photos: capturedPhotos,
      note: polaroidNote,
      layout: selectedLayout
    }
    
    // Create print window
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>PixelBooth Polaroid Strip</title>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: 'Arial', sans-serif;
              background: #f0f0f0;
            }
            .polaroid-strip {
              background: white;
              padding: 20px;
              border-radius: 10px;
              box-shadow: 0 4px 8px rgba(0,0,0,0.1);
              max-width: 600px;
              margin: 0 auto;
            }
            .photos-container {
              display: flex;
              flex-direction: column;
              gap: 15px;
              margin-bottom: 20px;
            }
            .photo {
              width: 100%;
              height: 200px;
              object-fit: cover;
              border-radius: 8px;
              border: 2px solid #e0e0e0;
            }
            .note {
              font-style: italic;
              color: #666;
              text-align: center;
              padding: 10px;
              border-top: 1px solid #e0e0e0;
              margin-top: 15px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              color: #333;
            }
            @media print {
              body { background: white; }
              .polaroid-strip { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="polaroid-strip">
            <div class="header">
              <h1>✨ PixelBooth ✨</h1>
              <p>${new Date().toLocaleDateString()} • ${new Date().toLocaleTimeString()}</p>
            </div>
            <div class="photos-container">
              ${polaroidStrip.photos.map(photo => `
                <img src="${photo.dataUrl}" class="photo" alt="Captured moment" />
              `).join('')}
            </div>
            ${polaroidStrip.note ? `<div class="note">"${polaroidStrip.note}"</div>` : ''}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 1000);
            }
          </script>
        </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  const handleNewSession = () => {
    setCapturedPhotos([])
    setCurrentPhotoIndex(0)
    setCurrentStep("landing")
    setCurtainsOpen(false)
    setCameraError(null)
    setPolaroidNote("")
    stopCamera()
  }

  const downloadPhoto = (photo: CapturedPhoto, index: number) => {
    try {
      const link = document.createElement("a")
      link.download = `pixelbooth-photo-${index + 1}-${Date.now()}.jpg`
      link.href = photo.dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Error downloading photo:", error)
    }
  }

  const downloadAllPhotos = () => {
    capturedPhotos.forEach((photo, index) => {
      setTimeout(() => downloadPhoto(photo, index), index * 500)
    })
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const isSessionComplete = capturedPhotos.length >= photoLayoutConfig[selectedLayout].count

  if (currentStep === "landing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 w-72 h-72 bg-yellow-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div className="absolute top-40 right-20 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse" style={{ animationDelay: "2s" }}></div>
          <div className="absolute -bottom-8 left-40 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse" style={{ animationDelay: "4s" }}></div>
        </div>

        {/* Floating emojis */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 text-4xl animate-bounce" style={{ animationDelay: "0s" }}>✨</div>
          <div className="absolute top-1/3 right-1/4 text-4xl animate-bounce" style={{ animationDelay: "1s" }}>🔥</div>
          <div className="absolute bottom-1/3 left-1/3 text-4xl animate-bounce" style={{ animationDelay: "2s" }}>💅</div>
          <div className="absolute bottom-1/4 right-1/3 text-4xl animate-bounce" style={{ animationDelay: "3s" }}>⚡</div>
        </div>

        {/* Curtains */}
        <div className={cn(
          "absolute inset-0 flex transition-all duration-1200 ease-out z-10",
          curtainsOpen ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100",
        )}>
          <div className="w-1/2 bg-gradient-to-r from-black via-gray-900 to-black border-r-4 border-pink-400 shadow-2xl">
            <div className="h-full bg-gradient-to-b from-transparent via-pink-500/10 to-pink-500/30"></div>
          </div>
        </div>
        <div className={cn(
          "absolute inset-0 flex transition-all duration-1200 ease-out z-10",
          curtainsOpen ? "translate-x-full opacity-0" : "translate-x-0 opacity-100",
        )}>
          <div className="w-1/2 ml-auto bg-gradient-to-l from-black via-gray-900 to-black border-l-4 border-purple-400 shadow-2xl">
            <div className="h-full bg-gradient-to-b from-transparent via-purple-500/10 to-purple-500/30"></div>
          </div>
        </div>

        {/* Content */}
        <div className="text-center z-20 text-white px-8">
          <div className="mb-12">
            <div className="mb-6">
              <div className="text-2xl font-light tracking-widest text-pink-200 mb-4 animate-pulse">✨ WELCOME TO ✨</div>
              <h1 className="text-8xl md:text-9xl font-black bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent leading-none animate-pulse">
                PIXEL
              </h1>
              <h2 className="text-8xl md:text-9xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent leading-none animate-pulse">
                BOOTH
              </h2>
            </div>
            <p className="text-xl text-pink-100 font-light tracking-wide max-w-2xl mx-auto">
              Your ultimate Gen Z photo booth experience! 📸✨ Capture those main character moments with style! 💅🔥
            </p>
          </div>

          <div className="text-6xl mb-12 animate-bounce">🎉</div>

          <Button
            onClick={handleStartPhotoBooth}
            size="lg"
            className="text-xl px-12 py-6 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-full shadow-2xl transform hover:scale-105 transition-all duration-300 border-2 border-white/20 animate-pulse"
          >
            <PartyPopper className="mr-3 h-6 w-6" />
            Let's Get Lit! 🔥
          </Button>
        </div>
      </div>
    )
  }

  if (currentStep === "selection") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Choose Your Vibe! ✨</h2>
            <p className="text-lg md:text-xl text-gray-600 font-light">Pick the perfect layout for your main character moment! 💅</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            {Object.entries(photoLayoutConfig).map(([layout, config]) => (
              <Card
                key={layout}
                className="group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border-2 hover:border-pink-300 bg-white/80 backdrop-blur-sm"
                onClick={() => handleLayoutSelection(layout as PhotoLayout)}
              >
                <CardContent className="p-6 md:p-8 text-center">
                  <div className="text-4xl md:text-6xl mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-300">
                    {config.icon}
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">{config.label}</h3>
                  <p className="text-gray-600 mb-4 text-sm md:text-base">{config.description}</p>
                  <Badge variant="secondary" className="text-sm px-3 py-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white">
                    {config.count} photo{config.count > 1 ? "s" : ""} {config.emoji}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (currentStep === "camera") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex flex-col">
        {/* Header */}
        <div className="bg-black/50 border-b border-purple-500/30 p-4 md:p-6 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">
                Photo {currentPhotoIndex + 1} of {photoLayoutConfig[selectedLayout].count} 📸
              </h2>
              <p className="text-purple-300">{photoLayoutConfig[selectedLayout].label}</p>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white">
              {photoLayoutConfig[selectedLayout].emoji} {photoLayoutConfig[selectedLayout].label}
            </Badge>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-4xl">
            {/* Camera View */}
            <div className="relative bg-black rounded-2xl overflow-hidden mb-6 md:mb-8 shadow-2xl border-2 border-purple-500/30">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
                    <p>Setting up your camera... 📱</p>
                  </div>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <div className="text-center text-white p-8 max-w-md">
                    <Pause className="h-16 w-16 mx-auto mb-4 text-red-500" />
                    <p className="text-lg mb-4">{cameraError}</p>
                    <div className="space-y-2">
                      <Button onClick={startCamera} variant="outline" className="mr-2 bg-transparent border-pink-500 text-pink-500 hover:bg-pink-500 hover:text-white">
                        Try Again 🔄
                      </Button>
                      <Button onClick={() => setCurrentStep("selection")} variant="secondary" className="bg-purple-600 hover:bg-purple-700">
                        Back to Selection ⬅️
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!cameraError && !isLoading && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "w-full h-64 md:h-96 object-cover",
                    selectedFilter === "vintage" && "sepia contrast-125 brightness-110 saturate-130",
                    selectedFilter === "blackwhite" && "grayscale contrast-110",
                    selectedFilter === "warm" && "sepia-[0.3] saturate-140 brightness-110",
                    selectedFilter === "cool" && "hue-rotate-180 saturate-120 brightness-105",
                    selectedFilter === "neon" && "hue-rotate-90 saturate-200 brightness-120 contrast-150",
                    selectedFilter === "retro" && "sepia-[0.5] hue-rotate-30 saturate-150 brightness-110",
                    selectedFilter === "dreamy" && "brightness-110 contrast-90 saturate-120 blur-[0.5px]",
                  )}
                />
              )}

              {countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-20">
                  <div className="text-center">
                    <div className="text-6xl md:text-9xl font-bold text-white animate-pulse mb-4">{countdown}</div>
                    <p className="text-xl md:text-2xl text-white">Get ready! 📸</p>
                  </div>
                </div>
              )}

              {/* Overlay previews */}
              {selectedOverlay !== "none" && !cameraError && (
                <div className="absolute top-4 right-4 text-4xl md:text-6xl opacity-80">
                  {overlayConfig[selectedOverlay].emoji}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
              <Card className="bg-black/50 border-purple-500/30 backdrop-blur-sm">
                <CardContent className="p-4">
                  <label className="block text-white mb-3 font-semibold flex items-center">
                    <Palette className="h-4 w-4 mr-2" />
                    Filter Vibes
                  </label>
                  <Select value={selectedFilter} onValueChange={(value: Filter) => setSelectedFilter(value)}>
                    <SelectTrigger className="bg-gray-800 border-purple-500/30 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(filterConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div>
                            <div className="font-medium">{config.label} {config.emoji}</div>
                            <div className="text-sm text-gray-500">{config.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-black/50 border-purple-500/30 backdrop-blur-sm">
                <CardContent className="p-4">
                  <label className="block text-white mb-3 font-semibold flex items-center">
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    Fun Add-ons
                  </label>
                  <Select value={selectedOverlay} onValueChange={(value: Overlay) => setSelectedOverlay(value)}>
                    <SelectTrigger className="bg-gray-800 border-purple-500/30 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(overlayConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label} {config.emoji}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-black/50 border-purple-500/30 backdrop-blur-sm">
                <CardContent className="p-4">
                  <label className="block text-white mb-3 font-semibold">Timer ⏰</label>
                  <Select
                    value={timerSeconds.toString()}
                    onValueChange={(value) => setTimerSeconds(Number.parseInt(value))}
                  >
                    <SelectTrigger className="bg-gray-800 border-purple-500/30 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 seconds ⚡</SelectItem>
                      <SelectItem value="5">5 seconds 🕐</SelectItem>
                      <SelectItem value="10">10 seconds 🕙</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="text-center space-y-4">
              <Button
                onClick={startCountdown}
                disabled={countdown > 0 || isLoading || !!cameraError}
                size="lg"
                className="text-xl px-8 md:px-12 py-4 md:py-6 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 rounded-full"
              >
                <Camera className="mr-3 h-6 w-6" />
                {countdown > 0 ? `Taking photo in ${countdown}... 📸` : "Capture That Moment! 📸"}
              </Button>

              {isSessionComplete && (
                <div>
                  <Button
                    onClick={() => setCurrentStep("note")}
                    size="lg"
                    className="text-xl px-8 md:px-12 py-4 bg-green-600 hover:bg-green-700 ml-4 rounded-full"
                  >
                    Add Note & Review! ✨ ({capturedPhotos.length})
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    )
  }

  if (currentStep === "note") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Add Your Vibe! ✨</h2>
            <p className="text-lg text-gray-600">Want to add a note to your polaroid strip? (Optional)</p>
          </div>

          <Card className="bg-white/80 backdrop-blur-sm border-2 border-pink-300">
            <CardContent className="p-6 md:p-8">
              <div className="mb-6">
                <label className="block text-gray-700 mb-3 font-semibold">Your Message 💭</label>
                <Textarea
                  value={polaroidNote}
                  onChange={(e) => setPolaroidNote(e.target.value)}
                  placeholder="Add a fun caption, quote, or just your thoughts! ✨"
                  className="min-h-[100px] resize-none border-2 border-pink-200 focus:border-pink-400"
                  maxLength={100}
                />
                <div className="text-right text-sm text-gray-500 mt-2">
                  {polaroidNote.length}/100
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => setCurrentStep("preview")}
                  size="lg"
                  className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-full"
                >
                  Skip & Continue ➡️
                </Button>
                <Button
                  onClick={() => setCurrentStep("preview")}
                  size="lg"
                  className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white rounded-full"
                >
                  Continue with Note ✨
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (currentStep === "preview") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Your Epic Collection! ✨</h2>
            <p className="text-lg md:text-xl text-gray-600">Main character moments captured perfectly! 💅</p>
          </div>

          {/* Polaroid Strip */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 mb-8 md:mb-12 max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">✨ PixelBooth ✨</h3>
              <p className="text-gray-600 text-sm">
                {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString()}
              </p>
            </div>
            
            <div className="space-y-4 mb-6">
              {capturedPhotos.map((photo, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-2">
                  <img
                    src={photo.dataUrl}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-48 md:h-64 object-cover rounded-md shadow-md"
                  />
                </div>
              ))}
            </div>

            {polaroidNote && (
              <div className="text-center p-4 bg-pink-50 rounded-lg border-2 border-pink-200">
                <p className="text-gray-700 italic">"{polaroidNote}"</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <Button
              onClick={handleRetake}
              variant="outline"
              size="lg"
              className="text-lg px-6 md:px-8 py-3 md:py-4 border-2 hover:bg-gray-50 bg-white rounded-full"
            >
              <RotateCcw className="mr-2 h-5 w-5" />
              Retake Photos 🔄
            </Button>

            <Button 
              onClick={handlePrint} 
              size="lg" 
              className="text-lg px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white rounded-full"
            >
              <Printer className="mr-2 h-5 w-5" />
              Print Strip! 🖨️
            </Button>

            <Button
              onClick={downloadAllPhotos}
              variant="outline"
              size="lg"
              className="text-lg px-6 md:px-8 py-3 md:py-4 border-2 hover:bg-gray-50 bg-white rounded-full"
            >
              <Download className="mr-2 h-5 w-5" />
              Download All 📱
            </Button>

            <Button
              onClick={handleNewSession}
              variant="outline"
              size="lg"
              className="text-lg px-6 md:px-8 py-3 md:py-4 border-2 hover:bg-gray-50 bg-white rounded-full"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              New Session ✨
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
