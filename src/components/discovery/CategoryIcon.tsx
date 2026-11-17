import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getCategoryIconKey, type CategoryIconKey } from '../../lib/discovery/category-icon-map';

type NativeIconName = ComponentProps<typeof Ionicons>['name'];

// Platform-native glyphs; the semantic keys are kept identical to the web app.
export const NATIVE_CATEGORY_ICONS: Record<CategoryIconKey, NativeIconName> = {
  all: 'grid-outline',
  electronics: 'laptop-outline',
  phone: 'phone-portrait-outline',
  home: 'home-outline',
  fashion: 'shirt-outline',
  vehicles: 'car-outline',
  food: 'restaurant-outline',
  coffee: 'cafe-outline',
  beauty: 'sparkles-outline',
  services: 'construct-outline',
  retail: 'storefront-outline',
  health: 'medkit-outline',
  fitness: 'barbell-outline',
  music: 'musical-notes-outline',
  arts: 'color-palette-outline',
  community: 'people-outline',
  party: 'balloon-outline',
  sports: 'trophy-outline',
  networking: 'git-network-outline',
  education: 'school-outline',
  laundry: 'water-outline',
  tailoring: 'cut-outline',
  cleaning: 'sparkles-outline',
  repairs: 'build-outline',
  books: 'book-outline',
  gaming: 'game-controller-outline',
  printing: 'print-outline',
  garden: 'leaf-outline',
  tools: 'hammer-outline',
  photography: 'camera-outline',
  events: 'calendar-outline',
  time: 'time-outline',
  free: 'gift-outline',
  kids: 'happy-outline',
  jewelry: 'diamond-outline',
  watch: 'watch-outline',
  bags: 'bag-handle-outline',
  transport: 'bus-outline',
  safety: 'shield-checkmark-outline',
  entertainment: 'film-outline',
  other: 'pricetag-outline',
};

export function CategoryIcon({
  category,
  size = 18,
  color,
}: {
  category: string | null | undefined;
  size?: number;
  color: string;
}) {
  return (
    <Ionicons
      name={NATIVE_CATEGORY_ICONS[getCategoryIconKey(category)]}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
