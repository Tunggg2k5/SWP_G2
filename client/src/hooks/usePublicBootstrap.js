import { useEffect, useState } from "react";
import { api } from "../services/api.js";

export function usePublicBootstrap() {
  const [data, setData] = useState({ services: [], dentists: [], rooms: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    api
      .get("/bootstrap")
      .then((res) => {
        if (!isMounted) return;
        setData({
          services: res.data.services || [],
          dentists: res.data.dentists || [],
          rooms: res.data.rooms || []
        });
      })
      .catch(() => {
        if (isMounted) setData({ services: [], dentists: [], rooms: [] });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { ...data, loading };
}
