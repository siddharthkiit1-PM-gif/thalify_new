interface Props {
  size?: number
  className?: string
  style?: React.CSSProperties
}

export default function TelegramLogo({ size = 16, className, style }: Props) {
  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-label="Telegram"
      role="img"
    >
      <defs>
        <linearGradient id="tg-logo-grad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#41BCE7" />
          <stop offset="100%" stopColor="#22A6DC" />
        </linearGradient>
      </defs>
      <circle cx="120" cy="120" r="120" fill="url(#tg-logo-grad)" />
      <path
        d="M180.4 80.5 37.7 137.7c-3.3 1.3-3.6 5.9-.5 7.7L74.5 167l13.7 41.4c1.5 4.6 7.7 5.5 10.5 1.5l21.8-31.2 39.6 28.7c4.5 3.3 10.9.6 11.9-4.9L188 88.7c1-5.6-4-9.9-7.6-8.2zM83.9 162.7l72-58.8c1-.8-.3-2.4-1.4-1.7l-89.2 56.5 18.6 4z"
        fill="#fff"
      />
    </svg>
  )
}
