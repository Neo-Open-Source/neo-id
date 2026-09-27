"use client";

import {
  ArrowLeft,
  ArrowUp,
  AtSign,
  Ban,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleUserRound,
  Code,
  Copy,
  DoorOpen,
  Eye,
  EyeOff,
  FileText,
  Fingerprint,
  Globe,
  KeyRound,
  LayoutGrid,
  Link2,
  Link as LinkIcon,
  Lock,
  LockOpen,
  LogOut,
  Mail,
  Monitor,
  MonitorSmartphone,
  MoonStar,
  Pencil,
  Plus,
  Palette,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  ShieldUser,
  Smartphone,
  SquareTerminal,
  Tablet,
  Trash2,
  TriangleAlert,
  Webhook,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

const MAP: Record<string, LucideIcon> = {
  "angle-small-down": ChevronDown,
  "angle-small-right": ChevronRight,
  apps: LayoutGrid,
  "arrow-left": ArrowLeft,
  "arrow-up": ArrowUp,
  at: AtSign,
  ban: Ban,
  camera: Camera,
  check: Check,
  "check-circle": CircleCheck,
  code: Code,
  copy: Copy,
  "cross-small": X,
  devices: MonitorSmartphone,
  "document-signed": FileText,
  "door-open": DoorOpen,
  envelope: Mail,
  exit: LogOut,
  eye: Eye,
  "eye-crossed": EyeOff,
  fingerprint: Fingerprint,
  globe: Globe,
  "globe-alt": Globe,
  grid: LayoutGrid,
  key: KeyRound,
  laptop: Monitor,
  link: LinkIcon,
  "link-alt": Link2,
  lock: Lock,
  mobile: Smartphone,
  "moon-star": MoonStar,
  password: KeyRound,
  palette: Palette,
  pencil: Pencil,
  plus: Plus,
  "qr-code": QrCode,
  refresh: RefreshCw,
  search: Search,
  settings: Settings,
  share: Share2,
  "shield-check": ShieldCheck,
  shield: Shield,
  "sign-out-alt": LogOut,
  smartphone: Smartphone,
  "square-terminal": SquareTerminal,
  tablet: Tablet,
  terminal: SquareTerminal,
  trash: Trash2,
  "triangle-warning": TriangleAlert,
  unlock: LockOpen,
  user: CircleUserRound,
  "circle-user": CircleUserRound,
  "user-shield": ShieldUser,
  webhook: Webhook,
};

export function Icon({ name, size = 20, className }: IconProps) {
  const Cmp = MAP[name] ?? null;
  if (!Cmp) return null;
  return (
    <span
      className={cn("neo-icon", className)}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden
    >
      <Cmp size={size} strokeWidth={1.8} />
    </span>
  );
}
