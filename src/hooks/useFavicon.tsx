import { useEffect } from "react";

export const useFavicon = (faviconUrl: string) => {
  useEffect(() => {
    if (!faviconUrl) return;

    // Find or create favicon link element
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    // Update href
    link.href = faviconUrl;

    // Determine type based on file extension
    const extension = faviconUrl.split('.').pop()?.toLowerCase();
    if (extension === 'ico') {
      link.type = 'image/x-icon';
    } else if (extension === 'png') {
      link.type = 'image/png';
    } else if (extension === 'svg') {
      link.type = 'image/svg+xml';
    }
  }, [faviconUrl]);
};
