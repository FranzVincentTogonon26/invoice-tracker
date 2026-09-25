import { Sun, Moon } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { UserHeader } from "@/components/ui/UserHeader";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { NotificationsPopover } from "../../ui/NotificationsPopover";

export function Topbar() {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();

  return (
    <header className="mb-6 flex items-start justify-between gap-3 md:mb-8 md:gap-6">
      {/* Desktop: greeting. Mobile: signed-in user (avatar, name, email). */}
      <UserHeader user={user} />

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <IconButton onClick={toggle} title="Toggle theme">
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </IconButton>
        <NotificationsPopover />
      </div>
    </header>
  );
}

