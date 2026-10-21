cd "$(dirname "$0")"
mk() { # $1 = three base url, $2 = out
  { cat head3d.html
    echo "<script type=\"importmap\">{\"imports\":{\"three\":\"$1/build/three.module.js\",\"three/addons/\":\"$1/examples/jsm/\"}}</script>"
    echo '<script>'; cat ../lab/engine.js ../lab/reaction_engine.js ../lab/i18n_en.js ../lab/i18n_ru.js ../lab/i18n_et.js ../lab/i18n_uk.js i18n3d.js decor3d.js elements3d.js; echo '</script>'
    echo '<script type="module">'; cat main3d.js; echo '</script>'; } > "$2"
}
mk "https://cdn.jsdelivr.net/npm/three@0.160.0" lab3d.html
if [ "${1:-}" = "--test" ]; then
  mk "/node_modules/three" test_body.html
  { echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'; cat test_body.html; echo '</body></html>'; } > test3d.html
fi
