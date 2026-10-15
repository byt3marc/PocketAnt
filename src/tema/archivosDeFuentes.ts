/**
 * Archivos de las fuentes propias, listos para `useFonts`. Se importa cada peso por separado (no el índice
 * del paquete) para que solo se empaqueten estos seis archivos y no las 14–16 variantes de cada familia.
 */
export const fuentesDeTexto = {
  Nunito_400Regular: require('@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf'),
  Nunito_600SemiBold: require('@expo-google-fonts/nunito/600SemiBold/Nunito_600SemiBold.ttf'),
  Nunito_700Bold: require('@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf'),
  Lora_400Regular: require('@expo-google-fonts/lora/400Regular/Lora_400Regular.ttf'),
  Lora_600SemiBold: require('@expo-google-fonts/lora/600SemiBold/Lora_600SemiBold.ttf'),
  Lora_700Bold: require('@expo-google-fonts/lora/700Bold/Lora_700Bold.ttf'),
};
