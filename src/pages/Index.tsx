import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { OutputPanel } from "@/components/OutputPanel";
import { Lightbox } from "@/components/Lightbox";
import { CarouselProvider } from "@/lib/carousel-store";
import { SiteFooter } from "@/components/SiteFooter";

function CarouselStudio() {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxSrc(null);
    };
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  return (
    <CarouselProvider>
      <Navbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[199] md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] min-h-[calc(100vh-60px)] mt-[60px]">
        <div
          className={`
            fixed md:relative top-[60px] left-0 z-[200] h-[calc(100vh-60px)] w-[85vw] max-w-[320px] md:w-auto md:max-w-none
            transition-transform duration-300 ease-out md:translate-x-0
            ${sidebarOpen ? "translate-x-0 shadow-2xl shadow-black/50" : "-translate-x-full"}
          `}
        >
          <Sidebar />
        </div>
        <div className="min-w-0 animate-fade-in">
          <OutputPanel onImageClick={setLightboxSrc} />
        </div>
      </div>
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      <SiteFooter />
    </CarouselProvider>
  );
}

const Index = () => <CarouselStudio />;

export default Index;
