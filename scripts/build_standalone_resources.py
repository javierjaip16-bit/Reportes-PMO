import json
import os

def build_resources():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    index_path = os.path.join(root, 'index.html')
    css_path = os.path.join(root, 'assets', 'css', 'styles.css')
    chart_path = os.path.join(root, 'assets', 'js', 'chart.umd.min.js')
    xlsx_path = os.path.join(root, 'assets', 'js', 'xlsx.full.min.js')
    app_path = os.path.join(root, 'assets', 'js', 'app.js')
    out_path = os.path.join(root, 'assets', 'js', 'standalone_resources.js')

    with open(index_path, 'r', encoding='utf-8') as f:
        html_template = f.read()

    with open(css_path, 'r', encoding='utf-8') as f:
        css_text = f.read()

    with open(chart_path, 'r', encoding='utf-8') as f:
        chart_js = f.read()

    with open(xlsx_path, 'r', encoding='utf-8') as f:
        xlsx_js = f.read()

    with open(app_path, 'r', encoding='utf-8') as f:
        app_js = f.read()

    bundle = {
        'htmlTemplate': html_template,
        'css': css_text,
        'chartJs': chart_js,
        'xlsxJs': xlsx_js,
        'appJs': app_js
    }

    js_code = 'window.STANDALONE_RESOURCES = ' + json.dumps(bundle, ensure_ascii=False) + ';\n'

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(js_code)

    print(f"Successfully generated {out_path} ({len(js_code):,} bytes)")

if __name__ == '__main__':
    build_resources()
