"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Camera, RotateCcw, Printer, Download, Settings, Sparkles, Instagram, Github, Home, User, Shield, Mail, Layout, Play, Pause, Square, Edit3 } from 'lucide-react'
import { cn } from "@/lib/utils"

type PhotoLayout = "1x1" | "1x2" | "2x2" | "1x3"
type Filter = "none" | "vintage" | "blackwhite" | "warm" | "cool"
type Overlay = "none" | "hat" | "glasses" | "frame1" | "frame2"

interface CapturedPhoto {
  dataUrl: string
  timestamp: Date
}

interface PhotoSession {
  photos: CapturedPhoto[]
  layout: PhotoLayout
  note?: string
  timestamp: Date
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
  const [sessionNote, setSessionNote] = useState("")
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const photoLayoutConfig = {
    "1x1": { count: 1, label: "Single Portrait", icon: "📷", description: "Perfect for profile photos" },
    "1x2": { count: 2, label: "Classic Strip", icon: "📸", description: "Traditional photo booth style" },
    "2x2": { count: 4, label: "Collage Grid", icon: "🖼️", description: "Four memorable moments" },
    "1x3": { count: 3, label: "Story Strip", icon: "🎬", description: "Tell your story in three" },
  }

  const filterConfig = {
    none: { label: "Natural", description: "Pure and authentic" },
    vintage: { label: "Vintage", description: "Timeless classic look" },
    blackwhite: { label: "Monochrome", description: "Elegant black & white" },
    warm: { label: "Warm", description: "Cozy golden tones" },
    cool: { label: "Cool", description: "Fresh blue tones" },
  }

  // Check if device is mobile
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
      // Check if camera is available first
      const cameraAvailable = await checkCameraAvailability()
      if (!cameraAvailable) {
        throw new Error("No camera devices found")
      }

      // Request camera permission with fallback constraints
      let stream: MediaStream | null = null

