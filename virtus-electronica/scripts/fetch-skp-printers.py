"""Download public SKP3D printer pages to a temporary research cache. No shop mutations."""
import concurrent.futures, json, pathlib, tempfile, urllib.request, re, html

root = pathlib.Path(__file__).resolve().parent
cache = pathlib.Path(tempfile.gettempdir()) / 'virtus-skp-printers'
cache.mkdir(exist_ok=True)
entries = json.loads((root / 'skp-printers-manifest.json').read_text(encoding='utf-8'))

def fetch(entry):
    path = cache / (entry['slug'] + '.html')
    try:
        req = urllib.request.Request(entry['url'], headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=12) as response:
            data = response.read()
        path.write_bytes(data)
        source = data.decode('utf-8')
        image = re.search(r'<meta property="og:image" content="([^"]+)', source)
        title = re.search(r'<h1[^>]*>(.*?)</h1>', source, re.S)
        return {'slug':entry['slug'], 'bytes':len(data), 'image':html.unescape(image[1]) if image else None, 'title':re.sub('<[^>]+>', '',title[1]) if title else None}
    except Exception as e:
        return {'slug':entry['slug'], 'error':str(e)}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(fetch, entries))
(cache / 'fetch-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
for result in results: print(json.dumps(result,ensure_ascii=True),flush=True)
