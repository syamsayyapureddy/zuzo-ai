import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Pet } from "@/lib/pets";

export function useSignedPhotoUrls(pets: Pet[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const paths = pets.map((p) => p.photo_url).filter((p): p is string => !!p);
      if (paths.length === 0) { setUrls({}); return; }
      const { data } = await supabase.storage.from("pet-photos").createSignedUrls(paths, 3600);
      if (cancelled || !data) return;
      const map: Record<string, string> = {};
      data.forEach((d, i) => { if (d.signedUrl) map[paths[i]] = d.signedUrl; });
      setUrls(map);
    })();
    return () => { cancelled = true; };
  }, [pets]);
  return urls;
}
