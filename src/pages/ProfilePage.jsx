import { useAuth } from "../hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, User, Mail, Shield, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export function ProfilePage() {
  const { user, profile, signOut, profileLoading } = useAuth();
  const MotionDiv = motion.div;

  const MotionButton = motion.button;

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="min-h-screen p-4 flex flex-col items-center glow">
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6"
      >
        <div className="flex flex-col items-center space-y-2 mb-8">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 shadow-xl">
            <User className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Профіль користувача</h1>
          <p className="text-muted-foreground text-sm">Керування вашим обліковим записом</p>
        </div>

        <Card className="glass border-none shadow-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Інформація
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Повне ім'я</label>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-white/10">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{profile?.full_name || "—"}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-white/10">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{user?.email || "—"}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Роль</label>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-white/10">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium capitalize">{profile?.role || "Користувач"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="pt-4">
          <MotionButton
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-14 rounded-2xl bg-red-600 text-white font-bold flex items-center justify-center gap-3 shadow-[0_10px_40px_rgba(220,38,38,0.4)] hover:bg-red-500 transition-all"
            onClick={handleLogout}
          >
            <LogOut className="w-6 h-6" />
            <span className="text-lg">Вийти з системи</span>
          </MotionButton>
        </div>

        {profileLoading && (
          <div className="flex justify-center pt-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </MotionDiv>
    </div>
  );
}
