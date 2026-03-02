/* global process */
import { getTTById, searchTT } from "@/api/tt" 
import { searchOrgs } from "@/api/orgs"
import { searchDistributors } from "@/api/distributors"
import { getPriceCategories } from "@/api/prices"
import { getManufacturers } from "@/api/manufacturers"
import { getHighfoamBrands, getPrivateLabelBrands } from "@/api/brands"
import { cn } from "@/lib/utils"
import { useMemo, useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { motion, AnimatePresence } from "framer-motion"
import { GoogleGenAI } from "@google/genai"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

import {
  ArrowLeft,
  MapPin,
  X,
  Camera,
  Plus,
  Mic,
  Save,
  Trash2,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react"

const TT_TYPES = [
  { id: "tt", label: "Торгова точка" },
  { id: "network", label: "Мережа" },
  { id: "national", label: "Нац. мережа" },
  { id: "competitor", label: "Конкурент" },
]

// Заглушки — позже подтянем из БД
const CHART_COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Rose
  "#06b6d4", // Cyan
  "#8b5cf6", // Violet
]

function todayUA() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function clampInt(v, min, max) {
  const n = Number.parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10)
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

function isBlank(v) {
  return !String(v ?? "").trim()
}

function formatPhone(val) {
  if (!val) return ""
  let digits = val.replace(/\D/g, "")
  if (digits.startsWith("38")) digits = digits.slice(2)
  if (digits.startsWith("8")) digits = digits.slice(1)
  
  if (digits.length === 0 && val.includes("+38")) return "+38 "
  if (digits.length === 0) return ""

  digits = digits.slice(0, 10)
  
  let res = "+38 "
  if (digits.length > 0) res += "(" + digits.substring(0, 3)
  if (digits.length >= 4) res += ") " + digits.substring(3, 6)
  if (digits.length >= 7) res += "-" + digits.substring(6, 8)
  if (digits.length >= 9) res += "-" + digits.substring(8, 10)
  
  return res
}

function isEmailValid(email) {
  if (!email) return true // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isPhoneValid(phone) {
  if (!phone) return true // optional
  return phone.length === 19 // +38 (xxx) xxx-xx-xx
}

function pct(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

export function PassportPage() {
  const nav = useNavigate()
  const { profile } = useAuth()
  const MotionDiv = motion.div

  // ===== State =====

  const [orgTT, setOrgTT] = useState({
    orgMode: "select", // select | new
    orgQuery: "",
    orgNameNew: "",

    ttMode: "select", // select | new
    ttQuery: "",
    ttNameNew: "",
    selectedOrgId: null, 
    selectedTTId: null,
  })

  // ===== Contacts: saved + draft =====
const [contactsOpen, setContactsOpen] = useState(false)

// сохранённые контакты (идут в отчёт)
const [contacts, setContacts] = useState({
  contactName: "",
  position: "",
  phone: "",
  email: "",
  ttDescription: "",
  ttTypeId: "",
})

// черновик для модалки
const [contactsDraft, setContactsDraft] = useState({ ...contacts })

  const [commercial, setCommercial] = useState({
    sellsPillows: false,
    viaDistributor: false,
    distributorId: "",
    distributorQuery: "",
    priceCategoryId: "",
  })

  const [priceCategoriesList, setPriceCategoriesList] = useState([])
  const [manufacturersList, setManufacturersList] = useState([])
  const [hfBrands, setHfBrands] = useState([])
  const [pmBrands, setPmBrands] = useState([])

  useEffect(() => {
    async function loadInitialData() {
      const [prices, mans, hf] = await Promise.all([
        getPriceCategories(),
        getManufacturers(),
        getHighfoamBrands()
      ])
      setPriceCategoriesList(prices)
      setManufacturersList(mans)
      setHfBrands(hf)
    }
    loadInitialData()
  }, [])

  useEffect(() => {
    async function loadPM() {
      if (orgTT.selectedOrgId) {
        const pm = await getPrivateLabelBrands(orgTT.selectedOrgId)
        setPmBrands(pm)
      } else {
        setPmBrands([])
      }
    }
    loadPM()
  }, [orgTT.selectedOrgId])

  const [address, setAddress] = useState({
    city: "",
    cityRef: "",
    street: "",
    house: "",
    geo: null, // { lat, lng, resolvedAddress }
    address_text: "",
  })

  const [photos, setPhotos] = useState([]) // { id, file, url }

  const [manufacturers, setManufacturers] = useState({
    activeAddId: "",
    editorOpen: false,
    pp: 0,
    kv: 0,
    selected: [], // { manufacturerId, pp, kv }
  })

  const [modelRange, setModelRange] = useState({
    highfoamCount: 0,
    privateCount: 0,
    selectedHfBrandIds: [],
    selectedPmBrandIds: [],
  })

  const [hfModalOpen, setHfModalOpen] = useState(false)
  const [pmModalOpen, setPmModalOpen] = useState(false)

  const [pricing, setPricing] = useState({
    econom: 0,
    middle: 0,
  })

  const premium = useMemo(() => {
    const e = clampInt(pricing.econom, 0, 100)
    const m = clampInt(pricing.middle, 0, 100)
    return Math.max(0, 100 - e - m)
  }, [pricing.econom, pricing.middle])

  const [note, setNote] = useState({
    finalText: "",
  })

  const [ui, setUI] = useState({
    confirmBackOpen: false,
    confirmGeoOpen: false,
    savedOpen: false,
    photoPreview: null, // url
    geoLoading: false,
    isRecording: false,
    isProcessing: false,
  })

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        await processAudioWithAI(audioBlob)
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setUI(s => ({ ...s, isRecording: true }))
    } catch (err) {
      console.error("Error accessing microphone:", err)
      alert("Не вдалося отримати доступ до мікрофона. Перевірте дозволи.")
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
      setUI(s => ({ ...s, isRecording: false }))
    }
  }

  async function processAudioWithAI(blob) {
    if (blob.size < 1000) {
      // Too small to contain actual speech
      setUI(s => ({ ...s, isProcessing: false }))
      return
    }

    setUI(s => ({ ...s, isProcessing: true }))
    try {
      const reader = new FileReader()
      reader.readAsDataURL(blob)
      reader.onloadend = async () => {
        const base64Data = reader.result.split(",")[1]
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/webm",
                    data: base64Data,
                  },
                },
                {
                  text: `Твоє завдання — зробити чисту транскрипцію цього аудіо українською мовою.

ПРАВИЛА:
1. Якщо на записі тиша, шум або немає чіткої мови — поверни ТІЛЬКИ одне слово: EMPTY.
2. Якщо мова є, просто запиши її текстом, видаливши заїкання та нецензурну лексику.
3. НЕ ДОДАВАЙ жодної інформації від себе. Не вигадуй теми, імена, плани чи підсумки.
4. Якщо ти не впевнений, що саме було сказано — краще поверни EMPTY.
5. Твій результат має бути або транскрипцією почутого, або словом EMPTY. Жодних пояснень.`,
                },
              ],
            },
          ],
        })

        const resultText = response.text?.trim()
        if (resultText && resultText !== "EMPTY") {
          setNote(s => ({ ...s, finalText: resultText }))
        } else if (resultText === "EMPTY") {
          console.log("AI detected no speech in audio")
        }
        
        setUI(s => ({ ...s, isProcessing: false }))
      }
    } catch (err) {
      console.error("AI Processing error:", err)
      alert("Помилка обробки аудіо. Спробуйте ще раз.")
      setUI(s => ({ ...s, isProcessing: false }))
    }
  }

  const visitDate = useMemo(() => todayUA(), [])

  const isHighfoamSelected = useMemo(() => {
    const hf = manufacturersList.find(m => m.label.toLowerCase() === "highfoam")
    if (!hf) return false
    return manufacturers.selected.some((x) => x.manufacturerId === hf.id)
  }, [manufacturers.selected, manufacturersList])

  // ===== readiness (progress) =====
  const readiness = useMemo(() => {
    let score = 0

    // 1. Організація та ТТ (15%)
    const hasOrg =
      orgTT.orgMode === "select"
        ? !isBlank(orgTT.orgQuery)
        : !isBlank(orgTT.orgNameNew)
    const hasTT =
      orgTT.ttMode === "select" ? !isBlank(orgTT.ttQuery) : !isBlank(orgTT.ttNameNew)
    if (hasOrg) score += 7.5
    if (hasTT) score += 7.5

    // 2. Контакти та тип ТТ (15%)
    if (!isBlank(contacts.contactName)) score += 5
    if (!isBlank(contacts.phone)) score += 5
    if (!isBlank(contacts.ttTypeId)) score += 5

    // 3. Адреса ТТ (15%)
    const hasAddrText =
      !isBlank(address.city) && !isBlank(address.street) && !isBlank(address.house)
    if (hasAddrText) score += 10
    if (address.geo) score += 5

    // 4. Фотозвіт (10%)
    if (photos.length > 0) score += 10

    // 5. Виробники та Модельний ряд (25%)
    if (manufacturers.selected.length > 0) score += 25

    // 6. Цінові сегменти (10%)
    if (pricing.econom > 0 || pricing.middle > 0) score += 10

    // 7. Коментар (10%)
    if (!isBlank(note.finalText)) score += 10

    return Math.round(Math.min(100, score))
  }, [orgTT, contacts, address, photos.length, manufacturers.selected.length, pricing, note.finalText])

  const isFormEmpty = useMemo(() => {
    const hasOrg =
      !isBlank(orgTT.orgQuery) ||
      !isBlank(orgTT.orgNameNew) ||
      !isBlank(orgTT.ttQuery) ||
      !isBlank(orgTT.ttNameNew)

    const hasContacts =
      !isBlank(contacts.contactName) ||
      !isBlank(contacts.position) ||
      !isBlank(contacts.phone) ||
      !isBlank(contacts.email) ||
      !isBlank(contacts.ttDescription) ||
      !isBlank(contacts.ttTypeId)

    const hasCommercial =
      commercial.sellsPillows ||
      commercial.viaDistributor ||
      !isBlank(commercial.distributorId) ||
      !isBlank(commercial.priceCategoryId)

    const hasAddress =
      !isBlank(address.city) ||
      !isBlank(address.street) ||
      !isBlank(address.house) ||
      !!address.geo

    const hasPhotos = photos.length > 0
    const hasManu = manufacturers.selected.length > 0
    const hasPricing =
      clampInt(pricing.econom, 0, 100) > 0 || clampInt(pricing.middle, 0, 100) > 0
    const hasNote = !isBlank(note.finalText)

    return !(hasOrg || hasContacts || hasCommercial || hasAddress || hasPhotos || hasManu || hasPricing || hasNote)
  }, [
    orgTT,
    contacts,
    commercial,
    address,
    photos.length,
    manufacturers.selected.length,
    pricing,
    note.finalText,
  ])

  // ===== Handlers =====

    async function handleSelectTT(item) {
    // 1) запоминаем выбор в orgTT
    setOrgTT((s) => ({
      ...s,
      ttQuery: item.name,
      selectedTTId: item.id,
    }))

    // 2) тянем полную карточку ТТ из БД (на случай если search не вернул все поля)
    const tt = await getTTById(item.id)
    if (!tt) return

    // 3) заполняем адрес из БД
    setAddress((a) => ({
      ...a,
      city: tt.city || "",
      street: tt.street || "",
      house: tt.house || "",
      cityRef: "",     // важно: NP ref мы не знаем -> сбрасываем
      geo: a.geo,      // гео не трогаем (по желанию можно сбрасывать)
      address_text: tt.address_text || "", // если хочешь хранить отдельно (см. ниже)
    }))
  }
  
  function goBack() {
    if (isFormEmpty) {
      nav("/app/surveys/start")
      return
    }
    setUI((s) => ({ ...s, confirmBackOpen: true }))
  }

  function discardAndBack() {
    setUI((s) => ({ ...s, confirmBackOpen: false }))
    nav("/app/surveys/start")
  }

  async function requestGeo() {
    if (!navigator.geolocation) {
      alert("Геолокація не підтримується вашим браузером")
      return
    }

    setUI((s) => ({ ...s, geoLoading: true }))

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        
        let resolvedAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        
        try {
          // Спробуємо отримати адресу через Nominatim (OpenStreetMap)
          // Додаємо User-Agent або контактний email згідно з Usage Policy Nominatim
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            {
              headers: {
                'Accept-Language': 'uk-UA, uk, en'
              }
            }
          )
          const data = await res.json()
          if (data && data.address) {
            const addr = data.address
            const parts = []
            
            // Область
            if (addr.state) parts.push(addr.state)
            
            // Район
            if (addr.county) parts.push(addr.county)
            
            // Місто / Селище
            const city = addr.city || addr.town || addr.village || addr.hamlet
            if (city) parts.push(city)
            
            // Вулиця
            const street = addr.road || addr.street
            if (street) parts.push(street)
            
            // Номер будинку
            if (addr.house_number) {
              // Додаємо номер будинку до останнього елемента (вулиці) або окремо
              if (street) {
                parts[parts.length - 1] = `${street}, ${addr.house_number}`
              } else {
                parts.push(addr.house_number)
              }
            }
            
            if (parts.length > 0) {
              resolvedAddress = parts.join(", ")
            } else if (data.display_name) {
              resolvedAddress = data.display_name
            }
          }
        } catch (err) {
          console.error("Reverse geocoding error:", err)
        }

        setAddress((a) => ({
          ...a,
          geo: {
            lat: latitude,
            lng: longitude,
            resolvedAddress,
          },
        }))
        setUI((s) => ({ ...s, geoLoading: false }))
      },
      (error) => {
        console.error("Geolocation error:", error)
        let msg = "Не вдалося визначити місцезнаходження"
        if (error.code === 1) msg = "Доступ до геолокації відхилено"
        else if (error.code === 2) msg = "Місцезнаходження недоступне"
        else if (error.code === 3) msg = "Час очікування вичерпано"
        
        alert(msg)
        setUI((s) => ({ ...s, geoLoading: false }))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  function clearGeo() {
    setAddress((a) => ({ ...a, geo: null }))
  }

  function onPickPhotoFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return

    setPhotos((prev) => {
      const next = [...prev]
      for (const f of files) {
        if (next.length >= 4) break
        const id = crypto.randomUUID?.() ?? String(Date.now() + Math.random())
        const url = URL.createObjectURL(f)
        next.push({ id, file: f, url })
      }
      return next
    })
  }

  function removePhoto(id) {
    setPhotos((prev) => {
      const item = prev.find((p) => p.id === id)
      if (item?.url) URL.revokeObjectURL(item.url)
      return prev.filter((p) => p.id !== id)
    })
  }

  function startAddManufacturer(id) {
    if (!id) return
    setManufacturers((m) => ({ ...m, activeAddId: id, editorOpen: true, pp: 0, kv: 0 }))
  }

  function cancelManufacturerEditor() {
    setManufacturers((m) => ({ ...m, editorOpen: false }))
  }

  function saveManufacturerEditor() {
    setManufacturers((m) => {
      const id = m.activeAddId
      if (!id) return m

      const pp = clampInt(m.pp, 0, 9999999)
      const kv = clampInt(m.kv, 0, 999)
      const exists = m.selected.some((x) => x.manufacturerId === id)

      if (exists) {
        return {
          ...m,
          selected: m.selected.map((x) => (x.manufacturerId === id ? { ...x, pp, kv } : x)),
          editorOpen: false,
        }
      }

      return {
        ...m,
        selected: [...m.selected, { manufacturerId: id, pp, kv }],
        editorOpen: false,
      }
    })
  }

  function editManufacturer(manufacturerId) {
    const item = manufacturers.selected.find((x) => x.manufacturerId === manufacturerId)
    if (!item) return
    setManufacturers((m) => ({
      ...m,
      activeAddId: manufacturerId,
      pp: item.pp,
      kv: item.kv,
      editorOpen: true,
    }))
  }

  function removeManufacturer(manufacturerId) {
    setManufacturers((m) => ({
      ...m,
      selected: m.selected.filter((x) => x.manufacturerId !== manufacturerId),
      activeAddId: m.activeAddId === manufacturerId ? "" : m.activeAddId,
      editorOpen: m.activeAddId === manufacturerId ? false : m.editorOpen,
    }))
  }

  function saveReport() {
    if (!address.geo) {
      setUI((s) => ({ ...s, confirmGeoOpen: true }))
      return
    }
    doSave()
  }

  function saveWithoutGeo() {
    setUI((s) => ({ ...s, confirmGeoOpen: false }))
    doSave()
  }

  function doSave() {
    // Пока заглушка — позже реальное сохранение в Supabase + Drive
    setUI((s) => ({ ...s, savedOpen: true }))
  }

  function continueAfterSave() {
    setUI((s) => ({ ...s, savedOpen: false }))
    nav("/app/surveys/start")
  }

  // ===== Manufacturer analytics (simple demo) =====
  const totalPP = manufacturers.selected.reduce((s, x) => s + clampInt(x.pp, 0, 9999999), 0)
  const totalKV = manufacturers.selected.reduce((s, x) => s + clampInt(x.kv, 0, 999), 0)
  const hasContactsFilled = useMemo(() => {
  return (
    !isBlank(contacts.contactName) ||
    !isBlank(contacts.phone) ||
    !isBlank(contacts.email) ||
    !isBlank(contacts.position) ||
    !isBlank(contacts.ttDescription)
  )
  }, [contacts])
  const contactsSummary = useMemo(() => {
  const parts = []

  if (contacts.contactName) parts.push(contacts.contactName)
  if (contacts.phone) parts.push(contacts.phone)

  const typeLabel = TT_TYPES.find(t => t.id === contacts.ttTypeId)?.label
  if (typeLabel) parts.push(typeLabel)

  return parts.join(" · ")
}, [contacts])

  // ===== UI =====
  return (
    <div className="min-h-screen px-4 py-4 flex justify-center glow">
      <div className="w-full max-w-[640px] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              aria-label="Назад"
              className="rounded-full"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span>{visitDate}</span>
          </div>
          <span>{profile?.full_name ?? "—"}</span>
        </div>

        {/* Title + progress */}
        <MotionDiv 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-4"
        >
          <div className="text-xl font-semibold leading-tight">Звіт ТТ</div>
          <div className="text-sm text-muted-foreground">Нова торгова точка</div>

          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Готовність звіту</span>
              <span className={cn(readiness === 100 && "text-primary font-bold animate-pulse-subtle")}>
                {readiness}%
              </span>
            </div>
            <div className="relative pt-2 pb-4">
              <div className="relative h-3 w-full rounded-full bg-white/10 overflow-hidden border border-white/5 shadow-inner">
                <motion.div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-primary to-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.6)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${readiness}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              {readiness > 0 && (
                <motion.div 
                  className="absolute top-2 left-0 h-3 bg-primary/40 blur-md -z-10"
                  initial={{ width: 0 }}
                  animate={{ width: `${readiness}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              )}
              {/* Animated light streak */}
              {readiness > 0 && readiness < 100 && (
                <motion.div
                  className="absolute top-2 h-3 w-20 bg-white/20 blur-sm -z-5"
                  animate={{ 
                    left: ["0%", "100%"],
                    opacity: [0, 1, 0]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity, 
                    ease: "linear" 
                  }}
                  style={{ maxWidth: `${readiness}%` }}
                />
              )}
            </div>
          </div>
        </MotionDiv>

        {/* Організація та ТТ */}
        <Section title="Організація та ТТ" zIndex={50}>
          <div className="space-y-4">
            {/* Організація: label + switch в одной строке */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    {orgTT.orgMode === "new" ? "Нова організація" : "Пошук організації"}
                  </div>

                  <Switch
                    checked={orgTT.orgMode === "new"}
                    className="switch-highlight"
                    onCheckedChange={(v) => {
                      setOrgTT((s) => ({
                        ...s,
                        orgMode: v ? "new" : "select",
                        // чистим противоположное поле чтобы не было мусора
                        orgQuery: v ? "" : s.orgQuery,
                        orgNameNew: v ? s.orgNameNew : "",
                        selectedOrgId: v ? s.selectedOrgId : null,
                        selectedTTId: v ? s.selectedTTId : null,
                        ttQuery: v ? s.ttQuery : "",
                      }))
                      setAddress({
                        city: "",
                        cityRef: "",
                        street: "",
                        house: "",
                        geo: null,
                        address_text: "",
                      })
                    }}
                    aria-label="Нова організація"
                  />
                </div>

                {orgTT.orgMode === "select" ? (
                <AddressAutocomplete
                  label=""
                  value={orgTT.orgQuery}
                  placeholder="Почніть вводити назву…"
                  minChars={0}
                  onChange={(v) => {
                    setOrgTT((s) => ({
                      ...s,
                      orgQuery: v,
                      selectedOrgId: v ? s.selectedOrgId : null,
                      selectedTTId: v ? s.selectedTTId : null,
                      ttQuery: v ? s.ttQuery : "",
                    }))
                    if (!v) {
                      setAddress({
                        city: "",
                        cityRef: "",
                        street: "",
                        house: "",
                        geo: null,
                        address_text: "",
                      })
                    }
                  }}
                  onSelect={(item) => {
                    setOrgTT((s) => ({
                      ...s,
                      orgQuery: item.name,
                      selectedOrgId: item.id, // 👈 запомнили org id
                      selectedTTId: null,     // 👈 сбросили ТТ
                      ttQuery: "",            // 👈 сбросили ввод ТТ
                    }))
                    setAddress({
                      city: "",
                      cityRef: "",
                      street: "",
                      house: "",
                      geo: null,
                      address_text: "",
                    })
                  }}
                  fetchSuggestions={searchOrgs}
                />
              ) : (
                <Input
                  value={orgTT.orgNameNew}
                  onChange={(e) => {
                    const v = e.target.value
                    setOrgTT((s) => ({ 
                      ...s, 
                      orgNameNew: v,
                      ttNameNew: v ? s.ttNameNew : "",
                      ttQuery: v ? s.ttQuery : "",
                    }))
                    if (!v) {
                      setAddress({
                        city: "",
                        cityRef: "",
                        street: "",
                        house: "",
                        geo: null,
                        address_text: "",
                      })
                    }
                  }}
                  placeholder="Введіть назву організації…"
                  className="rounded-2xl bg-white/[0.03] border-white/10 focus-visible:ring-primary/40"
                />
              )}
              </div>

              

            {/* ТТ: label + switch в одной строке */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    {orgTT.ttMode === "new" ? "Нова ТТ" : "Пошук ТТ"}
                  </div>

                  <Switch
                    checked={orgTT.ttMode === "new"}
                    className="switch-highlight"
                    onCheckedChange={(v) => {
                      setOrgTT((s) => ({
                        ...s,
                        ttMode: v ? "new" : "select",
                        ttQuery: v ? "" : s.ttQuery,
                        ttNameNew: v ? s.ttNameNew : "",
                        selectedTTId: v ? null : s.selectedTTId,
                      }))
                      setAddress({
                        city: "",
                        cityRef: "",
                        street: "",
                        house: "",
                        geo: null,
                        address_text: "",
                      })
                    }}
                    aria-label="Нова торгова точка"
                  />
                </div>

                {orgTT.ttMode === "select" ? (
                <AddressAutocomplete
                  label=""
                  value={orgTT.ttQuery}
                  placeholder={orgTT.selectedOrgId ? "Почніть вводити назву ТТ…" : "Спочатку оберіть організацію"}
                  disabled={!orgTT.selectedOrgId}
                  minChars={0}
                  onChange={(v) => {
                    setOrgTT((s) => ({
                      ...s,
                      ttQuery: v,
                      selectedTTId: v ? s.selectedTTId : null,
                    }))
                    if (!v) {
                      setAddress({
                        city: "",
                        cityRef: "",
                        street: "",
                        house: "",
                        geo: null,
                        address_text: "",
                      })
                    }
                  }}
                  onSelect={handleSelectTT}
                  fetchSuggestions={(q) => searchTT(orgTT.selectedOrgId, q)}
                />
              ) : (
                <Input
                  value={orgTT.ttNameNew}
                  onChange={(e) => {
                    const v = e.target.value
                    setOrgTT((s) => ({ ...s, ttNameNew: v }))
                    if (!v) {
                      setAddress({
                        city: "",
                        cityRef: "",
                        street: "",
                        house: "",
                        geo: null,
                        address_text: "",
                      })
                    }
                  }}
                  placeholder="Введіть назву ТТ…"
                  className="rounded-2xl bg-white/[0.03] border-white/10 focus-visible:ring-primary/40"
                />
              )}
              </div>

            <Button
              variant="outline"
              onClick={() => setContactsOpen(true)}
              className={cn(
                "w-full h-12 rounded-2xl px-4 transition relative overflow-hidden",
                "bg-white/[0.03] hover:bg-white/[0.06] border-white/10",

                // glow red if empty, glow green if filled
                hasContactsFilled
                  ? "shadow-[0_0_0_1px_rgba(34,197,94,0.35),0_0_18px_rgba(34,197,94,0.18)]"
                  : "shadow-[0_0_0_1px_rgba(239,68,68,0.35),0_0_18px_rgba(239,68,68,0.16)]"
              )}
            >
              <div className="w-full flex items-center justify-center gap-3 min-w-0">
                <Info
                  className={cn(
                    "h-4 w-4 shrink-0",
                    hasContactsFilled ? "text-emerald-400" : "text-red-400"
                  )}
                />

                <div className="min-w-0 text-center leading-tight">
                  <div className="text-sm font-medium">
                    Контакти та тип ТТ
                  </div>

                  <div className={cn(
                    "text-[11px] truncate",
                    hasContactsFilled ? "text-white/70" : "text-red-200/70"
                  )}>
                    {hasContactsFilled ? (contactsSummary || "—") : "Не заповнено"}
                  </div>
                </div>
              </div>
            </Button>

            <div className="space-y-3 pt-1">
              <ToggleRow
                label="Продаж подушок"
                checked={commercial.sellsPillows}
                className="switch-highlight"
                onCheckedChange={(v) => setCommercial((s) => ({ ...s, sellsPillows: v }))}
              />

              <ToggleRow
                label="Через дистриб’ютора"
                checked={commercial.viaDistributor}
                className="switch-highlight"
                onCheckedChange={(v) =>
                  setCommercial((s) => ({
                    ...s,
                    viaDistributor: v,
                    distributorId: v ? s.distributorId : "",
                  }))
                }
              />

              {commercial.viaDistributor && (
                <AddressAutocomplete
                  label=""
                  value={commercial.distributorQuery}
                  placeholder="Оберіть дистриб’ютора…"
                  minChars={0}
                  onChange={(v) =>
                    setCommercial((s) => ({
                      ...s,
                      distributorQuery: v,
                    }))
                  }
                  onSelect={(item) => {
                    setCommercial((s) => ({
                      ...s,
                      distributorQuery: item.name,
                      distributorId: item.id,
                    }))
                  }}
                  fetchSuggestions={searchDistributors}
                />
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground shrink-0">Прайс</div>
                <div className="flex-1 max-w-[260px]">
                  <LabeledSelect
                    label=""
                    value={commercial.priceCategoryId}
                    onValueChange={(v) => setCommercial((s) => ({ ...s, priceCategoryId: v }))}
                    placeholder="Оберіть…"
                    items={priceCategoriesList}
                  />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Адреса */}
        <Section title="Адреса ТТ" zIndex={40}>
          <div className="space-y-4">
            <div className="grid gap-3">
              <AddressAutocomplete
                label="Місто"
                value={address.city}
                placeholder="Почніть вводити місто…"
                onChange={(v) => {
                  if (!v) {
                    setAddress((s) => ({ ...s, city: "", cityRef: "", street: "" }))
                  } else {
                    setAddress((s) => ({ ...s, city: v }))
                  }
                }}
                onSelect={(item) => {
                  const getShortType = (full) => {
                    if (!full) return ""
                    const f = full.toLowerCase()
                    if (f.includes("місто")) return "м."
                    if (f.includes("селище міського типу")) return "смт"
                    if (f.includes("село")) return "с."
                    if (f.includes("селище")) return "сел."
                    return full
                  }
                  const type = getShortType(item.SettlementTypeDescription)
                  const area = item.AreaDescription ? `${item.AreaDescription} обл.` : ""
                  const fullCity = `${type} ${item.Description}${area ? ", " + area : ""}`.trim()
                  
                  setAddress((s) => ({
                    ...s,
                    city: fullCity,
                    cityRef: item.Ref,
                    street: "", // скидаємо вулицю при зміні міста
                  }))
                }}
                fetchSuggestions={async (search) => {
                  const res = await fetch("/api/np/cities", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ search }),
                  })
                  const data = await res.json()
                  return data.data || []
                }}
              />

              <div className="grid grid-cols-[1fr_80px] gap-3">
                <AddressAutocomplete
                  label="Вулиця"
                  value={address.street}
                  placeholder={address.cityRef ? "Вулиця…" : "Оберіть місто"}
                  disabled={!address.cityRef}
                  onChange={(v) => setAddress((s) => ({ ...s, street: v }))}
                  onSelect={(item) => {
                    const type = item.StreetsType || ""
                    const fullStreet = `${type} ${item.Description}`.trim()
                    setAddress((s) => ({
                      ...s,
                      street: fullStreet,
                    }))
                  }}
                  fetchSuggestions={async (search) => {
                    if (!address.cityRef) return []
                    const res = await fetch("/api/np/streets", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ cityRef: address.cityRef, search }),
                    })
                    const data = await res.json()
                    return data.data || []
                  }}
                />

                <LabeledInput
                  label="Будинок"
                  value={address.house}
                  onChange={(v) => setAddress((s) => ({ ...s, house: v }))}
                  placeholder="№"
                />
              </div>
            </div>

            <Button
              variant="secondary"
              className={cn(
                "w-full h-12 justify-center gap-2 rounded-2xl transition-all duration-300 border",
                "bg-white/[0.04] border-white/10",
                address.geo
                  ? "shadow-[0_0_0_1px_rgba(34,197,94,0.35),0_0_18px_rgba(34,197,94,0.18)] opacity-80 cursor-default"
                  : "shadow-[0_0_0_1px_rgba(239,68,68,0.35),0_0_18px_rgba(239,68,68,0.16)] hover:bg-white/[0.07]"
              )}
              onClick={requestGeo}
              disabled={ui.geoLoading || !!address.geo}
            >
              {ui.geoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <MapPin className={cn("h-4 w-4", address.geo ? "text-emerald-400" : "text-red-400")} />
              )}
              <span className={cn(
                "font-medium",
                address.geo ? "text-emerald-400/90" : "text-red-200/90"
              )}>
                {ui.geoLoading 
                  ? "Визначаємо..." 
                  : address.geo 
                    ? "Геолокацію визначено" 
                    : "Визначити геолокацію"}
              </span>
            </Button>

            {address.geo && (
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="text-sm text-muted-foreground">{address.geo.resolvedAddress}</div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearGeo}
                  aria-label="Видалити гео"
                  className="rounded-xl"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </Section>

        {/* Фото */}
        <Section title="Фотозвіт" zIndex={30}>
          <div className="space-y-3">
            

            <div className="flex flex-wrap gap-3">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                >
                  <button
                    type="button"
                    className="h-full w-full"
                    onClick={() => setUI((s) => ({ ...s, photoPreview: p.url }))}
                    title="Переглянути"
                  >
                    <img src={p.url} alt="Фото" className="h-full w-full object-cover" />
                  </button>

                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-1 top-1 h-7 w-7 rounded-xl bg-black/40 hover:bg-black/55"
                    onClick={() => removePhoto(p.id)}
                    aria-label="Видалити фото"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              {photos.length < 4 && (
                <label 
                  htmlFor="photo-upload"
                  className="h-20 w-20 cursor-pointer rounded-2xl border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.05] flex flex-col items-center justify-center gap-1"
                >
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Додати</span>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => onPickPhotoFiles(e.target.files)}
                  />
                </label>
              )}
            </div>
          </div>
        </Section>

        {/* Виробники */}
        <Section title="Виробники на виставці" zIndex={20}>
          <div className="space-y-3">
            <LabeledSelect
              label=""
              value=""
              onValueChange={(v) => {
                if (v) startAddManufacturer(v)
              }}
              placeholder="+ Додати виробника"
              items={manufacturersList.map((m) => ({
                ...m,
                disabled: manufacturers.selected.some((x) => x.manufacturerId === m.id),
              }))}
            />

            {manufacturers.editorOpen && (
              <div className="glass-soft rounded-3xl p-4 space-y-4 border border-white/10 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Показники</div>
                  <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[13px] font-bold py-1 px-3 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                    {manufacturersList.find((x) => x.id === manufacturers.activeAddId)?.label ??
                      manufacturers.activeAddId}
                  </Badge>
                </div>

                <NumberSlider
                  label="Потенційні продажі (шт/міс)"
                  max={9999999}
                  value={manufacturers.pp}
                  onChange={(v) => setManufacturers((s) => ({ ...s, pp: v }))}
                />

                <NumberSlider
                  label="К-ть місць (шт)"
                  max={999}
                  value={manufacturers.kv}
                  onChange={(v) => setManufacturers((s) => ({ ...s, kv: v }))}
                />

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button
                    variant="secondary"
                    className="rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.15)] transition-all duration-300"
                    onClick={cancelManufacturerEditor}
                  >
                    Скасувати
                  </Button>
                  <Button 
                    className="rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-white border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)] transition-all duration-300" 
                    onClick={saveManufacturerEditor}
                  >
                    Зберегти
                  </Button>
                </div>
              </div>
            )}

            {manufacturers.selected.length > 0 && (
              <>
                <div className="flex flex-wrap gap-2 pt-1">
                  {manufacturers.selected.map((it) => {
                    const label =
                      manufacturersList.find((m) => m.id === it.manufacturerId)?.label ?? it.manufacturerId
                    return (
                      <button
                        key={it.manufacturerId}
                        type="button"
                        onClick={() => editManufacturer(it.manufacturerId)}
                        className="group inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-sm hover:bg-emerald-500/10 transition-colors shadow-[0_0_10px_rgba(16,185,129,0.05)]"
                        title="Натисніть, щоб змінити"
                      >
                        <span className="font-medium text-emerald-50/90">{label}</span>
                        <span className="text-xs text-emerald-400/70">
                          {it.pp}/{it.kv}
                        </span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation()
                            removeManufacturer(it.manufacturerId)
                          }}
                          className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-400 opacity-80 hover:opacity-100 hover:bg-red-500/20 transition-all"
                          role="button"
                          aria-label="Видалити"
                        >
                          <X className="h-3 w-3" />
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Analytics like screenshot: two bars + legend */}
                <div className="glass-soft rounded-3xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Частка продажів
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden flex">
                        {manufacturers.selected.map((it, idx) => (
                          <div
                            key={it.manufacturerId}
                            className="h-full transition-all duration-500"
                            style={{
                              width: `${pct(it.pp, totalPP)}%`,
                              backgroundColor: CHART_COLORS[idx % CHART_COLORS.length]
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Частка місць
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden flex">
                        {manufacturers.selected.map((it, idx) => (
                          <div
                            key={it.manufacturerId}
                            className="h-full transition-all duration-500"
                            style={{
                              width: `${pct(it.kv, totalKV)}%`,
                              backgroundColor: CHART_COLORS[idx % CHART_COLORS.length]
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    {manufacturers.selected.map((it, idx) => {
                      const label =
                        manufacturersList.find((m) => m.id === it.manufacturerId)?.label ?? it.manufacturerId
                      const ppP = pct(clampInt(it.pp, 0, 9999999), totalPP)
                      const kvP = pct(clampInt(it.kv, 0, 999), totalKV)
                      const color = CHART_COLORS[idx % CHART_COLORS.length]
                      
                      return (
                        <div key={it.manufacturerId} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span 
                              className="h-2 w-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.2)]" 
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-muted-foreground">{label}</span>
                          </div>
                          <span className="text-muted-foreground font-medium">{ppP}% / {kvP}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Модельний ряд */}
        {isHighfoamSelected && (
          <Section title="Модельний ряд" zIndex={10}>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="justify-between h-14 rounded-2xl border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-300"
                onClick={() => setHfModalOpen(true)}
              >
                <div className="flex flex-col items-start">
                  <span className="font-bold text-[13px] text-white/90">Highfoam</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Бренди</span>
                </div>
                <Badge className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold">
                  {modelRange.selectedHfBrandIds.length}
                </Badge>
              </Button>

              <Button
                variant="outline"
                disabled={pmBrands.length === 0}
                className={cn(
                  "justify-between h-14 rounded-2xl border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-300",
                  pmBrands.length === 0 && "opacity-40 grayscale"
                )}
                onClick={() => setPmModalOpen(true)}
              >
                <div className="flex flex-col items-start">
                  <span className="font-bold text-[13px] text-white/90">Private Label</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Бренди</span>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                  {modelRange.selectedPmBrandIds.length}
                </Badge>
              </Button>
            </div>
          </Section>
        )}

        {/* Цінові сегменти */}
        <Section title="Цінові сегменти (%)" zIndex={10}>
          <div className="space-y-4">
            <NumberSlider
              label="Економ"
              max={100}
              value={pricing.econom}
              onChange={(v) => {
                const val = clampInt(v, 0, 100)
                setPricing((s) => {
                  const newMiddle = (val + s.middle > 100) ? (100 - val) : s.middle
                  return { ...s, econom: val, middle: newMiddle }
                })
              }}
            />

            <NumberSlider
              label="Середній"
              max={100}
              value={pricing.middle}
              onChange={(v) => {
                const val = clampInt(v, 0, 100)
                setPricing((s) => {
                  const newEconom = (val + s.econom > 100) ? (100 - val) : s.econom
                  return { ...s, middle: val, econom: newEconom }
                })
              }}
            />

            <NumberSlider
              label="Преміум"
              max={100}
              value={premium}
              disabled
              onChange={() => {}}
            />
          </div>
        </Section>

        {/* Примітка */}
        <Section 
          title="Коментар"
          rightElement={
            <Button
              variant="ghost"
              className={cn(
                "h-9 px-3 rounded-xl transition-all duration-500 flex items-center gap-1.5",
                ui.isRecording 
                  ? "bg-red-500/20 text-red-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)] border border-red-500/30" 
                  : "bg-white/[0.05] hover:bg-white/[0.1] text-primary shadow-[0_0_10px_rgba(99,102,241,0.2)] border border-primary/20"
              )}
              onClick={ui.isRecording ? stopRecording : startRecording}
              disabled={ui.isProcessing}
            >
              {ui.isRecording ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  <span className="text-[10px] font-bold">REC</span>
                </>
              ) : (
                <>
                  <Mic className={cn("h-4 w-4", ui.isProcessing && "animate-spin")} />
                  <span className="text-[10px] font-black tracking-tighter">AI</span>
                </>
              )}
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="relative">
              <Textarea
                value={note.finalText}
                onChange={(e) => setNote((s) => ({ ...s, finalText: e.target.value }))}
                placeholder="Введіть текст або диктуйте голосом…"
                className="min-h-[140px] rounded-3xl bg-white/[0.03] border-white/10 focus-visible:ring-primary/40"
              />
              {ui.isProcessing && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] rounded-3xl flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-xs font-medium text-white/80">AI обробляє голос...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* Save */}
        <div className="pb-8">
          <Button
            className="w-full h-12 text-base font-semibold gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all duration-300"
            onClick={saveReport}
          >
            <Save className="h-4 w-4" />
            Зберегти звіт
          </Button>
        </div>

        {/* ===== Dialogs ===== */}

        {/* Back confirm */}
        <Dialog open={ui.confirmBackOpen} onOpenChange={(open) => setUI((s) => ({ ...s, confirmBackOpen: open }))}>
          <DialogContent className="glass rounded-3xl border-white/10">
            <DialogHeader>
              <DialogTitle>Є незбережені зміни</DialogTitle>
              <DialogDescription>Зберегти звіт перед виходом?</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="secondary"
                className="rounded-2xl bg-white/[0.04] hover:bg-white/[0.07]"
                onClick={() => setUI((s) => ({ ...s, confirmBackOpen: false }))}
              >
                Скасувати
              </Button>
              <Button
                variant="destructive"
                className="rounded-2xl gap-2"
                onClick={discardAndBack}
              >
                <Trash2 className="h-4 w-4" />
                Вийти без збереження
              </Button>
              <Button
                className="rounded-2xl"
                onClick={() => {
                  setUI((s) => ({ ...s, confirmBackOpen: false }))
                  saveReport()
                }}
              >
                Зберегти
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Geo confirm */}
        <Dialog open={ui.confirmGeoOpen} onOpenChange={(open) => setUI((s) => ({ ...s, confirmGeoOpen: open }))}>
          <DialogContent className="glass rounded-3xl border-white/10">
            <DialogHeader>
              <DialogTitle>Геолокація не визначена</DialogTitle>
              <DialogDescription>Зберегти звіт без геолокації?</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="secondary"
                className="rounded-2xl bg-white/[0.04] hover:bg-white/[0.07]"
                onClick={() => setUI((s) => ({ ...s, confirmGeoOpen: false }))}
              >
                Скасувати
              </Button>
              <Button className="rounded-2xl" onClick={saveWithoutGeo}>
                Зберегти без геолокації
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Saved */}
        <Dialog open={ui.savedOpen} onOpenChange={(open) => setUI((s) => ({ ...s, savedOpen: open }))}>
          <DialogContent className="glass rounded-3xl border-white/10">
            <DialogHeader>
              <DialogTitle>Звіт збережено</DialogTitle>
              <DialogDescription>Дані успішно синхронізовано (поки заглушка).</DialogDescription>
            </DialogHeader>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ТТ</span>
                <span className="font-medium">
                  {orgTT.ttMode === "new" ? orgTT.ttNameNew || "—" : orgTT.ttQuery || "—"}
                </span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-muted-foreground">Виробники</span>
                <span className="font-medium">{manufacturers.selected.length}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-muted-foreground">Фото</span>
                <span className="font-medium">{photos.length}</span>
              </div>
            </div>

            <DialogFooter>
              <Button className="w-full rounded-2xl" onClick={continueAfterSave}>
                Продовжити
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Contacts modal — draft + cancel/confirm */}
        <Dialog open={contactsOpen} onOpenChange={setContactsOpen}>
          <DialogContent className="p-0 border-none bg-transparent shadow-none sm:max-w-[520px]">
            <div className="glass rounded-[28px] border border-white/10 overflow-hidden">
              <DialogHeader className="px-5 pt-5 pb-3">
                <DialogTitle className="text-sm font-semibold tracking-wide text-white/90 uppercase">
                  Контактна інформація
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Введіть контактні дані представника торгової точки
                </DialogDescription>
              </DialogHeader>

              {/* Body */}
              <div className="px-5 pb-5 space-y-3">
                <Input
                  value={contactsDraft.contactName}
                  onChange={(e) => setContactsDraft((s) => ({ ...s, contactName: e.target.value }))}
                  placeholder="Контактна особа (ПІБ)"
                  className="h-12 rounded-2xl bg-white/[0.05] border-white/10 placeholder:text-white/40 focus-visible:ring-primary/40"
                />

                <Input
                  value={contactsDraft.position}
                  onChange={(e) => setContactsDraft((s) => ({ ...s, position: e.target.value }))}
                  placeholder="Посада"
                  className="h-12 rounded-2xl bg-white/[0.05] border-white/10 placeholder:text-white/40 focus-visible:ring-primary/40"
                />

                <Input
                  value={contactsDraft.phone}
                  onChange={(e) => {
                    const formatted = formatPhone(e.target.value)
                    setContactsDraft((s) => ({ ...s, phone: formatted }))
                  }}
                  onFocus={() => {
                    if (!contactsDraft.phone) {
                      setContactsDraft((s) => ({ ...s, phone: "+38 " }))
                    }
                  }}
                  onBlur={() => {
                    if (contactsDraft.phone === "+38 ") {
                      setContactsDraft((s) => ({ ...s, phone: "" }))
                    }
                  }}
                  placeholder="Телефон (+38...)"
                  className={cn(
                    "h-12 rounded-2xl bg-white/[0.05] border-white/10 placeholder:text-white/40 focus-visible:ring-primary/40 transition-colors",
                    contactsDraft.phone && !isPhoneValid(contactsDraft.phone) && "border-red-500/50 focus-visible:ring-red-500/40 focus-visible:border-red-500/50 text-red-200"
                  )}
                />

                <Input
                  value={contactsDraft.email}
                  onChange={(e) => setContactsDraft((s) => ({ ...s, email: e.target.value }))}
                  placeholder="Email"
                  className={cn(
                    "h-12 rounded-2xl bg-white/[0.05] border-white/10 placeholder:text-white/40 focus-visible:ring-primary/40 transition-colors",
                    contactsDraft.email && !isEmailValid(contactsDraft.email) && "border-red-500/50 focus-visible:ring-red-500/40 focus-visible:border-red-500/50 text-red-200"
                  )}
                />

                <Textarea
                  value={contactsDraft.ttDescription}
                  onChange={(e) => setContactsDraft((s) => ({ ...s, ttDescription: e.target.value }))}
                  placeholder="Додаткові нотатки..."
                  className="min-h-[110px] rounded-2xl bg-white/[0.05] border-white/10 placeholder:text-white/40 focus-visible:ring-primary/40"
                />

                {/* Тип торгової точки */}
                <div className="pt-3">
                  <div className="text-[11px] uppercase tracking-wide text-white/55 mb-2">
                    Тип торгової точки
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {TT_TYPES.map((t) => {
                      const active = contactsDraft.ttTypeId === t.id

                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setContactsDraft((s) => ({ ...s, ttTypeId: t.id }))}
                          className={cn(
                            "relative h-11 rounded-2xl border text-sm transition overflow-hidden",
                            active
                              ? "border-primary/50 text-white shadow-[0_0_0_1px_rgba(99,102,241,0.3),0_10px_30px_rgba(99,102,241,0.25)]"
                              : "border-white/10 bg-white/[0.05] text-white/75 hover:bg-white/[0.08]"
                          )}
                        >
                          {active && (
                            <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />
                          )}

                          <span className="relative">{t.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Buttons */}
                <div className="pt-5 space-y-3">
                  {/* Save */}
                  <Button
                    disabled={
                      (contactsDraft.email && !isEmailValid(contactsDraft.email)) ||
                      (contactsDraft.phone && !isPhoneValid(contactsDraft.phone))
                    }
                    onClick={() => {
                      setContacts({ ...contactsDraft })
                      setContactsOpen(false)
                    }}
                    className="w-full h-11 rounded-2xl text-base font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Зберегти
                  </Button>

                  {/* Cancel */}
                  <Button
                    variant="secondary"
                    className="w-full h-11 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)] transition-all duration-300"
                    onClick={() => {
                      setContactsDraft({ ...contacts })
                      setContactsOpen(false)
                    }}
                  >
                    Скасувати
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Photo preview */}
        <Dialog
          open={!!ui.photoPreview}
          onOpenChange={(open) => setUI((s) => ({ ...s, photoPreview: open ? s.photoPreview : null }))}
        >
          <DialogContent className="glass rounded-3xl border-white/10 max-w-[90vw] sm:max-w-[640px] p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>Перегляд фото</DialogTitle>
              <DialogDescription>Збільшене зображення вибраного фото</DialogDescription>
            </DialogHeader>
            {ui.photoPreview && (
              <div className="relative">
                <img src={ui.photoPreview} alt="Preview" className="w-full h-auto" />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-3 top-3 rounded-xl bg-black/40 hover:bg-black/55"
                  onClick={() => setUI((s) => ({ ...s, photoPreview: null }))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      <BrandSelectionModal
        key={`hf-${hfModalOpen}`}
        open={hfModalOpen}
        onOpenChange={setHfModalOpen}
        title="Моделі Highfoam"
        brands={hfBrands}
        selectedIds={modelRange.selectedHfBrandIds}
        onConfirm={(newList) => {
          setModelRange(s => ({ 
            ...s, 
            selectedHfBrandIds: newList, 
            highfoamCount: newList.length 
          }))
        }}
      />

      <BrandSelectionModal
        key={`pm-${pmModalOpen}`}
        open={pmModalOpen}
        onOpenChange={setPmModalOpen}
        title="Private Label"
        brands={pmBrands}
        selectedIds={modelRange.selectedPmBrandIds}
        onConfirm={(newList) => {
          setModelRange(s => ({ 
            ...s, 
            selectedPmBrandIds: newList, 
            privateCount: newList.length 
          }))
        }}
      />
    </div>
  )
}

/* ====== Small UI helpers ====== */

function BrandSelectionModal({ open, onOpenChange, title, brands, selectedIds, onConfirm }) {
  const [localSelected, setLocalSelected] = useState([...selectedIds])

  const toggleBrand = (id) => {
    setLocalSelected(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 border-none bg-transparent shadow-none sm:max-w-[420px]">
        <div className="glass rounded-[28px] border border-white/10 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-sm font-semibold tracking-wide text-white/90 uppercase">
              {title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="px-6 py-4">
            <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
              {brands.map((brand) => {
                const active = localSelected.includes(brand.id)
                return (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => toggleBrand(brand.id)}
                    className={cn(
                      "relative h-11 rounded-2xl border text-[13px] font-bold transition overflow-hidden",
                      active
                        ? "border-primary/50 text-white shadow-[0_0_0_1px_rgba(99,102,241,0.3),0_10px_30px_rgba(99,102,241,0.25)]"
                        : "border-white/10 bg-white/[0.05] text-white/75 hover:bg-white/[0.08]"
                    )}
                  >
                    {active && (
                      <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />
                    )}
                    <span className="relative">{brand.name}</span>
                  </button>
                )
              })}
            </div>

            <div className="pt-6 space-y-3">
              <Button 
                className="w-full h-11 rounded-2xl text-base font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all duration-300"
                onClick={() => {
                  onConfirm(localSelected)
                  onOpenChange(false)
                }}
              >
                Зберегти
              </Button>

              <Button
                variant="secondary"
                className="w-full h-11 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)] transition-all duration-300"
                onClick={() => onOpenChange(false)}
              >
                Скасувати
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, children, rightElement, zIndex }) {
  const MotionDiv = motion.div;
  return (
    <MotionDiv
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ zIndex, position: zIndex ? "relative" : undefined }}
    >
      <Card className="glass rounded-3xl">
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold tracking-tight text-white/90 flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-primary" />
              {title}
            </div>
            {rightElement}
          </div>
          {children}
        </CardContent>
      </Card>
    </MotionDiv>
  )
}

function LabeledInput({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      {label ? <Label className="text-xs text-muted-foreground ml-1">{label}</Label> : null}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-2xl bg-white/[0.03] border-white/10 focus-visible:ring-primary/40 focus-visible:border-primary/50 transition-all duration-300"
      />
    </div>
  )
}

function LabeledSelect({ label, value, onValueChange, placeholder, items }) {
  return (
    <div className="space-y-1.5">
      {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : null}

      <Select value={value || ""} onValueChange={onValueChange}>
        <SelectTrigger className="rounded-2xl bg-white/[0.03] border-white/10 focus:ring-primary/40">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-[#0b1020] border-white/10">
          {items.map((it) => (
            <SelectItem key={it.id} value={it.id} disabled={!!it.disabled}>
              {it.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ToggleRow({ label, checked, onCheckedChange, className }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="text-sm text-muted-foreground">{label}</div>
      <Switch 
        checked={checked} 
        onCheckedChange={onCheckedChange} 
        className={cn("switch-highlight", className)}
      />
    </div>
  )
}

function AddressAutocomplete({ label, value, onSelect, onChange, fetchSuggestions, placeholder, disabled, minChars = 2 }) {
  const [search, setSearch] = useState(value)
  const [suggestions, setSuggestions] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const getShortType = (full) => {
    if (!full) return ""
    const f = full.toLowerCase()
    if (f.includes("місто")) return "м."
    if (f.includes("селище міського типу")) return "смт"
    if (f.includes("село")) return "с."
    if (f.includes("селище")) return "сел."
    return full
  }

  // Синхронізація локального пошуку з зовнішнім значенням (наприклад, при очищенні)
  useEffect(() => {
    setSearch(value)
  }, [value])

  useEffect(() => {
    if (!isOpen) {
      setSuggestions([])
      return
    }

    const currentSearch = search || ""
    if (currentSearch.length < minChars) {
      setSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await fetchSuggestions(currentSearch)
        setSuggestions(results)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [search, isOpen, minChars])

  return (
    <div className="space-y-1.5 relative">
      {label ? <Label className="text-xs text-muted-foreground ml-1">{label}</Label> : null}
      <div className="relative">
        <Input
          value={search}
          disabled={disabled}
          onChange={(e) => {
            const val = e.target.value
            setSearch(val)
            setIsOpen(true)
            if (onChange) onChange(val)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="rounded-2xl bg-white/[0.03] border-white/10 focus-visible:ring-primary/40 focus-visible:border-primary/50 transition-all duration-300 pr-10"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 right-0 top-full mt-2 z-50 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/20 overflow-hidden shadow-2xl max-h-[200px] overflow-y-auto"
            >
              {suggestions.map((item, idx) => (
                <button
                  key={item.id || item.Ref || idx}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                  onClick={() => {
                    // Формуємо повну назву для відображення в інпуті після кліку
                    let fullName = ""
                    if (item.name) {
                      fullName = item.name
                    } else {
                      const type = item.SettlementTypeDescription ? getShortType(item.SettlementTypeDescription) : (item.StreetsType || "")
                      const area = item.AreaDescription ? `${item.AreaDescription} обл.` : ""
                      fullName = `${type} ${item.Description}${area ? ", " + area : ""}`.trim()
                    }
                    
                    onSelect(item)
                    setSearch(fullName)
                    setIsOpen(false)
                  }}
                >
                  <div className="font-medium">
                    {item.name ? item.name : `${item.SettlementTypeDescription ? getShortType(item.SettlementTypeDescription) : (item.StreetsType || "")} ${item.Description}`}
                  </div>
                  {item.org_code && (
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      ЄДРПОУ: {item.org_code}
                    </div>
                  )}
                  {item.address_text && (
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      {item.address_text}
                    </div>
                  )}
                  {item.AreaDescription && (
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      {item.AreaDescription} обл., {item.RegionsDescription}
                    </div>
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function NumberSlider({ label, max, value, onChange, disabled = false }) {
  const safe = clampInt(value, 0, max)
  const percentage = (safe / max) * 100
  const [displayValue, setDisplayValue] = useState(safe.toString())

  useEffect(() => {
    setDisplayValue(safe.toString())
  }, [safe])

  return (
    <div className={cn("space-y-2", disabled && "opacity-50 pointer-events-none")}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{label}</div>
        <Input
          className="w-24 text-right rounded-2xl bg-white/[0.03] border-white/10 focus-visible:ring-primary/40 transition-all"
          value={displayValue}
          disabled={disabled}
          onFocus={() => {
            if (safe === 0) setDisplayValue("")
          }}
          onBlur={() => {
            if (displayValue === "") setDisplayValue("0")
          }}
          onChange={(e) => {
            const val = e.target.value
            if (val === "" || /^\d+$/.test(val)) {
              setDisplayValue(val)
              if (val !== "") {
                onChange(clampInt(val, 0, max))
              } else {
                onChange(0)
              }
            }
          }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={max}
        value={safe}
        disabled={disabled}
        onChange={(e) => onChange(clampInt(e.target.value, 0, max))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none"
        style={{
          background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${percentage}%, rgba(255, 255, 255, 0.12) ${percentage}%, rgba(255, 255, 255, 0.12) 100%)`
        }}
      />
    </div>
  )
}