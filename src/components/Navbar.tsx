import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";

export function Navbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { active } = useSubscription();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <nav className="h-[60px] flex items-center justify-between px-4 md:px-7 border-b border-border2 bg-background/95 backdrop-blur-xl fixed top-0 left-0 right-0 z-[300]">
      <div className="flex items-center gap-2 md:gap-3.5">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden text-primary p-1.5 border border-border2 rounded-sm hover:border-primary transition-colors"
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <Link to="/" className="font-logo text-[14px] md:text-[17px] font-black tracking-[3px] text-primary">
          BRITTO<span className="text-accent">★</span>
        </Link>
        <div className="hidden md:block font-mono text-[9px] text-muted-foreground tracking-[2px] border border-border2 px-2.5 py-0.5 rounded-sm bg-card">
          CAROUSEL_STUDIO
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {active === false && user && (
          <Link
            to="/pricing"
            className="bg-primary/10 border border-primary text-primary font-mono text-[10px] tracking-[1px] uppercase px-3 py-1.5 rounded-sm hover:bg-primary/20 transition"
          >
            ★ Assinar
          </Link>
        )}
        {active && (
          <span className="hidden sm:flex items-center gap-1.5 font-mono text-[9px] text-primary">
            <div className="w-[6px] h-[6px] rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
            PRO
          </span>
        )}
        {user && (
          <div className="flex items-center gap-2">
            <span className="hidden md:inline font-mono text-[10px] text-muted-foreground truncate max-w-[150px]">
              {user.email}
            </span>
            <button
              onClick={logout}
              className="font-mono text-[9px] tracking-[1px] uppercase text-muted-foreground hover:text-destructive border border-border2 hover:border-destructive px-2 py-1 rounded-sm transition"
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
