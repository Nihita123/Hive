interface UserAvatarProps {
  email: string
  size?: 'sm' | 'md'
  isTyping?: boolean
}

// Deterministic color from email string
function emailToColor(email: string): string {
  const colors = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
    'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-pink-500',
  ]
  let hash = 0
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function UserAvatar({ email, size = 'md', isTyping = false }: UserAvatarProps) {
  const initials = email.slice(0, 2).toUpperCase()
  const color = emailToColor(email)
  const sizeClass = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'

  return (
    <div className="relative flex-shrink-0" title={email}>
      <div className={`${sizeClass} ${color} rounded-full flex items-center justify-center font-semibold text-white`}>
        {initials}
      </div>
      {isTyping && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-zinc-900 animate-pulse" />
      )}
    </div>
  )
}
