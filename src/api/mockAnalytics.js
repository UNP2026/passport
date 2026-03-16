const BRANDS = ["Brand A", "Brand B", "Brand C", "Brand D", "Brand E"];
const CITIES = ["Київ", "Львів", "Одеса", "Харків", "Дніпро"];
const AGENTS = ["Іван Іванов", "Петро Петров", "Олена Сидорова", "Дмитро Коваленко"];
const POINTS = [
  "Магазин 'Продукти'", "Супермаркет 'Сільпо'", "ТЦ 'Ocean Plaza'", 
  "Кіоск №5", "Маркет 'Коло'", "Гастроном 'Центральний'", 
  "Велика Кишеня", "АТБ-Маркет", "Фора", "Novus"
];

export function generateMockAnalyticsData() {
  const data = [];
  const now = new Date();
  
  // Generate data for the last 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    CITIES.forEach(city => {
      AGENTS.forEach(agent => {
        // Random number of visits per agent per city per day
        const visitsCount = Math.floor(Math.random() * 3);
        
        for (let v = 0; v < visitsCount; v++) {
          const point = POINTS[Math.floor(Math.random() * POINTS.length)];
          const brandPresence = {};
          BRANDS.forEach(brand => {
            brandPresence[brand] = Math.random() > 0.4; // 60% chance of presence
          });
          
          data.push({
            id: Math.random().toString(36).substr(2, 9),
            date: dateStr,
            city,
            agent,
            point,
            brandPresence
          });
        }
      });
    });
  }
  
  return {
    raw: data,
    brands: BRANDS,
    cities: CITIES,
    agents: AGENTS,
    points: POINTS
  };
}
