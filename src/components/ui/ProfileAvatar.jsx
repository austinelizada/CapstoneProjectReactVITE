function ProfileAvatar({ name = "Customer", email = "", compact = false }) {
  const displayName = String(name || "Customer").trim() || "Customer";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-700 to-amber-600 font-black text-white shadow-sm ${compact ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm"}`}>
        {initial}
      </span>
      <div className="min-w-0">
        <div className="truncate font-semibold text-slate-900">{displayName}</div>
        {email && <div className="truncate text-xs text-slate-500">{email}</div>}
      </div>
    </div>
  );
}

export default ProfileAvatar;
