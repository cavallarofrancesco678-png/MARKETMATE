// MarketMate Color Palette - Mint Green & Teal Design
export const Colors = {
  // Backgrounds - Mint green tones
  bg: '#D4E8E0',              // Main background - mint green
  bgLight: '#E5F2ED',         // Lighter mint
  bgCard: '#F5FAF8',          // Card background - almost white with mint tint
  bgDark: '#C5DDD4',          // Darker mint for insets
  
  // Primary - Dark Teal
  teal: '#1E4A4A',            // Dark teal for buttons, accents
  tealLight: '#2A6060',       // Lighter teal
  tealDark: '#153838',        // Darker teal for gradients
  
  // Secondary - Beige/Cream
  beige: '#E8DCC8',           // Beige for secondary buttons
  beigeLight: '#F2EBE0',      // Light beige
  beigeDark: '#D4C4A8',       // Dark beige
  
  // Text colors
  textDark: '#1E3A3A',        // Dark text
  textMedium: '#4A6A6A',      // Medium text
  textLight: '#7A9A9A',       // Light/placeholder text
  
  // Status colors
  rosso: '#D46A6A',           // Soft red
  verde: '#5AAA6A',           // Soft green
  arancio: '#E8A060',         // Soft orange
  
  // UI colors
  white: '#FFFFFF',
  inPiazza: '#40C4AA',        // Teal badge for "in piazza"
  
  // Shadows
  shadow: '#8ABAB0',          // Mint shadow
};

export const Fonts = {
  titolo: {
    fontWeight: '900' as const,
    letterSpacing: 1.5,
  },
  label: {
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
};
