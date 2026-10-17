"use client";

import { useState } from "react";

/** A person's avatar: the profile picture when they have one, otherwise their initials (same look everywhere; also when the picture fails to load). */
export function UserAv({ id, name, has, size = 32 }: { id?: string | null; name: string; has?: boolean | number; size?: number }) {
  const [broken, setBroken] = useState(false);
  const init = (name.trim().includes("@") ? name.trim()[0] : name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("")).toUpperCase() || "?";
  const style = { width: size, height: size, borderRadius: 999, fontSize: size < 30 ? 10 : size < 40 ? 12 : 14 };
  // eslint-disable-next-line @next/next/no-img-element
  return has && id && !broken ? <img className="cbAv" src={`/api/avatar/${id}`} alt="" style={style} onError={() => setBroken(true)} />
    : <span className="cbAv" style={style} aria-hidden="true">{init}</span>;
}
