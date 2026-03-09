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
  ChevronDown, 
  ChevronUp,
  History,
  Calendar,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
          )
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
  }, [user]);

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
    });

    return {
      allTTs: allTTs.sort((a, b) => b.lastVisit.id - a.lastVisit.id),
      orgs: Object.values(orgMap).sort((a, b) => a.name.localeCompare(b.name))
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
    } else {
      return processedData.orgs.map(org => ({
        ...org,
        tts: org.tts.filter(item => 
          item.tt.name.toLowerCase().includes(query) || 
          (item.tt.city || "").toLowerCase().includes(query) ||
          (item.tt.street || "").toLowerCase().includes(query)
        )
      })).filter(org => org.tts.length > 0 || org.name.toLowerCase().includes(query));
    }
  }, [processedData, searchQuery, viewMode]);

  const toggleOrg = (id) => {
    setExpandedOrgs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isEditable = (visitedAt) => {
    if (!visitedAt) return false;
    try {
      // Parse DD.MM.YYYY
      const [day, month, year] = visitedAt.split(".").map(Number);
      const visitDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      visitDate.setHours(0, 0, 0, 0);
      
      const diffTime = Math.abs(today - visitDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays <= 3;
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
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b border-white/10 px-4 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-white flex-1">Наявні точки</h1>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto">
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

          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
            <button
              onClick={() => setViewMode("orgs")}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-xl transition-all",
                viewMode === "orgs" ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-white"
              )}
            >
              По організаціям
            </button>
            <button
              onClick={() => setViewMode("all")}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-xl transition-all",
                viewMode === "all" ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-white"
              )}
            >
              Всі точки
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {viewMode === "orgs" ? (
            <AnimatePresence mode="popLayout">
              {filteredData.map((org) => (
                <motion.div
                  key={org.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-2"
                >
                  <button
                    onClick={() => toggleOrg(org.id)}
                    className="w-full flex items-center justify-between p-4 glass rounded-2xl border border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-white">{org.name}</div>
                        <div className="text-xs text-muted-foreground">{org.tts.length} ТТ</div>
                      </div>
                    </div>
                    {expandedOrgs[org.id] ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </button>

                  <AnimatePresence>
                    {expandedOrgs[org.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-2 pl-4 border-l-2 border-white/5 ml-5"
                      >
                        {org.tts.map((item) => (
                          <TTCard key={item.tt.id} item={item} isEditable={isEditable} nav={nav} />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
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
        </div>
      </div>
    </div>
  );
}

function TTCard({ item, isEditable, nav }) {
  const { tt, lastVisit, totalVisits } = item;
  const canEdit = isEditable(lastVisit.visited_at);

  return (
    <Card className="glass border-white/10 overflow-hidden hover:border-primary/30 transition-colors">
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Останній: <span className="text-white/80">{lastVisit.visited_at}</span></span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="h-8 w-8 p-0 rounded-lg border-white/10 hover:bg-primary hover:text-white transition-all"
              onClick={() => nav(`/app/surveys/new?ttId=${tt.id}`)}
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
              onClick={() => nav(`/app/surveys/new?editId=${lastVisit.id}`)}
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
