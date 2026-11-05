import Svg, { Circle, Path } from 'react-native-svg';

// Lucide icons (spec 012: stroke 1.75), drawn with react-native-svg.
interface IconProps {
  readonly color: string;
  readonly size?: number;
}

const base = (size: number, color: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function ClipboardIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <Path d="M9 2h6v4H9zM12 11h4M12 16h4M8 11h.01M8 16h.01" />
    </Svg>
  );
}

export function UserIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

export function AlertIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 8v4M12 16h.01" />
    </Svg>
  );
}

export function LockIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}
