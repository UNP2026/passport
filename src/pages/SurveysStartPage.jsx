import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { PlusCircle, List, ChevronRight } from "lucide-react";

export function SurveysStartPage() {
  const nav = useNavigate();
  const MotionDiv = motion.div;
  const MotionButton = motion.button;

  return (
    <div className="p-6 pb-[calc(6rem+env(safe-area-inset-bottom))] space-y-8 glow min-h-full">
      <MotionDiv 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-1"
      >
        <h1 className="text-3xl font-bold tracking-tight text-white">Опитування ТТ</h1>
        <p className="text-muted-foreground">Керування візитами та звітами</p>
      </MotionDiv>

      <div className="grid gap-4">
        <MotionButton
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass group relative flex items-center justify-between p-5 rounded-[2rem] text-left transition-all hover:bg-white/[0.06]"
          onClick={() => nav("/app/surveys/new")}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <PlusCircle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">Нова точка</div>
              <div className="text-sm text-muted-foreground">Створити новий візит</div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-white transition-colors" />
        </MotionButton>

        <MotionButton
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass group relative flex items-center justify-between p-5 rounded-[2rem] text-left transition-all hover:bg-white/[0.06]"
          onClick={() => nav("/app/surveys/existing")}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors">
              <List className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">Наявні точки</div>
              <div className="text-sm text-muted-foreground">Переглянути історію візитів</div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-white transition-colors" />
        </MotionButton>
      </div>
      
      <MotionDiv 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="pt-8"
      >
        
      </MotionDiv>
    </div>
  );
}
