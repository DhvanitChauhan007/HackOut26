import React from "react";

export function PageTitle({ icon, eyebrow, title, copy }: { icon: React.ReactNode; eyebrow: string; title: string; copy: string }) { 
  return (
    <div className="mb-6 flex items-start gap-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-highlight [&>svg]:size-6">{icon}</span>
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">{eyebrow}</p>
        <h1 className="font-display text-4xl font-semibold">{title}</h1>
        <p className="mt-1 text-muted-foreground">{copy}</p>
      </div>
    </div>
  ); 
}
