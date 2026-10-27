// Serves /config.js on Vercel, built from the project's environment variables.
// All values are public browser keys (Mapbox "pk." token, Supabase anon key, optional Sentry DSN).
module.exports = (req, res) => {
  const config = {
    mapboxToken: process.env.MAPBOX_TOKEN || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    sentryDsn: process.env.SENTRY_DSN || ''
  };
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
  res.end('window.SAILO_CONFIG = ' + JSON.stringify(config) + ';\n');
};
