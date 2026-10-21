cd "$(dirname "$0")"
{ cat head.html
  echo '<script>'
  cat engine.js fx.js sim.js scene.js bench.js scenes2.js scenarios.js i18n_en.js i18n_ru.js i18n_et.js i18n_uk.js app.js lab.js
  echo '</script></body></html>'
} > lab.html
