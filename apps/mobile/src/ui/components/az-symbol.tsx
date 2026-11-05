import { azSymbol } from '@az-pesquisas/design-tokens';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme';

export function AzSymbol({
  height,
  color = colors.sidebar.accent,
}: {
  height: number;
  color?: string;
}) {
  return (
    <Svg
      width={height * azSymbol.ratio}
      height={height}
      viewBox={azSymbol.viewBox}
      accessibilityLabel="AZ"
    >
      <Path d={azSymbol.path} fill={color} fillRule="evenodd" />
    </Svg>
  );
}
