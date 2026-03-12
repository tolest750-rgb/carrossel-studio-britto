import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { OutputPanel } from "@/components/OutputPanel";
import { Lightbox } from "@/components/Lightbox";
import { CarouselProvider } from "@/lib/carousel-store";
import { ApiKeyManager } from "@/components/ApiKeyManager";

function CarouselStudio() {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState(false);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxSrc(null);
    };
    const handleOpenKeys = () => setShowApiKeys(true);
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("open-api-key-manager", handleOpenKeys);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("open-api-key-manager", handleOpenKeys);
    };
  }, []);

  return (
    <CarouselProvider>
      <Navbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[199] md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] min-h-[calc(100vh-60px)] mt-[60px]">
        <div
          className={`
            fixed md:relative top-[60px] left-0 z-[200] h-[calc(100vh-60px)] w-[300px] md:w-auto
            transition-transform duration-300 md:translate-x-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <Sidebar />
        </div>
        <OutputPanel onImageClick={setLightboxSrc} />
      </div>
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </CarouselProvider>
  );
}

const Index = () => <CarouselStudio />;

export default Index;
