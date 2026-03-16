import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchMapData } from "../api/map";
import { Map as MapIcon, Loader2, Filter } from "lucide-react";
import { useSidebar } from "../context/SidebarContext";
import { MapFilters } from "../components/map/MapFilters";

// Fix for default marker icons in Leaflet with Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const UKRAINE_BOUNDS = [
  [44.2, 22.1], // South-West
  [52.3, 40.2]  // North-East
];

// Predefined colors for different TT types
const TYPE_COLORS = [
  "#3b82f6", // blue-500
  "#ef4444", // red-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
];

const SHAPES = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "star",
  "hexagon"
];

export function MapPage() {
  const { isCollapsed, setIsCollapsed, filterContainer } = useSidebar();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeStyles, setTypeStyles] = useState({});
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    org: "all",
    point: "all",
    type: "all",
    manager: "all",
    price: "all",
    brand: "all",
    presence: "all"
  });

  useEffect(() => {
    async function load() {
      const mapData = await fetchMapData();
      setData(mapData);

      // Assign colors and shapes to unique types
      const uniqueTypes = [...new Set(mapData.map(d => d.typeName))].sort();
      const styles = {};
      uniqueTypes.forEach((type, index) => {
        styles[type] = {
          color: TYPE_COLORS[index % TYPE_COLORS.length],
          shape: SHAPES[index % SHAPES.length]
        };
      });
      setTypeStyles(styles);

      setLoading(false);
    }
    load();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(tt => {
      const searchMatch = !filters.search || 
        tt.name.toLowerCase().includes(filters.search.toLowerCase()) || 
        tt.address.toLowerCase().includes(filters.search.toLowerCase());
      
      const orgMatch = filters.org === "all" || tt.orgName === filters.org;
      const pointMatch = filters.point === "all" || tt.name === filters.point;
      const typeMatch = filters.type === "all" || tt.typeName === filters.type;
      const managerMatch = filters.manager === "all" || tt.lastVisitManager === filters.manager;
      const priceMatch = filters.price === "all" || tt.lastVisitPrice === filters.price;
      const brandMatch = filters.brand === "all" || (tt.brands && tt.brands.includes(filters.brand));
      
      let presenceMatch = true;
      if (filters.presence === "highfoam") {
        presenceMatch = tt.hasHighfoam === true;
      } else if (filters.presence === "competitors") {
        presenceMatch = tt.hasHighfoam === false;
      }

      return searchMatch && orgMatch && pointMatch && typeMatch && managerMatch && priceMatch && brandMatch && presenceMatch;
    });
  }, [data, filters]);

  const groupedData = useMemo(() => {
    const groups = {};
    filteredData.forEach(tt => {
      const key = `${tt.lat},${tt.lng}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(tt);
    });
    return Object.values(groups);
  }, [filteredData]);

  // Extract unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const orgs = new Set();
    const points = new Set();
    const types = new Set();
    const managers = new Set();
    const prices = new Set();
    const brandCounts = {};

    data.forEach(tt => {
      if (tt.orgName) orgs.add(tt.orgName);
      if (tt.name) points.add(tt.name);
      if (tt.typeName) types.add(tt.typeName);
      if (tt.lastVisitManager) managers.add(tt.lastVisitManager);
      if (tt.lastVisitPrice) prices.add(tt.lastVisitPrice);
      
      if (tt.brands && tt.brands.length > 0) {
        tt.brands.forEach(b => {
          brandCounts[b] = (brandCounts[b] || 0) + 1;
        });
      }
    });

    const sortedBrands = Object.entries(brandCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      orgs: Array.from(orgs).sort(),
      points: Array.from(points).sort(),
      types: Array.from(types).sort(),
      managers: Array.from(managers).sort(),
      prices: Array.from(prices).sort(),
      brands: sortedBrands
    };
  }, [data]);

  const getShapeSvg = (shape, color) => {
    const props = `fill="${color}" stroke="white" stroke-width="2"`;
    switch (shape) {
      case "circle":
        return `<circle cx="12" cy="12" r="10" ${props} />`;
      case "square":
        return `<rect x="3" y="3" width="18" height="18" rx="2" ${props} />`;
      case "triangle":
        return `<polygon points="12,2 22,20 2,20" stroke-linejoin="round" ${props} />`;
      case "diamond":
        return `<polygon points="12,2 22,12 12,22 2,12" stroke-linejoin="round" ${props} />`;
      case "star":
        return `<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" stroke-linejoin="round" ${props} />`;
      case "hexagon":
        return `<polygon points="12,2 20.66,7 20.66,17 12,22 3.34,17 3.34,7" stroke-linejoin="round" ${props} />`;
      default:
        return `<circle cx="12" cy="12" r="10" ${props} />`;
    }
  };

  const createCustomIcon = (style, count = 1, isCompetitor = false) => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        ${getShapeSvg(style.shape, style.color)}
      </svg>
    `;
    
    let badgeHtml = '';
    if (count > 1) {
      badgeHtml = `
        <div style="position: absolute; top: -8px; right: -8px; background: #ef4444; color: white; border-radius: 12px; padding: 0 5px; font-size: 11px; font-weight: bold; border: 2px solid white; min-width: 20px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 10;">
          ${count}
        </div>
      `;
    }

    let competitorHtml = '';
    if (isCompetitor) {
      competitorHtml = `
        <div style="position: absolute; bottom: -4px; right: -4px; background: white; color: #ef4444; border-radius: 50%; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; box-shadow: 0 1px 2px rgba(0,0,0,0.3); z-index: 11;">
          !
        </div>
      `;
    }

    return L.divIcon({
      className: "custom-leaflet-icon",
      html: `<div style="position: relative; width: 24px; height: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
               ${svg}
               ${badgeHtml}
               ${competitorHtml}
             </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const filtersContent = (
    <MapFilters 
      filters={filters} 
      setFilters={setFilters} 
      orgs={filterOptions.orgs}
      points={filterOptions.points}
      types={filterOptions.types}
      managers={filterOptions.managers}
      prices={filterOptions.prices}
      brands={filterOptions.brands}
    />
  );

  const collapsedFiltersContent = (
    <div className="flex flex-col items-center gap-4 py-4">
      <button 
        onClick={() => setIsCollapsed(false)}
        className="p-3 rounded-xl bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all"
        title="Відкрити фільтри"
      >
        <Filter className="h-5 w-5" />
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b1220] relative">
      {/* Portal filters to Sidebar if available */}
      {filterContainer && createPortal(
        isCollapsed ? collapsedFiltersContent : filtersContent,
        filterContainer
      )}

      <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0b1220] z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
            <MapIcon className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Карта покриття</h1>
            <p className="text-sm text-muted-foreground">Відображення торгових точок на карті України</p>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-4">
          <div className="text-sm text-muted-foreground">
            Знайдено точок: <span className="font-bold text-white">{filteredData.length}</span>
          </div>
          {!filterContainer && (
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                showMobileFilters 
                  ? "bg-indigo-600 text-white" 
                  : "bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              <Filter className="h-4 w-4" />
              Фільтри
            </button>
          )}
        </div>
      </div>

      {!filterContainer && showMobileFilters && (
        <div className="bg-[#0b1220] border-b border-white/10 p-6 z-10 max-h-[50vh] overflow-y-auto">
          {filtersContent}
        </div>
      )}

      <div className="flex-1 relative">
        <MapContainer 
          center={[48.3794, 31.1656]}
          zoom={6}
          bounds={UKRAINE_BOUNDS} 
          maxBounds={UKRAINE_BOUNDS}
          maxBoundsViscosity={1.0}
          minZoom={5}
          className="absolute inset-0 z-0"
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {groupedData.map((group, index) => {
            const firstTt = group[0];
            const style = typeStyles[firstTt.typeName] || { color: "#94a3b8", shape: "circle" };
            const count = group.length;
            
            // If any TT in the group is a competitor (hasHighfoam === false), we mark the group as competitor
            // Or maybe if ALL are competitors? Let's say if the first one is, or if all are.
            // A point is a competitor if it doesn't have Highfoam.
            const isCompetitor = group.every(tt => tt.hasHighfoam === false);

            return (
              <Marker 
                key={index} 
                position={[firstTt.lat, firstTt.lng]}
                icon={createCustomIcon(style, count, isCompetitor)}
              >
                <Popup className="custom-popup" maxWidth={320} minWidth={280}>
                  <div className="p-1 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                    {count > 1 && (
                      <div className="mb-3 pb-2 border-b border-gray-200 sticky top-0 bg-white z-10">
                        <h3 className="font-bold text-base text-indigo-600">
                          Точок за цією адресою: {count}
                        </h3>
                        <p className="text-xs text-gray-500">{firstTt.address}</p>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {group.map((tt, i) => (
                        <div key={tt.id} className={i > 0 ? "pt-4 border-t border-gray-100" : ""}>
                          <h3 className="font-bold text-base mb-1">{tt.name}</h3>
                          {count === 1 && <p className="text-sm text-gray-600 mb-2">{tt.address}</p>}
                          
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Організація:</span>
                              <span className="font-medium text-right">{tt.orgName}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Тип ТТ:</span>
                              <span className="font-medium text-right">{tt.typeName}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Прайс:</span>
                              <span className="font-medium text-right">{tt.lastVisitPrice}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Всього візитів:</span>
                              <span className="font-medium text-right">{tt.visitCount}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Останній візит:</span>
                              <span className="font-medium text-right">{tt.lastVisitDate || "Немає"}</span>
                            </div>
                            {tt.lastVisitManager && (
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-500">Менеджер:</span>
                                <span className="font-medium text-right">{tt.lastVisitManager}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-6 left-6 z-[1000] bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-black/5">
          <h4 className="font-bold text-sm text-gray-900 mb-3 uppercase tracking-wider">Легенда (Типи ТТ)</h4>
          <div className="space-y-2">
            {Object.entries(typeStyles).map(([type, style]) => (
              <div key={type} className="flex items-center gap-3">
                <div 
                  className="w-5 h-5 flex items-center justify-center"
                  dangerouslySetInnerHTML={{
                    __html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">${getShapeSvg(style.shape, style.color)}</svg>`
                  }}
                />
                <span className="text-sm font-medium text-gray-700">{type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
