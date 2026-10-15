import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { COLORES_LOGO, FORMAS_LOGO, GROSOR_TRAZO_LOGO, LIMITES_LOGO } from '@/logo';

interface Props {
  /** Alto en dp; el ancho sale de la proporción del dibujo. */
  tamano?: number;
}

/** La hormiga de la marca, con las mismas formas y colores del icono de la app (`src/logo.ts`). */
export function Logo({ tamano = 30 }: Props) {
  const { x, y, ancho, alto } = LIMITES_LOGO;
  return (
    // Decorativo: el nombre de la app va al lado, escrito.
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={(tamano * ancho) / alto} height={tamano} viewBox={`${x} ${y} ${ancho} ${alto}`}>
        {FORMAS_LOGO.map((forma, i) => {
          const color = COLORES_LOGO[forma.color];
          if (forma.tipo === 'circulo') {
            return <Circle key={i} cx={forma.cx} cy={forma.cy} r={forma.r} fill={color} />;
          }
          if (forma.tipo === 'anillo') {
            return (
              <Circle
                key={i}
                cx={forma.cx}
                cy={forma.cy}
                r={forma.r}
                fill="none"
                stroke={color}
                strokeWidth={GROSOR_TRAZO_LOGO}
              />
            );
          }
          return (
            <Path
              key={i}
              d={forma.d}
              fill="none"
              stroke={color}
              strokeWidth={GROSOR_TRAZO_LOGO}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </Svg>
    </View>
  );
}
