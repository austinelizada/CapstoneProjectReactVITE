function AdminPageHeader({ title, description, stats = [], className = "", statsClassName = "" }) {
  return (
    <section className={`relative overflow-hidden rounded-[22px] bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 px-8 py-7 text-white shadow-[0_18px_45px_-24px_rgba(15,23,42,0.7)] ${className}`}>
      <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-8 -top-16 h-48 w-48 rounded-full border border-white/10" />
      <div className="relative flex flex-col gap-7 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-red-300">Administration</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
          {description && <p className="mt-3 text-sm leading-6 text-blue-100 sm:text-base">{description}</p>}
        </div>

        {stats.length > 0 && (
          <div className={`grid grid-cols-3 gap-3 2xl:shrink-0 ${statsClassName}`}>
            {stats.map((stat) => (
              <div key={stat.label} className="min-w-0 rounded-2xl border border-white/15 bg-white/10 px-3 py-4 text-center shadow-lg backdrop-blur-sm sm:px-5">
                <p className={`truncate text-base font-black tabular-nums sm:text-xl ${stat.color || "text-white"}`}>{stat.value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default AdminPageHeader;
