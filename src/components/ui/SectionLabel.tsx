import { type ReactNode, type CSSProperties } from 'react'
interface Props { children: ReactNode; style?: CSSProperties }
export default function SectionLabel({ children, style }: Props) {
  return <div className="label" style={{ marginBottom: 10, ...style }}>{children}</div>
}
