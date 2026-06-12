"use client";

import { useEffect } from "react";
import { fireViewContent } from "./TrackingScripts";

/** Fires a ViewContent pixel event once when a product/course page is viewed. */
export function TrackView({
  name,
  valuePaise,
}: {
  name: string;
  valuePaise?: number;
}) {
  useEffect(() => {
    fireViewContent(name, valuePaise);
  }, [name, valuePaise]);
  return null;
}
