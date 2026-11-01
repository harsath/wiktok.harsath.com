import { useEffect, useState } from "react";

const STORAGE_KEY = "wiktokBookmarks";

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
};

export default function useBookmarks() {
  const [bookmarks, setBookmarks] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    } catch {}
  }, [bookmarks]);

  const isBookmarked = title => bookmarks.some(b => b.title === title);

  const toggleBookmark = item => {
    setBookmarks(prev =>
      prev.some(b => b.title === item.title)
        ? prev.filter(b => b.title !== item.title)
        // newest first; only store what the saved list needs
        : [{ title: item.title, image: item.image || null, desc: item.desc?.slice(0, 160) || "" }, ...prev]
    );
  };

  const removeBookmark = title => setBookmarks(prev => prev.filter(b => b.title !== title));

  return { bookmarks, toggleBookmark, isBookmarked, removeBookmark };
}
