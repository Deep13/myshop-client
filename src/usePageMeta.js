import { useEffect } from "react";

const BASE = "Ganga Instamart";

export default function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE}` : BASE;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", description || "");
    } else if (description) {
      const tag = document.createElement("meta");
      tag.name = "description";
      tag.content = description;
      document.head.appendChild(tag);
    }
  }, [title, description]);
}