      try {
        // Try with ideal constraints first
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            facingMode: "user",
          },
          audio: false,
        })
      } catch (error) {
        console.warn("Failed with ideal constraints, trying basic constraints:", error)
        // Fallback to basic constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

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
      let errorMessage = "Unable to access camera. "

      if (error.name === "NotAllowedError") {
        errorMessage += "Please allow camera permissions and try again."
      } else if (error.name === "NotFoundError") {
        errorMessage += "No camera device found."
      } else if (error.name === "NotReadableError") {
        errorMessage += "Camera is already in use by another application."
      } else {
        errorMessage += "Please check your camera connection and permissions."
      }

      setCameraError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [checkCameraAvailability])

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
      }

      ctx.filter = filterMap[selectedFilter]
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Reset filter for overlays
      ctx.filter = "none"

      // Add overlays
      if (selectedOverlay === "hat") {
        ctx.fillStyle = "rgba(139, 69, 19, 0.9)"
        ctx.fillRect(canvas.width * 0.25, canvas.height * 0.05, canvas.width * 0.5, canvas.height * 0.2)
        ctx.fillStyle = "rgba(101, 67, 33, 0.9)"
        ctx.fillRect(canvas.width * 0.3, canvas.height * 0.08, canvas.width * 0.4, canvas.height * 0.12)
      } else if (selectedOverlay === "glasses") {
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
      setCameraError("Failed to capture photo. Please try again.")
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
    // Create a printable version of the polaroid strip
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert("Please allow popups to print your photos!")
      return
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>PixelBooth Photos</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              background: white;
            }
            .polaroid-strip {
              display: flex;
              flex-direction: column;
              align-items: center;
              max-width: 600px;
              margin: 0 auto;
              background: white;
              padding: 20px;
            }
            .photo-container {
              margin: 10px 0;
              background: white;
              padding: 15px;
              box-shadow: 0 4px 8px rgba(0,0,0,0.1);
              border-radius: 8px;
            }
            .photo {
              width: 100%;
              max-width: 400px;
              height: auto;
              border-radius: 4px;
            }
            .photo-info {
              text-align: center;
              margin-top: 15px;
              font-family: monospace;
            }
            .note {
              margin-top: 20px;
              padding: 15px;
              background: #f8f9fa;
              border-left: 4px solid #007bff;
              font-style: italic;
            }
            @media print {
              body { margin: 0; }
              .polaroid-strip { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="polaroid-strip">
            <h1 style="text-align: center; color: #333; margin-bottom: 30px;">PixelBooth Memories</h1>
            ${capturedPhotos.map((photo, index) => `
              <div class="photo-container">
                <img src="${photo.dataUrl}" alt="Photo ${index + 1}" class="photo" />
                <div class="photo-info">
                  <div style="font-weight: bold; font-size: 18px; margin-bottom: 5px;">PIXELBOOTH</div>
                  <div style="font-size: 12px; color: #666;">
                    ${photo.timestamp.toLocaleDateString()} • ${photo.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            `).join('')}
            ${sessionNote ? `
              <div class="note">
                <strong>Note:</strong> ${sessionNote}
              </div>
            ` : ''}
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => window.print(), 500);
            }
          </script>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
  }

  const handleNewSession = () => {
    setCapturedPhotos([])
    setCurrentPhotoIndex(0)
    setSessionNote("")
    setCurrentStep("landing")
    setCurtainsOpen(false)
    setCameraError(null)
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

  const handleSessionComplete = () => {
    setCurrentStep("note")
  }

  const handleNoteSubmit = () => {
    setCurrentStep("preview")
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div
            className="absolute top-40 right-20 w-72 h-72 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"
            style={{ animationDelay: "2s" }}
          ></div>
          <div
            className="absolute -bottom-8 left-40 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"
            style={{ animationDelay: "4s" }}
          ></div>
        </div>

        {/* Curtains */}
        <div
          className={cn(
            "absolute inset-0 flex transition-all duration-1200 ease-out z-10",
            curtainsOpen ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100",
          )}
        >
          <div className="w-1/2 bg-gradient-to-r from-red-900 via-red-800 to-red-700 border-r-8 border-yellow-400 shadow-2xl">
            <div className="h-full bg-gradient-to-b from-transparent via-black/10 to-black/30"></div>
          </div>
        </div>
        <div
          className={cn(
            "absolute inset-0 flex transition-all duration-1200 ease-out z-10",
            curtainsOpen ? "translate-x-full opacity-0" : "translate-x-0 opacity-100",
          )}
        >
          <div className="w-1/2 ml-auto bg-gradient-to-l from-red-900 via-red-800 to-red-700 border-l-8 border-yellow-400 shadow-2xl">
            <div className="h-full bg-gradient-to-b from-transparent via-black/10 to-black/30"></div>
          </div>
        </div>

        {/* Content */}
        <div className="text-center z-20 text-white px-8">
          <div className="mb-12">
            <div className="mb-6">
              <div className="text-2xl font-light tracking-widest text-gray-300 mb-4">WELCOME TO</div>
              <h1 className="text-6xl md:text-8xl lg:text-9xl font-black bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent leading-none">
                PIXEL
              </h1>
              <h2 className="text-6xl md:text-8xl lg:text-9xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent leading-none">
                BOOTH
              </h2>
            </div>
            <p className="text-lg md:text-xl text-gray-300 font-light tracking-wide max-w-2xl mx-auto">
              Professional photo booth experience with stunning filters and instant prints
            </p>
          </div>

          <div className="text-6xl mb-12 animate-bounce">✨</div>

          <Button
            onClick={handleStartPhotoBooth}
            size="lg"
            className="text-xl px-8 md:px-12 py-4 md:py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-full shadow-2xl transform hover:scale-105 transition-all duration-300 border-2 border-white/20"
          >
            <Play className="mr-3 h-6 w-6" />
            Start Photo Session
          </Button>
        </div>
      </div>
    )
  }

  if (currentStep === "selection") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-6xl">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Choose Your Style</h2>
            <p className="text-lg md:text-xl text-gray-600 font-light">Select the perfect layout for your photos</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            {Object.entries(photoLayoutConfig).map(([layout, config]) => (
              <Card
                key={layout}
                className="group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border-2 hover:border-purple-300"
                onClick={() => handleLayoutSelection(layout as PhotoLayout)}
              >
                <CardContent className="p-6 md:p-8 text-center">
                  <div className="text-4xl md:text-6xl mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-300">
                    {config.icon}
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">{config.label}</h3>
                  <p className="text-sm md:text-base text-gray-600 mb-4">{config.description}</p>
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {config.count} photo{config.count > 1 ? "s" : ""}
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
      <div className="min-h-screen bg-black flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-700 p-4 md:p-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-white mb-1">
                Photo {currentPhotoIndex + 1} of {photoLayoutConfig[selectedLayout].count}
              </h2>
              <p className="text-sm md:text-base text-gray-400">{photoLayoutConfig[selectedLayout].label}</p>
            </div>
            <Badge variant="secondary" className="text-sm md:text-lg px-3 md:px-4 py-1 md:py-2 bg-purple-600 text-white">
              {photoLayoutConfig[selectedLayout].label}
            </Badge>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-4xl">
            {/* Camera View */}
            <div className="relative bg-gray-900 rounded-2xl overflow-hidden mb-6 md:mb-8 shadow-2xl">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                  <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p>Initializing camera...</p>
                  </div>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                  <div className="text-center text-white p-4 md:p-8 max-w-md">
                    <Pause className="h-12 md:h-16 w-12 md:w-16 mx-auto mb-4 text-red-500" />
                    <p className="text-base md:text-lg mb-4">{cameraError}</p>
                    <div className="space-y-2">
                      <Button onClick={startCamera} variant="outline" className="mr-2 bg-transparent">
                        Try Again
                      </Button>
                      <Button onClick={() => setCurrentStep("selection")} variant="secondary">
                        Back to Selection
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
                  )}
                />
              )}

              {countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-20">
                  <div className="text-center">
                    <div className="text-6xl md:text-9xl font-bold text-white animate-pulse mb-4">{countdown}</div>
                    <p className="text-xl md:text-2xl text-white">Get ready!</p>
                  </div>
                </div>
              )}

              {/* Overlay previews */}
              {selectedOverlay === "hat" && !cameraError && (
                <div className="absolute top-8 md:top-12 left-1/2 transform -translate-x-1/2 text-4xl md:text-8xl opacity-80">🎩</div>
              )}
              {selectedOverlay === "glasses" && !cameraError && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl md:text-8xl opacity-80">
                  🕶️
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-3 md:p-4">
                  <label className="block text-white mb-2 md:mb-3 font-semibold flex items-center text-sm md:text-base">
                    <Settings className="h-4 w-4 mr-2" />
                    Filter Style
                  </label>
                  <Select value={selectedFilter} onValueChange={(value: Filter) => setSelectedFilter(value)}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(filterConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div>
                            <div className="font-medium">{config.label}</div>
                            <div className="text-sm text-gray-500">{config.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-3 md:p-4">
                  <label className="block text-white mb-2 md:mb-3 font-semibold flex items-center text-sm md:text-base">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Fun Overlay
                  </label>
                  <Select value={selectedOverlay} onValueChange={(value: Overlay) => setSelectedOverlay(value)}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="hat">Top Hat 🎩</SelectItem>
                      <SelectItem value="glasses">Cool Glasses 🕶️</SelectItem>
                      <SelectItem value="frame1">Decorative Frame</SelectItem>
                      <SelectItem value="frame2">Vintage Frame</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-3 md:p-4">
                  <label className="block text-white mb-2 md:mb-3 font-semibold text-sm md:text-base">Timer Duration</label>
                  <Select
                    value={timerSeconds.toString()}
                    onValueChange={(value) => setTimerSeconds(Number.parseInt(value))}
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 seconds</SelectItem>
                      <SelectItem value="5">5 seconds</SelectItem>
                      <SelectItem value="10">10 seconds</SelectItem>
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
                className="text-lg md:text-xl px-8 md:px-12 py-4 md:py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
              >
                <Camera className="mr-3 h-5 md:h-6 w-5 md:w-6" />
                {countdown > 0 ? `Taking photo in ${countdown}...` : "Capture Photo"}
              </Button>

              {isSessionComplete && (
                <div>
                  <Button
                    onClick={handleSessionComplete}
                    size="lg"
                    className="text-lg md:text-xl px-8 md:px-12 py-4 bg-green-600 hover:bg-green-700 ml-4"
                  >
                    Review Photos ({capturedPhotos.length})
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl">
          <Card className="p-6 md:p-8">
            <div className="text-center mb-6 md:mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Add a Personal Note</h2>
              <p className="text-gray-600">Would you like to add a special message to your polaroid strip?</p>
            </div>

            <div className="space-y-4">
              <Textarea
                placeholder="Write your special message here... (optional)"
                value={sessionNote}
                onChange={(e) => setSessionNote(e.target.value)}
                className="min-h-[120px] resize-none"
                maxLength={200}
              />
              <div className="text-sm text-gray-500 text-right">
                {sessionNote.length}/200 characters
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-6 md:mt-8">
              <Button
                onClick={() => setCurrentStep("preview")}
                variant="outline"
                className="flex-1"
              >
                Skip Note
              </Button>
              <Button
                onClick={handleNoteSubmit}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                Continue to Preview
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (currentStep === "preview") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Your Pixel Booth Collection</h2>
            <p className="text-lg md:text-xl text-gray-600">Beautiful memories, perfectly captured</p>
          </div>

          {/* Polaroid Strip Layout */}
          <div className="flex justify-center mb-8 md:mb-12">
            <div className={cn(
              "bg-white p-4 md:p-8 rounded-lg shadow-2xl",
              selectedLayout === "1x1" && "max-w-sm",
              selectedLayout === "1x2" && "max-w-sm",
              selectedLayout === "1x3" && "max-w-sm", 
              selectedLayout === "2x2" && "max-w-2xl"
            )}>
              <div className={cn(
                "space-y-4",
                selectedLayout === "2x2" && "grid grid-cols-2 gap-4"
              )}>
                {capturedPhotos.map((photo, index) => (
                  <div
                    key={index}
                    className={cn(
                      "bg-white p-3 md:p-6 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105",
                      index % 2 === 0 ? "rotate-1" : "-rotate-1",
                      "hover:rotate-0"
                    )}
                  >
                    {/* Polaroid style frame */}
                    <div className="bg-white">
                      <img
                        src={photo.dataUrl}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-48 md:h-64 object-cover rounded-sm shadow-inner"
                      />
                      <div className="mt-4 md:mt-6 text-center space-y-2">
                        <div className="font-bold text-lg md:text-2xl text-gray-800 tracking-wider">PIXELBOOTH</div>
                        <div className="text-xs md:text-sm text-gray-600 font-mono">
                          {photo.timestamp.toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          •{" "}
                          {photo.timestamp.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Note section */}
              {sessionNote && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border-l-4 border-purple-500">
                  <div className="text-sm text-gray-600 font-medium mb-1">Personal Note:</div>
                  <div className="text-gray-800 italic">"{sessionNote}"</div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 md:gap-4">
            <Button
              onClick={handleRetake}
              variant="outline"
              size="lg"
              className="text-base md:text-lg px-6 md:px-8 py-3 md:py-4 border-2 hover:bg-gray-50 bg-transparent"
            >
              <RotateCcw className="mr-2 h-4 md:h-5 w-4 md:w-5" />
              Retake Photos
            </Button>

            <Button 
              onClick={handlePrint} 
              size="lg" 
              className="text-base md:text-lg px-6 md:px-8 py-3 md:py-4 bg-green-600 hover:bg-green-700"
            >
              <Printer className="mr-2 h-4 md:h-5 w-4 md:w-5" />
              Print Collection
            </Button>

            <Button
              onClick={downloadAllPhotos}
              variant="outline"
              size="lg"
              className="text-base md:text-lg px-6 md:px-8 py-3 md:py-4 border-2 hover:bg-gray-50 bg-transparent"
            >
              <Download className="mr-2 h-4 md:h-5 w-4 md:w-5" />
              Download All
            </Button>

            <Button
              onClick={handleNewSession}
              variant="outline"
              size="lg"
              className="text-base md:text-lg px-6 md:px-8 py-3 md:py-4 border-2 hover:bg-gray-50 bg-transparent"
            >
              <Sparkles className="mr-2 h-4 md:h-5 w-4 md:w-5" />
              New Session
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
