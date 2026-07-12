"use client";

import { useEffect } from "react";

export function EmbedAutoResize({ frameId }: { frameId: string }) {
  useEffect(() => {
    document.documentElement.classList.add("embed-document");
    document.body.classList.add("embed-document");
    let frame = 0;
    const publishHeight = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
        window.parent.postMessage({ rfdeltaEmbed: true, frameId, height }, "*");
      });
    };
    const observer = new ResizeObserver(publishHeight);
    observer.observe(document.documentElement);
    window.addEventListener("load", publishHeight);
    window.addEventListener("resize", publishHeight);
    publishHeight();
    const delayed = window.setTimeout(publishHeight, 250);
    return () => {
      observer.disconnect();
      window.removeEventListener("load", publishHeight);
      window.removeEventListener("resize", publishHeight);
      window.clearTimeout(delayed);
      cancelAnimationFrame(frame);
    };
  }, [frameId]);
  return null;
}
