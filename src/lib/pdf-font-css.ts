// Shared font CSS for all PDF generators — ensures Cairo loads and Arabic renders correctly
export const FONT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; color: #000000; }
  body { font-family: 'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif; }
  table { border-collapse: collapse; }
  img { max-width: 100%; }
  /* CRITICAL: Force Cairo font on ALL Arabic elements */
  [dir="rtl"], [dir="rtl"] * {
    font-family: 'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif !important;
    letter-spacing: 0 !important;
    text-transform: none !important;
  }
  /* Also force on any span containing Arabic */
  span[dir="rtl"], div[dir="rtl"] {
    font-family: 'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif !important;
  }
`
