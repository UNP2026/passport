import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Search, 
  Building2, 
  MapPin, 
  Plus, 
  Pencil, 
  Eye,
  ChevronDown, 
  ChevronUp,
  History,
  Calendar,
  Loader2,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  } catch {
    return dateStr;
  }
};

export function ExistingPointsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("orgs"); // "orgs" or "all"
  const [expandedOrgs, setExpandedOrgs] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("visits")
        .select(`
          *,
          tt:tt_id (
            *,
            org:org_id (*)
          ),
          author:author_user_id (full_name)
        `)
        //.eq("author_user_id", user.id)
        .order("visited_at", { ascending: false });

      if (error) throw error;
      setVisits(data || []);
    } catch (err) {
      console.error("Error fetching visits:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const processedData = useMemo(() => {
    // Group visits by TT to get "total visits" and "last visit"
    const ttMap = {};
    
    visits.forEach(visit => {
      const ttId = visit.tt_id;
      if (!ttMap[ttId]) {
        ttMap[ttId] = {
          tt: visit.tt,
          visits: [],
          lastVisit: visit,
          totalVisits: 0
        };
      }
      ttMap[ttId].visits.push(visit);
      ttMap[ttId].totalVisits += 1;
      
      // Since they are ordered by ID desc, the first one we encounter is the latest
      // But let's be safe and check IDs or dates if needed.
      // For now, assuming ID desc is enough for "last visit".
    });

    const allTTs = Object.values(ttMap);

    // Group by Org
    const orgMap = {};
    const cityMap = {};
    allTTs.forEach(item => {
      const orgId = item.tt?.org?.id || "no-org";
      const orgName = item.tt?.org?.name || "Без організації";
      
      if (!orgMap[orgId]) {
        orgMap[orgId] = {
          id: orgId,
          name: orgName,
          tts: []
        };
      }
      orgMap[orgId].tts.push(item);

      const cityName = item.tt?.city || "Без міста";
      const cityId = cityName; // using name as ID for cities
      if (!cityMap[cityId]) {
        cityMap[cityId] = {
          id: cityId,
          name: cityName,
          tts: []
        };
      }
      cityMap[cityId].tts.push(item);
    });

    return {
      allTTs: allTTs.sort((a, b) => b.lastVisit.id - a.lastVisit.id),
      orgs: Object.values(orgMap).sort((a, b) => a.name.localeCompare(b.name)),
      cities: Object.values(cityMap).sort((a, b) => a.name.localeCompare(b.name))
    };
  }, [visits]);

  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase();
    
    if (viewMode === "all") {
      return processedData.allTTs.filter(item => 
        item.tt.name.toLowerCase().includes(query) || 
        (item.tt.org?.name || "").toLowerCase().includes(query) ||
        (item.tt.city || "").toLowerCase().includes(query) ||
        (item.tt.street || "").toLowerCase().includes(query)
      );
    } else if (viewMode === "orgs") {
      return processedData.orgs.map(org => ({
        ...org,
        tts: org.tts.filter(item => 
          item.tt.name.toLowerCase().includes(query) || 
          (item.tt.city || "").toLowerCase().includes(query) ||
          (item.tt.street || "").toLowerCase().includes(query)
        )
      })).filter(org => org.tts.length > 0 || org.name.toLowerCase().includes(query));
    } else if (viewMode === "cities") {
      return processedData.cities.map(city => ({
        ...city,
        tts: city.tts.filter(item => 
          item.tt.name.toLowerCase().includes(query) || 
          (item.tt.org?.name || "").toLowerCase().includes(query) ||
          (item.tt.street || "").toLowerCase().includes(query)
        )
      })).filter(city => city.tts.length > 0 || city.name.toLowerCase().includes(query));
    }
  }, [processedData, searchQuery, viewMode]);

  const toggleOrg = (id) => {
    setExpandedOrgs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isEditable = (visitedAt) => {
    if (!visitedAt) return false;

    try {
      let visitDate;

      if (typeof visitedAt === "string" && visitedAt.includes(".")) {
        // формат DD.MM.YYYY
        const [day, month, year] = visitedAt.split(".").map(Number);
        visitDate = new Date(year, month - 1, day);
      } else {
        // ISO / date from Supabase
        visitDate = new Date(visitedAt);
      }

      if (Number.isNaN(visitDate.getTime())) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      visitDate.setHours(0, 0, 0, 0);

      const diffTime = today - visitDate;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      return diffDays >= 0 && diffDays <= 3;
    } catch {
      return false;
    }
  };

  const MotionDiv = motion.div;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Завантаження точок...</p>
      </div>
    );
  }

  return (
    <div className="glow min-h-full pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 glass border-b border-white/10 px-4 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-white flex-1">Наявні точки</h1>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto relative z-10">
        {/* Search & Toggle */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Пошук ТТ або організації..." 
              className="pl-10 rounded-2xl bg-white/5 border-white/10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10 relative">
            <button
              onClick={() => setViewMode("orgs")}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-xl transition-all relative z-10",
                viewMode === "orgs" ? "text-white" : "text-muted-foreground hover:text-white"
              )}
            >
              {viewMode === "orgs" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary rounded-xl shadow-lg"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative z-20">По організаціям</span>
            </button>
            <button
              onClick={() => setViewMode("cities")}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-xl transition-all relative z-10",
                viewMode === "cities" ? "text-white" : "text-muted-foreground hover:text-white"
              )}
            >
              {viewMode === "cities" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary rounded-xl shadow-lg"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative z-20">По містах</span>
            </button>
            <button
              onClick={() => setViewMode("all")}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-xl transition-all relative z-10",
                viewMode === "all" ? "text-white" : "text-muted-foreground hover:text-white"
              )}
            >
              {viewMode === "all" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary rounded-xl shadow-lg"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative z-20">Всі точки</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {viewMode === "orgs" || viewMode === "cities" ? (
              filteredData.map((group) => (
                <div key={group.id} className="space-y-2">
                  <button
                    onClick={() => toggleOrg(group.id)}
                    className="w-full flex items-center justify-between p-4 glass rounded-2xl border border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        {viewMode === "orgs" ? <Building2 className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-white">{group.name}</div>
                        <div className="text-xs text-muted-foreground">{group.tts.length} ТТ</div>
                      </div>
                    </div>
                    {expandedOrgs[group.id] ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </button>

                  <AnimatePresence>
                    {expandedOrgs[group.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-2 pl-4 border-l-2 border-white/5 ml-5"
                      >
                        {group.tts.map((item) => (
                          <TTCard key={item.tt.id} item={item} isEditable={isEditable} nav={nav} />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            ) : (
              <div className="space-y-3">
                {filteredData.map((item) => (
                  <TTCard key={item.tt.id} item={item} isEditable={isEditable} nav={nav} />
                ))}
              </div>
            )}

            {filteredData.length === 0 && (
              <div className="text-center py-12 space-y-4">
                <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                  <History className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-muted-foreground">Нічого не знайдено</div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function TTCard({ item, isEditable, nav }) {
  const { tt, lastVisit, totalVisits } = item;
  const canEdit = isEditable(lastVisit.visited_at);

  return (
    <Card 
      className="glass border-white/10 overflow-hidden hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => nav(`/app/surveys/new?viewId=${lastVisit.id}`)}
    >
      <CardContent className="p-4 space-y-4">
        <div className="flex justify-between items-start gap-3">
          <div className="space-y-1">
            <h3 className="font-bold text-white leading-tight">{tt.name}</h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{tt.city}, {tt.street} {tt.house}</span>
            </div>
          </div>
          <Badge variant="secondary" className="bg-white/5 text-white border-white/10 whitespace-nowrap">
            {totalVisits} візитів
          </Badge>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span className="text-white/80">{formatDate(lastVisit.visited_at)}</span>
            </div>
            {lastVisit.author?.full_name && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="text-white/80">{lastVisit.author.full_name}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="h-8 w-8 p-0 rounded-lg border-white/10 hover:bg-blue-500 hover:text-white transition-all"
              onClick={(e) => {
                e.stopPropagation();
                nav(`/app/surveys/new?viewId=${lastVisit.id}`);
              }}
              title="Переглянути останній візит"
            >
              <Eye className="h-4 w-4" />
            </Button>

            <Button 
              size="sm" 
              variant="outline" 
              className="h-8 w-8 p-0 rounded-lg border-white/10 hover:bg-primary hover:text-white transition-all"
              onClick={(e) => {
                e.stopPropagation();
                nav(`/app/surveys/new?ttId=${tt.id}`);
              }}
              title="Створити новий візит"
            >
              <Plus className="h-4 w-4" />
            </Button>
            
            <Button 
              size="sm" 
              variant="outline" 
              disabled={!canEdit}
              className={cn(
                "h-8 w-8 p-0 rounded-lg border-white/10 transition-all",
                canEdit ? "hover:bg-amber-500 hover:text-white" : "opacity-30 grayscale"
              )}
              onClick={(e) => {
                e.stopPropagation();
                nav(`/app/surveys/new?editId=${lastVisit.id}`);
              }}
              title={canEdit ? "Редагувати останній візит" : "Редагування недоступне (більше 3 днів)"}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
